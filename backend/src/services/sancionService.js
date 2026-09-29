const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { requireBodyOrEscalate } = require('./escalate');
const { enTransaccion } = require('./transaction');
const { addDaysISO, getTableColumns, gravedadDias, localTodayISO, normalizeGravedad } = require('../utils/adminRules');

const activeEstadoSql = "LOWER(s.estado::text) IN ('activa', 'activo')";
const staffRoles = ['recepcion', 'coordinador', 'admin', 'gerente'];
const rolesResolucion = ['admin', 'coordinador'];

// ── Helpers de consulta ──────────────────────────────────────────────────────

function normalizePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function buildEstadoFilter(value, values) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  if (['activo', 'activa'].includes(normalized)) {
    return "LOWER(s.estado::text) IN ('activo', 'activa')";
  }

  if (['inactivo', 'inactiva'].includes(normalized)) {
    return "LOWER(s.estado::text) IN ('inactivo', 'inactiva', 'resuelto', 'resuelta')";
  }

  values.push(normalized);
  return `LOWER(s.estado::text) = $${values.length}`;
}

/** Filtros opcionales del listado. socio_id inválido lanza Error con status 400. */
function pushOptionalFilters(query, values, columnExprs = {}) {
  const filters = [];
  const { gravedadExpr = 's.gravedad', fechaInicioExpr = 's.fecha_inicio' } = columnExprs;

  if (query.origen) {
    values.push(String(query.origen).trim());
    filters.push(`s.origen = $${values.length}`);
  }

  const estadoFilter = buildEstadoFilter(query.estado, values);
  if (estadoFilter) filters.push(estadoFilter);

  if (query.socio_id) {
    const socioId = Number(query.socio_id);
    if (!Number.isInteger(socioId) || socioId <= 0) {
      const error = new Error('socio_id debe ser un entero valido');
      error.status = 400;
      throw error;
    }
    values.push(socioId);
    filters.push(`s.socio_id = $${values.length}`);
  }

  if (query.socio) {
    values.push(`%${String(query.socio).trim()}%`);
    filters.push(`(
            TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)) ILIKE $${values.length}
            OR soc.numero_socio::text ILIKE $${values.length}
        )`);
  }

  if (query.gravedad) {
    values.push(String(query.gravedad).trim());
    filters.push(`${gravedadExpr} ILIKE $${values.length}`);
  }

  if (query.fecha_desde) {
    values.push(String(query.fecha_desde).trim());
    filters.push(`${fechaInicioExpr} >= $${values.length}::date`);
  }

  if (query.fecha_hasta) {
    values.push(String(query.fecha_hasta).trim());
    filters.push(`${fechaInicioExpr} <= $${values.length}::date`);
  }

  return filters;
}

function getSancionesSelect({
  gravedadExpr,
  fechaInicioExpr,
  fechaFinExpr,
  fechaResolucionExpr,
  includeActiva = true
}) {
  return `
        SELECT
            s.sancion_id,
            s.socio_id,
            s.origen,
            s.motivo,
            s.fecha,
            s.estado,
            ${fechaResolucionExpr} as fecha_resolucion,
            TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) as nombre_socio,
            NULLIF(TRIM(CONCAT_WS(' ', r.nombres, r.apellido_paterno)), '') as nombre_resolvente,
            ${gravedadExpr} as gravedad,
            ${fechaInicioExpr} as fecha_inicio,
            ${fechaFinExpr} as fecha_fin,
            ${includeActiva ? `(${activeEstadoSql} AND (${fechaFinExpr} IS NULL OR ${fechaFinExpr} >= CURRENT_DATE))` : 'false'} as activa,
            soc.numero_socio,
            soc.tipo as tipo_socio,
            TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno)) as socio_nombre,
            u.username as socio_email
        FROM sanciones s
        JOIN socios soc ON s.socio_id = soc.socio_id
        JOIN usuarios u ON soc.usuario_id = u.usuario_id
        LEFT JOIN usuarios r ON s.resuelto_por = r.usuario_id
    `;
}

/** Expresiones SQL según las columnas que tenga la tabla sanciones. */
async function getSancionColumnInfo() {
  const columns = await getTableColumns('sanciones');
  const gravedadExpr = columns.has('gravedad')
    ? 's.gravedad'
    : "CASE WHEN s.origen ILIKE '%no-show%' THEN 'Moderada' ELSE 'Leve' END";
  const fechaInicioExpr = columns.has('fecha_inicio')
    ? 's.fecha_inicio'
    : columns.has('fecha')
      ? 's.fecha::date'
      : 'CURRENT_DATE';
  const fechaFinExpr = columns.has('fecha_fin')
    ? 's.fecha_fin'
    : `(${fechaInicioExpr} + (
            CASE
                WHEN ${gravedadExpr} = 'Grave' THEN INTERVAL '30 days'
                WHEN ${gravedadExpr} = 'Moderada' THEN INTERVAL '7 days'
                ELSE INTERVAL '1 day'
            END
          ))::date`;
  const fechaResolucionExpr = columns.has('fecha_resolucion') ? 's.fecha_resolucion' : 'NULL::date';

  return { columns, gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr };
}

async function getHistorialSocio(socioId) {
  const { gravedadExpr, fechaFinExpr } = await getSancionColumnInfo();
  const result = await pool.query(
    `SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE ${activeEstadoSql} AND (${fechaFinExpr} IS NULL OR ${fechaFinExpr} >= CURRENT_DATE))::int as activas,
            COUNT(*) FILTER (WHERE ${gravedadExpr} = 'Grave')::int as graves
         FROM sanciones s
         WHERE s.socio_id = $1`,
    [socioId]
  );

  return result.rows[0] || { total: 0, activas: 0, graves: 0 };
}

async function getSancionDetallada(sancionId) {
  const { gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr } = await getSancionColumnInfo();
  const selectSql = getSancionesSelect({ gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr });
  const result = await pool.query(
    `${selectSql}
         WHERE s.sancion_id = $1`,
    [sancionId]
  );

  return result.rows[0] || null;
}

function isSancionInactiva(estado) {
  return ['inactivo', 'inactiva', 'resuelto', 'resuelta'].includes(
    String(estado || '')
      .trim()
      .toLowerCase()
  );
}

/** Gravedad final según origen e historial del socio. */
async function resolveGravedad(socioId, gravedad, origen) {
  let resolved = normalizeGravedad(gravedad);
  const historial = await getHistorialSocio(socioId);

  if (
    String(origen || '')
      .toLowerCase()
      .includes('no-show') &&
    resolved === 'Leve'
  ) {
    resolved = 'Moderada';
  }
  if (historial.graves > 0 || historial.activas >= 2) {
    resolved = 'Grave';
  } else if (historial.total > 0 && resolved === 'Leve') {
    resolved = 'Moderada';
  }

  return resolved;
}

/** INSERT adaptado a las columnas existentes. Devuelve sancion_id. */
async function insertSancion(client, payload) {
  const columns = await getTableColumns('sanciones');
  const insertColumns = ['socio_id', 'motivo', 'origen', 'estado'];
  const values = [payload.socio_id, payload.motivo, payload.origen || 'Administración', payload.estado || 'Activa'];

  if (columns.has('gravedad')) {
    insertColumns.push('gravedad');
    values.push(payload.gravedad);
  }
  if (columns.has('fecha_inicio')) {
    insertColumns.push('fecha_inicio');
    values.push(payload.fecha_inicio);
  } else if (columns.has('fecha')) {
    insertColumns.push('fecha');
    values.push(payload.fecha_inicio);
  }
  if (columns.has('fecha_fin')) {
    insertColumns.push('fecha_fin');
    values.push(payload.fecha_fin);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const result = await client.query(
    `INSERT INTO sanciones (${insertColumns.join(', ')})
         VALUES (${placeholders})
         RETURNING sancion_id`,
    values
  );

  return result.rows[0].sancion_id;
}

// ── Consultas ────────────────────────────────────────────────────────────────

async function listarSanciones(query) {
  const { gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr } = await getSancionColumnInfo();
  const { page, limit, offset } = normalizePagination(query);
  const values = [];
  const filters = pushOptionalFilters(query, values, { gravedadExpr, fechaInicioExpr });
  const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const selectSql = getSancionesSelect({ gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr });

  values.push(limit);
  const limitParam = values.length;
  values.push(offset);
  const offsetParam = values.length;

  const result = await pool.query(
    `${selectSql}
                 ${whereSql}
                 ORDER BY ${fechaInicioExpr} DESC, s.sancion_id DESC
                 LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  const countResult = await pool.query(
    `SELECT COUNT(*)::int as total
                 FROM sanciones s
                 JOIN socios soc ON s.socio_id = soc.socio_id
                 JOIN usuarios u ON soc.usuario_id = u.usuario_id
                 LEFT JOIN usuarios r ON s.resuelto_por = r.usuario_id
                 ${whereSql}`,
    values.slice(0, values.length - 2)
  );

  const total = countResult.rows[0]?.total || 0;

  return {
    data: result.rows,
    sanciones: result.rows,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  };
}

async function obtenerSancion(id) {
  const { gravedadExpr, fechaInicioExpr, fechaFinExpr } = await getSancionColumnInfo();
  const result = await pool.query(
    `
                SELECT s.*, ${gravedadExpr} as gravedad, ${fechaInicioExpr} as fecha_inicio, ${fechaFinExpr} as fecha_fin,
                    soc.numero_socio,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as socio_nombre
                FROM sanciones s
                JOIN socios soc ON s.socio_id = soc.socio_id
                JOIN usuarios u ON soc.usuario_id = u.usuario_id
                WHERE s.sancion_id = $1
            `,
    [id]
  );
  if (result.rows.length === 0) throw new ServiceError(404, { error: 'Sancion no encontrada' });
  return result.rows[0];
}

/**
 * Valida el id del socio (400, sin consultar la BD) y que el usuario pueda ver
 * sus sanciones: staff siempre; rol socio solo las propias (403).
 * Devuelve el socioId numérico.
 */
async function autorizarConsultaSocio(user, socioIdParam) {
  const socioId = Number(socioIdParam); // entero positivo: validado en la ruta

  let permitido = false;
  if (staffRoles.includes(user?.rol)) {
    permitido = true;
  } else if (user?.rol === 'socio') {
    const result = await pool.query('SELECT 1 FROM socios WHERE socio_id = $1 AND usuario_id = $2', [
      socioId,
      user.usuario_id
    ]);
    permitido = result.rowCount > 0;
  }

  if (!permitido) {
    throw new ServiceError(403, { error: 'Sin permisos para consultar sanciones de este socio' });
  }
  return socioId;
}

async function sancionesDeSocio(socioId) {
  const { gravedadExpr, fechaInicioExpr, fechaFinExpr } = await getSancionColumnInfo();
  const result = await pool.query(
    `SELECT s.*, ${gravedadExpr} as gravedad, ${fechaInicioExpr} as fecha_inicio, ${fechaFinExpr} as fecha_fin,
                    (${activeEstadoSql} AND (${fechaFinExpr} IS NULL OR ${fechaFinExpr} >= CURRENT_DATE)) as activa,
                    soc.numero_socio,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as socio_nombre
                 FROM sanciones s
                 JOIN socios soc ON s.socio_id = soc.socio_id
                 JOIN usuarios u ON soc.usuario_id = u.usuario_id
                 WHERE s.socio_id = $1
                 ORDER BY ${fechaInicioExpr} DESC`,
    [socioId]
  );
  return result.rows;
}

async function tieneSancionActiva(socioId) {
  const { fechaFinExpr } = await getSancionColumnInfo();
  const result = await pool.query(
    `SELECT COUNT(*) as total
                 FROM sanciones s
                 WHERE s.socio_id = $1
                   AND ${activeEstadoSql}
                   AND (${fechaFinExpr} IS NULL OR ${fechaFinExpr} >= CURRENT_DATE)`,
    [socioId]
  );
  return parseInt(result.rows[0].total, 10) > 0;
}

async function historialCompletoSocio(socioId) {
  const { gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr } = await getSancionColumnInfo();
  const selectSql = getSancionesSelect({ gravedadExpr, fechaInicioExpr, fechaFinExpr, fechaResolucionExpr });
  const result = await pool.query(
    `${selectSql}
                 WHERE s.socio_id = $1
                 ORDER BY s.fecha DESC NULLS LAST, ${fechaInicioExpr} DESC, s.sancion_id DESC`,
    [socioId]
  );

  const totals = await pool.query(
    `SELECT
                    COUNT(*) FILTER (WHERE LOWER(estado::text) IN ('activo', 'activa'))::int as total_sanciones_activas,
                    COUNT(*)::int as total_sanciones_historico
                 FROM sanciones
                 WHERE socio_id = $1`,
    [socioId]
  );

  return {
    socio_id: socioId,
    total_sanciones_activas: totals.rows[0]?.total_sanciones_activas || 0,
    total_sanciones_historico: totals.rows[0]?.total_sanciones_historico || 0,
    sanciones: result.rows
  };
}

// ── Escritura ────────────────────────────────────────────────────────────────

/** Crea la sanción con gravedad y fecha fin resueltas. Devuelve { sancionId, gravedad, fechaFin }. */
async function crearSancion(body) {
  // Socio y motivo obligatorios: validado en la ruta
  const { socioId, socio_id, motivo, origen, gravedad, fecha_inicio, fecha_fin } = body;
  const id = socioId || socio_id;

  return enTransaccion(async (client) => {
    const gravedadFinal = await resolveGravedad(id, gravedad, origen);
    const fechaInicioFinal = fecha_inicio || localTodayISO();
    const fechaFinFinal = fecha_fin || addDaysISO(fechaInicioFinal, gravedadDias[gravedadFinal]);
    const sancionId = await insertSancion(client, {
      socio_id: id,
      motivo: motivo.trim(),
      origen: origen || 'Administración',
      gravedad: gravedadFinal,
      fecha_inicio: fechaInicioFinal,
      fecha_fin: fechaFinFinal,
      estado: 'Activa'
    });
    return { sancionId, gravedad: gravedadFinal, fechaFin: fechaFinFinal };
  });
}

/** Actualiza los campos enviados; el estado solo lo cambian admin y coordinador. */
async function actualizarSancion(id, body, user) {
  requireBodyOrEscalate(body);
  const { socio_id, motivo, origen, gravedad, fecha_inicio, fecha_fin, estado } = body;
  const puedeResolverEstado = rolesResolucion.includes(user?.rol);

  const columns = await getTableColumns('sanciones');
  const assignments = [];
  const values = [];
  const pushAssignment = (column, value) => {
    assignments.push(`${column} = $${values.length + 1}`);
    values.push(value);
  };

  if (socio_id) pushAssignment('socio_id', socio_id);
  if (motivo !== undefined) pushAssignment('motivo', motivo);
  if (origen !== undefined) pushAssignment('origen', origen);
  if (estado !== undefined && puedeResolverEstado) pushAssignment('estado', estado);
  if (columns.has('gravedad') && gravedad !== undefined) pushAssignment('gravedad', normalizeGravedad(gravedad));
  if (columns.has('fecha_inicio') && fecha_inicio !== undefined) pushAssignment('fecha_inicio', fecha_inicio);
  else if (columns.has('fecha') && fecha_inicio !== undefined) pushAssignment('fecha', fecha_inicio);
  if (columns.has('fecha_fin') && fecha_fin !== undefined) pushAssignment('fecha_fin', fecha_fin);

  if (assignments.length === 0) {
    throw new ServiceError(400, { error: 'No hay datos para actualizar' });
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE sanciones SET ${assignments.join(', ')}
                 WHERE sancion_id = $${values.length}
                 RETURNING sancion_id`,
    values
  );

  if (result.rows.length === 0) throw new ServiceError(404, { error: 'Sancion no encontrada' });
}

async function eliminarSancion(id) {
  const result = await pool.query('DELETE FROM sanciones WHERE sancion_id = $1 RETURNING sancion_id', [id]);
  if (result.rows.length === 0) throw new ServiceError(404, { error: 'Sancion no encontrada' });
}

/** Marca la sanción como Resuelta (con fecha y responsable si existen esas columnas). */
async function levantarSancion(id, user) {
  const columns = await getTableColumns('sanciones');
  const assignments = ['estado = $1'];
  const values = ['Resuelta'];

  if (columns.has('fecha_resolucion')) {
    assignments.push(`fecha_resolucion = $${values.length + 1}`);
    values.push(localTodayISO());
  }
  if (columns.has('resuelto_por') && user?.usuario_id) {
    assignments.push(`resuelto_por = $${values.length + 1}`);
    values.push(user.usuario_id);
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE sanciones SET ${assignments.join(', ')}
                 WHERE sancion_id = $${values.length}
                 RETURNING sancion_id`,
    values
  );

  if (result.rows.length === 0) throw new ServiceError(404, { error: 'Sancion no encontrada' });
}

/** Resuelve la sanción (estado Inactivo) y devuelve su detalle actualizado. */
async function resolverSancion(sancionIdParam, user) {
  const sancionId = Number(sancionIdParam); // entero positivo: validado en la ruta
  if (!rolesResolucion.includes(user?.rol)) {
    throw new ServiceError(403, { error: 'Forbidden' });
  }

  const sancion = await pool.query('SELECT * FROM sanciones WHERE sancion_id = $1', [sancionId]);
  if (sancion.rowCount === 0) {
    throw new ServiceError(404, { error: 'Sanción no encontrada' });
  }
  if (isSancionInactiva(sancion.rows[0].estado)) {
    throw new ServiceError(409, { error: 'Esta sanción ya fue resuelta' });
  }

  const columns = await getTableColumns('sanciones');
  if (!columns.has('resuelto_por') || !columns.has('fecha_resolucion')) {
    throw new ServiceError(500, { error: 'La tabla sanciones no tiene campos de resolución configurados' });
  }

  await pool.query(
    `UPDATE sanciones
                 SET estado = 'Inactivo',
                     resuelto_por = $1,
                     fecha_resolucion = NOW()
                 WHERE sancion_id = $2`,
    [user.usuario_id, sancionId]
  );

  return getSancionDetallada(sancionId);
}

/** Crea sanciones para reservas no-show que aún no tienen una. Devuelve cuántas creó. */
async function sincronizarNoShows() {
  return enTransaccion(async (client) => {
    const result = await client.query(`
                SELECT r.reserva_id, r.socio_id
                FROM reservaciones r
                WHERE (
                    COALESCE((to_jsonb(r)->>'no_show')::boolean, false) = true
                    OR LOWER(r.estado::text) IN ('no-show', 'no show')
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM sanciones s
                    WHERE s.socio_id = r.socio_id
                      AND s.origen = 'No-show reserva'
                      AND s.motivo ILIKE ('%' || 'reserva #' || r.reserva_id || '%')
                )
            `);

    let creadas = 0;
    for (const reserva of result.rows) {
      const fechaInicio = localTodayISO();
      await insertSancion(client, {
        socio_id: reserva.socio_id,
        motivo: `No-show registrado en reserva #${reserva.reserva_id}`,
        origen: 'No-show reserva',
        gravedad: 'Moderada',
        fecha_inicio: fechaInicio,
        fecha_fin: addDaysISO(fechaInicio, gravedadDias.Moderada),
        estado: 'Activa'
      });
      creadas += 1;
    }
    return creadas;
  });
}

module.exports = {
  listarSanciones,
  obtenerSancion,
  autorizarConsultaSocio,
  sancionesDeSocio,
  tieneSancionActiva,
  historialCompletoSocio,
  crearSancion,
  actualizarSancion,
  eliminarSancion,
  levantarSancion,
  resolverSancion,
  sincronizarNoShows
};
