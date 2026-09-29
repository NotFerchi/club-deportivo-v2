const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { ERROR_DISCIPLINA_NO_EXISTE, esEnteroValido, normalizarFechaOpcional, tieneValor } = require('./torneoComun');

const badRequest = (error) => new ServiceError(400, { error });

// ── Consulta ─────────────────────────────────────────────────────────────────

async function listarTorneos({ disciplina_id, estado }) {
  const condiciones = [];
  const valores = [];

  if (tieneValor(disciplina_id)) {
    valores.push(Number(disciplina_id)); // entero: validado en la ruta
    condiciones.push(`t.disciplina_id = $${valores.length}`);
  }

  if (tieneValor(estado)) {
    valores.push(estado);
    condiciones.push(`LOWER(t.estado) = LOWER($${valores.length})`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const result = await pool.query(
    `
        SELECT
          t.torneo_id,
          t.nombre,
          t.disciplina_id,
          d.nombre AS nombre_disciplina,
          t.fecha_inicio,
          t.fecha_fin,
          t.estado,
          t.tipo_torneo,
          t.categoria_id,
          ct.nombre AS nombre_categoria,
          COUNT(pt.participante_id)::int AS total_participantes,
          (COUNT(pt.participante_id) >= 4) AS se_realiza
        FROM torneos t
        JOIN disciplinas d ON t.disciplina_id = d.disciplina_id
        LEFT JOIN categorias_torneo ct ON ct.categoria_id = t.categoria_id
        LEFT JOIN participantes_torneo pt ON pt.torneo_id = t.torneo_id
        ${where}
        GROUP BY t.torneo_id, t.disciplina_id, d.nombre, t.tipo_torneo, t.categoria_id, ct.nombre
        ORDER BY t.fecha_inicio DESC NULLS LAST, t.torneo_id DESC
      `,
    valores
  );
  return result.rows;
}

async function listarCategorias() {
  const result = await pool.query('SELECT categoria_id, nombre FROM categorias_torneo ORDER BY nombre');
  return result.rows;
}

async function obtenerReporte(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  const torneo = await pool.query(
    `SELECT t.torneo_id, t.nombre, t.estado, d.nombre AS disciplina
         FROM torneos t
         JOIN disciplinas d ON d.disciplina_id = t.disciplina_id
         WHERE t.torneo_id = $1`,
    [torneoId]
  );

  if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

  const encuentros = await pool.query(
    `SELECT
           e.encuentro_id, e.ronda, e.estado, e.marcador_1, e.marcador_2,
           e.cancha_asignada, e.hora_programada,
           p1.participante_id AS p1_id,
           COALESCE(
             NULLIF(TRIM(eq1.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u1.nombres, ' ', COALESCE(u1.apellido_paterno,''), ' ', COALESCE(u1.apellido_materno,''))), ''),
             NULLIF(TRIM(v1.nombre_completo), ''),
             NULLIF(TRIM(p1.nombre_externo), ''),
             'Por definir'
           ) AS p1_nombre,
           p2.participante_id AS p2_id,
           COALESCE(
             NULLIF(TRIM(eq2.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u2.nombres, ' ', COALESCE(u2.apellido_paterno,''), ' ', COALESCE(u2.apellido_materno,''))), ''),
             NULLIF(TRIM(v2.nombre_completo), ''),
             NULLIF(TRIM(p2.nombre_externo), ''),
             'Por definir'
           ) AS p2_nombre,
           e.ganador_id,
           COALESCE(
             NULLIF(TRIM(eqg.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(ug.nombres, ' ', COALESCE(ug.apellido_paterno,''), ' ', COALESCE(ug.apellido_materno,''))), ''),
             NULLIF(TRIM(vg.nombre_completo), ''),
             NULLIF(TRIM(pg.nombre_externo), ''),
             NULL
           ) AS ganador_nombre
         FROM encuentros_torneo e
         LEFT JOIN participantes_torneo p1 ON p1.participante_id = e.participante_1_id
         LEFT JOIN socios s1   ON s1.socio_id   = p1.socio_id
         LEFT JOIN usuarios u1 ON u1.usuario_id = s1.usuario_id
         LEFT JOIN visitas v1  ON v1.visita_id  = p1.visita_id
         LEFT JOIN equipos eq1 ON eq1.equipo_id = p1.equipo_id
         LEFT JOIN participantes_torneo p2 ON p2.participante_id = e.participante_2_id
         LEFT JOIN socios s2   ON s2.socio_id   = p2.socio_id
         LEFT JOIN usuarios u2 ON u2.usuario_id = s2.usuario_id
         LEFT JOIN visitas v2  ON v2.visita_id  = p2.visita_id
         LEFT JOIN equipos eq2 ON eq2.equipo_id = p2.equipo_id
         LEFT JOIN participantes_torneo pg ON pg.participante_id = e.ganador_id
         LEFT JOIN socios sg   ON sg.socio_id   = pg.socio_id
         LEFT JOIN usuarios ug ON ug.usuario_id = sg.usuario_id
         LEFT JOIN visitas vg  ON vg.visita_id  = pg.visita_id
         LEFT JOIN equipos eqg ON eqg.equipo_id = pg.equipo_id
         WHERE e.torneo_id = $1
         ORDER BY e.ronda ASC, e.encuentro_id ASC`,
    [torneoId]
  );

  return {
    torneo: torneo.rows[0],
    encuentros: encuentros.rows.map((row) => ({
      encuentro_id: row.encuentro_id,
      ronda: row.ronda,
      estado: row.estado,
      marcador_1: row.marcador_1,
      marcador_2: row.marcador_2,
      cancha_asignada: row.cancha_asignada,
      hora_programada: row.hora_programada,
      participante_1: { id: row.p1_id, nombre: row.p1_nombre },
      participante_2: { id: row.p2_id, nombre: row.p2_nombre },
      ganador: row.ganador_id ? { id: row.ganador_id, nombre: row.ganador_nombre } : null
    }))
  };
}

// ── Alta / edición ───────────────────────────────────────────────────────────

/** Body validado en la ruta (nombre no vacío, disciplina_id entero). */
async function crearTorneo(body) {
  const { nombre, disciplina_id, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo } = body;
  const disciplinaId = Number(disciplina_id);

  const disciplina = await pool.query('SELECT disciplina_id FROM disciplinas WHERE disciplina_id = $1', [disciplinaId]);

  if (disciplina.rowCount === 0) throw badRequest(ERROR_DISCIPLINA_NO_EXISTE);

  const categoriaId = tieneValor(categoria_id) ? esEnteroValido(categoria_id) : null;

  const result = await pool.query(
    `INSERT INTO torneos (disciplina_id, nombre, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING torneo_id`,
    [
      disciplinaId,
      nombre.trim(),
      normalizarFechaOpcional(fecha_inicio),
      normalizarFechaOpcional(fecha_fin),
      estado || 'Abierto',
      categoriaId,
      tipo_torneo || 'Individual'
    ]
  );

  return result.rows[0].torneo_id;
}

/** torneo_id y body validados en la ruta (nombre no vacío, disciplina_id entero). */
async function actualizarTorneo(torneoIdParam, body) {
  const torneoId = Number(torneoIdParam);
  const { nombre, disciplina_id, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo } = body;
  const disciplinaId = Number(disciplina_id);

  const categoriaId = tieneValor(categoria_id) ? esEnteroValido(categoria_id) : null;

  const result = await pool.query(
    `UPDATE torneos
         SET disciplina_id = $1,
             nombre        = $2,
             fecha_inicio  = $3,
             fecha_fin     = $4,
             estado        = COALESCE($5, estado),
             categoria_id  = $6,
             tipo_torneo   = COALESCE($7, tipo_torneo)
         WHERE torneo_id = $8
         RETURNING torneo_id`,
    [
      disciplinaId,
      nombre.trim(),
      normalizarFechaOpcional(fecha_inicio),
      normalizarFechaOpcional(fecha_fin),
      estado || null,
      categoriaId,
      tipo_torneo || null,
      torneoId
    ]
  );

  if (result.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

  return torneoId;
}

// ── Cambios de estado ────────────────────────────────────────────────────────

async function finalizarTorneo(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  await enTransaccion(async (client) => {
    const torneo = await client.query('SELECT estado FROM torneos WHERE torneo_id = $1 FOR UPDATE', [torneoId]);

    if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

    if (torneo.rows[0].estado === 'Finalizado') {
      throw new ServiceError(409, { error: 'El torneo ya está finalizado' });
    }

    // Verificar que todos los encuentros estén finalizados
    const pendientes = await client.query(
      `SELECT COUNT(*) as total FROM encuentros_torneo
       WHERE torneo_id = $1 AND estado != 'finalizado'
       AND participante_1_id IS NOT NULL AND participante_2_id IS NOT NULL`,
      [torneoId]
    );

    if (parseInt(pendientes.rows[0].total) > 0) {
      throw new ServiceError(409, { error: `Aún hay ${pendientes.rows[0].total} encuentros sin finalizar` });
    }

    await client.query("UPDATE torneos SET estado = 'Finalizado' WHERE torneo_id = $1", [torneoId]);
  });
}

async function cancelarTorneo(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  const result = await pool.query(
    `UPDATE torneos SET estado = 'Cancelado'
         WHERE torneo_id = $1 AND estado NOT IN ('Cancelado', 'Finalizado')
         RETURNING torneo_id`,
    [torneoId]
  );

  if (result.rowCount === 0) {
    const exists = await pool.query('SELECT estado FROM torneos WHERE torneo_id = $1', [torneoId]);
    if (exists.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });
    throw new ServiceError(409, { error: `El torneo ya está ${exists.rows[0].estado.toLowerCase()}` });
  }
}

module.exports = {
  listarTorneos,
  listarCategorias,
  obtenerReporte,
  crearTorneo,
  actualizarTorneo,
  finalizarTorneo,
  cancelarTorneo
};
