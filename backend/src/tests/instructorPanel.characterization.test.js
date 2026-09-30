'use strict';

/**
 * Tests de caracterización de /api/instructor (instructorController: panel del instructor).
 * Además de status + cuerpo, cada test compara con un snapshot la secuencia
 * exacta de consultas y parámetros.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/mexicoDate', () => ({
  ...jest.requireActual('../utils/mexicoDate'),
  getMexicoDateISO: () => '2026-09-27'
}));

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
app.use('/api/instructor', require('../routes/instructor.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const ERROR_HANDLER = { ok: false, error: 'Error interno del servidor' };

let db;
let log;
let consoleSpies;

function route(q) {
  if (db.falla && q.includes(db.falla)) throw new Error(`boom ${db.falla}`);
  if (q.startsWith('INSERT INTO logs_sistema')) {
    if (db.logFalla) throw new Error('log down');
    return rows([]);
  }
  if (q.startsWith('SELECT i.instructor_id FROM instructores')) return rows(db.instructor);
  if (q.includes('WHERE sp.instructor_id = $2 AND sp.dia_semana = $3')) return rows(db.clases);
  if (q.startsWith('WITH participantes AS')) return rows(db.alumnos);
  if (q.startsWith('SELECT asistencia_id FROM asistencia')) return rows(db.asistenciaExistente);
  if (q.startsWith('UPDATE asistencia') || q.startsWith('INSERT INTO asistencia')) return rows([]);
  if (q.includes('END as dias')) return rows(db.misClases);
  if (q.includes('as promedio FROM asistencia')) return rows(db.promedio);
  if (q.includes('COUNT(DISTINCT r.reserva_id) as total')) return rows(db.convocatoria);
  if (q.includes('as porcentaje')) return rows(db.asistenciaMensual);
  if (q.includes('WHERE sp.instructor_id = $1 AND sp.dia_semana = $2')) return rows(db.sesionesHoy);
  if (q.includes('COUNT(DISTINCT r.socio_id) as total')) return rows(db.totalAlumnos);
  if (q.includes("'Sin instructor') as instructor")) return rows(db.clasesGeneral);
  if (q.startsWith('WITH inscritos AS')) return rows(db.inscritos);
  if (q.includes('as total_participantes')) return rows(db.torneos);
  if (q.startsWith('SELECT * FROM encuentros_torneo')) return rows(db.encuentros);
  if (q.startsWith('SELECT reserva_id FROM reservaciones')) return rows(db.yaInscrito);
  if (q.startsWith('SELECT sancion_id FROM sanciones')) return rows(db.sancion);
  if (q.startsWith('SELECT sp.cupo_maximo, sp.hora_inicio')) return rows(db.sesion);
  if (q.startsWith('INSERT INTO reservaciones')) return rows([{ reserva_id: 77 }]);
  if (q.startsWith('UPDATE encuentros_torneo SET ganador')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 5, rol: 'instructor' };
  db = {
    falla: null,
    logFalla: false,
    instructor: [{ instructor_id: 9 }],
    clases: [{ sesion_id: 1 }],
    alumnos: [{ socio_id: 10 }],
    asistenciaExistente: [],
    misClases: [{ sesion_id: 2 }],
    promedio: [{ promedio: '87.5' }],
    convocatoria: [
      { mes: 'Aug', total: '4' },
      { mes: 'Sep', total: '6' }
    ],
    asistenciaMensual: [{ mes: 'Sep', porcentaje: '90.0' }],
    sesionesHoy: [{ total: '3' }],
    totalAlumnos: [{ total: '12' }],
    clasesGeneral: [{ sesion_id: 3 }],
    inscritos: [{ inscripcion_id: '1' }],
    torneos: [{ torneo_id: 1 }],
    encuentros: [{ encuentro_id: 1 }],
    yaInscrito: [],
    sancion: [],
    sesion: [{ cupo_maximo: 10, hora_inicio: '08:00', hora_fin: '09:00', inscritos: '3' }]
  };
  ({ log } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const ultimoError = () => consoleSpies[1].mock.calls.at(-1)?.[0];

// ── Clases ───────────────────────────────────────────────────────────────────

describe('GET /clases', () => {
  it('por fecha (día calculado: domingo → 7, lunes → 1)', async () => {
    let res = await request(app).get('/api/instructor/clases').query({ fecha: '2026-09-27' });
    expect(res.body).toEqual(db.clases);
    await request(app).get('/api/instructor/clases').query({ fecha: '2026-09-28' });
    await request(app).get('/api/instructor/clases').query({ fecha: 'abc' });
    expect(log).toMatchSnapshot();

    res = await request(app).get('/api/instructor/clases');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La fecha es requerida' });
  });

  it('instructor no encontrado y error con detalle', async () => {
    db.instructor = [];
    let res = await request(app).get('/api/instructor/clases').query({ fecha: '2026-09-27' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Instructor no encontrado' });

    db.instructor = [{ instructor_id: 9 }];
    db.falla = 'sp.dia_semana = $3';
    res = await request(app).get('/api/instructor/clases').query({ fecha: '2026-09-27' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener clases', detalle: 'boom sp.dia_semana = $3' });
  });
});

describe('GET /clases/:sesionId/alumnos, /sesiones/:sesionId/inscritos, /mis-clases, /clases-general', () => {
  it('lecturas', async () => {
    let res = await request(app).get('/api/instructor/clases/4/alumnos').query({ fecha: '2026-09-27' });
    expect(res.body).toEqual(db.alumnos);

    res = await request(app).get('/api/instructor/sesiones/4/inscritos').query({ fecha: '2026-09-27' });
    expect(res.body).toEqual(db.inscritos);
    await request(app).get('/api/instructor/sesiones/4/inscritos');

    res = await request(app).get('/api/instructor/mis-clases');
    expect(res.body).toEqual(db.misClases);

    res = await request(app).get('/api/instructor/clases-general').query({ fecha: '2026-09-28' });
    expect(res.body).toEqual(db.clasesGeneral);
    await request(app).get('/api/instructor/clases-general');
    expect(log).toMatchSnapshot();
  });

  it('errores', async () => {
    db.falla = 'WITH participantes';
    let res = await request(app).get('/api/instructor/clases/4/alumnos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener alumnos', detalle: 'boom WITH participantes' });

    db.falla = 'WITH inscritos';
    res = await request(app).get('/api/instructor/sesiones/4/inscritos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener inscritos' });

    db.falla = 'END as dias';
    res = await request(app).get('/api/instructor/mis-clases');
    expect(res.body).toEqual({ error: 'Error al obtener clases', detalle: 'boom END as dias' });

    db.falla = null;
    db.instructor = [];
    res = await request(app).get('/api/instructor/mis-clases');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Instructor no encontrado' });

    db.falla = "'Sin instructor'";
    res = await request(app).get('/api/instructor/clases-general');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener clases', detalle: "boom 'Sin instructor'" });
  });

  it('clases-general con fecha no string → errorHandler (cálculo fuera del try)', async () => {
    const res = await request(app).get('/api/instructor/clases-general?fecha=a&fecha=b');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── Asistencia ───────────────────────────────────────────────────────────────

describe('POST /asistencia', () => {
  it('inserta, actualiza existente, log fallido no afecta', async () => {
    const body = { sesionId: 4, socioId: 10, fecha: '2026-09-27', presente: true };
    let res = await request(app).post('/api/instructor/asistencia').set('x-forwarded-for', '10.0.0.1').send(body);
    expect(res.body).toEqual({ message: 'Asistencia registrada correctamente' });

    db.asistenciaExistente = [{ asistencia_id: 50 }];
    db.logFalla = true;
    res = await request(app)
      .post('/api/instructor/asistencia')
      .send({ ...body, presente: false });
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

  it('error con detalle y sin body', async () => {
    db.falla = 'SELECT asistencia_id';
    let res = await request(app).post('/api/instructor/asistencia').send({ sesionId: 4 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar asistencia', detalle: 'boom SELECT asistencia_id' });

    res = await request(app).post('/api/instructor/asistencia');
    expect(res.body).toEqual(ERROR_HANDLER);
    expect(ultimoError()).toBe('ERROR');
  });
});

// ── Métricas ─────────────────────────────────────────────────────────────────

describe('GET /metricas', () => {
  it('calcula métricas (hoy = domingo 2026-09-27 → día 7)', async () => {
    let res = await request(app).get('/api/instructor/metricas');
    expect(res.body).toEqual({
      asistenciaPromedio: 87.5,
      convocatoriaMensual: 6,
      sesionesHoy: 3,
      totalAlumnos: 12,
      asistenciaMensual: db.asistenciaMensual,
      convocatoriaMensualData: db.convocatoria
    });
    expect(log).toMatchSnapshot();

    db.promedio = [];
    db.convocatoria = [];
    db.sesionesHoy = [{ total: null }];
    db.totalAlumnos = [];
    res = await request(app).get('/api/instructor/metricas');
    expect(res.body).toMatchObject({ asistenciaPromedio: 0, convocatoriaMensual: 0, sesionesHoy: 0, totalAlumnos: 0 });
  });

  it('404 y error', async () => {
    db.instructor = [];
    let res = await request(app).get('/api/instructor/metricas');
    expect(res.status).toBe(404);

    db.instructor = [{ instructor_id: 9 }];
    db.falla = 'as porcentaje';
    res = await request(app).get('/api/instructor/metricas');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener métricas', detalle: 'boom as porcentaje' });
  });
});

// ── Inscripción ──────────────────────────────────────────────────────────────

describe('POST /clases/inscribir', () => {
  const inscribir = (body) => request(app).post('/api/instructor/clases/inscribir').send(body);

  it('inscribe socio y visita', async () => {
    let res = await inscribir({ sesion_id: 4, socio_id: 10, fecha: '2026-09-27' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, reserva_id: 77 });

    res = await inscribir({ sesion_id: 4, visita_id: 20, fecha: '2026-09-27' });
    expect(res.status).toBe(201);
    expect(log).toMatchSnapshot();
  });

  it.each([
    [{ socio_id: 10, fecha: '2026-09-27' }],
    [{ sesion_id: 4, fecha: '2026-09-27' }],
    [{ sesion_id: 4, socio_id: 10 }]
  ])('validación %j → 400', async (body) => {
    const res = await inscribir(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'sesion_id, (socio_id o visita_id) y fecha son requeridos' });
  });

  it('ya inscrito, sancionado, sin sesión, sin cupo, error y sin body', async () => {
    const body = { sesion_id: 4, socio_id: 10, fecha: '2026-09-27' };
    db.yaInscrito = [{ reserva_id: 1 }];
    let res = await inscribir(body);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'El socio ya está inscrito en esta clase' });

    db.yaInscrito = [];
    db.sancion = [{ sancion_id: 3 }];
    res = await inscribir(body);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'El socio tiene una sanción activa y no puede inscribirse' });

    db.sancion = [];
    db.sesion = [];
    res = await inscribir(body);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sesión no encontrada' });

    db.sesion = [{ cupo_maximo: 3, hora_inicio: '08:00', hora_fin: '09:00', inscritos: '3' }];
    res = await inscribir(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No hay cupo disponible en esta clase' });
    expect(log).toMatchSnapshot();

    db.falla = 'INSERT INTO reservaciones';
    db.sesion = [{ cupo_maximo: 10, hora_inicio: '08:00', hora_fin: '09:00', inscritos: '3' }];
    res = await inscribir(body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al inscribir socio', detalle: 'boom INSERT INTO reservaciones' });

    res = await request(app).post('/api/instructor/clases/inscribir');
    expect(res.body).toEqual(ERROR_HANDLER);
  });
});

// ── Torneos ──────────────────────────────────────────────────────────────────

describe('torneos del panel', () => {
  it('lista torneos, encuentros y registra ganador', async () => {
    let res = await request(app).get('/api/instructor/torneos');
    expect(res.body).toEqual(db.torneos);

    res = await request(app).get('/api/instructor/torneos/1/encuentros');
    expect(res.body).toEqual(db.encuentros);

    res = await request(app).put('/api/instructor/torneos/encuentro/3').send({ ganador: 'Ana' });
    expect(res.body).toEqual({ message: 'Ganador registrado correctamente' });
    expect(log).toMatchSnapshot();
  });

  it('errores con detalle (sin registrar en consola) y sin body', async () => {
    db.falla = 'total_participantes';
    let res = await request(app).get('/api/instructor/torneos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener torneos', detalle: 'boom total_participantes' });

    db.falla = 'SELECT * FROM encuentros_torneo';
    res = await request(app).get('/api/instructor/torneos/1/encuentros');
    expect(res.body).toEqual({ error: 'Error al obtener encuentros', detalle: 'boom SELECT * FROM encuentros_torneo' });

    db.falla = 'SET ganador';
    res = await request(app).put('/api/instructor/torneos/encuentro/3').send({ ganador: 'Ana' });
    expect(res.body).toEqual({ error: 'Error al registrar ganador', detalle: 'boom SET ganador' });
    expect(consoleSpies[1]).not.toHaveBeenCalled();

    res = await request(app).put('/api/instructor/torneos/encuentro/3');
    expect(res.body).toEqual(ERROR_HANDLER);
  });
});
