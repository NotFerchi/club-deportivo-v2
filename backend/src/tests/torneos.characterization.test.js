'use strict';

/**
 * Tests de caracterización de /api/torneos (torneosController).
 * Además de status + cuerpo, cada test compara con un snapshot la secuencia
 * exacta de consultas y parámetros (incluido el bracket generado al cerrar
 * inscripciones, con Math.random fijo).
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

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/torneos', require('../routes/torneos.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const ERROR_HANDLER = { ok: false, error: 'Error interno del servidor' };

let db;
let log;
let client;
let consoleSpies;

function pgError(code) {
  const error = new Error(`pg ${code}`);
  error.code = code;
  return error;
}

function route(q) {
  if (db.falla && q.startsWith(db.falla.sql)) throw pgError(db.falla.code);
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT t.torneo_id, t.nombre, t.disciplina_id')) return rows(db.torneos);
  if (q.startsWith('SELECT disciplina_id FROM disciplinas')) return rows(db.disciplina);
  if (q.startsWith('INSERT INTO torneos')) return rows([{ torneo_id: 9 }]);
  if (q.startsWith('UPDATE torneos SET disciplina_id')) return rows(db.torneoActualizado);
  if (q.startsWith('SELECT pt.participante_id, pt.torneo_id')) return rows(db.participantes);
  if (q.startsWith('SELECT * FROM socios')) return rows(db.socio);
  if (q.startsWith('SELECT * FROM visitas')) return rows(db.visita);
  if (q.startsWith('SELECT categoria_id FROM categorias_torneo')) return rows(db.categoria);
  if (q.startsWith('SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND (socio_id'))
    return rows(db.duplicado);
  if (q.startsWith('SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND socio_id'))
    return rows(db.existente);
  if (q === 'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1') return rows(db.ids);
  if (q.startsWith('INSERT INTO participantes_torneo')) return rows([{ participante_id: 31 }]);
  if (q === 'SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE') return rows(db.torneoLock);
  if (q === 'SELECT estado FROM torneos WHERE torneo_id = $1') return rows(db.torneoEstado);
  if (q.startsWith('INSERT INTO encuentros_torneo')) return rows([]);
  if (q.startsWith("UPDATE torneos SET estado = 'Cancelado'")) return rows(db.cancelado);
  if (q.startsWith('UPDATE torneos SET estado')) return rows([]);
  if (q.startsWith('UPDATE encuentros_torneo SET estado')) return rows([]);
  if (q.startsWith('SELECT t.torneo_id, t.nombre, t.estado, d.nombre AS disciplina')) return rows(db.reporteTorneo);
  if (q.startsWith('SELECT e.encuentro_id, e.ronda, e.estado, e.marcador_1')) return rows(db.reporteEncuentros);
  if (q.startsWith('SELECT e.encuentro_id, e.ronda, e.estado, e.cancha_asignada')) return rows(db.bracket);
  if (q.startsWith('SELECT categoria_id, nombre FROM categorias_torneo')) return rows(db.categorias);
  if (q.startsWith('SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo')) return rows(db.socioPropio);
  if (q.startsWith('SELECT socio_id FROM socios WHERE usuario_id = $1')) return rows(db.socioMis);
  if (q.startsWith('SELECT torneo_id, estado, categoria_id FROM torneos')) return rows(db.torneoInfo);
  if (q.startsWith('DELETE FROM participantes_torneo')) return rows(db.borrado);
  if (q.startsWith('SELECT pt.participante_id, t.torneo_id')) return rows(db.mis);
  if (q.startsWith('SELECT torneo_id FROM torneos')) return rows(db.torneoExiste);
  if (q.startsWith('SELECT COUNT(*) as total FROM encuentros_torneo')) return rows(db.pendientes);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 7, rol: 'admin' };
  db = {
    falla: null,
    torneos: [{ torneo_id: 1, nombre: 'Copa' }],
    disciplina: [{ disciplina_id: 2 }],
    torneoActualizado: [{ torneo_id: 4 }],
    participantes: [
      { participante_id: 1, nombre_participante: 'Ana' },
      { participante_id: 2, nombre_participante: 'Beto' }
    ],
    socio: [{ socio_id: 10 }],
    visita: [{ visita_id: 20 }],
    categoria: [{ categoria_id: 3 }],
    duplicado: [],
    existente: [],
    ids: [11, 12, 13, 14, 15].map((participante_id) => ({ participante_id })),
    torneoLock: [{ estado: 'Abierto' }],
    torneoEstado: [{ estado: 'Abierto' }],
    cancelado: [{ torneo_id: 4 }],
    reporteTorneo: [{ torneo_id: 4, nombre: 'Copa', estado: 'En_curso', disciplina: 'Tenis' }],
    reporteEncuentros: [
      {
        encuentro_id: 100,
        ronda: 1,
        estado: 'finalizado',
        marcador_1: 3,
        marcador_2: 1,
        cancha_asignada: 'C1',
        hora_programada: '10:00',
        p1_id: 11,
        p1_nombre: 'Ana',
        p2_id: 12,
        p2_nombre: 'Beto',
        ganador_id: 11,
        ganador_nombre: 'Ana'
      },
      {
        encuentro_id: 101,
        ronda: 2,
        estado: 'pendiente',
        marcador_1: null,
        marcador_2: null,
        cancha_asignada: null,
        hora_programada: null,
        p1_id: null,
        p1_nombre: 'Por definir',
        p2_id: null,
        p2_nombre: 'Por definir',
        ganador_id: null,
        ganador_nombre: null
      }
    ],
    bracket: [
      {
        encuentro_id: 100,
        ronda: 1,
        estado: 'finalizado',
        cancha_asignada: 'C1',
        hora_programada: '10:00',
        marcador_1: 3,
        marcador_2: 1,
        ganador_id: 11,
        ganador_nombre: 'Ana',
        participante_1_id: 11,
        participante_1_nombre: 'Ana',
        participante_2_id: 12,
        participante_2_nombre: 'Beto'
      },
      {
        encuentro_id: 101,
        ronda: 1,
        estado: 'programado',
        participante_1_id: 13,
        participante_1_nombre: '',
        participante_2_id: null,
        participante_2_nombre: null
      },
      { encuentro_id: 102, ronda: null, estado: 'pendiente', participante_1_nombre: 'Por definir' },
      { encuentro_id: 103, ronda: 2, estado: 'pendiente', participante_1_nombre: 'Por definir' }
    ],
    categorias: [{ categoria_id: 3, nombre: 'Libre' }],
    socioPropio: [{ socio_id: 10 }],
    socioMis: [{ socio_id: 10 }],
    torneoInfo: [{ torneo_id: 4, estado: 'Abierto', categoria_id: 3 }],
    borrado: [{ participante_id: 31 }],
    mis: [{ participante_id: 31, torneo_id: 4 }],
    torneoExiste: [{ torneo_id: 4 }],
    pendientes: [{ total: '0' }]
  };
  ({ log, client } = recordQueries(pool, route));
  // Barajado determinista del bracket (cada test puede fijar otro valor).
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

// Primer argumento del último console.error: distingue errorHandler ('ERROR') del catch del endpoint.
const ultimoError = () => consoleSpies[1].mock.calls.at(-1)?.[0];

afterEach(() => {
  consoleSpies.forEach((spy) => spy.mockRestore());
  jest.restoreAllMocks();
});

// ── GET / ────────────────────────────────────────────────────────────────────

describe('GET /api/torneos', () => {
  it('sin filtros y con filtros → SQL según filtros', async () => {
    let res = await request(app).get('/api/torneos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.torneos);

    res = await request(app).get('/api/torneos').query({ disciplina_id: '2', estado: 'abierto' });
    expect(res.status).toBe(200);

    res = await request(app).get('/api/torneos').query({ disciplina_id: '', estado: '' });
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

  it('disciplina_id inválido → 400 sin consultar; error de BD → 500', async () => {
    let res = await request(app).get('/api/torneos').query({ disciplina_id: '2.5' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'disciplina_id debe ser un entero valido' });
    expect(log).toEqual([]);

    db.falla = { sql: 'SELECT t.torneo_id' };
    res = await request(app).get('/api/torneos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener torneos' });
  });
});

// ── POST / ───────────────────────────────────────────────────────────────────

describe('POST /api/torneos', () => {
  it('crea con valores por defecto y con todos los campos', async () => {
    let res = await request(app).post('/api/torneos').send({ nombre: '  Copa  ', disciplina_id: '2' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ torneo_id: 9 });

    res = await request(app).post('/api/torneos').send({
      nombre: 'Liga',
      disciplina_id: 2,
      fecha_inicio: '2026-10-01',
      fecha_fin: '',
      estado: 'Cerrado',
      categoria_id: '3',
      tipo_torneo: 'Equipos'
    });
    expect(res.status).toBe(201);

    // categoria_id no entero se guarda como null sin error
    res = await request(app).post('/api/torneos').send({ nombre: 'X', disciplina_id: 2, categoria_id: 'abc' });
    expect(res.status).toBe(201);
    expect(log).toMatchSnapshot();
  });

  it.each([
    [{ disciplina_id: 2 }, 'El nombre es requerido'],
    [{ nombre: '   ', disciplina_id: 2 }, 'El nombre es requerido'],
    [{ nombre: 5, disciplina_id: 2 }, 'El nombre es requerido'],
    [{ nombre: 'Copa' }, 'disciplina_id es requerido'],
    [{ nombre: 'Copa', disciplina_id: null }, 'disciplina_id es requerido'],
    [{ nombre: 'Copa', disciplina_id: 'x' }, 'disciplina_id debe ser un entero valido']
  ])('validación %j → 400', async (body, error) => {
    const res = await request(app).post('/api/torneos').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(log).toEqual([]);
  });

  it('disciplina inexistente → 400', async () => {
    db.disciplina = [];
    const res = await request(app).post('/api/torneos').send({ nombre: 'Copa', disciplina_id: 99 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La disciplina no existe' });
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['23514', 400, { error: 'La fecha de fin no puede ser menor que la fecha de inicio' }],
    ['23503', 400, { error: 'La disciplina no existe' }],
    ['22007', 400, { error: 'Formato de fecha invalido' }],
    ['22008', 400, { error: 'Formato de fecha invalido' }],
    ['XX000', 500, { error: 'Error al crear torneo' }]
  ])('error pg %s en INSERT → %i', async (code, status, body) => {
    db.falla = { sql: 'INSERT INTO torneos', code };
    const res = await request(app).post('/api/torneos').send({ nombre: 'Copa', disciplina_id: 2 });
    expect(res.status).toBe(status);
    expect(res.body).toEqual(body);
  });

  it('sin body → errorHandler global', async () => {
    const res = await request(app).post('/api/torneos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── PUT /:torneo_id ──────────────────────────────────────────────────────────

describe('PUT /api/torneos/:torneo_id', () => {
  it('actualiza con y sin opcionales', async () => {
    let res = await request(app).put('/api/torneos/4').send({ nombre: ' Copa ', disciplina_id: '2' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, torneo_id: 4, message: 'Torneo actualizado correctamente' });

    res = await request(app).put('/api/torneos/4').send({
      nombre: 'Copa',
      disciplina_id: 2,
      fecha_inicio: '2026-10-01',
      fecha_fin: '2026-10-05',
      estado: 'Abierto',
      categoria_id: 'zz',
      tipo_torneo: 'Equipos'
    });
    expect(res.status).toBe(200);

    // disciplina_id '' → Number('') === 0 pasa la validación
    res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: '' });
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['abc', { nombre: 'Copa', disciplina_id: 2 }, 'torneo_id debe ser un entero valido'],
    ['4', { nombre: '', disciplina_id: 2 }, 'El nombre es requerido'],
    ['4', { nombre: 'Copa' }, 'disciplina_id debe ser un entero valido']
  ])('validación /%s %j → 400', async (id, body, error) => {
    const res = await request(app).put(`/api/torneos/${id}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(log).toEqual([]);
  });

  it('no existe → 404; errores pg', async () => {
    db.torneoActualizado = [];
    let res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 2 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    for (const [code, status, error] of [
      ['23514', 400, 'La fecha de fin no puede ser menor que la fecha de inicio'],
      ['23503', 400, 'La disciplina no existe'],
      ['22007', 400, 'Formato de fecha invalido'],
      ['22008', 400, 'Formato de fecha invalido'],
      ['XX000', 500, 'Error al actualizar torneo']
    ]) {
      db.falla = { sql: 'UPDATE torneos', code };
      res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 2 });
      expect(res.status).toBe(status);
      expect(res.body).toEqual({ error });
    }
  });

  it('sin body → errorHandler global (incluso con id inválido)', async () => {
    const res = await request(app).put('/api/torneos/abc');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── GET /:torneo_id/participantes ────────────────────────────────────────────

describe('GET /api/torneos/:torneo_id/participantes', () => {
  it('lista con total y se_realiza', async () => {
    let res = await request(app).get('/api/torneos/4/participantes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: db.participantes,
      participantes: db.participantes,
      total: 2,
      se_realiza: false,
      minimo_participantes: 4
    });

    db.participantes = [1, 2, 3, 4].map((participante_id) => ({ participante_id }));
    res = await request(app).get('/api/torneos/4/participantes');
    expect(res.body.se_realiza).toBe(true);
    expect(log).toMatchSnapshot();
  });

  it('id inválido → 400; error → 500', async () => {
    let res = await request(app).get('/api/torneos/x/participantes');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });

    db.falla = { sql: 'SELECT pt.participante_id' };
    res = await request(app).get('/api/torneos/4/participantes');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener participantes del torneo' });
  });
});

// ── POST /:torneo_id/inscribir ───────────────────────────────────────────────

describe('POST /api/torneos/:torneo_id/inscribir', () => {
  const inscribir = (body, id = '4') => request(app).post(`/api/torneos/${id}/inscribir`).send(body);

  it('socio, visita y externo → 201', async () => {
    let res = await inscribir({ socio_id: '10', categoria_id: '3' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ participante_id: 31 });

    res = await inscribir({ visita_id: 20, categoria_id: 3, equipo_id: '6' });
    expect(res.status).toBe(201);

    res = await inscribir({ nombre_externo: '  Juan  ', categoria_id: 3, equipo_id: '' });
    expect(res.status).toBe(201);
    expect(log).toMatchSnapshot();
  });

  it.each([
    [{}, 400, 'Debe especificar exactamente un tipo de participante'],
    [{ socio_id: 10, visita_id: 20 }, 400, 'Debe especificar exactamente un tipo de participante'],
    [{ nombre_externo: '   ' }, 400, 'Debe especificar exactamente un tipo de participante'],
    [{ socio_id: 'x', categoria_id: 3 }, 400, 'Socio no encontrado o inactivo'],
    [{ visita_id: 'x', categoria_id: 3 }, 400, 'Visita no encontrada o no vigente'],
    [{ nombre_externo: 'Juan' }, 400, 'La categoría no existe']
  ])('validación %j → 400', async (body, status, error) => {
    const res = await inscribir(body);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
  });

  it('torneo_id inválido (tras validar tipo) → 400', async () => {
    const res = await inscribir({ socio_id: 10 }, 'x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });
  });

  it('socio / visita / categoría no encontrados, duplicado, equipo inválido', async () => {
    db.socio = [];
    let res = await inscribir({ socio_id: 10, categoria_id: 3 });
    expect(res.body).toEqual({ error: 'Socio no encontrado o inactivo' });

    db.visita = [];
    res = await inscribir({ visita_id: 20, categoria_id: 3 });
    expect(res.body).toEqual({ error: 'Visita no encontrada o no vigente' });

    db.categoria = [];
    res = await inscribir({ nombre_externo: 'Juan', categoria_id: 3 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría no existe' });

    db.categoria = [{ categoria_id: 3 }];
    db.visita = [{ visita_id: 20 }];
    db.duplicado = [{ participante_id: 1 }];
    res = await inscribir({ visita_id: 20, categoria_id: 3 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este participante ya está inscrito en el torneo' });

    res = await inscribir({ nombre_externo: 'Juan', categoria_id: 3, equipo_id: 'z' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'equipo_id debe ser un entero valido' });
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['23505', 409, 'Este participante ya está inscrito en el torneo'],
    ['23503', 400, 'Referencia no encontrada'],
    ['XX000', 500, 'Error al inscribir participante en torneo']
  ])('error pg %s → %i', async (code, status, error) => {
    db.falla = { sql: 'INSERT INTO participantes_torneo', code };
    const res = await inscribir({ nombre_externo: 'Juan', categoria_id: 3 });
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
  });

  it('sin body → errorHandler global', async () => {
    const res = await request(app).post('/api/torneos/4/inscribir');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── PATCH /:torneo_id/cerrar-inscripciones ───────────────────────────────────

describe('PATCH /api/torneos/:torneo_id/cerrar-inscripciones', () => {
  const cerrar = (id = '4') => request(app).patch(`/api/torneos/${id}/cerrar-inscripciones`);

  it.each([
    [4, 0.3],
    [5, 0.3],
    [6, 0.7],
    [9, 0.1]
  ])('%i participantes (random %s) → genera bracket completo', async (n, random) => {
    jest.spyOn(Math, 'random').mockReturnValue(random);
    db.ids = Array.from({ length: n }, (_, i) => ({ participante_id: 11 + i }));
    const res = await cerrar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Inscripciones cerradas y bracket generado' });
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(log).toMatchSnapshot();
  });

  it('errores de negocio → ROLLBACK', async () => {
    let res = await cerrar('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });
    expect(pool.connect).not.toHaveBeenCalled();

    db.torneoLock = [];
    res = await cerrar();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoLock = [{ estado: 'En_curso' }];
    res = await cerrar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo no está abierto para cerrar inscripciones' });

    db.torneoLock = [{ estado: 'Abierto' }];
    db.ids = db.ids.slice(0, 3);
    res = await cerrar();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Se requieren mínimo 4 participantes' });
    expect(client.release).toHaveBeenCalledTimes(3);
    expect(log).toMatchSnapshot();
  });

  it('error de BD → ROLLBACK + 500; fallo de conexión → errorHandler', async () => {
    db.falla = { sql: 'INSERT INTO encuentros_torneo' };
    let res = await cerrar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al cerrar inscripciones' });
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await cerrar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── PATCH /:torneo_id/confirmar-bracket ──────────────────────────────────────

describe('PATCH /api/torneos/:torneo_id/confirmar-bracket', () => {
  const confirmar = (id = '4') => request(app).patch(`/api/torneos/${id}/confirmar-bracket`);

  it('confirma (cualquier estado distinto de En_curso)', async () => {
    db.torneoLock = [{ estado: 'Inscripciones_cerradas' }];
    const res = await confirmar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Bracket confirmado' });
    expect(log).toMatchSnapshot();
  });

  it('400 / 404 / 409 / 500 / conexión', async () => {
    let res = await confirmar('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });

    db.torneoLock = [];
    res = await confirmar();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoLock = [{ estado: 'En_curso' }];
    res = await confirmar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El bracket ya está confirmado' });

    db.torneoLock = [{ estado: 'Abierto' }];
    db.falla = { sql: "UPDATE torneos SET estado = 'En_curso'" };
    res = await confirmar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al confirmar bracket' });
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await confirmar();
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── GET /:torneo_id/reporte ──────────────────────────────────────────────────

describe('GET /api/torneos/:torneo_id/reporte', () => {
  it('torneo + encuentros formateados', async () => {
    const res = await request(app).get('/api/torneos/4/reporte');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('400 / 404 / 500', async () => {
    let res = await request(app).get('/api/torneos/x/reporte');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });

    db.reporteTorneo = [];
    res = await request(app).get('/api/torneos/4/reporte');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.reporteTorneo = [{ torneo_id: 4 }];
    db.falla = { sql: 'SELECT e.encuentro_id' };
    res = await request(app).get('/api/torneos/4/reporte');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener el reporte' });
  });
});

// ── GET /categorias ──────────────────────────────────────────────────────────

describe('GET /api/torneos/categorias', () => {
  it('lista y error', async () => {
    let res = await request(app).get('/api/torneos/categorias');
    expect(res.body).toEqual(db.categorias);
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'SELECT categoria_id, nombre' };
    res = await request(app).get('/api/torneos/categorias');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener categorías' });
  });
});

// ── POST /:torneo_id/inscribir-me ────────────────────────────────────────────

describe('POST /api/torneos/:torneo_id/inscribir-me', () => {
  const inscribirme = (id = '4') => request(app).post(`/api/torneos/${id}/inscribir-me`);

  it('inscribe al socio autenticado con la categoría del torneo', async () => {
    const res = await inscribirme();
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ participante_id: 31 });
    expect(log).toMatchSnapshot();
  });

  it('errores de negocio', async () => {
    let res = await inscribirme('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });

    db.socioPropio = [];
    res = await inscribirme();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Socio no encontrado o inactivo' });

    db.socioPropio = [{ socio_id: 10 }];
    db.torneoInfo = [];
    res = await inscribirme();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoInfo = [{ torneo_id: 4, estado: 'Cerrado', categoria_id: 3 }];
    res = await inscribirme();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo no está abierto para inscripciones' });

    db.torneoInfo = [{ torneo_id: 4, estado: 'Abierto', categoria_id: null }];
    res = await inscribirme();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Este torneo no tiene categoría asignada. Contacta al administrador.' });

    db.torneoInfo = [{ torneo_id: 4, estado: 'Abierto', categoria_id: 3 }];
    db.existente = [{ participante_id: 31 }];
    res = await inscribirme();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este participante ya está inscrito en el torneo' });
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['23505', 409, 'Este participante ya está inscrito en el torneo'],
    ['23503', 400, 'Referencia no encontrada'],
    ['XX000', 500, 'Error al inscribirse en el torneo']
  ])('error pg %s → %i', async (code, status, error) => {
    db.falla = { sql: 'INSERT INTO participantes_torneo', code };
    const res = await inscribirme();
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
  });
});

// ── DELETE /:torneo_id/participantes/:participante_id ────────────────────────

describe('DELETE /api/torneos/:torneo_id/participantes/:participante_id', () => {
  const desinscribir = (t = '4', p = '31') => request(app).delete(`/api/torneos/${t}/participantes/${p}`);

  it('desinscribe', async () => {
    const res = await desinscribir();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Participante desinscrito correctamente' });
    expect(log).toMatchSnapshot();
  });

  it('400 / 404 / 409 / 404 participante / 500', async () => {
    let res = await desinscribir('4', 'x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'IDs inválidos' });

    db.torneoEstado = [];
    res = await desinscribir();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoEstado = [{ estado: 'En_curso' }];
    res = await desinscribir();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'No se puede desinscribir participantes una vez cerradas las inscripciones' });

    db.torneoEstado = [{ estado: 'Abierto' }];
    db.borrado = [];
    res = await desinscribir();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Participante no encontrado en este torneo' });

    db.falla = { sql: 'DELETE FROM' };
    res = await desinscribir();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al desinscribir participante' });
  });
});

// ── GET /mis-participaciones ─────────────────────────────────────────────────

describe('GET /api/torneos/mis-participaciones', () => {
  it('lista, socio no encontrado y error', async () => {
    let res = await request(app).get('/api/torneos/mis-participaciones');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.mis);
    expect(log).toMatchSnapshot();

    db.socioMis = [];
    res = await request(app).get('/api/torneos/mis-participaciones');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });

    db.falla = { sql: 'SELECT socio_id FROM socios' };
    res = await request(app).get('/api/torneos/mis-participaciones');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener participaciones' });
  });
});

// ── GET /:torneo_id/bracket ──────────────────────────────────────────────────

describe('GET /api/torneos/:torneo_id/bracket', () => {
  it('agrupa por ronda (ronda null → 1) y rellena nombres vacíos', async () => {
    const res = await request(app).get('/api/torneos/4/bracket');
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('400 / 404 / 500', async () => {
    let res = await request(app).get('/api/torneos/x/bracket');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });

    db.torneoExiste = [];
    res = await request(app).get('/api/torneos/4/bracket');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoExiste = [{ torneo_id: 4 }];
    db.falla = { sql: 'SELECT e.encuentro_id' };
    res = await request(app).get('/api/torneos/4/bracket');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener bracket' });
  });
});

// ── PATCH /:torneo_id/finalizar ──────────────────────────────────────────────

describe('PATCH /api/torneos/:torneo_id/finalizar', () => {
  const finalizar = (id = '4') => request(app).patch(`/api/torneos/${id}/finalizar`);

  it('finaliza', async () => {
    db.torneoLock = [{ estado: 'En_curso' }];
    const res = await finalizar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Torneo finalizado correctamente' });
    expect(log).toMatchSnapshot();
  });

  it('400 / 404 / 409 / pendientes / 500 / conexión', async () => {
    let res = await finalizar('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });

    db.torneoLock = [];
    res = await finalizar();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoLock = [{ estado: 'Finalizado' }];
    res = await finalizar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo ya está finalizado' });

    db.torneoLock = [{ estado: 'En_curso' }];
    db.pendientes = [{ total: '3' }];
    res = await finalizar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Aún hay 3 encuentros sin finalizar' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'SELECT COUNT(*)' };
    res = await finalizar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await finalizar();
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── PATCH /:torneo_id/cancelar ───────────────────────────────────────────────

describe('PATCH /api/torneos/:torneo_id/cancelar', () => {
  const cancelar = (id = '4') => request(app).patch(`/api/torneos/${id}/cancelar`);

  it('cancela', async () => {
    const res = await cancelar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Torneo cancelado correctamente' });
    expect(log).toMatchSnapshot();
  });

  it('400 / 404 / 409 con estado en minúsculas / 500', async () => {
    let res = await cancelar('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });

    db.cancelado = [];
    db.torneoEstado = [];
    res = await cancelar();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoEstado = [{ estado: 'Finalizado' }];
    res = await cancelar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo ya está finalizado' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'UPDATE torneos' };
    res = await cancelar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });
});
