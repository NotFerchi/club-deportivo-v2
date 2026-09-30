'use strict';

/**
 * Tests de caracterización de /api/sanciones y GET /api/socios/:id/sanciones
 * (sancionesController). Además de status + cuerpo, cada test compara con un
 * snapshot la secuencia exacta de consultas y parámetros (SQL dinámico según
 * columnas de la tabla y filtros).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/mexicoDate', () => ({
  getMexicoDateISO: () => '2026-09-30',
  getMexicoTimeISO: () => '08:00'
}));

// Esquema de la tabla sanciones y usuario autenticado, configurables por test.
let mockColumns;
let mockUser;
jest.mock('../utils/adminRules', () => ({
  ...jest.requireActual('../utils/adminRules'),
  getTableColumns: jest.fn(async () => mockColumns)
}));
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
app.use('/api/sanciones', require('../routes/sanciones.routes'));
app.use('/api/socios', require('../routes/socio.routes'));
app.use(require('../middleware/errorHandler'));

const SCHEMA = {
  completo: new Set([
    'sancion_id',
    'socio_id',
    'motivo',
    'origen',
    'estado',
    'fecha',
    'gravedad',
    'fecha_inicio',
    'fecha_fin',
    'fecha_resolucion',
    'resuelto_por'
  ]),
  soloFecha: new Set(['sancion_id', 'socio_id', 'motivo', 'origen', 'estado', 'fecha']),
  minimo: new Set(['sancion_id', 'socio_id', 'motivo', 'origen', 'estado'])
};

const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let log;
let client;
let consoleSpies;

function route(q) {
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT 1 FROM socios WHERE socio_id = $1 AND usuario_id = $2'))
    return rows(db.esPropio ? [{ '?column?': 1 }] : []);
  if (q.includes('as graves FROM sanciones s WHERE s.socio_id = $1')) return rows(db.historial);
  if (q.startsWith('SELECT COUNT(*)::int as total FROM sanciones s JOIN socios')) return rows(db.total);
  if (q.startsWith('SELECT COUNT(*) as total FROM sanciones s WHERE s.socio_id'))
    return rows([{ total: db.activasCount }]);
  if (q.includes('as total_sanciones_activas')) return rows(db.totales);
  if (q.startsWith('SELECT r.reserva_id, r.socio_id FROM reservaciones r')) return rows(db.noShows);
  if (q.startsWith('SELECT * FROM sanciones WHERE sancion_id = $1')) return rows(db.sancion);
  if (q.startsWith('INSERT INTO sanciones')) {
    if (db.insertFalla) throw new Error('boom');
    return rows([{ sancion_id: 77 }]);
  }
  if (q.startsWith("UPDATE sanciones SET estado = 'Inactivo'")) return rows([]);
  if (q.startsWith('UPDATE sanciones SET')) return rows(db.actualizada);
  if (q.startsWith('DELETE FROM sanciones')) return rows(db.eliminada);
  if (q.includes('FROM sanciones s JOIN socios soc')) return rows(db.lista);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockColumns = SCHEMA.completo;
  mockUser = { usuario_id: 1, rol: 'admin' };
  db = {
    esPropio: true,
    historial: [{ total: 0, activas: 0, graves: 0 }],
    total: [{ total: 45 }],
    activasCount: '0',
    totales: [{ total_sanciones_activas: 1, total_sanciones_historico: 3 }],
    noShows: [],
    sancion: [{ sancion_id: 5, estado: 'Activa' }],
    actualizada: [{ sancion_id: 5 }],
    eliminada: [{ sancion_id: 5 }],
    lista: [{ sancion_id: 5, socio_id: 10, gravedad: 'Leve' }],
    insertFalla: false
  };
  ({ log, client } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// ── GET / (listado paginado) ─────────────────────────────────────────────────

describe('GET /api/sanciones', () => {
  it('sin filtros → página 1, límite 20', async () => {
    const res = await request(app).get('/api/sanciones');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: db.lista,
      sanciones: db.lista,
      pagination: { page: 1, limit: 20, total: 45, total_pages: 3 }
    });
    expect(log).toMatchSnapshot();
  });

  it('todos los filtros, límites de paginación y esquema mínimo', async () => {
    mockColumns = SCHEMA.minimo;
    const res = await request(app).get('/api/sanciones').query({
      page: '0',
      limit: '500',
      origen: ' Conducta ',
      estado: 'Activa',
      socio_id: '10',
      socio: ' Ana ',
      gravedad: 'grave',
      fecha_desde: '2026-01-01',
      fecha_hasta: '2026-12-31'
    });

    expect(res.body.pagination).toEqual({ page: 1, limit: 100, total: 45, total_pages: 1 });
    expect(log).toMatchSnapshot();
  });

  it.each([['inactivo'], ['Suspendida']])('estado=%s', async (estado) => {
    mockColumns = SCHEMA.soloFecha;
    await request(app).get('/api/sanciones').query({ estado, page: '3', limit: '10' });
    expect(log).toMatchSnapshot();
  });

  it('sin filas de conteo → total 0', async () => {
    db.total = [];
    const res = await request(app).get('/api/sanciones');
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 0, total_pages: 0 });
  });

  it('socio_id inválido → 400 con mensaje; error de BD → 500', async () => {
    let res = await request(app).get('/api/sanciones').query({ socio_id: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'socio_id debe ser un entero valido' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/sanciones');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener sanciones' });
  });
});

// ── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /api/sanciones/:id', () => {
  it.each([['completo'], ['minimo']])('esquema %s → sanción', async (schema) => {
    mockColumns = SCHEMA[schema];
    const res = await request(app).get('/api/sanciones/5');
    expect(res.body).toEqual(db.lista[0]);
    expect(log).toMatchSnapshot();
  });

  it('404 y error → 500', async () => {
    db.lista = [];
    let res = await request(app).get('/api/sanciones/5');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sancion no encontrada' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/sanciones/5');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener sancion' });
  });
});

// ── Consultas por socio (permisos) ───────────────────────────────────────────

describe.each([
  ['GET /socio/:id', (id) => `/api/sanciones/socio/${id}`, 'Error al obtener sanciones'],
  ['GET /socio/:id/verificar', (id) => `/api/sanciones/socio/${id}/verificar`, 'Error al verificar sancion'],
  [
    'GET /api/socios/:id/sanciones',
    (id) => `/api/socios/${id}/sanciones`,
    'Error al obtener historial de sanciones del socio'
  ]
])('%s', (_name, url, mensajeError) => {
  it('id inválido → 400', async () => {
    for (const id of ['abc', '0', '-2', '1.5']) {
      const res = await request(app).get(url(id));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'socio_id debe ser un entero valido' });
    }
    expect(log).toEqual([]);
  });

  it('staff → consulta sin verificar dueño', async () => {
    mockUser = { usuario_id: 1, rol: 'recepcion' };
    const res = await request(app).get(url(10));
    expect(res.status).toBe(200);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('socio dueño → permitido; socio ajeno → 403; otro rol → 403', async () => {
    mockUser = { usuario_id: 9, rol: 'socio' };
    let res = await request(app).get(url(10));
    expect(res.status).toBe(200);

    db.esPropio = false;
    res = await request(app).get(url(10));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Sin permisos para consultar sanciones de este socio' });

    mockUser = { usuario_id: 9, rol: 'instructor' };
    res = await request(app).get(url(10));
    expect(res.status).toBe(403);
    expect(log).toMatchSnapshot();
  });

  it('error de BD → 500', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get(url(10));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: mensajeError });
  });
});

describe('detalles de consultas por socio', () => {
  it('verificar → tiene_sancion true si hay activas', async () => {
    db.activasCount = '2';
    const res = await request(app).get('/api/sanciones/socio/10/verificar');
    expect(res.body).toEqual({ tiene_sancion: true });
  });

  it('historial sin fila de totales → ceros', async () => {
    db.totales = [];
    const res = await request(app).get('/api/socios/10/sanciones');
    expect(res.body).toEqual({
      socio_id: 10,
      total_sanciones_activas: 0,
      total_sanciones_historico: 0,
      sanciones: db.lista
    });
  });
});

// ── POST / (crear) ───────────────────────────────────────────────────────────

describe('POST /api/sanciones', () => {
  const post = (body) => request(app).post('/api/sanciones').send(body);

  it('faltan socio o motivo → 400 sin conectar', async () => {
    for (const body of [{ motivo: 'x' }, { socio_id: 10, motivo: '  ' }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Socio y motivo son obligatorios' });
    }
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('motivo no string (.trim falla) → 500 del endpoint, no del errorHandler', async () => {
    const res = await post({ socio_id: 10, motivo: 5 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear sancion' });
    expect(consoleSpies[1].mock.calls.at(-1)[0]).toBe('Error en createSancion:');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('sin body y fallo de conexión → errorHandler global', async () => {
    let res = await request(app).post('/api/sanciones');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post({ socio_id: 10, motivo: 'x' });
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });

  it.each([
    [
      'sin historial, no-show leve → Moderada',
      { total: 0, activas: 0, graves: 0 },
      { socioId: 10, motivo: ' Faltó ', origen: 'No-show reserva', gravedad: 'leve' }
    ],
    ['con graves → Grave', { total: 1, activas: 0, graves: 1 }, { socio_id: 10, motivo: 'x', gravedad: 'leve' }],
    ['2 activas → Grave', { total: 2, activas: 2, graves: 0 }, { socio_id: 10, motivo: 'x' }],
    [
      'historial previo y leve → Moderada',
      { total: 1, activas: 0, graves: 0 },
      { socio_id: 10, motivo: 'x', gravedad: 'Leve' }
    ],
    [
      'fechas explícitas',
      { total: 0, activas: 0, graves: 0 },
      { socio_id: 10, motivo: 'x', gravedad: 'grave', fecha_inicio: '2026-10-05', fecha_fin: '2026-10-06' }
    ]
  ])('%s', async (_name, historial, body) => {
    db.historial = [historial];
    const res = await post(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it.each([['soloFecha'], ['minimo']])('esquema %s → columnas del INSERT', async (schema) => {
    mockColumns = SCHEMA[schema];
    await post({ socio_id: 10, motivo: 'x' });
    expect(log).toMatchSnapshot();
  });

  it('error al insertar → 500 y ROLLBACK', async () => {
    db.insertFalla = true;
    const res = await post({ socio_id: 10, motivo: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear sancion' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

// ── PUT /:id (actualizar) ────────────────────────────────────────────────────

describe('PUT /api/sanciones/:id', () => {
  const put = (body) => request(app).put('/api/sanciones/5').send(body);
  const todo = {
    socio_id: 11,
    motivo: 'Nuevo',
    origen: 'Conducta',
    estado: 'Resuelta',
    gravedad: 'grave',
    fecha_inicio: '2026-10-01',
    fecha_fin: '2026-10-31'
  };

  it.each([
    ['admin (puede cambiar estado), esquema completo', 'admin', 'completo'],
    ['gerente (estado ignorado)', 'gerente', 'completo'],
    ['coordinador, esquema soloFecha', 'coordinador', 'soloFecha'],
    ['admin, esquema mínimo', 'admin', 'minimo']
  ])('%s', async (_name, rol, schema) => {
    mockUser = { usuario_id: 1, rol };
    mockColumns = SCHEMA[schema];
    const res = await put(todo);
    expect(res.body).toEqual({ message: 'Sancion actualizada' });
    expect(log).toMatchSnapshot();
  });

  it('nada que actualizar → 400; 404; error → 500; sin body → errorHandler', async () => {
    mockUser = { usuario_id: 1, rol: 'gerente' };
    let res = await put({ estado: 'Resuelta', socio_id: 0 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No hay datos para actualizar' });

    db.actualizada = [];
    res = await put({ motivo: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sancion no encontrada' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await put({ motivo: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar sancion' });

    res = await request(app).put('/api/sanciones/5');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /api/sanciones/:id', () => {
  it('elimina; 404; error → 500', async () => {
    let res = await request(app).delete('/api/sanciones/5');
    expect(res.body).toEqual({ message: 'Sancion eliminada' });

    db.eliminada = [];
    res = await request(app).delete('/api/sanciones/5');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sancion no encontrada' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).delete('/api/sanciones/5');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar sancion' });
    expect(log).toMatchSnapshot();
  });
});

// ── Levantar / perdonar ──────────────────────────────────────────────────────

describe.each([['levantar'], ['perdonar']])('PUT /:id/%s', (accion) => {
  const url = `/api/sanciones/5/${accion}`;

  it.each([['completo'], ['minimo']])('esquema %s', async (schema) => {
    mockColumns = SCHEMA[schema];
    const res = await request(app).put(url);
    expect(res.body).toEqual({ message: 'Sancion levantada' });
    expect(log).toMatchSnapshot();
  });

  it('sin usuario en el token → no registra resuelto_por; 404; error', async () => {
    mockUser = undefined;
    await request(app).put(url);
    expect(log).toMatchSnapshot();

    db.actualizada = [];
    let res = await request(app).put(url);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sancion no encontrada' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).put(url);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al levantar sancion' });
  });
});

// ── PATCH /:sancion_id (resolver) ────────────────────────────────────────────

describe('PATCH /api/sanciones/:sancion_id', () => {
  const patch = (id = 5) => request(app).patch(`/api/sanciones/${id}`);

  it('resuelve y devuelve la sanción detallada', async () => {
    mockUser = { usuario_id: 3, rol: 'coordinador' };
    const res = await patch();
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.lista[0]);
    expect(log).toMatchSnapshot();
  });

  it('validaciones y errores en orden', async () => {
    let res = await patch('x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'sancion_id debe ser un entero valido' });

    mockUser = { usuario_id: 3, rol: 'gerente' };
    res = await patch();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });

    mockUser = { usuario_id: 3, rol: 'admin' };
    db.sancion = [];
    res = await patch();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Sanción no encontrada' });

    db.sancion = [{ sancion_id: 5, estado: 'Resuelta' }];
    res = await patch();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Esta sanción ya fue resuelta' });

    db.sancion = [{ sancion_id: 5, estado: 'Activa' }];
    mockColumns = SCHEMA.soloFecha;
    res = await patch();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'La tabla sanciones no tiene campos de resolución configurados' });

    mockColumns = SCHEMA.completo;
    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await patch();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al resolver sanción' });
  });

  it('detalle inexistente tras resolver → null', async () => {
    db.lista = [];
    const res = await patch();
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

// ── POST /no-shows/sincronizar ───────────────────────────────────────────────

describe('POST /api/sanciones/no-shows/sincronizar', () => {
  const sync = () => request(app).post('/api/sanciones/no-shows/sincronizar');

  it('crea una sanción por reserva no-show pendiente', async () => {
    db.noShows = [
      { reserva_id: 31, socio_id: 10 },
      { reserva_id: 32, socio_id: 12 }
    ];
    const res = await sync();
    expect(res.body).toEqual({ ok: true, creadas: 2, message: 'No-shows sincronizados. Sanciones creadas: 2' });
    expect(log).toMatchSnapshot();
  });

  it('sin pendientes → 0', async () => {
    const res = await sync();
    expect(res.body).toEqual({ ok: true, creadas: 0, message: 'No-shows sincronizados. Sanciones creadas: 0' });
  });

  it('error → 500 y ROLLBACK; fallo de conexión → errorHandler', async () => {
    db.noShows = [{ reserva_id: 31, socio_id: 10 }];
    db.insertFalla = true;
    let res = await sync();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al sincronizar no-shows' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await sync();
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});
