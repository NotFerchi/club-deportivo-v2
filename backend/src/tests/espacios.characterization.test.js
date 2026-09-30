'use strict';

/**
 * Tests de caracterización de /api/espacios (espaciosController).
 * Además de status + cuerpo, cada test compara con un snapshot la secuencia
 * exacta de consultas y parámetros (transacciones, relación espacios_disciplinas,
 * historial de mantenimiento con esquema dinámico y auditoría).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));

// Columnas por tabla (getTableColumns), configurables por test.
let mockColumns;
jest.mock('../utils/adminRules', () => ({
  ...jest.requireActual('../utils/adminRules'),
  getTableColumns: jest.fn(async (tabla) => mockColumns[tabla] || new Set())
}));
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 3, rol: 'admin' };
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/espacios', require('../routes/espacios.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const ERROR_HANDLER = { ok: false, error: 'Error interno del servidor' };

const MANT_COMPLETO = new Set(['mant_id', 'espacio_id', 'fecha_inicio', 'fecha_fin', 'motivo', 'usuario_id']);
const USUARIOS = new Set(['usuario_id', 'nombres', 'apellido_paterno', 'apellido_materno', 'username']);

let db;
let log;
let client;
let consoleSpies;

function pgError(code) {
  const error = new Error(`pg ${code || 'boom'}`);
  error.code = code;
  return error;
}

function route(q) {
  for (const falla of db.fallas) {
    if (q.includes(falla.sql) && falla.veces > 0) {
      falla.veces--;
      throw pgError(falla.code);
    }
  }
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('INSERT INTO logs_sistema')) return rows([]);
  if (q.includes('AS disciplinas_texto')) return rows(db.espacios);
  if (q.startsWith('SELECT e.*,')) return rows(db.espacio);
  if (q.startsWith('INSERT INTO espacios')) return rows([{ espacio_id: 12 }]);
  if (q.startsWith('UPDATE espacios SET nombre')) return rows(db.actualizado);
  if (q.startsWith('DELETE FROM espacios_disciplinas') || q.startsWith('INSERT INTO espacios_disciplinas'))
    return rows([]);
  if (q.startsWith('SELECT estado FROM espacios')) return rows(db.estadoActual);
  if (q.startsWith('UPDATE espacios SET estado')) return rows([]);
  if (q.includes('mantenimiento_espacios') && !q.startsWith('SELECT')) return rows([]);
  if (q.includes('FROM mantenimiento_espacios m')) return rows(db.historial);
  if (q.startsWith('DELETE FROM espacios')) return rows(db.borrado);
  if (q.startsWith('SELECT disciplina_id, nombre FROM disciplinas')) return rows(db.disciplinas);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockColumns = { mantenimiento_espacios: MANT_COMPLETO, usuarios: USUARIOS };
  db = {
    fallas: [],
    espacios: [{ espacio_id: 1, nombre: 'Cancha' }],
    espacio: [{ espacio_id: 1, nombre: 'Cancha', disciplina_ids: [2] }],
    actualizado: [{ espacio_id: 1 }],
    estadoActual: [{ estado: 'Activo' }],
    historial: [{ mant_id: 1 }],
    borrado: [{ espacio_id: 1 }],
    disciplinas: [{ disciplina_id: 2, nombre: 'Tenis' }]
  };
  ({ log, client } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const ultimoError = () => consoleSpies[1].mock.calls.at(-1)?.[0];
const falla = (sql, code, veces = 1) => db.fallas.push({ sql, code, veces });

// ── Lectura ──────────────────────────────────────────────────────────────────

describe('GET /todos, /disciplinas, /:id', () => {
  it('listado con join; fallback 42P01 sin espacios_disciplinas; error', async () => {
    let res = await request(app).get('/api/espacios/todos');
    expect(res.body).toEqual(db.espacios);

    falla('AS disciplinas_texto', '42P01');
    res = await request(app).get('/api/espacios/todos');
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();

    falla('AS disciplinas_texto', '23000');
    res = await request(app).get('/api/espacios/todos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener espacios' });

    falla('AS disciplinas_texto', '42P01');
    falla("'[]'::json AS disciplinas", '42P01');
    res = await request(app).get('/api/espacios/todos');
    expect(res.status).toBe(500);
  });

  it('GET /disciplinas y /:id (200, 404, 500)', async () => {
    let res = await request(app).get('/api/espacios/disciplinas');
    expect(res.body).toEqual(db.disciplinas);

    res = await request(app).get('/api/espacios/1');
    expect(res.body).toEqual(db.espacio[0]);

    db.espacio = [];
    res = await request(app).get('/api/espacios/1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Espacio no encontrado' });
    expect(log).toMatchSnapshot();

    falla('SELECT e.*');
    res = await request(app).get('/api/espacios/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener espacio' });

    falla('FROM disciplinas ORDER BY');
    res = await request(app).get('/api/espacios/disciplinas');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener disciplinas' });
  });
});

// ── Alta / edición ───────────────────────────────────────────────────────────

describe('POST / y PUT /:id', () => {
  it('crea con disciplina_ids (dedup, inválidos fuera), con disciplina_id y sin disciplinas', async () => {
    let res = await request(app)
      .post('/api/espacios')
      .send({ nombre: 'Cancha', capacidad_maxima: 10, disciplina_ids: [3, '3', 0, 'x', 4], estado: 'mantenimiento' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, id: 12, message: 'Espacio creado correctamente' });

    await request(app).post('/api/espacios').send({ nombre: 'Alberca', capacidad_maxima: 5, disciplina_id: 7 });
    await request(app).post('/api/espacios').send({ nombre: 'Salón', capacidad_maxima: 5, estado: 'raro' });
    expect(client.release).toHaveBeenCalledTimes(3);
    expect(log).toMatchSnapshot();
  });

  it('crea: validación, 42P01 en espacios_disciplinas se ignora, error → ROLLBACK, conexión y sin body', async () => {
    let res = await request(app).post('/api/espacios').send({ nombre: 'Cancha' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Nombre y capacidad máxima son requeridos' });
    expect(pool.connect).not.toHaveBeenCalled();

    falla('DELETE FROM espacios_disciplinas', '42P01');
    res = await request(app)
      .post('/api/espacios')
      .send({ nombre: 'A', capacidad_maxima: 1, disciplina_ids: [2] });
    expect(res.status).toBe(200);

    falla('INSERT INTO espacios_disciplinas');
    res = await request(app)
      .post('/api/espacios')
      .send({ nombre: 'A', capacidad_maxima: 1, disciplina_ids: [2] });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear espacio' });
    expect(ultimoError()).toBe('Error en createEspacio:');
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await request(app).post('/api/espacios').send({ nombre: 'A', capacidad_maxima: 1 });
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');

    res = await request(app).post('/api/espacios');
    expect(res.body).toEqual(ERROR_HANDLER);
  });

  it('actualiza, 404 con ROLLBACK, error, conexión y sin body', async () => {
    let res = await request(app)
      .put('/api/espacios/1')
      .send({ nombre: 'Cancha 2', capacidad_maxima: 12, disciplina_ids: [5], estado: 'Inactivo' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Espacio actualizado correctamente' });

    db.actualizado = [];
    res = await request(app).put('/api/espacios/1').send({});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Espacio no encontrado' });
    expect(log).toMatchSnapshot();

    db.actualizado = [{ espacio_id: 1 }];
    falla('UPDATE espacios SET nombre');
    res = await request(app).put('/api/espacios/1').send({ nombre: 'X' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar espacio' });

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await request(app).put('/api/espacios/1').send({ nombre: 'X' });
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');

    res = await request(app).put('/api/espacios/1');
    expect(res.body).toEqual(ERROR_HANDLER);
  });
});

// ── PATCH /:id/estado ────────────────────────────────────────────────────────

describe('PATCH /api/espacios/:id/estado', () => {
  const estado = (body) => request(app).patch('/api/espacios/1/estado').send(body);

  it('a mantenimiento (esquema completo), reactivar desde mantenimiento, inactivar', async () => {
    let res = await estado({ estado: 'MANTENIMIENTO', motivo: 'Pintura' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      estado: 'Mantenimiento',
      message: 'Espacio puesto en mantenimiento correctamente'
    });

    db.estadoActual = [{ estado: 'Mantenimiento' }];
    res = await estado({ estado: 'activo' });
    expect(res.body).toEqual({ ok: true, estado: 'Activo', message: 'Espacio reactivado correctamente' });

    db.estadoActual = [{ estado: 'Activo' }];
    res = await estado({ estado: 'Inactivo' });
    expect(res.body).toEqual({ ok: true, estado: 'Inactivo', message: 'Espacio inactivado correctamente' });
    expect(log).toMatchSnapshot();
  });

  it('esquemas reducidos de mantenimiento_espacios', async () => {
    mockColumns.mantenimiento_espacios = new Set(['espacio_id']);
    await estado({ estado: 'Mantenimiento' });

    mockColumns.mantenimiento_espacios = new Set(['espacio_id', 'motivo']);
    await estado({ estado: 'Mantenimiento' });

    mockColumns.mantenimiento_espacios = new Set();
    await estado({ estado: 'Mantenimiento' });
    expect(log).toMatchSnapshot();
  });

  it('404, error → ROLLBACK, conexión y sin body', async () => {
    db.estadoActual = [];
    let res = await estado({ estado: 'Activo' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Espacio no encontrado' });

    db.estadoActual = [{ estado: 'Activo' }];
    falla('INSERT INTO mantenimiento_espacios');
    res = await estado({ estado: 'Mantenimiento' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al cambiar estado del espacio' });
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await estado({ estado: 'Activo' });
    expect(res.body).toEqual(ERROR_HANDLER);

    res = await request(app).patch('/api/espacios/1/estado');
    expect(res.body).toEqual(ERROR_HANDLER);
  });
});

// ── GET /:id/mantenimiento ───────────────────────────────────────────────────

describe('GET /api/espacios/:id/mantenimiento', () => {
  const historial = () => request(app).get('/api/espacios/1/mantenimiento');

  it.each([
    ['completo', MANT_COMPLETO, USUARIOS],
    [
      'sin id propio, con created_at',
      new Set(['espacio_id', 'created_at', 'usuario_id']),
      new Set(['usuario_id', 'username'])
    ],
    ['id alterno, sin orden útil', new Set(['espacio_id', 'mantenimiento_id']), USUARIOS],
    ['sin columnas de orden ni usuario', new Set(['espacio_id']), USUARIOS],
    ['usuarios sin nombre ni username', new Set(['espacio_id', 'usuario_id', 'fecha_fin']), new Set(['usuario_id'])],
    ['usuarios sin usuario_id', new Set(['espacio_id', 'usuario_id']), new Set(['nombres'])]
  ])('esquema %s', async (_, mant, usuarios) => {
    mockColumns = { mantenimiento_espacios: mant, usuarios };
    const res = await historial();
    expect(res.body).toEqual(db.historial);
    expect(log).toMatchSnapshot();
  });

  it('sin espacio_id → []; 42P01 → []; otro error → 500 con detalle', async () => {
    mockColumns.mantenimiento_espacios = new Set(['motivo']);
    let res = await historial();
    expect(res.body).toEqual([]);
    expect(log).toEqual([]);

    mockColumns.mantenimiento_espacios = MANT_COMPLETO;
    falla('FROM mantenimiento_espacios m', '42P01');
    res = await historial();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    falla('FROM mantenimiento_espacios m', '42703');
    res = await historial();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Error al obtener historial de mantenimiento',
      pg_code: '42703',
      detail: 'pg 42703'
    });
  });
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /api/espacios/:id', () => {
  it('elimina, 404 y error', async () => {
    let res = await request(app).delete('/api/espacios/1');
    expect(res.body).toEqual({ ok: true, message: 'Espacio eliminado correctamente' });

    db.borrado = [];
    res = await request(app).delete('/api/espacios/1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Espacio no encontrado' });
    expect(log).toMatchSnapshot();

    falla('DELETE FROM espacios');
    res = await request(app).delete('/api/espacios/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar espacio' });
  });
});
