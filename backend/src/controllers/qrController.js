const QRCode = require('qrcode');
const pool = require('../config/database');
const { generarHmacSha256 } = require('../utils/qrCrypto');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');

const VISITA_QR_TTL_MS = 24 * 60 * 60 * 1000;

const parsePositiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const sendError = (res, status, message) => {
  return res.status(status).json({ error: message });
};

const qrController = {
  generarQrSocio: async (req, res) => {
    const socioId = parsePositiveInteger(req.body?.socio_id);

    if (!socioId) {
      return sendError(res, 400, 'socio_id debe ser un entero positivo');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const socioResult = await client.query(
        'SELECT socio_id, activo FROM socios WHERE socio_id = $1 FOR UPDATE',
        [socioId]
      );

      if (socioResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'Socio no encontrado');
      }

      if (!socioResult.rows[0].activo) {
        await client.query('ROLLBACK');
        return sendError(res, 400, 'El socio no esta activo');
      }

      await client.query(
        `UPDATE codigos_qr_socios
         SET activo = FALSE, updated_at = NOW()
         WHERE socio_id = $1 AND activo = TRUE`,
        [socioId]
      );

      const payload = {
        socio_id: socioId,
        timestamp: new Date().toISOString(),
        type: 'socio'
      };
      const hash = generarHmacSha256(payload);
      const codedString = JSON.stringify({ ...payload, hash });
      const qrImage = await QRCode.toDataURL(codedString);

      const qrResult = await client.query(
        `INSERT INTO codigos_qr_socios (socio_id, codigo_qr, activo)
         VALUES ($1, $2, TRUE)
         RETURNING qr_id`,
        [socioId, qrImage]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        qr_id: qrResult.rows[0].qr_id,
        qr_image: qrImage,
        socio_id: socioId
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('Error en generarQrSocio:', error);

      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }

      return sendError(res, 500, 'Error al generar codigo QR del socio');
    } finally {
      client.release();
    }
  },

  generarQrVisita: async (req, res) => {
    const visitaId = parsePositiveInteger(req.body?.visita_id);

    if (!visitaId) {
      return sendError(res, 400, 'visita_id debe ser un entero positivo');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const visitaResult = await client.query(
        'SELECT visita_id, vigente FROM visitas WHERE visita_id = $1 FOR UPDATE',
        [visitaId]
      );

      if (visitaResult.rows.length === 0 || !visitaResult.rows[0].vigente) {
        await client.query('ROLLBACK');
        return sendError(res, 404, 'Visita no encontrada o no vigente');
      }

      const expiraEn = new Date(Date.now() + VISITA_QR_TTL_MS);
      const expiraEnIso = expiraEn.toISOString();
      const payload = {
        visita_id: visitaId,
        expira_en: expiraEnIso,
        type: 'visita'
      };
      const hash = generarHmacSha256(payload);
      const codedString = JSON.stringify({ ...payload, hash });
      const qrImage = await QRCode.toDataURL(codedString);

      const qrResult = await client.query(
        `INSERT INTO codigos_qr_visitas (visita_id, codigo_qr, expira_en, activo)
         VALUES ($1, $2, $3, TRUE)
         RETURNING qr_id`,
        [visitaId, qrImage, expiraEn]
      );

      await client.query('COMMIT');

      return res.status(201).json({
        qr_id: qrResult.rows[0].qr_id,
        qr_image: qrImage,
        expira_en: expiraEnIso
      });
    } catch (error) {
      await client.query('ROLLBACK');

      console.error('Error en generarQrVisita:', error);

      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }

      return sendError(res, 500, 'Error al generar codigo QR de la visita');
    } finally {
      client.release();
    }
  },

  obtenerQrActivoSocio: async (req, res) => {
    const socioId = parsePositiveInteger(req.params?.socio_id);

    if (!socioId) {
      return sendError(res, 400, 'socio_id debe ser un entero positivo');
    }

    try {
      const result = await pool.query(
        `SELECT qr_id, socio_id, codigo_qr
         FROM codigos_qr_socios
         WHERE socio_id = $1 AND activo = TRUE
         ORDER BY created_at DESC, qr_id DESC
         LIMIT 1`,
        [socioId]
      );

      if (result.rows.length === 0) {
        return sendError(res, 404, 'No existe QR activo para el socio');
      }

      const qr = result.rows[0];
      return res.json({
        qr_id: qr.qr_id,
        qr_image: qr.codigo_qr,
        socio_id: qr.socio_id
      });
    } catch (error) {
      console.error('Error en obtenerQrActivoSocio:', error);
      return sendError(res, 500, 'Error al consultar codigo QR del socio');
    }
  },

  obtenerMiQr: async (req, res) => {
    const usuarioId = req.user?.usuario_id;
    if (!usuarioId) {
      return sendError(res, 401, 'No autenticado');
    }

    try {
      const socioResult = await pool.query(
        `SELECT socio_id, activo, numero_socio
         FROM socios WHERE usuario_id = $1`,
        [usuarioId]
      );

      if (socioResult.rows.length === 0) {
        return sendError(res, 404, 'No se encontró perfil de socio para este usuario');
      }

      const socio = socioResult.rows[0];
      if (!socio.activo) {
        return sendError(res, 400, 'El socio no está activo');
      }

      const result = await pool.query(
        `SELECT qr_id, socio_id, codigo_qr, created_at
         FROM codigos_qr_socios
         WHERE socio_id = $1 AND activo = TRUE
         ORDER BY created_at DESC, qr_id DESC
         LIMIT 1`,
        [socio.socio_id]
      );

      if (result.rows.length === 0) {
        return sendError(res, 404, 'No tienes un QR activo. Solicítalo en recepción.');
      }

      const qr = result.rows[0];
      return res.json({
        qr_id: qr.qr_id,
        qr_image: qr.codigo_qr,
        socio_id: qr.socio_id,
        numero_socio: socio.numero_socio,
        generado_en: qr.created_at
      });
    } catch (error) {
      console.error('Error en obtenerMiQr:', error);
      return sendError(res, 500, 'Error al obtener tu código QR');
    }
  }, // <-- Se agregó la coma de separación aquí

  identificarSocio: async (req, res) => {
    const { codigo_qr } = req.body;

    if (!codigo_qr) {
      return res.status(400).json({ error: 'codigo_qr es requerido' });
    }

    let payload;
    try {
      payload = validarQrFirmado(codigo_qr);
    } catch (err) {
      return res.status(err.statusCode || 401).json({ error: err.message });
    }

    if (payload.type !== 'socio') {
      return res.status(400).json({ error: 'Este endpoint es solo para socios' });
    }

    const socioId = Number(payload.socio_id);
    if (!Number.isInteger(socioId) || socioId <= 0) {
      return res.status(400).json({ error: 'QR inválido: socio_id no válido' });
    }

    try {
      const result = await pool.query(
        `SELECT
            s.socio_id,
            s.numero_socio,
            s.activo,
            s.tipo,
            s.modalidad,
            s.es_titular,
            u.nombres,
            u.apellido_paterno,
            u.apellido_materno,
            u.telefono,
            u.fecha_nacimiento,
            TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)) AS nombre_completo
         FROM socios s
         JOIN usuarios u ON s.usuario_id = u.usuario_id
         WHERE s.socio_id = $1`,
        [socioId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Socio no encontrado' });
      }

      const socio = result.rows[0];

      if (!socio.activo) {
        return res.status(403).json({ error: 'El socio no está activo' });
      }

      const sancionesResult = await pool.query(
        `SELECT COUNT(*) AS total
         FROM sanciones
         WHERE socio_id = $1 AND estado = 'Activo'`,
         [socioId]
      );
      const sancionesActivas = parseInt(sancionesResult.rows[0].total) || 0;

      return res.json({
        socio_id:          socio.socio_id,
        numero_socio:      socio.numero_socio,
        nombre_completo:   socio.nombre_completo,
        telefono:          socio.telefono || null,
        tipo:              socio.tipo || null,
        modalidad:         socio.modalidad || null,
        es_titular:        socio.es_titular ?? null,
        fecha_nacimiento:  socio.fecha_nacimiento || null,
        sanciones_activas: sancionesActivas
      });

    } catch (error) {
      console.error('Error en identificarSocio:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  },
};

module.exports = qrController;