const pool = require('../config/database');
const ServiceError = require('./serviceError');
const { getTableColumns } = require('../utils/adminRules');
const { getMexicoDateISO } = require('../utils/mexicoDate');

async function obtenerSesionDisponible(sesionId) {
  // Verificar sesión y que el ESPACIO esté activo (JOIN con espacios)
  const espacioCols = await getTableColumns('espacios');
  const estadoCond = espacioCols.has('estado') ? "AND LOWER(COALESCE(e.estado, 'activo')) <> 'mantenimiento'" : '';
  const mantenimientoCols = await getTableColumns('mantenimiento_espacios');
  const mantenimientoCond =
    mantenimientoCols.size > 0
      ? `AND NOT EXISTS (
            SELECT 1
            FROM mantenimiento_espacios me
            WHERE me.espacio_id = e.espacio_id
              ${mantenimientoCols.has('activo') ? 'AND COALESCE(me.activo, true) = true' : ''}
          )`
      : '';
  const sesion = await pool.query(
    `SELECT sp.sesion_id, sp.cupo_maximo, sp.dia_semana, sp.hora_inicio, sp.hora_fin
     FROM sesiones_programadas sp
     JOIN espacios e ON sp.espacio_id = e.espacio_id
     WHERE sp.sesion_id = $1
       AND e.activo = true
       ${estadoCond}
       ${mantenimientoCond}`,
    [sesionId]
  );

  if (sesion.rows.length === 0) {
    throw new ServiceError(404, { error: 'La clase no existe o el espacio no está disponible' });
  }
  return sesion.rows[0];
}

async function verificarChoqueConClases(socioId, { dia_semana, hora_inicio, hora_fin }) {
  const choque = await pool.query(
    `SELECT d.nombre as disciplina
     FROM inscripciones_clases ic
     JOIN sesiones_programadas sp ON ic.sesion_id = sp.sesion_id
     JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
     WHERE ic.socio_id = $1
       AND sp.dia_semana = $2
       AND ic.estado = 'Confirmada'
       AND (sp.hora_inicio, sp.hora_fin) OVERLAPS ($3::time, $4::time)`,
    [socioId, dia_semana, hora_inicio, hora_fin]
  );

  if (choque.rows.length > 0) {
    throw new ServiceError(400, {
      error: `Choque de horario: Ya estás inscrito en ${choque.rows[0].disciplina} a esta hora.`
    });
  }
}

async function verificarChoqueConReservas(socioId, { dia_semana, hora_inicio, hora_fin }) {
  // Solo aplica si la sesión ocurre el día de hoy.
  // sesiones_programadas.dia_semana: Lun=1, Mar=2 … Sáb=6, Dom=7
  // JS getDay(): Dom=0, Lun=1, Mar=2 … Sáb=6
  // Conversión: getDay()===0 → 7 (Dom), else getDay() (Lun=1…Sáb=6)
  let hayConflicto = false;
  try {
    const hoy = getMexicoDateISO();
    const [y, mo, d] = hoy.split('-').map(Number);
    const jsDay = new Date(y, mo - 1, d).getDay(); // 0=Dom, 1=Lun … 6=Sáb
    const diaSemanaHoy = jsDay === 0 ? 7 : jsDay; // Lun=1 … Sáb=6, Dom=7
    if (Number(dia_semana) === diaSemanaHoy) {
      const reservaConflicto = await pool.query(
        `SELECT 1
         FROM reservaciones
         WHERE socio_id = $1
           AND fecha_reserva = $2::date
           AND LOWER(estado::text) NOT IN ('cancelada', 'cancelado')
           AND hora_inicio < $4::time
           AND hora_fin    > $3::time
         LIMIT 1`,
        [socioId, hoy, hora_inicio, hora_fin]
      );
      hayConflicto = reservaConflicto.rows.length > 0;
    }
  } catch (e) {
    console.warn('No se pudo verificar solapamiento con reservas:', e.message);
  }

  // Se lanza fuera del try: ese catch solo debe ignorar fallos de la consulta.
  if (hayConflicto) {
    throw new ServiceError(400, { error: 'Tienes una reserva de cancha activa en ese horario.' });
  }
}

/**
 * Inscribe al socio en la sesión, o reactiva su inscripción cancelada.
 * Devuelve { reactivada, inscripcion_id }.
 */
async function inscribir(sesionId, socioId) {
  const sesion = await obtenerSesionDisponible(sesionId);
  await verificarChoqueConClases(socioId, sesion);
  await verificarChoqueConReservas(socioId, sesion);

  // Verificar si ya existe un registro para este socio y sesión
  const existente = await pool.query(
    `SELECT inscripcion_id, estado, fecha_inscripcion
     FROM inscripciones_clases
     WHERE sesion_id = $1 AND socio_id = $2`,
    [sesionId, socioId]
  );

  if (existente.rows.length > 0) {
    const registro = existente.rows[0];

    if (registro.estado === 'Confirmada') {
      throw new ServiceError(400, { error: 'Ya estás inscrito en esta clase' });
    } else if (registro.estado === 'Cancelada') {
      // Reactivar sin revisar cupo (comportamiento heredado)
      const reactivate = await pool.query(
        `UPDATE inscripciones_clases
         SET estado = 'Confirmada',
             fecha_inscripcion = NOW()
         WHERE inscripcion_id = $1
         RETURNING inscripcion_id`,
        [registro.inscripcion_id]
      );
      return { reactivada: true, inscripcion_id: reactivate.rows[0].inscripcion_id };
    }
  }

  // Verificar cupos disponibles
  const conteo = await pool.query(
    `SELECT COUNT(*) as total FROM inscripciones_clases
     WHERE sesion_id = $1 AND estado = 'Confirmada'`,
    [sesionId]
  );

  const inscritos = parseInt(conteo.rows[0].total);
  if (inscritos >= sesion.cupo_maximo) {
    throw new ServiceError(400, { error: 'La clase está llena' });
  }

  const result = await pool.query(
    `INSERT INTO inscripciones_clases (sesion_id, socio_id, estado)
     VALUES ($1, $2, 'Confirmada')
     RETURNING inscripcion_id`,
    [sesionId, socioId]
  );
  return { reactivada: false, inscripcion_id: result.rows[0].inscripcion_id };
}

async function cancelarInscripcion(sesionId, socioId) {
  const result = await pool.query(
    `UPDATE inscripciones_clases
     SET estado = 'Cancelada'
     WHERE sesion_id = $1 AND socio_id = $2 AND estado = 'Confirmada'
     RETURNING inscripcion_id`,
    [sesionId, socioId]
  );

  if (result.rows.length === 0) {
    throw new ServiceError(404, { error: 'No se encontró la inscripción' });
  }
}

async function listarInscripcionesSocio(socioId) {
  const result = await pool.query(
    `SELECT
        ic.inscripcion_id,
        ic.sesion_id,
        sp.dia_semana,
        sp.hora_inicio,
        sp.hora_fin,
        d.nombre as disciplina,
        e.nombre as espacio,
        COALESCE(NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno)), ''), 'Por asignar') as instructor,
        u.foto_perfil as instructor_foto
     FROM inscripciones_clases ic
     JOIN sesiones_programadas sp ON ic.sesion_id = sp.sesion_id
     JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
     JOIN espacios e ON sp.espacio_id = e.espacio_id
     LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
     LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
     WHERE ic.socio_id = $1 AND ic.estado = 'Confirmada'
     ORDER BY sp.dia_semana, sp.hora_inicio`,
    [socioId]
  );
  return result.rows;
}

module.exports = {
  inscribir,
  cancelarInscripcion,
  listarInscripcionesSocio
};
