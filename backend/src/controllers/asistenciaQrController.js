const pool = require('../config/database');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');

const TIPOS_SOPORTADOS = ['socio', 'visita'];

const sendError = (res, status, message) => res.status(status).json({ error: message });

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const validarYExtraerPayload = (codigoQrInput) => {
  if (codigoQrInput === undefined || codigoQrInput === null) {
    const error = new Error('codigo_qr es requerido');
    error.statusCode = 400;
    throw error;
  }

  if (typeof codigoQrInput !== 'string' || !codigoQrInput.trim()) {
    const error = new Error('codigo_qr debe ser una cadena no vacía');
    error.statusCode = 400;
    throw error;
  }

  return validarQrFirmado(codigoQrInput.trim());
};

const obtenerNombreSocio = async (client, socioId) => {
  const result = await client.query(
    `SELECT COALESCE(
       NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), ''),
       s.numero_socio,
       CONCAT('Socio ', s.socio_id)
     ) AS nombre
     FROM socios s
     LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
     WHERE s.socio_id = $1`,
    [socioId]
  );
  return result.rows[0]?.nombre ?? `Socio ${socioId}`;
};

const registrarAsistenciaSocio = async (client, sesionId, socioId, fechaReserva) => {
  const reserva = await client.query(
    `SELECT reserva_id FROM reservaciones
     WHERE sesion_id = $1 AND socio_id = $2
       AND fecha_reserva = $3
       AND estado = 'Confirmada'`,
    [sesionId, socioId, fechaReserva]   // ← $3 = fechaReserva
  );

  const inscritoAhora = reserva.rows.length === 0;
  if (inscritoAhora) {
    const sesion = await client.query(
      `SELECT sp.cupo_maximo, sp.hora_inicio, sp.hora_fin,
              (SELECT COUNT(*) FROM reservaciones
               WHERE sesion_id = $1
                 AND fecha_reserva = $2
                 AND estado = 'Confirmada') AS inscritos
       FROM sesiones_programadas sp WHERE sp.sesion_id = $1`,
      [sesionId, fechaReserva]   // ← $2 = fechaReserva
    );

    if (sesion.rows.length === 0) {
      const error = new Error('La sesión no existe');
      error.statusCode = 404;
      throw error;
    }

    const { cupo_maximo, inscritos, hora_inicio, hora_fin } = sesion.rows[0];
    if (parseInt(inscritos) >= parseInt(cupo_maximo)) {
      const error = new Error('La clase está llena, no se puede inscribir');
      error.statusCode = 400;
      throw error;
    }

    await client.query(
      `INSERT INTO reservaciones (sesion_id, socio_id, visita_id, fecha_reserva, hora_inicio, hora_fin, estado)
       VALUES ($1, $2, NULL, $5, $3, $4, 'Confirmada')`,
      [sesionId, socioId, hora_inicio, hora_fin, fechaReserva]   // ← $5 = fechaReserva
    );
  }

  const duplicado = await client.query(
    `SELECT asistencia_id FROM asistencia
     WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3`,
    [sesionId, socioId, fechaReserva]   // ← $3 = fechaReserva
  );

  if (duplicado.rows.length > 0) {
    const error = new Error('Asistencia ya registrada hoy');
    error.statusCode = 409;
    throw error;
  }

  const insert = await client.query(
    `INSERT INTO asistencia (sesion_id, socio_id, fecha, presente)
     VALUES ($1, $2, $3, TRUE)
     RETURNING asistencia_id`,
    [sesionId, socioId, fechaReserva]   // ← $3 = fechaReserva
  );

  const nombre = await obtenerNombreSocio(client, socioId);

  return {
    asistencia_id: insert.rows[0].asistencia_id,
    nombre,
    tipo_participante: 'socio',
    inscrito_ahora: inscritoAhora
  };
};

const registrarAsistenciaVisita = async (client, sesionId, visitaId) => {
  const duplicado = await client.query(
    `SELECT asistencia_id FROM asistencia
     WHERE sesion_id = $1 AND visita_id = $2 AND fecha = CURRENT_DATE`,
    [sesionId, visitaId]
  );

  if (duplicado.rows.length > 0) {
    const error = new Error('Asistencia ya registrada hoy');
    error.statusCode = 409;
    throw error;
  }

  const visitaResult = await client.query(
    `SELECT nombre_completo FROM visitas WHERE visita_id = $1`,
    [visitaId]
  );

  if (visitaResult.rows.length === 0) {
    const error = new Error('Visita no encontrada');
    error.statusCode = 404;
    throw error;
  }

  const insert = await client.query(
    `INSERT INTO asistencia (sesion_id, visita_id, fecha, presente)
     VALUES ($1, $2, CURRENT_DATE, TRUE)
     RETURNING asistencia_id`,
    [sesionId, visitaId]
  );

  return {
    asistencia_id: insert.rows[0].asistencia_id,
    nombre: visitaResult.rows[0].nombre_completo,
    tipo_participante: 'visita'
  };
};

const asistenciaQrController = {
  registrarAsistenciaQr: async (req, res) => {
    const sesionId = parsePositiveInteger(req.params.sesion_id);
    const fechaReserva = req.body?.fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

    if (!sesionId) {
      return sendError(res, 400, 'sesion_id debe ser un entero positivo');
    }

    let payload;

    try {
      payload = validarYExtraerPayload(req.body?.codigo_qr);
    } catch (error) {
      if (error.statusCode === 400) return sendError(res, 400, error.message);
      if (error.statusCode === 401) return sendError(res, 401, 'QR inválido o HMAC inválido');
      console.error('Error al validar QR:', error);
      return sendError(res, 500, 'Error al validar código QR');
    }

    if (!TIPOS_SOPORTADOS.includes(payload.type)) {
      return sendError(res, 401, 'Tipo de QR no soportado');
    }

    // Visita QRs caducan después de 24h (campo expira_en en el payload)
    if (payload.type === 'visita' && payload.expira_en) {
      if (new Date(payload.expira_en) <= new Date()) {
        return sendError(res, 401, 'QR de visita expirado');
      }
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let resultado;

      if (payload.type === 'socio') {
        const socioId = parsePositiveInteger(payload.socio_id);
        if (!socioId) {
          await client.query('ROLLBACK');
          return sendError(res, 401, 'QR inválido o HMAC inválido');
        }
        resultado = await registrarAsistenciaSocio(client, sesionId, socioId, fechaReserva);

      } else {
        const visitaId = parsePositiveInteger(payload.visita_id);
        if (!visitaId) {
          await client.query('ROLLBACK');
          return sendError(res, 401, 'QR inválido o HMAC inválido');
        }
        resultado = await registrarAsistenciaVisita(client, sesionId, visitaId);
      }

      await client.query('COMMIT');

      return res.status(201).json({
        asistencia_id: resultado.asistencia_id,
        nombre: resultado.nombre,
        tipo_participante: resultado.tipo_participante,
        sesion_id: sesionId,
        presente: true
      });
    } catch (error) {
      await client.query('ROLLBACK');

      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }

      console.error('Error en registrarAsistenciaQr:', error);
      return sendError(res, 500, 'Error al registrar asistencia por QR');
    } finally {
      client.release();
    }
  }
};

module.exports = asistenciaQrController;