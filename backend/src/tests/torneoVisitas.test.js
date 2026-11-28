'use strict';

/**
 * U5-06 (E2.9 · SC-04): visitas en torneos.
 * - POST /:torneo_id/inscribir con socio_id, visita_id o nombre_externo (exactamente uno).
 *   La visita vale solo si existe (400), está vigente y es de hoy en México (409); no se inscribe
 *   dos veces en el mismo torneo (409).
 * - GET /visitas-vigentes?q=: buscador de visitas inscribibles, solo para el personal.
 * checkRole replica la regla real (rol en la lista) para probar los permisos de la ruta.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
let mockUser;
// checkRole con la misma regla que auth.middleware (el real exige JWT_SECRET al cargarse)
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = mockUser;
    next();
  },
  checkRole: (roles) => (req, res, next) =>
    req.user && roles.includes(req.user.rol)
      ? next()
      : res.status(403).json({ error: 'No tienes permisos para esta acción' })
}));

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/torneos', require('../routes/torneos.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const HOY = '2026-10-18'; // 2026-10-18T18:00Z es el 18 en México (12:00)
const DUPLICADO = { error: 'Este participante ya está inscrito en el torneo' };
const TIPO = { error: 'Debe especificar exactamente un tipo de participante' };
const VISITA_INEXISTENTE = { error: 'Visita no encontrada' };
const VISITA_NO_VIGENTE = { error: 'La visita ya no está vigente (pase cerrado o de otro día)' };
const SQL_VISITA = 'SELECT vigente, fecha_visita::text AS fecha_visita FROM visitas WHERE visita_id = $1';

let db;
let log;

function route(q) {
  if (db.falla && q.startsWith(db.falla.sql)) {
    const error = new Error(`pg ${db.falla.code}`);
    error.code = db.falla.code;
    throw error;
  }
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('INSERT INTO logs_sistema')) return rows([]);
  if (q.startsWith('SELECT estado, categoria_id, tipo_torneo,')) {
    return rows([
      {
        estado: 'Abierto',
        categoria_id: 1,
        tipo_torneo: 'Individual',
        fecha_inicio: '2026-11-07',
        fecha_inicio_inscripcion: null,
        fecha_fin_inscripcion: null,
        cupo_maximo: null
      }
    ]);
  }
  if (q.startsWith('SELECT * FROM socios')) return rows([{ socio_id: 10 }]);
  if (q === SQL_VISITA) return rows(db.visita);
  if (q.startsWith('SELECT participante_id FROM participantes_torneo')) return rows(db.duplicado);
  if (q.startsWith('SELECT nombre_externo FROM participantes_torneo')) return rows([]);
  if (q.startsWith('INSERT INTO participantes_torneo')) return rows([{ participante_id: 31 }]);
  if (q.startsWith('SELECT v.visita_id, v.nombre_completo')) return rows(db.busqueda);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-18T18:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
  mockUser = { usuario_id: 1, rol: 'coordinador' };
  db = {
    falla: null,
    visita: [{ vigente: true, fecha_visita: HOY }],
    duplicado: [],
    busqueda: [{ visita_id: 20, nombre_completo: 'Laura Visita', hora_entrada: '2026-10-18T10:00:00', mayor_16: true }]
  };
  ({ log } = recordQueries(pool, route));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const inscribir = (body) => request(app).post('/api/torneos/4/inscribir').send(body);
const insercion = () => log.find(([, sql]) => sql.startsWith('INSERT INTO participantes_torneo'));
const hizoInsert = () => log.some(([, sql]) => sql.startsWith('INSERT INTO participantes_torneo'));

describe('POST /api/torneos/:torneo_id/inscribir — tipos de participante', () => {
  it('socio → 201 con socio_id', async () => {
    const res = await inscribir({ socio_id: 10 });
    expect(res.status).toBe(201);
    expect(insercion()[2]).toEqual([4, 10, null, null, null, 1]);
  });

  it('visita vigente de hoy → 201 con visita_id', async () => {
    const res = await inscribir({ visita_id: '20' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ participante_id: 31 });
    expect(insercion()[2]).toEqual([4, null, 20, null, null, 1]);
    expect(log.find(([, sql]) => sql === SQL_VISITA)[2]).toEqual([20]);
  });

  it('externo → 201 con nombre_externo (sigue funcionando)', async () => {
    const res = await inscribir({ nombre_externo: '  Juan Pérez ' });
    expect(res.status).toBe(201);
    expect(insercion()[2]).toEqual([4, null, null, 'Juan Pérez', null, 1]);
  });

  it.each([
    ['socio + visita', { socio_id: 10, visita_id: 20 }],
    ['visita + externo', { visita_id: 20, nombre_externo: 'Juan' }],
    ['los tres', { socio_id: 10, visita_id: 20, nombre_externo: 'Juan' }],
    ['ninguno', {}],
    ['ninguno (vacíos)', { socio_id: '', visita_id: null, nombre_externo: '  ' }]
  ])('%s → 400 sin tocar la BD', async (_, body) => {
    const res = await inscribir(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(TIPO);
    expect(log).toEqual([]);
  });
});

describe('POST /api/torneos/:torneo_id/inscribir — validez de la visita', () => {
  it('visita inexistente → 400 y ROLLBACK sin INSERT', async () => {
    db.visita = [];
    const res = await inscribir({ visita_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(VISITA_INEXISTENTE);
    expect(hizoInsert()).toBe(false);
    expect(log.at(-1)[1]).toBe('ROLLBACK');
  });

  it.each([
    ['cerrada (vigente = false)', { vigente: false, fecha_visita: HOY }],
    ['vigente = null', { vigente: null, fecha_visita: HOY }],
    ['de ayer aunque siga vigente', { vigente: true, fecha_visita: '2026-10-17' }],
    ['de otro día y cerrada', { vigente: false, fecha_visita: '2026-09-01' }]
  ])('visita %s → 409 sin INSERT', async (_, visita) => {
    db.visita = [visita];
    const res = await inscribir({ visita_id: 20 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(VISITA_NO_VIGENTE);
    expect(hizoInsert()).toBe(false);
  });

  it('"hoy" es la fecha de México: a las 23:30 del 18 (05:30Z del 19) la visita del 18 sigue valiendo', async () => {
    jest.setSystemTime(new Date('2026-10-19T05:30:00Z'));
    const res = await inscribir({ visita_id: 20 });
    expect(res.status).toBe(201);
  });

  it('visita ya inscrita en el torneo → 409 sin INSERT', async () => {
    db.duplicado = [{ participante_id: 7 }];
    const res = await inscribir({ visita_id: 20 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(DUPLICADO);
    expect(hizoInsert()).toBe(false);
    const busqueda = log.find(([, sql]) => sql.startsWith('SELECT participante_id FROM participantes_torneo'));
    expect(busqueda[2]).toEqual([4, null, 20]);
  });

  it('carrera: el índice único (torneo_id, visita_id) responde 23505 → 409, nunca 500', async () => {
    db.falla = { sql: 'INSERT INTO participantes_torneo', code: '23505' };
    const res = await inscribir({ visita_id: 20 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(DUPLICADO);
  });

  it.each(['x', -1, 0, 1.5])('visita_id %j → 400 sin tocar la BD', async (id) => {
    const res = await inscribir({ visita_id: id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'visita_id debe ser un entero valido' });
    expect(log).toEqual([]);
  });
});

describe('GET /api/torneos/visitas-vigentes', () => {
  const buscar = (query) => request(app).get('/api/torneos/visitas-vigentes').query(query);

  it.each(['admin', 'gerente', 'coordinador'])('%s → 200 con las visitas de hoy que coinciden', async (rol) => {
    mockUser.rol = rol;
    const res = await buscar({ q: '  Lau ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.busqueda);
    const [, sql, params] = log[0];
    expect(sql).toContain('WHERE v.vigente = TRUE AND v.fecha_visita = $1::date AND v.nombre_completo ILIKE $2');
    expect(sql).toContain('LIMIT 20');
    expect(params).toEqual([HOY, '%Lau%']);
  });

  it.each(['socio', 'recepcion', 'instructor'])('%s → 403 sin tocar la BD', async (rol) => {
    mockUser.rol = rol;
    const res = await buscar({ q: 'Laura' });
    expect(res.status).toBe(403);
    expect(log).toEqual([]);
  });

  it('% y _ del texto se buscan literalmente', async () => {
    await buscar({ q: '50%_a\\b' });
    expect(log[0][2][1]).toBe('%50\\%\\_a\\\\b%');
  });

  it.each([
    ['sin q', {}],
    ['q de 1 carácter', { q: 'a' }],
    ['q solo espacios', { q: '    ' }]
  ])('%s → 400 sin tocar la BD', async (_, query) => {
    const res = await buscar(query);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'q debe tener al menos 2 caracteres' });
    expect(log).toEqual([]);
  });

  it('q de más de 150 caracteres → 400', async () => {
    const res = await buscar({ q: 'a'.repeat(151) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Máximo 150 caracteres' });
  });

  it('q repetido (arreglo) → 400', async () => {
    const res = await request(app).get('/api/torneos/visitas-vigentes?q=ab&q=cd');
    expect(res.status).toBe(400);
  });

  it('error de BD → 500 con mensaje propio', async () => {
    db.falla = { sql: 'SELECT v.visita_id', code: 'XX000' };
    const res = await buscar({ q: 'Laura' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al buscar visitas' });
  });
});
