// Reporte de ocupación: reservaciones por espacio, disciplinas, instructores y horas sin actividad.
const pool = require('../../config/database');
const { DAYS_ES, formatNumber, getDatesBetween } = require('./reporteComun');
const { createWorkbook, styleWorksheet, setPercentageFormat } = require('./excelExporter');
const { createPdf, finalizePdf, writePdfTitle, writePdfSection, writePdfTable } = require('./pdfExporter');

async function getOccupationSummaryRows(desde, hasta) {
  const result = await pool.query(
    `
    SELECT
      e.nombre AS espacio,
      COUNT(r.reserva_id)::int AS total_reservas,
      COUNT(*) FILTER (WHERE LOWER(r.estado::text) = 'confirmada')::int AS confirmadas,
      COUNT(*) FILTER (WHERE LOWER(r.estado::text) = 'cancelada')::int AS canceladas,
      COUNT(*) FILTER (
        WHERE LOWER(r.estado::text) = 'no-show'
           OR COALESCE(r.no_show, false) = true
      )::int AS no_show
    FROM espacios e
    LEFT JOIN reservaciones r
      ON r.espacio_id = e.espacio_id
      AND r.fecha_reserva >= $1::date
      AND r.fecha_reserva < ($2::date + INTERVAL '1 day')
    GROUP BY e.espacio_id, e.nombre
    ORDER BY total_reservas DESC, e.nombre ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function getParticipationByDisciplineRows(desde, hasta) {
  const result = await pool.query(
    `
    WITH fechas AS (
      SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS fecha
    ),
    sesiones_en_rango AS (
      SELECT
        sp.sesion_id,
        sp.disciplina_id,
        f.fecha
      FROM sesiones_programadas sp
      JOIN fechas f ON EXTRACT(ISODOW FROM f.fecha)::int = sp.dia_semana
      WHERE COALESCE((to_jsonb(sp)->>'activo')::boolean, true) = true
    )
    SELECT
      d.nombre AS disciplina,
      COUNT(ser.sesion_id)::int AS total_sesiones,
      COUNT(a.asistencia_id)::int AS total_asistentes
    FROM disciplinas d
    LEFT JOIN sesiones_en_rango ser ON ser.disciplina_id = d.disciplina_id
    LEFT JOIN asistencia a
      ON a.sesion_id = ser.sesion_id
      AND a.fecha = ser.fecha
      AND COALESCE(a.presente, true) = true
    GROUP BY d.disciplina_id, d.nombre
    ORDER BY total_asistentes DESC, total_sesiones DESC, d.nombre ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function getInstructorRankingRows(desde, hasta) {
  const result = await pool.query(
    `
    WITH fechas AS (
      SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS fecha
    ),
    sesiones_en_rango AS (
      SELECT
        sp.sesion_id,
        sp.disciplina_id,
        sp.instructor_id,
        f.fecha
      FROM sesiones_programadas sp
      JOIN fechas f ON EXTRACT(ISODOW FROM f.fecha)::int = sp.dia_semana
      WHERE COALESCE((to_jsonb(sp)->>'activo')::boolean, true) = true
    )
    SELECT
      TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)) AS instructor,
      d.nombre AS disciplina,
      COUNT(ser.sesion_id)::int AS total_sesiones,
      COUNT(a.asistencia_id)::int AS total_asistentes
    FROM sesiones_en_rango ser
    JOIN instructores i ON i.instructor_id = ser.instructor_id
    JOIN usuarios u ON u.usuario_id = i.usuario_id
    JOIN disciplinas d ON d.disciplina_id = ser.disciplina_id
    LEFT JOIN asistencia a
      ON a.sesion_id = ser.sesion_id
      AND a.fecha = ser.fecha
      AND COALESCE(a.presente, true) = true
    GROUP BY instructor, d.nombre
    ORDER BY
      CASE WHEN COUNT(ser.sesion_id) = 0 THEN 0
           ELSE COUNT(a.asistencia_id)::decimal / COUNT(ser.sesion_id)
      END DESC,
      total_asistentes DESC,
      instructor ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

function overlaps(slotStart, slotEnd, rangeStart, rangeEnd) {
  return String(rangeStart).slice(0, 5) < slotEnd && String(rangeEnd).slice(0, 5) > slotStart;
}

/**
 * Normaliza una fecha a 'YYYY-MM-DD'. El driver de pg devuelve las columnas
 * `date` como objetos Date (medianoche UTC), mientras que el resto del
 * reporte trabaja con fechas en texto ISO — comparar ambos formatos
 * directamente (bug #34) hacía que la clave de reservaciones nunca
 * coincidiera con la de las fechas del rango, y todo aparecía "sin
 * actividad" aunque sí hubiera reservaciones.
 */
function toISODate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function getLowActivityRows(desde, hasta) {
  const [spacesResult, reservationsResult, sessionsResult] = await Promise.all([
    pool.query(`SELECT espacio_id, nombre FROM espacios WHERE COALESCE(activo, true) = true ORDER BY nombre ASC`),
    pool.query(
      `
      SELECT espacio_id, fecha_reserva, hora_inicio, hora_fin, estado
      FROM reservaciones
      WHERE fecha_reserva >= $1::date
        AND fecha_reserva < ($2::date + INTERVAL '1 day')
        AND LOWER(estado::text) <> 'cancelada'
    `,
      [desde, hasta]
    ),
    pool.query(`
      SELECT espacio_id, dia_semana, hora_inicio, hora_fin
      FROM sesiones_programadas
      WHERE COALESCE((to_jsonb(sesiones_programadas)->>'activo')::boolean, true) = true
    `)
  ]);

  const reservationKeys = new Set();
  reservationsResult.rows.forEach((row) => {
    for (let hour = 6; hour < 22; hour++) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      if (overlaps(start, end, row.hora_inicio, row.hora_fin)) {
        reservationKeys.add(`${row.espacio_id}|${toISODate(row.fecha_reserva)}|${start}`);
      }
    }
  });

  const sessionKeys = new Set();
  sessionsResult.rows.forEach((row) => {
    for (let hour = 6; hour < 22; hour++) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      if (overlaps(start, end, row.hora_inicio, row.hora_fin)) {
        sessionKeys.add(`${row.espacio_id}|${row.dia_semana}|${start}`);
      }
    }
  });

  const totalDatesByDay = new Map();
  const emptyCounts = new Map();
  const dates = getDatesBetween(desde, hasta);

  dates.forEach((dateValue) => {
    const jsDate = new Date(`${dateValue}T00:00:00Z`);
    const isoDay = ((jsDate.getUTCDay() + 6) % 7) + 1;
    totalDatesByDay.set(isoDay, (totalDatesByDay.get(isoDay) || 0) + 1);

    spacesResult.rows.forEach((space) => {
      for (let hour = 6; hour < 22; hour++) {
        const start = `${String(hour).padStart(2, '0')}:00`;
        const end = `${String(hour + 1).padStart(2, '0')}:00`;
        const hasReservation = reservationKeys.has(`${space.espacio_id}|${dateValue}|${start}`);
        const hasSession = sessionKeys.has(`${space.espacio_id}|${isoDay}|${start}`);

        if (!hasReservation && !hasSession) {
          const key = `${space.espacio_id}|${isoDay}|${start}|${end}`;
          emptyCounts.set(key, (emptyCounts.get(key) || 0) + 1);
        }
      }
    });
  });

  const rows = [];
  emptyCounts.forEach((count, key) => {
    const [spaceId, isoDay, hourStart, hourEnd] = key.split('|');
    if (count !== totalDatesByDay.get(Number(isoDay))) return;

    const space = spacesResult.rows.find((item) => String(item.espacio_id) === spaceId);
    rows.push({
      espacio: space?.nombre || `Espacio ${spaceId}`,
      dia_semana: DAYS_ES[Number(isoDay) - 1],
      hora_inicio: hourStart,
      hora_fin: hourEnd,
      estado: 'Sin actividad'
    });
  });

  rows.sort(
    (a, b) =>
      a.espacio.localeCompare(b.espacio) ||
      DAYS_ES.indexOf(a.dia_semana) - DAYS_ES.indexOf(b.dia_semana) ||
      a.hora_inicio.localeCompare(b.hora_inicio)
  );

  return rows;
}

async function collectOccupationData(desde, hasta) {
  const [summaryRows, disciplineRows, instructorRows, lowActivityRows] = await Promise.all([
    getOccupationSummaryRows(desde, hasta),
    getParticipationByDisciplineRows(desde, hasta),
    getInstructorRankingRows(desde, hasta),
    getLowActivityRows(desde, hasta)
  ]);

  return {
    summaryRows: summaryRows.map((row) => ({
      espacio: row.espacio,
      total_reservas: Number(row.total_reservas || 0),
      confirmadas: Number(row.confirmadas || 0),
      canceladas: Number(row.canceladas || 0),
      no_show: Number(row.no_show || 0)
    })),
    disciplineRows: disciplineRows.map((row) => {
      const totalSesiones = Number(row.total_sesiones || 0);
      const totalAsistentes = Number(row.total_asistentes || 0);
      return {
        disciplina: row.disciplina,
        total_sesiones: totalSesiones,
        total_asistentes: totalAsistentes,
        promedio: totalSesiones === 0 ? 0 : Number((totalAsistentes / totalSesiones).toFixed(2))
      };
    }),
    instructorRows: instructorRows.map((row) => {
      const totalSesiones = Number(row.total_sesiones || 0);
      const totalAsistentes = Number(row.total_asistentes || 0);
      return {
        instructor: row.instructor,
        disciplina: row.disciplina,
        total_sesiones: totalSesiones,
        total_asistentes: totalAsistentes,
        promedio: totalSesiones === 0 ? 0 : Number((totalAsistentes / totalSesiones).toFixed(2))
      };
    }),
    lowActivityRows
  };
}

async function buildOccupationWorkbook(desde, hasta) {
  const workbook = createWorkbook();
  const data = await collectOccupationData(desde, hasta);

  const summarySheet = workbook.addWorksheet('Reservaciones por Espacio');
  summarySheet.columns = [
    { header: 'Espacio', key: 'espacio', width: 24 },
    { header: 'Total de Reservas', key: 'total_reservas', width: 18 },
    { header: 'Confirmadas', key: 'confirmadas', width: 14 },
    { header: 'Canceladas', key: 'canceladas', width: 14 },
    { header: 'No Show', key: 'no_show', width: 12 },
    { header: '% Ocupación', key: 'ocupacion', width: 14 }
  ];

  data.summaryRows.forEach((row, index) => {
    const excelRow = index + 2;
    summarySheet.addRow({
      espacio: row.espacio,
      total_reservas: Number(row.total_reservas || 0),
      confirmadas: Number(row.confirmadas || 0),
      canceladas: Number(row.canceladas || 0),
      no_show: Number(row.no_show || 0),
      ocupacion: { formula: `IFERROR(C${excelRow}/B${excelRow},0)` }
    });
  });
  styleWorksheet(summarySheet);
  setPercentageFormat(summarySheet.getColumn(6));

  const disciplineSheet = workbook.addWorksheet('Participación por Disciplina');
  disciplineSheet.columns = [
    { header: 'Disciplina', key: 'disciplina', width: 24 },
    { header: 'Total de Sesiones', key: 'total_sesiones', width: 18 },
    { header: 'Total de Asistentes', key: 'total_asistentes', width: 18 },
    { header: 'Promedio por Sesión', key: 'promedio', width: 18 }
  ];
  data.disciplineRows.forEach((row) => disciplineSheet.addRow(row));
  styleWorksheet(disciplineSheet);

  const instructorSheet = workbook.addWorksheet('Ranking de Instructores por Asistencia');
  instructorSheet.columns = [
    { header: 'Instructor', key: 'instructor', width: 30 },
    { header: 'Disciplina', key: 'disciplina', width: 22 },
    { header: 'Total de Sesiones', key: 'total_sesiones', width: 18 },
    { header: 'Total de Asistentes', key: 'total_asistentes', width: 18 },
    { header: 'Promedio', key: 'promedio', width: 12 }
  ];
  data.instructorRows.forEach((row) => instructorSheet.addRow(row));
  styleWorksheet(instructorSheet);

  const lowActivitySheet = workbook.addWorksheet('Horas con baja actividad por Espacio');
  lowActivitySheet.columns = [
    { header: 'Espacio', key: 'espacio', width: 24 },
    { header: 'Día de la Semana', key: 'dia_semana', width: 18 },
    { header: 'Hora de Inicio', key: 'hora_inicio', width: 14 },
    { header: 'Hora de Fin', key: 'hora_fin', width: 12 },
    { header: 'Estado', key: 'estado', width: 16 }
  ];
  data.lowActivityRows.forEach((row) => lowActivitySheet.addRow(row));
  styleWorksheet(lowActivitySheet);

  return workbook;
}

async function buildOccupationPdf(res, desde, hasta) {
  const data = await collectOccupationData(desde, hasta);
  const doc = createPdf(res, 'reporte-ocupacion-espacios.pdf', 'Reporte de Ocupacion de Espacios y Disciplinas');

  writePdfTitle(doc, 'Reporte de Ocupacion de Espacios y Disciplinas', [
    `Rango: ${desde} a ${hasta}`,
    'Horario operativo usado para baja actividad: 06:00 a 22:00'
  ]);

  writePdfSection(doc, '1. Reservaciones por Espacio');
  writePdfTable(
    doc,
    ['Espacio', 'Total', 'Confirmadas', 'Canceladas', 'No Show', '% Ocup.'],
    data.summaryRows.map((row) => {
      const ocupacion = row.total_reservas === 0 ? 0 : (row.confirmadas / row.total_reservas) * 100;
      return [
        row.espacio,
        row.total_reservas,
        row.confirmadas,
        row.canceladas,
        row.no_show,
        `${formatNumber(ocupacion)}%`
      ];
    }),
    [3, 1, 1.2, 1.2, 1, 1.2]
  );

  writePdfSection(doc, '2. Participacion por Disciplina');
  writePdfTable(
    doc,
    ['Disciplina', 'Sesiones', 'Asistentes', 'Promedio'],
    data.disciplineRows.map((row) => [
      row.disciplina,
      row.total_sesiones,
      row.total_asistentes,
      formatNumber(row.promedio)
    ]),
    [3, 1.2, 1.2, 1]
  );

  writePdfSection(doc, '3. Ranking de Instructores');
  writePdfTable(
    doc,
    ['#', 'Instructor', 'Disciplina', 'Sesiones', 'Asistentes'],
    data.instructorRows.map((row, index) => [
      index + 1,
      row.instructor,
      row.disciplina,
      row.total_sesiones,
      row.total_asistentes
    ]),
    [0.5, 3, 2, 1, 1]
  );

  writePdfSection(doc, '4. Horas con baja actividad');
  writePdfTable(
    doc,
    ['Espacio', 'Dia', 'Hora Inicio', 'Hora Fin'],
    data.lowActivityRows.map((row) => [row.espacio, row.dia_semana, row.hora_inicio, row.hora_fin]),
    [3, 1.5, 1.2, 1.2]
  );

  finalizePdf(doc);
}

module.exports = { buildOccupationWorkbook, buildOccupationPdf };
