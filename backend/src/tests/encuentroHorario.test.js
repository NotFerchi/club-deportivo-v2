'use strict';

/** E2.7: PATCH /api/encuentros/:encuentro_id/horario (fechas del torneo, choques y encuentros con resultado). */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../middleware/verifyToken', () => (req, res, next) => {
  req.user = { usuario_id: 1, rol: 'admin' };
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
  if (q.startsWith('SELECT pg_advisory_xact_lock')) return rows([{}]);
  if (q.startsWith('SELECT t.estado, to_char(t.fecha_inicio')) return rows(db.torneo);
  if (q.startsWith('SELECT encuentro_id, estado, ganador_id')) return rows(db.enc);
  if (q.startsWith('SELECT e.encuentro_id FROM encuentros_torneo e')) return rows(db.choque);
  if (q.startsWith('UPDATE encuentros_torneo SET hora_programada'))
    return rows([{ encuentro_id: params[1], hora_programada: params[0] }]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  db = {
    torneo: [{ estado: 'En_curso', fecha_inicio: '2026-11-07', fecha_fin: '2026-11-15' }],
    enc: [{ encuentro_id: 131, estado: 'programado', ganador_id: null, participante_1_id: 11, participante_2_id: 12 }],
    choque: [],
    falla: null
  };
  ({ log } = recordQueries(pool, route));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const horario = (body, id = 131) => request(app).patch(`/api/encuentros/${id}/horario`).send(body);
const sqls = () => log.map(([, sql]) => sql);

describe('PATCH /api/encuentros/:id/horario', () => {
  it('programa dentro de las fechas y sin choques → 200 con texto local', async () => {
    const res = await horario({ hora_programada: '2026-11-08T10:30' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      message: 'Horario asignado correctamente',
      encuentro: { encuentro_id: 131, hora_programada: '2026-11-08T10:30' }
    });
    expect(sqls()[1]).toBe("SELECT pg_advisory_xact_lock(hashtext('encuentros_torneo.hora_programada'))");
    const choque = log.find(([, sql]) => sql.startsWith('SELECT e.encuentro_id FROM encuentros_torneo e'));
    expect(choque[2]).toEqual([131, [11, 12], '2026-11-08T10:30']);
    expect(choque[1]).toContain('yo.socio_id = otro.socio_id OR yo.visita_id = otro.visita_id');
    expect(sqls().at(-1)).toBe('COMMIT');
  });

  it('los extremos del torneo son inclusivos', async () => {
    expect((await horario({ hora_programada: '2026-11-07T08:00' })).status).toBe(200);
    expect((await horario({ hora_programada: '2026-11-15T21:00' })).status).toBe(200);
  });

  it('null quita la hora sin buscar choques', async () => {
    const res = await horario({ hora_programada: null });
    expect(res.status).toBe(200);
    expect(sqls()).not.toContainEqual(expect.stringContaining('SELECT e.encuentro_id'));
  });

  it('fuera de las fechas del torneo → 400', async () => {
    const res = await horario({ hora_programada: '2026-11-16T10:00' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: 'La fecha debe estar entre el inicio y el fin del torneo (2026-11-07 a 2026-11-15)'
    });
    expect(sqls()).toContain('ROLLBACK');
  });

  it('torneo con solo una de las fechas → compara contra esa', async () => {
    db.torneo = [{ estado: 'En_curso', fecha_inicio: '2026-11-07', fecha_fin: null }];
    let res = await horario({ hora_programada: '2026-11-06T10:00' });
    expect(res.body.error).toBe('La fecha no puede ser anterior al inicio del torneo (2026-11-07)');
    expect((await horario({ hora_programada: '2027-01-01T10:00' })).status).toBe(200);
    db.torneo = [{ estado: 'En_curso', fecha_inicio: null, fecha_fin: '2026-11-15' }];
    res = await horario({ hora_programada: '2026-11-16T10:00' });
    expect(res.body.error).toBe('La fecha no puede ser posterior al fin del torneo (2026-11-15)');
  });

  it('torneo sin fechas → cualquier día', async () => {
    db.torneo = [{ estado: 'Inscripciones_cerradas', fecha_inicio: null, fecha_fin: null }];
    expect((await horario({ hora_programada: '2030-01-01T09:00' })).status).toBe(200);
  });

  it('un participante ya tiene otro encuentro a esa hora → 409 sin UPDATE', async () => {
    db.choque = [{ encuentro_id: 140 }];
    const res = await horario({ hora_programada: '2026-11-08T10:30' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'Un participante ya tiene otro encuentro a esa hora (encuentro 140)' });
    expect(sqls()).not.toContainEqual(expect.stringContaining('UPDATE encuentros_torneo'));
  });

  it('encuentro sin participantes todavía → no busca choques', async () => {
    db.enc[0] = { ...db.enc[0], participante_1_id: null, participante_2_id: null, estado: 'pendiente' };
    expect((await horario({ hora_programada: '2026-11-10T10:00' })).status).toBe(200);
    expect(sqls()).not.toContainEqual(expect.stringContaining('SELECT e.encuentro_id'));
  });

  it.each([
    [{ estado: 'finalizado', ganador_id: 11 }],
    [{ estado: 'programado', ganador_id: 11 }]
  ])('encuentro con resultado %j → 409 (tampoco se quita la hora)', async (cambio) => {
    db.enc[0] = { ...db.enc[0], ...cambio };
    for (const hora_programada of ['2026-11-08T10:30', null]) {
      const res = await horario({ hora_programada });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ ok: false, error: 'No se puede reprogramar un encuentro que ya tiene resultado' });
    }
  });

  it('torneo Abierto → 409; encuentro inexistente o torneo eliminado → 404', async () => {
    db.torneo = [{ estado: 'Abierto', fecha_inicio: null, fecha_fin: null }];
    let res = await horario({ hora_programada: '2026-11-08T10:30' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(
      'Solo se puede programar el horario con las inscripciones cerradas o el torneo en curso (estado actual: Abierto)'
    );
    db.torneo = [];
    res = await horario({ hora_programada: '2026-11-08T10:30' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Encuentro no encontrado' });
  });

  it.each([
    [{}, 'hora_programada es requerida'],
    [{ hora_programada: '2026-11-08 10:30' }, 'hora_programada debe tener el formato YYYY-MM-DDTHH:mm'],
    [{ hora_programada: '2026-11-08T10:30Z' }, 'hora_programada debe tener el formato YYYY-MM-DDTHH:mm'],
    [{ hora_programada: '2026-02-30T10:30' }, 'hora_programada debe tener el formato YYYY-MM-DDTHH:mm'],
    [{ hora_programada: '2026-11-08T24:00' }, 'hora_programada debe tener el formato YYYY-MM-DDTHH:mm'],
    [{ hora_programada: 5 }, 'hora_programada debe tener el formato YYYY-MM-DDTHH:mm']
  ])('body %j → 400 sin tocar la BD', async (body, error) => {
    const res = await horario(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error });
    expect(log).toEqual([]);
  });

  it('id inválido → 400; error de BD → 500', async () => {
    let res = await horario({ hora_programada: null }, 'x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'encuentro_id inválido' });
    db.falla = 'UPDATE encuentros_torneo';
    res = await horario({ hora_programada: null });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});
