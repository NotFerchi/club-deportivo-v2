'use strict';

/**
 * Tests de caracterización de /api/instructores (instructoresController).
 * Vía router real + errorHandler; la BD se simula enrutando por texto SQL.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
// Autenticación simulada: estos tests caracterizan la lógica, no el control de acceso.
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => next(),
  checkRole: () => (req, res, next) => next()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const instructoresRoutes = require('../routes/instructores.routes');

const app = express();
app.use(express.json());
app.use('/api/instructores', instructoresRoutes);
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();

let db;
let client;
let consoleSpies;

function routeQuery(sql) {
  const q = norm(sql);
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.includes('FROM instructores i') && q.includes('ORDER BY nombre')) return rows(db.lista);
  if (q.includes('FROM instructores i') && q.includes('WHERE i.instructor_id = $1')) return rows(db.detalle);
  if (q.includes('SELECT usuario_id FROM usuarios WHERE username = $1')) return rows(db.usuarioExiste);
  if (q.includes("FROM roles WHERE nombre = 'instructor'")) return rows(db.rol);
  if (q.includes('INSERT INTO usuarios')) return rows([{ usuario_id: 70 }]);
  if (q.includes('INSERT INTO instructores')) return rows([{ instructor_id: 80 }]);
  if (q.includes('UPDATE instructores SET')) return rows([]);
  if (q.includes('DELETE FROM instructores')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

const findCall = (mockFn, fragment) => mockFn.mock.calls.find(([sql]) => norm(sql).includes(fragment));

beforeEach(() => {
  db = {
    lista: [{ instructor_id: 1, nombre: 'Ana López' }],
    detalle: [{ instructor_id: 1, nombre: 'Ana López' }],
    usuarioExiste: [],
    rol: [{ rol_id: 4 }]
  };
  pool.query.mockImplementation(async (sql) => routeQuery(sql));
  client = { query: jest.fn(async (sql) => routeQuery(sql)), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

describe('lecturas', () => {
  it('GET / → lista (filtra sin nombre ni especialidad); error → 500', async () => {
    let res = await request(app).get('/api/instructores');
    expect(res.body).toEqual(db.lista);
    const sql = norm(findCall(pool.query, 'ORDER BY nombre')[0]);
    expect(sql).toContain("'Instructor sin nombre'");
    expect(sql).toContain('WHERE (u.nombres IS NOT NULL OR i.especialidad IS NOT NULL)');

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/instructores');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener instructores' });
  });

  it('GET /:id → instructor; 404; error → 500', async () => {
    let res = await request(app).get('/api/instructores/1');
    expect(res.body).toEqual(db.detalle[0]);
    expect(norm(findCall(pool.query, 'WHERE i.instructor_id')[0])).toContain("'Información pendiente'");

    db.detalle = [];
    res = await request(app).get('/api/instructores/1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Instructor no encontrado' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/instructores/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener instructor' });
  });
});

describe('POST / (crear)', () => {
  const post = (body) => request(app).post('/api/instructores').send(body);

  it('sin email → solo instructor, usuario_id null y especialidad vacía → null', async () => {
    const res = await post({ nombre: 'Ana', especialidad: '' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Instructor creado', instructor_id: 80 });
    expect(findCall(client.query, 'INSERT INTO instructores')[1]).toEqual([null, null]);
    expect(findCall(client.query, 'FROM usuarios')).toBeUndefined();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('email de usuario existente → reutiliza su usuario_id', async () => {
    db.usuarioExiste = [{ usuario_id: 33 }];
    const res = await post({ nombre: 'Ana', especialidad: 'Yoga', email: 'ana@club.mx' });

    expect(res.status).toBe(201);
    expect(findCall(client.query, 'INSERT INTO usuarios')).toBeUndefined();
    expect(findCall(client.query, 'INSERT INTO instructores')[1]).toEqual(['Yoga', 33]);
  });

  it('email nuevo → crea usuario con rol instructor y contraseña por defecto', async () => {
    const res = await post({ nombre: 'Ana', especialidad: 'Yoga', email: 'ana@club.mx' });

    expect(res.status).toBe(201);
    const [sql, params] = findCall(client.query, 'INSERT INTO usuarios');
    expect(norm(sql)).toContain("crypt($3, gen_salt('bf'))");
    expect(params).toEqual(['ana@club.mx', 'Ana', 'instructor123', 4]);
    expect(findCall(client.query, 'INSERT INTO instructores')[1]).toEqual(['Yoga', 70]);
  });

  it('sin rol instructor en la BD → 500 y ROLLBACK', async () => {
    db.rol = [];
    const res = await post({ nombre: 'Ana', email: 'ana@club.mx' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear instructor' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('error al insertar → 500 y ROLLBACK', async () => {
    client.query.mockImplementation(async (sql) => {
      if (norm(sql).includes('INSERT INTO instructores')) throw new Error('boom');
      return routeQuery(sql);
    });
    const res = await post({ nombre: 'Ana' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear instructor' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('falla la conexión → responde el errorHandler global', async () => {
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    const res = await post({ nombre: 'Ana' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });

  it('sin body → responde el errorHandler global sin conectar', async () => {
    const res = await request(app).post('/api/instructores');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe('PUT /:id (actualizar)', () => {
  it('actualiza especialidad y activo tal cual', async () => {
    const res = await request(app).put('/api/instructores/3').send({ especialidad: '', activo: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Instructor actualizado correctamente' });
    expect(findCall(pool.query, 'UPDATE instructores SET')[1]).toEqual([null, false, '3']);
  });

  it('activo no enviado → undefined', async () => {
    await request(app).put('/api/instructores/3').send({ especialidad: 'Yoga' });
    expect(findCall(pool.query, 'UPDATE instructores SET')[1]).toEqual(['Yoga', undefined, '3']);
  });

  it('error → 500; sin body → errorHandler global', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    let res = await request(app).put('/api/instructores/3').send({ especialidad: 'Yoga' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar instructor' });

    res = await request(app).put('/api/instructores/3');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

describe('DELETE /:id', () => {
  it('elimina; error → 500', async () => {
    let res = await request(app).delete('/api/instructores/3');
    expect(res.body).toEqual({ message: 'Instructor eliminado correctamente' });
    expect(findCall(pool.query, 'DELETE FROM instructores')[1]).toEqual(['3']);

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).delete('/api/instructores/3');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar instructor' });
  });
});
