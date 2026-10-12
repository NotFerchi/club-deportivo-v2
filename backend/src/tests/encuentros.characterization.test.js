'use strict';

/**
 * Tests de caracterización de /api/encuentros (encuentrosController).
 * Además de status + cuerpo, cada test compara con un snapshot la secuencia
 * exacta de consultas y parámetros (avance de ganadores entre rondas).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));

let mockUser;
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = mockUser;
    next();
  },
  checkRole: () => (req, res, next) => next()
}));
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
const ERROR_HANDLER = { ok: false, error: 'Error interno del servidor' };
const ERROR_500 = { ok: false, error: 'Error interno del servidor' };

let db;
let log;
let client;
let consoleSpies;

function route(q, params) {
  if (db.falla && q.startsWith(db.falla)) throw new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT t.estado FROM encuentros_torneo e JOIN torneos t')) return rows(db.torneo);
  if (q.startsWith('SELECT encuentro_id, torneo_id, ronda, estado')) return rows(db.enc);
  if (q.startsWith('UPDATE encuentros_torneo SET marcador_1')) {
    const [m1, m2, ganador, id, cancha] = params;
    return rows([
      {
        encuentro_id: id,
        ronda: db.enc[0].ronda,
        marcador_1: m1,
        marcador_2: m2,
        ganador_id: ganador,
        estado: 'finalizado',
        cancha_asignada: cancha
      }
    ]);
  }
  if (q.startsWith('SELECT COUNT(*) FILTER (WHERE encuentro_id < $3)')) return rows(db.posicion);
  if (q.startsWith('SELECT encuentro_id, ronda, estado, participante_1_id, participante_2_id FROM encuentros_torneo'))
    return rows(db.destino);
  if (q.startsWith('UPDATE encuentros_torneo SET participante_1_id = $1, participante_2_id = $2')) {
    const [p1, p2, id] = params;
    return rows([
      { encuentro_id: id, torneo_id: 4, participante_1_id: p1, participante_2_id: p2, estado: 'pendiente' }
    ]);
  }
  if (q.startsWith('UPDATE encuentros_torneo SET participante_')) {
    const [ganador, id] = params;
    return rows([{ encuentro_id: id, ronda: 2, campo: q.split(' ')[3], ganador }]);
  }
  if (q.startsWith('SELECT COUNT(*) as total')) return rows(db.pendRonda);
  if (q.startsWith('UPDATE encuentros_torneo SET estado')) return rows([]);
  if (q.startsWith('UPDATE encuentros_torneo SET cancha_asignada')) return rows(db.cancha);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 7, rol: 'instructor' };
  db = {
    falla: null,
    torneo: [{ estado: 'En_curso' }],
    enc: [
      {
        encuentro_id: 100,
        torneo_id: 4,
        ronda: 1,
        estado: 'programado',
        participante_1_id: 11,
        participante_2_id: 12,
        ganador_id: null
      }
    ],
    // Posición del encuentro en su ronda y encuentro destino del ganador (regla ⌊i/2⌋, B-16)
    posicion: [{ posicion: 0, total: 2 }],
    destino: [{ encuentro_id: 201, ronda: 2, estado: 'pendiente', participante_1_id: null, participante_2_id: null }],
    pendRonda: [{ total: '0' }],
    cancha: [{ encuentro_id: 100, cancha_asignada: 'C2' }]
  };
  ({ log, client } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// Primer argumento del último console.error: distingue errorHandler ('ERROR') del catch del endpoint.
const ultimoError = () => consoleSpies[1].mock.calls.at(-1)?.[0];

// ── PATCH /:id/resultado ─────────────────────────────────────────────────────

describe('PATCH /api/encuentros/:id/resultado', () => {
  const resultado = (body, id = '100') => request(app).patch(`/api/encuentros/${id}/resultado`).send(body);

  it('registro nuevo: posición 0 → participante_1_id del destino ⌊0/2⌋ y activa la siguiente ronda (B-16)', async () => {
    const res = await resultado({ marcador_1: 3, marcador_2: '1', cancha_asignada: ' C1 ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(log).toMatchSnapshot();
  });

  it('registro nuevo: posición 1 → participante_2_id aunque el p1 del destino esté vacío; ronda con pendientes; cancha vacía → null (B-16)', async () => {
    db.posicion = [{ posicion: 1, total: 2 }];
    db.pendRonda = [{ total: '2' }];
    const res = await resultado({ marcador_1: 0, marcador_2: 2, cancha_asignada: '   ' });
    expect(res.status).toBe(200);
    expect(res.body.siguiente_encuentro).toEqual({
      encuentro_id: 201,
      ronda: 2,
      campo: 'participante_2_id',
      ganador: 12
    });
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('registro nuevo en la final (única de su ronda) → sin destino', async () => {
    db.posicion = [{ posicion: 0, total: 1 }];
    const res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(200);
    expect(res.body.siguiente_encuentro).toBeNull();
    expect(log).toMatchSnapshot();
  });

  it('edición con cambio de ganador → reemplaza al ganador anterior en el slot de la regla (B-05)', async () => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    db.destino = [{ ...db.destino[0], participante_1_id: 11, participante_2_id: 13 }];
    const res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(200);
    expect(res.body.siguiente_encuentro).toEqual({
      encuentro_id: 201,
      ronda: 2,
      campo: 'participante_1_id',
      ganador: 12
    });
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('edición con el mismo ganador → no toca el destino; allowEdit en pendiente → 409 (B-11)', async () => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    db.destino = [{ ...db.destino[0], participante_1_id: 11 }];
    let res = await resultado({ marcador_1: 5, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Resultado actualizado correctamente');
    expect(res.body.siguiente_encuentro).toEqual({
      encuentro_id: 201,
      ronda: 2,
      participante_1_id: 11,
      participante_2_id: null
    });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE encuentros_torneo SET participante_'))).toBe(false);

    db.enc[0] = { ...db.enc[0], estado: 'pendiente', ganador_id: null };
    res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'Solo se puede editar el resultado de un encuentro finalizado' });
    expect(log).toMatchSnapshot();
  });

  it('edición que cambia el ganador con el siguiente partido ya jugado → 409 sin escribir, sin cascada (B-05)', async () => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    db.destino = [{ ...db.destino[0], estado: 'finalizado', participante_1_id: 11, participante_2_id: 13 }];
    const res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      ok: false,
      error: 'No se puede editar: el siguiente partido ya tiene resultado. Corrige primero ese partido.'
    });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
    expect(log.at(-1)[1]).toBe('ROLLBACK');
  });

  it('edición con el mismo ganador y el siguiente partido ya jugado → 200: cambia el marcador, no el destino (B-05)', async () => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    db.destino = [{ ...db.destino[0], estado: 'finalizado', participante_1_id: 11, participante_2_id: 13 }];
    const res = await resultado({ marcador_1: 4, marcador_2: 1, allowEdit: true });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Resultado actualizado correctamente');
    expect(res.body.encuentro).toMatchObject({ marcador_1: 4, marcador_2: 1, ganador_id: 11 });
    // Se actualiza el marcador del encuentro; el slot del destino no se escribe
    expect(log.some(([, sql]) => sql.startsWith('UPDATE encuentros_torneo SET marcador_1'))).toBe(true);
    expect(log.some(([, sql]) => sql.startsWith('UPDATE encuentros_torneo SET participante_'))).toBe(false);
    expect(log.at(-1)[1]).toBe('COMMIT');
  });

  it('slot destino ocupado por otro participante (bracket heredado) → 409 sin escribir', async () => {
    db.destino = [{ ...db.destino[0], participante_1_id: 99 }];
    let res = await resultado({ marcador_1: 3, marcador_2: 1 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'El bracket de este torneo tiene datos inconsistentes' });

    // Al editar, el slot debe tener al ganador anterior (o al nuevo, o estar vacío)
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'El bracket de este torneo tiene datos inconsistentes' });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it.each([
    [{}, 'No se puede editar un encuentro ya finalizado'],
    [{ allowEdit: true }, 'El encuentro aún no tiene ambos participantes asignados']
  ])('bye (un solo participante, finalizado) con %j → 409 sin escribir (B-26)', async (extra, error) => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', participante_2_id: null, ganador_id: 11 };
    const res = await resultado({ marcador_1: 1, marcador_2: 0, ...extra });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it.each(['pendiente', 'programado'])('allowEdit en un encuentro %s → 409 sin UPDATE (B-11)', async (estado) => {
    db.enc[0] = { ...db.enc[0], estado, ganador_id: null };
    const res = await resultado({ marcador_1: 2, marcador_2: 0, allowEdit: true });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'Solo se puede editar el resultado de un encuentro finalizado' });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
    expect(log.at(-1)[1]).toBe('ROLLBACK');
  });

  it.each(['Abierto', 'Inscripciones_cerradas', 'Finalizado', 'Cancelado'])(
    'torneo %s → 409 al registrar y al editar, sin tocar el encuentro (B-12)',
    async (estado) => {
      db.torneo = [{ estado }];
      const error = `Solo se pueden registrar resultados con el torneo en curso (estado actual: ${estado})`;

      let res = await resultado({ marcador_1: 2, marcador_2: 1 });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ ok: false, error });

      db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
      res = await resultado({ marcador_1: 1, marcador_2: 2, allowEdit: true });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ ok: false, error });

      // El torneo se bloquea (FOR SHARE) antes de leer el encuentro, y no se escribe nada
      expect(log.map(([, sql]) => sql)).toEqual([
        'BEGIN',
        'SELECT t.estado FROM encuentros_torneo e JOIN torneos t ON t.torneo_id = e.torneo_id WHERE e.encuentro_id = $1 FOR SHARE OF t',
        'ROLLBACK',
        'BEGIN',
        'SELECT t.estado FROM encuentros_torneo e JOIN torneos t ON t.torneo_id = e.torneo_id WHERE e.encuentro_id = $1 FOR SHARE OF t',
        'ROLLBACK'
      ]);
    }
  );

  it.each([
    [undefined, 403],
    [{ rol: 'socio' }, 403]
  ])('usuario %j → 403 sin consultar', async (user, status) => {
    mockUser = user;
    const res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ ok: false, error: 'No tienes permisos para registrar resultados' });
    expect(log).toEqual([]);
  });

  it.each([
    ['0', { marcador_1: 1, marcador_2: 0 }, 'encuentro_id debe ser un entero válido'],
    ['1.5', { marcador_1: 1, marcador_2: 0 }, 'encuentro_id debe ser un entero válido'],
    ['100', { marcador_1: -1, marcador_2: 0 }, 'marcador_1 y marcador_2 deben ser enteros no negativos'],
    ['100', { marcador_1: 1 }, 'marcador_1 y marcador_2 deben ser enteros no negativos'],
    ['100', { marcador_1: 1.5, marcador_2: 0 }, 'marcador_1 y marcador_2 deben ser enteros no negativos'],
    [
      '100',
      { marcador_1: 2, marcador_2: '2' },
      'No se permiten empates. Corrige el marcador para determinar un ganador.'
    ],
    // B-09: ids fuera de 1..2147483647
    ...['abc', '-1', '99999999999'].map((id) => [
      id,
      { marcador_1: 1, marcador_2: 0 },
      'encuentro_id debe ser un entero válido'
    ]),
    // B-08: cancha junto con el resultado, ya con trim
    ['100', { marcador_1: 1, marcador_2: 0, cancha_asignada: 'c'.repeat(51) }, 'Máximo 50 caracteres'],
    // Marcadores entre 0 y 999 (antes, uno mayor que int4 daba 500)
    ['100', { marcador_1: 1000, marcador_2: 0 }, 'Los marcadores deben estar entre 0 y 999'],
    ['100', { marcador_1: 0, marcador_2: 1000 }, 'Los marcadores deben estar entre 0 y 999'],
    ['100', { marcador_1: 99999999999, marcador_2: 0 }, 'Los marcadores deben estar entre 0 y 999'],
    ['100', { marcador_1: 1, marcador_2: '99999999999' }, 'Los marcadores deben estar entre 0 y 999']
  ])('validación /%s %j → 400', async (id, body, error) => {
    const res = await resultado(body, id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('marcadores en el límite (999 y 0) → 200', async () => {
    const res = await resultado({ marcador_1: 999, marcador_2: 0 });
    expect(res.status).toBe(200);
    expect(res.body.encuentro).toMatchObject({ marcador_1: 999, marcador_2: 0 });
  });

  it('404 / finalizado / no programado / sin participantes → ROLLBACK', async () => {
    db.torneo = [];
    let res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Encuentro no encontrado' });

    db.torneo = [{ estado: 'En_curso' }];
    db.enc = [];
    res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Encuentro no encontrado' });

    db.enc = [
      { encuentro_id: 100, torneo_id: 4, ronda: 1, estado: 'finalizado', participante_1_id: 11, participante_2_id: 12 }
    ];
    res = await resultado({ marcador_1: 1, marcador_2: 0, allowEdit: 'true' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'No se puede editar un encuentro ya finalizado' });

    db.enc[0].estado = 'pendiente';
    res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      ok: false,
      error: 'El encuentro no está en estado programado (estado actual: pendiente)'
    });

    db.enc[0] = { ...db.enc[0], estado: 'programado', participante_2_id: null };
    res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ ok: false, error: 'El encuentro aún no tiene ambos participantes asignados' });
    expect(client.release).toHaveBeenCalledTimes(5);
    expect(log).toMatchSnapshot();
  });

  it('cancha de 50 caracteres (tras trim) junto con el resultado → 200', async () => {
    const res = await resultado({ marcador_1: 1, marcador_2: 0, cancha_asignada: ` ${'c'.repeat(50)} ` });
    expect(res.status).toBe(200);
  });

  it('sin body → 400 con el campo que falta (B-09)', async () => {
    const res = await request(app).patch('/api/encuentros/100/resultado');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'marcador_1 y marcador_2 deben ser enteros no negativos' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('error de BD → ROLLBACK + 500; conexión → errorHandler', async () => {
    db.falla = 'SELECT COUNT(*)';
    let res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_500);
    expect(ultimoError()).toBe('Error al registrar resultado:');
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── PATCH /:id/cancha ────────────────────────────────────────────────────────

describe('PATCH /api/encuentros/:id/cancha', () => {
  const cancha = (body, id = '100') => request(app).patch(`/api/encuentros/${id}/cancha`).send(body);

  it('asigna (recortada) y 404', async () => {
    let res = await cancha({ cancha_asignada: '  C2 ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Cancha asignada correctamente', encuentro: db.cancha[0] });

    res = await cancha({ cancha_asignada: 7 });
    expect(res.status).toBe(200);

    db.torneo = [];
    res = await cancha({ cancha_asignada: 'C2' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Encuentro no encontrado' });
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['Inscripciones_cerradas', 200],
    ['En_curso', 200],
    ['Abierto', 409],
    ['Finalizado', 409],
    ['Cancelado', 409]
  ])('torneo %s → %i (B-12)', async (estado, status) => {
    db.torneo = [{ estado }];
    const res = await cancha({ cancha_asignada: 'C2' });
    expect(res.status).toBe(status);
    if (status === 409) {
      expect(res.body).toEqual({
        ok: false,
        error: `Solo se puede asignar cancha con las inscripciones cerradas o el torneo en curso (estado actual: ${estado})`
      });
      expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
    }
  });

  it.each(['abc', '0', '-3', '1.5', '99999999999'])('encuentro_id %s → 400 sin consultar (B-09)', async (id) => {
    const res = await cancha({ cancha_asignada: 'C2' }, id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'encuentro_id inválido' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('cancha de 50 caracteres (tras trim) → 200; de 51 → 400 (B-08)', async () => {
    let res = await cancha({ cancha_asignada: `  ${'c'.repeat(50)}  ` });
    expect(res.status).toBe(200);
    expect(log.find(([, sql]) => sql.startsWith('UPDATE'))[2][0]).toHaveLength(50);

    res = await cancha({ cancha_asignada: 'c'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'Máximo 50 caracteres' });
  });

  it('sin body → 400 con el campo que falta (B-09)', async () => {
    const res = await request(app).patch('/api/encuentros/100/cancha');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'cancha_asignada es requerida' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('validaciones y error', async () => {
    let res = await cancha({ cancha_asignada: 'C2' }, '-3');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'encuentro_id inválido' });

    res = await cancha({ cancha_asignada: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error: 'cancha_asignada es requerida' });

    res = await cancha({ cancha_asignada: 0 });
    expect(res.status).toBe(400);

    db.falla = 'UPDATE encuentros_torneo';
    res = await cancha({ cancha_asignada: 'C2' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_500);
    expect(ultimoError()).toBe('Error al asignar cancha:');
  });
});

// ── PUT /:id (eliminado, B-01) ───────────────────────────────────────────────

describe('PUT /api/encuentros/:id (eliminado, B-01)', () => {
  it.each([
    ['con body', { participante_1_id: 11, participante_2_id: 12 }],
    ['sin body', undefined]
  ])('%s → 404 sin tocar la BD', async (_, body) => {
    mockUser = undefined;
    const put = request(app).put('/api/encuentros/100');
    const res = await (body ? put.send(body) : put);
    expect(res.status).toBe(404);
    expect(log).toEqual([]);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
