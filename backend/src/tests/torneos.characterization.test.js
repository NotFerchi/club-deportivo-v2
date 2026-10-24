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
// inscribir e inscribir-me bloquean el torneo leyendo estado, categoría, modalidad y fechas de inscripción
const LOCK_INSCRIPCION =
  "SELECT estado, categoria_id, tipo_torneo, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, " +
  "to_char(fecha_inicio_inscripcion, 'YYYY-MM-DD') AS fecha_inicio_inscripcion, " +
  "to_char(fecha_fin_inscripcion, 'YYYY-MM-DD') AS fecha_fin_inscripcion, cupo_maximo FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE";
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
  if (q.startsWith('UPDATE torneos SET disciplina_id')) return rows([]);
  if (q.startsWith('SELECT COUNT(*)::int AS total FROM participantes_torneo')) return rows(db.inscritos);
  if (q.startsWith('UPDATE participantes_torneo SET categoria_id')) return rows([]);
  if (q.startsWith('SELECT pt.participante_id, pt.torneo_id')) return rows(db.participantes);
  if (q.startsWith('SELECT * FROM socios')) return rows(db.socio);
  if (q.startsWith('SELECT * FROM visitas')) return rows(db.visita);
  if (q.startsWith('SELECT categoria_id, activo FROM categorias_torneo')) return rows(db.categoria);
  if (q.startsWith('SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND (socio_id'))
    return rows(db.duplicado);
  if (q.startsWith('SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND socio_id'))
    return rows(db.existente);
  if (q === 'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1') return rows(db.ids);
  if (q.startsWith('SELECT nombre_externo FROM participantes_torneo')) return rows(db.externos);
  if (q.startsWith('INSERT INTO participantes_torneo')) return rows([{ participante_id: 31 }]);
  if (q === 'SELECT estado FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE') return rows(db.torneoLock);
  if (q === 'SELECT estado, nombre FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE')
    return rows(db.torneoLock.map((t) => ({ nombre: 'Copa', ...t })));
  // auditoría (E2.10): logAudit atrapa sus errores, así que un fallo aquí no cambia la respuesta
  if (q.startsWith('INSERT INTO logs_sistema')) return rows([]);
  // inscribir e inscribir-me bloquean el torneo leyendo estado, categoría y modalidad
  if (q === LOCK_INSCRIPCION)
    return rows(db.torneoInfo);
  if (q.startsWith('SELECT estado, disciplina_id, tipo_torneo, categoria_id,'))
    return rows(db.torneoEditable);
  if (q === 'SELECT 1 FROM encuentros_torneo WHERE torneo_id = $1 LIMIT 1') return rows(db.hayEncuentros);
  if (q.startsWith('SELECT 1 FROM encuentros_torneo WHERE $1 IN')) return rows(db.enBracket);
  if (q.startsWith('SELECT ganador_id FROM encuentros_torneo')) return rows(db.final);
  // encuentro_id creciente, como el SERIAL: la posición en la ronda es el orden de inserción
  if (q.startsWith('INSERT INTO encuentros_torneo')) return rows([{ encuentro_id: ++db.ultimoEncuentroId }]);
  if (q.startsWith('UPDATE encuentros_torneo SET participante_')) return rows([]);
  if (q.startsWith('UPDATE torneos SET estado')) return rows([]);
  if (q.startsWith('UPDATE encuentros_torneo SET estado')) return rows([]);
  if (q.startsWith('SELECT t.torneo_id, t.nombre, t.estado, d.nombre AS disciplina')) return rows(db.reporteTorneo);
  if (q.startsWith('SELECT e.encuentro_id, e.ronda, e.estado, e.marcador_1')) return rows(db.reporteEncuentros);
  if (q.startsWith('SELECT e.encuentro_id, e.ronda, e.estado, e.cancha_asignada')) return rows(db.bracket);
  if (q.startsWith('SELECT categoria_id, nombre, activo FROM categorias_torneo')) return rows(db.categorias);
  if (q.startsWith('SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo')) return rows(db.socioPropio);
  if (q.startsWith('SELECT socio_id FROM socios WHERE usuario_id = $1')) return rows(db.socioMis);
  if (q.startsWith('DELETE FROM participantes_torneo')) return rows(db.borrado);
  if (q.startsWith('SELECT pt.participante_id, t.torneo_id')) return rows(db.mis);
  if (q.startsWith('SELECT torneo_id FROM torneos')) return rows(db.torneoExiste);
  if (q.startsWith('SELECT EXISTS (SELECT 1 FROM participantes_torneo')) return rows(db.historial);
  if (q.startsWith('DELETE FROM torneos')) return rows([]);
  if (q.startsWith('UPDATE torneos SET activo')) return rows([]);
  if (q.startsWith('SELECT COUNT(*) as total FROM encuentros_torneo')) return rows(db.pendientes);
  throw new Error(`Query no esperada en test: ${q}`);
}

// Las fechas de los fixtures (2026-10-01, ...) no deben quedar "en el pasado" (E2.5) según el día en que
// corran los tests: "hoy" se fija en el 2026-01-15 de México. Solo se falsea Date; supertest usa los timers reales.
const HOY_FIJO = new Date('2026-01-15T18:00:00Z');
const SOLO_DATE = {
  doNotFake: [
    'nextTick',
    'setImmediate',
    'clearImmediate',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'queueMicrotask',
    'hrtime',
    'performance'
  ]
};

beforeEach(() => {
  jest.useFakeTimers({ now: HOY_FIJO, ...SOLO_DATE });
  mockUser = { usuario_id: 7, rol: 'admin' };
  db = {
    falla: null,
    torneos: [{ torneo_id: 1, nombre: 'Copa' }],
    disciplina: [{ disciplina_id: 2 }],
    torneoEditable: [{ estado: 'Abierto', disciplina_id: 2, tipo_torneo: 'Individual', categoria_id: 3 }],
    participantes: [
      { participante_id: 1, nombre_participante: 'Ana' },
      { participante_id: 2, nombre_participante: 'Beto' }
    ],
    socio: [{ socio_id: 10 }],
    visita: [{ visita_id: 20 }],
    categoria: [{ categoria_id: 3, activo: true }],
    duplicado: [],
    existente: [],
    externos: [],
    inscritos: [{ total: 0 }],
    ids: [11, 12, 13, 14, 15].map((participante_id) => ({ participante_id })),
    ultimoEncuentroId: 500,
    torneoLock: [{ estado: 'Abierto' }],
    hayEncuentros: [],
    enBracket: [],
    final: [{ ganador_id: 11 }],
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
    categorias: [{ categoria_id: 3, nombre: 'Libre', activo: true }],
    socioPropio: [{ socio_id: 10 }],
    socioMis: [{ socio_id: 10 }],
    torneoInfo: [{ estado: 'Abierto', categoria_id: 3, tipo_torneo: 'Individual' }],
    borrado: [{ participante_id: 31 }],
    mis: [{ participante_id: 31, torneo_id: 4 }],
    torneoExiste: [{ torneo_id: 4 }],
    historial: [{ tiene_participantes: false, tiene_encuentros: false }],
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
  jest.useRealTimers();
  consoleSpies.forEach((spy) => spy.mockRestore());
  jest.restoreAllMocks();
});

// ── GET / ────────────────────────────────────────────────────────────────────

describe('GET /api/torneos', () => {
  it('sin filtros y con filtros → SQL según filtros', async () => {
    let res = await request(app).get('/api/torneos');
    expect(res.status).toBe(200);
    // el mock no trae estado: admite_inscripcion se calcula como false (E2.12, ver torneoAdmiteInscripcion.test.js)
    expect(res.body).toEqual([{ ...db.torneos[0], admite_inscripcion: false }]);

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

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('?disciplina_id=%s → 400 sin consultar (B-09)', async (id) => {
    const res = await request(app).get('/api/torneos').query({ disciplina_id: id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'disciplina_id debe ser un entero valido' });
    expect(log).toEqual([]);
  });
});

// ── Todos los endpoints sin body (B-09) ──────────────────────────────────────

describe('/api/torneos sin body: ningún endpoint responde 500', () => {
  it.each([
    ['get', '/api/torneos', 200],
    ['get', '/api/torneos/categorias', 200],
    ['get', '/api/torneos/mis-participaciones', 200],
    ['get', '/api/torneos/4/participantes', 200],
    ['get', '/api/torneos/4/bracket', 200],
    ['get', '/api/torneos/4/reporte', 200],
    ['post', '/api/torneos', 400],
    ['put', '/api/torneos/4', 400],
    ['post', '/api/torneos/4/inscribir', 400],
    ['post', '/api/torneos/4/inscribir-me', 201],
    ['patch', '/api/torneos/4/cerrar-inscripciones', 200],
    ['patch', '/api/torneos/4/confirmar-bracket', 409],
    ['patch', '/api/torneos/4/finalizar', 409],
    ['patch', '/api/torneos/4/cancelar', 200],
    ['delete', '/api/torneos/4/participantes/31', 200]
  ])('%s %s → %i', async (method, url, status) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(status);
  });
});

// ── POST / ───────────────────────────────────────────────────────────────────

describe('POST /api/torneos', () => {
  it('crea con valores por defecto y con todos los campos', async () => {
    let res = await request(app).post('/api/torneos').send({ nombre: '  Copa  ', disciplina_id: '2', categoria_id: 3 });
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
    expect(log).toMatchSnapshot();
  });

  it('nombre de 150 caracteres (tras trim) → 201', async () => {
    const res = await request(app)
      .post('/api/torneos')
      .send({ nombre: ` ${'n'.repeat(150)} `, disciplina_id: 2, categoria_id: 3 });
    expect(res.status).toBe(201);
    expect(log.find(([, sql]) => sql.startsWith('INSERT INTO torneos'))[2][1]).toHaveLength(150);
  });

  it.each(['Cerrado', 'Finalizado', 'En_curso', 'Lo que sea'])(
    'estado %j en el body se ignora: el torneo nace Abierto (B-02)',
    async (estado) => {
      const res = await request(app)
        .post('/api/torneos')
        .send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 3, estado });
      expect(res.status).toBe(201);
      const insert = log.find(([, sql]) => sql.startsWith('INSERT INTO torneos'));
      expect(insert[2][4]).toBe('Abierto');
    }
  );

  it.each([
    [{ disciplina_id: 2 }, 'El nombre es requerido'],
    [{ nombre: '   ', disciplina_id: 2 }, 'El nombre es requerido'],
    [{ nombre: 5, disciplina_id: 2 }, 'El nombre es requerido'],
    [{ nombre: 'Copa' }, 'disciplina_id es requerido'],
    [{ nombre: 'Copa', disciplina_id: null }, 'disciplina_id es requerido'],
    [{ nombre: 'Copa', disciplina_id: '' }, 'disciplina_id es requerido'],
    [{ nombre: 'Copa', disciplina_id: 'x' }, 'disciplina_id debe ser un entero valido'],
    // B-08: longitud
    [{ nombre: 'n'.repeat(151), disciplina_id: 2 }, 'Máximo 150 caracteres'],
    // B-09: ids fuera de 1..2147483647
    ...['abc', 0, -1, 1.5, 99999999999, '2147483648'].map((id) => [
      { nombre: 'Copa', disciplina_id: id },
      'disciplina_id debe ser un entero valido'
    ]),
    ...['abc', 0, -1, 1.5, 99999999999].map((id) => [
      { nombre: 'Copa', disciplina_id: 2, categoria_id: id },
      'categoria_id debe ser un entero valido'
    ]),
    // B-13: tipo y fechas, antes de la BD
    [
      { nombre: 'Copa', disciplina_id: 2, categoria_id: 3, tipo_torneo: 'Mixto' },
      'tipo_torneo debe ser Individual o Equipos'
    ],
    [
      { nombre: 'Copa', disciplina_id: 2, categoria_id: 3, fecha_inicio: '2026-10-05', fecha_fin: '2026-10-01' },
      'La fecha de fin no puede ser menor que la fecha de inicio'
    ]
  ])('validación %j → 400 sin consultar (B-08, B-09, B-13)', async (body, error) => {
    const res = await request(app).post('/api/torneos').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(log).toEqual([]);
  });

  it('disciplina inexistente → 400', async () => {
    db.disciplina = [];
    const res = await request(app).post('/api/torneos').send({ nombre: 'Copa', disciplina_id: 99, categoria_id: 3 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La disciplina no existe' });
    expect(log).toMatchSnapshot();
  });

  it('categoría inexistente → 400 "La categoría no existe" sin INSERT (B-13)', async () => {
    db.categoria = [];
    const res = await request(app).post('/api/torneos').send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría no existe' });
    expect(log.some(([, sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  // 23514 y 23503 ya no se traducen a mensajes de fechas o de disciplina (B-13): solo red de seguridad
  it.each([
    ['23514', 400, { error: 'Datos inválidos' }],
    ['23503', 400, { error: 'Datos inválidos' }],
    ['22007', 400, { error: 'Formato de fecha invalido' }],
    ['22008', 400, { error: 'Formato de fecha invalido' }],
    ['XX000', 500, { error: 'Error al crear torneo' }]
  ])('error pg %s en INSERT → %i', async (code, status, body) => {
    db.falla = { sql: 'INSERT INTO torneos', code };
    const res = await request(app).post('/api/torneos').send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 3 });
    expect(res.status).toBe(status);
    expect(res.body).toEqual(body);
  });

  it.each([undefined, null, ''])(
    'categoria_id %p → 400 "categoria_id es requerido" sin consultar (B-10)',
    async (cat) => {
      const res = await request(app).post('/api/torneos').send({ nombre: 'Copa', disciplina_id: 2, categoria_id: cat });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'categoria_id es requerido' });
      expect(log).toEqual([]);
    }
  );

  it('sin body → 400 con el campo que falta (B-09)', async () => {
    const res = await request(app).post('/api/torneos');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El nombre es requerido' });
    expect(log).toEqual([]);
  });
});

// ── PUT /:torneo_id ──────────────────────────────────────────────────────────

describe('PUT /api/torneos/:torneo_id', () => {
  it('actualiza con y sin opcionales', async () => {
    let res = await request(app).put('/api/torneos/4').send({ nombre: ' Copa ', disciplina_id: '2', categoria_id: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, torneo_id: 4, message: 'Torneo actualizado correctamente' });

    res = await request(app).put('/api/torneos/4').send({
      nombre: 'Copa',
      disciplina_id: 2,
      fecha_inicio: '2026-10-01',
      fecha_fin: '2026-10-05',
      estado: 'Abierto',
      categoria_id: '3',
      tipo_torneo: 'Equipos'
    });
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['abc', { nombre: 'Copa', disciplina_id: 2 }, 'torneo_id debe ser un entero valido'],
    ['4', { nombre: '', disciplina_id: 2 }, 'El nombre es requerido'],
    ['4', { nombre: 'Copa' }, 'disciplina_id es requerido'],
    // B-09: disciplina_id '' ya no pasa (antes Number('') === 0)
    ['4', { nombre: 'Copa', disciplina_id: '' }, 'disciplina_id es requerido'],
    ['4', { nombre: 'n'.repeat(151), disciplina_id: 2 }, 'Máximo 150 caracteres'],
    ['4', { nombre: 'Copa', disciplina_id: 2, categoria_id: 'zz' }, 'categoria_id debe ser un entero valido'],
    ['4', { nombre: 'Copa', disciplina_id: 2, tipo_torneo: 'Mixto' }, 'tipo_torneo debe ser Individual o Equipos'],
    ...['0', '-1', '1.5', '99999999999'].map((id) => [
      id,
      { nombre: 'Copa', disciplina_id: 2 },
      'torneo_id debe ser un entero valido'
    ]),
    ...[0, -1, 1.5, 99999999999].map((id) => [
      '4',
      { nombre: 'Copa', disciplina_id: id },
      'disciplina_id debe ser un entero valido'
    ])
  ])('validación /%s %j → 400 sin consultar', async (id, body, error) => {
    const res = await request(app).put(`/api/torneos/${id}`).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(log).toEqual([]);
  });

  it('no existe → 404; errores pg', async () => {
    db.torneoEditable = [];
    let res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 3 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoEditable = [{ estado: 'Abierto', disciplina_id: 2, tipo_torneo: 'Individual', categoria_id: null }];
    for (const [code, status, error] of [
      ['23514', 400, 'Datos inválidos'],
      ['23503', 400, 'Datos inválidos'],
      ['22007', 400, 'Formato de fecha invalido'],
      ['22008', 400, 'Formato de fecha invalido'],
      ['XX000', 500, 'Error al actualizar torneo']
    ]) {
      db.falla = { sql: 'UPDATE torneos', code };
      res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 3 });
      expect(res.status).toBe(status);
      expect(res.body).toEqual({ error });
    }
  });

  it.each([
    ['Abierto', 'Inscripciones_cerradas'],
    ['Abierto', 'Finalizado'],
    ['Finalizado', 'Abierto'],
    ['Cancelado', 'En_curso']
  ])('torneo %s con estado %s en el body → 400 sin UPDATE (B-02)', async (actual, estado) => {
    db.torneoEditable = [{ estado: actual, disciplina_id: 2, tipo_torneo: 'Individual', categoria_id: 3 }];
    const res = await request(app)
      .put('/api/torneos/4')
      .send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 3, estado });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El estado se cambia con las acciones del torneo' });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE torneos'))).toBe(false);
    expect(log.at(-1)[1]).toBe('ROLLBACK');
  });

  it.each(['Inscripciones_cerradas', 'En_curso', 'Finalizado', 'Cancelado'])(
    'torneo %s: nombre y fechas sí; disciplina, tipo y categoría → 409 (B-02)',
    async (actual) => {
      db.torneoEditable = [{ estado: actual, disciplina_id: 2, tipo_torneo: 'Individual', categoria_id: 3 }];
      const base = { nombre: 'Copa 2', disciplina_id: 2, categoria_id: 3, estado: actual };

      let res = await request(app)
        .put('/api/torneos/4')
        .send({ ...base, fecha_inicio: '2026-10-01', fecha_fin: '2026-10-05', tipo_torneo: 'Individual' });
      expect(res.status).toBe(200);

      for (const cambio of [
        { disciplina_id: 5 },
        { tipo_torneo: 'Equipos' },
        { categoria_id: 4 },
        { categoria_id: null }
      ]) {
        res = await request(app)
          .put('/api/torneos/4')
          .send({ ...base, ...cambio });
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          error: 'Con las inscripciones cerradas no se puede cambiar la disciplina, el tipo de torneo ni la categoría'
        });
      }
      expect(log.filter(([, sql]) => sql.startsWith('UPDATE torneos'))).toHaveLength(1);
    }
  );

  it('disciplina o categoría inexistentes → 400 con su mensaje, sin UPDATE (B-13)', async () => {
    db.categoria = [];
    let res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 2, categoria_id: 999 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría no existe' });

    db.disciplina = [];
    res = await request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 99, categoria_id: 3 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La disciplina no existe' });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  describe('categoría del torneo Abierto y sus inscritos', () => {
    const editar = (categoria_id) =>
      request(app).put('/api/torneos/4').send({ nombre: 'Copa', disciplina_id: 2, categoria_id });
    const escrituras = () =>
      log.filter(([, sql]) => sql.startsWith('UPDATE')).map(([, sql, params]) => [sql.split(' ')[1], params]);

    it('sin categoría → X con inscritos: 200 y los inscritos pasan a X', async () => {
      db.torneoEditable = [{ estado: 'Abierto', disciplina_id: 2, tipo_torneo: 'Individual', categoria_id: null }];
      db.inscritos = [{ total: 2 }];
      const res = await editar(3);
      expect(res.status).toBe(200);
      expect(escrituras()).toEqual([
        ['torneos', [2, 'Copa', null, null, 3, null, null, null, 4, null]],
        ['participantes_torneo', [3, 4]]
      ]);
      // la transacción termina en COMMIT; después solo va la auditoría (pool, fuera de la transacción)
      expect(log.filter(([origen]) => origen === 'client').at(-1)[1]).toBe('COMMIT');
    });

    it('X → Y con inscritos: 409 y no cambia nada', async () => {
      db.inscritos = [{ total: 2 }];
      const res = await editar(5);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'No se puede cambiar la categoría: el torneo ya tiene inscritos' });
      expect(escrituras()).toEqual([]);
      expect(log.at(-1)[1]).toBe('ROLLBACK');
    });

    it('X → Y sin inscritos: 200, cambia el torneo y no toca participantes', async () => {
      const res = await editar(5);
      expect(res.status).toBe(200);
      expect(escrituras()).toEqual([['torneos', [2, 'Copa', null, null, 5, null, null, null, 4, null]]]);
    });

    it('misma categoría: 200 sin contar inscritos ni tocar participantes', async () => {
      db.inscritos = [{ total: 2 }];
      const res = await editar(3);
      expect(res.status).toBe(200);
      expect(log.some(([, sql]) => sql.includes('participantes_torneo'))).toBe(false);
    });
  });

  it.each([undefined, null, ''])(
    'torneo Abierto con categoria_id %p → 400 "categoria_id es requerido" sin UPDATE (B-10)',
    async (cat) => {
      const res = await request(app)
        .put('/api/torneos/4')
        .send({ nombre: 'Copa', disciplina_id: 2, categoria_id: cat });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'categoria_id es requerido' });
      expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
    }
  );

  it.each(['Inscripciones_cerradas', 'En_curso', 'Finalizado', 'Cancelado'])(
    'torneo %s viejo sin categoría: editar nombre y fechas sin categoria_id → 200 (B-10)',
    async (estado) => {
      db.torneoEditable = [{ estado, disciplina_id: 2, tipo_torneo: 'Individual', categoria_id: null }];
      const res = await request(app)
        .put('/api/torneos/4')
        .send({ nombre: 'Copa renombrada', disciplina_id: 2, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-02' });
      expect(res.status).toBe(200);
      const update = log.find(([, sql]) => sql.startsWith('UPDATE torneos'));
      expect(update[2]).toEqual([2, 'Copa renombrada', '2026-11-01', '2026-11-02', null, null, null, null, 4, null]);
    }
  );

  it('sin body → 400 con el campo que falta (B-09)', async () => {
    let res = await request(app).put('/api/torneos/abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });

    res = await request(app).put('/api/torneos/4');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El nombre es requerido' });
    expect(log).toEqual([]);
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

  it('torneo inexistente → 404 en vez de 200 con [] (B-13)', async () => {
    db.torneoExiste = [];
    const res = await request(app).get('/api/torneos/999/participantes');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });
    expect(log.map(([, sql]) => sql)).toEqual(['SELECT torneo_id FROM torneos WHERE torneo_id = $1 AND activo']);
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('torneo_id %s → 400 sin consultar (B-09)', async (id) => {
    const res = await request(app).get(`/api/torneos/${id}/participantes`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });
    expect(log).toEqual([]);
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
    // B-09: ids con el validador de id, antes de la BD
    [{ socio_id: 'x', categoria_id: 3 }, 400, 'socio_id debe ser un entero valido'],
    [{ socio_id: 99999999999, categoria_id: 3 }, 400, 'socio_id debe ser un entero valido'],
    [{ visita_id: 'x', categoria_id: 3 }, 400, 'visita_id debe ser un entero valido'],
    [{ visita_id: -1, categoria_id: 3 }, 400, 'visita_id debe ser un entero valido'],
    [{ nombre_externo: 'Juan', categoria_id: 3, equipo_id: 1.5 }, 400, 'equipo_id debe ser un entero valido'],
    ...['abc', 0, -1, 1.5, 99999999999].map((id) => [
      { nombre_externo: 'Juan', categoria_id: id },
      400,
      'categoria_id debe ser un entero valido'
    ]),
    // B-08: longitud de nombre_externo, ya con trim
    [{ nombre_externo: 'e'.repeat(151), categoria_id: 3 }, 400, 'Máximo 150 caracteres']
  ])('validación %j → 400 sin consultar', async (body, status, error) => {
    const res = await inscribir(body);
    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error });
    expect(log).toEqual([]);
  });

  it.each(['x', '0', '-1', '1.5', '99999999999'])('torneo_id %s (tras validar tipo) → 400', async (id) => {
    const res = await inscribir({ socio_id: 10 }, id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero valido' });
  });

  it('nombre_externo de 150 caracteres (tras trim) → 201', async () => {
    const res = await inscribir({ nombre_externo: `  ${'e'.repeat(150)}  `, categoria_id: 3 });
    expect(res.status).toBe(201);
    expect(log.find(([, sql]) => sql.startsWith('INSERT INTO participantes_torneo'))[2][3]).toHaveLength(150);
  });

  it.each([
    ['sin categoria_id', {}],
    ['categoria_id vacío', { categoria_id: '' }],
    ['categoria_id igual a la del torneo', { categoria_id: '3' }]
  ])('%s → 201 con la categoría del torneo (B-14)', async (_, extra) => {
    const res = await inscribir({ nombre_externo: 'Juan', ...extra });
    expect(res.status).toBe(201);
    expect(log.find(([, sql]) => sql.startsWith('INSERT INTO participantes_torneo'))[2][5]).toBe(3);
  });

  it.each([5, 999])('categoria_id %i distinta de la del torneo → 400 sin INSERT (B-14)', async (categoria) => {
    const res = await inscribir({ nombre_externo: 'Juan', categoria_id: categoria });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría debe ser la del torneo' });
    expect(log.some(([, sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  it('torneo sin categoría → 409 sin INSERT (B-10, B-14)', async () => {
    db.torneoInfo = [{ estado: 'Abierto', categoria_id: null, tipo_torneo: 'Individual' }];
    const res = await inscribir({ nombre_externo: 'Juan' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este torneo no tiene categoría asignada' });
    expect(log.some(([, sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  it.each([
    ['socio', { socio_id: 10 }],
    ['visita', { visita_id: 20 }]
  ])('torneo por equipos: inscribir un %s → 400 sin consultarlo ni insertar (B-15)', async (_, participante) => {
    db.torneoInfo = [{ estado: 'Abierto', categoria_id: 3, tipo_torneo: 'Equipos' }];
    const res = await inscribir(participante);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'En un torneo por equipos solo se inscriben equipos (nombre_externo)' });
    expect(log.map(([, sql]) => sql)).toEqual([
      'BEGIN',
      LOCK_INSCRIPCION,
      'ROLLBACK'
    ]);
  });

  it('torneo por equipos: inscribir un equipo (nombre_externo) → 201 (B-15)', async () => {
    db.torneoInfo = [{ estado: 'Abierto', categoria_id: 3, tipo_torneo: 'Equipos' }];
    const res = await inscribir({ nombre_externo: 'Águilas FC' });
    expect(res.status).toBe(201);
    expect(log.find(([, sql]) => sql.startsWith('INSERT INTO participantes_torneo'))[2]).toEqual([
      4,
      null,
      null,
      'Águilas FC',
      null,
      3
    ]);
  });

  it.each(['águilas fc', ' ÁGUILAS   FC ', 'Águilas\tFC'])(
    'externo "Águilas FC" ya inscrito; %j → 409 sin INSERT (B-19)',
    async (nombre) => {
      db.externos = [{ nombre_externo: 'Águilas FC' }];
      const res = await inscribir({ nombre_externo: nombre, categoria_id: 3 });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'Este participante ya está inscrito en el torneo' });
      expect(log.some(([, sql]) => sql.startsWith('INSERT'))).toBe(false);
      expect(log.at(-1)[1]).toBe('ROLLBACK');
    }
  );

  it('otro nombre en el mismo torneo, o el mismo nombre en otro torneo → 201 (B-19)', async () => {
    db.externos = [{ nombre_externo: 'Águilas FC' }];
    let res = await inscribir({ nombre_externo: 'Águilas FC B', categoria_id: 3 });
    expect(res.status).toBe(201);

    // La búsqueda de duplicados se limita al torneo: en el torneo 5 no hay externos
    db.externos = [];
    res = await inscribir({ nombre_externo: 'Águilas FC', categoria_id: 3 }, '5');
    expect(res.status).toBe(201);
    const busquedas = log.filter(([, sql]) => sql.startsWith('SELECT nombre_externo'));
    expect(busquedas.map(([, , params]) => params)).toEqual([[4], [5]]);
  });

  it('socio / visita no encontrados, categoría distinta, duplicado, equipo inválido', async () => {
    db.socio = [];
    let res = await inscribir({ socio_id: 10, categoria_id: 3 });
    expect(res.body).toEqual({ error: 'Socio no encontrado o inactivo' });

    db.visita = [];
    res = await inscribir({ visita_id: 20, categoria_id: 3 });
    expect(res.body).toEqual({ error: 'Visita no encontrada o no vigente' });

    res = await inscribir({ nombre_externo: 'Juan', categoria_id: 5 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría debe ser la del torneo' });

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

  it('torneo inexistente → 404 (B-04)', async () => {
    db.torneoInfo = [];
    const res = await inscribir({ nombre_externo: 'Juan', categoria_id: 3 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });
  });

  it.each(['Inscripciones_cerradas', 'En_curso', 'Finalizado', 'Cancelado'])(
    'torneo %s → 409 sin INSERT, con la fila del torneo bloqueada (B-04, B-18)',
    async (estado) => {
      db.torneoInfo = [{ estado, categoria_id: 3, tipo_torneo: 'Individual' }];
      const res = await inscribir({ nombre_externo: 'Juan', categoria_id: 3 });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'El torneo no está abierto para inscripciones' });
      expect(log.map(([, sql]) => sql)).toEqual([
        'BEGIN',
        LOCK_INSCRIPCION,
        'ROLLBACK'
      ]);
    }
  );

  it('sin body → 400 con el campo que falta (B-09)', async () => {
    const res = await request(app).post('/api/torneos/4/inscribir');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Debe especificar exactamente un tipo de participante' });
    expect(log).toEqual([]);
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
    expect(res.body).toEqual({ error: 'No se permite cerrar las inscripciones: el torneo está en estado "En curso"' });

    db.torneoLock = [{ estado: 'Abierto' }];
    db.ids = db.ids.slice(0, 3);
    res = await cerrar();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Se requieren mínimo 4 participantes' });
    expect(client.release).toHaveBeenCalledTimes(3);
    expect(log).toMatchSnapshot();
  });

  it('cerrar dos veces → la segunda da 409 y no genera otro bracket (B-03)', async () => {
    let res = await cerrar();
    expect(res.status).toBe(200);
    const inserts = log.filter(([, sql]) => sql.startsWith('INSERT INTO encuentros_torneo')).length;

    db.torneoLock = [{ estado: 'Inscripciones_cerradas' }];
    res = await cerrar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Las inscripciones del torneo ya están cerradas' });
    expect(log.filter(([, sql]) => sql.startsWith('INSERT INTO encuentros_torneo'))).toHaveLength(inserts);
  });

  it('torneo Abierto que ya tiene encuentros → 409 sin leer participantes ni insertar (B-03)', async () => {
    db.hayEncuentros = [{ '?column?': 1 }];
    const res = await cerrar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo ya tiene un bracket generado' });
    expect(log.map(([, sql]) => sql)).toEqual([
      'BEGIN',
      'SELECT estado FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE',
      'SELECT 1 FROM encuentros_torneo WHERE torneo_id = $1 LIMIT 1',
      'ROLLBACK'
    ]);
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

  it('confirma solo desde Inscripciones_cerradas y con encuentros (B-02)', async () => {
    db.torneoLock = [{ estado: 'Inscripciones_cerradas' }];
    db.hayEncuentros = [{ '?column?': 1 }];
    const res = await confirmar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Bracket confirmado' });
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['Abierto', 'No se permite confirmar el bracket: el torneo está en estado "Abierto"'],
    ['En_curso', 'El torneo ya está en curso'],
    ['Finalizado', 'El torneo ya está finalizado'],
    ['Cancelado', 'El torneo ya está cancelado']
  ])('desde %s → 409 sin cambiar nada (B-02)', async (estado, error) => {
    db.torneoLock = [{ estado }];
    db.hayEncuentros = [{ '?column?': 1 }];
    const res = await confirmar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it('Inscripciones_cerradas sin encuentros → 409 (B-02)', async () => {
    db.torneoLock = [{ estado: 'Inscripciones_cerradas' }];
    const res = await confirmar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo no tiene bracket generado' });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
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
    expect(res.body).toEqual({ error: 'El torneo ya está en curso' });

    db.torneoLock = [{ estado: 'Inscripciones_cerradas' }];
    db.hayEncuentros = [{ '?column?': 1 }];
    db.falla = { sql: 'UPDATE torneos SET estado' };
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

    for (const estado of ['Cerrado', 'Inscripciones_cerradas', 'En_curso', 'Finalizado', 'Cancelado']) {
      db.torneoInfo = [{ torneo_id: 4, estado, categoria_id: 3 }];
      res = await inscribirme();
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'El torneo no está abierto para inscripciones' });
    }

    // B-14: sin categoría es un conflicto del torneo (409), con el mismo mensaje que inscribir por staff
    db.torneoInfo = [{ torneo_id: 4, estado: 'Abierto', categoria_id: null }];
    res = await inscribirme();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este torneo no tiene categoría asignada' });

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

  it('torneo por equipos → 409 sin buscar al socio ni insertar (B-15)', async () => {
    db.torneoInfo = [{ estado: 'Abierto', categoria_id: 3, tipo_torneo: 'Equipos' }];
    const res = await inscribirme();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este torneo es por equipos: la inscripción la hace el staff' });
    expect(log.map(([, sql]) => sql)).toEqual([
      'BEGIN',
      LOCK_INSCRIPCION,
      'ROLLBACK'
    ]);
  });

  it('torneo sin categoría → 409 (B-10, B-14)', async () => {
    db.torneoInfo = [{ estado: 'Abierto', categoria_id: null, tipo_torneo: 'Individual' }];
    const res = await inscribirme();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este torneo no tiene categoría asignada' });
    expect(log.some(([, sql]) => sql.startsWith('INSERT'))).toBe(false);
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

  it.each(['abc', '0', '-1', '1.5', '99999999999'])('torneo_id o participante_id %s → 400 (B-09)', async (id) => {
    let res = await desinscribir(id, '31');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'IDs inválidos' });

    res = await desinscribir('4', id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'IDs inválidos' });
    expect(log).toEqual([]);
  });

  it('400 / 404 / 409 / 404 participante / 500', async () => {
    let res = await desinscribir('4', 'x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'IDs inválidos' });

    db.torneoLock = [];
    res = await desinscribir();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoLock = [{ estado: 'En_curso' }];
    res = await desinscribir();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'No se puede desinscribir participantes una vez cerradas las inscripciones' });

    db.torneoLock = [{ estado: 'Abierto' }];
    db.borrado = [];
    res = await desinscribir();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Participante no encontrado en este torneo' });

    db.falla = { sql: 'DELETE FROM' };
    res = await desinscribir();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al desinscribir participante' });
  });

  it('participante que ya está en el bracket → 409 sin DELETE (B-03)', async () => {
    db.enBracket = [{ '?column?': 1 }];
    const res = await desinscribir();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El participante ya está en el bracket' });
    expect(log.some(([, sql]) => sql.startsWith('DELETE'))).toBe(false);
    expect(log.at(-1)[1]).toBe('ROLLBACK');
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

  it('el ganador sale solo de ganador_id, sin leer las columnas heredadas de texto (B-17)', async () => {
    db.bracket = [
      {
        encuentro_id: 200,
        ronda: 1,
        estado: 'finalizado',
        ganador_id: 12,
        // Aunque la fila trajera texto heredado, la consulta ya no lo pide y no debe usarse
        ganador_nombre: 'Texto heredado',
        participante_1_id: 11,
        participante_1_nombre: 'Ana',
        participante_2_id: 12,
        participante_2_nombre: 'Beto'
      },
      {
        encuentro_id: 201,
        ronda: 1,
        estado: 'programado',
        ganador_id: null,
        participante_1_id: 13,
        participante_2_id: 14
      }
    ];
    const res = await request(app).get('/api/torneos/4/bracket');
    expect(res.status).toBe(200);
    expect(res.body[0].encuentros.map((e) => e.ganador_nombre)).toEqual(['Beto', null]);
    const sql = log.find(([, q]) => q.startsWith('SELECT e.encuentro_id'))[1];
    expect(sql).not.toMatch(/e\.ganador\b|e\.participante_1\b|e\.participante_2\b/);
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

  it.each([
    ['Abierto', 'No se permite finalizar: el torneo está en estado "Abierto"'],
    ['Inscripciones_cerradas', 'No se permite finalizar: el torneo está en estado "Inscripciones cerradas"'],
    ['Cancelado', 'El torneo ya está cancelado']
  ])('desde %s → 409 sin cambiar nada (B-02)', async (estado, error) => {
    db.torneoLock = [{ estado }];
    const res = await finalizar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it.each([
    ['la final no tiene ganador', [{ ganador_id: null }]],
    ['el torneo no tiene encuentros', []]
  ])('sin campeón (%s) → 409 (B-11)', async (_, final) => {
    db.torneoLock = [{ estado: 'En_curso' }];
    db.final = final;
    const res = await finalizar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'La final todavía no tiene ganador' });
    expect(log.some(([, sql]) => sql.startsWith('UPDATE'))).toBe(false);
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

  it.each(['Abierto', 'Inscripciones_cerradas', 'En_curso'])('desde %s → 200 (B-02)', async (estado) => {
    db.torneoLock = [{ estado }];
    const res = await cancelar();
    expect(res.status).toBe(200);
    expect(log.find(([, sql]) => sql.startsWith('UPDATE torneos SET estado'))[2]).toEqual(['Cancelado', 4]);
  });

  it('400 / 404 / 409 con estado en minúsculas / 500', async () => {
    let res = await cancelar('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });

    db.torneoLock = [];
    res = await cancelar();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });

    db.torneoLock = [{ estado: 'Finalizado' }];
    res = await cancelar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo ya está finalizado' });

    db.torneoLock = [{ estado: 'Cancelado' }];
    res = await cancelar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El torneo ya está cancelado' });
    expect(log).toMatchSnapshot();

    db.torneoLock = [{ estado: 'Abierto' }];
    db.falla = { sql: 'UPDATE torneos' };
    res = await cancelar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });
});

describe('DELETE /api/torneos/:torneo_id', () => {
  const eliminar = (id = '4') => request(app).delete(`/api/torneos/${id}`);
  const sqls = () => log.map(([, sql]) => sql);

  it('sin participantes ni encuentros → borrado físico', async () => {
    const res = await eliminar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Torneo eliminado correctamente', borrado: 'fisico' });
    expect(log.find(([, sql]) => sql.startsWith('DELETE FROM torneos'))[2]).toEqual([4]);
    expect(sqls().some((sql) => sql.startsWith('UPDATE torneos SET activo'))).toBe(false);
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['con participantes', { tiene_participantes: true, tiene_encuentros: false }],
    ['con encuentros', { tiene_participantes: false, tiene_encuentros: true }],
    ['con participantes y encuentros', { tiene_participantes: true, tiene_encuentros: true }]
  ])('%s → borrado lógico, sin DELETE', async (_caso, historial) => {
    db.historial = [historial];
    const res = await eliminar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Torneo eliminado correctamente', borrado: 'logico' });
    expect(log.find(([, sql]) => sql.startsWith('UPDATE torneos SET activo'))[2]).toEqual([4]);
    expect(sqls().some((sql) => sql.startsWith('DELETE'))).toBe(false);
  });

  it('comprueba y borra dentro de la transacción, con el torneo bloqueado', async () => {
    await eliminar();
    expect(sqls()).toEqual([
      'BEGIN',
      'SELECT estado, nombre FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE',
      'SELECT EXISTS (SELECT 1 FROM participantes_torneo WHERE torneo_id = $1) AS tiene_participantes, EXISTS (SELECT 1 FROM encuentros_torneo WHERE torneo_id = $1) AS tiene_encuentros',
      'DELETE FROM torneos WHERE torneo_id = $1',
      'COMMIT',
      // auditoría (E2.10), ya fuera de la transacción
      'INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen, registro_id) VALUES ($1, $2, $3, $4, $5, $6)'
    ]);
    expect(log.at(-1)[2]).toEqual([7, 'eliminar_torneo', 'torneos', 'Torneo eliminado (fisico): Copa', expect.any(String), 4]);
    expect(client.release).toHaveBeenCalled();
  });

  it('en curso → 409, sin comprobar historial ni borrar, con ROLLBACK', async () => {
    db.torneoLock = [{ estado: 'En_curso' }];
    db.historial = [{ tiene_participantes: true, tiene_encuentros: true }];
    const res = await eliminar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Cancela el torneo antes de eliminarlo' });
    expect(sqls()).toEqual(['BEGIN', 'SELECT estado, nombre FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE', 'ROLLBACK']);
  });

  it.each(['Abierto', 'Inscripciones_cerradas', 'Finalizado', 'Cancelado'])('desde %s → 200', async (estado) => {
    db.torneoLock = [{ estado }];
    db.historial = [{ tiene_participantes: true, tiene_encuentros: estado !== 'Abierto' }];
    const res = await eliminar();
    expect(res.status).toBe(200);
    expect(res.body.borrado).toBe('logico');
  });

  it('400 / 404 (inexistente o ya eliminado) / 500 con ROLLBACK', async () => {
    let res = await eliminar('abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });

    db.torneoLock = [];
    res = await eliminar('999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });
    expect(sqls().some((sql) => sql.startsWith('DELETE') || sql.startsWith('UPDATE'))).toBe(false);

    db.torneoLock = [{ estado: 'Abierto' }];
    db.falla = { sql: 'DELETE FROM torneos' };
    res = await eliminar();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar torneo' });
    expect(sqls().at(-1)).toBe('ROLLBACK');
  });
});

describe('torneos eliminados (activo = FALSE) no se muestran', () => {
  it('el listado filtra siempre por t.activo', async () => {
    await request(app).get('/api/torneos');
    expect(log[0][1]).toContain('WHERE t.activo GROUP BY');
  });

  it.each([
    ['participantes', '/api/torneos/4/participantes'],
    ['bracket', '/api/torneos/4/bracket'],
    ['reporte', '/api/torneos/4/reporte']
  ])('%s de un torneo eliminado → 404', async (_caso, url) => {
    db.torneoExiste = [];
    db.reporteTorneo = [];
    const res = await request(app).get(url);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Torneo no encontrado' });
    expect(log[0][1]).toMatch(/AND t?\.?activo/);
  });

  it('mis participaciones excluye los torneos eliminados', async () => {
    mockUser = { usuario_id: 7, rol: 'socio' };
    await request(app).get('/api/torneos/mis-participaciones');
    expect(log.find(([, sql]) => sql.startsWith('SELECT pt.participante_id, t.torneo_id'))[1]).toContain(
      'WHERE pt.socio_id = $1 AND t.activo'
    );
  });
});

// ── Periodo de inscripción (F-07) ───────────────────────────────────────────

describe('fechas de inscripción (F-07)', () => {
  // 21:00 del 2026-10-18 en México; en UTC ya es el 19. "Hoy" debe ser el 18.
  const AHORA = new Date('2026-10-19T03:00:00Z');
  const CERRADAS = { error: 'Las inscripciones de este torneo están cerradas' };
  const BASE = { nombre: 'Copa Otoño', disciplina_id: 2, categoria_id: 3 };
  const sqls = () => log.map(([, sql]) => sql);
  const insertTorneo = () => log.find(([, sql]) => sql.startsWith('INSERT INTO torneos'));
  const updateTorneo = () => log.find(([, sql]) => sql.startsWith('UPDATE torneos SET disciplina_id'));
  const inserto = () => sqls().some((sql) => sql.startsWith('INSERT INTO participantes_torneo'));

  beforeEach(() => {
    // Solo se falsea Date: supertest sigue usando los timers reales
    jest.useFakeTimers({
      now: AHORA,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'hrtime',
        'performance'
      ]
    });
  });
  afterEach(() => jest.useRealTimers());

  describe('POST /api/torneos', () => {
    const crear = (body) =>
      request(app)
        .post('/api/torneos')
        .send({ ...BASE, ...body });

    it('fechas válidas → 201 y se guardan', async () => {
      const res = await crear({
        fecha_inicio: '2026-11-07',
        fecha_fin: '2026-11-15',
        fecha_inicio_inscripcion: '2026-10-20',
        fecha_fin_inscripcion: '2026-11-06'
      });
      expect(res.status).toBe(201);
      expect(insertTorneo()[2].slice(-3)).toEqual(['2026-10-20', '2026-11-06', null]);
    });

    it('sin fechas de inscripción → 201 con NULL; fin igual a fecha_inicio → 201', async () => {
      let res = await crear({ fecha_inicio: '2026-11-07' });
      expect(res.status).toBe(201);
      expect(insertTorneo()[2].slice(-2)).toEqual([null, null]);

      res = await crear({ fecha_inicio: '2026-11-07', fecha_fin_inscripcion: '2026-11-07' });
      expect(res.status).toBe(201);
    });

    it.each([
      [
        'fin de inscripción antes del inicio de inscripción',
        { fecha_inicio_inscripcion: '2026-11-05', fecha_fin_inscripcion: '2026-11-01' },
        'fecha_fin_inscripcion (2026-11-01) no puede ser anterior a fecha_inicio_inscripcion (2026-11-05)'
      ],
      [
        'fin de inscripción después del inicio del torneo',
        { fecha_inicio: '2026-11-07', fecha_fin_inscripcion: '2026-11-10' },
        'fecha_fin_inscripcion (2026-11-10) no puede ser posterior a fecha_inicio del torneo (2026-11-07)'
      ],
      [
        'inicio de inscripción después del inicio del torneo',
        { fecha_inicio: '2026-11-07', fecha_inicio_inscripcion: '2026-11-08' },
        'fecha_inicio_inscripcion (2026-11-08) no puede ser posterior a fecha_inicio del torneo (2026-11-07)'
      ],
      ['formato inválido', { fecha_fin_inscripcion: '06/11/2026' }, 'fecha_fin_inscripcion debe tener el formato YYYY-MM-DD']
    ])('%s → 400 sin consultar la BD', async (_caso, body, error) => {
      const res = await crear(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error });
      expect(log).toHaveLength(0);
    });
  });

  describe('PUT /api/torneos/:torneo_id', () => {
    const editar = (body) =>
      request(app)
        .put('/api/torneos/4')
        .send({ ...BASE, ...body });

    beforeEach(() => {
      db.torneoEditable = [
        {
          estado: 'Abierto',
          disciplina_id: 2,
          tipo_torneo: 'Individual',
          categoria_id: 3,
          fecha_inicio_inscripcion: '2026-10-20',
          fecha_fin_inscripcion: '2026-11-06'
        }
      ];
    });

    it('sin las fechas de inscripción en el body → conserva las guardadas', async () => {
      const res = await editar({ fecha_inicio: '2026-11-07' });
      expect(res.status).toBe(200);
      expect(updateTorneo()[2].slice(6, 8)).toEqual(['2026-10-20', '2026-11-06']);
    });

    it('con null o "" → las quita', async () => {
      const res = await editar({ fecha_inicio: '2026-11-07', fecha_inicio_inscripcion: null, fecha_fin_inscripcion: '' });
      expect(res.status).toBe(200);
      expect(updateTorneo()[2].slice(6, 8)).toEqual([null, null]);
    });

    it('mover fecha_inicio antes del fin de inscripción guardado → 400 con la fecha guardada, sin UPDATE', async () => {
      const res = await editar({ fecha_inicio: '2026-11-01' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'fecha_fin_inscripcion (2026-11-06) no puede ser posterior a fecha_inicio del torneo (2026-11-01)'
      });
      expect(updateTorneo()).toBeUndefined();
      expect(sqls().at(-1)).toBe('ROLLBACK');
    });

    it('fechas invertidas en el body → 400 antes de abrir la transacción', async () => {
      const res = await editar({ fecha_inicio_inscripcion: '2026-11-05', fecha_fin_inscripcion: '2026-11-01' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'fecha_fin_inscripcion (2026-11-01) no puede ser anterior a fecha_inicio_inscripcion (2026-11-05)'
      });
      expect(log).toHaveLength(0);
    });
  });

  describe.each([
    [
      'POST /:torneo_id/inscribir (staff)',
      () => request(app).post('/api/torneos/4/inscribir').send({ nombre_externo: 'Ana' })
    ],
    ['POST /:torneo_id/inscribir-me (socio)', () => request(app).post('/api/torneos/4/inscribir-me')]
  ])('%s', (_endpoint, inscribirAhora) => {
    const conFechas = (fechas) => {
      db.torneoInfo = [{ estado: 'Abierto', categoria_id: 3, tipo_torneo: 'Individual', ...fechas }];
    };

    it.each([
      ['el periodo terminó ayer', { fecha_fin_inscripcion: '2026-10-17' }],
      ['el periodo empieza mañana', { fecha_inicio_inscripcion: '2026-10-19', fecha_fin_inscripcion: '2026-10-30' }],
      ['sin fin de inscripción y el torneo empieza hoy', { fecha_inicio: '2026-10-18' }],
      ['sin fin de inscripción y el torneo ya empezó', { fecha_inicio: '2026-10-01' }]
    ])('%s → 409 sin INSERT', async (_caso, fechas) => {
      conFechas(fechas);
      const res = await inscribirAhora();
      expect(res.status).toBe(409);
      expect(res.body).toEqual(CERRADAS);
      expect(inserto()).toBe(false);
      expect(sqls().at(-1)).toBe('ROLLBACK');
    });

    it.each([
      ['hoy es el último día (en México, aunque en UTC ya sea el día siguiente)', { fecha_fin_inscripcion: '2026-10-18' }],
      ['hoy es el primer día', { fecha_inicio_inscripcion: '2026-10-18', fecha_fin_inscripcion: '2026-10-30' }],
      ['sin fin de inscripción y el torneo empieza mañana', { fecha_inicio: '2026-10-19' }],
      ['sin ninguna fecha', {}]
    ])('%s → 201', async (_caso, fechas) => {
      conFechas(fechas);
      const res = await inscribirAhora();
      expect(res.status).toBe(201);
      expect(inserto()).toBe(true);
    });

    it('un torneo no Abierto responde su propio 409 aunque también esté fuera de periodo', async () => {
      db.torneoInfo = [
        { estado: 'En_curso', categoria_id: 3, tipo_torneo: 'Individual', fecha_fin_inscripcion: '2026-10-01' }
      ];
      const res = await inscribirAhora();
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'El torneo no está abierto para inscripciones' });
    });
  });
});

// ── Fecha de inicio pasada (E2.5) ───────────────────────────────────────────

describe('fecha de inicio anterior a hoy (E2.5)', () => {
  const PASADA = { error: 'La fecha de inicio no puede ser anterior a hoy' };
  const body = (fecha_inicio) => ({ nombre: 'Copa', disciplina_id: 2, categoria_id: 3, fecha_inicio });
  const crear = (fecha_inicio) => request(app).post('/api/torneos').send(body(fecha_inicio));
  const editar = (fecha_inicio) => request(app).put('/api/torneos/4').send(body(fecha_inicio));
  const sqls = () => log.map(([, sql]) => sql);

  // 21:00 del 2026-10-18 en México; en UTC ya es el 19. "Hoy" es el 18.
  beforeEach(() => jest.setSystemTime(new Date('2026-10-19T03:00:00Z')));

  describe('POST /api/torneos', () => {
    it('ayer → 400 sin consultar la BD', async () => {
      const res = await crear('2026-10-17');
      expect(res.status).toBe(400);
      expect(res.body).toEqual(PASADA);
      expect(log).toEqual([]);
    });

    it.each(['2026-10-18', '2026-10-19', undefined, null, ''])('fecha_inicio %j (hoy, futura o sin fecha) → 201', async (fecha) => {
      expect((await crear(fecha)).status).toBe(201);
    });
  });

  describe('PUT /api/torneos/:torneo_id', () => {
    const conInicio = (fecha_inicio) => {
      db.torneoEditable = [{ ...db.torneoEditable[0], fecha_inicio }];
    };

    it('cambia a una fecha pasada → 400 sin UPDATE', async () => {
      conInicio('2026-11-07');
      const res = await editar('2026-10-17');
      expect(res.status).toBe(400);
      expect(res.body).toEqual(PASADA);
      expect(sqls()).not.toContainEqual(expect.stringContaining('UPDATE torneos'));
      expect(sqls()).toContain('ROLLBACK');
    });

    it('torneo antiguo que conserva su fecha pasada → 200', async () => {
      conInicio('2025-03-01');
      expect((await editar('2025-03-01')).status).toBe(200);
    });

    it('torneo sin fecha que recibe una pasada → 400', async () => {
      conInicio(null);
      expect((await editar('2026-10-01')).status).toBe(400);
    });

    it('cambia a hoy, a una futura o la quita → 200', async () => {
      conInicio('2025-03-01');
      for (const fecha of ['2026-10-18', '2026-12-01', null]) {
        expect((await editar(fecha)).status).toBe(200);
      }
    });
  });
});