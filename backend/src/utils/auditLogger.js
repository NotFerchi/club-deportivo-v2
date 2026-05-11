const pool = require('../config/database');

function getIp(req) {
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

function normalizeDetails(details) {
  if (!details) return null;
  if (typeof details === 'string') return details.slice(0, 1000);
  return JSON.stringify(details).slice(0, 1000);
}

async function logAudit(req, data = {}) {
  try {
    await pool.query(
      `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen, registro_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req?.user?.usuario_id || data.usuario_id || null,
        data.accion,
        data.tabla_afectada || null,
        normalizeDetails(data.detalles),
        getIp(req),
        data.registro_id || null
      ]
    );
  } catch (error) {
    console.warn('No se pudo guardar auditoria:', error.message);
  }
}

module.exports = { logAudit };
