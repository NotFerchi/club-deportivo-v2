// Reporte de afluencia: entradas/salidas del control de acceso por día, día de la semana y hora.
const pool = require('../../config/database');
const { DAYS_ES, formatNumber, getDatesBetween } = require('./reporteComun');
const { createWorkbook, styleWorksheet } = require('./excelExporter');
const {
  createPdf,
  finalizePdf,
  writePdfTitle,
  writePdfSection,
  writePdfKeyValueRows,
  writePdfTable
} = require('./pdfExporter');

async function getAttendanceSummaryRows(desde, hasta) {
  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_movimientos,
      COUNT(*) FILTER (WHERE tipo = 'entrada')::int AS total_entradas,
      COUNT(*) FILTER (WHERE tipo = 'salida')::int AS total_salidas,
      COUNT(*) FILTER (WHERE tipo = 'entrada' AND socio_id IS NOT NULL)::int AS entradas_socios,
      COUNT(*) FILTER (WHERE tipo = 'entrada' AND visita_id IS NOT NULL)::int AS entradas_visitas,
      COUNT(DISTINCT socio_id) FILTER (WHERE tipo = 'entrada' AND socio_id IS NOT NULL)::int AS socios_unicos,
      COUNT(DISTINCT visita_id) FILTER (WHERE tipo = 'entrada' AND visita_id IS NOT NULL)::int AS visitas_unicas
    FROM registro_acceso
    WHERE "timestamp" >= $1::date
      AND "timestamp" < ($2::date + INTERVAL '1 day')
  `,
    [desde, hasta]
  );

  return result.rows[0];
}

async function getAttendanceDailyRows(desde, hasta) {
  const result = await pool.query(
    `
    WITH fechas AS (
      SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS fecha
    )
    SELECT
      f.fecha,
      EXTRACT(ISODOW FROM f.fecha)::int AS dia_numero,
      COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada')::int AS total_entradas,
      COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.socio_id IS NOT NULL)::int AS entradas_socios,
      COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.visita_id IS NOT NULL)::int AS entradas_visitas,
      COUNT(DISTINCT ra.socio_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.socio_id IS NOT NULL)::int AS socios_unicos,
      COUNT(DISTINCT ra.visita_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.visita_id IS NOT NULL)::int AS visitas_unicas
    FROM fechas f
    LEFT JOIN registro_acceso ra
      ON ra."timestamp" >= f.fecha
      AND ra."timestamp" < (f.fecha + INTERVAL '1 day')
    GROUP BY f.fecha
    ORDER BY f.fecha ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function getAttendanceByWeekdayRows(desde, hasta) {
  const result = await pool.query(
    `
    WITH fechas AS (
      SELECT generate_series($1::date, $2::date, INTERVAL '1 day')::date AS fecha
    ),
    entradas_por_fecha AS (
      SELECT
        f.fecha,
        EXTRACT(ISODOW FROM f.fecha)::int AS dia_numero,
        COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada')::int AS total_entradas,
        COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.socio_id IS NOT NULL)::int AS entradas_socios,
        COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.visita_id IS NOT NULL)::int AS entradas_visitas
      FROM fechas f
      LEFT JOIN registro_acceso ra
        ON ra."timestamp" >= f.fecha
        AND ra."timestamp" < (f.fecha + INTERVAL '1 day')
      GROUP BY f.fecha
    )
    SELECT
      dia_numero,
      SUM(total_entradas)::int AS total_entradas,
      SUM(entradas_socios)::int AS entradas_socios,
      SUM(entradas_visitas)::int AS entradas_visitas,
      COUNT(*)::int AS dias_considerados,
      ROUND(AVG(total_entradas)::numeric, 2) AS promedio_diario
    FROM entradas_por_fecha
    GROUP BY dia_numero
    ORDER BY total_entradas DESC, dia_numero ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function getAttendanceHourlyRows(desde, hasta) {
  const result = await pool.query(
    `
    WITH horas AS (
      SELECT generate_series(0, 23) AS hora
    )
    SELECT
      h.hora,
      COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada')::int AS total_entradas,
      COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.socio_id IS NOT NULL)::int AS entradas_socios,
      COUNT(ra.acceso_id) FILTER (WHERE ra.tipo = 'entrada' AND ra.visita_id IS NOT NULL)::int AS entradas_visitas
    FROM horas h
    LEFT JOIN registro_acceso ra
      ON EXTRACT(HOUR FROM ra."timestamp")::int = h.hora
      AND ra."timestamp" >= $1::date
      AND ra."timestamp" < ($2::date + INTERVAL '1 day')
    GROUP BY h.hora
    ORDER BY total_entradas DESC, h.hora ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function getAttendanceTopMembersRows(desde, hasta) {
  const result = await pool.query(
    `
    SELECT
      ra.socio_id,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)), ''),
        NULLIF(TRIM(CONCAT_WS(' ', to_jsonb(s)->>'nombre', to_jsonb(s)->>'apellido')), ''),
        CONCAT('Socio ', ra.socio_id)
      ) AS nombre_socio,
      COUNT(*)::int AS total_entradas
    FROM registro_acceso ra
    JOIN socios s ON s.socio_id = ra.socio_id
    LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
    WHERE ra.tipo = 'entrada'
      AND ra.socio_id IS NOT NULL
      AND ra."timestamp" >= $1::date
      AND ra."timestamp" < ($2::date + INTERVAL '1 day')
    GROUP BY ra.socio_id, nombre_socio
    ORDER BY total_entradas DESC, nombre_socio ASC
    LIMIT 20
  `,
    [desde, hasta]
  );

  return result.rows;
}

function normalizeAttendanceDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function collectAttendanceData(desde, hasta) {
  const [summary, dailyRows, weekdayRows, hourlyRows, topMembersRows] = await Promise.all([
    getAttendanceSummaryRows(desde, hasta),
    getAttendanceDailyRows(desde, hasta),
    getAttendanceByWeekdayRows(desde, hasta),
    getAttendanceHourlyRows(desde, hasta),
    getAttendanceTopMembersRows(desde, hasta)
  ]);

  const daysInRange = getDatesBetween(desde, hasta).length;
  const totalEntradas = Number(summary?.total_entradas || 0);

  return {
    summary: {
      total_movimientos: Number(summary?.total_movimientos || 0),
      total_entradas: totalEntradas,
      total_salidas: Number(summary?.total_salidas || 0),
      entradas_socios: Number(summary?.entradas_socios || 0),
      entradas_visitas: Number(summary?.entradas_visitas || 0),
      socios_unicos: Number(summary?.socios_unicos || 0),
      visitas_unicas: Number(summary?.visitas_unicas || 0),
      promedio_diario: daysInRange === 0 ? 0 : Number((totalEntradas / daysInRange).toFixed(2))
    },
    dailyRows: dailyRows.map((row) => ({
      fecha: normalizeAttendanceDate(row.fecha),
      dia_semana: DAYS_ES[Number(row.dia_numero) - 1],
      total_entradas: Number(row.total_entradas || 0),
      entradas_socios: Number(row.entradas_socios || 0),
      entradas_visitas: Number(row.entradas_visitas || 0),
      socios_unicos: Number(row.socios_unicos || 0),
      visitas_unicas: Number(row.visitas_unicas || 0)
    })),
    weekdayRows: weekdayRows.map((row) => ({
      dia_semana: DAYS_ES[Number(row.dia_numero) - 1],
      total_entradas: Number(row.total_entradas || 0),
      entradas_socios: Number(row.entradas_socios || 0),
      entradas_visitas: Number(row.entradas_visitas || 0),
      dias_considerados: Number(row.dias_considerados || 0),
      promedio_diario: Number(row.promedio_diario || 0)
    })),
    hourlyRows: hourlyRows.map((row) => ({
      hora: `${String(row.hora).padStart(2, '0')}:00`,
      total_entradas: Number(row.total_entradas || 0),
      entradas_socios: Number(row.entradas_socios || 0),
      entradas_visitas: Number(row.entradas_visitas || 0)
    })),
    topDatesRows: dailyRows
      .map((row) => ({
        fecha: normalizeAttendanceDate(row.fecha),
        dia_semana: DAYS_ES[Number(row.dia_numero) - 1],
        total_entradas: Number(row.total_entradas || 0),
        entradas_socios: Number(row.entradas_socios || 0),
        entradas_visitas: Number(row.entradas_visitas || 0)
      }))
      .sort((a, b) => b.total_entradas - a.total_entradas || a.fecha.localeCompare(b.fecha))
      .slice(0, 10),
    topMembersRows: topMembersRows.map((row) => ({
      socio_id: row.socio_id,
      nombre_socio: row.nombre_socio,
      total_entradas: Number(row.total_entradas || 0)
    }))
  };
}

async function buildAttendanceWorkbook(desde, hasta) {
  const workbook = createWorkbook();
  const data = await collectAttendanceData(desde, hasta);

  const summarySheet = workbook.addWorksheet('Resumen de Afluencia');
  summarySheet.columns = [
    { header: 'Indicador', key: 'indicador', width: 32 },
    { header: 'Valor', key: 'valor', width: 18 }
  ];
  summarySheet.addRows([
    { indicador: 'Total de entradas', valor: data.summary.total_entradas },
    { indicador: 'Entradas de socios', valor: data.summary.entradas_socios },
    { indicador: 'Entradas de visitas', valor: data.summary.entradas_visitas },
    { indicador: 'Socios unicos', valor: data.summary.socios_unicos },
    { indicador: 'Visitas unicas', valor: data.summary.visitas_unicas },
    { indicador: 'Promedio diario de entradas', valor: data.summary.promedio_diario },
    { indicador: 'Total de salidas', valor: data.summary.total_salidas },
    { indicador: 'Movimientos totales', valor: data.summary.total_movimientos }
  ]);
  styleWorksheet(summarySheet);

  const dailySheet = workbook.addWorksheet('Afluencia diaria');
  dailySheet.columns = [
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Día de la Semana', key: 'dia_semana', width: 18 },
    { header: 'Total de Entradas', key: 'total_entradas', width: 18 },
    { header: 'Entradas de Socios', key: 'entradas_socios', width: 18 },
    { header: 'Entradas de Visitas', key: 'entradas_visitas', width: 18 },
    { header: 'Socios Únicos', key: 'socios_unicos', width: 14 },
    { header: 'Visitas Únicas', key: 'visitas_unicas', width: 14 }
  ];
  data.dailyRows.forEach((row) => dailySheet.addRow(row));
  styleWorksheet(dailySheet);

  const weekdaySheet = workbook.addWorksheet('Dias mas frecuentados');
  weekdaySheet.columns = [
    { header: 'Día de la Semana', key: 'dia_semana', width: 18 },
    { header: 'Total de Entradas', key: 'total_entradas', width: 18 },
    { header: 'Entradas de Socios', key: 'entradas_socios', width: 18 },
    { header: 'Entradas de Visitas', key: 'entradas_visitas', width: 18 },
    { header: 'Días Considerados', key: 'dias_considerados', width: 18 },
    { header: 'Promedio Diario', key: 'promedio_diario', width: 16 }
  ];
  data.weekdayRows.forEach((row) => weekdaySheet.addRow(row));
  styleWorksheet(weekdaySheet);

  const hourlySheet = workbook.addWorksheet('Horarios pico');
  hourlySheet.columns = [
    { header: 'Hora', key: 'hora', width: 12 },
    { header: 'Total de Entradas', key: 'total_entradas', width: 18 },
    { header: 'Entradas de Socios', key: 'entradas_socios', width: 18 },
    { header: 'Entradas de Visitas', key: 'entradas_visitas', width: 18 }
  ];
  data.hourlyRows.forEach((row) => hourlySheet.addRow(row));
  styleWorksheet(hourlySheet);

  const topDatesSheet = workbook.addWorksheet('Top fechas');
  topDatesSheet.columns = [
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Día de la Semana', key: 'dia_semana', width: 18 },
    { header: 'Total de Entradas', key: 'total_entradas', width: 18 },
    { header: 'Entradas de Socios', key: 'entradas_socios', width: 18 },
    { header: 'Entradas de Visitas', key: 'entradas_visitas', width: 18 }
  ];
  data.topDatesRows.forEach((row) => topDatesSheet.addRow(row));
  styleWorksheet(topDatesSheet);

  const topMembersSheet = workbook.addWorksheet('Socios frecuentes');
  topMembersSheet.columns = [
    { header: 'ID de Socio', key: 'socio_id', width: 12 },
    { header: 'Nombre del Socio', key: 'nombre_socio', width: 32 },
    { header: 'Total de Entradas', key: 'total_entradas', width: 18 }
  ];
  data.topMembersRows.forEach((row) => topMembersSheet.addRow(row));
  styleWorksheet(topMembersSheet);

  return workbook;
}

async function buildAttendancePdf(res, desde, hasta) {
  const data = await collectAttendanceData(desde, hasta);
  const doc = createPdf(res, 'reporte-afluencia-dias-frecuentados.pdf', 'Reporte de Afluencia y Dias mas Frecuentados');

  writePdfTitle(doc, 'Reporte de Afluencia y Dias mas Frecuentados', [
    `Rango: ${desde} a ${hasta}`,
    'La afluencia se calcula con registros de entrada del control de acceso.'
  ]);

  writePdfSection(doc, '1. Resumen de afluencia');
  writePdfKeyValueRows(doc, [
    ['Total de entradas', data.summary.total_entradas],
    ['Entradas de socios', data.summary.entradas_socios],
    ['Entradas de visitas', data.summary.entradas_visitas],
    ['Socios unicos', data.summary.socios_unicos],
    ['Visitas unicas', data.summary.visitas_unicas],
    ['Promedio diario de entradas', data.summary.promedio_diario],
    ['Total de salidas', data.summary.total_salidas],
    ['Movimientos totales', data.summary.total_movimientos]
  ]);

  writePdfSection(doc, '2. Dias mas frecuentados');
  writePdfTable(
    doc,
    ['Dia de la Semana', 'Total Entradas', 'Socios', 'Visitas', 'Promedio/Dia'],
    data.weekdayRows.map((row) => [
      row.dia_semana,
      row.total_entradas,
      row.entradas_socios,
      row.entradas_visitas,
      formatNumber(row.promedio_diario)
    ]),
    [2, 1.5, 1.2, 1.2, 1.5]
  );

  writePdfSection(doc, '3. Top fechas');
  writePdfTable(
    doc,
    ['#', 'Fecha', 'Dia', 'Total', 'Socios', 'Visitas'],
    data.topDatesRows.map((row, index) => [
      index + 1,
      row.fecha,
      row.dia_semana,
      row.total_entradas,
      row.entradas_socios,
      row.entradas_visitas
    ]),
    [0.5, 1.5, 1.5, 1, 1, 1]
  );

  writePdfSection(doc, '4. Horarios pico');
  writePdfTable(
    doc,
    ['#', 'Hora', 'Total', 'Socios', 'Visitas'],
    data.hourlyRows
      .slice(0, 10)
      .map((row, index) => [index + 1, row.hora, row.total_entradas, row.entradas_socios, row.entradas_visitas]),
    [0.5, 1.5, 1.2, 1.2, 1.2]
  );

  writePdfSection(doc, '5. Socios frecuentes');
  writePdfTable(
    doc,
    ['#', 'Nombre del Socio', 'Entradas'],
    data.topMembersRows.map((row, index) => [index + 1, row.nombre_socio, row.total_entradas]),
    [0.5, 4, 1]
  );

  finalizePdf(doc);
}

module.exports = { buildAttendanceWorkbook, buildAttendancePdf };
