'use strict';

/**
 * Tests de caracterización de /api/acceso (accesoController y
 * accesoMetricasController): status + cuerpo + snapshot de consultas.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn(async (texto) => `data:image/png;base64,QR(${texto})`) }));
jest.mock('../helpers/qrSecurity.helper', () => ({ validarQrFirmado: jest.fn() }));

let mockColumnas;
jest.mock('../utils/adminRules', () => ({
  ...jest.requireActual('../utils/adminRules'),
  getTableColumns: jest.fn(async () => mockColumnas)
}));
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => next(),
  checkRole: () => (req, res, next) => next()
}));

const express = require('express');
const request = require('supertest');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/acceso', require('../routes/acceso.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let log;
let client;
let consoleSpies;

function route(q) {
  if (db.fallaEn && q.includes(db.fallaEn)) throw db.error || new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.includes('FROM codigos_qr_socios q')) return rows(db.socio);
  if (q.includes('FROM codigos_qr_visitas q')) return rows(db.visita);
  if (q.includes('FROM codigos_qr_pases q')) {
    if (db.pasesFaltante) throw Object.assign(new Error('relation "pases" does not exist'), { code: '42P01' });
    return rows(db.pase);
  }
  if (q.startsWith('SELECT tipo FROM registro_acceso')) return rows(db.ultimoTipo ? [{ tipo: db.ultimoTipo }] : []);
  if (q.startsWith('INSERT INTO registro_acceso')) return rows([{ acceso_id: 1, timestamp: db.timestamp }]);
  if (q.startsWith('UPDATE pases SET hora_salida')) return rows([]);
  // Métricas
  if (q.includes('AS total_accesos, COUNT(*) FILTER'))
    return rows([{ total_accesos: '9', total_entradas: '5', total_salidas: '4' }]);
  if (q.includes('EXTRACT(HOUR FROM'))
    return rows([
      { hora: 9, total: 4 },
      { hora: 18, total: 3 }
    ]);
  if (q.includes('DATE("timestamp") AS fecha')) {
    return rows([
      { fecha: new Date('2026-09-01T00:00:00Z'), total: 5 },
      { fecha: '2026-09-02', total: 4 }
    ]);
  }
  if (q.includes('FROM registro_acceso ra')) return rows([{ socio_id: 10, nombre: 'Ana López', total_accesos: 6 }]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockColumnas = new Set(['acceso_id', 'socio_id', 'visita_id', 'pase_id', 'tipo', 'metodo', 'timestamp']);
  db = {
    fallaEn: null,
    error: null,
    pasesFaltante: false,
    socio: [{ qr_id: 1, socio_id: 10, activo: true, nombre_completo: 'Ana López' }],
    visita: [{ qr_id: 2, visita_id: 20, nombre_completo: 'Luis Pérez', expira_en: 'x' }],
    pase: [{ qr_id: 3, pase_id: 30, nombre_completo: 'Carla Ruiz', expira_en: 'x' }],
    ultimoTipo: null,
    timestamp: new Date('2026-09-30T18:00:00.000Z')
  };
  ({ log, client } = recordQueries(pool, route));
  validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 10 });
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const leer = (body) => request(app).post('/api/acceso/lectura-qr').send(body);

describe('POST /lectura-qr: validaciones', () => {
  it('codigo_qr ausente o vacío', async () => {
    for (const body of [{}, { codigo_qr: null }]) {
      const res = await leer(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'codigo_qr es requerido' });
    }
    for (const body of [{ codigo_qr: 12 }, { codigo_qr: '   ' }]) {
      const res = await leer(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'codigo_qr debe ser una cadena no vacia' });
    }
    const res = await request(app).post('/api/acceso/lectura-qr');
    expect(res.body).toEqual({ error: 'codigo_qr es requerido' });
  });

  it('errores de firma, de imagen y tipo no soportado', async () => {
    validarQrFirmado.mockImplementationOnce(() => {
      throw Object.assign(new Error('QR vencido'), { statusCode: 401 });
    });
    let res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR vencido' });

    validarQrFirmado.mockImplementationOnce(() => {
      throw new Error('inesperado');
    });
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al validar codigo QR' });

    QRCode.toDataURL.mockRejectedValueOnce(new Error('qr'));
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al validar codigo QR' });

    validarQrFirmado.mockReturnValueOnce({ type: 'invitado' });
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Tipo de QR no soportado' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('POST /lectura-qr: socio', () => {
  it('entrada y luego salida (timestamp Date → ISO)', async () => {
    let res = await leer({ codigo_qr: '  {"a":1}  ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      tipo: 'entrada',
      nombre_completo: 'Ana López',
      timestamp: '2026-09-30T18:00:00.000Z',
      mensaje: 'Entrada registrada correctamente'
    });

    db.ultimoTipo = 'entrada';
    db.timestamp = '2026-09-30 18:05:00';
    res = await leer({ codigo_qr: 'x' });
    expect(res.body).toEqual({
      tipo: 'salida',
      nombre_completo: 'Ana López',
      timestamp: '2026-09-30 18:05:00',
      mensaje: 'Salida registrada correctamente'
    });
    expect(log).toMatchSnapshot();
  });

  it('sin columna pase_id en registro_acceso', async () => {
    mockColumnas = new Set(['acceso_id', 'socio_id', 'visita_id', 'tipo']);
    await leer({ codigo_qr: 'x' });
    expect(log).toMatchSnapshot();
  });

  it('no encontrado → 404; inactivo → 403', async () => {
    db.socio = [];
    let res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'QR de socio no encontrado' });

    db.socio = [{ qr_id: 1, socio_id: 10, activo: false }];
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Socio inactivo' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});

describe('POST /lectura-qr: visita y pase', () => {
  it('visita: entrada; expirada → 401', async () => {
    validarQrFirmado.mockReturnValue({ type: 'visita', visita_id: 20 });
    let res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.nombre_completo).toBe('Luis Pérez');

    db.visita = [];
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR expirado' });
    expect(log).toMatchSnapshot();
  });

  it('pase: entrada, salida (finaliza el pase), no activo y tabla faltante', async () => {
    validarQrFirmado.mockReturnValue({ type: 'pase', pase_id: 30 });
    let res = await leer({ codigo_qr: 'x' });
    expect(res.body.tipo).toBe('entrada');

    db.ultimoTipo = 'entrada';
    res = await leer({ codigo_qr: 'x' });
    expect(res.body.tipo).toBe('salida');
    expect(log).toMatchSnapshot();

    db.pase = [];
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR expirado o pase no activo' });

    db.pasesFaltante = true;
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(401);
  });

  it('pase sin columna pase_id → 500 con mensaje', async () => {
    validarQrFirmado.mockReturnValue({ type: 'pase', pase_id: 30 });
    mockColumnas = new Set(['acceso_id', 'socio_id', 'visita_id', 'tipo']);
    const res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'La tabla registro_acceso no tiene pase_id configurado' });
    expect(log).toMatchSnapshot();
  });
});

describe('POST /lectura-qr: errores', () => {
  it('error de BD → 500 con ROLLBACK; error de pases no-42P01 → 500; conexión → errorHandler', async () => {
    db.fallaEn = 'INSERT INTO registro_acceso';
    let res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar acceso por QR' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');

    validarQrFirmado.mockReturnValue({ type: 'pase', pase_id: 30 });
    db.fallaEn = 'FROM codigos_qr_pases';
    res = await leer({ codigo_qr: 'x' });
    expect(res.status).toBe(500);

    db.fallaEn = null;
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await leer({ codigo_qr: 'x' });
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

describe('GET /metricas', () => {
  const metricas = (query) => request(app).get('/api/acceso/metricas').query(query);

  it('validaciones', async () => {
    let res = await metricas({ desde: '2026-09-01' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Los parámetros desde y hasta son requeridos' });

    res = await metricas({ desde: '2026-9-1', hasta: '2026-09-30' });
    expect(res.body).toEqual({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });

    res = await metricas({ desde: '2026-09-01', hasta: '2026-09-30', tipo: 'otro' });
    expect(res.body).toEqual({ error: 'El parámetro tipo debe ser "socio" o "visita"' });
    expect(log).toEqual([]);
  });

  it.each([[undefined], ['socio'], ['visita']])('tipo=%s', async (tipo) => {
    const res = await metricas({ desde: '2026-09-01', hasta: '2026-09-03', ...(tipo ? { tipo } : {}) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('rango invertido → al menos 1 día; error → 500', async () => {
    let res = await metricas({ desde: '2026-09-10', hasta: '2026-09-01' });
    expect(res.body.promedio_diario).toBe(9);

    db.fallaEn = 'EXTRACT(HOUR';
    res = await metricas({ desde: '2026-09-01', hasta: '2026-09-03' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener métricas de acceso' });
  });
});
