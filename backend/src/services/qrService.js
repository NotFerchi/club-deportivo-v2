/**
 * Códigos QR firmados (HMAC): pases y visitas (vigencia 24 h) y socios
 * (generación, consulta e identificación en el control de acceso).
 */
const QRCode = require('qrcode');
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { connectOrEscalate } = require('./escalate');
const { enTransaccion, rollbackQuietly } = require('./transaction');
const { generarHmacSha256 } = require('../utils/qrCrypto');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const { isMissingPasesTable } = require('./paseService');

const VISITA_QR_TTL_MS = 24 * 60 * 60 * 1000;

/** Payload firmado + imagen del QR. */
async function construirQr(tipo, campoId, id) {
  const expiraEn = new Date(Date.now() + VISITA_QR_TTL_MS);
  const expiraEnIso = expiraEn.toISOString();
  const payload = {
    type: tipo,
    [campoId]: Number(id),
    expira_en: expiraEnIso
  };
  const hash = generarHmacSha256(payload);
  const codigoQr = JSON.stringify({ ...payload, hash });
  const qrImage = await QRCode.toDataURL(codigoQr);
  return { expiraEn, expiraEnIso, codigoQr, qrImage };
}

/**
 * Genera y guarda (upsert) el QR de un pase dentro de la transacción de
 * `client`. Si no se puede guardar, revierte al savepoint y devuelve el QR
 * con qr_id null.
 */
const generarQrPase = async (client, paseId) => {
  const { expiraEn, expiraEnIso, codigoQr, qrImage } = await construirQr('pase', 'pase_id', paseId);

  try {
    // SAVEPOINT protects the outer transaction if the INSERT fails
    // (e.g. table missing, unique constraint on re-generation)
    await client.query('SAVEPOINT before_qr_pase');
    const qrResult = await client.query(
      `INSERT INTO codigos_qr_pases (pase_id, codigo_qr, expira_en, activo)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (pase_id) DO UPDATE
               SET codigo_qr = EXCLUDED.codigo_qr,
                   expira_en = EXCLUDED.expira_en,
                   activo    = TRUE
             RETURNING qr_id`,
      [paseId, qrImage, expiraEn]
    );

    return { qr_id: qrResult.rows[0].qr_id, qr_image: qrImage, codigo_qr: codigoQr, expira_en: expiraEnIso };
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT before_qr_pase').catch(() => null);
    console.warn('No se pudo persistir QR de pase:', error.message);
    return { qr_id: null, qr_image: qrImage, codigo_qr: codigoQr, expira_en: expiraEnIso };
  }
};

/** Igual que generarQrPase para la tabla legacy `visitas` (sin transacción). */
const generarQrVisitaLegacy = async (visitaId) => {
  const { expiraEn, expiraEnIso, codigoQr, qrImage } = await construirQr('visita', 'visita_id', visitaId);

  try {
    const qrResult = await pool.query(
      `INSERT INTO codigos_qr_visitas (visita_id, codigo_qr, expira_en, activo)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (visita_id) DO UPDATE
               SET codigo_qr = EXCLUDED.codigo_qr,
                   expira_en = EXCLUDED.expira_en,
                   activo    = TRUE
             RETURNING qr_id`,
      [visitaId, qrImage, expiraEn]
    );
    return { qr_id: qrResult.rows[0].qr_id, qr_image: qrImage, codigo_qr: codigoQr, expira_en: expiraEnIso };
  } catch (error) {
    console.warn('No se pudo persistir QR de visita legacy:', error.message);
    return { qr_id: null, qr_image: qrImage, codigo_qr: codigoQr, expira_en: expiraEnIso };
  }
};

const PASE_INACTIVO = { error: 'El pase ya no está activo' };
const PASE_NO_ENCONTRADO = { error: 'Pase no encontrado' };

/** Intento 1: tabla pases. Devuelve el QR, null si no hay pase, o lanza ServiceError. */
async function qrDesdePases(id) {
  const client = await connectOrEscalate(pool);
  try {
    await client.query('BEGIN');

    let paseIdFinal = null;
    let paseActivo = false;

    try {
      const r = await client.query(`SELECT pase_id, estado FROM pases WHERE pase_id = $1`, [id]);
      if (r.rows.length > 0) {
        paseIdFinal = r.rows[0].pase_id;
        paseActivo = r.rows[0].estado === 'activo';
      }
    } catch (e) {
      if (!isMissingPasesTable(e)) throw e;
    }

    if (paseIdFinal) {
      if (!paseActivo) {
        await client.query('ROLLBACK');
        return { error: new ServiceError(400, PASE_INACTIVO) };
      }
      const qr = await generarQrPase(client, paseIdFinal);
      await client.query('COMMIT');
      return { qr };
    }

    await rollbackQuietly(client);
    return null;
  } catch (error) {
    await rollbackQuietly(client);
    console.error('obtenerQrPase (pases):', error);
    return { error: new ServiceError(500, { error: 'Error al generar QR' }) };
  } finally {
    client.release();
  }
}

/** Intento 2: tabla legacy visitas; cualquier error responde 404. */
async function qrDesdeVisitas(id) {
  try {
    const rv = await pool.query(`SELECT visita_id, vigente FROM visitas WHERE visita_id = $1`, [id]);

    if (rv.rows.length === 0) return { error: new ServiceError(404, PASE_NO_ENCONTRADO) };
    if (rv.rows[0].vigente === false) return { error: new ServiceError(400, PASE_INACTIVO) };

    return { qr: await generarQrVisitaLegacy(id) };
  } catch (error) {
    console.error('obtenerQrPase (visitas):', error);
    return { error: new ServiceError(404, PASE_NO_ENCONTRADO) };
  }
}

/** QR vigente de un pase (o visita legacy). Devuelve { qr_image, expira_en }. */
async function obtenerQrPase(id) {
  const resultado = (await qrDesdePases(id)) || (await qrDesdeVisitas(id));
  if (resultado.error) throw resultado.error;
  return { qr_image: resultado.qr.qr_image, expira_en: resultado.qr.expira_en };
}

// ── QR de socios y visitas (/api/qr) ─────────────────────────────────────────

/** Genera un QR nuevo para el socio y desactiva los anteriores. */
async function generarQrSocio(socioIdParam) {
  const socioId = Number(socioIdParam); // entero positivo: validado en la ruta

  return enTransaccion(async (client) => {
    const socioResult = await client.query('SELECT socio_id, activo FROM socios WHERE socio_id = $1 FOR UPDATE', [
      socioId
    ]);
    if (socioResult.rows.length === 0) throw new ServiceError(404, { error: 'Socio no encontrado' });
    if (!socioResult.rows[0].activo) throw new ServiceError(400, { error: 'El socio no esta activo' });

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
    const qrImage = await QRCode.toDataURL(JSON.stringify({ ...payload, hash }));

    const qrResult = await client.query(
      `INSERT INTO codigos_qr_socios (socio_id, codigo_qr, activo)
         VALUES ($1, $2, TRUE)
         RETURNING qr_id`,
      [socioId, qrImage]
    );

    return { qr_id: qrResult.rows[0].qr_id, qr_image: qrImage, socio_id: socioId };
  });
}

/** Genera el QR (24 h) de una visita legacy vigente. */
async function generarQrVisita(visitaIdParam) {
  const visitaId = Number(visitaIdParam); // entero positivo: validado en la ruta

  return enTransaccion(async (client) => {
    const visitaResult = await client.query('SELECT visita_id, vigente FROM visitas WHERE visita_id = $1 FOR UPDATE', [
      visitaId
    ]);
    if (visitaResult.rows.length === 0 || !visitaResult.rows[0].vigente) {
      throw new ServiceError(404, { error: 'Visita no encontrada o no vigente' });
    }

    const expiraEn = new Date(Date.now() + VISITA_QR_TTL_MS);
    const expiraEnIso = expiraEn.toISOString();
    const payload = {
      visita_id: visitaId,
      expira_en: expiraEnIso,
      type: 'visita'
    };
    const hash = generarHmacSha256(payload);
    const qrImage = await QRCode.toDataURL(JSON.stringify({ ...payload, hash }));

    const qrResult = await client.query(
      `INSERT INTO codigos_qr_visitas (visita_id, codigo_qr, expira_en, activo)
         VALUES ($1, $2, $3, TRUE)
         RETURNING qr_id`,
      [visitaId, qrImage, expiraEn]
    );

    return { qr_id: qrResult.rows[0].qr_id, qr_image: qrImage, expira_en: expiraEnIso };
  });
}

/** Último QR activo del socio. */
async function qrActivoSocio(socioIdParam) {
  const socioId = Number(socioIdParam); // entero positivo: validado en la ruta

  const result = await pool.query(
    `SELECT qr_id, socio_id, codigo_qr
         FROM codigos_qr_socios
         WHERE socio_id = $1 AND activo = TRUE
         ORDER BY created_at DESC, qr_id DESC
         LIMIT 1`,
    [socioId]
  );
  if (result.rows.length === 0) throw new ServiceError(404, { error: 'No existe QR activo para el socio' });

  const qr = result.rows[0];
  return { qr_id: qr.qr_id, qr_image: qr.codigo_qr, socio_id: qr.socio_id };
}

/** QR activo del socio del usuario autenticado. */
async function miQr(usuarioId) {
  if (!usuarioId) throw new ServiceError(401, { error: 'No autenticado' });

  const socioResult = await pool.query(
    `SELECT socio_id, activo, numero_socio
         FROM socios WHERE usuario_id = $1`,
    [usuarioId]
  );
  if (socioResult.rows.length === 0) {
    throw new ServiceError(404, { error: 'No se encontró perfil de socio para este usuario' });
  }

  const socio = socioResult.rows[0];
  if (!socio.activo) throw new ServiceError(400, { error: 'El socio no está activo' });

  const result = await pool.query(
    `SELECT qr_id, socio_id, codigo_qr, created_at
         FROM codigos_qr_socios
         WHERE socio_id = $1 AND activo = TRUE
         ORDER BY created_at DESC, qr_id DESC
         LIMIT 1`,
    [socio.socio_id]
  );
  if (result.rows.length === 0) {
    throw new ServiceError(404, { error: 'No tienes un QR activo. Solicítalo en recepción.' });
  }

  const qr = result.rows[0];
  return {
    qr_id: qr.qr_id,
    qr_image: qr.codigo_qr,
    socio_id: qr.socio_id,
    numero_socio: socio.numero_socio,
    generado_en: qr.created_at
  };
}

/**
 * Valida un QR firmado de socio (sin tocar la BD). Errores de firma → su
 * statusCode o 401. Devuelve el socioId.
 */
function socioIdDesdeQr(codigoQr) {
  // codigo_qr requerido: validado en la ruta
  let payload;
  try {
    payload = validarQrFirmado(codigoQr);
  } catch (err) {
    throw new ServiceError(err.statusCode || 401, { error: err.message });
  }

  if (payload.type !== 'socio') throw new ServiceError(400, { error: 'Este endpoint es solo para socios' });

  const socioId = Number(payload.socio_id);
  if (!Number.isInteger(socioId) || socioId <= 0) {
    throw new ServiceError(400, { error: 'QR inválido: socio_id no válido' });
  }
  return socioId;
}

/**
 * Datos del socio para el control de acceso.
 * Cuenta sanciones con estado 'activa'/'activo' (insensible a mayúsculas y
 * género — bug #27 corregido el 2026-09-29: la comparación exacta contra
 * 'Activo' nunca coincidía porque las sanciones se crean con estado 'Activa').
 */
async function identificarSocio(socioId) {
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
  if (result.rowCount === 0) throw new ServiceError(404, { error: 'Socio no encontrado' });

  const socio = result.rows[0];
  if (!socio.activo) throw new ServiceError(403, { error: 'El socio no está activo' });

  const sancionesResult = await pool.query(
    `SELECT COUNT(*) AS total
         FROM sanciones
         WHERE socio_id = $1 AND LOWER(estado::text) IN ('activo', 'activa')`,
    [socioId]
  );
  const sancionesActivas = parseInt(sancionesResult.rows[0].total) || 0;

  return {
    socio_id: socio.socio_id,
    numero_socio: socio.numero_socio,
    nombre_completo: socio.nombre_completo,
    telefono: socio.telefono || null,
    tipo: socio.tipo || null,
    modalidad: socio.modalidad || null,
    es_titular: socio.es_titular ?? null,
    fecha_nacimiento: socio.fecha_nacimiento || null,
    sanciones_activas: sancionesActivas
  };
}

module.exports = {
  generarQrPase,
  generarQrVisitaLegacy,
  obtenerQrPase,
  generarQrSocio,
  generarQrVisita,
  qrActivoSocio,
  miQr,
  socioIdDesdeQr,
  identificarSocio
};
