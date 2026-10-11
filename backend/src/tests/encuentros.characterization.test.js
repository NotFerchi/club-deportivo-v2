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
  if (q.includes('AND (participante_1_id = $3 OR participante_2_id = $3)')) return rows(db.slotAnterior);
  if (q.includes('AND (participante_1_id IS NULL OR participante_2_id IS NULL)')) return rows(db.slotLibre);
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
    slotAnterior: [{ encuentro_id: 200, participante_1_id: 13, participante_2_id: 11 }],
    slotLibre: [{ encuentro_id: 201, participante_1_id: null, participante_2_id: null }],
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

  it('registro nuevo: gana p1, ocupa slot libre (p1) y activa la siguiente ronda', async () => {
    const res = await resultado({ marcador_1: 3, marcador_2: '1', cancha_asignada: ' C1 ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(log).toMatchSnapshot();
  });

  it('registro nuevo: gana p2, slot con p1 ocupado → p2; ronda con pendientes; cancha vacía → null', async () => {
    db.slotLibre = [{ encuentro_id: 201, participante_1_id: 13, participante_2_id: null }];
    db.pendRonda = [{ total: '2' }];
    const res = await resultado({ marcador_1: 0, marcador_2: 2, cancha_asignada: '   ' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('registro nuevo sin slot siguiente (final)', async () => {
    db.slotLibre = [];
    const res = await resultado({ marcador_1: 1, marcador_2: 0 });
    expect(res.status).toBe(200);
    expect(res.body.siguiente_encuentro).toBeNull();
    expect(log).toMatchSnapshot();
  });

  it('edición con cambio de ganador → reemplaza al ganador anterior en su slot', async () => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    const res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('edición: slot anterior en p1 / sin slot / mismo ganador / sin ganador previo', async () => {
    db.enc[0] = { ...db.enc[0], estado: 'finalizado', ganador_id: 11 };
    db.slotAnterior = [{ encuentro_id: 200, participante_1_id: 11, participante_2_id: 13 }];
    let res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.body.siguiente_encuentro).toEqual({
      encuentro_id: 200,
      ronda: 2,
      campo: 'participante_1_id',
      ganador: 12
    });

    db.slotAnterior = [];
    res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.body.siguiente_encuentro).toBeNull();

    res = await resultado({ marcador_1: 5, marcador_2: 4, allowEdit: true });
    expect(res.body.message).toBe('Resultado actualizado correctamente');

    db.enc[0] = { ...db.enc[0], estado: 'pendiente', ganador_id: null };
    res = await resultado({ marcador_1: 1, marcador_2: 4, allowEdit: true });
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

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
    ]
  ])('validación /%s %j → 400', async (id, body, error) => {
    const res = await resultado(body, id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, error });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('404 / finalizado / no programado / sin participantes → ROLLBACK', async () => {
    db.enc = [];
    let res = await resultado({ marcador_1: 1, marcador_2: 0 });
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
    expect(client.release).toHaveBeenCalledTimes(4);
    expect(log).toMatchSnapshot();
  });

  it('error de BD → ROLLBACK + 500; conexión → errorHandler; sin body → errorHandler', async () => {
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

    res = await request(app).patch('/api/encuentros/100/resultado');
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

    db.cancha = [];
    res = await cancha({ cancha_asignada: 'C2' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'Encuentro no encontrado' });
    expect(log).toMatchSnapshot();
  });

  it('validaciones, error y sin body', async () => {
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

    res = await request(app).patch('/api/encuentros/100/cancha');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
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
