/**
 * Pase de lista de recepción: clases del día y alumnos con reserva.
 */
const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { escalate } = require('./escalate');
const { getMexicoTodayLocale } = require('../utils/mexicoDate');

const ESTADOS_RESERVA_CLASE = "('Confirmada', 'No-Show', 'pendiente', 'confirmada')";

/** Clases programadas para el día de la semana de `fecha` (hoy si no se indica). */
async function clasesPorFecha(fecha) {
  const fechaConsulta = fecha || getMexicoTodayLocale();
  let year, month, day;
  try {
    // Fuera del try en el original (p. ej. ?fecha repetido → arreglo): se escala.
    [year, month, day] = fechaConsulta.split('-').map(Number);
  } catch (error) {
    throw escalate(error);
  }

  if (!year || !month || !day) {
    throw new ServiceError(400, { error: 'Fecha invalida' });
  }

  // sesiones_programadas.dia_semana: Lun=1 … Sáb=6, Dom=7
  const jsDay = new Date(year, month - 1, day).getDay();
  const diaSemana = jsDay === 0 ? 7 : jsDay;

  const result = await pool.query(
    `
                SELECT
                    sp.sesion_id,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    COALESCE(
                        NULLIF(TRIM(CONCAT(u.nombres, ' ', COALESCE(u.apellido_paterno, ''))), ''),
                        NULLIF(TRIM(i.especialidad), ''),
                        'Por asignar'
                    ) as instructor,
                    COUNT(r.reserva_id) as cupo_actual
                FROM sesiones_programadas sp
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                LEFT JOIN reservaciones r ON r.sesion_id = sp.sesion_id
                    AND r.fecha_reserva = $1
                    AND r.estado::text IN ${ESTADOS_RESERVA_CLASE}
                WHERE sp.dia_semana = $2
                    AND e.activo = true
                    AND COALESCE((to_jsonb(sp)->>'activo')::boolean, true) = true
                GROUP BY
                    sp.sesion_id,
                    d.nombre,
                    e.nombre,
                    sp.hora_inicio,
                    sp.hora_fin,
                    sp.cupo_maximo,
                    i.especialidad,
                    u.nombres,
                    u.apellido_paterno
                ORDER BY sp.hora_inicio
            `,
    [fechaConsulta, diaSemana]
  );
  return result.rows;
}

async function alumnosPorClase(sesionId, fecha) {
  if (!sesionId || !fecha) {
    throw new ServiceError(400, { error: 'Sesion y fecha son requeridas' });
  }

  const result = await pool.query(
    `
                SELECT
                    r.reserva_id,
                    r.estado::text as reserva_estado,
                    r.no_show,
                    r.hora_fin,
                    s.socio_id,
                    u.nombres || ' ' || COALESCE(u.apellido_paterno, '') as nombre_socio,
                    u.username as contacto,
                    a.presente as asistio
                FROM reservaciones r
                JOIN socios s ON r.socio_id = s.socio_id
                JOIN usuarios u ON s.usuario_id = u.usuario_id
                LEFT JOIN asistencia a ON a.sesion_id = r.sesion_id
                    AND a.socio_id = s.socio_id
                    AND a.fecha = r.fecha_reserva
                WHERE r.sesion_id = $1
                    AND r.fecha_reserva = $2
                    AND r.estado::text IN ${ESTADOS_RESERVA_CLASE}
                ORDER BY u.apellido_paterno, u.nombres
            `,
    [sesionId, fecha]
  );
  return result.rows;
}

module.exports = { clasesPorFecha, alumnosPorClase };
