/**
 * Pases de visita / de día (tabla `pases`) con respaldo a la tabla legacy
 * `visitas` cuando `pases` no existe (código 42P01).
 */
const pool = require('../config/database');

const LUDOTECA_TIME_ZONE = 'America/Mexico_City';
const CLUB_CLOSE_TIME = process.env.CLUB_HORA_CIERRE || '22:00';

const isMissingPasesTable = (error) => error?.code === '42P01' && String(error.message || '').includes('pases');

const normalizePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pasesSelect = `
    SELECT
        p.pase_id,
        p.pase_id as visita_id,
        p.tipo_pase,
        p.socio_id,
        p.socio_id as socio_anfitrion_id,
        p.nombre_completo,
        split_part(p.nombre_completo, ' ', 1) as nombre,
        NULLIF(BTRIM(SUBSTRING(p.nombre_completo FROM LENGTH(split_part(p.nombre_completo, ' ', 1)) + 1)), '') as apellidos,
        p.correo,
        p.telefono,
        p.mayor_16,
        p.identificacion,
        p.fecha_pase,
        p.fecha_pase as fecha_visita,
        p.hora_entrada,
        p.hora_salida,
        p.estado,
        (p.estado = 'activo') as vigente,
        p.observaciones,
        p.observaciones as motivo,
        NULL::text as identificacion,
        NULL::text as identificacion_tipo,
        s.numero_socio,
        NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), '') as socio_nombre,
        u.nombres as socio_anfitrion_nombre,
        u.apellido_paterno as socio_anfitrion_apellido,
        u.apellido_materno as socio_anfitrion_apellido_materno,
        u.username as socio_anfitrion_email
    FROM pases p
    LEFT JOIN socios s ON p.socio_id = s.socio_id
    LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id
`;

/** Columnas opcionales presentes en la tabla legacy `visitas`. */
const getVisitasLegacyColumns = async () => {
  const result = await pool.query(
    `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = 'visitas'
           AND column_name = ANY($1::text[])`,
    [['socio_id', 'correo', 'telefono', 'mayor_16', 'observaciones']]
  );

  const columns = new Set(result.rows.map((row) => row.column_name));

  return {
    socioId: columns.has('socio_id'),
    correo: columns.has('correo'),
    telefono: columns.has('telefono'),
    mayor16: columns.has('mayor_16'),
    observaciones: columns.has('observaciones')
  };
};

/** SELECT de `visitas` con los mismos alias que pasesSelect. */
const buildVisitasLegacySelect = (columns = {}) => `
    SELECT
        v.visita_id,
        v.visita_id as pase_id,
        CASE
            WHEN ${columns.socioId ? 'v.socio_id IS NOT NULL' : 'false'} THEN 'visita'
            WHEN LOWER(COALESCE(v.identificacion_tipo, '')) IN ('dia', 'pase dia', 'pase de dia', 'pase de un dia') THEN 'dia'
            ELSE 'visita'
        END as tipo_pase,
        ${columns.socioId ? 'v.socio_id' : 'NULL::int'} as socio_id,
        ${columns.socioId ? 'v.socio_id' : 'NULL::int'} as socio_anfitrion_id,
        v.nombre_completo,
        split_part(v.nombre_completo, ' ', 1) as nombre,
        NULLIF(BTRIM(SUBSTRING(v.nombre_completo FROM LENGTH(split_part(v.nombre_completo, ' ', 1)) + 1)), '') as apellidos,
        ${columns.correo ? 'v.correo' : 'NULL::text'} as correo,
        ${columns.telefono ? 'v.telefono' : 'NULL::text'} as telefono,
        ${columns.mayor16 ? 'COALESCE(v.mayor_16, true)' : 'true'} as mayor_16,
        v.fecha_visita as fecha_pase,
        v.fecha_visita,
        v.hora_entrada,
        v.hora_salida,
        CASE WHEN v.vigente THEN 'activo' ELSE 'finalizado' END as estado,
        v.vigente,
        ${columns.observaciones ? 'v.observaciones' : 'NULL::text'} as observaciones,
        ${columns.observaciones ? 'v.observaciones' : 'NULL::text'} as motivo,
        v.identificacion_tipo as identificacion,
        v.identificacion_tipo,
        ${columns.socioId ? 's.numero_socio' : 'NULL::text'} as numero_socio,
        ${columns.socioId ? "NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno, ' ', COALESCE(u.apellido_materno, ''))), '')" : 'NULL::text'} as socio_nombre,
        ${columns.socioId ? 'u.nombres' : 'NULL::text'} as socio_anfitrion_nombre,
        ${columns.socioId ? 'u.apellido_paterno' : 'NULL::text'} as socio_anfitrion_apellido,
        ${columns.socioId ? 'u.apellido_materno' : 'NULL::text'} as socio_anfitrion_apellido_materno,
        ${columns.socioId ? 'u.username' : 'NULL::text'} as socio_anfitrion_email
    FROM visitas v
    ${columns.socioId ? 'LEFT JOIN socios s ON v.socio_id = s.socio_id LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id' : ''}
`;

const getVisitasLegacySelect = async () => buildVisitasLegacySelect(await getVisitasLegacyColumns());

/** Consulta `pases`; si la tabla no existe, ejecuta la consulta legacy sobre `visitas`. */
const queryPasesWithFallback = async (pasesQuery, pasesParams, visitasQuery, visitasParams) => {
  try {
    return await pool.query(pasesQuery, pasesParams);
  } catch (error) {
    if (isMissingPasesTable(error)) {
      const fallbackQuery = typeof visitasQuery === 'function' ? await visitasQuery() : visitasQuery;

      return pool.query(fallbackQuery, visitasParams);
    }

    throw error;
  }
};

/** Cierra pases/visitas activos de días previos o de hoy tras la hora de cierre. Devuelve cuántos. */
const cerrarVisitasVencidas = async () => {
  const localNow = `(NOW() AT TIME ZONE '${LUDOTECA_TIME_ZONE}')`;

  try {
    const result = await pool.query(
      `UPDATE pases
             SET hora_salida = ${localNow},
                 estado = 'finalizado'
             WHERE estado = 'activo'
               AND (
                 fecha_pase < (${localNow})::date
                 OR (fecha_pase = (${localNow})::date AND (${localNow})::time >= $1::time)
               )
             RETURNING pase_id`,
      [CLUB_CLOSE_TIME]
    );

    return result.rowCount || 0;
  } catch (error) {
    if (!isMissingPasesTable(error)) throw error;

    const result = await pool.query(
      `UPDATE visitas
             SET hora_salida = ${localNow},
                 vigente = false
             WHERE vigente = true
               AND (
                 fecha_visita < (${localNow})::date
                 OR (fecha_visita = (${localNow})::date AND (${localNow})::time >= $1::time)
               )
             RETURNING visita_id`,
      [CLUB_CLOSE_TIME]
    );

    return result.rowCount || 0;
  }
};

async function listarActivos() {
  const result = await queryPasesWithFallback(
    `${pasesSelect}
                 WHERE p.estado = 'activo'
                 ORDER BY p.hora_entrada DESC`,
    [],
    async () => `${await getVisitasLegacySelect()}
                 WHERE v.vigente = true
                 ORDER BY v.hora_entrada DESC`,
    []
  );
  return result.rows;
}

/** Pases de los últimos `diasParam` días (7 por defecto). */
async function listarHistorial(diasParam) {
  const dias = normalizePositiveInt(diasParam, 7);
  const result = await queryPasesWithFallback(
    `${pasesSelect}
                 WHERE p.fecha_pase >= CURRENT_DATE - ($1::int - 1)
                 ORDER BY p.hora_entrada DESC`,
    [dias],
    async () => `${await getVisitasLegacySelect()}
                 WHERE v.fecha_visita >= CURRENT_DATE - ($1::int - 1)
                 ORDER BY v.hora_entrada DESC`,
    [dias]
  );
  return result.rows;
}

async function listarPorFecha(fecha) {
  const result = await queryPasesWithFallback(
    `${pasesSelect}
                 WHERE p.fecha_pase = $1
                 ORDER BY p.hora_entrada DESC`,
    [fecha],
    async () => `${await getVisitasLegacySelect()}
                 WHERE v.fecha_visita = $1
                 ORDER BY v.hora_entrada DESC`,
    [fecha]
  );
  return result.rows;
}

module.exports = {
  CLUB_CLOSE_TIME,
  isMissingPasesTable,
  getVisitasLegacyColumns,
  cerrarVisitasVencidas,
  listarActivos,
  listarHistorial,
  listarPorFecha
};
