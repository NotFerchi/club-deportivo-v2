'use strict';

/**
 * E2.6: administrar categorías de torneo (crear, listar, renombrar y desactivar)
 * y que una categoría desactivada no se asigne a torneos.
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

let db;
let log;

function route(q, params) {
  if (db.falla && q.startsWith(db.falla)) throw new Error('boom');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT categoria_id, nombre, activo FROM categorias_torneo WHERE categoria_id = $1 FOR UPDATE'))
    return rows(db.categoria);
  if (q.startsWith('SELECT categoria_id, nombre, activo FROM categorias_torneo')) return rows(db.categorias);
  if (q.startsWith('LOCK TABLE categorias_torneo')) return rows([]);
  if (q.startsWith('SELECT 1 FROM categorias_torneo WHERE activo')) return rows(db.duplicada);
  if (q.startsWith('INSERT INTO categorias_torneo'))
    return rows([{ categoria_id: 9, nombre: params[0] }]);
  if (q.startsWith('UPDATE categorias_torneo')) return rows([]);
  if (q.startsWith('SELECT COUNT(*)::int AS total FROM torneos')) return rows([{ total: db.enUso }]);
  // alta/edición de torneo
  if (q.startsWith('SELECT disciplina_id FROM disciplinas')) return rows([{ disciplina_id: 2 }]);
  if (q.startsWith('SELECT categoria_id, activo FROM categorias_torneo')) return rows(db.refCategoria);
  if (q.startsWith('INSERT INTO torneos')) return rows([{ torneo_id: 9 }]);
  if (q.startsWith('SELECT estado, disciplina_id, tipo_torneo, categoria_id,')) return rows(db.torneoEditable);
  if (q.startsWith('UPDATE torneos SET disciplina_id')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 1, rol: 'admin' };
  db = {
    categorias: [
      { categoria_id: 1, nombre: 'Adulto', activo: true },
      { categoria_id: 4, nombre: 'Infantil', activo: false }
    ],
    categoria: [{ categoria_id: 9, nombre: 'Juvenil', activo: true }],
    duplicada: [],
    enUso: 0,
    refCategoria: [{ categoria_id: 4, activo: false }],
    torneoEditable: [
      {
        estado: 'Abierto',
        disciplina_id: 2,
        tipo_torneo: 'Individual',
        categoria_id: 4,
        fecha_inicio_inscripcion: null,
        fecha_fin_inscripcion: null
      }
    ],
    falla: null
  };
  ({ log } = recordQueries(pool, route));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const sqls = () => log.map(([, sql]) => sql);

describe('GET /api/torneos/categorias', () => {
  it('lista todas, con su campo activo', async () => {
    const res = await request(app).get('/api/torneos/categorias');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.categorias);
    expect(sqls()[0]).toBe('SELECT categoria_id, nombre, activo FROM categorias_torneo ORDER BY nombre');
  });

  it('?activas=true filtra las inactivas en SQL', async () => {
    await request(app).get('/api/torneos/categorias?activas=true');
    expect(sqls()[0]).toBe('SELECT categoria_id, nombre, activo FROM categorias_torneo WHERE activo ORDER BY nombre');
  });

  it('?activas con otro valor → 400', async () => {
    const res = await request(app).get('/api/torneos/categorias?activas=si');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'activas debe ser true o false' });
  });
});

describe('POST /api/torneos/categorias', () => {
  const crear = (body) => request(app).post('/api/torneos/categorias').send(body);

  it('crea con el nombre sin espacios en los extremos → 201', async () => {
    const res = await crear({ nombre: '  Juvenil femenil ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ categoria_id: 9, nombre: 'Juvenil femenil' });
    // la búsqueda de duplicados usa el nombre normalizado
    const dup = log.find(([, sql]) => sql.startsWith('SELECT 1 FROM categorias_torneo'));
    expect(dup[2]).toEqual(['juvenil femenil', null]);
    expect(sqls()).toEqual([
      'BEGIN',
      'LOCK TABLE categorias_torneo IN SHARE ROW EXCLUSIVE MODE',
      expect.stringContaining('SELECT 1 FROM categorias_torneo WHERE activo'),
      'INSERT INTO categorias_torneo (nombre) VALUES ($1) RETURNING categoria_id, nombre',
      'COMMIT'
    ]);
  });

  it.each([[{}], [{ nombre: '   ' }], [{ nombre: 5 }]])('sin nombre %j → 400', async (body) => {
    const res = await crear(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El nombre es requerido' });
    expect(log).toEqual([]);
  });

  it('más de 50 caracteres → 400', async () => {
    const res = await crear({ nombre: 'x'.repeat(51) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Máximo 50 caracteres' });
  });

  it('nombre repetido (normalizado) → 409 sin INSERT', async () => {
    db.duplicada = [{ '?column?': 1 }];
    const res = await crear({ nombre: 'ADULTO' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Ya existe una categoría con ese nombre' });
    expect(sqls()).not.toContainEqual(expect.stringContaining('INSERT'));
    expect(sqls()).toContain('ROLLBACK');
  });

  it('error de BD → 500 con mensaje genérico', async () => {
    db.falla = 'INSERT INTO categorias_torneo';
    const res = await crear({ nombre: 'Senior' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear categoría' });
  });
});

describe('PUT /api/torneos/categorias/:categoria_id', () => {
  const renombrar = (id, body) => request(app).put(`/api/torneos/categorias/${id}`).send(body);

  it('renombra excluyendo a la propia del chequeo de duplicados → 200', async () => {
    const res = await renombrar(9, { nombre: 'Juvenil Femenil' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      categoria_id: 9,
      nombre: 'Juvenil Femenil',
      message: 'Categoría actualizada correctamente'
    });
    const dup = log.find(([, sql]) => sql.startsWith('SELECT 1 FROM categorias_torneo'));
    expect(dup[2]).toEqual(['juvenil femenil', 9]);
    expect(log.find(([, sql]) => sql.startsWith('UPDATE categorias_torneo'))[2]).toEqual(['Juvenil Femenil', 9]);
  });

  it('id inválido → 400', async () => {
    const res = await renombrar('abc', { nombre: 'X' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'categoria_id debe ser un entero valido' });
  });

  it('no existe → 404', async () => {
    db.categoria = [];
    const res = await renombrar(99, { nombre: 'X' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Categoría no encontrada' });
  });

  it('desactivada → 409', async () => {
    db.categoria = [{ categoria_id: 4, nombre: 'Infantil', activo: false }];
    const res = await renombrar(4, { nombre: 'Infantil A' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'La categoría está desactivada' });
  });

  it('nombre de otra categoría activa → 409', async () => {
    db.duplicada = [{ '?column?': 1 }];
    const res = await renombrar(9, { nombre: 'Adulto' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Ya existe una categoría con ese nombre' });
  });
});

describe('PATCH /api/torneos/categorias/:categoria_id/desactivar', () => {
  const desactivar = (id = 9) => request(app).patch(`/api/torneos/categorias/${id}/desactivar`);

  it('sin torneos activos → activo = FALSE', async () => {
    const res = await desactivar();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Categoría desactivada correctamente' });
    const conteo = log.find(([, sql]) => sql.startsWith('SELECT COUNT(*)::int AS total FROM torneos'));
    expect(conteo[1]).toContain('categoria_id = $1 AND activo AND estado <> ALL($2::text[])');
    expect(conteo[2]).toEqual([9, ['Finalizado', 'Cancelado']]);
    expect(sqls()).toContain('UPDATE categorias_torneo SET activo = FALSE WHERE categoria_id = $1');
  });

  it.each([
    [1, 'No se puede desactivar: la categoría está en uso por 1 torneo activo'],
    [3, 'No se puede desactivar: la categoría está en uso por 3 torneos activos']
  ])('con %i torneo(s) activo(s) → 409 sin UPDATE', async (enUso, error) => {
    db.enUso = enUso;
    const res = await desactivar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error });
    expect(sqls()).not.toContainEqual(expect.stringContaining('UPDATE categorias_torneo'));
  });

  it('ya desactivada → 409', async () => {
    db.categoria = [{ categoria_id: 9, nombre: 'Juvenil', activo: false }];
    const res = await desactivar();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'La categoría ya está desactivada' });
  });

  it('no existe → 404; id inválido → 400', async () => {
    db.categoria = [];
    expect((await desactivar(99)).status).toBe(404);
    const res = await desactivar('0');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'categoria_id debe ser un entero valido' });
  });
});

describe('torneos con categoría desactivada', () => {
  const body = { nombre: 'Copa', disciplina_id: 2, categoria_id: 4 };

  it('crear un torneo con ella → 400 sin INSERT', async () => {
    const res = await request(app).post('/api/torneos').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría está desactivada' });
    expect(sqls()).not.toContainEqual(expect.stringContaining('INSERT INTO torneos'));
  });

  it('editar un torneo que ya la tenía sin cambiarla → 200', async () => {
    const res = await request(app).put('/api/torneos/5').send(body);
    expect(res.status).toBe(200);
  });

  it('cambiar un torneo a ella → 400', async () => {
    db.torneoEditable[0].categoria_id = null;
    const res = await request(app).put('/api/torneos/5').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'La categoría está desactivada' });
  });
});
