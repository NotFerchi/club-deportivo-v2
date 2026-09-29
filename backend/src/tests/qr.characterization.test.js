'use strict';

/**
 * Tests de caracterización de /api/qr y GET /api/socios/:socio_id/qr (qrController).
 * Status + cuerpo + snapshot de consultas. Reloj fijo; QRCode, HMAC y la
 * validación de firma se simulan.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn(async (texto) => `data:image/png;base64,QR(${texto})`) }));
jest.mock('../utils/qrCrypto', () => ({ generarHmacSha256: (payload) => `hmac(${JSON.stringify(payload)})` }));
jest.mock('../helpers/qrSecurity.helper', () => ({ validarQrFirmado: jest.fn() }));

let mockUser;
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = mockUser;
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/qr', require('../routes/qr.routes'));
app.use('/api/socios', require('../routes/socio.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let log;

let consoleSpies;

function route(q) {
  if (db.fallaEn && q.includes(db.fallaEn)) throw db.error || new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT socio_id, activo FROM socios WHERE socio_id = $1 FOR UPDATE')) return rows(db.socioLock);
  if (q.startsWith('UPDATE codigos_qr_socios SET activo = FALSE')) return rows([]);
  if (q.startsWith('INSERT INTO codigos_qr_socios')) return rows([{ qr_id: 11 }]);
  if (q.startsWith('SELECT visita_id, vigente FROM visitas WHERE visita_id = $1 FOR UPDATE'))
    return rows(db.visitaLock);
  if (q.startsWith('INSERT INTO codigos_qr_visitas')) return rows([{ qr_id: 22 }]);
  if (q.startsWith('SELECT qr_id, socio_id, codigo_qr FROM codigos_qr_socios')) return rows(db.qrActivo);
  if (q.startsWith('SELECT socio_id, activo, numero_socio FROM socios WHERE usuario_id')) return rows(db.miSocio);
  if (q.startsWith('SELECT qr_id, socio_id, codigo_qr, created_at FROM codigos_qr_socios')) return rows(db.miQr);
  if (q.startsWith('SELECT s.socio_id, s.numero_socio, s.activo')) return rows(db.identificado);
  if (q.startsWith('SELECT COUNT(*) AS total FROM sanciones')) return rows([{ total: db.sanciones }]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeAll(() => {
  jest.useFakeTimers({
    now: new Date('2026-09-30T18:00:00.000Z'),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'hrtime',
      'performance'
    ]
  });
});

afterAll(() => jest.useRealTimers());

beforeEach(() => {
  mockUser = { usuario_id: 7, rol: 'recepcion' };
  db = {
    fallaEn: null,
    error: null,
    socioLock: [{ socio_id: 10, activo: true }],
    visitaLock: [{ visita_id: 5, vigente: true }],
    qrActivo: [{ qr_id: 11, socio_id: 10, codigo_qr: 'data:img' }],
    miSocio: [{ socio_id: 10, activo: true, numero_socio: 'SOC-0010' }],
    miQr: [{ qr_id: 11, socio_id: 10, codigo_qr: 'data:img', created_at: '2026-09-01T00:00:00.000Z' }],
    identificado: [
      {
        socio_id: 10,
        numero_socio: 'SOC-0010',
        activo: true,
        tipo: null,
        modalidad: 'Individual',
        es_titular: false,
        telefono: '',
        fecha_nacimiento: null,
        nombre_completo: 'Ana López'
      }
    ],
    sanciones: '2'
  };
  ({ log } = recordQueries(pool, route));
  validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 10 });
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

describe('POST /api/qr/generar-socio', () => {
  const post = (body) => request(app).post('/api/qr/generar-socio').send(body);

  it('genera el QR (desactiva los anteriores)', async () => {
    const res = await post({ socio_id: '10' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('validaciones y errores', async () => {
    for (const body of [{}, { socio_id: 'x' }, { socio_id: -1 }, { socio_id: 1.5 }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'socio_id debe ser un entero positivo' });
    }
    let res = await request(app).post('/api/qr/generar-socio');
    expect(res.status).toBe(400);

    db.socioLock = [];
    res = await post({ socio_id: 10 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });

    db.socioLock = [{ socio_id: 10, activo: false }];
    res = await post({ socio_id: 10 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El socio no esta activo' });

    db.socioLock = [{ socio_id: 10, activo: true }];
    db.fallaEn = 'INSERT INTO codigos_qr_socios';
    res = await post({ socio_id: 10 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al generar codigo QR del socio' });

    db.error = Object.assign(new Error('prohibido'), { statusCode: 409 });
    res = await post({ socio_id: 10 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'prohibido' });
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post({ socio_id: 10 });
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

describe('POST /api/qr/generar-visita', () => {
  const post = (body) => request(app).post('/api/qr/generar-visita').send(body);

  it('genera el QR con vigencia de 24 h', async () => {
    const res = await post({ visita_id: 5 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('validaciones y errores', async () => {
    let res = await post({ visita_id: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'visita_id debe ser un entero positivo' });

    for (const visita of [[], [{ visita_id: 5, vigente: false }]]) {
      db.visitaLock = visita;
      res = await post({ visita_id: 5 });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Visita no encontrada o no vigente' });
    }

    db.visitaLock = [{ visita_id: 5, vigente: true }];
    db.fallaEn = 'INSERT INTO codigos_qr_visitas';
    res = await post({ visita_id: 5 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al generar codigo QR de la visita' });

    db.error = Object.assign(new Error('conflicto'), { statusCode: 409 });
    res = await post({ visita_id: 5 });
    expect(res.status).toBe(409);
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post({ visita_id: 5 });
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

describe('GET /api/socios/:socio_id/qr', () => {
  it('QR activo, 400, 404 y error', async () => {
    let res = await request(app).get('/api/socios/10/qr');
    expect(res.body).toEqual({ qr_id: 11, qr_image: 'data:img', socio_id: 10 });

    res = await request(app).get('/api/socios/abc/qr');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'socio_id debe ser un entero positivo' });

    db.qrActivo = [];
    res = await request(app).get('/api/socios/10/qr');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No existe QR activo para el socio' });

    db.fallaEn = 'FROM codigos_qr_socios';
    res = await request(app).get('/api/socios/10/qr');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al consultar codigo QR del socio' });
    expect(log).toMatchSnapshot();
  });
});

describe('GET /api/qr/mi-qr', () => {
  it('QR propio y casos de error', async () => {
    let res = await request(app).get('/api/qr/mi-qr');
    expect(res.body).toEqual({
      qr_id: 11,
      qr_image: 'data:img',
      socio_id: 10,
      numero_socio: 'SOC-0010',
      generado_en: '2026-09-01T00:00:00.000Z'
    });

    mockUser = undefined;
    res = await request(app).get('/api/qr/mi-qr');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'No autenticado' });

    mockUser = { usuario_id: 7 };
    db.miSocio = [];
    res = await request(app).get('/api/qr/mi-qr');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No se encontró perfil de socio para este usuario' });

    db.miSocio = [{ socio_id: 10, activo: false }];
    res = await request(app).get('/api/qr/mi-qr');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El socio no está activo' });

    db.miSocio = [{ socio_id: 10, activo: true, numero_socio: 'SOC-0010' }];
    db.miQr = [];
    res = await request(app).get('/api/qr/mi-qr');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No tienes un QR activo. Solicítalo en recepción.' });

    db.fallaEn = 'FROM socios WHERE usuario_id';
    res = await request(app).get('/api/qr/mi-qr');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener tu código QR' });
    expect(log).toMatchSnapshot();
  });
});

describe('POST /api/qr/identificar-socio', () => {
  const post = (body) => request(app).post('/api/qr/identificar-socio').send(body);

  it('identifica al socio con sus sanciones activas', async () => {
    const res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({
      socio_id: 10,
      numero_socio: 'SOC-0010',
      nombre_completo: 'Ana López',
      telefono: null,
      tipo: null,
      modalidad: 'Individual',
      es_titular: false,
      fecha_nacimiento: null,
      sanciones_activas: 2
    });
    expect(log).toMatchSnapshot();
  });

  it('validaciones y errores', async () => {
    let res = await post({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'codigo_qr es requerido' });

    validarQrFirmado.mockImplementationOnce(() => {
      throw new Error('firma inválida');
    });
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'firma inválida' });

    validarQrFirmado.mockImplementationOnce(() => {
      throw Object.assign(new Error('vencido'), { statusCode: 410 });
    });
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(410);

    validarQrFirmado.mockReturnValueOnce({ type: 'visita', visita_id: 1 });
    res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({ error: 'Este endpoint es solo para socios' });

    validarQrFirmado.mockReturnValueOnce({ type: 'socio', socio_id: '0' });
    res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({ error: 'QR inválido: socio_id no válido' });

    db.identificado = [];
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });

    db.identificado = [{ socio_id: 10, activo: false }];
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'El socio no está activo' });

    db.identificado = [{ socio_id: 10, activo: true }];
    db.sanciones = 'x';
    res = await post({ codigo_qr: 'x' });
    expect(res.body.sanciones_activas).toBe(0);

    db.fallaEn = 'FROM sanciones';
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(log).toMatchSnapshot();

    res = await request(app).post('/api/qr/identificar-socio');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});
