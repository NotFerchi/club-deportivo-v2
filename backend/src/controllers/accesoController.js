const QRCode = require('qrcode');
const pool = require('../config/database');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');

const TIPOS_QR_SOPORTADOS = ['socio', 'visita'];

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const isNonEmptyString = (value) => {
  return typeof value === 'string' && value.trim().length > 0;
};

const buildCodigoQrCandidates = async (codigoQr) => {
  const qrImage = await QRCode.toDataURL(codigoQr);
  return qrImage === codigoQr ? [codigoQr] : [codigoQr, qrImage];
};

const buscarSocioPorQr = async (client, codigosQr) => {
  const result = await client.query(
    `SELECT
        q.qr_id,
        s.socio_id,
        s.activo,
        COALESCE(
          NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), ''),
          s.numero_socio,
          CONCAT('Socio ', s.socio_id)
        ) AS nombre_completo
     FROM codigos_qr_socios q
     JOIN socios s ON s.socio_id = q.socio_id
     LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
     WHERE q.codigo_qr = ANY($1::text[])
       AND q.activo = TRUE
     ORDER BY q.created_at DESC, q.qr_id DESC
     LIMIT 1
     FOR UPDATE OF q, s`,
    [codigosQr]
  );

  return result.rows[0] || null;
};

const buscarVisitaPorQr = async (client, codigosQr) => {
  const result = await client.query(
    `SELECT
        q.qr_id,
        q.expira_en,
        v.visita_id,
        v.nombre_completo
     FROM codigos_qr_visitas q
     JOIN visitas v ON v.visita_id = q.visita_id
     WHERE q.codigo_qr = ANY($1::text[])
       AND q.activo = TRUE
       AND q.expira_en > NOW()
     ORDER BY q.created_at DESC, q.qr_id DESC
     LIMIT 1
     FOR UPDATE OF q, v`,
    [codigosQr]
  );

  return result.rows[0] || null;
};

const obtenerUltimoTipoAcceso = async (client, { socioId, visitaId }) => {
  const result = await client.query(
    `SELECT tipo
     FROM registro_acceso
     WHERE ($1::int IS NOT NULL AND socio_id = $1)
        OR ($2::int IS NOT NULL AND visita_id = $2)
     ORDER BY "timestamp" DESC, acceso_id DESC
     LIMIT 1`,
    [socioId, visitaId]
  );

  return result.rows[0]?.tipo || null;
};

const calcularTipoAcceso = (ultimoTipo) => {
  return ultimoTipo === 'entrada' ? 'salida' : 'entrada';
};

const insertarRegistroAcceso = async (client, { socioId, visitaId, tipo }) => {
  const result = await client.query(
    `INSERT INTO registro_acceso (
        socio_id,
        visita_id,
        tipo,
        metodo,
        "timestamp"
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING acceso_id, "timestamp"`,
    [socioId, visitaId, tipo, 'qr']
  );

  return result.rows[0];
};

const toIsoTimestamp = (timestamp) => {
  return timestamp instanceof Date ? timestamp.toISOString() : timestamp;
};

const registrarAccesoSocio = async (client, codigosQr) => {
  const socio = await buscarSocioPorQr(client, codigosQr);

  if (!socio) {
    const error = new Error('QR de socio no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (socio.activo === false) {
    const error = new Error('Socio inactivo');
    error.statusCode = 403;
    throw error;
  }

  const socioId = socio.socio_id;
  const ultimoTipo = await obtenerUltimoTipoAcceso(client, {
    socioId,
    visitaId: null
  });
  const tipo = calcularTipoAcceso(ultimoTipo);
  const registro = await insertarRegistroAcceso(client, {
    socioId,
    visitaId: null,
    tipo
  });

  return {
    tipo,
    nombre_completo: socio.nombre_completo,
    timestamp: toIsoTimestamp(registro.timestamp)
  };
};

const registrarAccesoVisita = async (client, codigosQr) => {
  const visita = await buscarVisitaPorQr(client, codigosQr);

  if (!visita) {
    const error = new Error('QR expirado');
    error.statusCode = 401;
    throw error;
  }

  const visitaId = visita.visita_id;
  const ultimoTipo = await obtenerUltimoTipoAcceso(client, {
    socioId: null,
    visitaId
  });
  const tipo = calcularTipoAcceso(ultimoTipo);
  const registro = await insertarRegistroAcceso(client, {
    socioId: null,
    visitaId,
    tipo
  });

  return {
    tipo,
    nombre_completo: visita.nombre_completo,
    timestamp: toIsoTimestamp(registro.timestamp)
  };
};

const accesoController = {
  lecturaQr: async (req, res) => {
    const codigoQrInput = req.body?.codigo_qr;

    if (codigoQrInput === undefined || codigoQrInput === null) {
      return sendError(res, 400, 'codigo_qr es requerido');
    }

    if (!isNonEmptyString(codigoQrInput)) {
      return sendError(res, 400, 'codigo_qr debe ser una cadena no vacia');
    }

    const codigoQr = codigoQrInput.trim();
    let payload;
    let codigosQr;

    try {
      payload = validarQrFirmado(codigoQr);
      codigosQr = await buildCodigoQrCandidates(codigoQr);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }

      console.error('Error al validar QR:', error);
      return sendError(res, 500, 'Error al validar codigo QR');
    }

    if (!TIPOS_QR_SOPORTADOS.includes(payload.type)) {
      return sendError(res, 400, 'Tipo de QR no soportado');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const acceso = payload.type === 'socio'
        ? await registrarAccesoSocio(client, codigosQr)
        : await registrarAccesoVisita(client, codigosQr);

      await client.query('COMMIT');

      return res.status(201).json({
        ...acceso,
        mensaje: acceso.tipo === 'entrada'
          ? 'Entrada registrada correctamente'
          : 'Salida registrada correctamente'
      });
    } catch (error) {
      await client.query('ROLLBACK');

      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }

      console.error('Error en lecturaQr:', error);
      return sendError(res, 500, 'Error al registrar acceso por QR');
    } finally {
      client.release();
    }
  }
};

module.exports = accesoController;
