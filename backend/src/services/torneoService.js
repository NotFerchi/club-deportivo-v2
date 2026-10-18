const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const {
  ERROR_CATEGORIA_NO_EXISTE,
  ERROR_CATEGORIA_REQUERIDA,
  ERROR_DISCIPLINA_NO_EXISTE,
  bloquearTorneo,
  contarInscritos,
  esIdValido,
  hayCupo,
  normalizarCupo,
  normalizarFechaOpcional,
  tieneValor
} = require('./torneoComun');
const { ESTADOS, admiteInscripciones, validarTransicion } = require('./torneoEstados');
const { enPeriodoInscripcion, hoyEnClub, validarFechasInscripcion } = require('./torneoFechas');
const { ERROR_CATEGORIA_INACTIVA } = require('./categoriaService');

const badRequest = (error) => new ServiceError(400, { error });

const ERROR_ESTADO_NO_EDITABLE = 'El estado se cambia con las acciones del torneo';
const ERROR_TORNEO_BLOQUEADO =
  'Con las inscripciones cerradas no se puede cambiar la disciplina, el tipo de torneo ni la categoría';
const ERROR_CATEGORIA_CON_INSCRITOS = 'No se puede cambiar la categoría: el torneo ya tiene inscritos';
const ERROR_CUPO_BLOQUEADO = 'Con las inscripciones cerradas no se puede cambiar el cupo';
const errorCupoMenorQueInscritos = (inscritos) =>
  `El cupo no puede ser menor que los inscritos actuales (${inscritos}); no se da de baja a nadie`;
const ERROR_ELIMINAR_EN_CURSO = 'Cancela el torneo antes de eliminarlo';

// ── Consulta ─────────────────────────────────────────────────────────────────

/** Torneos activos; los eliminados (activo = FALSE) no se listan. */
async function listarTorneos({ disciplina_id, estado }) {
  const condiciones = ['t.activo'];
  const valores = [];

  if (tieneValor(disciplina_id)) {
    valores.push(Number(disciplina_id)); // entero: validado en la ruta
    condiciones.push(`t.disciplina_id = $${valores.length}`);
  }

  if (tieneValor(estado)) {
    valores.push(estado);
    condiciones.push(`LOWER(t.estado) = LOWER($${valores.length})`);
  }

  const where = `WHERE ${condiciones.join(' AND ')}`;

  const result = await pool.query(
    `
        SELECT
          t.torneo_id,
          t.nombre,
          t.disciplina_id,
          d.nombre AS nombre_disciplina,
          t.fecha_inicio,
          t.fecha_fin,
          t.fecha_inicio_inscripcion,
          t.fecha_fin_inscripcion,
          t.estado,
          t.tipo_torneo,
          t.categoria_id,
          ct.nombre AS nombre_categoria,
          COUNT(pt.participante_id)::int AS total_participantes,
          (COUNT(pt.participante_id) >= 4) AS se_realiza,
          t.cupo_maximo,
          ${COLUMNAS_PERIODO_LISTADO}
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
  const hoy = hoyEnClub();
  return result.rows.map(({ periodo_fecha_inicio, periodo_inicio_inscripcion, periodo_fin_inscripcion, ...torneo }) => ({
    ...torneo,
    admite_inscripcion: admiteInscripcion(
      torneo,
      {
        fecha_inicio: periodo_fecha_inicio,
        fecha_inicio_inscripcion: periodo_inicio_inscripcion,
        fecha_fin_inscripcion: periodo_fin_inscripcion
      },
      hoy
    )
  }));
}

// Fechas del periodo como texto 'YYYY-MM-DD' solo para calcular admite_inscripcion: las columnas públicas
// (fecha_inicio, ...) conservan su formato de siempre. Se quitan de la respuesta.
const COLUMNAS_PERIODO_LISTADO = [
  "to_char(t.fecha_inicio, 'YYYY-MM-DD') AS periodo_fecha_inicio",
  "to_char(t.fecha_inicio_inscripcion, 'YYYY-MM-DD') AS periodo_inicio_inscripcion",
  "to_char(t.fecha_fin_inscripcion, 'YYYY-MM-DD') AS periodo_fin_inscripcion"
].join(',\n          ');

/**
 * E2.12: true si hoy se puede inscribir alguien, con las mismas reglas que las inscripciones: estado
 * Abierto, con categoría, dentro del periodo de inscripción (F-07) y con cupo libre (NULL = sin límite).
 */
function admiteInscripcion(torneo, periodo, hoy) {
  return (
    admiteInscripciones(torneo.estado) &&
    torneo.categoria_id !== null &&
    enPeriodoInscripcion(periodo, hoy) &&
    hayCupo(torneo.total_participantes, torneo.cupo_maximo)
  );
}

async function obtenerReporte(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  const torneo = await pool.query(
    `SELECT t.torneo_id, t.nombre, t.estado, d.nombre AS disciplina
         FROM torneos t
         JOIN disciplinas d ON d.disciplina_id = t.disciplina_id
         WHERE t.torneo_id = $1 AND t.activo`,
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

/**
 * 400 si la disciplina o la categoría (cuando viene) no existen; `db` es el pool o el cliente de la
 * transacción. Con `exigirActiva` también 400 si la categoría está desactivada (E2.6): se exige al
 * crear y al cambiar de categoría; un torneo que ya tenía una categoría desactivada la conserva.
 */
async function validarReferencias(db, disciplinaId, categoriaId, { exigirActiva = true } = {}) {
  const disciplina = await db.query('SELECT disciplina_id FROM disciplinas WHERE disciplina_id = $1', [disciplinaId]);
  if (disciplina.rowCount === 0) throw badRequest(ERROR_DISCIPLINA_NO_EXISTE);

  if (categoriaId !== null) {
    const categoria = await db.query('SELECT categoria_id, activo FROM categorias_torneo WHERE categoria_id = $1', [
      categoriaId
    ]);
    if (categoria.rowCount === 0) throw badRequest(ERROR_CATEGORIA_NO_EXISTE);
    if (exigirActiva && !categoria.rows[0].activo) throw badRequest(ERROR_CATEGORIA_INACTIVA);
  }
}

/**
 * Body validado en la ruta (nombre, disciplina_id, categoria_id, tipo_torneo, fechas, periodo de
 * inscripción y cupo_maximo). Todo torneo nace Abierto: `estado` se ignora. Sin cupo_maximo, sin límite.
 */
async function crearTorneo(body) {
  const { nombre, disciplina_id, fecha_inicio, fecha_fin, categoria_id, tipo_torneo } = body;
  const disciplinaId = esIdValido(disciplina_id);
  const categoriaId = tieneValor(categoria_id) ? esIdValido(categoria_id) : null;

  await validarReferencias(pool, disciplinaId, categoriaId);

  const result = await pool.query(
    `INSERT INTO torneos (disciplina_id, nombre, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo,
                          fecha_inicio_inscripcion, fecha_fin_inscripcion, cupo_maximo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING torneo_id`,
    [
      disciplinaId,
      nombre.trim(),
      normalizarFechaOpcional(fecha_inicio),
      normalizarFechaOpcional(fecha_fin),
      ESTADOS.ABIERTO,
      categoriaId,
      tipo_torneo || 'Individual',
      normalizarFechaOpcional(body.fecha_inicio_inscripcion),
      normalizarFechaOpcional(body.fecha_fin_inscripcion),
      normalizarCupo(body.cupo_maximo) ?? null
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
 * Las fechas de inscripción que no vienen en el body se conservan (null o '' las quitan), y el orden
 * de las fechas se comprueba con el resultado (400).
 * cupo_maximo (E2.4): si no viene se conserva; null lo quita. Solo cambia con el torneo Abierto (409) y no
 * puede quedar por debajo de los inscritos actuales (409): nunca se da de baja a nadie.
 */
async function actualizarTorneo(torneoIdParam, body) {
  const torneoId = Number(torneoIdParam);
  const { nombre, disciplina_id, fecha_inicio, fecha_fin, estado, categoria_id, tipo_torneo } = body;
  const disciplinaId = esIdValido(disciplina_id);

  const categoriaId = tieneValor(categoria_id) ? esIdValido(categoria_id) : null;

  return enTransaccion(async (client) => {
    const actual = await bloquearTorneo(
      client,
      torneoId,
      `estado, disciplina_id, tipo_torneo, categoria_id,
       to_char(fecha_inicio_inscripcion, 'YYYY-MM-DD') AS fecha_inicio_inscripcion,
       to_char(fecha_fin_inscripcion, 'YYYY-MM-DD') AS fecha_fin_inscripcion,
       nombre, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
       cupo_maximo`
    );

    if (tieneValor(estado) && estado !== actual.estado) throw badRequest(ERROR_ESTADO_NO_EDITABLE);

    const conservaOCambia = (campo) =>
      body[campo] === undefined ? (actual[campo] ?? null) : normalizarFechaOpcional(body[campo]);
    const fechas = {
      fecha_inicio: normalizarFechaOpcional(fecha_inicio),
      fecha_inicio_inscripcion: conservaOCambia('fecha_inicio_inscripcion'),
      fecha_fin_inscripcion: conservaOCambia('fecha_fin_inscripcion')
    };
    const fechasMal = validarFechasInscripcion(fechas);
    if (fechasMal) throw badRequest(fechasMal);

    if (admiteInscripciones(actual.estado) && categoriaId === null) throw badRequest(ERROR_CATEGORIA_REQUERIDA);

    if (!admiteInscripciones(actual.estado)) {
      const cambiaTipo = Boolean(tipo_torneo) && tipo_torneo !== actual.tipo_torneo;
      if (disciplinaId !== actual.disciplina_id || cambiaTipo || categoriaId !== actual.categoria_id) {
        throw new ServiceError(409, { error: ERROR_TORNEO_BLOQUEADO });
      }
    }

    // Solo con el torneo Abierto puede cambiar la categoría (si no, ya respondió 409 arriba)
    const cambiaCategoria = categoriaId !== actual.categoria_id;
    await validarReferencias(client, disciplinaId, categoriaId, { exigirActiva: cambiaCategoria });

    const cupoPedido = normalizarCupo(body.cupo_maximo);
    const cupo = cupoPedido === undefined ? (actual.cupo_maximo ?? null) : cupoPedido;
    if (cupo !== (actual.cupo_maximo ?? null)) {
      if (!admiteInscripciones(actual.estado)) throw new ServiceError(409, { error: ERROR_CUPO_BLOQUEADO });
      if (cupo !== null) {
        const inscritos = await contarInscritos(client, torneoId);
        // cupo === inscritos es válido (queda lleno); menor dejaría inscritos fuera
        if (cupo < inscritos) throw new ServiceError(409, { error: errorCupoMenorQueInscritos(inscritos) });
      }
    }

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
             tipo_torneo   = COALESCE($6, tipo_torneo),
             fecha_inicio_inscripcion = $7,
             fecha_fin_inscripcion    = $8,
             cupo_maximo   = $10
         WHERE torneo_id = $9`,
      [
        disciplinaId,
        nombre.trim(),
        fechas.fecha_inicio,
        normalizarFechaOpcional(fecha_fin),
        categoriaId,
        tipo_torneo || null,
        fechas.fecha_inicio_inscripcion,
        fechas.fecha_fin_inscripcion,
        torneoId,
        cupo
      ]
    );

    // Torneo sin categoría que recibe una: sus inscritos pasan a esa categoría
    if (cambiaCategoria && actual.categoria_id === null) {
      await client.query('UPDATE participantes_torneo SET categoria_id = $1 WHERE torneo_id = $2', [
        categoriaId,
        torneoId
      ]);
    }

    const despues = {
      nombre: nombre.trim(),
      disciplina_id: disciplinaId,
      tipo_torneo: tipo_torneo || actual.tipo_torneo,
      categoria_id: categoriaId,
      fecha_inicio: fechas.fecha_inicio,
      fecha_fin: normalizarFechaOpcional(fecha_fin),
      fecha_inicio_inscripcion: fechas.fecha_inicio_inscripcion,
      fecha_fin_inscripcion: fechas.fecha_fin_inscripcion,
      cupo_maximo: cupo
    };
    return { torneoId, cambios: camposCambiados(actual, despues) };
  });
}

/** Para la auditoría (E2.10): { campo: { antes, despues } } de los campos que cambiaron. */
function camposCambiados(antes, despues) {
  const cambios = {};
  for (const [campo, valor] of Object.entries(despues)) {
    const anterior = antes[campo] ?? null;
    if (anterior !== valor) cambios[campo] = { antes: anterior, despues: valor };
  }
  return cambios;
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

/** Cualquier estado no final → Cancelado. Devuelve el estado anterior (para la auditoría). */
async function cancelarTorneo(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  return enTransaccion(async (client) => {
    const torneo = await bloquearTorneo(client, torneoId);
    validarTransicion(torneo.estado, ESTADOS.CANCELADO);

    await client.query('UPDATE torneos SET estado = $1 WHERE torneo_id = $2', [ESTADOS.CANCELADO, torneoId]);
    return torneo.estado;
  });
}

// ── Eliminación ──────────────────────────────────────────────────────────────

/**
 * Sin participantes ni encuentros: borra la fila ('fisico'). Con historial: activo = FALSE ('logico'),
 * porque las FKs de participantes_torneo y encuentros_torneo no tienen ON DELETE. Con la fila bloqueada,
 * nadie puede inscribirse ni generar el bracket entre la comprobación y el borrado. 404 si no existe o
 * ya está eliminado; 409 si está en curso (primero se cancela). Devuelve { borrado, nombre }.
 */
async function eliminarTorneo(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  return enTransaccion(async (client) => {
    const torneo = await bloquearTorneo(client, torneoId, 'estado, nombre');
    if (torneo.estado === ESTADOS.EN_CURSO) throw new ServiceError(409, { error: ERROR_ELIMINAR_EN_CURSO });

    const { rows } = await client.query(
      `SELECT EXISTS (SELECT 1 FROM participantes_torneo WHERE torneo_id = $1) AS tiene_participantes,
              EXISTS (SELECT 1 FROM encuentros_torneo WHERE torneo_id = $1) AS tiene_encuentros`,
      [torneoId]
    );
    const { tiene_participantes, tiene_encuentros } = rows[0];

    if (!tiene_participantes && !tiene_encuentros) {
      await client.query('DELETE FROM torneos WHERE torneo_id = $1', [torneoId]);
      return { borrado: 'fisico', nombre: torneo.nombre };
    }

    await client.query('UPDATE torneos SET activo = FALSE WHERE torneo_id = $1', [torneoId]);
    return { borrado: 'logico', nombre: torneo.nombre };
  });
}

module.exports = {
  listarTorneos,
  obtenerReporte,
  crearTorneo,
  actualizarTorneo,
  finalizarTorneo,
  cancelarTorneo,
  eliminarTorneo
};
