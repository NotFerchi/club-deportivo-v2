'use strict';

/** E2.8: asignar instructor árbitro y que solo el árbitro asignado (o el staff) registre el resultado. */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
let mockUser;
jest.mock('../middleware/verifyToken', () => (req, res, next) => {
  req.user = mockUser;
  next();
});
jest.mock('../middleware/checkRole', () => () => (req, res, next) => next());

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/encuentros', require('../routes/encuentros.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let log;

function route(q, params) {
  if (db.falla && q.startsWith(db.falla)) throw new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT t.estado FROM encuentros_torneo e JOIN torneos t')) return rows(db.torneo);
  if (q.startsWith('SELECT estado, ganador_id FROM encuentros_torneo')) return rows(db.encArbitro);
  if (q.startsWith('SELECT i.instructor_id FROM instructores i')) return rows(db.instructorActivo);
  if (q.startsWith('UPDATE encuentros_torneo SET arbitro_id'))
    return rows([{ encuentro_id: params[1], arbitro_id: params[0] }]);
  // registrar resultado
  if (q.startsWith('SELECT encuentro_id, torneo_id, ronda, estado')) return rows(db.enc);
  if (q.startsWith('SELECT instructor_id FROM instructores WHERE usuario_id')) return rows(db.miInstructor);
  if (q.startsWith('SELECT COUNT(*) FILTER (WHERE encuentro_id < $3)')) return rows([{ posicion: 0, total: 1 }]);
  if (q.startsWith('UPDATE encuentros_torneo SET marcador_1'))
    return rows([{ encuentro_id: params[3], marcador_1: params[0], marcador_2: params[1], ganador_id: params[2] }]);
  if (q.startsWith('SELECT COUNT(*) as total')) return rows([{ total: '0' }]);
  if (q.startsWith('UPDATE encuentros_torneo SET estado')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 1, rol: 'coordinador' };
  db = {
    torneo: [{ estado: 'En_curso' }],
    encArbitro: [{ estado: 'programado', ganador_id: null }],
    instructorActivo: [{ instructor_id: 5 }],
    enc: [
      {
        encuentro_id: 100,
        torneo_id: 4,
        ronda: 1,
        estado: 'programado',
        participante_1_id: 11,
        participante_2_id: 12,
        ganador_id: null,
        arbitro_id: 5
      }
    ],
    miInstructor: [{ instructor_id: 5 }],
    falla: null
  };
  ({ log } = recordQueries(pool, route));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const sqls = () => log.map(([, sql]) => sql);

describe('PATCH /api/encuentros/:id/arbitro', () => {
  const arbitro = (body, id = 100) => request(app).patch(`/api/encuentros/${id}/arbitro`).send(body);

  it('asigna un instructor activo → 200', async () => {
    const res = await arbitro({ instructor_id: 5 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      message: 'Árbitro asignado correctamente',
      encuentro: { encuentro_id: 100, arbitro_id: 5 }
    });
    const busca = log.find(([, sql]) => sql.startsWith('SELECT i.instructor_id FROM instructores i'));
    expect(busca[1]).toContain('i.activo IS NOT FALSE AND u.activo IS NOT FALSE');
    expect(busca[2]).toEqual([5]);
  });

  it('null quita el árbitro sin buscar instructor', async () => {
    const res = await arbitro({ instructor_id: null });
    expect(res.status).toBe(200);
    expect(res.body.encuentro).toEqual({ encuentro_id: 100, arbitro_id: null });
    expect(sqls()).not.toContainEqual(expect.stringContaining('FROM instructores'));
  });

  it('no es un instructor activo → 400 sin UPDATE', async () => {
    db.instructorActivo = [];
    const res = await arbitro({ instructor_id: 77 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'instructor_id no corresponde a un instructor activo' });
    expect(sqls()).not.toContainEqual(expect.stringContaining('UPDATE encuentros_torneo'));
  });

  it('encuentro con resultado → 409', async () => {
    db.encArbitro = [{ estado: 'finalizado', ganador_id: 11 }];
    const res = await arbitro({ instructor_id: 5 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'No se puede cambiar el árbitro de un encuentro que ya tiene resultado' });
  });

  it('torneo Abierto → 409; encuentro inexistente → 404', async () => {
    db.torneo = [{ estado: 'Abierto' }];
    let res = await arbitro({ instructor_id: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Solo se puede asignar árbitro con las inscripciones cerradas o el torneo en curso (estado actual: Abierto)'
    );
    db.torneo = [];
    res = await arbitro({ instructor_id: 5 });
    expect(res.status).toBe(404);
  });

  it.each([
    [{}, 'instructor_id es requerido'],
    [{ instructor_id: 'abc' }, 'instructor_id debe ser un entero valido'],
    [{ instructor_id: 0 }, 'instructor_id debe ser un entero valido']
  ])('body %j → 400 sin tocar la BD', async (body, error) => {
    const res = await arbitro(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error });
    expect(log).toEqual([]);
  });
});

describe('PATCH /api/encuentros/:id/resultado con árbitro (E2.8)', () => {
  const resultado = () => request(app).patch('/api/encuentros/100/resultado').send({ marcador_1: 3, marcador_2: 1 });

  it('el instructor árbitro asignado registra → 200', async () => {
    mockUser = { usuario_id: 30, rol: 'instructor' };
    const res = await resultado();
    expect(res.status).toBe(200);
    const yo = log.find(([, sql]) => sql.startsWith('SELECT instructor_id FROM instructores WHERE usuario_id'));
    expect(yo[2]).toEqual([30]);
  });

  it('otro instructor → 403 sin escribir', async () => {
    mockUser = { usuario_id: 31, rol: 'instructor' };
    db.miInstructor = [{ instructor_id: 6 }];
    const res = await resultado();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      ok: false,
      error: 'Solo el árbitro asignado o el staff pueden registrar el resultado de este encuentro'
    });
    expect(sqls()).not.toContainEqual(expect.stringContaining('UPDATE encuentros_torneo'));
    expect(sqls()).toContain('ROLLBACK');
  });

  it('usuario instructor sin registro en instructores → 403', async () => {
    mockUser = { usuario_id: 32, rol: 'instructor' };
    db.miInstructor = [];
    expect((await resultado()).status).toBe(403);
  });

  it.each(['admin', 'gerente', 'coordinador'])('el staff (%s) registra aunque no sea el árbitro', async (rol) => {
    mockUser = { usuario_id: 1, rol };
    const res = await resultado();
    expect(res.status).toBe(200);
    expect(sqls()).not.toContainEqual(expect.stringContaining('FROM instructores'));
  });

  it('sin árbitro asignado cualquier instructor registra, como antes', async () => {
    mockUser = { usuario_id: 31, rol: 'instructor' };
    db.enc[0].arbitro_id = null;
    const res = await resultado();
    expect(res.status).toBe(200);
    expect(sqls()).not.toContainEqual(expect.stringContaining('FROM instructores'));
  });
});
