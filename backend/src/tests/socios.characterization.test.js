'use strict';

/**
 * Tests de caracterización de /api/socios (socioController).
 * Vía router real + errorHandler; la BD se simula enrutando por texto SQL.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/auditLogger', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
// Autenticación simulada: estos tests caracterizan la lógica, no el control de acceso.
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 1 };
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

const bcrypt = require('bcryptjs');
const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const socioRoutes = require('../routes/socio.routes');

const app = express();
app.use(express.json());
app.use('/api/socios', socioRoutes);
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();

let db;
let client;
let consoleSpies;

function routeQuery(sql) {
  const q = norm(sql);
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.includes('SELECT pg_advisory_xact_lock($1)')) return rows([]);
  if (q.includes('FROM socios s JOIN usuarios u ON s.usuario_id = u.usuario_id LEFT JOIN')) return rows(db.lista);
  if (q.includes('FROM socios s JOIN usuarios u ON s.usuario_id = u.usuario_id WHERE s.socio_id'))
    return rows(db.detalle);
  if (q.includes('WHERE (username = $1 OR curp = $2) AND usuario_id <> $3')) return rows(db.duplicadoOtro);
  if (q.includes('WHERE username = $1 OR curp = $2')) return rows(db.duplicado);
  if (q.includes('SELECT rol_id FROM roles WHERE nombre')) return rows(db.rol);
  if (q.includes('REGEXP_REPLACE(numero_socio')) return rows([{ siguiente: 12 }]);
  if (q.includes('INSERT INTO usuarios')) return rows([{ usuario_id: 50 }]);
  if (q.includes('INSERT INTO socios')) return rows([{ socio_id: 60 }]);
  if (q.includes('SELECT usuario_id FROM socios WHERE socio_id')) return rows(db.socioUsuario);
  if (q.includes('UPDATE usuarios SET nombres')) return rows([]);
  if (q.includes('UPDATE socios SET tipo')) return rows([]);
  if (q.includes('UPDATE socios SET activo')) return rows(db.cambioActivo);
  if (q.includes('UPDATE usuarios SET activo')) return rows([]);
  if (q.includes('DELETE FROM socios')) return rows([]);
  if (q.includes('DELETE FROM usuarios')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

const findCall = (mockFn, fragment) => mockFn.mock.calls.find(([sql]) => norm(sql).includes(fragment));

beforeEach(() => {
  db = {
    lista: [{ socio_id: 1, nombres: 'Ana', num_sanciones: 0 }],
    detalle: [{ socio_id: 1, nombres: 'Ana' }],
    duplicado: [],
    duplicadoOtro: [],
    rol: [{ rol_id: 5 }],
    socioUsuario: [{ usuario_id: 50 }],
    cambioActivo: [{ socio_id: 1, usuario_id: 50 }]
  };
  pool.query.mockImplementation(async (sql) => routeQuery(sql));
  client = { query: jest.fn(async (sql) => routeQuery(sql)), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const validBody = {
  nombres: 'Ana',
  apellidoPaterno: 'López',
  apellidoMaterno: 'Ruiz',
  email: 'ana@club.mx',
  telefono: '5512345678',
  curp: 'lora900101mdfpzn09',
  fechaNacimiento: '1990-01-01',
  genero: 'Femenino',
  direccion: 'Calle 1',
  password: 'clave123'
};

// ── Lecturas ─────────────────────────────────────────────────────────────────

describe('lecturas', () => {
  it('GET / → lista; error → 500 con mensaje', async () => {
    let res = await request(app).get('/api/socios');
    expect(res.body).toEqual(db.lista);

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/socios');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener socios: boom' });
  });

  it('GET /:id → socio; 404; error → 500 con mensaje', async () => {
    let res = await request(app).get('/api/socios/1');
    expect(res.body).toEqual(db.detalle[0]);
    expect(findCall(pool.query, 'WHERE s.socio_id')[1]).toEqual(['1']);

    db.detalle = [];
    res = await request(app).get('/api/socios/1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/socios/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'boom' });
  });
});

// ── createSocio ──────────────────────────────────────────────────────────────

describe('POST / (crear)', () => {
  const post = (body) => request(app).post('/api/socios').send(body);

  it('sin body → el error ocurre antes del try y responde el errorHandler global', async () => {
    const res = await request(app).post('/api/socios');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('validación → 400 con todos los errores, tras BEGIN y con ROLLBACK', async () => {
    const res = await post({ email: 'x', curp: 'BAD', telefono: '12', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Nombres es obligatorio',
      errors: [
        'Nombres es obligatorio',
        'Apellido paterno es obligatorio',
        'Email invalido',
        'La CURP debe tener 18 caracteres.',
        'Telefono debe tener 10 digitos',
        'Direccion es obligatoria',
        'Contrasena minima de 6 caracteres'
      ]
    });
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalled();
  });

  it('sin contraseña al crear → error de contraseña obligatoria', async () => {
    const res = await post({ ...validBody, password: '' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(['Contrasena es obligatoria']);
  });

  it('email o CURP ya registrados → 400 (CURP en mayúsculas)', async () => {
    db.duplicado = [{ usuario_id: 9 }];
    const res = await post(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Email o CURP ya registrado' });
    expect(findCall(client.query, 'WHERE username = $1 OR curp = $2')[1]).toEqual([
      'ana@club.mx',
      'LORA900101MDFPZN09'
    ]);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('sin rol socio en la BD → 500 con mensaje y ROLLBACK', async () => {
    db.rol = [];
    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Rol "socio" no encontrado en la base de datos' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('crea con número automático, tipo/modalidad normalizados y audit', async () => {
    const res = await post({ ...validBody, tipo: 'ACCIONISTA', modalidad: 'familiar', es_titular: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Socio creado exitosamente' });

    const [, userParams] = findCall(client.query, 'INSERT INTO usuarios');
    expect(userParams.slice(0, 10)).toEqual([
      5,
      'ana@club.mx',
      'Ana',
      'López',
      'Ruiz',
      'LORA900101MDFPZN09',
      '1990-01-01',
      'Femenino',
      '5512345678',
      'Calle 1'
    ]);
    expect(bcrypt.compareSync('clave123', userParams[10])).toBe(true);

    const [, socioParams] = findCall(client.query, 'INSERT INTO socios');
    expect(socioParams).toEqual([50, 'Accionista', 'Familiar', true, 'SOC-0012', null, null]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'crear_socio',
      tabla_afectada: 'socios',
      registro_id: 60,
      detalles: 'Socio creado con numero SOC-0012'
    });
  });

  it('con número enviado y valores por defecto (Rentista / Individual / no titular)', async () => {
    const res = await post({
      ...validBody,
      numero_socio: 'A-7',
      telefono: '',
      fechaNacimiento: '',
      genero: '',
      nombre_emergencia: 'Luis',
      tel_emergencia: '5500000000'
    });

    expect(res.status).toBe(200);
    expect(findCall(client.query, 'REGEXP_REPLACE')).toBeUndefined();
    const [, userParams] = findCall(client.query, 'INSERT INTO usuarios');
    expect(userParams.slice(6, 9)).toEqual([null, null, '']);
    const [, socioParams] = findCall(client.query, 'INSERT INTO socios');
    expect(socioParams).toEqual([50, 'Rentista', 'Individual', false, 'A-7', 'Luis', '5500000000']);
  });

  it('tipo_socio como alternativa a tipo', async () => {
    await post({ ...validBody, tipo_socio: 'accionista' });
    expect(findCall(client.query, 'INSERT INTO socios')[1][1]).toBe('Accionista');
  });

  it('error al insertar → 500 con mensaje y ROLLBACK', async () => {
    client.query.mockImplementation(async (sql) => {
      if (norm(sql).includes('INSERT INTO socios')) throw new Error('boom');
      return routeQuery(sql);
    });
    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'boom' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('falla la conexión → responde el errorHandler global', async () => {
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── updateSocio ──────────────────────────────────────────────────────────────

describe('PUT /:id (actualizar)', () => {
  const put = (body) => request(app).put('/api/socios/1').send(body);

  it('sin body → el error ocurre antes del try y responde el errorHandler global', async () => {
    const res = await request(app).put('/api/socios/1');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('validación (sin exigir contraseña) → 400 y ROLLBACK', async () => {
    const res = await put({ ...validBody, password: '', direccion: ' ' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Direccion es obligatoria', errors: ['Direccion es obligatoria'] });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('socio inexistente → 500 con "Socio no encontrado"', async () => {
    db.socioUsuario = [];
    const res = await put(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('email o CURP en otro usuario → 400', async () => {
    db.duplicadoOtro = [{ usuario_id: 9 }];
    const res = await put(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Email o CURP ya registrado en otro usuario' });
    expect(findCall(client.query, 'usuario_id <> $3')[1]).toEqual(['ana@club.mx', 'LORA900101MDFPZN09', 50]);
  });

  it('con contraseña → actualiza password_hash; socios con COALESCE y audit', async () => {
    const res = await put({ ...validBody, activo: true, tipo: 'accionista', numero_socio: 'X-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Socio actualizado exitosamente' });
    const [sql, params] = findCall(client.query, 'UPDATE usuarios SET nombres');
    expect(norm(sql)).toContain('password_hash = $11 WHERE usuario_id = $12');
    expect(params.slice(0, 10)).toEqual([
      'Ana',
      'López',
      'Ruiz',
      'ana@club.mx',
      '5512345678',
      'LORA900101MDFPZN09',
      '1990-01-01',
      'Femenino',
      'Calle 1',
      true
    ]);
    expect(bcrypt.compareSync('clave123', params[10])).toBe(true);
    expect(params[11]).toBe(50);

    const [, socioParams] = findCall(client.query, 'UPDATE socios SET tipo');
    expect(socioParams).toEqual(['Accionista', null, undefined, 'X-1', undefined, undefined, true, '1']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'actualizar_socio',
      tabla_afectada: 'socios',
      registro_id: '1',
      detalles: 'Socio actualizado'
    });
  });

  it('sin contraseña → no toca password_hash; opcionales vacíos', async () => {
    const res = await put({ ...validBody, password: '', apellidoMaterno: '', telefono: '', modalidad: 'Familiar' });

    expect(res.status).toBe(200);
    const [sql, params] = findCall(client.query, 'UPDATE usuarios SET nombres');
    expect(norm(sql)).not.toContain('password_hash');
    expect(params).toEqual([
      'Ana',
      'López',
      '',
      'ana@club.mx',
      '',
      'LORA900101MDFPZN09',
      '1990-01-01',
      'Femenino',
      'Calle 1',
      undefined,
      50
    ]);
    expect(findCall(client.query, 'UPDATE socios SET tipo')[1].slice(0, 2)).toEqual([null, 'Familiar']);
  });

  it('falla la conexión → responde el errorHandler global', async () => {
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    const res = await put(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Inactivar / reactivar ────────────────────────────────────────────────────

describe.each([
  [
    'delete',
    '/api/socios/1',
    'false',
    'inactivar_socio',
    'Socio inactivado',
    'Socio inactivado correctamente',
    'Error al inactivar socio'
  ],
  [
    'put',
    '/api/socios/1/reactivar',
    'true',
    'reactivar_socio',
    'Socio reactivado',
    'Socio reactivado correctamente',
    'Error al reactivar socio'
  ]
])('%s %s', (method, url, valor, accion, detalles, ok, fail) => {
  it('cambia socio y usuario, COMMIT y audit', async () => {
    const res = await request(app)[method](url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: ok });
    expect(norm(findCall(client.query, 'UPDATE socios SET activo')[0])).toContain(`SET activo = ${valor}`);
    const [usuarioSql, usuarioParams] = findCall(client.query, 'UPDATE usuarios SET activo');
    expect(norm(usuarioSql)).toContain(`SET activo = ${valor}`);
    expect(usuarioParams).toEqual([50]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion,
      tabla_afectada: 'socios',
      registro_id: '1',
      detalles
    });
  });

  it('socio sin usuario_id → no toca usuarios', async () => {
    db.cambioActivo = [{ socio_id: 1, usuario_id: null }];
    await request(app)[method](url);

    expect(findCall(client.query, 'UPDATE usuarios SET activo')).toBeUndefined();
  });

  it('inexistente → 404 y ROLLBACK', async () => {
    db.cambioActivo = [];
    const res = await request(app)[method](url);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('error → 500 genérico', async () => {
    client.query.mockImplementation(async (sql) => {
      if (norm(sql).includes('UPDATE socios SET activo')) throw new Error('boom');
      return routeQuery(sql);
    });
    const res = await request(app)[method](url);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: fail });
    expect(client.release).toHaveBeenCalled();
  });
});

// ── deletePermanente ─────────────────────────────────────────────────────────

describe('DELETE /:id/permanente', () => {
  it('borra socio y usuario, COMMIT y audit', async () => {
    const res = await request(app).delete('/api/socios/1/permanente');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Socio eliminado permanentemente' });
    expect(findCall(client.query, 'DELETE FROM socios')[1]).toEqual(['1']);
    expect(findCall(client.query, 'DELETE FROM usuarios')[1]).toEqual([50]);
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'eliminar_socio_permanente',
      tabla_afectada: 'socios',
      registro_id: '1',
      detalles: 'Socio eliminado permanentemente'
    });
  });

  it('inexistente → 500 con "Socio no existe"', async () => {
    db.socioUsuario = [];
    const res = await request(app).delete('/api/socios/1/permanente');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Socio no existe' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
