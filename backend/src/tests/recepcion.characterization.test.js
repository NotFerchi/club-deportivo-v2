'use strict';

/**
 * Tests de caracterización de /api/recepcion (recepcionController).
 * Status + cuerpo + snapshot de la secuencia de consultas. Se fija el reloj
 * (solo Date) y se simulan QRCode/HMAC con salidas legibles y deterministas.
 * Cubre también el respaldo a la tabla legacy `visitas` cuando falta `pases`.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/auditLogger', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn(async (texto) => `data:image/png;base64,QR(${texto})`) }));
jest.mock('../utils/qrCrypto', () => ({ generarHmacSha256: (payload) => `hmac(${JSON.stringify(payload)})` }));
jest.mock('../utils/adminRules', () => ({
  ...jest.requireActual('../utils/adminRules'),
  resolveReservaEstado: jest.fn(async () => 'No-Show')
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
const { logAudit } = require('../utils/auditLogger');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/recepcion', require('../routes/recepcion.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const faltaPases = () => Object.assign(new Error('relation "pases" does not exist'), { code: '42P01' });

let db;
let log;
let client;
let consoleSpies;

function route(q) {
  if (db.pasesFaltante && /\b(FROM|INTO|UPDATE) pases\b/.test(q)) throw faltaPases();
  if (db.fallaEn && q.includes(db.fallaEn)) throw new Error('boom');
  if (['BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT before_qr_pase', 'ROLLBACK TO SAVEPOINT before_qr_pase'].includes(q))
    return rows([]);
  if (q === 'SELECT pg_advisory_xact_lock($1)') return rows([]);

  // Cierre automático de visitas vencidas
  if (q.startsWith('UPDATE pases SET hora_salida = (NOW()')) return rows(db.cerradas);
  if (q.startsWith('UPDATE visitas SET hora_salida = (NOW()')) return rows(db.cerradas);

  // Dashboard
  if (q.startsWith('SELECT COUNT(*) FROM asistencia WHERE fecha')) return rows([{ count: '12' }]);
  if (q.startsWith('SELECT COUNT(*) FROM registro_ludoteca')) return rows([{ count: '3' }]);
  if (q.startsWith('SELECT COUNT(*) FROM sanciones')) return rows([{ count: '2' }]);
  if (q.includes('COUNT(DISTINCT a.socio_id)::int as total')) return rows(db.sociosDentro);
  if (q.includes('as no_shows FROM reservaciones')) return rows(db.reservasHoy);
  if (q.includes('as pases_dia')) return rows([{ total: '5', pases_dia: '2', visitas: '3' }]);
  if (q.startsWith('SELECT COUNT(*) FROM visitas WHERE vigente = true')) return rows([{ count: '4' }]);

  // Socios
  if (q.includes('as socio_activo FROM socios s')) return rows(db.socios);
  if (q.includes('s.tipo as tipo_socio')) return rows(db.sociosLista);
  if (q === 'SELECT usuario_id FROM usuarios WHERE username = $1') return rows(db.emailExiste);
  if (q === "SELECT rol_id FROM roles WHERE nombre = 'socio'") return rows(db.rol);
  if (q.startsWith('INSERT INTO usuarios')) return rows([{ usuario_id: 50 }]);
  if (q.includes('SUBSTRING(numero_socio FROM 5)')) return rows([{ coalesce: 8 }]);
  if (q.startsWith('INSERT INTO socios')) return rows([]);
  if (q === 'SELECT usuario_id FROM socios WHERE socio_id = $1') return rows(db.socioUsuario);
  if (q.startsWith('UPDATE usuarios SET nombres')) return rows([]);
  if (q.startsWith('UPDATE socios SET activo = false')) return rows([]);
  if (q.startsWith('UPDATE usuarios SET activo = false')) return rows([]);

  // Reservas / espacios
  if (q.includes('FROM reservaciones r JOIN espacios e')) return rows(db.reservas);
  if (q.startsWith('SELECT espacio_id, nombre, capacidad_maxima FROM espacios')) return rows(db.espacios);

  // Pases / visitas
  if (q.startsWith('SELECT p.pase_id')) return rows(db.pases);
  if (q.includes('FROM information_schema.columns')) return rows(db.legacyCols.map((c) => ({ column_name: c })));
  if (q.startsWith('SELECT v.visita_id')) return rows(db.visitas);
  if (q.startsWith('SELECT s.socio_id FROM socios s WHERE s.socio_id = $1 AND s.activo = true'))
    return rows(db.socioActivo);
  if (q.startsWith('INSERT INTO pases')) return rows([{ pase_id: 300 }]);
  if (q.startsWith('INSERT INTO codigos_qr_pases')) {
    if (db.qrFalla) throw new Error('qr duplicado');
    return rows([{ qr_id: 400 }]);
  }
  if (q.startsWith('INSERT INTO visitas')) return rows([{ visita_id: 500 }]);
  if (q.startsWith('INSERT INTO codigos_qr_visitas')) {
    if (db.qrFalla) throw new Error('qr duplicado');
    return rows([{ qr_id: 600 }]);
  }
  if (q.startsWith("UPDATE pases SET hora_salida = NOW(), estado = 'finalizado'")) return rows(db.salida);
  if (q.startsWith('UPDATE visitas SET hora_salida = NOW(), vigente = false')) return rows(db.salida);
  if (q.startsWith('UPDATE pases SET nombre_completo')) return rows(db.actualizada);
  if (q.startsWith('UPDATE visitas SET nombre_completo')) return rows(db.actualizada);
  if (q.startsWith('SELECT pase_id, estado FROM pases')) return rows(db.pase);
  if (q.startsWith('SELECT visita_id, vigente FROM visitas')) return rows(db.visita);

  // Ludoteca (recepción)
  if (q.startsWith('SELECT rl.registro_id, rl.nombre_hijo, rl.fecha_nacimiento')) return rows(db.ludoteca);
  if (q.startsWith('INSERT INTO registro_ludoteca')) return rows([{ registro_id: 70 }]);
  if (q.startsWith('UPDATE registro_ludoteca SET hora_salida')) return rows(db.ludotecaSalida);

  // Pase de lista
  if (q.includes('FROM sesiones_programadas sp JOIN disciplinas d')) return rows(db.clases);
  if (q.startsWith('SELECT r.reserva_id, r.estado::text as reserva_estado')) return rows(db.alumnos);
  if (q.startsWith('SELECT reserva_id, estado::text as estado, hora_fin, no_show FROM reservaciones'))
    return rows(db.reservaAsistencia);

  throw new Error(`Query no esperada en test: ${q}`);
}

beforeAll(() => {
  jest.useFakeTimers({
    now: new Date('2026-09-30T18:00:00.000Z'),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'hrtime',
      'performance'
    ]
  });
});

afterAll(() => jest.useRealTimers());

beforeEach(() => {
  mockUser = { usuario_id: 7, rol: 'recepcion' };
  db = {
    pasesFaltante: false,
    fallaEn: null,
    qrFalla: false,
    cerradas: [],
    sociosDentro: [{ total: 9, accionistas: 4, rentistas: 5 }],
    reservasHoy: [{ total: 6, activas: 4, canceladas: 1, no_shows: 1 }],
    socios: [{ socio_id: 1 }],
    sociosLista: [{ socio_id: 1, tipo_socio: 'Rentista' }],
    emailExiste: [],
    rol: [{ rol_id: 5 }],
    socioUsuario: [{ usuario_id: 50 }],
    reservas: [{ reserva_id: 1 }],
    espacios: [{ espacio_id: 1 }],
    pases: [{ pase_id: 1 }],
    legacyCols: ['socio_id', 'correo', 'telefono', 'mayor_16', 'observaciones'],
    visitas: [{ visita_id: 1 }],
    socioActivo: [{ socio_id: 10 }],
    salida: [{ pase_id: 1 }],
    actualizada: [{ pase_id: 1 }],
    pase: [{ pase_id: 1, estado: 'activo' }],
    visita: [{ visita_id: 1, vigente: true }],
    ludoteca: [{ registro_id: 1 }],
    ludotecaSalida: [{ registro_id: 1 }],
    clases: [{ sesion_id: 1 }],
    alumnos: [{ reserva_id: 1 }],
    reservaAsistencia: [{ reserva_id: 9, estado: 'Confirmada', hora_fin: '23:00:00', no_show: false }]
  };
  ({ log, client } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const get = (url) => request(app).get(`/api/recepcion${url}`);
const post = (url, body) => request(app).post(`/api/recepcion${url}`).send(body);
const put = (url, body) => request(app).put(`/api/recepcion${url}`).send(body);

// ── Dashboard ────────────────────────────────────────────────────────────────

describe('GET /dashboard', () => {
  it('con tabla pases y cierre automático auditado', async () => {
    db.cerradas = [{ pase_id: 1 }, { pase_id: 2 }];
    const res = await get('/dashboard');
    expect(res.body).toMatchSnapshot();
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'cierre_automatico_visitas',
      tabla_afectada: 'pases',
      detalles: 'Visitas cerradas automaticamente: 2'
    });
    expect(log).toMatchSnapshot();
  });

  it('sin tabla pases → visitas legacy; sin filas de resumen → ceros', async () => {
    db.pasesFaltante = true;
    db.sociosDentro = [];
    db.reservasHoy = [];
    const res = await get('/dashboard');
    expect(res.body).toMatchSnapshot();
    expect(logAudit).not.toHaveBeenCalled();
    expect(log).toMatchSnapshot();
  });

  it('error → 500', async () => {
    db.fallaEn = 'FROM asistencia';
    const res = await get('/dashboard');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener dashboard' });
  });
});

// ── Socios ───────────────────────────────────────────────────────────────────

describe('socios', () => {
  it('GET /socios con y sin búsqueda; error', async () => {
    await get('/socios');
    await get('/socios?q=%20Ana%20');
    await get('/socios?q=%20%20');
    expect(log).toMatchSnapshot();

    db.fallaEn = 'as socio_activo';
    const res = await get('/socios');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al listar socios' });
  });

  it('POST /socios: correo existente, alta, error y casos fuera del try', async () => {
    const body = { nombres: 'Ana', apellidoPaterno: 'López', email: 'ana@club.mx', telefono: '5512345678', curp: 'X' };
    db.emailExiste = [{ usuario_id: 1 }];
    let res = await post('/socios', body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El correo ya esta registrado' });

    db.emailExiste = [];
    res = await post('/socios', { ...body, tipo: 'Accionista' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Socio creado exitosamente', password: 'socio123' });

    db.rol = [];
    res = await post('/socios', body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al crear socio' });
    expect(log).toMatchSnapshot();

    res = await request(app).post('/api/recepcion/socios');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post('/socios', body);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });

  it('PUT /socios/:id: actualiza, 404, error', async () => {
    const body = { nombres: 'Ana', apellidoPaterno: 'López', email: 'ana@club.mx', telefono: '55', activo: true };
    let res = await put('/socios/4', body);
    expect(res.body).toEqual({ message: 'Socio actualizado' });

    db.socioUsuario = [];
    res = await put('/socios/4', body);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });

    db.socioUsuario = [{ usuario_id: 50 }];
    db.fallaEn = 'UPDATE usuarios SET nombres';
    res = await put('/socios/4', body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar socio' });
    expect(log).toMatchSnapshot();

    res = await request(app).put('/api/recepcion/socios/4');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });

  it('DELETE /socios/:id: inactiva, 404, error', async () => {
    let res = await request(app).delete('/api/recepcion/socios/4');
    expect(res.body).toEqual({ message: 'Socio eliminado' });

    db.socioUsuario = [];
    res = await request(app).delete('/api/recepcion/socios/4');
    expect(res.status).toBe(404);

    db.socioUsuario = [{ usuario_id: 50 }];
    db.fallaEn = 'UPDATE socios SET activo';
    res = await request(app).delete('/api/recepcion/socios/4');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al eliminar socio' });
    expect(log).toMatchSnapshot();
  });

  it('GET /socios-lista; error', async () => {
    let res = await get('/socios-lista');
    expect(res.body).toEqual(db.sociosLista);

    db.fallaEn = 'tipo_socio';
    res = await get('/socios-lista');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener lista de socios' });
    expect(log).toMatchSnapshot();
  });
});

// ── Reservas y espacios ──────────────────────────────────────────────────────

describe('reservas y espacios', () => {
  it('GET /reservas (hoy y fecha dada); GET /espacios; errores', async () => {
    await get('/reservas');
    await get('/reservas?fecha=2026-10-02');
    let res = await get('/espacios');
    expect(res.body).toEqual(db.espacios);
    expect(log).toMatchSnapshot();

    db.fallaEn = 'FROM reservaciones r JOIN espacios';
    res = await get('/reservas');
    expect(res.body).toEqual({ error: 'Error al obtener reservas' });

    db.fallaEn = 'capacidad_maxima';
    res = await get('/espacios');
    expect(res.body).toEqual({ error: 'Error al obtener espacios' });
  });
});

// ── Listados de pases/visitas ────────────────────────────────────────────────

describe.each([
  ['/visitas/activas', 'Error al obtener pases activos'],
  ['/visitas/historial?dias=3', 'Error al obtener historial de pases'],
  ['/visitas/historial?dias=-1', 'Error al obtener historial de pases'],
  ['/visitas', 'Error al listar visitas'],
  ['/visitas?fecha=2026-10-01', 'Error al listar visitas']
])('GET %s', (url, mensaje) => {
  it('con tabla pases', async () => {
    const res = await get(url);
    expect(res.body).toEqual(db.pases);
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['todas las columnas legacy', ['socio_id', 'correo', 'telefono', 'mayor_16', 'observaciones']],
    ['sin columnas opcionales', []]
  ])('sin tabla pases → visitas (%s)', async (_n, cols) => {
    db.pasesFaltante = true;
    db.legacyCols = cols;
    const res = await get(url);
    expect(res.body).toEqual(db.visitas);
    expect(log).toMatchSnapshot();
  });

  it('error → 500', async () => {
    db.fallaEn = 'SELECT p.pase_id';
    const res = await get(url);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: mensaje });
  });
});

describe('POST /visitas/cerrar-vencidas', () => {
  it('cierra (pases y legacy) y error', async () => {
    let res = await post('/visitas/cerrar-vencidas');
    expect(res.body).toEqual({ ok: true, cerradas: 0, hora_cierre: '22:00' });

    db.cerradas = [{ pase_id: 1 }];
    db.pasesFaltante = true;
    res = await post('/visitas/cerrar-vencidas');
    expect(res.body).toEqual({ ok: true, cerradas: 1, hora_cierre: '22:00' });
    expect(log).toMatchSnapshot();

    db.pasesFaltante = false;
    db.fallaEn = 'UPDATE pases SET hora_salida = (NOW()';
    res = await post('/visitas/cerrar-vencidas');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al cerrar visitas vencidas' });
  });
});

// ── Crear visita / pase ──────────────────────────────────────────────────────

describe('POST /visitas', () => {
  const nuevo = { tipo_pase: 'dia', nombre_completo: ' Carla Ruiz ', telefono: '(443) 123-4567', mayor_16: true };

  it('validaciones sin conectar', async () => {
    const casos = [
      [{ ...nuevo, tipo_pase: 'vip' }, 'Tipo de pase invalido'],
      [{ ...nuevo, nombre_completo: '' }, 'Nombre completo es requerido'],
      [{ ...nuevo, telefono: '123' }, 'Telefono valido es requerido'],
      [{ ...nuevo, mayor_16: 'si' }, 'Debe indicar si es mayor de 16 anos']
    ];
    for (const [body, error] of casos) {
      const res = await post('/visitas', body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error });
    }
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('pase de día → 201 con QR y audit', async () => {
    const res = await post('/visitas', {
      ...nuevo,
      correo: ' c@x.mx ',
      observaciones: ' nota ',
      identificacion: ' INE '
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchSnapshot();
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'crear_visita',
      tabla_afectada: 'pases',
      registro_id: 300,
      detalles: 'Pase dia registrado'
    });
    expect(log).toMatchSnapshot();
  });

  it('visita: exige socio activo', async () => {
    let res = await post('/visitas', { ...nuevo, tipo_pase: 'visita' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Debe seleccionar un socio activo para una visita' });

    db.socioActivo = [];
    res = await post('/visitas', { ...nuevo, tipo_pase: 'visita', socio_anfitrion_id: 10 });
    expect(res.body).toEqual({ error: 'El socio seleccionado no esta activo o no existe' });

    db.socioActivo = [{ socio_id: 10 }];
    res = await post('/visitas', { ...nuevo, tipo_pase: 'Visita', socio_id: 10 });
    expect(res.status).toBe(201);
    expect(log).toMatchSnapshot();
  });

  it('payload legacy (sin tipo_pase) y QR que no se persiste', async () => {
    db.qrFalla = true;
    const res = await post('/visitas', {
      nombre: 'Luis',
      apellidos: 'Pérez',
      identificacion: 'ABC-123',
      motivo: 'Tenis'
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it.each([
    ['todas las columnas', ['socio_id', 'correo', 'telefono', 'mayor_16', 'observaciones']],
    ['sin columnas opcionales', []]
  ])('sin tabla pases → alta en visitas (%s)', async (_n, cols) => {
    db.pasesFaltante = true;
    db.legacyCols = cols;
    const res = await post('/visitas', {
      tipoVisita: 'visita',
      socio_id: 10,
      nombre_completo: 'Luis',
      identificacion: 'INE 99',
      observaciones: 'x'
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('errores: legacy, genérico y fuera del try', async () => {
    db.pasesFaltante = true;
    db.fallaEn = 'INSERT INTO visitas';
    let res = await post('/visitas', nuevo);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar visita' });

    db.pasesFaltante = false;
    db.fallaEn = 'INSERT INTO pases';
    res = await post('/visitas', nuevo);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar pase' });

    res = await request(app).post('/api/recepcion/visitas');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });

    db.fallaEn = null;
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post('/visitas', nuevo);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Salida, edición y QR de visitas ──────────────────────────────────────────

describe('PUT /visitas/:id/salida', () => {
  it('pases y legacy: salida, 404 y errores', async () => {
    let res = await put('/visitas/8/salida');
    expect(res.body).toEqual({ ok: true, message: 'Salida registrada correctamente' });
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'registrar_salida_visita',
      tabla_afectada: 'pases',
      registro_id: '8',
      detalles: 'Salida de visita registrada'
    });

    db.salida = [];
    res = await put('/visitas/8/salida');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Pase no encontrado o ya finalizado' });

    db.pasesFaltante = true;
    res = await put('/visitas/8/salida');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Visita no encontrada o ya finalizada' });

    db.salida = [{ visita_id: 8 }];
    res = await put('/visitas/8/salida');
    expect(res.body).toEqual({ ok: true, message: 'Salida registrada correctamente' });
    expect(log).toMatchSnapshot();

    db.fallaEn = 'UPDATE visitas SET hora_salida = NOW()';
    res = await put('/visitas/8/salida');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar salida' });

    db.pasesFaltante = false;
    db.fallaEn = 'UPDATE pases SET hora_salida = NOW()';
    res = await put('/visitas/8/salida');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar salida' });
  });
});

describe('PUT /visitas/:id', () => {
  it('validaciones, edición, 404, legacy y errores', async () => {
    let res = await put('/visitas/8', { nombre_completo: ' ' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El nombre es requerido' });

    res = await put('/visitas/8', { nombre_completo: 'Ana', tipo_pase: 'vip' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Tipo de pase inválido' });

    res = await put('/visitas/8', {
      nombre_completo: ' Ana ',
      tipo_pase: 'DIA',
      socio_id: '10',
      telefono: '44-31',
      correo: ' ',
      observaciones: ' x '
    });
    expect(res.body).toEqual({ ok: true, message: 'Visita actualizada correctamente' });

    res = await put('/visitas/8', { nombre_completo: 'Ana', socio_id: '10' });
    expect(res.body).toEqual({ ok: true, message: 'Visita actualizada correctamente' });

    db.actualizada = [];
    res = await put('/visitas/8', { nombre_completo: 'Ana' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Visita no encontrada' });

    db.actualizada = [{ visita_id: 8 }];
    db.pasesFaltante = true;
    res = await put('/visitas/8', { nombre_completo: 'Ana', observaciones: 'y' });
    expect(res.body).toEqual({ ok: true, message: 'Visita actualizada correctamente' });
    expect(log).toMatchSnapshot();

    db.pasesFaltante = false;
    db.fallaEn = 'UPDATE pases SET nombre_completo';
    res = await put('/visitas/8', { nombre_completo: 'Ana' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al actualizar visita' });

    res = await request(app).put('/api/recepcion/visitas/8');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

describe('GET /visitas/:id/qr', () => {
  it('pase activo → QR; inactivo → 400', async () => {
    let res = await get('/visitas/1/qr');
    expect(res.body).toMatchSnapshot();

    db.pase = [{ pase_id: 1, estado: 'finalizado' }];
    res = await get('/visitas/1/qr');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El pase ya no está activo' });
    expect(log).toMatchSnapshot();
  });

  it('sin pase → visitas legacy: 404, no vigente, QR, error → 404', async () => {
    db.pase = [];
    db.visita = [];
    let res = await get('/visitas/1/qr');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Pase no encontrado' });

    db.visita = [{ visita_id: 1, vigente: false }];
    res = await get('/visitas/1/qr');
    expect(res.status).toBe(400);

    db.visita = [{ visita_id: 1, vigente: null }];
    db.qrFalla = true;
    res = await get('/visitas/1/qr');
    expect(res.body).toMatchSnapshot();

    db.fallaEn = 'SELECT visita_id, vigente';
    res = await get('/visitas/1/qr');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Pase no encontrado' });
    expect(log).toMatchSnapshot();
  });

  it('tabla pases faltante → legacy; error en pases → 500; conexión → errorHandler', async () => {
    db.pasesFaltante = true;
    let res = await get('/visitas/1/qr');
    expect(res.status).toBe(200);

    db.pasesFaltante = false;
    db.fallaEn = 'SELECT pase_id, estado';
    res = await get('/visitas/1/qr');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al generar QR' });
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await get('/visitas/1/qr');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Ludoteca (recepción) ─────────────────────────────────────────────────────

describe('ludoteca de recepción', () => {
  it('activos, entrada y salida con errores', async () => {
    let res = await get('/ludoteca/activos');
    expect(res.body).toEqual(db.ludoteca);

    res = await post('/ludoteca/entrada', {
      socioId: 10,
      nombreHijo: 'Leo',
      fechaNacimiento: '2021-01-01',
      observaciones: '  '
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Entrada registrada', registroId: 70 });

    res = await put('/ludoteca/salida/70');
    expect(res.body).toEqual({ message: 'Salida registrada' });

    db.ludotecaSalida = [];
    res = await put('/ludoteca/salida/70');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Registro no encontrado o ya finalizado' });
    expect(log).toMatchSnapshot();

    for (const [falla, peticion, error] of [
      ['SELECT rl.registro_id', () => get('/ludoteca/activos'), 'Error al obtener ludoteca'],
      ['INSERT INTO registro_ludoteca', () => post('/ludoteca/entrada', { socioId: 10 }), 'Error al registrar entrada'],
      ['UPDATE registro_ludoteca', () => put('/ludoteca/salida/70'), 'Error al registrar salida']
    ]) {
      db.fallaEn = falla;
      res = await peticion();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error });
    }

    res = await request(app).post('/api/recepcion/ludoteca/entrada');
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Pase de lista ────────────────────────────────────────────────────────────

describe('pase de lista', () => {
  it('GET /clases: hoy, fecha dada (domingo), inválida, error', async () => {
    await get('/clases');
    await get('/clases?fecha=2026-10-04');
    let res = await get('/clases?fecha=abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Fecha invalida' });
    expect(log).toMatchSnapshot();

    db.fallaEn = 'FROM sesiones_programadas';
    res = await get('/clases');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener clases' });
  });

  it('GET /clases/:sesionId/alumnos: sin fecha → 400; ok; error', async () => {
    let res = await get('/clases/3/alumnos');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Sesion y fecha son requeridas' });

    res = await get('/clases/3/alumnos?fecha=2026-09-30');
    expect(res.body).toEqual(db.alumnos);
    expect(log).toMatchSnapshot();

    db.fallaEn = 'reserva_estado';
    res = await get('/clases/3/alumnos?fecha=2026-09-30');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener alumnos' });
  });

  it('POST /asistencia/manual: 400, 404, 409 no-show y el fallo heredado (ReferenceError → 500)', async () => {
    const body = { sesionId: 3, socioId: 10, fecha: '2026-09-30' };
    let res = await post('/asistencia/manual', { sesionId: 3 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Sesion, socio y fecha son requeridos' });

    db.reservaAsistencia = [];
    res = await post('/asistencia/manual', body);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No existe una reserva para este alumno en la fecha seleccionada' });

    for (const reserva of [
      { reserva_id: 9, estado: 'Confirmada', no_show: true },
      { reserva_id: 9, estado: 'No Show', no_show: false }
    ]) {
      db.reservaAsistencia = [reserva];
      res = await post('/asistencia/manual', body);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'La reserva ya fue marcada como No Show y no permite pase de lista posterior'
      });
    }

    // Bug heredado: getMexicoDateISO no está importado → siempre 500 con una reserva válida.
    db.reservaAsistencia = [{ reserva_id: 9, estado: 'Confirmada', hora_fin: '23:00:00', no_show: false }];
    res = await post('/asistencia/manual', body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al registrar asistencia' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post('/asistencia/manual', body);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Envío de QR por correo ───────────────────────────────────────────────────

describe('POST /visitas/:id/enviar-qr', () => {
  it('validaciones y el fallo heredado (sendQrVisita no importado → 503)', async () => {
    let res = await post('/visitas/1/enviar-qr', { correo: 'malo' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Correo electrónico inválido' });

    res = await post('/visitas/1/enviar-qr', { correo: 'a@b.mx' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Imagen QR requerida' });

    res = await post('/visitas/1/enviar-qr', { correo: 'a@b.mx', qr_image: 'data:x' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'sendQrVisita is not defined' });
  });
});
