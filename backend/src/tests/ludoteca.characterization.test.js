'use strict';

/**
 * Tests de caracterización de /api/ludoteca (ludotecaController).
 * Status + cuerpo + snapshot de la secuencia de consultas por endpoint.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/auditLogger', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../helpers/qrSecurity.helper', () => ({ validarQrFirmado: jest.fn() }));

let mockUser;
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = mockUser;
    next();
  }
}));
jest.mock('../middleware/checkRole', () => () => (req, res, next) => next());

const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/ludoteca', require('../routes/ludoteca.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });

/** Fecha YYYY-MM-DD de hace `anios` años (y unos días más, para no caer en el borde). */
function haceAnios(anios, dias = 10) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - anios);
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}
const NACIMIENTO_OK = haceAnios(5);

let db;
let log;
let client;
let consoleSpies;

function route(q) {
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.startsWith('SELECT rl.registro_id, rl.nombre_hijo')) return rows(db.activos);
  if (q.startsWith('SELECT rl.registro_id, rl.socio_padre_id')) return rows(db.historial);
  if (q === 'SELECT socio_id FROM socios WHERE socio_id = $1') return rows(db.socioExiste);
  if (q === 'SELECT socio_id FROM socios WHERE usuario_id = $1') return rows(db.socioDelUsuario);
  if (q === 'SELECT socio_id, activo FROM socios WHERE socio_id = $1') return rows(db.socioQr);
  if (q.startsWith('INSERT INTO registro_ludoteca')) {
    if (db.insertError) throw db.insertError;
    return rows([
      {
        registro_id: 90,
        nombre_hijo: 'Leo',
        hora_entrada: '2026-09-30T10:00:00',
        hora_entrada_local: '2026-09-30T10:00:00'
      }
    ]);
  }
  if (q.includes('FROM registro_ludoteca WHERE registro_id = $1 FOR UPDATE')) return rows(db.registro);
  if (q.startsWith('UPDATE registro_ludoteca SET hora_salida'))
    return rows([{ hora_salida: '2026-09-30T12:30:00', duracion_minutos: db.duracion }]);
  if (q.startsWith('INSERT INTO sanciones')) return rows([]);
  if (q.startsWith('SELECT registro_id, nombre_hijo, fecha_nacimiento, TO_CHAR')) return rows(db.misRegistros);
  if (q.startsWith('SELECT registro_id FROM registro_ludoteca WHERE socio_padre_id = $1 AND LOWER(nombre_hijo)'))
    return rows(db.ninoActivo);
  if (q.startsWith('SELECT registro_id, nombre_hijo, hora_entrada FROM registro_ludoteca'))
    return rows(db.registroActivoQr);
  if (q.startsWith('SELECT COUNT(*) AS activos FROM registro_ludoteca')) return rows([{ activos: '4' }]);
  throw new Error(`Query no esperada en test: ${q}`);
}

beforeEach(() => {
  mockUser = { usuario_id: 7, rol: 'recepcion' };
  db = {
    activos: [{ registro_id: 1, nombre_hijo: 'Leo' }],
    historial: [{ registro_id: 2 }],
    socioExiste: [{ socio_id: 10 }],
    socioDelUsuario: [{ socio_id: 10 }],
    socioQr: [{ socio_id: 10, activo: true }],
    registro: [{ registro_id: 5, socio_padre_id: 10, hora_entrada: 'x', hora_salida: null }],
    duracion: 60,
    misRegistros: [{ registro_id: 5, estado: 'activo' }],
    ninoActivo: [],
    registroActivoQr: [],
    insertError: null
  };
  ({ log, client } = recordQueries(pool, route));
  validarQrFirmado.mockReturnValue({ type: 'socio', socio_id: 10 });
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// ── Lecturas ─────────────────────────────────────────────────────────────────

describe('lecturas', () => {
  it('GET /activos; error → 500 con mensaje', async () => {
    let res = await request(app).get('/api/ludoteca/activos');
    expect(res.body).toEqual(db.activos);

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/ludoteca/activos');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'boom' });
    expect(log).toMatchSnapshot();
  });

  it.each([[undefined], ['30'], ['-3'], ['abc']])('GET /historial?dias=%s → no-store', async (dias) => {
    const res = await request(app)
      .get('/api/ludoteca/historial')
      .query(dias ? { dias } : {});
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual(db.historial);
    expect(log).toMatchSnapshot();
  });

  it('GET /historial error → 500 con mensaje', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/ludoteca/historial');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'boom' });
  });

  it('GET /aforo; error → 500', async () => {
    let res = await request(app).get('/api/ludoteca/aforo');
    expect(res.body).toEqual({ activos: 4, maximo: 15 });

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/ludoteca/aforo');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener aforo' });
  });

  it('GET /mis-registros: con socio, sin socio → [], error → 500', async () => {
    let res = await request(app).get('/api/ludoteca/mis-registros');
    expect(res.body).toEqual(db.misRegistros);

    db.socioDelUsuario = [];
    res = await request(app).get('/api/ludoteca/mis-registros');
    expect(res.body).toEqual([]);

    pool.query.mockRejectedValueOnce(new Error('boom'));
    res = await request(app).get('/api/ludoteca/mis-registros');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(log).toMatchSnapshot();
  });
});

// ── Entrada (staff) ──────────────────────────────────────────────────────────

describe.each([
  ['POST /entrada', '/api/ludoteca/entrada', (b) => b],
  [
    'POST / (alias con socio_id / nombre_nino)',
    '/api/ludoteca',
    (b) => ({
      socio_id: b.socio_padre_id,
      nombre_nino: b.nombre_hijo,
      fecha_nacimiento: b.fecha_nacimiento,
      observaciones: b.observaciones
    })
  ]
])('%s', (_name, url, adapt) => {
  const post = (body) => request(app).post(url).send(adapt(body));
  const valido = {
    socio_padre_id: '10',
    nombre_hijo: ' Leo ',
    fecha_nacimiento: NACIMIENTO_OK,
    observaciones: '  alergia  '
  };

  it('validaciones en orden', async () => {
    const casos = [
      [{ ...valido, nombre_hijo: '' }, 'socio_padre_id, nombre_hijo y fecha_nacimiento son requeridos'],
      [{ ...valido, fecha_nacimiento: 'no-es-fecha' }, 'fecha_nacimiento debe tener formato YYYY-MM-DD'],
      [{ ...valido, fecha_nacimiento: haceAnios(2) }, 'El niño debe tener entre 3 y 7 años'],
      [{ ...valido, fecha_nacimiento: haceAnios(8) }, 'El niño debe tener entre 3 y 7 años'],
      [{ ...valido, socio_padre_id: '1.5' }, 'socio_padre_id debe ser un entero válido']
    ];
    for (const [body, error] of casos) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error });
    }
    expect(log).toEqual([]);
  });

  it('registra la entrada y audita', async () => {
    const res = await post(valido);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      message: 'Entrada registrada correctamente',
      registro: expect.objectContaining({ registro_id: 90 })
    });
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'entrada_ludoteca',
      tabla_afectada: 'registro_ludoteca',
      registro_id: 90,
      detalles: 'Entrada de ludoteca registrada'
    });
    expect(log).toMatchSnapshot();
  });

  it('socio inexistente, FK 23503 y error genérico', async () => {
    db.socioExiste = [];
    let res = await post(valido);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El socio padre no existe' });

    db.socioExiste = [{ socio_id: 10 }];
    db.insertError = Object.assign(new Error('fk'), { code: '23503' });
    res = await post(valido);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El socio padre no existe' });

    db.insertError = new Error('boom');
    res = await post(valido);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
  });
});

describe('entrada: casos del cuerpo', () => {
  it('nombre_hijo no string → 400 vacío', async () => {
    const res = await request(app)
      .post('/api/ludoteca/entrada')
      .send({ socio_padre_id: 10, nombre_hijo: 123, fecha_nacimiento: NACIMIENTO_OK });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'nombre_hijo no puede estar vacío' });
  });

  it('sin body → errorHandler global (ambas rutas)', async () => {
    for (const url of ['/api/ludoteca/entrada', '/api/ludoteca']) {
      const res = await request(app).post(url);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
    }
  });
});

// ── Salida (staff) ───────────────────────────────────────────────────────────

describe.each([
  ['PATCH /salida/:registro_id', (id) => request(app).patch(`/api/ludoteca/salida/${id}`)],
  ['PUT /:id/salida (alias)', (id) => request(app).put(`/api/ludoteca/${id}/salida`)]
])('%s', (_name, salida) => {
  it('id inválido → 400 sin consultar', async () => {
    const res = await salida('abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'registro_id debe ser un entero válido' });
    expect(log).toEqual([]);
  });

  it.each([
    ['dentro del límite', 120, false],
    ['con exceso → sanción', 135, true]
  ])('%s', async (_n, duracion, sancion) => {
    db.duracion = duracion;
    const res = await salida(5);
    expect(res.body).toEqual({
      ok: true,
      registro_id: 5,
      hora_salida: '2026-09-30T12:30:00',
      duracion_minutos: duracion,
      sancion_generada: sancion
    });
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'salida_ludoteca',
      tabla_afectada: 'registro_ludoteca',
      registro_id: 5,
      detalles: `Salida de ludoteca. Duracion ${duracion} min. Sancion: ${sancion ? 'si' : 'no'}`
    });
    expect(log).toMatchSnapshot();
  });

  it('404, 409, error → 500 y fallo de conexión → errorHandler', async () => {
    db.registro = [];
    let res = await salida(5);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Registro no encontrado' });

    db.registro = [{ registro_id: 5, socio_padre_id: 10, hora_salida: 'ya' }];
    res = await salida(5);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este niño ya tiene salida registrada' });

    db.registro = [{ registro_id: 5, socio_padre_id: 10, hora_salida: null }];
    client.query.mockRejectedValueOnce(new Error('boom'));
    res = await salida(5);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(log).toMatchSnapshot();

    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await salida(5);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Autoservicio del socio ───────────────────────────────────────────────────

describe('POST /socio/entrada', () => {
  const post = (body) => request(app).post('/api/ludoteca/socio/entrada').send(body);
  const valido = { nombre_hijo: ' Leo ', fecha_nacimiento: NACIMIENTO_OK };

  it('validaciones, 403 sin socio, 409 niño activo, alta y error', async () => {
    let res = await post({ nombre_hijo: 'Leo' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'nombre_hijo y fecha_nacimiento son requeridos' });

    res = await post({ ...valido, fecha_nacimiento: haceAnios(9) });
    expect(res.body).toEqual({ error: 'El niño debe tener entre 3 y 7 años' });

    db.socioDelUsuario = [];
    res = await post(valido);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Solo los socios pueden registrar entradas' });

    db.socioDelUsuario = [{ socio_id: 10 }];
    db.ninoActivo = [{ registro_id: 3 }];
    res = await post(valido);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Este niño ya tiene una entrada activa en la ludoteca' });

    db.ninoActivo = [];
    res = await post(valido);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      message: 'Entrada registrada',
      registro: expect.objectContaining({ registro_id: 90 })
    });
    expect(logAudit).not.toHaveBeenCalled();

    db.insertError = new Error('boom');
    res = await post(valido);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(log).toMatchSnapshot();
  });
});

describe('PATCH /socio/salida/:registro_id', () => {
  const salida = (id = 5) => request(app).patch(`/api/ludoteca/socio/salida/${id}`);

  it('salida propia con exceso → sanción, sin audit', async () => {
    db.duracion = 200;
    const res = await salida();
    expect(res.body).toEqual({ ok: true, registro_id: 5, duracion_minutos: 200, sancion_generada: true });
    expect(logAudit).not.toHaveBeenCalled();
    expect(log).toMatchSnapshot();
  });

  it('400, 403 sin socio, 404, 403 ajeno, 409, 500', async () => {
    let res = await salida('0');
    expect(res.status).toBe(400);

    db.socioDelUsuario = [];
    res = await salida();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Solo los socios pueden registrar salidas' });

    db.socioDelUsuario = [{ socio_id: 10 }];
    db.registro = [];
    res = await salida();
    expect(res.status).toBe(404);

    db.registro = [{ registro_id: 5, socio_padre_id: 99, hora_salida: null }];
    res = await salida();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No tienes permiso para registrar esta salida' });

    db.registro = [{ registro_id: 5, socio_padre_id: 10, hora_salida: 'ya' }];
    res = await salida();
    expect(res.status).toBe(409);

    db.registro = [{ registro_id: 5, socio_padre_id: 10, hora_salida: null }];
    client.query.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    res = await salida();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(log).toMatchSnapshot();
  });

  it('error al buscar el socio (antes del try) → errorHandler', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await salida();
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Acceso por QR ────────────────────────────────────────────────────────────

describe('POST /acceso-qr', () => {
  const post = (body) => request(app).post('/api/ludoteca/acceso-qr').send(body);

  it('validaciones del QR y del socio', async () => {
    let res = await post({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'codigo_qr es requerido' });

    validarQrFirmado.mockImplementationOnce(() => {
      throw Object.assign(new Error('QR vencido'), { statusCode: 401 });
    });
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'QR vencido' });

    validarQrFirmado.mockImplementationOnce(() => {
      throw new Error('mal formado');
    });
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'mal formado' });

    validarQrFirmado.mockReturnValueOnce({ type: 'visita', socio_id: 10 });
    res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({ error: 'Solo socios pueden registrar niños en ludoteca' });

    validarQrFirmado.mockReturnValueOnce({ type: 'socio', socio_id: 'abc' });
    res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({ error: 'QR inválido: socio_id no válido' });

    db.socioQr = [];
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Socio no encontrado' });

    db.socioQr = [{ socio_id: 10, activo: false }];
    res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'El socio no está activo' });
    expect(log).toMatchSnapshot();
  });

  it('con registro activo → salida (con y sin exceso)', async () => {
    db.registroActivoQr = [{ registro_id: 44, nombre_hijo: 'Leo', hora_entrada: 'x' }];
    for (const duracion of [30, 150]) {
      db.duracion = duracion;
      const res = await post({ codigo_qr: 'x' });
      expect(res.body).toEqual({
        accion: 'salida',
        nombre_hijo: 'Leo',
        hora_salida: '2026-09-30T12:30:00',
        duracion_minutos: duracion,
        sancion_generada: duracion > 120
      });
    }
    expect(logAudit).toHaveBeenLastCalledWith(expect.anything(), {
      accion: 'salida_ludoteca_qr',
      tabla_afectada: 'registro_ludoteca',
      registro_id: 44,
      detalles: 'Salida por QR. Duración: 150 min. Sanción: sí'
    });
    expect(log).toMatchSnapshot();
  });

  it('salida por QR: error → 500 con ROLLBACK', async () => {
    db.registroActivoQr = [{ registro_id: 44, nombre_hijo: 'Leo', hora_entrada: 'x' }];
    client.query.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    const res = await post({ codigo_qr: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('sin registro activo: pide datos, valida y registra entrada', async () => {
    let res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({
      requiere_datos: true,
      mensaje: 'Proporciona nombre y fecha de nacimiento del niño',
      socio_padre_id: 10
    });

    res = await post({ codigo_qr: 'x', nombre_hijo: 'Leo', fecha_nacimiento: haceAnios(9, 40) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El niño debe tener entre 3 y 7 años (edad detectada: 9 años)' });

    res = await post({ codigo_qr: 'x', nombre_hijo: ' Leo ', fecha_nacimiento: NACIMIENTO_OK, observaciones: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      accion: 'entrada',
      nombre_hijo: 'Leo',
      hora_entrada: '2026-09-30T10:00:00',
      hora_limite: new Date(new Date('2026-09-30T10:00:00').getTime() + 2 * 60 * 60 * 1000).toISOString()
    });
    expect(logAudit).toHaveBeenCalledWith(expect.anything(), {
      accion: 'entrada_ludoteca_qr',
      tabla_afectada: 'registro_ludoteca',
      registro_id: 90,
      detalles: 'Entrada por QR. Niño: Leo'
    });

    db.insertError = new Error('boom');
    res = await post({ codigo_qr: 'x', nombre_hijo: 'Leo', fecha_nacimiento: NACIMIENTO_OK });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });
    expect(log).toMatchSnapshot();
  });

  it('errores de BD fuera del try y fallo de conexión → errorHandler', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    let res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });

    db.registroActivoQr = [{ registro_id: 44, nombre_hijo: 'Leo', hora_entrada: 'x' }];
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    res = await post({ codigo_qr: 'x' });
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});
