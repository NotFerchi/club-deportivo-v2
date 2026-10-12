'use strict';

/**
 * Regla única de posición del bracket (B-16, B-05, B-26), de punta a punta:
 * cerrar inscripciones → confirmar bracket → registrar/editar resultados, con las rutas
 * reales sobre un bracket en memoria (helpers/bracketEnMemoria).
 *
 * Regla: la posición de un encuentro es su orden por encuentro_id dentro de la ronda, y el
 * ganador de la posición i va a la posición ⌊i/2⌋ de la ronda siguiente, como participante_1_id
 * si i es par y como participante_2_id si es impar (lo mismo que dibuja BracketVisual).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));

jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 7, rol: 'admin' };
    next();
  },
  checkRole: () => (req, res, next) => next()
}));
jest.mock('../middleware/checkRole', () => () => (req, res, next) => next());

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');
const { crearBracketEnMemoria } = require('./helpers/bracketEnMemoria');
const { destinoDelGanador } = require('../services/bracketPosicion');

const app = express();
app.use(express.json());
app.use('/api/torneos', require('../routes/torneos.routes'));
app.use('/api/encuentros', require('../routes/encuentros.routes'));
app.use(require('../middleware/errorHandler'));

const MSG_SIGUIENTE_JUGADO =
  'No se puede editar: el siguiente partido ya tiene resultado. Corrige primero ese partido.';
const MSG_INCONSISTENTE = 'El bracket de este torneo tiene datos inconsistentes';

let bd;
let consoleSpies;

beforeEach(() => {
  jest.spyOn(Math, 'random').mockReturnValue(0.5); // barajado determinista
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => {
  consoleSpies.forEach((spy) => spy.mockRestore());
  jest.restoreAllMocks();
});

// ── Utilidades ───────────────────────────────────────────────────────────────

async function torneoConfirmado(n) {
  bd = crearBracketEnMemoria({ participantes: Array.from({ length: n }, (_, i) => 11 + i) });
  recordQueries(pool, bd.route);
  expect((await request(app).patch('/api/torneos/4/cerrar-inscripciones')).status).toBe(200);
  expect((await request(app).patch('/api/torneos/4/confirmar-bracket')).status).toBe(200);
}

/** Registra (o edita) un resultado: gana el participante 1 o el 2. */
function jugar(encuentro, gana = 1, extra = {}) {
  const marcador = gana === 1 ? { marcador_1: 2, marcador_2: 0 } : { marcador_1: 0, marcador_2: 2 };
  return request(app)
    .patch(`/api/encuentros/${encuentro.encuentro_id}/resultado`)
    .send({ ...marcador, ...extra });
}

const esBye = (e) => e.estado === 'finalizado' && (e.participante_1_id === null) !== (e.participante_2_id === null);
const cruces = (r) => bd.ronda(r).map((e) => [e.participante_1_id, e.participante_2_id]);

/** Cruces que marca la regla para la ronda r+1 a partir de los ganadores de la ronda r. */
function crucesSegunRegla(r) {
  const anterior = bd.ronda(r);
  return Array.from({ length: anterior.length / 2 }, (_, j) => [
    anterior[2 * j].ganador_id,
    anterior[2 * j + 1].ganador_id
  ]);
}

// ── Función pura ─────────────────────────────────────────────────────────────

describe('destinoDelGanador', () => {
  it.each([
    [0, 0, 'participante_1_id'],
    [1, 0, 'participante_2_id'],
    [2, 1, 'participante_1_id'],
    [3, 1, 'participante_2_id'],
    [6, 3, 'participante_1_id'],
    [7, 3, 'participante_2_id']
  ])('posición %i → posición %i de la ronda siguiente, %s', (posicion, destino, campo) => {
    expect(destinoDelGanador(posicion)).toEqual({ posicion: destino, campo });
  });
});

// ── B-16: los cruces no dependen del orden de captura ────────────────────────

describe('regla de posición (B-16)', () => {
  /** Juega la ronda 1 en el orden dado (índices de los partidos reales) y devuelve los cruces de la ronda 2. */
  async function ronda2Capturando(n, orden) {
    await torneoConfirmado(n);
    const reales = bd.ronda(1).filter((e) => !esBye(e));
    for (const i of orden) {
      // Alterna el ganador para usar ambos lados del cruce
      expect((await jugar(reales[i], i % 2 === 0 ? 1 : 2)).status).toBe(200);
    }
    return { ronda2: cruces(2), regla: crucesSegunRegla(1) };
  }

  it.each([
    [4, [0, 1], [1, 0]],
    [5, [0], [0]],
    [6, [0, 1], [1, 0]],
    [8, [0, 1, 2, 3], [3, 0, 2, 1]] // orden 1,2,3,4 frente a 4,1,3,2
  ])('%i participantes: capturar en %j o en %j da los mismos cruces, y son los de ⌊i/2⌋', async (n, ordenA, ordenB) => {
    const a = await ronda2Capturando(n, ordenA);
    const b = await ronda2Capturando(n, ordenB);
    expect(a.ronda2).toEqual(b.ronda2);
    expect(a.ronda2).toEqual(a.regla);
    expect(b.ronda2).toEqual(b.regla);
  });

  it('8 participantes: también la final sale de ⌊i/2⌋ con cualquier orden de semifinales', async () => {
    await torneoConfirmado(8);
    for (const i of [3, 0, 2, 1]) await jugar(bd.ronda(1)[i]);
    const [semi0, semi1] = bd.ronda(2);
    expect((await jugar(semi1, 2)).status).toBe(200);
    expect((await jugar(semi0, 1)).status).toBe(200);
    expect(cruces(3)).toEqual([[semi0.participante_1_id, semi1.participante_2_id]]);
  });

  it('5 participantes: cada bye queda en su slot y el único partido real va a la posición 0 de la ronda 2', async () => {
    await torneoConfirmado(5);
    const r1 = bd.ronda(1);
    expect(r1.map(esBye)).toEqual([false, true, true, true]); // cruce real primero, después los byes

    // Antes de jugar: byes en las posiciones 1, 2 y 3 → R2[0].p2, R2[1].p1 y R2[1].p2
    expect(cruces(2)).toEqual([
      [null, r1[1].ganador_id],
      [r1[2].ganador_id, r1[3].ganador_id]
    ]);
    expect(bd.ronda(2).map((e) => e.estado)).toEqual(['pendiente', 'pendiente']);

    expect((await jugar(r1[0], 2)).status).toBe(200);
    expect(cruces(2)).toEqual([
      [r1[0].participante_2_id, r1[1].ganador_id],
      [r1[2].ganador_id, r1[3].ganador_id]
    ]);
    expect(bd.ronda(2).map((e) => e.estado)).toEqual(['programado', 'programado']);
  });
});

// ── B-05: editar un resultado ────────────────────────────────────────────────

describe('edición de resultados (B-05)', () => {
  /** Torneo de 4 con la ronda 1 y la final jugadas (gana siempre el participante 1). */
  async function finalJugada() {
    await torneoConfirmado(4);
    const [m0, m1] = bd.ronda(1);
    await jugar(m0, 1);
    await jugar(m1, 1);
    await jugar(bd.ronda(2)[0], 1);
    return { m0, final: { ...bd.ronda(2)[0] } };
  }

  it('ronda 1 con la final ya jugada y OTRO ganador → 409 y no cambia nada', async () => {
    const { m0 } = await finalJugada();
    const antes = { r2: cruces(2), m0: { ...bd.encuentro(m0.encuentro_id) } };

    const res = await jugar(m0, 2, { allowEdit: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: MSG_SIGUIENTE_JUGADO });
    expect(cruces(2)).toEqual(antes.r2);
    expect(bd.encuentro(m0.encuentro_id)).toEqual(antes.m0);
  });

  it('ronda 1 con la final ya jugada y el MISMO ganador (3-1 → 4-1) → 200: cambia el marcador, el bracket no', async () => {
    const { m0, final } = await finalJugada();
    const antes = { r1: cruces(1), r2: cruces(2), ganador: bd.encuentro(m0.encuentro_id).ganador_id };

    const res = await request(app)
      .patch(`/api/encuentros/${m0.encuentro_id}/resultado`)
      .send({ marcador_1: 4, marcador_2: 1, allowEdit: true });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Resultado actualizado correctamente');
    expect(bd.encuentro(m0.encuentro_id)).toMatchObject({ marcador_1: 4, marcador_2: 1, ganador_id: antes.ganador });
    expect(cruces(1)).toEqual(antes.r1);
    expect(cruces(2)).toEqual(antes.r2);
    expect(bd.encuentro(final.encuentro_id)).toEqual(final);
  });

  it.each([
    [0, 'participante_1_id'],
    [1, 'participante_2_id']
  ])(
    'ronda 1 (posición %i) con la siguiente sin jugar → 200 y el nuevo ganador queda en el mismo slot (%s)',
    async (posicion, campo) => {
      await torneoConfirmado(4);
      const r1 = bd.ronda(1);
      await jugar(r1[0], 1);
      await jugar(r1[1], 1);
      const final = bd.ronda(2)[0];
      expect(final[campo]).toBe(r1[posicion].participante_1_id);

      const res = await jugar(r1[posicion], 2, { allowEdit: true });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Resultado actualizado correctamente');
      const otro = campo === 'participante_1_id' ? 'participante_2_id' : 'participante_1_id';
      expect(bd.encuentro(final.encuentro_id)[campo]).toBe(r1[posicion].participante_2_id);
      expect(bd.encuentro(final.encuentro_id)[otro]).toBe(final[otro]);
    }
  );
});

// ── Datos heredados ──────────────────────────────────────────────────────────

describe('bracket con datos heredados', () => {
  it('slot destino ocupado por otro participante → 409 y no se escribe nada', async () => {
    await torneoConfirmado(4);
    const [m0] = bd.ronda(1);
    bd.ronda(2)[0].participante_1_id = 99; // como lo dejaba la regla vieja del primer hueco libre

    const res = await jugar(m0, 1);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: MSG_INCONSISTENTE });
    expect(bd.encuentro(m0.encuentro_id).estado).toBe('programado');
    expect(bd.ronda(2)[0].participante_1_id).toBe(99);
  });
});

// ── B-26: byes ───────────────────────────────────────────────────────────────

describe('resultado sobre un bye (B-26)', () => {
  it.each([
    [{}, 'No se puede editar un encuentro ya finalizado'],
    [{ allowEdit: true }, 'El encuentro aún no tiene ambos participantes asignados']
  ])('con %j → 409 y el pase directo no cambia', async (extra, error) => {
    await torneoConfirmado(5);
    const bye = bd.ronda(1).find(esBye);
    const antes = { ...bye };
    const res = await jugar(bye, 1, extra);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error });
    expect(bd.encuentro(bye.encuentro_id)).toEqual(antes);
  });
});
