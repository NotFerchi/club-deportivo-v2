const pool = require('../config/database');
const {
  addDaysISO,
  getDiaSemana,
  getTableColumns,
  localTodayISO,
  minutesBetween,
  normalizeReservaEstado,
  resolveReservaEstado
} = require('../utils/adminRules');

const RESERVA_CONFIG = {
  sameDayOnly: process.env.RESERVAS_MISMO_DIA !== 'false',
  durationMinutes: Number(process.env.RESERVAS_DURACION_MINUTOS || 60),
  maxActiveReservationsPerSocio: Number(process.env.RESERVAS_MAX_ACTIVAS_SOCIO || 1)
};

const estadoActivoSql = `
  LOWER(r.estado::text) NOT IN ('cancelada', 'cancelado')
`;

const estadoActivoSancionSql = `
  LOWER(s.estado::text) IN ('activa', 'activo')
  AND COALESCE(NULLIF(to_jsonb(s)->>'fecha_fin', '')::date, CURRENT_DATE) >= CURRENT_DATE
`;

function normalizeDate(value) {
  return String(value || '').split('T')[0];
}

function normalizeTime(value) {
  return String(value || '').slice(0, 5);
}

async function ensureNoShowSancion(client, reservaId, socioId) {
  const existing = await client.query(
    `SELECT sancion_id
     FROM sanciones
     WHERE socio_id = $1
       AND origen = 'No-show reserva'
       AND motivo ILIKE $2
     LIMIT 1`,
    [socioId, `%reserva #${reservaId}%`]
  );

  if (existing.rows.length > 0) return;

  const columns = await getTableColumns('sanciones');
  const insertColumns = ['socio_id', 'motivo', 'origen', 'estado'];
  const values = [socioId, `No-show registrado en reserva #${reservaId}`, 'No-show reserva', 'Activa'];

  if (columns.has('gravedad')) {
    insertColumns.push('gravedad');
    values.push('Moderada');
  }
  if (columns.has('fecha_inicio')) {
    insertColumns.push('fecha_inicio');
    values.push(localTodayISO());
  } else if (columns.has('fecha')) {
    insertColumns.push('fecha');
    values.push(localTodayISO());
  }
  if (columns.has('fecha_fin')) {
    insertColumns.push('fecha_fin');
    values.push(addDaysISO(localTodayISO(), 7));
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  await client.query(
    `INSERT INTO sanciones (${insertColumns.join(', ')}) VALUES (${placeholders})`,
    values
  );
}

async function validateReserva(payload, options = {}) {
  const errors = [];
  const reservaId = options.reservaId || null;
  const espacioId = payload.espacio_id;
  const socioId = payload.socio_id;
  const fecha = normalizeDate(payload.fecha);
  const horaInicio = normalizeTime(payload.hora_inicio);
  const horaFin = normalizeTime(payload.hora_fin);
  const estado = normalizeReservaEstado(payload.estado || 'confirmada');
  const reservaQuedaActiva = !['cancelada', 'no-show', 'sancionada'].includes(estado);

  if (!espacioId || !socioId || !fecha || !horaInicio || !horaFin) {
    errors.push('Faltan campos obligatorios');
    return errors;
  }

  if (RESERVA_CONFIG.sameDayOnly && fecha !== localTodayISO()) {
    errors.push('Solo se permiten reservas para el mismo dia');
  }

  const duration = minutesBetween(horaInicio, horaFin);
  if (duration <= 0) {
    errors.push('La hora de fin debe ser mayor a la hora de inicio');
  } else if (duration !== RESERVA_CONFIG.durationMinutes) {
    errors.push(`La reserva debe durar ${RESERVA_CONFIG.durationMinutes} minutos`);
  }

  if (!reservaQuedaActiva) return errors;

  const sancion = await pool.query(
    `SELECT s.sancion_id
     FROM sanciones s
     WHERE s.socio_id = $1 AND ${estadoActivoSancionSql}
     LIMIT 1`,
    [socioId]
  );
  if (sancion.rows.length > 0) {
    errors.push('El socio tiene una sancion activa');
  }

  const socioReservas = await pool.query(
    `SELECT reserva_id
     FROM reservaciones r
     WHERE r.socio_id = $1
       AND r.fecha_reserva = $2
       AND ${estadoActivoSql}
       AND ($3::int IS NULL OR r.reserva_id <> $3::int)`,
    [socioId, fecha, reservaId]
  );
  if (socioReservas.rows.length >= RESERVA_CONFIG.maxActiveReservationsPerSocio) {
    errors.push('El socio ya tiene una reserva activa para ese dia');
  }

  const disponibilidad = await pool.query(
    `SELECT reserva_id
     FROM reservaciones r
     WHERE r.espacio_id = $1
       AND r.fecha_reserva = $2
       AND ${estadoActivoSql}
       AND ($5::int IS NULL OR r.reserva_id <> $5::int)
       AND r.hora_inicio < $4::time
       AND r.hora_fin > $3::time`,
    [espacioId, fecha, horaInicio, horaFin, reservaId]
  );
  if (disponibilidad.rows.length > 0) {
    errors.push('El espacio ya esta reservado en ese horario');
  }

  const diaSemana = getDiaSemana(fecha);
  const sesiones = await pool.query(
    `SELECT sp.sesion_id
     FROM sesiones_programadas sp
     WHERE sp.espacio_id = $1
       AND sp.dia_semana = $2
       AND COALESCE((to_jsonb(sp)->>'activo')::boolean, true) = true
       AND sp.hora_inicio < $4::time
       AND sp.hora_fin > $3::time
     LIMIT 1`,
    [espacioId, diaSemana, horaInicio, horaFin]
  );
  if (sesiones.rows.length > 0) {
    errors.push('El horario entra en conflicto con una sesion programada');
  }

  return errors;
}

const reservasController = {
  getReservas: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          r.reserva_id,
          r.espacio_id,
          r.socio_id,
          r.fecha_reserva as fecha,
          r.hora_inicio,
          r.hora_fin,
          r.estado::text as estado_original,
          r.no_show,
          r.fecha_creacion,
          e.nombre as espacio_nombre,
          u.nombres as socio_nombre,
          u.apellido_paterno as socio_apellido,
          s.numero_socio
        FROM reservaciones r
        LEFT JOIN espacios e ON r.espacio_id = e.espacio_id
        LEFT JOIN socios s ON r.socio_id = s.socio_id
        LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id
        ORDER BY r.fecha_reserva DESC, r.hora_inicio ASC
      `);

      const reservas = result.rows.map(row => ({
        ...row,
        socio_nombre: `${row.socio_nombre || ''} ${row.socio_apellido || ''}`.trim(),
        estado: normalizeReservaEstado(row.estado_original)
      }));

      res.json(reservas);
    } catch (error) {
      console.error('Error en getReservas:', error);
      res.status(500).json({ error: `Error al obtener reservas: ${error.message}` });
    }
  },

  getReservaById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT r.*, r.estado::text as estado_original, e.nombre as espacio_nombre
         FROM reservaciones r
         LEFT JOIN espacios e ON r.espacio_id = e.espacio_id
         WHERE r.reserva_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      res.json({
        ...result.rows[0],
        estado: normalizeReservaEstado(result.rows[0].estado_original)
      });
    } catch (error) {
      console.error('Error en getReservaById:', error);
      res.status(500).json({ error: error.message });
    }
  },

  createReserva: async (req, res) => {
    const { espacio_id, socio_id, fecha, hora_inicio, hora_fin, estado } = req.body;

    try {
      const errors = await validateReserva({ espacio_id, socio_id, fecha, hora_inicio, hora_fin });
      if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

      const estadoDb = await resolveReservaEstado(estado || 'confirmada');
      const result = await pool.query(
        `INSERT INTO reservaciones (espacio_id, socio_id, fecha_reserva, hora_inicio, hora_fin, estado)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING reserva_id`,
        [espacio_id, socio_id, normalizeDate(fecha), normalizeTime(hora_inicio), normalizeTime(hora_fin), estadoDb]
      );

      res.status(201).json({ ok: true, id: result.rows[0].reserva_id, message: 'Reserva creada correctamente' });
    } catch (error) {
      console.error('Error en createReserva:', error);
      const status = error.message?.includes('Estado de reserva invalido') ? 400 : 500;
      res.status(status).json({ error: error.message });
    }
  },

  updateReserva: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT * FROM reservaciones WHERE reserva_id = $1', [id]);
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      const current = existing.rows[0];
      const payload = {
        espacio_id: req.body.espacio_id || current.espacio_id,
        socio_id: req.body.socio_id || current.socio_id,
        fecha: req.body.fecha || current.fecha_reserva,
        hora_inicio: req.body.hora_inicio || current.hora_inicio,
        hora_fin: req.body.hora_fin || current.hora_fin,
        estado: req.body.estado || current.estado
      };
      const errors = await validateReserva(payload, { reservaId: Number(id) });
      if (errors.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: errors[0], errors });
      }

      const estadoDb = await resolveReservaEstado(payload.estado);
      await client.query(
        `UPDATE reservaciones SET
          espacio_id = $1,
          socio_id = $2,
          fecha_reserva = $3,
          hora_inicio = $4,
          hora_fin = $5,
          estado = $6,
          no_show = $7
         WHERE reserva_id = $8`,
        [
          payload.espacio_id,
          payload.socio_id,
          normalizeDate(payload.fecha),
          normalizeTime(payload.hora_inicio),
          normalizeTime(payload.hora_fin),
          estadoDb,
          normalizeReservaEstado(payload.estado) === 'no-show',
          id
        ]
      );

      if (normalizeReservaEstado(payload.estado) === 'no-show') {
        await ensureNoShowSancion(client, id, payload.socio_id);
      }

      await client.query('COMMIT');
      res.json({ ok: true, message: 'Reserva actualizada correctamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en updateReserva:', error);
      const status = error.message?.includes('Estado de reserva invalido') ? 400 : 500;
      res.status(status).json({ error: error.message });
    } finally {
      client.release();
    }
  },

  cancelarReserva: async (req, res) => {
    const { id } = req.params;
    try {
      const estadoCancelada = await resolveReservaEstado('cancelada');
      const result = await pool.query(
        `UPDATE reservaciones
         SET estado = $1
         WHERE reserva_id = $2 AND LOWER(estado::text) NOT IN ('cancelada', 'cancelado')
         RETURNING reserva_id`,
        [estadoCancelada, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada o ya estaba cancelada' });
      }

      res.json({ ok: true, message: 'Reserva cancelada correctamente' });
    } catch (error) {
      console.error('Error en cancelarReserva:', error);
      res.status(500).json({ error: error.message });
    }
  },

  deleteReserva: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM reservaciones WHERE reserva_id = $1 RETURNING reserva_id', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reserva no encontrada' });
      }

      res.json({ ok: true, message: 'Reserva eliminada correctamente' });
    } catch (error) {
      console.error('Error en deleteReserva:', error);
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = reservasController;
