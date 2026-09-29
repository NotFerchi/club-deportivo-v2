// Panel del instructor: clases del día, alumnos, asistencia, métricas, inscripción rápida y torneos.
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { requireBodyOrEscalate } = require('./escalate');
const { getMexicoDateISO } = require('../utils/mexicoDate');

/** Día ISO (1 = lunes … 7 = domingo) de una fecha 'YYYY-MM-DD' (hora local). */
function diaSemanaDeFecha(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const rawDay = new Date(y, m - 1, d).getDay();
  return rawDay === 0 ? 7 : rawDay;
}

/** instructor_id del usuario autenticado; 404 si no es instructor. */
async function instructorIdDeUsuario(usuarioId) {
  const instructorQuery = await pool.query(`SELECT i.instructor_id FROM instructores i WHERE i.usuario_id = $1`, [
    usuarioId
  ]);

  if (instructorQuery.rows.length === 0) {
    throw new ServiceError(404, { error: 'Instructor no encontrado' });
  }

  return instructorQuery.rows[0].instructor_id;
}

// ── Clases ───────────────────────────────────────────────────────────────────

async function clasesPorFecha(usuarioId, fecha) {
  const instructorId = await instructorIdDeUsuario(usuarioId);
  const diaSemana = diaSemanaDeFecha(fecha);

  const query = `
                SELECT
                    sp.sesion_id,
                    sp.espacio_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    (
                        SELECT COUNT(DISTINCT socio_id) FROM (
                            SELECT ic.socio_id FROM inscripciones_clases ic
                            WHERE ic.sesion_id = sp.sesion_id AND ic.estado = 'Confirmada'
                            UNION
                            SELECT r2.socio_id FROM reservaciones r2
                            WHERE r2.sesion_id = sp.sesion_id AND r2.fecha_reserva = $1
                              AND r2.estado IN ('Confirmada', 'No-Show') AND r2.socio_id IS NOT NULL
                        ) sub
                    ) + (
                        SELECT COUNT(*) FROM reservaciones r3
                        WHERE r3.sesion_id = sp.sesion_id AND r3.fecha_reserva = $1
                          AND r3.estado IN ('Confirmada', 'No-Show') AND r3.visita_id IS NOT NULL
                    ) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.instructor_id = $2 AND sp.dia_semana = $3
                ORDER BY sp.hora_inicio
            `;

  const result = await pool.query(query, [fecha, instructorId, diaSemana]);
  return result.rows;
}

/** Inscritos recurrentes + agregados por reservación en la fecha, con su asistencia. */
async function alumnosPorClase(sesionId, fecha) {
  const query = `
                WITH participantes AS (
                    -- Inscritos vía inscripciones_clases (recurrentes del socio)
                    SELECT
                        ic.inscripcion_id,
                        NULL::int AS reserva_id,
                        ic.socio_id,
                        NULL::int AS visita_id
                    FROM inscripciones_clases ic
                    WHERE ic.sesion_id = $1
                      AND ic.estado = 'Confirmada'

                    UNION ALL

                    -- Agregados por instructor vía reservaciones para esta fecha
                    -- (excluye socios que ya están en inscripciones_clases)
                    SELECT
                        NULL::int AS inscripcion_id,
                        r.reserva_id,
                        r.socio_id,
                        r.visita_id
                    FROM reservaciones r
                    WHERE r.sesion_id = $1
                      AND r.fecha_reserva = $2
                      AND r.estado IN ('Confirmada', 'No-Show')
                      AND (r.socio_id IS NOT NULL OR r.visita_id IS NOT NULL)
                      AND (r.socio_id IS NULL OR NOT EXISTS (
                            SELECT 1 FROM inscripciones_clases ic2
                            WHERE ic2.sesion_id = $1
                              AND ic2.socio_id = r.socio_id
                              AND ic2.estado = 'Confirmada'
                          ))
                )
                SELECT
                    p.inscripcion_id,
                    p.reserva_id,
                    p.socio_id,
                    p.visita_id,
                    COALESCE(
                        NULLIF(TRIM(u.nombres || ' ' || COALESCE(u.apellido_paterno, '')), ''),
                        v.nombre_completo,
                        'Sin nombre'
                    ) AS nombre_socio,
                    CASE WHEN p.visita_id IS NOT NULL THEN 'Visita' ELSE 'Socio' END AS tipo,
                    a.presente AS asistio
                FROM participantes p
                LEFT JOIN socios s ON s.socio_id = p.socio_id
                LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
                LEFT JOIN visitas v ON v.visita_id = p.visita_id
                LEFT JOIN asistencia a ON a.sesion_id = $1
                    AND a.socio_id = p.socio_id
                    AND a.fecha = $2::date
                ORDER BY nombre_socio
            `;
  const result = await pool.query(query, [sesionId, fecha]);
  return result.rows;
}

async function misClases(usuarioId) {
  const instructorId = await instructorIdDeUsuario(usuarioId);

  const query = `
                SELECT
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    sp.dia_semana,
                    CASE sp.dia_semana
                        WHEN 1 THEN 'Lunes'
                        WHEN 2 THEN 'Martes'
                        WHEN 3 THEN 'Miércoles'
                        WHEN 4 THEN 'Jueves'
                        WHEN 5 THEN 'Viernes'
                        WHEN 6 THEN 'Sábado'
                        WHEN 7 THEN 'Domingo'
                    END as dias,
                    (
                        SELECT COUNT(*) FROM inscripciones_clases ic
                        WHERE ic.sesion_id = sp.sesion_id AND ic.estado = 'Confirmada'
                    ) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.instructor_id = $1
                ORDER BY sp.dia_semana, sp.hora_inicio
            `;

  const result = await pool.query(query, [instructorId]);
  return result.rows;
}

/** Fecha consultada (hoy en México por defecto) y su día ISO; fuera del try en el controlador. */
function resolverDiaConsulta(fecha) {
  const fechaConsulta = fecha || getMexicoDateISO();
  return { fechaConsulta, diaSemana: diaSemanaDeFecha(fechaConsulta) };
}

/** Todas las clases del día (cualquier instructor) con su cupo ocupado en la fecha. */
async function clasesGeneral({ diaSemana, fechaConsulta }) {
  const query = `
                SELECT
                    sp.sesion_id,
                    sp.espacio_id,
                    sp.disciplina_id,
                    sp.instructor_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    sp.dia_semana,
                    COALESCE(u.nombres || ' ' || COALESCE(u.apellido_paterno, ''), 'Sin instructor') as instructor,
                    COALESCE((
                        SELECT COUNT(*) FROM (
                            SELECT 'socio-' || ic.socio_id AS inscrito_key
                            FROM inscripciones_clases ic
                            WHERE ic.sesion_id = sp.sesion_id
                              AND ic.estado = 'Confirmada'
                            UNION
                            SELECT 'socio-' || r.socio_id AS inscrito_key
                            FROM reservaciones r
                            WHERE r.sesion_id = sp.sesion_id
                              AND r.fecha_reserva = $2::date
                              AND LOWER(r.estado::text) NOT IN ('cancelada', 'cancelado')
                              AND r.socio_id IS NOT NULL
                        ) inscritos
                    ), 0) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                WHERE sp.dia_semana = $1
                GROUP BY sp.sesion_id, sp.espacio_id, sp.disciplina_id, sp.instructor_id,
                         d.nombre, e.nombre, sp.hora_inicio, sp.hora_fin, sp.cupo_maximo,
                         sp.dia_semana, u.nombres, u.apellido_paterno
                ORDER BY sp.hora_inicio
            `;

  const result = await pool.query(query, [diaSemana, fechaConsulta]);
  return result.rows;
}

async function inscritosPorSesion(sesionId, fecha) {
  const result = await pool.query(
    `
                WITH inscritos AS (
                    SELECT
                        ic.inscripcion_id::text AS inscripcion_id,
                        ic.socio_id,
                        'Socio' AS tipo,
                        ic.fecha_inscripcion
                    FROM inscripciones_clases ic
                    WHERE ic.sesion_id = $1
                      AND ic.estado = 'Confirmada'

                    UNION ALL

                    SELECT
                        ('reserva-' || MIN(r.reserva_id))::text AS inscripcion_id,
                        r.socio_id,
                        'Socio' AS tipo,
                        MIN(r.fecha_creacion) AS fecha_inscripcion
                    FROM reservaciones r
                    WHERE r.sesion_id = $1
                      AND ($2::date IS NULL OR r.fecha_reserva = $2::date)
                      AND LOWER(r.estado::text) NOT IN ('cancelada', 'cancelado')
                      AND r.socio_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1
                          FROM inscripciones_clases ic
                          WHERE ic.sesion_id = r.sesion_id
                            AND ic.socio_id = r.socio_id
                            AND ic.estado = 'Confirmada'
                      )
                    GROUP BY r.socio_id
                )
                SELECT
                    inscritos.inscripcion_id,
                    inscritos.socio_id,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellido_paterno, ''))), ''),
                        'Sin nombre'
                    ) AS nombre_socio,
                    COALESCE(s.numero_socio, '') AS numero_socio,
                    inscritos.tipo,
                    inscritos.fecha_inscripcion
                FROM inscritos
                LEFT JOIN socios s ON s.socio_id = inscritos.socio_id
                LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
                ORDER BY nombre_socio
            `,
    [sesionId, fecha]
  );
  return result.rows;
}

// ── Asistencia ───────────────────────────────────────────────────────────────

/** Registra (o actualiza) la asistencia y deja un log; el fallo del log solo se advierte. */
async function registrarAsistencia({ sesionId, socioId, fecha, presente }, usuarioId, ip) {
  const existeQuery = await pool.query(
    `SELECT asistencia_id FROM asistencia
                 WHERE sesion_id = $1 AND socio_id = $2 AND fecha = $3`,
    [sesionId, socioId, fecha]
  );

  if (existeQuery.rows.length > 0) {
    await pool.query(
      `UPDATE asistencia SET presente = $1, registro = NOW()
                     WHERE asistencia_id = $2`,
      [presente, existeQuery.rows[0].asistencia_id]
    );
  } else {
    await pool.query(
      `INSERT INTO asistencia (sesion_id, socio_id, fecha, presente, registro)
                     VALUES ($1, $2, $3, $4, NOW())`,
      [sesionId, socioId, fecha, presente]
    );
  }

  try {
    await pool.query(
      `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                     VALUES ($1, $2, $3, $4, $5)`,
      [
        usuarioId,
        'REGISTRAR_ASISTENCIA',
        'asistencia',
        `Sesión: ${sesionId}, Socio: ${socioId}, Presente: ${presente}`,
        ip || ''
      ]
    );
  } catch (logError) {
    console.warn('No se pudo guardar log:', logError.message);
  }
}

// ── Métricas ─────────────────────────────────────────────────────────────────

async function metricas(usuarioId) {
  const instructorId = await instructorIdDeUsuario(usuarioId);

  const asistenciaQuery = await pool.query(
    `
                SELECT ROUND(AVG(CASE WHEN a.presente = true THEN 100 ELSE 0 END), 1) as promedio
                FROM asistencia a
                JOIN sesiones_programadas sp ON a.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
            `,
    [instructorId]
  );

  const convocatoriaQuery = await pool.query(
    `
                SELECT
                    TO_CHAR(DATE_TRUNC('month', r.fecha_reserva), 'Mon') as mes,
                    COUNT(DISTINCT r.reserva_id) as total
                FROM reservaciones r
                JOIN sesiones_programadas sp ON r.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
                    AND r.fecha_reserva >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY DATE_TRUNC('month', r.fecha_reserva)
                ORDER BY DATE_TRUNC('month', r.fecha_reserva)
            `,
    [instructorId]
  );

  const asistenciaMensualQuery = await pool.query(
    `
                SELECT
                    TO_CHAR(DATE_TRUNC('month', a.fecha), 'Mon') as mes,
                    ROUND(AVG(CASE WHEN a.presente = true THEN 100 ELSE 0 END), 1) as porcentaje
                FROM asistencia a
                JOIN sesiones_programadas sp ON a.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
                    AND a.fecha >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY DATE_TRUNC('month', a.fecha)
                ORDER BY DATE_TRUNC('month', a.fecha)
            `,
    [instructorId]
  );

  const diaSemana = diaSemanaDeFecha(getMexicoDateISO());
  const sesionesHoyQuery = await pool.query(
    `
                SELECT COUNT(*) as total
                FROM sesiones_programadas sp
                WHERE sp.instructor_id = $1 AND sp.dia_semana = $2
            `,
    [instructorId, diaSemana]
  );

  const totalAlumnosQuery = await pool.query(
    `
                SELECT COUNT(DISTINCT r.socio_id) as total
                FROM reservaciones r
                JOIN sesiones_programadas sp ON r.sesion_id = sp.sesion_id
                WHERE sp.instructor_id = $1
            `,
    [instructorId]
  );

  return {
    asistenciaPromedio: parseFloat(asistenciaQuery.rows[0]?.promedio || 0),
    convocatoriaMensual: parseInt(convocatoriaQuery.rows[convocatoriaQuery.rows.length - 1]?.total || 0),
    sesionesHoy: parseInt(sesionesHoyQuery.rows[0]?.total || 0),
    totalAlumnos: parseInt(totalAlumnosQuery.rows[0]?.total || 0),
    asistenciaMensual: asistenciaMensualQuery.rows,
    convocatoriaMensualData: convocatoriaQuery.rows
  };
}

// ── Inscripción rápida a clase ───────────────────────────────────────────────

/** Valida los campos requeridos (antes del try en el controlador original). */
function validarInscripcionClase(body) {
  const { sesion_id, socio_id, visita_id, fecha } = requireBodyOrEscalate(body);
  if (!sesion_id || (!socio_id && !visita_id) || !fecha) {
    throw new ServiceError(400, { error: 'sesion_id, (socio_id o visita_id) y fecha son requeridos' });
  }
  return { sesion_id, socio_id, visita_id, fecha };
}

/** Crea la reservación si no está inscrito, sin sanción activa y con cupo. Devuelve reserva_id. */
async function inscribirEnClase({ sesion_id, socio_id, visita_id, fecha }) {
  const existe = await pool.query(
    `SELECT reserva_id FROM reservaciones
                 WHERE sesion_id = $1 AND socio_id = $2 AND fecha_reserva = $3
                 AND LOWER(estado::text) != 'cancelada'`,
    [sesion_id, socio_id, fecha]
  );
  if (existe.rowCount > 0) {
    throw new ServiceError(409, { error: 'El socio ya está inscrito en esta clase' });
  }
  // Verificar que el socio no tenga sanciones activas
  const sancion = await pool.query(
    `SELECT sancion_id FROM sanciones
                 WHERE socio_id = $1
                 AND LOWER(estado::text) IN ('activa', 'activo')
                 AND COALESCE(fecha_fin, CURRENT_DATE) >= CURRENT_DATE
                 LIMIT 1`,
    [socio_id]
  );
  if (sancion.rowCount > 0) {
    throw new ServiceError(403, { error: 'El socio tiene una sanción activa y no puede inscribirse' });
  }
  const sesion = await pool.query(
    `SELECT sp.cupo_maximo, sp.hora_inicio, sp.hora_fin,
                        COUNT(r.reserva_id) as inscritos
                 FROM sesiones_programadas sp
                 LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id
                     AND r.fecha_reserva = $2
                     AND LOWER(r.estado::text) != 'cancelada'
                 WHERE sp.sesion_id = $1
                 GROUP BY sp.sesion_id, sp.cupo_maximo, sp.hora_inicio, sp.hora_fin`,
    [sesion_id, fecha]
  );
  if (sesion.rowCount === 0) {
    throw new ServiceError(404, { error: 'Sesión no encontrada' });
  }
  const { cupo_maximo, hora_inicio, hora_fin, inscritos } = sesion.rows[0];
  if (parseInt(inscritos) >= parseInt(cupo_maximo)) {
    throw new ServiceError(400, { error: 'No hay cupo disponible en esta clase' });
  }

  const result = await pool.query(
    `INSERT INTO reservaciones (sesion_id, socio_id, visita_id, fecha_reserva, hora_inicio, hora_fin, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, 'Confirmada')
                 RETURNING reserva_id`,
    [sesion_id, socio_id || null, visita_id || null, fecha, hora_inicio, hora_fin]
  );

  return result.rows[0].reserva_id;
}

// ── Torneos (vista del instructor) ───────────────────────────────────────────

async function listarTorneos() {
  const result = await pool.query(`
                SELECT t.torneo_id, t.nombre, t.fecha_inicio, t.fecha_fin,
                       d.nombre as disciplina,
                       COUNT(p.participante_id) as total_participantes
                FROM torneos t
                JOIN disciplinas d ON t.disciplina_id = d.disciplina_id
                LEFT JOIN participantes_torneo p ON p.torneo_id = t.torneo_id
                GROUP BY t.torneo_id, t.nombre, t.fecha_inicio, t.fecha_fin, d.nombre
                ORDER BY t.fecha_inicio DESC
            `);
  return result.rows;
}

async function encuentrosDeTorneo(torneoId) {
  const result = await pool.query(
    `
                SELECT * FROM encuentros_torneo
                WHERE torneo_id = $1
                ORDER BY ronda, encuentro_id
            `,
    [torneoId]
  );
  return result.rows;
}

/** Guarda el nombre del ganador en la columna de texto `ganador` (flujo heredado). */
async function registrarGanador(encuentroId, ganador) {
  await pool.query(`UPDATE encuentros_torneo SET ganador = $1 WHERE encuentro_id = $2`, [ganador, encuentroId]);
}

module.exports = {
  clasesPorFecha,
  alumnosPorClase,
  misClases,
  resolverDiaConsulta,
  clasesGeneral,
  inscritosPorSesion,
  registrarAsistencia,
  metricas,
  validarInscripcionClase,
  inscribirEnClase,
  listarTorneos,
  encuentrosDeTorneo,
  registrarGanador
};
