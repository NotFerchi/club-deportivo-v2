const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { admiteInscripciones } = require('./torneoEstados');
const { COLUMNAS_FECHAS_TORNEO, ERROR_INSCRIPCIONES_CERRADAS, enPeriodoInscripcion } = require('./torneoFechas');
const {
  ERROR_PARTICIPANTE_DUPLICADO,
  ERROR_SOCIO_NO_VALIDO,
  ERROR_TORNEO_SIN_CATEGORIA,
  ERROR_VISITA_NO_VALIDA,
  bloquearTorneo,
  esIdValido,
  esPorEquipos,
  normalizarNombre,
  tieneValor
} = require('./torneoComun');

const MINIMO_PARTICIPANTES = 4;

const badRequest = (error) => new ServiceError(400, { error });

const ERROR_TORNEO_NO_ABIERTO = 'El torneo no está abierto para inscripciones';
const ERROR_CATEGORIA_DISTINTA = 'La categoría debe ser la del torneo';
const ERROR_EQUIPOS_SOLO_EQUIPOS = 'En un torneo por equipos solo se inscriben equipos (nombre_externo)';
const ERROR_EQUIPOS_LO_INSCRIBE_STAFF = 'Este torneo es por equipos: la inscripción la hace el staff';

// Columnas del torneo que necesitan las inscripciones (estado, categoría, modalidad y periodo de inscripción).
const COLUMNAS_INSCRIPCION = `estado, categoria_id, tipo_torneo, ${COLUMNAS_FECHAS_TORNEO}`;

// ── Consulta ─────────────────────────────────────────────────────────────────

/** Participantes del torneo; 404 si el torneo no existe. */
async function listarParticipantes(torneoIdParam) {
  const torneoId = Number(torneoIdParam); // id válido: validado en la ruta

  const torneo = await pool.query('SELECT torneo_id FROM torneos WHERE torneo_id = $1 AND activo', [torneoId]);
  if (torneo.rowCount === 0) throw new ServiceError(404, { error: 'Torneo no encontrado' });

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
        WHERE pt.socio_id = $1 AND t.activo
        ORDER BY t.fecha_inicio DESC NULLS LAST
      `,
    [socioId]
  );

  return result.rows;
}

// ── Inscripción ──────────────────────────────────────────────────────────────

/**
 * Inscripción por staff. El formato (exactamente uno de socio_id, visita_id o nombre_externo,
 * ids válidos y nombre_externo ≤ 150) se valida en la ruta; aquí, lo que depende de la BD.
 * Con la fila del torneo bloqueada: 404 si no existe, 409 si no está Abierto, si hoy (México) está
 * fuera del periodo de inscripción (F-07) o si no tiene categoría,
 * 400 si categoria_id no es la del torneo (B-14) o si es por equipos y no se inscribe un equipo (B-15),
 * y 409 si el socio, la visita o el externo (por nombre normalizado) ya está inscrito.
 * El participante siempre queda con la categoría del torneo.
 */
async function inscribirParticipante(torneoIdParam, body) {
  const { socio_id, visita_id, nombre_externo, categoria_id, equipo_id } = body;
  const socioId = tieneValor(socio_id) ? esIdValido(socio_id) : null;
  const visitaId = tieneValor(visita_id) ? esIdValido(visita_id) : null;
  const nombreExterno = typeof nombre_externo === 'string' && nombre_externo.trim() ? nombre_externo.trim() : null;
  const categoriaPedida = tieneValor(categoria_id) ? esIdValido(categoria_id) : null;
  const equipoId = tieneValor(equipo_id) ? esIdValido(equipo_id) : null;

  const torneoId = Number(torneoIdParam); // id válido: validado en la ruta

  return enTransaccion(async (client) => {
    const torneo = await bloquearTorneo(client, torneoId, COLUMNAS_INSCRIPCION);
    if (!admiteInscripciones(torneo.estado)) throw new ServiceError(409, { error: ERROR_TORNEO_NO_ABIERTO });
    if (!enPeriodoInscripcion(torneo)) throw new ServiceError(409, { error: ERROR_INSCRIPCIONES_CERRADAS });

    const categoriaId = torneo.categoria_id;
    if (categoriaId === null) throw new ServiceError(409, { error: ERROR_TORNEO_SIN_CATEGORIA });
    if (categoriaPedida !== null && categoriaPedida !== categoriaId) throw badRequest(ERROR_CATEGORIA_DISTINTA);

    if (esPorEquipos(torneo.tipo_torneo) && (socioId !== null || visitaId !== null)) {
      throw badRequest(ERROR_EQUIPOS_SOLO_EQUIPOS);
    }

    if (socioId !== null) {
      const socio = await client.query('SELECT * FROM socios WHERE socio_id = $1 AND activo IS NOT FALSE', [socioId]);
      if (socio.rowCount === 0) throw badRequest(ERROR_SOCIO_NO_VALIDO);
    }

    if (visitaId !== null) {
      const visita = await client.query('SELECT * FROM visitas WHERE visita_id = $1 AND vigente = TRUE', [visitaId]);
      if (visita.rowCount === 0) throw badRequest(ERROR_VISITA_NO_VALIDA);
    }

    if (socioId !== null || visitaId !== null) {
      const participanteExistente = await client.query(
        `SELECT participante_id FROM participantes_torneo
             WHERE torneo_id = $1 AND (socio_id = $2 OR visita_id = $3)
             LIMIT 1`,
        [torneoId, socioId, visitaId]
      );
      if (participanteExistente.rowCount > 0) {
        throw new ServiceError(409, { error: ERROR_PARTICIPANTE_DUPLICADO });
      }
    }

    if (nombreExterno !== null) {
      // Se compara en JS para no depender del locale de la BD al pasar a minúsculas ("Á" → "á")
      const externos = await client.query(
        'SELECT nombre_externo FROM participantes_torneo WHERE torneo_id = $1 AND nombre_externo IS NOT NULL',
        [torneoId]
      );
      const buscado = normalizarNombre(nombreExterno);
      if (externos.rows.some((p) => normalizarNombre(p.nombre_externo) === buscado)) {
        throw new ServiceError(409, { error: ERROR_PARTICIPANTE_DUPLICADO });
      }
    }

    const result = await client.query(
      `INSERT INTO participantes_torneo (torneo_id, socio_id, visita_id, nombre_externo, equipo_id, categoria_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING participante_id`,
      [torneoId, socioId, visitaId, nombreExterno, equipoId, categoriaId]
    );

    return result.rows[0].participante_id;
  });
}

/**
 * Auto-inscripción del socio autenticado (sin requerir rol staff).
 * La categoría la decide el administrador al crear el torneo (torneo.categoria_id).
 * Con la fila del torneo bloqueada: 404 si no existe, 409 si no está Abierto, si hoy (México)
 * está fuera del periodo de inscripción (F-07), si es por equipos (los equipos los inscribe el
 * staff, B-15) o si no tiene categoría.
 */
async function inscribirSocioPropio(torneoIdParam, user) {
  const torneoId = Number(torneoIdParam); // entero: validado en la ruta

  return enTransaccion(async (client) => {
    // El torneo debe existir y estar abierto; se obtiene su categoria_id
    const torneo = await bloquearTorneo(client, torneoId, COLUMNAS_INSCRIPCION);
    if (!admiteInscripciones(torneo.estado)) throw new ServiceError(409, { error: ERROR_TORNEO_NO_ABIERTO });
    if (!enPeriodoInscripcion(torneo)) throw new ServiceError(409, { error: ERROR_INSCRIPCIONES_CERRADAS });
    if (esPorEquipos(torneo.tipo_torneo)) throw new ServiceError(409, { error: ERROR_EQUIPOS_LO_INSCRIBE_STAFF });

    // Obtener socio_id a partir del usuario autenticado (no se confía en el body)
    const socioResult = await client.query(
      'SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo IS NOT FALSE',
      [user.usuario_id]
    );
    if (socioResult.rowCount === 0) throw badRequest(ERROR_SOCIO_NO_VALIDO);
    const socioId = socioResult.rows[0].socio_id;

    // Usar la categoría del torneo; si no tiene, devolver error indicativo
    const categoriaId = torneo.categoria_id;
    if (!categoriaId) throw new ServiceError(409, { error: ERROR_TORNEO_SIN_CATEGORIA });

    // Verificar que no esté ya inscrito
    const existente = await client.query(
      'SELECT participante_id FROM participantes_torneo WHERE torneo_id = $1 AND socio_id = $2 LIMIT 1',
      [torneoId, socioId]
    );
    if (existente.rowCount > 0) throw new ServiceError(409, { error: ERROR_PARTICIPANTE_DUPLICADO });

    const result = await client.query(
      `INSERT INTO participantes_torneo (torneo_id, socio_id, categoria_id)
           VALUES ($1, $2, $3)
           RETURNING participante_id`,
      [torneoId, socioId, categoriaId]
    );

    return result.rows[0].participante_id;
  });
}

/** Desinscribe a un participante; solo con el torneo Abierto y si aún no está en el bracket. */
async function desinscribirParticipante(torneoIdParam, participanteIdParam) {
  // Ambos enteros: validado en la ruta
  const torneoId = Number(torneoIdParam);
  const participanteId = Number(participanteIdParam);

  await enTransaccion(async (client) => {
    const torneo = await bloquearTorneo(client, torneoId);
    if (!admiteInscripciones(torneo.estado)) {
      throw new ServiceError(409, {
        error: 'No se puede desinscribir participantes una vez cerradas las inscripciones'
      });
    }

    const enBracket = await client.query(
      `SELECT 1 FROM encuentros_torneo
           WHERE $1 IN (participante_1_id, participante_2_id, ganador_id)
           LIMIT 1`,
      [participanteId]
    );
    if (enBracket.rowCount > 0) throw new ServiceError(409, { error: 'El participante ya está en el bracket' });

    const result = await client.query(
      'DELETE FROM participantes_torneo WHERE participante_id = $1 AND torneo_id = $2 RETURNING participante_id',
      [participanteId, torneoId]
    );

    if (result.rowCount === 0) throw new ServiceError(404, { error: 'Participante no encontrado en este torneo' });
  });
}

module.exports = {
  listarParticipantes,
  misParticipaciones,
  inscribirParticipante,
  inscribirSocioPropio,
  desinscribirParticipante
};
