'use strict';

/**
 * Tests de caracterización de POST /api/auth/login (auth.controller).
 * Fijan status + cuerpo exactos y el contenido del JWT para detectar
 * regresiones al extraer la lógica a services/authService.js.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/auditLogger', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const authRoutes = require('../routes/auth.routes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(require('../middleware/errorHandler'));

const PASSWORD = 'secreta123';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let consoleSpies;
const ORIGINAL_SECRET = process.env.JWT_SECRET;

const usuario = (overrides = {}) => ({
  usuario_id: 7,
  username: 'ana@club.mx',
  password_hash: HASH,
  activo: true,
  nombres: 'Ana',
  apellido_paterno: 'López',
  foto_perfil: null,
  rol: 'admin',
  ...overrides
});

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;
});

beforeEach(() => {
  db = { usuario: [usuario()], socio: [] };
  pool.query.mockImplementation(async (sql) => {
    const q = String(sql).replace(/\s+/g, ' ');
    if (q.includes('FROM usuarios u JOIN roles r')) return rows(db.usuario);
    if (q.includes('FROM socios WHERE usuario_id')) return rows(db.socio);
    throw new Error(`Query no esperada en test: ${q}`);
  });
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const login = (body) => request(app).post('/api/auth/login').send(body);

describe('POST /api/auth/login', () => {
  it('usuario inexistente → 401', async () => {
    db.usuario = [];
    const res = await login({ email: 'nadie@club.mx', contrasena: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
    expect(pool.query.mock.calls[0][1]).toEqual(['nadie@club.mx']);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('contraseña incorrecta → 401', async () => {
    const res = await login({ email: 'ana@club.mx', contrasena: 'otra' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('cuenta inactiva con contraseña correcta → 403', async () => {
    db.usuario = [usuario({ activo: false })];
    const res = await login({ email: 'ana@club.mx', contrasena: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'La cuenta está desactivada' });
  });

  it('cuenta inactiva con contraseña incorrecta → 401 (la contraseña se revisa primero)', async () => {
    db.usuario = [usuario({ activo: false })];
    const res = await login({ email: 'ana@club.mx', contrasena: 'otra' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Credenciales inválidas' });
  });

  it('login correcto (no socio) → 200 con token de 8h y datos del usuario', async () => {
    const res = await login({ email: 'ana@club.mx', contrasena: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toEqual({
      id: 7,
      email: 'ana@club.mx',
      rol: 'admin',
      nombres: 'Ana',
      apellido_paterno: 'López',
      foto_perfil: null
    });
    const payload = jwt.verify(res.body.token, 'test-secret');
    expect(payload).toMatchObject({ usuario_id: 7, email: 'ana@club.mx', rol: 'admin' });
    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
    expect(Object.keys(res.body)).toEqual(['token', 'usuario']);
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      usuario_id: 7,
      accion: 'login',
      tabla_afectada: 'usuarios',
      registro_id: 7,
      detalles: 'Inicio de sesion correcto para rol admin'
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('foto_perfil presente se devuelve tal cual', async () => {
    db.usuario = [usuario({ foto_perfil: 'data:image/png;base64,AAA' })];
    const res = await login({ email: 'ana@club.mx', contrasena: PASSWORD });

    expect(res.body.usuario.foto_perfil).toBe('data:image/png;base64,AAA');
  });

  it('login de socio con registro de socio → agrega socio_id y numero_socio', async () => {
    db.usuario = [usuario({ rol: 'socio' })];
    db.socio = [{ socio_id: 10, numero_socio: 'SOC-0010' }];
    const res = await login({ email: 'ana@club.mx', contrasena: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toEqual({
      id: 7,
      email: 'ana@club.mx',
      rol: 'socio',
      nombres: 'Ana',
      apellido_paterno: 'López',
      foto_perfil: null,
      socio_id: 10,
      numero_socio: 'SOC-0010'
    });
    expect(pool.query.mock.calls[1][1]).toEqual([7]);
  });

  it('login de socio sin registro de socio → sin datos extra', async () => {
    db.usuario = [usuario({ rol: 'socio' })];
    const res = await login({ email: 'ana@club.mx', contrasena: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.usuario).not.toHaveProperty('socio_id');
  });

  it('error de BD → 500 genérico', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await login({ email: 'ana@club.mx', contrasena: PASSWORD });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });

  it('sin contraseña → bcrypt falla dentro del try → 500 genérico', async () => {
    const res = await login({ email: 'ana@club.mx' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });

  it('sin body → el error ocurre antes del try y responde el errorHandler global', async () => {
    const res = await request(app).post('/api/auth/login');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
