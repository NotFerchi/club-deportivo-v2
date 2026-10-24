'use strict';

/**
 * E2.10: auditoría de crear, editar, cancelar y eliminar torneo en logs_sistema, y
 * GET /api/torneos/:torneo_id/bitacora. Un fallo del log nunca cambia la respuesta.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 7, rol: 'coordinador' };
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
const INSERT_LOG = 'INSERT INTO logs_sistema';

let db;
let log;
let warn;

function route(q) {
  if (db.falla && q.startsWith(db.falla)) throw new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith(INSERT_LOG)) return rows([]);
  if (q.startsWith('SELECT disciplina_id FROM disciplinas')) return rows([{ disciplina_id: 2 }]);
  if (q.startsWith('SELECT categoria_id, activo FROM categorias_torneo')) return rows([{ categoria_id: 1, activo: true }]);
  if (q.startsWith('INSERT INTO torneos')) return rows([{ torneo_id: 45 }]);
  if (q.startsWith('SELECT estado, disciplina_id, tipo_torneo, categoria_id,')) return rows([db.actual]);
  if (q.startsWith('UPDATE torneos')) return rows([]);
  if (q === 'SELECT estado FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE') return rows(db.lock);
  if (q === 'SELECT estado, nombre FROM torneos WHERE torneo_id = $1 AND activo FOR UPDATE')
    return rows(db.lock.map((t) => ({ nombre: 'Copa Otoño', ...t })));
  if (q.startsWith('SELECT EXISTS')) return rows([{ tiene_participantes: true, tiene_encuentros: false }]);
  if (q.startsWith('SELECT l.log_id')) return rows(db.bitacora);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  db = {
    falla: null,
    lock: [{ estado: 'Abierto' }],
    actual: {
      estado: 'Abierto',
      disciplina_id: 2,
      tipo_torneo: 'Individual',
      categoria_id: 1,
      fecha_inicio_inscripcion: null,
      fecha_fin_inscripcion: null,
      nombre: 'Copa Otoño',
      fecha_inicio: '2026-11-07',
      fecha_fin: '2026-11-15'
    },
    bitacora: []
  };
  ({ log } = recordQueries(pool, route));
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const auditoria = () => log.filter(([, sql]) => sql.startsWith(INSERT_LOG)).map(([, , params]) => params);
const nuevo = { nombre: ' Copa Otoño ', disciplina_id: 2, categoria_id: 1, fecha_inicio: '2027-11-07' };

describe('auditoría de torneos', () => {
  it('crear → crear_torneo con el nombre recortado', async () => {
    const res = await request(app).post('/api/torneos').send(nuevo);
    expect(res.status).toBe(201);
    expect(auditoria()).toEqual([[7, 'crear_torneo', 'torneos', 'Torneo creado: Copa Otoño', expect.any(String), 45]]);
  });

  it('si el INSERT del log falla, la operación responde igual (201) y solo se avisa', async () => {
    db.falla = INSERT_LOG;
    const res = await request(app).post('/api/torneos').send(nuevo);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ torneo_id: 45 });
    expect(warn).toHaveBeenCalledWith('No se pudo guardar auditoria:', 'boom');
  });

  it('editar → actualizar_torneo con solo los campos que cambiaron (antes → después)', async () => {
    const res = await request(app)
      .put('/api/torneos/45')
      .send({ nombre: 'Copa Invierno', disciplina_id: 2, categoria_id: 1, fecha_inicio: '2026-11-07', fecha_fin: '2026-11-20' });
    expect(res.status).toBe(200);
    const [[, accion, tabla, detalles, , registro]] = auditoria();
    expect([accion, tabla, registro]).toEqual(['actualizar_torneo', 'torneos', 45]);
    expect(JSON.parse(detalles)).toEqual({
      nombre: { antes: 'Copa Otoño', despues: 'Copa Invierno' },
      fecha_fin: { antes: '2026-11-15', despues: '2026-11-20' }
    });
  });

  it('editar sin cambios → registra {} ', async () => {
    await request(app)
      .put('/api/torneos/45')
      .send({ nombre: 'Copa Otoño', disciplina_id: 2, categoria_id: 1, fecha_inicio: '2026-11-07', fecha_fin: '2026-11-15' });
    expect(auditoria()[0][3]).toBe('{}');
  });

  it('cancelar → cancelar_torneo con el estado anterior', async () => {
    db.lock = [{ estado: 'Inscripciones_cerradas' }];
    const res = await request(app).patch('/api/torneos/45/cancelar');
    expect(res.status).toBe(200);
    expect(auditoria()).toEqual([
      [7, 'cancelar_torneo', 'torneos', 'Cancelado desde Inscripciones_cerradas', expect.any(String), 45]
    ]);
  });

  it('eliminar → eliminar_torneo con el tipo de borrado y el nombre', async () => {
    const res = await request(app).delete('/api/torneos/45');
    expect(res.status).toBe(200);
    expect(res.body.borrado).toBe('logico');
    expect(auditoria()).toEqual([
      [7, 'eliminar_torneo', 'torneos', 'Torneo eliminado (logico): Copa Otoño', expect.any(String), 45]
    ]);
  });

  it('una operación que falla no deja registro', async () => {
    db.lock = [{ estado: 'En_curso' }];
    expect((await request(app).delete('/api/torneos/45')).status).toBe(409);
    db.lock = [{ estado: 'Finalizado' }];
    expect((await request(app).patch('/api/torneos/45/cancelar')).status).toBe(409);
    expect((await request(app).post('/api/torneos').send({})).status).toBe(400);
    expect(auditoria()).toEqual([]);
  });
});

describe('GET /api/torneos/:torneo_id/bitacora', () => {
  it('devuelve las acciones del torneo, de la más reciente a la más antigua', async () => {
    db.bitacora = [
      {
        log_id: 3,
        usuario_id: 7,
        usuario_nombre: 'Ana López',
        accion: 'cancelar_torneo',
        detalles: 'Cancelado desde Abierto',
        fecha_local: '2026-10-18T10:00:00'
      }
    ];
    const res = await request(app).get('/api/torneos/45/bitacora');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.bitacora);
    const [, sql, params] = log[0];
    expect(sql).toContain('WHERE l.tabla_afectada = $1 AND l.registro_id = $2 ORDER BY l.fecha DESC, l.log_id DESC LIMIT 200');
    expect(params).toEqual(['torneos', 45]);
  });

  it('sin registros → []; id inválido → 400; error de BD → 500', async () => {
    expect((await request(app).get('/api/torneos/45/bitacora')).body).toEqual([]);
    let res = await request(app).get('/api/torneos/abc/bitacora');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'torneo_id debe ser un entero válido' });
    db.falla = 'SELECT l.log_id';
    res = await request(app).get('/api/torneos/45/bitacora');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener la bitácora' });
  });
});
