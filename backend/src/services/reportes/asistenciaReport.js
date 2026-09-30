// Reporte JSON de asistencia por instructor y disciplina.
const pool = require('../../config/database');

async function reporteAsistenciaInstructores({ fechaInicio, fechaFin, instructorId }) {
  let query = `
    SELECT
      i.instructor_id,
      COALESCE(TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)), i.especialidad, 'Instructor') as instructor_nombre,
      d.nombre as disciplina,
      COUNT(DISTINCT sp.sesion_id) as total_clases,
      COUNT(a.asistencia_id) as total_asistentes,
      ROUND(COUNT(a.asistencia_id)::decimal / NULLIF(COUNT(DISTINCT sp.sesion_id) * sp.cupo_maximo, 0) * 100, 1) as asistencia_promedio
    FROM instructores i
    JOIN usuarios u ON u.usuario_id = i.usuario_id
    JOIN sesiones_programadas sp ON i.instructor_id = sp.instructor_id
    JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
    LEFT JOIN asistencia a ON sp.sesion_id = a.sesion_id
      AND a.fecha BETWEEN $1 AND $2
    WHERE COALESCE((to_jsonb(sp)->>'activo')::boolean, true) = true
  `;
  const params = [fechaInicio, fechaFin];
  let paramCount = 3;

  if (instructorId) {
    query += ` AND i.instructor_id = $${paramCount}`;
    params.push(instructorId);
  }

  query += `
    GROUP BY i.instructor_id, instructor_nombre, d.nombre, sp.cupo_maximo
    ORDER BY asistencia_promedio DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = { reporteAsistenciaInstructores };
