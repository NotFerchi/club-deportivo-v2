'use strict';

/**
 * Tests de caracterización de POST /api/sesiones/:sesion_id/asistencia-qr
 * (asistenciaQrController). Además de status + cuerpo, cada test compara con un
 * snapshot la secuencia exacta de consultas y parámetros. Fecha fija con fake timers
 * (la fecha por defecto es la de Ciudad de México).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../helpers/qrSecurity.helper', () => ({ validarQrFirmado: jest.fn() }));
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 5, rol: 'instructor' };
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
app.use('/api/sesiones', require('../routes/sesiones.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const ERROR_HANDLER = { ok: false, error: 'Error interno del servidor' };
const NOW = new Date('2026-09-30T18:00:00Z');

let db;
let log;
let client;
let consoleSpies;

function route(q) {
  if (db.falla && q.includes(db.falla)) throw new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT reserva_id FROM reservaciones')) return rows(db.reserva);
  if (q.startsWith('SELECT sp.cupo_maximo')) return rows(db.sesion);
  if (q.startsWith('INSERT INTO reservaciones')) return rows([]);
  if (q.startsWith('SELECT asistencia_id FROM asistencia')) return rows(db.duplicado);
  if (q.startsWith('INSERT INTO asistencia')) return rows([{ asistencia_id: 900 }]);
  if (q.includes('AS nombre FROM socios s')) return rows(db.nombre);
  if (q.startsWith('SELECT nombre_completo FROM visitas')) return rows(db.visita);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
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
  jest.setSystemTime(NOW);
  validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 10 });
  db = {
    falla: null,
    reserva: [{ reserva_id: 1 }],
    sesion: [{ cupo_maximo: 10, hora_inicio: '08:00', hora_fin: '09:00', inscritos: '3' }],
    duplicado: [],
    nombre: [{ nombre: 'Ana Pérez' }],
    visita: [{ nombre_completo: 'Invitado Uno' }]
  };
  ({ log, client } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const ultimoError = () => consoleSpies[1].mock.calls.at(-1)?.[0];
const escanear = (body, sesion = '4') => request(app).post(`/api/sesiones/${sesion}/asistencia-qr`).send(body);

describe('validaciones previas (sin transacción)', () => {
  it('sesion_id inválido → 400', async () => {
    const res = await escanear({ codigo_qr: 'x' }, '0');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'sesion_id debe ser un entero positivo' });
  });

  it.each([
    [{}, 400, 'codigo_qr es requerido'],
    [{ codigo_qr: null }, 400, 'codigo_qr es requerido'],
    [{ codigo_qr: '   ' }, 400, 'codigo_qr debe ser una cadena no vacía'],
    [{ codigo_qr: 5 }, 400, 'codigo_qr debe ser una cadena no vacía']
  ])('codigo_qr %j → %i', async (body, status, error) => {
    const res = await escanear(body);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
    expect(validarQrFirmado).not.toHaveBeenCalled();
  });

  it('sin body → 400 codigo_qr requerido', async () => {
    const res = await request(app).post('/api/sesiones/4/asistencia-qr');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'codigo_qr es requerido' });
  });

  it('errores de firma: 400 (mensaje), 401 (genérico), otro → 500', async () => {
    const lanzar = (statusCode, message) => () => {
      const error = new Error(message);
      error.statusCode = statusCode;
      throw error;
    };
    validarQrFirmado.mockImplementationOnce(lanzar(400, 'QR mal formado'));
    let res = await escanear({ codigo_qr: ' abc ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'QR mal formado' });
    expect(validarQrFirmado).toHaveBeenCalledWith('abc');

    validarQrFirmado.mockImplementationOnce(lanzar(401, 'firma'));
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR inválido o HMAC inválido' });

    validarQrFirmado.mockImplementationOnce(lanzar(500, 'sin secreto'));
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al validar código QR' });
    expect(ultimoError()).toBe('Error al validar QR:');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('tipo no soportado y visita expirada → 401', async () => {
    validarQrFirmado.mockReturnValueOnce({ type: 'pase', pase_id: 1 });
    let res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Tipo de QR no soportado' });

    validarQrFirmado.mockReturnValueOnce({ type: 'visita', visita_id: 20, expira_en: '2026-09-30T18:00:00Z' });
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR de visita expirado' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('socio', () => {
  it('con reservación confirmada → asistencia (fecha MX por defecto)', async () => {
    const res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      asistencia_id: 900,
      nombre: 'Ana Pérez',
      tipo_participante: 'socio',
      sesion_id: 4,
      presente: true
    });
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(log).toMatchSnapshot();
  });

  it('sin reservación → inscribe y registra; fecha del body; nombre por defecto', async () => {
    db.reserva = [];
    db.nombre = [];
    const res = await escanear({ codigo_qr: 'abc', fecha: '2026-10-02' });
    expect(res.status).toBe(201);
    expect(res.body.nombre).toBe('Socio 10');
    expect(log).toMatchSnapshot();
  });

  it('fecha por defecto usa el día de México (03:00 UTC → día anterior)', async () => {
    jest.setSystemTime(new Date('2026-10-01T03:00:00Z'));
    await escanear({ codigo_qr: 'abc' });
    expect(log.find(([, sql]) => sql.startsWith('SELECT reserva_id'))[2]).toEqual([4, 10, '2026-09-30']);
  });

  it('sesión inexistente, clase llena, duplicado, socio_id inválido → ROLLBACK', async () => {
    db.reserva = [];
    db.sesion = [];
    let res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'La sesión no existe' });

    db.sesion = [{ cupo_maximo: '3', hora_inicio: '08:00', hora_fin: '09:00', inscritos: '3' }];
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La clase está llena, no se puede inscribir' });

    db.reserva = [{ reserva_id: 1 }];
    db.duplicado = [{ asistencia_id: 5 }];
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Asistencia ya registrada hoy' });

    validarQrFirmado.mockReturnValueOnce({ type: 'socio', socio_id: 'x' });
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR inválido o HMAC inválido' });
    expect(client.release).toHaveBeenCalledTimes(4);
    expect(log).toMatchSnapshot();
  });
});

describe('visita', () => {
  beforeEach(() => validarQrFirmado.mockReturnValue({ type: 'visita', visita_id: 20 }));

  it('registra (sin expira_en y con expira_en futuro)', async () => {
    let res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      asistencia_id: 900,
      nombre: 'Invitado Uno',
      tipo_participante: 'visita',
      sesion_id: 4,
      presente: true
    });

    validarQrFirmado.mockReturnValueOnce({ type: 'visita', visita_id: 20, expira_en: '2026-09-30T18:00:01Z' });
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(201);
    expect(log).toMatchSnapshot();
  });

  it('duplicado, no encontrada, visita_id inválido → ROLLBACK', async () => {
    db.duplicado = [{ asistencia_id: 5 }];
    let res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Asistencia ya registrada hoy' });

    db.duplicado = [];
    db.visita = [];
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Visita no encontrada' });

    validarQrFirmado.mockReturnValueOnce({ type: 'visita', visita_id: -1 });
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR inválido o HMAC inválido' });
    expect(log).toMatchSnapshot();
  });
});

describe('errores de infraestructura', () => {
  it('error de BD → ROLLBACK + 500; conexión → errorHandler', async () => {
    db.falla = 'INSERT INTO asistencia';
    let res = await escanear({ codigo_qr: 'abc' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar asistencia por QR' });
    expect(ultimoError()).toBe('Error en registrarAsistenciaQr:');
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await escanear({ codigo_qr: 'abc' });
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});
