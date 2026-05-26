const QRCode = require('qrcode');
const pool = require('../config/database');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const { getTableColumns } = require('../utils/adminRules');

const TIPOS_QR_SOPORTADOS = ['socio', 'visita', 'pase'];

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

const buscarPasePorQr = async (client, codigosQr) => {
  try {
    const result = await client.query(
      `SELECT
          q.qr_id,
          q.expira_en,
          p.pase_id,
          p.nombre_completo
       FROM codigos_qr_pases q
       JOIN pases p ON p.pase_id = q.pase_id
       WHERE q.codigo_qr = ANY($1::text[])
         AND q.activo = TRUE
         AND q.expira_en > NOW()
         AND p.estado = 'activo'
       ORDER BY q.created_at DESC, q.qr_id DESC
       LIMIT 1
       FOR UPDATE OF q, p`,
      [codigosQr]
    );
    return result.rows[0] || null;
  } catch (error) {
    if (error?.code === '42P01') return null;
    throw error;
  }
};

const obtenerUltimoTipoAcceso = async (client, { socioId, visitaId, paseId }) => {
  const columns = await getTableColumns('registro_acceso');
  const paseFilter = columns.has('pase_id')
    ? 'OR ($3::int IS NOT NULL AND pase_id = $3)'
    : '';
  const result = await client.query(
    `SELECT tipo
     FROM registro_acceso
     WHERE ($1::int IS NOT NULL AND socio_id = $1)
        OR ($2::int IS NOT NULL AND visita_id = $2)
        ${paseFilter}
     ORDER BY "timestamp" DESC, acceso_id DESC
     LIMIT 1`,
    [socioId, visitaId, paseId || null]
  );

  return result.rows[0]?.tipo || null;
};

const calcularTipoAcceso = (ultimoTipo) => {
  return ultimoTipo === 'entrada' ? 'salida' : 'entrada';
};

const insertarRegistroAcceso = async (client, { socioId, visitaId, paseId, tipo }) => {
  if (paseId) {
    const columns = await getTableColumns('registro_acceso');
    if (!columns.has('pase_id')) {
      const error = new Error('La tabla registro_acceso no tiene pase_id configurado');
      error.statusCode = 500;
      throw error;
    }

    const result = await client.query(
      `INSERT INTO registro_acceso (
          socio_id,
          visita_id,
          pase_id,
          tipo,
          metodo,
          "timestamp"
        )
        VALUES (NULL, NULL, $1, $2, $3, NOW())
        RETURNING acceso_id, "timestamp"`,
      [paseId, tipo, 'qr']
    );

    return result.rows[0];
  }

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
    visitaId: null,
    paseId: null
  });
  const tipo = calcularTipoAcceso(ultimoTipo);
  const registro = await insertarRegistroAcceso(client, {
    socioId,
    visitaId: null,
    paseId: null,
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
    visitaId,
    paseId: null
  });
  const tipo = calcularTipoAcceso(ultimoTipo);
  const registro = await insertarRegistroAcceso(client, {
    socioId: null,
    visitaId,
    paseId: null,
    tipo
  });

  return {
    tipo,
    nombre_completo: visita.nombre_completo,
    timestamp: toIsoTimestamp(registro.timestamp)
  };
};

const registrarAccesoPase = async (client, codigosQr) => {
  const pase = await buscarPasePorQr(client, codigosQr);

  if (!pase) {
    const error = new Error('QR expirado o pase no activo');
    error.statusCode = 401;
    throw error;
  }

  const paseId = pase.pase_id;
  const ultimoTipo = await obtenerUltimoTipoAcceso(client, {
    socioId: null,
    visitaId: null,
    paseId
  });
  const tipo = calcularTipoAcceso(ultimoTipo);
  const registro = await insertarRegistroAcceso(client, {
    socioId: null,
    visitaId: null,
    paseId,
    tipo
  });

  if (tipo === 'salida') {
    await client.query(
      `UPDATE pases
       SET hora_salida = NOW(), estado = 'finalizado'
       WHERE pase_id = $1 AND estado = 'activo'`,
      [paseId]
    );
  }

  return {
    tipo,
    nombre_completo: pase.nombre_completo,
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

      let acceso;
      if (payload.type === 'socio') {
        acceso = await registrarAccesoSocio(client, codigosQr);
      } else if (payload.type === 'pase') {
        acceso = await registrarAccesoPase(client, codigosQr);
      } else {
        acceso = await registrarAccesoVisita(client, codigosQr);
      }

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
