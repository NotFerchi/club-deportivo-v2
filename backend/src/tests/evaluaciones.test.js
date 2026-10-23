'use strict';

/**
 * Tests de /api/evaluaciones (E4, contrato en docs/api-evaluaciones.md).
 * BD mockeada: cada consulta pasa por route(sql) y queda registrada (recordQueries).
 * verifyToken se reemplaza por un usuario fijo; checkRole es el real, para probar los 403 por rol.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/auditLogger', () => ({ logAudit: jest.fn() }));

let mockUser;
jest.mock('../middleware/auth.middleware', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test';
  const real = jest.requireActual('../middleware/auth.middleware');
  return {
    verifyToken: (req, res, next) => {
      req.user = mockUser;
      next();
    },
    checkRole: real.checkRole
  };
});

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/evaluaciones', require('../routes/evaluaciones.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });

const SOCIO = { usuario_id: 56, rol: 'socio' };
const INSTRUCTOR = { usuario_id: 2, rol: 'instructor' };
const COORDINADOR = { usuario_id: 55, rol: 'coordinador' };

const CREADA = {
  evaluacion_id: 27,
  instructor_id: 3,
  sesion_id: 14,
  calificacion: 5,
  comentario: 'Muy buena clase',
  periodo: '2026-10',
  fecha_creacion: '2026-10-22T18:05:41'
};
const CAMPOS_LISTA = ['evaluacion_id', 'sesion_id', 'disciplina', 'calificacion', 'comentario', 'periodo', 'fecha_creacion'];
const FILA_LISTA = {
  evaluacion_id: 27,
  sesion_id: 14,
  disciplina: 'Natación',
  calificacion: 5,
  comentario: 'Muy buena clase',
  periodo: '2026-10',
  fecha_creacion: '2026-10-22T18:05:41'
};

let db;
let log;
let client;
let consoleSpy;

function pgError(code) {
  const error = new Error(`pg ${code}: detalle interno de la BD`);
  error.code = code;
  return error;
}

function route(q) {
  if (db.falla && q.startsWith(db.falla.sql)) throw pgError(db.falla.code);
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo IS NOT FALSE')) return rows(db.socio);
  if (q.startsWith('SELECT sp.instructor_id, i.activo AS instructor_activo')) return rows(db.sesion);
  if (q.startsWith('SELECT 1 FROM inscripciones_clases')) return rows(db.inscripcion);
  if (q.startsWith('INSERT INTO evaluaciones_instructor')) return rows([CREADA]);
  if (q.startsWith('SELECT instructor_id FROM instructores WHERE usuario_id = $1')) return rows(db.instructorDelUsuario);
  if (q.startsWith('SELECT 1 FROM instructores WHERE instructor_id = $1')) return rows(db.instructorExiste);
  if (q.startsWith('SELECT e.evaluacion_id, e.sesion_id, d.nombre AS disciplina')) return rows(db.lista);
  if (q.startsWith('SELECT e.evaluacion_id, e.sesion_id, e.instructor_id')) return rows(db.mias);
  if (q.startsWith('SELECT e.calificacion, COUNT(*)::int AS total')) return rows(db.votos);
  throw new Error(`Query no esperada en test: ${q}`);
}

const sql = () => log.map(([, q]) => q);
const consulta = (inicio) => log.find(([, q]) => q.startsWith(inicio));

beforeEach(() => {
  mockUser = SOCIO;
  db = {
    falla: null,
    socio: [{ socio_id: 1 }],
    sesion: [{ instructor_id: 3, instructor_activo: true }],
    inscripcion: [{ '?column?': 1 }],
    instructorDelUsuario: [{ instructor_id: 3 }],
    instructorExiste: [{ '?column?': 1 }],
    lista: [FILA_LISTA],
    mias: [{ ...FILA_LISTA, instructor_id: 3 }],
    votos: []
  };
  ({ log, client } = recordQueries(pool, route));
  consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => consoleSpy.mockRestore());

const crear = (body) => {
  const req = request(app).post('/api/evaluaciones');
  return body === undefined ? req : req.send(body);
};

// ── POST /api/evaluaciones ───────────────────────────────────────────────────

describe('POST /api/evaluaciones · validaciones 400', () => {
  it('sin body → 400 sesion_id, sin tocar la BD', async () => {
    const res = await crear();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'sesion_id debe ser un entero válido' });
    expect(log).toHaveLength(0);
  });

  it.each([undefined, 0, -1, 'abc', 1.5, 2147483648, '', null])('sesion_id %p → 400', async (sesion_id) => {
    const res = await crear({ sesion_id, calificacion: 5 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'sesion_id debe ser un entero válido' });
  });

  it.each([undefined, 0, 6, 4.5, '5a', '10', true, null, '', [5]])('calificacion %p → 400', async (calificacion) => {
    const res = await crear({ sesion_id: 14, calificacion });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'calificacion debe ser un entero de 1 a 5' });
    expect(log).toHaveLength(0);
  });

  it.each([['a'.repeat(501)], [123], [{ texto: 'x' }]])('comentario inválido → 400', async (comentario) => {
    const res = await crear({ sesion_id: 14, calificacion: 5, comentario });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'comentario debe ser texto de máximo 500 caracteres' });
  });

  it.each(['Buena\u0000clase', '\u0000'])('comentario con \\u0000 %j → 400, sin tocar la BD (evita el 22021)', async (comentario) => {
    const res = await crear({ sesion_id: 14, calificacion: 5, comentario });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'comentario debe ser texto de máximo 500 caracteres' });
    expect(log).toHaveLength(0);
  });

  it('comentario de 500 caracteres con espacios alrededor sí pasa (se mide recortado)', async () => {
    const res = await crear({ sesion_id: 14, calificacion: 5, comentario: `   ${'a'.repeat(500)}   ` });
    expect(res.status).toBe(201);
  });

  it('acepta sesion_id y calificacion como texto de dígitos', async () => {
    const res = await crear({ sesion_id: '14', calificacion: '4' });
    expect(res.status).toBe(201);
    expect(consulta('INSERT INTO evaluaciones_instructor')[2]).toEqual([3, 14, 1, 4, null]);
  });
});

describe('POST /api/evaluaciones · permisos y reglas', () => {
  it.each(['coordinador', 'instructor', 'admin'])('rol %s → 403 por rol, sin tocar la BD', async (rol) => {
    mockUser = { usuario_id: 9, rol };
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No tienes permisos para esta acción' });
    expect(log).toHaveLength(0);
  });

  it('usuario socio sin registro de socio activo → 403', async () => {
    db.socio = [];
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Tu usuario no tiene un registro de socio activo' });
    expect(sql()).toContain('ROLLBACK');
  });

  it('sesión inexistente → 404', async () => {
    db.sesion = [];
    const res = await crear({ sesion_id: 999999, calificacion: 5 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sesión no encontrada' });
  });

  it('socio no inscrito (sin inscripción Confirmada) → 403', async () => {
    db.inscripcion = [];
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Solo puedes evaluar clases en las que estás inscrito' });
    const [, q, params] = consulta('SELECT 1 FROM inscripciones_clases');
    expect(q).toContain("estado = 'Confirmada'");
    expect(params).toEqual([14, 1]);
    expect(consulta('INSERT INTO')).toBeUndefined();
  });

  it('sesión sin instructor → 409', async () => {
    db.sesion = [{ instructor_id: null, instructor_activo: null }];
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'La sesión no tiene instructor asignado' });
  });

  it('instructor inactivo → 409', async () => {
    db.sesion = [{ instructor_id: 4, instructor_activo: false }];
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El instructor de esta sesión está inactivo' });
  });

  it('duplicado (UNIQUE 23505) → 409, con ROLLBACK y sin auditoría', async () => {
    db.falla = { sql: 'INSERT INTO evaluaciones_instructor', code: '23505' };
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Ya evaluaste esta clase este mes' });
    expect(sql()).toContain('ROLLBACK');
    expect(sql()).not.toContain('COMMIT');
    expect(logAudit).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it('error no previsto de la BD → 500 genérico, sin detalles', async () => {
    db.falla = { sql: 'SELECT sp.instructor_id', code: '42P01' };
    const res = await crear({ sesion_id: 14, calificacion: 5 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar la evaluación' });
    expect(JSON.stringify(res.body)).not.toMatch(/pg|detalle/);
  });
});

describe('POST /api/evaluaciones · caso feliz', () => {
  it('201: transacción completa, periodo calculado en la BD y auditoría', async () => {
    const res = await crear({ sesion_id: 14, calificacion: 5, comentario: '  Muy buena clase  ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(CREADA);
    expect(res.body).not.toHaveProperty('socio_id');

    expect(log.map(([origen, q]) => `${origen}: ${q.split(' ').slice(0, 4).join(' ')}`)).toEqual([
      'client: BEGIN',
      'client: SELECT socio_id FROM socios',
      'client: SELECT sp.instructor_id, i.activo AS',
      'client: SELECT 1 FROM inscripciones_clases',
      'client: INSERT INTO evaluaciones_instructor AS',
      'client: COMMIT'
    ]);
    const [, insert, params] = consulta('INSERT INTO evaluaciones_instructor');
    expect(insert).toContain("date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')::date");
    expect(params).toEqual([3, 14, 1, 5, 'Muy buena clase']);

    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'crear_evaluacion_instructor',
      tabla_afectada: 'evaluaciones_instructor',
      registro_id: 27,
      detalles: { sesion_id: 14, instructor_id: 3, periodo: '2026-10' }
    });
  });

  it.each([[undefined], [null], ['   ']])('comentario %p → se guarda NULL', async (comentario) => {
    const res = await crear({ sesion_id: 14, calificacion: 3, comentario });
    expect(res.status).toBe(201);
    expect(consulta('INSERT INTO evaluaciones_instructor')[2][4]).toBeNull();
  });
});

// ── GET /api/evaluaciones/instructor/:instructor_id ───────────────────────────

describe('GET /api/evaluaciones/instructor/:instructor_id', () => {
  const listar = (id, query = '') => request(app).get(`/api/evaluaciones/instructor/${id}${query}`);

  it('staff: lista anónima, sin socio_id ni nombre del socio', async () => {
    mockUser = COORDINADOR;
    const res = await listar(3);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([FILA_LISTA]);
    for (const fila of res.body) expect(Object.keys(fila).sort()).toEqual([...CAMPOS_LISTA].sort());

    const [, q, params] = consulta('SELECT e.evaluacion_id, e.sesion_id, d.nombre');
    expect(q).not.toMatch(/socio_id|socios|usuarios|nombres/);
    expect(q).toContain('ORDER BY e.fecha_creacion DESC, e.evaluacion_id DESC');
    expect(params).toEqual([3, null]);
    expect(consulta('SELECT instructor_id FROM instructores WHERE usuario_id')).toBeUndefined();
  });

  it('?periodo=YYYY-MM → filtra por el día 1 del mes', async () => {
    mockUser = COORDINADOR;
    await listar(3, '?periodo=2026-10');
    expect(consulta('SELECT e.evaluacion_id, e.sesion_id, d.nombre')[2]).toEqual([3, '2026-10-01']);
  });

  it('instructor consultando sus propias evaluaciones → 200', async () => {
    mockUser = INSTRUCTOR;
    const res = await listar(3);
    expect(res.status).toBe(200);
    expect(consulta('SELECT instructor_id FROM instructores WHERE usuario_id')[2]).toEqual([2]);
  });

  it('instructor consultando a otro instructor → 403, sin leer evaluaciones', async () => {
    mockUser = INSTRUCTOR;
    const res = await listar(1);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No tienes permisos para esta acción' });
    expect(consulta('SELECT e.')).toBeUndefined();
  });

  it('usuario instructor sin registro de instructor → 403', async () => {
    mockUser = INSTRUCTOR;
    db.instructorDelUsuario = [];
    const res = await listar(3);
    expect(res.status).toBe(403);
  });

  it('instructor inexistente (staff) → 404', async () => {
    mockUser = COORDINADOR;
    db.instructorExiste = [];
    const res = await listar(999999);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Instructor no encontrado' });
  });

  it.each(['socio', 'recepcion'])('rol %s → 403 por rol', async (rol) => {
    mockUser = { usuario_id: 9, rol };
    const res = await listar(3);
    expect(res.status).toBe(403);
    expect(log).toHaveLength(0);
  });

  it.each(['abc', '0', '1.5', '2147483648'])('instructor_id %p → 400', async (id) => {
    mockUser = COORDINADOR;
    const res = await listar(id);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'instructor_id debe ser un entero válido' });
    expect(log).toHaveLength(0);
  });

  it.each(['2026-13', '2026-1', '2026-00', 'abc', '2026-10-01'])('periodo %p → 400', async (periodo) => {
    mockUser = COORDINADOR;
    const res = await listar(3, `?periodo=${periodo}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'periodo debe tener el formato YYYY-MM' });
  });

  it('periodo 0000-01 → 400, sin tocar la BD (evita el 22008)', async () => {
    mockUser = COORDINADOR;
    const res = await listar(3, '?periodo=0000-01');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'periodo debe tener el formato YYYY-MM' });
    expect(log).toHaveLength(0);
  });

  it('periodo 0001-01 sí pasa (primer año válido en PostgreSQL)', async () => {
    mockUser = COORDINADOR;
    const res = await listar(3, '?periodo=0001-01');
    expect(res.status).toBe(200);
    expect(consulta('SELECT e.evaluacion_id, e.sesion_id, d.nombre')[2]).toEqual([3, '0001-01-01']);
  });
});

// ── GET /api/evaluaciones/instructor/:instructor_id/promedio ──────────────────

describe('GET /api/evaluaciones/instructor/:instructor_id/promedio', () => {
  const promedio = (id, query = '') => request(app).get(`/api/evaluaciones/instructor/${id}/promedio${query}`);

  it('sin evaluaciones → total 0, promedio null y distribución en ceros', async () => {
    mockUser = COORDINADOR;
    const res = await promedio(3);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      instructor_id: 3,
      total: 0,
      promedio: null,
      distribucion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    });
  });

  it('con varias evaluaciones → promedio con 2 decimales y distribución completa', async () => {
    mockUser = INSTRUCTOR;
    db.votos = [
      { calificacion: 4, total: 2 },
      { calificacion: 5, total: 1 }
    ];
    const res = await promedio(3, '?periodo=2026-10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      instructor_id: 3,
      total: 3,
      promedio: 4.33,
      distribucion: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 }
    });
    expect(consulta('SELECT e.calificacion, COUNT(*)')[2]).toEqual([3, '2026-10-01']);
  });

  it('el promedio no expone socios', async () => {
    mockUser = COORDINADOR;
    db.votos = [{ calificacion: 1, total: 1 }];
    const res = await promedio(3);
    expect(Object.keys(res.body).sort()).toEqual(['distribucion', 'instructor_id', 'promedio', 'total']);
    expect(consulta('SELECT e.calificacion, COUNT(*)')[1]).not.toMatch(/socio/);
  });

  it('instructor consultando el promedio de otro → 403', async () => {
    mockUser = INSTRUCTOR;
    const res = await promedio(1);
    expect(res.status).toBe(403);
    expect(consulta('SELECT e.')).toBeUndefined();
  });

  it('instructor inexistente → 404', async () => {
    mockUser = COORDINADOR;
    db.instructorExiste = [];
    const res = await promedio(999999);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Instructor no encontrado' });
  });

  it('periodo inválido → 400', async () => {
    mockUser = COORDINADOR;
    const res = await promedio(3, '?periodo=2026-13');
    expect(res.status).toBe(400);
  });

  it('periodo 0000-01 → 400, sin tocar la BD (evita el 22008)', async () => {
    mockUser = COORDINADOR;
    const res = await promedio(3, '?periodo=0000-01');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'periodo debe tener el formato YYYY-MM' });
    expect(log).toHaveLength(0);
  });
});

// ── GET /api/evaluaciones/mias ───────────────────────────────────────────────

describe('GET /api/evaluaciones/mias', () => {
  const mias = (query = '') => request(app).get(`/api/evaluaciones/mias${query}`);

  it('socio: sus evaluaciones, sin socio_id', async () => {
    const res = await mias('?periodo=2026-10');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ ...FILA_LISTA, instructor_id: 3 }]);
    expect(res.body[0]).not.toHaveProperty('socio_id');
    const [, q, params] = consulta('SELECT e.evaluacion_id, e.sesion_id, e.instructor_id');
    expect(q).toContain('WHERE e.socio_id = $1');
    expect(params).toEqual([1, '2026-10-01']);
  });

  it('socio sin registro de socio activo → 403', async () => {
    db.socio = [];
    const res = await mias();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Tu usuario no tiene un registro de socio activo' });
  });

  it.each(['instructor', 'coordinador'])('rol %s → 403 por rol', async (rol) => {
    mockUser = { usuario_id: 9, rol };
    const res = await mias();
    expect(res.status).toBe(403);
  });

  it('periodo inválido → 400', async () => {
    const res = await mias('?periodo=2026-1');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'periodo debe tener el formato YYYY-MM' });
  });

  it('periodo 0000-01 → 400, sin tocar la BD (evita el 22008)', async () => {
    const res = await mias('?periodo=0000-01');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'periodo debe tener el formato YYYY-MM' });
    expect(log).toHaveLength(0);
  });
});
