const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { requireBodyOrEscalate } = require('./escalate');
const {
  ERROR_CATEGORIA_NO_EXISTE,
  ERROR_PARTICIPANTE_DUPLICADO,
  ERROR_SOCIO_NO_VALIDO,
  ERROR_TIPO_PARTICIPANTE,
  ERROR_VISITA_NO_VALIDA,
  esEnteroValido,
  tieneValor,
  torneoIdOrThrow
} = require('./torneoComun');

const MINIMO_PARTICIPANTES = 4;

const badRequest = (error) => new ServiceError(400, { error });

// ── Consulta ─────────────────────────────────────────────────────────────────

async function listarParticipantes(torneoIdParam) {
  const torneoId = torneoIdOrThrow(torneoIdParam);

  const result = await pool.query(
    `SELECT
           pt.participante_id,
           pt.torneo_id,
           pt.socio_id,
           pt.visita_id,
           pt.nombre_externo,
           pt.resultado_final,
           c.nombre AS categoria,
           COALESCE(
             NULLIF(TRIM(eq.nombre_equipo), ''),
             NULLIF(TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellido_paterno, ''), ' ', COALESCE(u.apellido_materno, ''))), ''),
             NULLIF(TRIM(v.nombre_completo), ''),
             NULLIF(TRIM(pt.nombre_externo), ''),
             'Participante sin nombre'
           ) AS nombre_participante,
           CASE
             WHEN pt.socio_id IS NOT NULL THEN 'Socio'
             WHEN pt.visita_id IS NOT NULL THEN 'Visita'
             ELSE 'Externo'
           END AS tipo_participante
         FROM participantes_torneo pt
         LEFT JOIN categorias_torneo c ON c.categoria_id = pt.categoria_id
         LEFT JOIN socios s ON s.socio_id = pt.socio_id
         LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
         LEFT JOIN visitas v ON v.visita_id = pt.visita_id
         LEFT JOIN equipos eq ON eq.equipo_id = pt.equipo_id
         WHERE pt.torneo_id = $1
         ORDER BY c.nombre, nombre_participante`,
    [torneoId]
  );

  return {
    data: result.rows,
    participantes: result.rows,
    total: result.rowCount,
    se_realiza: result.rowCount >= MINIMO_PARTICIPANTES,
    minimo_participantes: MINIMO_PARTICIPANTES
  };
}

/** Participaciones del socio vinculado al usuario autenticado. */
async function misParticipaciones(user) {
  const socioResult = await pool.query('SELECT socio_id FROM socios WHERE usuario_id = $1', [user.usuario_id]);
  if (socioResult.rowCount === 0) throw new ServiceError(404, { error: 'Socio no encontrado' });
  const socioId = socioResult.rows[0].socio_id;

  const result = await pool.query(
    `
        SELECT
          pt.participante_id,
          t.torneo_id,
          t.nombre,
          t.estado,
          t.fecha_inicio,
          t.fecha_fin,
          d.nombre AS nombre_disciplina,
          c.nombre AS categoria
        FROM participantes_torneo pt
        JOIN torneos t ON t.torneo_id = pt.torneo_id
        JOIN disciplinas d ON d.disciplina_id = t.disciplina_id
        LEFT JOIN categorias_torneo c ON c.categoria_id = pt.categoria_id
        WHERE pt.socio_id = $1
        ORDER BY t.fecha_inicio DESC NULLS LAST
      `,
    [socioId]
  );

  return result.rows;
}

// ── Inscripción ──────────────────────────────────────────────────────────────

/** Inscripción por staff: exactamente uno de socio_id, visita_id o nombre_externo. */
async function inscribirParticipante(torneoIdParam, body) {
  const { socio_id, visita_id, nombre_externo, categoria_id, equipo_id } = requireBodyOrEscalate(body);
  const socioPresente = tieneValor(socio_id);
  const visitaPresente = tieneValor(visita_id);
  const nombreExternoNormalizado = typeof nombre_externo === 'string' ? nombre_externo.trim() : null;
  const externoPresente = Boolean(nombreExternoNormalizado);
  const tiposParticipante = [socioPresente, visitaPresente, externoPresente].filter(Boolean).length;

  if (tiposParticipante !== 1) throw badRequest(ERROR_TIPO_PARTICIPANTE);

  const torneoId = torneoIdOrThrow(torneoIdParam);

  const socioId = socioPresente ? esEnteroValido(socio_id) : null;
  const visitaId = visitaPresente ? esEnteroValido(visita_id) : null;

  if (socioPresente) {
    if (socioId === null) throw badRequest(ERROR_SOCIO_NO_VALIDO);
    const socio = await pool.query('SELECT * FROM socios WHERE socio_id = $1 AND activo IS NOT FALSE', [socioId]);
    if (socio.rowCount === 0) throw badRequest(ERROR_SOCIO_NO_VALIDO);
  }

  if (visitaPresente) {
    if (visitaId === null) throw badRequest(ERROR_VISITA_NO_VALIDA);
    const visita = await pool.query('SELECT * FROM visitas WHERE visita_id = $1 AND vigente = TRUE', [visitaId]);
    if (visita.rowCount === 0) throw badRequest(ERROR_VISITA_NO_VALIDA);
  }

  const categoriaId = esEnteroValido(categoria_id);
  if (categoriaId === null) throw badRequest(ERROR_CATEGORIA_NO_EXISTE);

  const categoria = await pool.query('SELECT categoria_id FROM categorias_torneo WHERE categoria_id = $1', [
    categoriaId
  ]);
  if (categoria.rowCount === 0) throw badRequest(ERROR_CATEGORIA_NO_EXISTE);

  if (socioPresente || visitaPresente) {
    const participanteExistente = await pool.query(
      `SELECT participante_id FROM participantes_torneo
           WHERE torneo_id = $1 AND (socio_id = $2 OR visita_id = $3)
           LIMIT 1`,
      [torneoId, socioId, visitaId]
    );
    if (participanteExistente.rowCount > 0) {
      throw new ServiceError(409, { error: ERROR_PARTICIPANTE_DUPLICADO });
    }
  }

  const equipoId = tieneValor(equipo_id) ? esEnteroValido(equipo_id) : null;
  if (tieneValor(equipo_id) && equipoId === null) throw badRequest('equipo_id debe ser un entero valido');

  const result = await pool.query(
    `INSERT INTO participantes_torneo (torneo_id, socio_id, visita_id, nombre_externo, equipo_id, categoria_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING participante_id`,
    [torneoId, socioId, visitaId, externoPresente ? nombreExternoNormalizado : null, equipoId, categoriaId]
  );

  return result.rows[0].participante_id;
}

/**
 * Auto-inscripción del socio autenticado (sin requerir rol staff).
 * La categoría la decide el administrador al crear el torneo (torneo.categoria_id).
 */
async function inscribirSocioPropio(torneoIdParam, user) {
  const torneoId = torneoIdOrThrow(torneoIdParam);

  // Obtener socio_id a partir del usuario autenticado (no se confía en el body)
  const socioResult = await pool.query('SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo IS NOT FALSE', [
    user.usuario_id
  ]);
  if (socioResult.rowCount === 0) throw badRequest(ERROR_SOCIO_NO_VALIDO);
  const socioId = socioResult.rows[0].socio_id;

  // El torneo debe existir y estar abierto; se obtiene su categoria_id
  const torneo = await pool.query('SELECT torneo_id, estado, categoria_id FROM torneos WHERE torneo_id = $1', [
    torneoId
  ]);
  if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });
  if (torneo.rows[0].estado !== 'Abierto') {
    throw new ServiceError(409, { error: 'El torneo no está abierto para inscripciones' });
  }

  // Usar la categoría del torneo; si no tiene, devolver error indicativo
  const categoriaId = torneo.rows[0].categoria_id;
  if (!categoriaId) throw badRequest('Este torneo no tiene categoría asignada. Contacta al administrador.');

  // Verificar que no esté ya inscrito
  const existente = await pool.query(
    'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND socio_id = $2 LIMIT 1',
    [torneoId, socioId]
  );
  if (existente.rowCount > 0) throw new ServiceError(409, { error: ERROR_PARTICIPANTE_DUPLICADO });

  const result = await pool.query(
    `INSERT INTO participantes_torneo (torneo_id, socio_id, categoria_id)
         VALUES ($1, $2, $3)
         RETURNING participante_id`,
    [torneoId, socioId, categoriaId]
  );

  return result.rows[0].participante_id;
}

/** Desinscribe a un participante; solo mientras el torneo siga abierto. */
async function desinscribirParticipante(torneoIdParam, participanteIdParam) {
  const torneoId = esEnteroValido(torneoIdParam);
  const participanteId = esEnteroValido(participanteIdParam);

  if (torneoId === null || participanteId === null) throw badRequest('IDs inválidos');

  const torneo = await pool.query('SELECT estado FROM torneos WHERE torneo_id = $1', [torneoId]);
  if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });
  if (torneo.rows[0].estado !== 'Abierto') {
    throw new ServiceError(409, { error: 'No se puede desinscribir participantes una vez cerradas las inscripciones' });
  }

  const result = await pool.query(
    'DELETE FROM participantes_torneo WHERE participante_id = $1 AND torneo_id = $2 RETURNING participante_id',
    [participanteId, torneoId]
  );

  if (result.rowCount === 0) throw new ServiceError(404, { error: 'Participante no encontrado en este torneo' });
}

module.exports = {
  listarParticipantes,
  misParticipaciones,
  inscribirParticipante,
  inscribirSocioPropio,
  desinscribirParticipante
};
