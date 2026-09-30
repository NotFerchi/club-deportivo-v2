'use strict';

/**
 * Tests de caracterización de inscripcionesController.
 * Fijan el comportamiento HTTP actual (status + cuerpo) para detectar
 * regresiones al extraer la lógica a services/inscripcionService.js.
 *
 * pool.query se enruta por el texto del SQL (no por orden de llamada) para
 * que los tests no dependan de la estructura interna del código.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/mexicoDate', () => ({
  getMexicoDateISO: () => '2026-09-30', // miércoles → dia_semana 3
  getMexicoTimeISO: () => '08:00'
}));
jest.mock('../utils/adminRules', () => ({
  ...jest.requireActual('../utils/adminRules'),
  getTableColumns: jest.fn(async (table) => {
    if (table === 'espacios') return new Set(['estado', 'activo']);
    if (table === 'mantenimiento_espacios') return new Set(['activo']);
    return new Set();
  })
}));

const pool = require('../config/database');
const express = require('express');
const request = require('supertest');
const inscripcionesController = require('../controllers/inscripcionesController');
const inscripcionesRoutes = require('../routes/inscripciones.routes');

// Validaciones de entrada: se prueban a través del router real (ruta + middlewares + controlador).
const app = express();
app.use(express.json());
app.use('/api/inscripciones', inscripcionesRoutes);

// ── helpers ──────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let client;
let consoleSpies;

const defaultDb = () => ({
  sesion: [{ sesion_id: 1, cupo_maximo: 10, dia_semana: 2, hora_inicio: '09:00:00', hora_fin: '10:00:00' }],
  choque: [],
  reservaConflicto: [],
  existente: [],
  total: '3',
  cancelada: [{ inscripcion_id: 40 }],
  misInscripciones: [{ inscripcion_id: 1, sesion_id: 1, disciplina: 'Yoga' }]
});

function routeQuery(sql) {
  const q = String(sql).replace(/\s+/g, ' ');
  if (q.includes('SELECT pg_advisory_xact_lock($1)')) return rows([]);
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.includes('FROM sesiones_programadas sp JOIN espacios e')) return rows(db.sesion);
  if (q.includes('OVERLAPS')) return rows(db.choque);
  if (q.includes('FROM reservaciones WHERE socio_id')) return rows(db.reservaConflicto);
  if (q.includes('SELECT inscripcion_id, estado, fecha_inscripcion')) return rows(db.existente);
  if (q.includes("SET estado = 'Confirmada'")) return rows([{ inscripcion_id: 20 }]);
  if (q.includes('COUNT(*)')) return rows([{ total: db.total }]);
  if (q.includes('INSERT INTO inscripciones_clases')) return rows([{ inscripcion_id: 30 }]);
  if (q.includes("SET estado = 'Cancelada'")) return rows(db.cancelada);
  if (q.includes('FROM inscripciones_clases ic JOIN sesiones_programadas sp') && q.includes('LEFT JOIN instructores')) {
    return rows(db.misInscripciones);
  }
  throw new Error(`Query no esperada en test: ${q}`);
}

const findCall = (mockFn, fragment) =>
  mockFn.mock.calls.find(([sql]) => String(sql).replace(/\s+/g, ' ').includes(fragment));

const inscribirReq = (body = { sesionId: 1, socioId: 10 }) => ({ body });

beforeEach(() => {
  db = defaultDb();
  pool.query.mockImplementation(async (sql) => routeQuery(sql));
  client = { query: jest.fn(async (sql) => routeQuery(sql)), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  consoleSpies = [
    jest.spyOn(console, 'error').mockImplementation(() => {}),
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  ];
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// ── inscribir ────────────────────────────────────────────────────────────────

describe('inscribir', () => {
  it('inscripción válida → 201', async () => {
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Inscripción exitosa', inscripcion_id: 30 });
    const [, params] = findCall(client.query, 'INSERT INTO inscripciones_clases');
    expect(params).toEqual([1, 10]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('faltan datos → 400 (vía router)', async () => {
    for (const body of [{ sesionId: 1 }, { socioId: 10 }, { sesionId: 1, socioId: 0 }, { sesionId: '', socioId: 10 }]) {
      const res = await request(app).post('/api/inscripciones/inscribir').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Faltan datos requeridos: sesionId y socioId' });
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('clase inexistente o espacio no disponible → 404', async () => {
    db.sesion = [];
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'La clase no existe o el espacio no está disponible' });
  });

  it('choque de horario con otra clase → 400 con la disciplina', async () => {
    db.choque = [{ disciplina: 'Natación' }];
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Choque de horario: Ya estás inscrito en Natación a esta hora.'
    });
  });

  it('clase de hoy con reserva de cancha solapada → 400', async () => {
    db.sesion[0].dia_semana = 3; // miércoles = hoy
    db.reservaConflicto = [{ '?column?': 1 }];
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tienes una reserva de cancha activa en ese horario.' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('clase de otro día no consulta reservas', async () => {
    db.reservaConflicto = [{ '?column?': 1 }];
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(findCall(pool.query, 'FROM reservaciones')).toBeUndefined();
  });

  it('si falla la verificación de reservas, solo avisa y continúa → 201', async () => {
    db.sesion[0].dia_semana = 3;
    pool.query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM reservaciones')) throw new Error('tabla no existe');
      return routeQuery(sql);
    });
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Inscripción exitosa', inscripcion_id: 30 });
  });

  it('inscripción duplicada (ya confirmada) → 400', async () => {
    db.existente = [{ inscripcion_id: 20, estado: 'Confirmada' }];
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ya estás inscrito en esta clase' });
    expect(findCall(client.query, 'INSERT INTO inscripciones_clases')).toBeUndefined();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('inscripción duplicada detectada por la BD (23505) → 400', async () => {
    client.query.mockImplementation(async (sql) => {
      if (String(sql).includes('INSERT INTO inscripciones_clases')) {
        const err = new Error('duplicate key');
        err.code = '23505';
        throw err;
      }
      return routeQuery(sql);
    });
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Ya estás inscrito en esta clase' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('reactiva inscripción cancelada → 201 sin revisar cupo', async () => {
    db.existente = [{ inscripcion_id: 20, estado: 'Cancelada' }];
    db.total = '10'; // clase llena: la reactivación no revisa cupo
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Inscripción reactivada exitosamente',
      inscripcion_id: 20
    });
    const [, params] = findCall(client.query, "SET estado = 'Confirmada'");
    expect(params).toEqual([20]);
    expect(findCall(client.query, 'COUNT(*)')).toBeUndefined();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('clase llena → 400', async () => {
    db.total = '10';
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'La clase está llena' });
    expect(findCall(client.query, 'INSERT INTO inscripciones_clases')).toBeUndefined();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('bug #41: toma el advisory lock de la sesión ANTES de contar cupos e insertar', async () => {
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    const callOrder = client.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' '));
    const beginIdx = callOrder.indexOf('BEGIN');
    const lockIdx = callOrder.findIndex((sql) => sql.includes('pg_advisory_xact_lock'));
    const insertIdx = callOrder.findIndex((sql) => sql.includes('INSERT INTO inscripciones_clases'));

    expect(beginIdx).toBeGreaterThanOrEqual(0);
    expect(lockIdx).toBeGreaterThan(beginIdx);
    expect(insertIdx).toBeGreaterThan(lockIdx);
    expect(client.query.mock.calls[lockIdx][1]).toEqual([1]);
  });

  it('error inesperado de BD → 500 genérico', async () => {
    pool.query.mockImplementation(async () => {
      throw new Error('boom');
    });
    const res = mockRes();
    await inscripcionesController.inscribir(inscribirReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al procesar la inscripción' });
  });
});

// ── cancelar ─────────────────────────────────────────────────────────────────

describe('cancelar', () => {
  it('cancela inscripción confirmada → 200', async () => {
    const res = mockRes();
    await inscripcionesController.cancelar({ body: { sesionId: 1, socioId: 10 } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Inscripción cancelada correctamente' });
  });

  it('faltan datos → 400 (vía router)', async () => {
    for (const body of [{}, { sesionId: 1 }, { socioId: 10 }]) {
      const res = await request(app).post('/api/inscripciones/cancelar').send(body);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Faltan datos requeridos' });
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('sin inscripción confirmada → 404', async () => {
    db.cancelada = [];
    const res = mockRes();
    await inscripcionesController.cancelar({ body: { sesionId: 1, socioId: 10 } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No se encontró la inscripción' });
  });
});

// ── getMisInscripciones ──────────────────────────────────────────────────────

describe('getMisInscripciones', () => {
  it('devuelve las inscripciones confirmadas del socio', async () => {
    const res = mockRes();
    await inscripcionesController.getMisInscripciones({ query: { socioId: '10' } }, res);

    expect(res.json).toHaveBeenCalledWith(db.misInscripciones);
  });

  it('sin socioId → 400 (vía router)', async () => {
    for (const query of [{}, { socioId: '' }]) {
      const res = await request(app).get('/api/inscripciones/mis-inscripciones').query(query);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'socioId requerido' });
    }
    expect(pool.query).not.toHaveBeenCalled();
  });
});
