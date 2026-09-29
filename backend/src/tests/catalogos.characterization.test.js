'use strict';

/**
 * Tests de caracterización de los controladores chicos de catálogo:
 * /api/roles (roles.controller), /api/disciplinas (disciplinasController),
 * /api/sesiones (sesionesController) y /api/logs (logsController).
 * Además de status + cuerpo, cada test compara con un snapshot la secuencia
 * exacta de consultas y parámetros (incluida la auditoría en logs_sistema).
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
app.use('/api/roles', require('../routes/roles.routes'));
app.use('/api/disciplinas', require('../routes/disciplinas.routes'));
app.use('/api/sesiones', require('../routes/sesiones.routes'));
app.use('/api/logs', require('../routes/logs.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const ERROR_HANDLER = { ok: false, error: 'Error interno del servidor' };

let db;
let log;
let consoleSpies;

function pgError(code) {
  const error = new Error(`pg ${code || 'boom'}`);
  error.code = code;
  return error;
}

function route(q) {
  if (db.falla && q.includes(db.falla.sql)) throw pgError(db.falla.code);
  if (q.startsWith('INSERT INTO logs_sistema')) {
    if (db.auditFalla) throw new Error('audit down');
    return rows([]);
  }
  // roles
  if (q.startsWith('SELECT rol_id, nombre FROM roles')) return rows(db.roles);
  // disciplinas
  if (q.startsWith('SELECT disciplina_id, nombre FROM disciplinas WHERE')) return rows(db.disciplina);
  if (q.startsWith('SELECT disciplina_id, nombre FROM disciplinas')) return rows(db.disciplinas);
  if (q.startsWith('INSERT INTO disciplinas')) return rows([{ disciplina_id: 8 }]);
  if (q.startsWith('UPDATE disciplinas')) return rows(db.disciplinaActualizada);
  if (q.startsWith('SELECT COUNT(*) FROM espacios')) return rows([{ count: db.espaciosUsando }]);
  if (q.startsWith('DELETE FROM disciplinas')) return rows(db.disciplinaBorrada);
  // sesiones
  if (q.includes('as inscritos_actuales')) return rows(db.sesiones);
  if (q.includes('as cupo_actual FROM sesiones_programadas sp')) return rows(db.sesionesDia);
  if (q.startsWith('SELECT sesion_id FROM sesiones_programadas')) return rows(db.conflicto);
  if (q.startsWith('INSERT INTO sesiones_programadas')) return rows([{ sesion_id: 55 }]);
  if (q.startsWith('UPDATE sesiones_programadas')) return rows([]);
  if (q.startsWith('DELETE FROM sesiones_programadas')) return rows([]);
  // logs
  if (q.includes('as usuario_email')) return rows(db.logs);
  if (q.includes('WHERE l.tabla_afectada = $1')) return rows(db.logsTabla);
  if (q.includes('GROUP BY accion')) return rows(db.statsAcciones);
  if (q.includes('GROUP BY DATE(fecha)')) return rows(db.statsDia);
  if (q.includes('GROUP BY tabla_afectada')) return rows(db.statsTabla);
  if (q === 'SELECT COUNT(*) FROM logs_sistema') return rows([{ count: '42' }]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 3, rol: 'admin' };
  db = {
    falla: null,
    auditFalla: false,
    roles: [{ rol_id: 1, nombre: 'admin' }],
    disciplinas: [{ disciplina_id: 1, nombre: 'Tenis' }],
    disciplina: [{ disciplina_id: 1, nombre: 'Tenis' }],
    disciplinaActualizada: [{ disciplina_id: 1 }],
    espaciosUsando: '0',
    disciplinaBorrada: [{ disciplina_id: 1 }],
    sesiones: [{ sesion_id: 1 }],
    sesionesDia: [{ sesion_id: 2 }],
    conflicto: [],
    logs: [{ log_id: 1 }],
    logsTabla: [{ log_id: 2 }],
    statsAcciones: [{ accion: 'login', total: '5' }],
    statsDia: [{ dia: '2026-09-30', total: '2' }],
    statsTabla: [{ tabla_afectada: 'socios', total: '1' }]
  };
  ({ log } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// Primer argumento del último console.error: distingue errorHandler ('ERROR') del catch del endpoint.
const ultimoError = () => consoleSpies[1].mock.calls.at(-1)?.[0];

// ── /api/roles ───────────────────────────────────────────────────────────────

describe('GET /api/roles', () => {
  it('lista y error', async () => {
    let res = await request(app).get('/api/roles');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.roles);
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'FROM roles' };
    res = await request(app).get('/api/roles');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(ultimoError()).toBe('Error al obtener roles:');
  });
});

// ── /api/disciplinas ─────────────────────────────────────────────────────────

describe('/api/disciplinas', () => {
  it('GET / y GET /:id (200, 404, 500)', async () => {
    let res = await request(app).get('/api/disciplinas');
    expect(res.body).toEqual(db.disciplinas);

    res = await request(app).get('/api/disciplinas/1');
    expect(res.body).toEqual(db.disciplina[0]);

    db.disciplina = [];
    res = await request(app).get('/api/disciplinas/abc');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Disciplina no encontrada' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'FROM disciplinas' };
    res = await request(app).get('/api/disciplinas');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener disciplinas' });
    res = await request(app).get('/api/disciplinas/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener disciplina' });
  });

  it('POST / crea y audita (IP de x-forwarded-for); auditoría fallida no afecta', async () => {
    let res = await request(app)
      .post('/api/disciplinas')
      .set('x-forwarded-for', '10.0.0.1, 10.0.0.2')
      .send({ nombre: 'Pádel' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, id: 8, message: 'Disciplina creada correctamente' });

    db.auditFalla = true;
    res = await request(app).post('/api/disciplinas').set('x-forwarded-for', '10.0.0.9').send({ nombre: 'Yoga' });
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

  it('POST / validación, 23505 y 500; sin body → errorHandler', async () => {
    let res = await request(app).post('/api/disciplinas').send({ nombre: '' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El nombre es requerido' });

    db.falla = { sql: 'INSERT INTO disciplinas', code: '23505' };
    res = await request(app).post('/api/disciplinas').send({ nombre: 'Tenis' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Ya existe una disciplina con ese nombre' });

    db.falla = { sql: 'INSERT INTO disciplinas' };
    res = await request(app).post('/api/disciplinas').send({ nombre: 'Tenis' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear disciplina' });

    res = await request(app).post('/api/disciplinas');
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });

  it('PUT /:id actualiza, 404, 23505, 500, validación y sin body', async () => {
    let res = await request(app)
      .put('/api/disciplinas/1')
      .set('x-forwarded-for', '10.0.0.1')
      .send({ nombre: 'Tenis 2' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Disciplina actualizada correctamente' });

    db.disciplinaActualizada = [];
    res = await request(app).put('/api/disciplinas/1').send({ nombre: 'X' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Disciplina no encontrada' });
    expect(log).toMatchSnapshot();

    res = await request(app).put('/api/disciplinas/1').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El nombre es requerido' });

    db.falla = { sql: 'UPDATE disciplinas', code: '23505' };
    res = await request(app).put('/api/disciplinas/1').send({ nombre: 'X' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Ya existe una disciplina con ese nombre' });

    db.falla = { sql: 'UPDATE disciplinas' };
    res = await request(app).put('/api/disciplinas/1').send({ nombre: 'X' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar disciplina' });

    res = await request(app).put('/api/disciplinas/1');
    expect(res.body).toEqual(ERROR_HANDLER);
  });

  it('DELETE /:id elimina, en uso, 404, 500', async () => {
    let res = await request(app).delete('/api/disciplinas/1').set('x-forwarded-for', '10.0.0.1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Disciplina eliminada correctamente' });

    db.espaciosUsando = '2';
    res = await request(app).delete('/api/disciplinas/1');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'No se puede eliminar la disciplina porque está siendo usada por uno o más espacios'
    });

    db.espaciosUsando = '1';
    res = await request(app).delete('/api/disciplinas/1');
    expect(res.status).toBe(400);

    db.espaciosUsando = '0';
    db.disciplinaBorrada = [];
    res = await request(app).delete('/api/disciplinas/1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Disciplina no encontrada' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'SELECT COUNT(*) FROM espacios' };
    res = await request(app).delete('/api/disciplinas/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar disciplina' });
  });
});

// ── /api/sesiones ────────────────────────────────────────────────────────────

describe('/api/sesiones', () => {
  it('GET / sin y con filtros; GET /dia/:dia', async () => {
    let res = await request(app).get('/api/sesiones');
    expect(res.body).toEqual(db.sesiones);

    await request(app).get('/api/sesiones').query({ disciplina: 'ten', dia: '2', instructor: 'Ana' });
    await request(app).get('/api/sesiones').query({ instructor: 'Luis' });

    res = await request(app).get('/api/sesiones/dia/3');
    expect(res.body).toEqual(db.sesionesDia);
    expect(log).toMatchSnapshot();
  });

  it('errores de lectura → 500', async () => {
    db.falla = { sql: 'inscritos_actuales' };
    let res = await request(app).get('/api/sesiones');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener sesiones' });

    db.falla = { sql: 'as cupo_actual' };
    res = await request(app).get('/api/sesiones/dia/3');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener sesiones por día' });
  });

  it('POST / crea, conflicto, 500 y sin body', async () => {
    const body = {
      disciplina_id: 1,
      espacio_id: 2,
      instructor_id: 3,
      dia_semana: 4,
      hora_inicio: '08:00',
      hora_fin: '09:00',
      cupo_maximo: 10
    };
    let res = await request(app).post('/api/sesiones').send(body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Sesión creada exitosamente', sesion_id: 55 });

    db.conflicto = [{ sesion_id: 9 }];
    res = await request(app).post('/api/sesiones').send({ espacio_id: 2 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Ya existe una sesión en este espacio y horario' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'SELECT sesion_id FROM' };
    res = await request(app).post('/api/sesiones').send(body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear sesión' });

    res = await request(app).post('/api/sesiones');
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });

  it('PUT /:id y DELETE /:id (sin validar existencia)', async () => {
    let res = await request(app).put('/api/sesiones/7').send({ disciplina_id: 1, activo: false });
    expect(res.body).toEqual({ message: 'Sesión actualizada correctamente' });

    res = await request(app).delete('/api/sesiones/7');
    expect(res.body).toEqual({ message: 'Sesión eliminada correctamente' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'UPDATE sesiones' };
    res = await request(app).put('/api/sesiones/7').send({});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar sesión' });

    db.falla = { sql: 'DELETE FROM sesiones' };
    res = await request(app).delete('/api/sesiones/7');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar sesión' });

    res = await request(app).put('/api/sesiones/7');
    expect(res.body).toEqual(ERROR_HANDLER);
  });
});

// ── /api/logs ────────────────────────────────────────────────────────────────

describe('/api/logs', () => {
  it('POST / registra (con y sin body)', async () => {
    let res = await request(app)
      .post('/api/logs')
      .set('x-forwarded-for', '10.0.0.1')
      .send({ accion: 'x', tabla_afectada: 't', detalles: { a: 1 }, registro_id: 4 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, message: 'Log registrado' });

    res = await request(app)
      .post('/api/logs')
      .send({ accion: 'y', detalles: 'z'.repeat(1200) });
    expect(res.status).toBe(201);

    res = await request(app).post('/api/logs');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'accion es requerida' });
    expect(log).toMatchSnapshot();
  });

  it('GET / con filtros por defecto y todos los filtros', async () => {
    let res = await request(app).get('/api/logs');
    expect(res.body).toEqual(db.logs);

    await request(app).get('/api/logs').query({
      limite: '5',
      offset: '10',
      tabla: 'socios',
      usuarioId: '3',
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-30'
    });
    await request(app).get('/api/logs').query({ fechaFin: '2026-09-30' });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'usuario_email' };
    res = await request(app).get('/api/logs');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener logs' });
  });

  it('GET /tabla/:tabla y /estadisticas', async () => {
    let res = await request(app).get('/api/logs/tabla/socios');
    expect(res.body).toEqual(db.logsTabla);

    res = await request(app).get('/api/logs/estadisticas');
    expect(res.body).toEqual({
      acciones: db.statsAcciones,
      porDia: db.statsDia,
      porTabla: db.statsTabla,
      total: 42
    });
    expect(log).toMatchSnapshot();

    db.falla = { sql: 'WHERE l.tabla_afectada' };
    res = await request(app).get('/api/logs/tabla/socios');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener logs por tabla' });

    db.falla = { sql: 'SELECT COUNT(*) FROM logs_sistema' };
    res = await request(app).get('/api/logs/estadisticas');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener estadísticas de logs' });
  });
});
