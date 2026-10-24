'use strict';

/** E2.12: campo calculado admite_inscripcion en GET /api/torneos (estado, categoría, periodo y cupo). */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 7, rol: 'socio' };
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
app.use('/api/torneos', require('../routes/torneos.routes'));

let torneos;

beforeEach(() => {
  // 21:00 del 2026-10-18 en México (ya 19 en UTC): "hoy" es el 18
  jest.useFakeTimers({ now: new Date('2026-10-19T03:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
  recordQueries(pool, () => ({ rows: torneos, rowCount: torneos.length }));
});

afterEach(() => jest.useRealTimers());

const base = {
  torneo_id: 45,
  estado: 'Abierto',
  categoria_id: 1,
  total_participantes: 6,
  cupo_maximo: 16,
  periodo_fecha_inicio: '2026-11-07',
  periodo_inicio_inscripcion: null,
  periodo_fin_inscripcion: null
};

async function admite(cambios) {
  torneos = [{ ...base, ...cambios }];
  const res = await request(app).get('/api/torneos');
  expect(res.status).toBe(200);
  return res.body[0];
}

describe('admite_inscripcion', () => {
  it('Abierto, con categoría, en periodo y con cupo → true; no expone las columnas auxiliares', async () => {
    const torneo = await admite({});
    expect(torneo.admite_inscripcion).toBe(true);
    expect(torneo.cupo_maximo).toBe(16);
    expect(torneo).not.toHaveProperty('periodo_fecha_inicio');
    expect(torneo).not.toHaveProperty('periodo_inicio_inscripcion');
    expect(torneo).not.toHaveProperty('periodo_fin_inscripcion');
  });

  it.each(['Inscripciones_cerradas', 'En_curso', 'Finalizado', 'Cancelado'])('estado %s → false', async (estado) => {
    expect((await admite({ estado })).admite_inscripcion).toBe(false);
  });

  it('sin categoría → false', async () => {
    expect((await admite({ categoria_id: null })).admite_inscripcion).toBe(false);
  });

  it('cupo: lleno → false; un lugar libre → true; sin límite → true', async () => {
    expect((await admite({ total_participantes: 16 })).admite_inscripcion).toBe(false);
    expect((await admite({ total_participantes: 15 })).admite_inscripcion).toBe(true);
    expect((await admite({ cupo_maximo: null, total_participantes: 300 })).admite_inscripcion).toBe(true);
  });

  it('periodo (F-07): usa la fecha del club, no la de UTC', async () => {
    // el torneo empieza hoy (18): ya no se inscribe nadie
    expect((await admite({ periodo_fecha_inicio: '2026-10-18' })).admite_inscripcion).toBe(false);
    // empieza mañana: hoy es el último día
    expect((await admite({ periodo_fecha_inicio: '2026-10-19' })).admite_inscripcion).toBe(true);
    // la inscripción abre mañana
    expect((await admite({ periodo_inicio_inscripcion: '2026-10-19' })).admite_inscripcion).toBe(false);
    // cerró ayer / cierra hoy (inclusivo)
    expect((await admite({ periodo_fin_inscripcion: '2026-10-17' })).admite_inscripcion).toBe(false);
    expect((await admite({ periodo_fin_inscripcion: '2026-10-18' })).admite_inscripcion).toBe(true);
    // sin ninguna fecha
    expect((await admite({ periodo_fecha_inicio: null })).admite_inscripcion).toBe(true);
  });
});
