'use strict';

/**
 * Tests de caracterización de /api/usuarios (usuariosController).
 * Se prueban vía router real + errorHandler para cubrir también los errores
 * que el controlador original deja escapar (consultas fuera del try).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
// Autenticación simulada: estos tests caracterizan la lógica, no el control de acceso.
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 7 };
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const usuariosRoutes = require('../routes/usuarios.routes');

const app = express();
app.use(express.json());
app.use('/api/usuarios', usuariosRoutes);
app.use(require('../middleware/errorHandler'));

const rows = (list, rowCount = list.length) => ({ rows: list, rowCount });
const norm = (sql) => String(sql).replace(/\s+/g, ' ');

let db;
let client;
let consoleSpies;

function routeQuery(sql) {
  const q = norm(sql);
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.includes('FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.rol_id ORDER BY')) return rows(db.lista);
  if (q.includes('FROM usuarios u LEFT JOIN roles r ON u.rol_id = r.rol_id WHERE u.usuario_id'))
    return rows(db.detalle);
  if (q.includes('FROM roles WHERE nombre')) return rows(db.roles);
  if (q.includes('WHERE username = $1 AND usuario_id <> $2')) return rows(db.emailOtro);
  if (q.includes('WHERE curp = $1 AND usuario_id <> $2')) return rows(db.curpOtro);
  if (q.includes('SELECT usuario_id FROM usuarios WHERE username = $1')) return rows(db.emailExiste);
  if (q.includes('SELECT usuario_id FROM usuarios WHERE curp = $1')) return rows(db.curpExiste);
  if (q.includes('INSERT INTO usuarios')) return rows([{ usuario_id: 42 }]);
  if (q.includes('UPDATE usuarios SET nombres')) return rows([], 1);
  if (q.includes('UPDATE usuarios SET activo')) return rows([], 1);
  if (q.includes('DELETE FROM usuarios')) return rows([], 1);
  if (q.includes('FROM usuarios u JOIN roles r ON u.rol_id = r.rol_id WHERE u.usuario_id')) return rows(db.perfil);
  if (q.includes('UPDATE usuarios SET foto_perfil')) return db.foto;
  throw new Error(`Query no esperada en test: ${q}`);
}

const findCall = (mockFn, fragment) => mockFn.mock.calls.find(([sql]) => norm(sql).includes(fragment));

beforeEach(() => {
  db = {
    lista: [{ usuario_id: 1, nombres: 'Ana' }],
    detalle: [{ usuario_id: 1, nombres: 'Ana' }],
    roles: [{ rol_id: 1, nombre: 'admin' }],
    emailOtro: [],
    curpOtro: [],
    emailExiste: [],
    curpExiste: [],
    perfil: [{ usuario_id: 7, nombres: 'Ana', rol: 'admin' }],
    foto: rows([{ usuario_id: 7, foto_perfil: 'x' }])
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
  curp: 'LORA900101MDFPZN09',
  fechaNacimiento: '1990-01-01',
  genero: 'Femenino',
  direccion: 'Calle 1',
  rol_id: 3,
  password: 'clave123'
};

// ── Lecturas ─────────────────────────────────────────────────────────────────

describe('lecturas', () => {
  it('GET / → lista; error → 500', async () => {
    let res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.lista);

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/usuarios');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener usuarios' });
  });

  it('GET /roles → roles sin socio; error → 500', async () => {
    let res = await request(app).get('/api/usuarios/roles');
    expect(res.body).toEqual(db.roles);
    expect(norm(findCall(pool.query, 'FROM roles')[0])).toContain("WHERE nombre != 'socio' ORDER BY rol_id");

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/usuarios/roles');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener roles' });
  });

  it('GET /:id → usuario; 404; error → 500', async () => {
    let res = await request(app).get('/api/usuarios/1');
    expect(res.body).toEqual(db.detalle[0]);

    db.detalle = [];
    res = await request(app).get('/api/usuarios/1');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Usuario no encontrado' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/usuarios/1');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener usuario' });
  });
});

// ── createUsuario ────────────────────────────────────────────────────────────

describe('POST / (crear)', () => {
  const post = (body) => request(app).post('/api/usuarios').send(body);

  it('sin body → el error ocurre antes del try y responde el errorHandler global', async () => {
    const res = await request(app).post('/api/usuarios');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('validaciones → 400 en orden, sin conectar a la BD', async () => {
    const casos = [
      [{ ...validBody, nombres: ' ' }, 'Nombres, apellido paterno, email, CURP y rol son obligatorios'],
      [{ ...validBody, rol_id: undefined }, 'Nombres, apellido paterno, email, CURP y rol son obligatorios'],
      [{ ...validBody, email: 'ana@' }, 'Formato de email inválido'],
      [{ ...validBody, curp: 'LORA900101' }, 'La CURP debe tener 18 caracteres.'],
      [{ ...validBody, curp: 'LORA900101XDFPZN09' }, 'Formato de CURP invalido.'],
      [{ ...validBody, telefono: '123' }, 'El teléfono debe tener 10 dígitos numéricos']
    ];
    for (const [body, error] of casos) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error });
    }
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('nombres no string (.trim falla) → 500 del endpoint, no del errorHandler', async () => {
    const res = await post({ ...validBody, nombres: 5 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear usuario' });
    expect(consoleSpies[1].mock.calls.at(-1)[0]).toBe('Error en createUsuario:');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('email ya registrado → 400 y ROLLBACK', async () => {
    db.emailExiste = [{ usuario_id: 2 }];
    const res = await post(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El email ya está registrado' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('CURP ya registrada → 400 y ROLLBACK', async () => {
    db.curpExiste = [{ usuario_id: 2 }];
    const res = await post(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El CURP ya está registrado' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('crea → 201 con la contraseña enviada, INSERT y COMMIT', async () => {
    const res = await post(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Usuario creado', usuario_id: 42, password: 'clave123' });
    const [, params] = findCall(client.query, 'INSERT INTO usuarios');
    expect(params).toEqual([
      'ana@club.mx',
      'Ana',
      'López',
      'Ruiz',
      'LORA900101MDFPZN09',
      '1990-01-01',
      'Femenino',
      '5512345678',
      'Calle 1',
      'clave123',
      3
    ]);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('sin contraseña ni opcionales → usa empleado123 y valores por defecto', async () => {
    const res = await post({
      ...validBody,
      password: '',
      apellidoMaterno: '',
      telefono: '',
      fechaNacimiento: '',
      genero: '',
      direccion: ''
    });

    expect(res.status).toBe(201);
    expect(res.body.password).toBe('empleado123');
    const [, params] = findCall(client.query, 'INSERT INTO usuarios');
    expect(params).toEqual([
      'ana@club.mx',
      'Ana',
      'López',
      '',
      'LORA900101MDFPZN09',
      null,
      null,
      '',
      '',
      'empleado123',
      3
    ]);
  });

  it('error en el INSERT → 500 y ROLLBACK', async () => {
    client.query.mockImplementation(async (sql) => {
      if (norm(sql).includes('INSERT INTO usuarios')) throw new Error('boom');
      return routeQuery(sql);
    });
    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear usuario' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('falla la conexión → responde el errorHandler global', async () => {
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    const res = await post(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── updateUsuario ────────────────────────────────────────────────────────────

describe('PUT /:id (actualizar)', () => {
  const put = (body) => request(app).put('/api/usuarios/5').send(body);

  it('sin body → el error ocurre antes del try y responde el errorHandler global', async () => {
    const res = await request(app).put('/api/usuarios/5');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('validación → 400 sin consultar la BD', async () => {
    const res = await put({ ...validBody, email: 'x' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Formato de email inválido' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('apellidoPaterno no string (.trim falla) → 500 del endpoint', async () => {
    const res = await put({ ...validBody, apellidoPaterno: 7 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar usuario' });
    expect(consoleSpies[1].mock.calls.at(-1)[0]).toBe('Error en updateUsuario:');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('email en otro usuario → 400', async () => {
    db.emailOtro = [{ usuario_id: 9 }];
    const res = await put(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El email ya está registrado en otro usuario' });
    expect(findCall(pool.query, 'WHERE username = $1 AND usuario_id <> $2')[1]).toEqual(['ana@club.mx', '5']);
  });

  it('CURP en otro usuario → 400', async () => {
    db.curpOtro = [{ usuario_id: 9 }];
    const res = await put(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El CURP ya está registrado en otro usuario' });
  });

  it('error al revisar duplicados (fuera del try) → responde el errorHandler global', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await put(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });

  it('con contraseña → actualiza con crypt()', async () => {
    const res = await put({ ...validBody, activo: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Usuario actualizado correctamente' });
    const [sql, params] = findCall(pool.query, 'UPDATE usuarios SET nombres');
    expect(norm(sql)).toContain("password_hash = crypt($12, gen_salt('bf')) WHERE usuario_id = $13");
    expect(params).toEqual([
      'Ana',
      'López',
      'Ruiz',
      'ana@club.mx',
      '5512345678',
      'LORA900101MDFPZN09',
      '1990-01-01',
      'Femenino',
      'Calle 1',
      3,
      false,
      'clave123',
      '5'
    ]);
  });

  it('sin contraseña (o solo espacios) → no toca password_hash', async () => {
    const res = await put({ ...validBody, password: '   ', apellidoMaterno: '', telefono: '', direccion: '' });

    expect(res.status).toBe(200);
    const [sql, params] = findCall(pool.query, 'UPDATE usuarios SET nombres');
    expect(norm(sql)).not.toContain('password_hash');
    // activo no enviado → undefined (el UPDATE lo escribe tal cual, sin COALESCE)
    expect(params).toEqual([
      'Ana',
      'López',
      '',
      'ana@club.mx',
      '',
      'LORA900101MDFPZN09',
      '1990-01-01',
      'Femenino',
      '',
      3,
      undefined,
      '5'
    ]);
  });

  it('error en el UPDATE → 500', async () => {
    pool.query.mockImplementation(async (sql) => {
      if (norm(sql).includes('UPDATE usuarios SET nombres')) throw new Error('boom');
      return routeQuery(sql);
    });
    const res = await put(validBody);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar usuario' });
  });
});

// ── Estado / borrado ─────────────────────────────────────────────────────────

describe('estado y borrado', () => {
  const casos = [
    ['delete', '/api/usuarios/5', 'Usuario eliminado (inactivo)', 'Error al eliminar usuario', 'SET activo = false'],
    ['put', '/api/usuarios/5/desactivar', 'Usuario desactivado', 'Error al desactivar usuario', 'SET activo = false'],
    ['put', '/api/usuarios/5/reactivar', 'Usuario reactivado', 'Error al reactivar usuario', 'SET activo = true'],
    [
      'delete',
      '/api/usuarios/5/permanente',
      'Usuario eliminado definitivamente',
      'Error al eliminar definitivamente el usuario',
      'DELETE FROM usuarios'
    ]
  ];

  it.each(casos)('%s %s → mensaje; error → 500', async (method, url, ok, fail, fragment) => {
    let res = await request(app)[method](url);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: ok });
    expect(findCall(pool.query, fragment)[1]).toEqual(['5']);

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app)[method](url);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: fail });
  });
});

// ── Perfil propio ────────────────────────────────────────────────────────────

describe('/me', () => {
  it('GET /me/perfil → perfil del usuario del token; 404; error → 500', async () => {
    let res = await request(app).get('/api/usuarios/me/perfil');
    expect(res.body).toEqual(db.perfil[0]);
    expect(findCall(pool.query, 'FROM usuarios u JOIN roles r')[1]).toEqual([7]);

    db.perfil = [];
    res = await request(app).get('/api/usuarios/me/perfil');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Usuario no encontrado' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/usuarios/me/perfil');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });

  it('PUT /me/foto sin archivo → 400', async () => {
    const res = await request(app).put('/api/usuarios/me/foto');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Se requiere una imagen' });
  });

  it('PUT /me/foto con imagen → guarda base64 y responde la foto', async () => {
    const res = await request(app)
      .put('/api/usuarios/me/foto')
      .attach('foto', Buffer.from('PNGDATA'), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, message: 'Foto de perfil actualizada correctamente', foto_perfil: 'x' });
    expect(findCall(pool.query, 'UPDATE usuarios SET foto_perfil')[1]).toEqual([
      `data:image/png;base64,${Buffer.from('PNGDATA').toString('base64')}`,
      7
    ]);
  });

  it('PUT /me/foto: usuario inexistente → 404; error → 500', async () => {
    db.foto = rows([], 0);
    const attach = () =>
      request(app)
        .put('/api/usuarios/me/foto')
        .attach('foto', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' });

    let res = await attach();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Usuario no encontrado' });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await attach();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });

  it('PUT /me/foto con archivo que no es imagen → error de multer al errorHandler', async () => {
    const res = await request(app)
      .put('/api/usuarios/me/foto')
      .attach('foto', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
