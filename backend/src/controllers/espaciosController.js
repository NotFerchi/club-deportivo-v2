const pool = require('../config/database');
const { logAudit } = require('../utils/auditLogger');
const { getTableColumns } = require('../utils/adminRules');

const ESTADOS_VALIDOS = ['Activo', 'Inactivo', 'Mantenimiento'];

function normalizeEstado(estado) {
  const v = String(estado || '').trim();
  const found = ESTADOS_VALIDOS.find(e => e.toLowerCase() === v.toLowerCase());
  return found || 'Activo';
}

const normalizeDisciplinaIds = (payload) => {
  const raw = Array.isArray(payload.disciplina_ids)
    ? payload.disciplina_ids
    : payload.disciplina_id ? [payload.disciplina_id] : [];
  return [...new Set(raw.map(Number).filter(v => Number.isInteger(v) && v > 0))];
};

async function upsertDisciplinas(client, espacioId, disciplinaIds) {
  try {
    await client.query('DELETE FROM espacios_disciplinas WHERE espacio_id = $1', [espacioId]);
    for (const dId of disciplinaIds) {
      await client.query(
        `INSERT INTO espacios_disciplinas (espacio_id, disciplina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [espacioId, dId]
      );
    }
  } catch (err) {
    if (err?.code !== '42P01') throw err;
  }
}

function firstExistingColumn(columns, candidates) {
  return candidates.find(column => columns.has(column));
}

async function closeOpenMaintenance(client, espacioId, columns) {
  if (!columns.has('espacio_id') || !columns.has('fecha_fin')) return;

  await client.query(
    `UPDATE mantenimiento_espacios SET fecha_fin = NOW()
     WHERE espacio_id = $1 AND fecha_fin IS NULL`,
    [espacioId]
  );
}

async function insertMaintenance(client, espacioId, motivo, usuarioId, columns) {
  if (!columns.has('espacio_id')) return;

  const insertColumns = ['espacio_id'];
  const valueExpressions = ['$1'];
  const values = [espacioId];

  if (columns.has('fecha_inicio')) {
    insertColumns.push('fecha_inicio');
    valueExpressions.push('NOW()');
  }

  if (columns.has('motivo')) {
    values.push(motivo || 'Sin motivo especificado');
    insertColumns.push('motivo');
    valueExpressions.push(`$${values.length}`);
  }

  if (columns.has('usuario_id')) {
    values.push(usuarioId || null);
    insertColumns.push('usuario_id');
    valueExpressions.push(`$${values.length}`);
  }

  await client.query(
    `INSERT INTO mantenimiento_espacios (${insertColumns.join(', ')})
     VALUES (${valueExpressions.join(', ')})`,
    values
  );
}

const espaciosController = {

  getEspacios: async (req, res) => {
    try {
      let result;
      try {
        result = await pool.query(`
          SELECT
            e.espacio_id, e.nombre, e.capacidad_maxima, e.activo,
            COALESCE(e.estado, CASE WHEN e.activo THEN 'Activo' ELSE 'Inactivo' END) AS estado,
            e.disciplina_id,
            d.nombre AS disciplina,
            COALESCE(
              json_agg(json_build_object('disciplina_id', dr.disciplina_id, 'nombre', dr.nombre) ORDER BY dr.nombre)
              FILTER (WHERE dr.disciplina_id IS NOT NULL), '[]'::json
            ) AS disciplinas,
            COALESCE(
              array_agg(dr.disciplina_id ORDER BY dr.nombre) FILTER (WHERE dr.disciplina_id IS NOT NULL),
              ARRAY[]::int[]
            ) AS disciplina_ids,
            COALESCE(string_agg(dr.nombre, ', ' ORDER BY dr.nombre), d.nombre) AS disciplinas_texto
          FROM espacios e
          LEFT JOIN disciplinas d ON e.disciplina_id = d.disciplina_id
          LEFT JOIN espacios_disciplinas ed ON ed.espacio_id = e.espacio_id
          LEFT JOIN disciplinas dr ON dr.disciplina_id = ed.disciplina_id
          GROUP BY e.espacio_id, d.nombre
          ORDER BY e.nombre
        `);
      } catch (joinError) {
        if (joinError?.code !== '42P01') throw joinError;
        result = await pool.query(`
          SELECT e.espacio_id, e.nombre, e.capacidad_maxima, e.activo,
            COALESCE(e.estado, CASE WHEN e.activo THEN 'Activo' ELSE 'Inactivo' END) AS estado,
            e.disciplina_id, d.nombre AS disciplina,
            '[]'::json AS disciplinas, ARRAY[]::int[] AS disciplina_ids, d.nombre AS disciplinas_texto
          FROM espacios e
          LEFT JOIN disciplinas d ON e.disciplina_id = d.disciplina_id
          ORDER BY e.nombre
        `);
      }
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getEspacios:', error);
      res.status(500).json({ error: 'Error al obtener espacios' });
    }
  },

  getEspacioById: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT e.*,
          COALESCE(array_agg(ed.disciplina_id ORDER BY d.nombre) FILTER (WHERE ed.disciplina_id IS NOT NULL), ARRAY[]::int[]) AS disciplina_ids
         FROM espacios e
         LEFT JOIN espacios_disciplinas ed ON ed.espacio_id = e.espacio_id
         LEFT JOIN disciplinas d ON d.disciplina_id = ed.disciplina_id
         WHERE e.espacio_id = $1
         GROUP BY e.espacio_id`,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Espacio no encontrado' });
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error en getEspacioById:', error);
      res.status(500).json({ error: 'Error al obtener espacio' });
    }
  },

  createEspacio: async (req, res) => {
    const { nombre, disciplina_id, capacidad_maxima, activo, estado } = req.body;
    const disciplinaIds = normalizeDisciplinaIds(req.body);
    const estadoFinal = normalizeEstado(estado);

    if (!nombre || !capacidad_maxima) {
      return res.status(400).json({ error: 'Nombre y capacidad máxima son requeridos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const activoFinal = estadoFinal === 'Activo';
      const result = await client.query(
        `INSERT INTO espacios (nombre, disciplina_id, capacidad_maxima, activo, estado)
         VALUES ($1, $2, $3, $4, $5) RETURNING espacio_id`,
        [nombre, disciplina_id || disciplinaIds[0] || null, capacidad_maxima, activoFinal, estadoFinal]
      );
      const newId = result.rows[0].espacio_id;
      await upsertDisciplinas(client, newId, disciplinaIds);
      await client.query('COMMIT');
      await logAudit(req, { accion: 'crear_espacio', tabla_afectada: 'espacios', registro_id: newId, detalles: `Espacio creado: ${nombre}` });
      res.json({ ok: true, id: newId, message: 'Espacio creado correctamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en createEspacio:', error);
      res.status(500).json({ error: 'Error al crear espacio' });
    } finally {
      client.release();
    }
  },

  updateEspacio: async (req, res) => {
    const { id } = req.params;
    const { nombre, disciplina_id, capacidad_maxima, estado } = req.body;
    const disciplinaIds = normalizeDisciplinaIds(req.body);
    const estadoFinal = normalizeEstado(estado);
    const activoFinal = estadoFinal === 'Activo';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE espacios SET nombre=$1, disciplina_id=$2, capacidad_maxima=$3, activo=$4, estado=$5
         WHERE espacio_id=$6 RETURNING espacio_id`,
        [nombre, disciplina_id || disciplinaIds[0] || null, capacidad_maxima, activoFinal, estadoFinal, id]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Espacio no encontrado' });
      }
      await upsertDisciplinas(client, id, disciplinaIds);
      await client.query('COMMIT');
      await logAudit(req, { accion: 'actualizar_espacio', tabla_afectada: 'espacios', registro_id: id, detalles: `Espacio actualizado: ${nombre}` });
      res.json({ ok: true, message: 'Espacio actualizado correctamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en updateEspacio:', error);
      res.status(500).json({ error: 'Error al actualizar espacio' });
    } finally {
      client.release();
    }
  },

  // PATCH /espacios/:id/estado — toggle mantenimiento / activar / inactivar
  toggleEstado: async (req, res) => {
    const { id } = req.params;
    const { estado, motivo, fecha_fin } = req.body;
    const estadoFinal = normalizeEstado(estado);

    if (!ESTADOS_VALIDOS.includes(estadoFinal)) {
      return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Obtener estado actual
      const current = await client.query('SELECT estado FROM espacios WHERE espacio_id = $1', [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Espacio no encontrado' });
      }
      const estadoAnterior = current.rows[0].estado;

      // Actualizar estado (trigger sincroniza activo automáticamente)
      await client.query(
        `UPDATE espacios SET estado = $1 WHERE espacio_id = $2`,
        [estadoFinal, id]
      );

      // Registrar en historial de mantenimiento
      if (estadoFinal === 'Mantenimiento') {
        const mantenimientoColumns = await getTableColumns('mantenimiento_espacios');
        // Cerrar registro previo si existe y abrir uno nuevo con el esquema disponible.
        await closeOpenMaintenance(client, id, mantenimientoColumns);
        await insertMaintenance(client, id, motivo, req.user?.usuario_id, mantenimientoColumns);
      } else if (estadoAnterior === 'Mantenimiento') {
        const mantenimientoColumns = await getTableColumns('mantenimiento_espacios');
        // Cerrar registro de mantenimiento al reactivar
        await closeOpenMaintenance(client, id, mantenimientoColumns);
      }

      await client.query('COMMIT');
      await logAudit(req, {
        accion: 'cambiar_estado_espacio',
        tabla_afectada: 'espacios',
        registro_id: id,
        detalles: `Estado cambiado de ${estadoAnterior} a ${estadoFinal}${motivo ? ` — motivo: ${motivo}` : ''}`
      });
      res.json({ ok: true, estado: estadoFinal, message: `Espacio ${estadoFinal === 'Activo' ? 'reactivado' : estadoFinal === 'Mantenimiento' ? 'puesto en mantenimiento' : 'inactivado'} correctamente` });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error en toggleEstado:', error);
      res.status(500).json({ error: 'Error al cambiar estado del espacio' });
    } finally {
      client.release();
    }
  },

  getMantenimientoHistorial: async (req, res) => {
    const { id } = req.params;
    try {
      const mantenimientoColumns = await getTableColumns('mantenimiento_espacios');
      if (!mantenimientoColumns.has('espacio_id')) {
        return res.json([]);
      }

      const idColumn = firstExistingColumn(mantenimientoColumns, ['mant_id', 'mantenimiento_id']);
      const orderColumn = firstExistingColumn(mantenimientoColumns, ['fecha_inicio', 'created_at', 'fecha_fin', 'mant_id', 'mantenimiento_id']);
      const orderExpr = orderColumn ? `m.${orderColumn} DESC NULLS LAST` : '1';
      const userColumns = mantenimientoColumns.has('usuario_id')
        ? await getTableColumns('usuarios')
        : new Set();
      const canJoinUsuarios = mantenimientoColumns.has('usuario_id') && userColumns.has('usuario_id');
      const userNameColumns = ['nombres', 'apellido_paterno', 'apellido_materno']
        .filter(column => userColumns.has(column));
      const usuarioNombreExpr = userNameColumns.length > 0
        ? `NULLIF(TRIM(CONCAT_WS(' ', ${userNameColumns.map(column => `u.${column}`).join(', ')})), '')`
        : userColumns.has('username') ? 'u.username' : 'NULL::text';

      const result = await pool.query(
        `SELECT
           ${idColumn ? `m.${idColumn}` : `ROW_NUMBER() OVER (ORDER BY ${orderExpr})`} AS mant_id,
           ${mantenimientoColumns.has('motivo') ? 'm.motivo' : 'NULL::text AS motivo'},
           ${mantenimientoColumns.has('fecha_inicio') ? 'm.fecha_inicio' : mantenimientoColumns.has('created_at') ? 'm.created_at AS fecha_inicio' : 'NULL::timestamp AS fecha_inicio'},
           ${mantenimientoColumns.has('fecha_fin') ? 'm.fecha_fin' : 'NULL::timestamp AS fecha_fin'},
           ${canJoinUsuarios ? `${usuarioNombreExpr} AS usuario_nombre` : 'NULL::text AS usuario_nombre'}
         FROM mantenimiento_espacios m
         ${canJoinUsuarios ? 'LEFT JOIN usuarios u ON u.usuario_id = m.usuario_id' : ''}
         WHERE m.espacio_id = $1
         ORDER BY ${orderExpr}
         LIMIT 50`,
        [id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getMantenimientoHistorial:', error);
      if (error?.code === '42P01') return res.json([]);
      res.status(500).json({
        error: 'Error al obtener historial de mantenimiento',
        pg_code: error?.code,
        detail: error?.message
      });
    }
  },

  deleteEspacio: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM espacios WHERE espacio_id = $1 RETURNING espacio_id', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Espacio no encontrado' });
      await logAudit(req, { accion: 'eliminar_espacio', tabla_afectada: 'espacios', registro_id: id, detalles: 'Espacio eliminado' });
      res.json({ ok: true, message: 'Espacio eliminado correctamente' });
    } catch (error) {
      console.error('Error en deleteEspacio:', error);
      res.status(500).json({ error: 'Error al eliminar espacio' });
    }
  },

  getDisciplinas: async (req, res) => {
    try {
      const result = await pool.query('SELECT disciplina_id, nombre FROM disciplinas ORDER BY nombre');
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getDisciplinas:', error);
      res.status(500).json({ error: 'Error al obtener disciplinas' });
    }
  }
};

module.exports = espaciosController;
