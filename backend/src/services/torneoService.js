const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const {
  ERROR_CATEGORIA_NO_EXISTE,
  ERROR_CATEGORIA_REQUERIDA,
  ERROR_DISCIPLINA_NO_EXISTE,
  bloquearTorneo,
  esIdValido,
  normalizarFechaOpcional,
  tieneValor
} = require('./torneoComun');
const { ESTADOS, admiteInscripciones, validarTransicion } = require('./torneoEstados');

const badRequest = (error) => new ServiceError(400, { error });

const ERROR_ESTADO_NO_EDITABLE = 'El estado se cambia con las acciones del torneo';
const ERROR_TORNEO_BLOQUEADO =
  'Con las inscripciones cerradas no se puede cambiar la disciplina, el tipo de torneo ni la categoría';
const ERROR_CATEGORIA_CON_INSCRITOS = 'No se puede cambiar la categoría: el torneo ya tiene inscritos';

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

/** 400 si la disciplina o la categoría (cuando viene) no existen; `db` es el pool o el cliente de la transacción. */
async function validarReferencias(db, disciplinaId, categoriaId) {
  const disciplina = await db.query('SELECT disciplina_id FROM disciplinas WHERE disciplina_id = $1', [disciplinaId]);
  if (disciplina.rowCount === 0) throw badRequest(ERROR_DISCIPLINA_NO_EXISTE);

  if (categoriaId !== null) {
    const categoria = await db.query('SELECT categoria_id FROM categorias_torneo WHERE categoria_id = $1', [
      categoriaId
    ]);
    if (categoria.rowCount === 0) throw badRequest(ERROR_CATEGORIA_NO_EXISTE);
  }
}

/**
 * Body validado en la ruta (nombre, disciplina_id, categoria_id, tipo_torneo y fechas).
 * Todo torneo nace Abierto: `estado` se ignora.
 */
async function crearTorneo(body) {
  const { nombre, disciplina_id, fecha_inicio, fecha_fin, categoria_id, tipo_torneo } = body;
  const disciplinaId = esIdValido(disciplina_id);
  const categoriaId = tieneValor(categoria_id) ? esIdValido(categoria_id) : null;

  await validarReferencias(pool, disciplinaId, categoriaId);

  const result = await pool.query(
    `INSERT INTO torneos (disciplina_id, nombre, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING torneo_id`,
    [
      disciplinaId,
      nombre.trim(),
      normalizarFechaOpcional(fecha_inicio),
      normalizarFechaOpcional(fecha_fin),
      ESTADOS.ABIERTO,
      categoriaId,
      tipo_torneo || 'Individual'
    ]
  );

  return result.rows[0].torneo_id;
}

/**
 * torneo_id y body validados en la ruta (nombre, disciplina_id, categoria_id, tipo_torneo y fechas).
 * El estado no se edita aquí (400 si el body trae otro). Con el torneo Abierto la categoría es
 * obligatoria (B-10); con las inscripciones cerradas solo cambian el nombre y las fechas (409 si
 * cambia disciplina, tipo o categoría), así que los torneos viejos sin categoría se pueden seguir editando.
 * Todos los participantes son de la categoría del torneo: al asignarla a un torneo que no tenía, se
 * aplica también a sus inscritos; cambiar una categoría ya asignada solo se permite sin inscritos (409).
 */
async function actualizarTorneo(torneoIdParam, body) {
  const torneoId = Number(torneoIdParam);
  const { nombre, disciplina_id, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo } = body;
  const disciplinaId = esIdValido(disciplina_id);

  const categoriaId = tieneValor(categoria_id) ? esIdValido(categoria_id) : null;

  await enTransaccion(async (client) => {
    const actual = await bloquearTorneo(client, torneoId, 'estado, disciplina_id, tipo_torneo, categoria_id');

    if (tieneValor(estado) && estado !== actual.estado) throw badRequest(ERROR_ESTADO_NO_EDITABLE);

    if (admiteInscripciones(actual.estado) && categoriaId === null) throw badRequest(ERROR_CATEGORIA_REQUERIDA);

    if (!admiteInscripciones(actual.estado)) {
      const cambiaTipo = Boolean(tipo_torneo) && tipo_torneo !== actual.tipo_torneo;
      if (disciplinaId !== actual.disciplina_id || cambiaTipo || categoriaId !== actual.categoria_id) {
        throw new ServiceError(409, { error: ERROR_TORNEO_BLOQUEADO });
      }
    }

    await validarReferencias(client, disciplinaId, categoriaId);

    // Solo con el torneo Abierto puede cambiar la categoría (si no, ya respondió 409 arriba)
    const cambiaCategoria = categoriaId !== actual.categoria_id;
    if (cambiaCategoria && actual.categoria_id !== null) {
      const inscritos = await client.query(
        'SELECT COUNT(*)::int AS total FROM participantes_torneo WHERE torneo_id = $1',
        [torneoId]
      );
      if (inscritos.rows[0].total > 0) throw new ServiceError(409, { error: ERROR_CATEGORIA_CON_INSCRITOS });
    }

    await client.query(
      `UPDATE torneos
         SET disciplina_id = $1,
             nombre        = $2,
             fecha_inicio  = $3,
             fecha_fin     = $4,
             categoria_id  = $5,
             tipo_torneo   = COALESCE($6, tipo_torneo)
         WHERE torneo_id = $7`,
      [
        disciplinaId,
        nombre.trim(),
        normalizarFechaOpcional(fecha_inicio),
        normalizarFechaOpcional(fecha_fin),
        categoriaId,
        tipo_torneo || null,
        torneoId
      ]
    );

    // Torneo sin categoría que recibe una: sus inscritos pasan a esa categoría
    if (cambiaCategoria && actual.categoria_id === null) {
      await client.query('UPDATE participantes_torneo SET categoria_id = $1 WHERE torneo_id = $2', [
        categoriaId,
        torneoId
      ]);
    }
  });

  return torneoId;
}

// ── Cambios de estado ────────────────────────────────────────────────────────

/** En_curso → Finalizado: sin encuentros pendientes y con ganador en la final. */
async function finalizarTorneo(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  await enTransaccion(async (client) => {
    const torneo = await bloquearTorneo(client, torneoId);
    validarTransicion(torneo.estado, ESTADOS.FINALIZADO);

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

    // La final es el encuentro de la última ronda; sin su ganador el torneo no tiene campeón
    const final = await client.query(
      `SELECT ganador_id FROM encuentros_torneo
       WHERE torneo_id = $1
       ORDER BY ronda DESC NULLS LAST, encuentro_id DESC
       LIMIT 1`,
      [torneoId]
    );

    if (final.rowCount === 0 || final.rows[0].ganador_id === null) {
      throw new ServiceError(409, { error: 'La final todavía no tiene ganador' });
    }

    await client.query('UPDATE torneos SET estado = $1 WHERE torneo_id = $2', [ESTADOS.FINALIZADO, torneoId]);
  });
}

/** Cualquier estado no final → Cancelado. */
async function cancelarTorneo(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  await enTransaccion(async (client) => {
    const torneo = await bloquearTorneo(client, torneoId);
    validarTransicion(torneo.estado, ESTADOS.CANCELADO);

    await client.query('UPDATE torneos SET estado = $1 WHERE torneo_id = $2', [ESTADOS.CANCELADO, torneoId]);
  });
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
