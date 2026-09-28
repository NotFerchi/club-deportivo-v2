/**
 * Códigos QR firmados (HMAC) para pases y visitas legacy, con vigencia de 24 h.
 */
const QRCode = require('qrcode');
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { connectOrEscalate } = require('./escalate');
const { rollbackQuietly } = require('./transaction');
const { generarHmacSha256 } = require('../utils/qrCrypto');
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

module.exports = { generarQrPase, generarQrVisitaLegacy, obtenerQrPase };
