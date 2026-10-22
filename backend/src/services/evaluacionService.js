// Evaluación de instructores (E4). Contrato: docs/api-evaluaciones.md.
// El formato de la entrada ya lo validó evaluacionValidators.js; aquí van las reglas que dependen de la BD.
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { enTransaccion } = require('./transaction');
const { esIdValido, tieneValor } = require('./torneoComun');

const ERROR_SIN_SOCIO = 'Tu usuario no tiene un registro de socio activo';
const ERROR_NO_INSCRITO = 'Solo puedes evaluar clases en las que estás inscrito';
const ERROR_SESION_NO_EXISTE = 'Sesión no encontrada';
const ERROR_SIN_INSTRUCTOR = 'La sesión no tiene instructor asignado';
const ERROR_INSTRUCTOR_INACTIVO = 'El instructor de esta sesión está inactivo';
const ERROR_DUPLICADA = 'Ya evaluaste esta clase este mes';
const ERROR_INSTRUCTOR_NO_EXISTE = 'Instructor no encontrado';
const ERROR_SIN_PERMISO = 'No tienes permisos para esta acción';

// periodo y fecha_creacion como texto en hora del club, para que Node no los convierta a UTC
const PERIODO_TEXTO = "to_char(e.periodo, 'YYYY-MM') AS periodo";
const FECHA_TEXTO = `to_char(e.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion`;

/** '2026-10' → '2026-10-01' (el periodo guardado); null si no viene. */
const inicioDePeriodo = (periodo) => (tieneValor(periodo) ? `${periodo}-01` : null);

/** socio_id del usuario autenticado; 403 si no tiene socio o está inactivo. */
async function socioActivoDeUsuario(db, usuarioId) {
  const { rows } = await db.query('SELECT socio_id FROM socios WHERE usuario_id = $1 AND activo IS NOT FALSE', [
    usuarioId
  ]);
  if (rows.length === 0) throw new ServiceError(403, { error: ERROR_SIN_SOCIO });
  return rows[0].socio_id;
}

/** Comentario recortado; vacío o ausente → null. */
function normalizarComentario(comentario) {
  if (typeof comentario !== 'string') return null;
  const recortado = comentario.trim();
  return recortado === '' ? null : recortado;
}

/**
 * POST /: valida socio → sesión → inscripción Confirmada → instructor asignado y activo, e inserta, todo en
 * una transacción. El duplicado (mismo socio, sesión y mes) lo decide el UNIQUE: 23505 → 409.
 */
async function crearEvaluacion(usuarioId, body) {
  const sesionId = esIdValido(body.sesion_id);
  const calificacion = Number(body.calificacion);
  const comentario = normalizarComentario(body.comentario);

  try {
    return await enTransaccion(async (client) => {
      const socioId = await socioActivoDeUsuario(client, usuarioId);

      const sesion = await client.query(
        `SELECT sp.instructor_id, i.activo AS instructor_activo
           FROM sesiones_programadas sp
           LEFT JOIN instructores i ON i.instructor_id = sp.instructor_id
          WHERE sp.sesion_id = $1`,
        [sesionId]
      );
      if (sesion.rows.length === 0) throw new ServiceError(404, { error: ERROR_SESION_NO_EXISTE });

      const inscripcion = await client.query(
        `SELECT 1 FROM inscripciones_clases
          WHERE sesion_id = $1 AND socio_id = $2 AND estado = 'Confirmada'
          LIMIT 1`,
        [sesionId, socioId]
      );
      if (inscripcion.rows.length === 0) throw new ServiceError(403, { error: ERROR_NO_INSCRITO });

      const { instructor_id: instructorId, instructor_activo: instructorActivo } = sesion.rows[0];
      if (instructorId === null) throw new ServiceError(409, { error: ERROR_SIN_INSTRUCTOR });
      if (instructorActivo === false) throw new ServiceError(409, { error: ERROR_INSTRUCTOR_INACTIVO });

      const { rows } = await client.query(
        `INSERT INTO evaluaciones_instructor AS e
                (instructor_id, sesion_id, socio_id, calificacion, comentario, periodo, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5,
                 date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')::date,
                 now() AT TIME ZONE 'America/Mexico_City')
         RETURNING e.evaluacion_id, e.instructor_id, e.sesion_id, e.calificacion, e.comentario,
                   ${PERIODO_TEXTO}, ${FECHA_TEXTO}`,
        [instructorId, sesionId, socioId, calificacion, comentario]
      );
      return rows[0];
    });
  } catch (error) {
    if (error.code === '23505') throw new ServiceError(409, { error: ERROR_DUPLICADA });
    throw error;
  }
}

/**
 * Acceso a las evaluaciones de un instructor. Staff: cualquiera. Instructor: solo el suyo; si no tiene
 * registro o no coincide, 403 (antes del 404, para no revelar qué ids existen). 404 si no existe.
 */
async function verificarAcceso(user, instructorId) {
  if (user.rol === 'instructor') {
    const { rows } = await pool.query('SELECT instructor_id FROM instructores WHERE usuario_id = $1', [
      user.usuario_id
    ]);
    if (rows.length === 0 || rows[0].instructor_id !== instructorId) {
      throw new ServiceError(403, { error: ERROR_SIN_PERMISO });
    }
  }
  const existe = await pool.query('SELECT 1 FROM instructores WHERE instructor_id = $1', [instructorId]);
  if (existe.rows.length === 0) throw new ServiceError(404, { error: ERROR_INSTRUCTOR_NO_EXISTE });
}

/** GET /instructor/:instructor_id: lista anónima (sin socio_id ni nombre), de la más reciente a la más antigua. */
async function listarPorInstructor(user, instructorIdParam, periodo) {
  const instructorId = esIdValido(instructorIdParam);
  await verificarAcceso(user, instructorId);
  const { rows } = await pool.query(
    `SELECT e.evaluacion_id, e.sesion_id, d.nombre AS disciplina, e.calificacion, e.comentario,
            ${PERIODO_TEXTO}, ${FECHA_TEXTO}
       FROM evaluaciones_instructor e
       JOIN sesiones_programadas sp ON sp.sesion_id = e.sesion_id
       LEFT JOIN disciplinas d ON d.disciplina_id = sp.disciplina_id
      WHERE e.instructor_id = $1 AND ($2::date IS NULL OR e.periodo = $2::date)
      ORDER BY e.fecha_creacion DESC, e.evaluacion_id DESC`,
    [instructorId, inicioDePeriodo(periodo)]
  );
  return rows;
}

/** GET /instructor/:instructor_id/promedio: total, promedio con 2 decimales (null sin evaluaciones) y distribución. */
async function promedioDeInstructor(user, instructorIdParam, periodo) {
  const instructorId = esIdValido(instructorIdParam);
  await verificarAcceso(user, instructorId);
  const { rows } = await pool.query(
    `SELECT e.calificacion, COUNT(*)::int AS total
       FROM evaluaciones_instructor e
      WHERE e.instructor_id = $1 AND ($2::date IS NULL OR e.periodo = $2::date)
      GROUP BY e.calificacion`,
    [instructorId, inicioDePeriodo(periodo)]
  );

  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let suma = 0;
  for (const { calificacion, total: votos } of rows) {
    distribucion[calificacion] = votos;
    total += votos;
    suma += calificacion * votos;
  }
  const promedio = total === 0 ? null : Math.round((suma / total) * 100) / 100;
  return { instructor_id: instructorId, total, promedio, distribucion };
}

/** GET /mias: las evaluaciones que hizo el socio del token (sin socio_id). */
async function misEvaluaciones(usuarioId, periodo) {
  const socioId = await socioActivoDeUsuario(pool, usuarioId);
  const { rows } = await pool.query(
    `SELECT e.evaluacion_id, e.sesion_id, e.instructor_id, d.nombre AS disciplina, e.calificacion, e.comentario,
            ${PERIODO_TEXTO}, ${FECHA_TEXTO}
       FROM evaluaciones_instructor e
       JOIN sesiones_programadas sp ON sp.sesion_id = e.sesion_id
       LEFT JOIN disciplinas d ON d.disciplina_id = sp.disciplina_id
      WHERE e.socio_id = $1 AND ($2::date IS NULL OR e.periodo = $2::date)
      ORDER BY e.fecha_creacion DESC, e.evaluacion_id DESC`,
    [socioId, inicioDePeriodo(periodo)]
  );
  return rows;
}

module.exports = {
  ERROR_SIN_SOCIO,
  ERROR_NO_INSCRITO,
  ERROR_SESION_NO_EXISTE,
  ERROR_SIN_INSTRUCTOR,
  ERROR_INSTRUCTOR_INACTIVO,
  ERROR_DUPLICADA,
  ERROR_INSTRUCTOR_NO_EXISTE,
  crearEvaluacion,
  listarPorInstructor,
  promedioDeInstructor,
  misEvaluaciones
};
