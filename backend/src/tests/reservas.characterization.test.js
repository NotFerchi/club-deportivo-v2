'use strict';

/**
 * Tests de caracterización de reservasController.
 * Fijan el comportamiento HTTP actual (status + cuerpo) para detectar
 * regresiones al extraer la lógica a services/reservaService.js.
 *
 * pool.query se enruta por el texto del SQL (no por orden de llamada) para
 * que los tests no dependan de la estructura interna del código.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/auditLogger', () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/mexicoDate', () => ({
  getMexicoDateISO: () => mockHoy, // miércoles por defecto (ver beforeEach)
  getMexicoTimeISO: () => '08:00'
}));
// Autenticación simulada: estos tests caracterizan la lógica, no el control de acceso.
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => next(),
  checkRole: () => (req, res, next) => next()
}));
jest.mock('../utils/adminRules', () => {
  const actual = jest.requireActual('../utils/adminRules');
  return {
    ...actual,
    getTableColumns: jest.fn(async (table) => {
      if (table === 'espacios') return new Set(['estado', 'activo']);
      if (table === 'sanciones') return new Set(['gravedad', 'fecha_inicio', 'fecha_fin']);
      return new Set();
    }),
    resolveReservaEstado: jest.fn(async (value) => actual.normalizeReservaEstado(value))
  };
});

const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const express = require('express');
const request = require('supertest');
const reservasController = require('../controllers/reservasController');
const reservasRoutes = require('../routes/reservas.routes');

// Validaciones de entrada: se prueban a través del router real (ruta + middlewares + controlador).
const app = express();
app.use(express.json());
app.use('/api/reservas', reservasRoutes);
app.use(require('../middleware/errorHandler'));

// ── helpers ──────────────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const rows = (list) => ({ rows: list, rowCount: list.length });

let db;
let mockHoy;

const defaultDb = () => ({
  sancionActiva: [],
  espacioDisponible: [{ espacio_id: 1 }],
  mantenimiento: [],
  reservasSocioDia: [],
  solapamientoSocio: [],
  solapamientoClase: [],
  solapamientoEspacio: [],
  sesionesEspacio: [],
  reservaExistente: [],
  cancelada: [{ reserva_id: 5 }],
  noShowsVencidos: [],
  listado: [],
  detalle: [],
  eliminada: [{ reserva_id: 5 }],
  reservasDelDia: []
});

function routeQuery(sql) {
  const q = String(sql).replace(/\s+/g, ' ');
  if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return rows([]);
  if (q.includes('UPDATE reservaciones r SET estado = $1, no_show = TRUE')) return rows(db.noShowsVencidos);
  if (q.includes('FROM sanciones s')) return rows(db.sancionActiva);
  if (q.includes('FROM sanciones WHERE socio_id')) return rows([]);
  if (q.includes('INSERT INTO sanciones')) return rows([]);
  if (q.includes('FROM espacios WHERE espacio_id')) return rows(db.espacioDisponible);
  if (q.includes('FROM mantenimiento_espacios')) return rows(db.mantenimiento);
  if (q.includes('FROM reservaciones r WHERE r.socio_id')) {
    return q.includes('r.hora_inicio <') ? rows(db.solapamientoSocio) : rows(db.reservasSocioDia);
  }
  if (q.includes('FROM inscripciones_clases ic')) return rows(db.solapamientoClase);
  if (q.includes('FROM reservaciones r WHERE r.espacio_id')) return rows(db.solapamientoEspacio);
  if (q.includes('FROM sesiones_programadas sp WHERE sp.espacio_id')) return rows(db.sesionesEspacio);
  if (q.includes('INSERT INTO reservaciones')) return rows([{ reserva_id: 99 }]);
  if (q.includes('LEFT JOIN socios s ON r.socio_id = s.socio_id')) return rows(db.listado);
  if (q.includes('SELECT r.*, r.estado::text as estado_original')) return rows(db.detalle);
  if (q.includes('DELETE FROM reservaciones')) return rows(db.eliminada);
  if (q.includes('SELECT hora_inicio, hora_fin FROM reservaciones WHERE espacio_id')) return rows(db.reservasDelDia);
  if (q.includes('SELECT * FROM reservaciones WHERE reserva_id')) return rows(db.reservaExistente);
  if (q.includes('UPDATE reservaciones SET espacio_id')) return rows([]);
  if (q.includes('UPDATE reservaciones SET estado = $1 WHERE reserva_id')) return rows(db.cancelada);
  throw new Error(`Query no esperada en test: ${q}`);
}

const findCall = (mockFn, fragment) =>
  mockFn.mock.calls.find(([sql]) => String(sql).replace(/\s+/g, ' ').includes(fragment));

const validBody = {
  espacio_id: 1,
  socio_id: 10,
  fecha: '2026-09-30',
  hora_inicio: '10:00',
  hora_fin: '11:00'
};

let client;
let consoleSpies;

beforeEach(() => {
  mockHoy = '2026-09-30';
  db = defaultDb();
  pool.query.mockImplementation(async (sql) => routeQuery(sql));
  client = { query: jest.fn(async (sql) => routeQuery(sql)), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  consoleSpies = [
    jest.spyOn(console, 'error').mockImplementation(() => {}),
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  ];
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// ── createReserva ────────────────────────────────────────────────────────────

describe('createReserva', () => {
  it('crea una reserva válida → 201', async () => {
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, id: 99, message: 'Reserva creada correctamente' });

    const [, params] = findCall(pool.query, 'INSERT INTO reservaciones');
    expect(params).toEqual([1, 10, '2026-09-30', '10:00', '11:00', 'confirmada']);
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'crear_reserva', registro_id: 99 })
    );
  });

  it('normaliza fecha ISO completa y hora con segundos', async () => {
    const res = mockRes();
    await reservasController.createReserva(
      { body: { ...validBody, fecha: '2026-09-30T00:00:00.000Z', hora_inicio: '10:00:00', hora_fin: '11:00:00' } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const [, params] = findCall(pool.query, 'INSERT INTO reservaciones');
    expect(params.slice(2, 5)).toEqual(['2026-09-30', '10:00', '11:00']);
  });

  it('faltan campos obligatorios → 400 (vía router)', async () => {
    const res = await request(app).post('/api/reservas').send({ espacio_id: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Faltan campos obligatorios',
      errors: ['Faltan campos obligatorios']
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('espacio ya reservado en ese horario (solapada) → 400', async () => {
    db.solapamientoEspacio = [{ reserva_id: 7 }];
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El espacio ya esta reservado en ese horario',
      errors: ['El espacio ya esta reservado en ese horario']
    });
    expect(findCall(pool.query, 'INSERT INTO reservaciones')).toBeUndefined();
  });

  it('socio con reserva duplicada en ese horario → 400', async () => {
    db.solapamientoSocio = [{ reserva_id: 8 }];
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El socio ya tiene una reserva en ese horario',
      errors: ['El socio ya tiene una reserva en ese horario']
    });
  });

  it('acumula varios errores en el orden actual', async () => {
    db.sancionActiva = [{ sancion_id: 1 }];
    db.reservasSocioDia = [{ reserva_id: 1 }, { reserva_id: 2 }];
    db.solapamientoClase = [{ '?column?': 1 }];
    db.sesionesEspacio = [{ sesion_id: 3 }];
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El socio tiene una sancion activa',
      errors: [
        'El socio tiene una sancion activa',
        'El socio ya tiene una reserva activa para ese dia',
        'El socio tiene una clase inscrita en ese horario',
        'El horario entra en conflicto con una sesion programada'
      ]
    });
  });

  it('fuera del horario de cierre → 400', async () => {
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody, hora_inicio: '22:00', hora_fin: '23:00' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Horario de cierre: 22:00',
      errors: ['Horario de cierre: 22:00']
    });
  });

  it('otro día, en horario pasado y con duración inválida → 400 con todos los errores', async () => {
    const res = mockRes();
    await reservasController.createReserva(
      { body: { ...validBody, fecha: '2026-09-29', hora_inicio: '05:00', hora_fin: '05:30' } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Solo se permiten reservas para el mismo dia',
      errors: [
        'Solo se permiten reservas para el mismo dia',
        'No se pueden crear reservas en horarios pasados',
        'Horario de apertura: 06:00',
        'La reserva debe ser de 1 o 2 horas'
      ]
    });
  });

  it('estado inválido → 400 con el mensaje del error', async () => {
    const { resolveReservaEstado } = require('../utils/adminRules');
    resolveReservaEstado.mockRejectedValueOnce(new Error('Estado de reserva invalido: xyz'));
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody, estado: 'xyz' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Estado de reserva invalido: xyz' });
  });

  it('error inesperado de BD → 500 con el mensaje', async () => {
    pool.query.mockImplementation(async () => {
      throw new Error('boom');
    });
    const res = mockRes();
    await reservasController.createReserva({ body: { ...validBody } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'boom' });
  });
});

// ── updateReserva ────────────────────────────────────────────────────────────

describe('updateReserva', () => {
  it('si falla la conexión a la BD, responde el errorHandler global (vía router)', async () => {
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).put('/api/reservas/5').send({ estado: 'cancelada' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });

  const current = {
    reserva_id: 5,
    espacio_id: 1,
    socio_id: 10,
    fecha_reserva: '2026-09-30',
    hora_inicio: '10:00:00',
    hora_fin: '11:00:00',
    estado: 'Confirmada'
  };

  it('reserva inexistente → 404 y ROLLBACK', async () => {
    const res = mockRes();
    await reservasController.updateReserva({ params: { id: '5' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Reserva no encontrada' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('actualiza combinando body con valores actuales → 200 y COMMIT', async () => {
    db.reservaExistente = [current];
    const res = mockRes();
    await reservasController.updateReserva(
      { params: { id: '5' }, body: { hora_inicio: '12:00', hora_fin: '14:00' } },
      res
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Reserva actualizada correctamente' });
    const [, params] = findCall(client.query, 'UPDATE reservaciones SET espacio_id');
    expect(params).toEqual([1, 10, '2026-09-30', '12:00', '14:00', 'confirmada', false, '5']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'actualizar_reserva', detalles: 'Reserva actualizada con estado confirmada' })
    );
  });

  it('validación fallida → 400 y ROLLBACK', async () => {
    db.reservaExistente = [current];
    db.solapamientoEspacio = [{ reserva_id: 7 }];
    const res = mockRes();
    await reservasController.updateReserva({ params: { id: '5' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'El espacio ya esta reservado en ese horario',
      errors: ['El espacio ya esta reservado en ese horario']
    });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(findCall(client.query, 'UPDATE reservaciones SET espacio_id')).toBeUndefined();
  });

  it('marcar no-show → no_show=true y crea sanción', async () => {
    db.reservaExistente = [current];
    const res = mockRes();
    await reservasController.updateReserva({ params: { id: '5' }, body: { estado: 'no-show' } }, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Reserva actualizada correctamente' });
    const [, params] = findCall(client.query, 'UPDATE reservaciones SET espacio_id');
    expect(params[5]).toBe('no-show');
    expect(params[6]).toBe(true);
    const [, sancionParams] = findCall(client.query, 'INSERT INTO sanciones');
    expect(sancionParams.slice(0, 5)).toEqual([
      10,
      'No-show registrado en reserva #5',
      'No-show reserva',
      'Activa',
      'Moderada'
    ]);
  });
});

// ── cancelarReserva ──────────────────────────────────────────────────────────

describe('cancelarReserva', () => {
  it('cancela una reserva activa → 200', async () => {
    const res = mockRes();
    await reservasController.cancelarReserva({ params: { id: '5' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Reserva cancelada correctamente' });
    const [, params] = findCall(pool.query, 'UPDATE reservaciones SET estado = $1 WHERE reserva_id');
    expect(params).toEqual(['cancelada', '5']);
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'cancelar_reserva', registro_id: '5' })
    );
  });

  it('reserva inexistente o ya cancelada → 404', async () => {
    db.cancelada = [];
    const res = mockRes();
    await reservasController.cancelarReserva({ params: { id: '5' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Reserva no encontrada o ya estaba cancelada' });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

// ── getReservas ──────────────────────────────────────────────────────────────

describe('getReservas', () => {
  it('lista reservas con nombre completo y estado normalizado', async () => {
    db.listado = [
      { reserva_id: 1, socio_nombre: 'Ana', socio_apellido: 'López', estado_original: 'Confirmada' },
      { reserva_id: 2, socio_nombre: 'Luis', socio_apellido: null, estado_original: 'Cancelado' }
    ];
    const res = mockRes();
    await reservasController.getReservas({}, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith([
      {
        reserva_id: 1,
        socio_nombre: 'Ana López',
        socio_apellido: 'López',
        estado_original: 'Confirmada',
        estado: 'confirmada'
      },
      { reserva_id: 2, socio_nombre: 'Luis', socio_apellido: null, estado_original: 'Cancelado', estado: 'cancelada' }
    ]);
    const [sql] = findCall(pool.query, 'LEFT JOIN socios s ON r.socio_id = s.socio_id');
    expect(sql).toContain('e.estado as espacio_estado');
  });

  it('sincroniza no-shows vencidos y crea su sanción antes de listar', async () => {
    db.noShowsVencidos = [{ reserva_id: 3, socio_id: 12 }];
    const res = mockRes();
    await reservasController.getReservas({}, res);

    const [, params] = findCall(pool.query, 'UPDATE reservaciones r SET estado = $1, no_show = TRUE');
    expect(params).toEqual(['no-show', '2026-09-30', '08:00']);
    const [, sancionParams] = findCall(pool.query, 'INSERT INTO sanciones');
    expect(sancionParams.slice(0, 2)).toEqual([12, 'No-show registrado en reserva #3']);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('error de BD → 500 con prefijo', async () => {
    pool.query.mockImplementation(async () => {
      throw new Error('boom');
    });
    const res = mockRes();
    await reservasController.getReservas({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error al obtener reservas: boom' });
  });
});

// ── getReservaById ───────────────────────────────────────────────────────────

describe('getReservaById', () => {
  it('devuelve la reserva con estado normalizado', async () => {
    db.detalle = [{ reserva_id: 5, estado: 'No-Show', estado_original: 'No-Show', no_show_detalle: 'x' }];
    const res = mockRes();
    await reservasController.getReservaById({ params: { id: '5' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      reserva_id: 5,
      estado: 'no-show',
      estado_original: 'No-Show',
      no_show_detalle: 'x'
    });
    const [, params] = findCall(pool.query, 'SELECT r.*, r.estado::text as estado_original');
    expect(params).toEqual(['5']);
  });

  it('reserva inexistente → 404', async () => {
    const res = mockRes();
    await reservasController.getReservaById({ params: { id: '5' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Reserva no encontrada' });
  });
});

// ── deleteReserva ────────────────────────────────────────────────────────────

describe('deleteReserva', () => {
  it('elimina la reserva → 200 y registra auditoría', async () => {
    const res = mockRes();
    await reservasController.deleteReserva({ params: { id: '5' } }, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, message: 'Reserva eliminada correctamente' });
    expect(logAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accion: 'eliminar_reserva', registro_id: '5' })
    );
  });

  it('reserva inexistente → 404 sin auditoría', async () => {
    db.eliminada = [];
    const res = mockRes();
    await reservasController.deleteReserva({ params: { id: '5' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Reserva no encontrada' });
    expect(logAudit).not.toHaveBeenCalled();
  });
});

// ── getDisponibilidad ────────────────────────────────────────────────────────

describe('getDisponibilidad', () => {
  it('espacio_id inválido → 400 sin consultar BD (vía router)', async () => {
    for (const espacioId of ['abc', '0', '1.5', '']) {
      const res = await request(app).get('/api/reservas/disponibilidad').query({ espacio_id: espacioId });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'espacio_id requerido' });
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('lunes → cerrado sin slots', async () => {
    mockHoy = '2026-09-28';
    const res = mockRes();
    await reservasController.getDisponibilidad({ query: { espacio_id: '1' } }, res);

    expect(res.json).toHaveBeenCalledWith({
      espacio_id: 1,
      fecha: '2026-09-28',
      cerrado: true,
      motivo: 'Lunes',
      slots: []
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('entre semana → slots 06:00–21:00 marcando sesión (prioridad) y reserva', async () => {
    db.reservasDelDia = [{ hora_inicio: '08:00:00', hora_fin: '10:00:00' }];
    db.sesionesEspacio = [{ hora_inicio: '09:00:00', hora_fin: '10:30:00' }];
    const res = mockRes();
    await reservasController.getDisponibilidad({ query: { espacio_id: '1' } }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.espacio_id).toBe(1);
    expect(body.fecha).toBe('2026-09-30');
    expect(body.cerrado).toBeUndefined();
    expect(body.slots).toHaveLength(16);
    expect(body.slots[0]).toEqual({ hora: '06:00', libre: true, motivo: null });
    expect(body.slots[15]).toEqual({ hora: '21:00', libre: true, motivo: null });
    expect(body.slots.slice(2, 6)).toEqual([
      { hora: '08:00', libre: false, motivo: 'reserva' },
      { hora: '09:00', libre: false, motivo: 'sesion' },
      { hora: '10:00', libre: false, motivo: 'sesion' },
      { hora: '11:00', libre: true, motivo: null }
    ]);
  });

  it('domingo → slots 07:00–18:00', async () => {
    mockHoy = '2026-10-04';
    const res = mockRes();
    await reservasController.getDisponibilidad({ query: { espacio_id: '1' } }, res);

    const { slots } = res.json.mock.calls[0][0];
    expect(slots).toHaveLength(12);
    expect(slots[0].hora).toBe('07:00');
    expect(slots[11].hora).toBe('18:00');
  });

  it('error de BD → 500', async () => {
    pool.query.mockImplementation(async () => {
      throw new Error('boom');
    });
    const res = mockRes();
    await reservasController.getDisponibilidad({ query: { espacio_id: '1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'boom' });
  });
});
