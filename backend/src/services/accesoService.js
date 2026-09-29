/**
 * Control de acceso por QR (entradas/salidas de socios, visitas y pases) y
 * métricas de accesos.
 */
const QRCode = require('qrcode');
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { validarQrFirmado } = require('../helpers/qrSecurity.helper');
const { getTableColumns } = require('../utils/adminRules');

const TIPOS_QR_SOPORTADOS = ['socio', 'visita', 'pase'];

/** Error con statusCode: el controlador responde ese status con el mensaje. */
function errorConStatus(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/** La columna codigo_qr puede guardar el texto o su imagen: se buscan ambos. */
const buildCodigoQrCandidates = async (codigoQr) => {
  const qrImage = await QRCode.toDataURL(codigoQr);
  return qrImage === codigoQr ? [codigoQr] : [codigoQr, qrImage];
};

// ── Búsqueda por QR ──────────────────────────────────────────────────────────

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

/** Pase activo y vigente; null también si la tabla pases no existe. */
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

// ── Registro de acceso ───────────────────────────────────────────────────────

const obtenerUltimoTipoAcceso = async (client, { socioId, visitaId, paseId }) => {
  const columns = await getTableColumns('registro_acceso');
  const paseFilter = columns.has('pase_id') ? 'OR ($3::int IS NOT NULL AND pase_id = $3)' : '';
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

/** Alterna: tras una entrada toca salida; en cualquier otro caso, entrada. */
const calcularTipoAcceso = (ultimoTipo) => (ultimoTipo === 'entrada' ? 'salida' : 'entrada');

const insertarRegistroAcceso = async (client, { socioId, visitaId, paseId, tipo }) => {
  if (paseId) {
    const columns = await getTableColumns('registro_acceso');
    if (!columns.has('pase_id')) {
      throw errorConStatus('La tabla registro_acceso no tiene pase_id configurado', 500);
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

const toIsoTimestamp = (timestamp) => (timestamp instanceof Date ? timestamp.toISOString() : timestamp);

/** Registra el movimiento alternado (entrada/salida) de la persona identificada. */
async function registrarMovimiento(client, ids, nombreCompleto) {
  const tipo = calcularTipoAcceso(await obtenerUltimoTipoAcceso(client, ids));
  const registro = await insertarRegistroAcceso(client, { ...ids, tipo });
  return { tipo, nombre_completo: nombreCompleto, timestamp: toIsoTimestamp(registro.timestamp) };
}

const registrarAccesoSocio = async (client, codigosQr) => {
  const socio = await buscarSocioPorQr(client, codigosQr);
  if (!socio) throw errorConStatus('QR de socio no encontrado', 404);
  if (socio.activo === false) throw errorConStatus('Socio inactivo', 403);

  return registrarMovimiento(client, { socioId: socio.socio_id, visitaId: null, paseId: null }, socio.nombre_completo);
};

const registrarAccesoVisita = async (client, codigosQr) => {
  const visita = await buscarVisitaPorQr(client, codigosQr);
  if (!visita) throw errorConStatus('QR expirado', 401);

  return registrarMovimiento(
    client,
    { socioId: null, visitaId: visita.visita_id, paseId: null },
    visita.nombre_completo
  );
};

/** Además de registrar el acceso, una salida finaliza el pase. */
const registrarAccesoPase = async (client, codigosQr) => {
  const pase = await buscarPasePorQr(client, codigosQr);
  if (!pase) throw errorConStatus('QR expirado o pase no activo', 401);

  const paseId = pase.pase_id;
  const acceso = await registrarMovimiento(client, { socioId: null, visitaId: null, paseId }, pase.nombre_completo);

  if (acceso.tipo === 'salida') {
    await client.query(
      `UPDATE pases
       SET hora_salida = NOW(), estado = 'finalizado'
       WHERE pase_id = $1 AND estado = 'activo'`,
      [paseId]
    );
  }

  return acceso;
};

// ── API del servicio ─────────────────────────────────────────────────────────

/**
 * Valida el código leído (sin tocar la BD). Devuelve { payload, codigosQr }.
 * Errores de firma con statusCode → ese status; otros → 500 (registrado).
 */
async function validarLectura(codigoQrInput) {
  // codigo_qr requerido y cadena no vacía: validado en la ruta
  const codigoQr = codigoQrInput.trim();
  let payload;
  let codigosQr;
  try {
    payload = validarQrFirmado(codigoQr);
    codigosQr = await buildCodigoQrCandidates(codigoQr);
  } catch (error) {
    if (error.statusCode) throw new ServiceError(error.statusCode, { error: error.message });
    console.error('Error al validar QR:', error);
    throw new ServiceError(500, { error: 'Error al validar codigo QR' });
  }

  if (!TIPOS_QR_SOPORTADOS.includes(payload.type)) {
    throw new ServiceError(400, { error: 'Tipo de QR no soportado' });
  }
  return { payload, codigosQr };
}

/** Registra el acceso según el tipo de QR. Devuelve { tipo, nombre_completo, timestamp }. */
async function registrarLectura({ payload, codigosQr }) {
  return enTransaccion(async (client) => {
    if (payload.type === 'socio') return registrarAccesoSocio(client, codigosQr);
    if (payload.type === 'pase') return registrarAccesoPase(client, codigosQr);
    return registrarAccesoVisita(client, codigosQr);
  });
}

// ── Métricas ─────────────────────────────────────────────────────────────────

/**
 * Métricas de accesos entre `desde` y `hasta` (inclusive). `tipo` filtra por
 * persona (socio o visita), no por movimiento. Fechas y tipo: validados en la ruta.
 */
async function obtenerMetricas({ desde, hasta, tipo }) {
  let tipoFilter = '';
  let topSociosTipoFilter = '';
  if (tipo === 'socio') {
    tipoFilter = 'AND socio_id IS NOT NULL';
    topSociosTipoFilter = 'AND ra.socio_id IS NOT NULL';
  } else if (tipo === 'visita') {
    tipoFilter = 'AND visita_id IS NOT NULL';
    topSociosTipoFilter = 'AND ra.visita_id IS NOT NULL';
  }

  const params = [desde, hasta];
  // hasta incluye todo el día indicado
  const whereBase = `"timestamp" >= $1::date AND "timestamp" < ($2::date + INTERVAL '1 day') ${tipoFilter}`;
  const topSociosWhere = `ra."timestamp" >= $1::date AND ra."timestamp" < ($2::date + INTERVAL '1 day') ${topSociosTipoFilter}`;

  const [totalesRes, horariosPicoRes, accesosDiaRes, topSociosRes] = await Promise.all([
    pool.query(
      `SELECT
             COUNT(*) AS total_accesos,
             COUNT(*) FILTER (WHERE tipo = 'entrada') AS total_entradas,
             COUNT(*) FILTER (WHERE tipo = 'salida') AS total_salidas
           FROM registro_acceso
           WHERE ${whereBase}`,
      params
    ),
    pool.query(
      `SELECT EXTRACT(HOUR FROM "timestamp")::int AS hora, COUNT(*)::int AS total
           FROM registro_acceso
           WHERE ${whereBase}
           GROUP BY hora
           ORDER BY total DESC`,
      params
    ),
    pool.query(
      `SELECT DATE("timestamp") AS fecha, COUNT(*)::int AS total
           FROM registro_acceso
           WHERE ${whereBase}
           GROUP BY fecha
           ORDER BY fecha ASC`,
      params
    ),
    pool.query(
      `SELECT
             ra.socio_id,
             COALESCE(
               NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), ''),
               CONCAT('Socio ', ra.socio_id)
             ) AS nombre,
             COUNT(*)::int AS total_accesos
           FROM registro_acceso ra
           LEFT JOIN socios s ON s.socio_id = ra.socio_id
           LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
           WHERE ${topSociosWhere}
             AND ra.socio_id IS NOT NULL
           GROUP BY ra.socio_id, u.nombres, u.apellido_paterno, u.apellido_materno
           ORDER BY total_accesos DESC
           LIMIT 10`,
      params
    )
  ]);

  const totalesRow = totalesRes.rows[0];
  const totalAccesos = parseInt(totalesRow.total_accesos, 10);

  const fechaDesde = new Date(desde + 'T00:00:00Z');
  const fechaHasta = new Date(hasta + 'T00:00:00Z');
  const dias = Math.max(1, Math.round((fechaHasta - fechaDesde) / (1000 * 60 * 60 * 24)) + 1);

  return {
    total_accesos: totalAccesos,
    total_entradas: parseInt(totalesRow.total_entradas, 10),
    total_salidas: parseInt(totalesRow.total_salidas, 10),
    promedio_diario: totalAccesos === 0 ? 0 : parseFloat((totalAccesos / dias).toFixed(2)),
    horarios_pico: horariosPicoRes.rows.map((r) => ({ hora: r.hora, total: r.total })),
    accesos_por_dia: accesosDiaRes.rows.map((r) => ({
      fecha: r.fecha instanceof Date ? r.fecha.toISOString().split('T')[0] : String(r.fecha),
      total: r.total
    })),
    top_socios: topSociosRes.rows.map((r) => ({
      socio_id: r.socio_id,
      nombre: r.nombre,
      total_accesos: r.total_accesos
    }))
  };
}

module.exports = { validarLectura, registrarLectura, obtenerMetricas };
