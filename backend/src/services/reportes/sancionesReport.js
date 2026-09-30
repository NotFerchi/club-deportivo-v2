// Reporte de sanciones por periodo: resumen, por mes, top de socios y detalle.
const pool = require('../../config/database');
const { formatDateValue, formatNumber } = require('./reporteComun');
const { createWorkbook, styleWorksheet, setDateFormat } = require('./excelExporter');
const {
  createPdf,
  finalizePdf,
  ensurePdfSpace,
  writePdfTitle,
  writePdfSection,
  writePdfKeyValueRows,
  writePdfTable
} = require('./pdfExporter');

async function getSanctionsSummaryRows(desde, hasta) {
  const result = await pool.query(
    `
    SELECT
      COUNT(*)::int AS total_sanciones,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(s.estado, '')) IN ('activo', 'activa'))::int AS activas,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(s.estado, '')) IN ('resuelto', 'resuelta', 'inactivo', 'inactiva'))::int AS resueltas,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(s.origen, '')) = 'ludoteca')::int AS ludoteca,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(s.origen, '')) = 'instalaciones')::int AS instalaciones,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(s.origen, '')) NOT IN ('ludoteca', 'instalaciones'))::int AS otros,
      AVG(EXTRACT(EPOCH FROM (s.fecha_resolucion - s.fecha)) / 86400.0)
        FILTER (WHERE s.fecha_resolucion IS NOT NULL) AS promedio_resolucion_dias
    FROM sanciones s
    WHERE s.fecha >= $1::date
      AND s.fecha < ($2::date + INTERVAL '1 day')
  `,
    [desde, hasta]
  );

  return result.rows[0];
}

async function getSanctionsByMonthRows(desde, hasta) {
  const result = await pool.query(
    `
    WITH generadas AS (
      SELECT
        DATE_TRUNC('month', s.fecha) AS mes,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.origen, '')) = 'ludoteca')::int AS de_ludoteca,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(s.origen, '')) = 'instalaciones')::int AS de_instalaciones
      FROM sanciones s
      WHERE s.fecha >= $1::date
        AND s.fecha < ($2::date + INTERVAL '1 day')
      GROUP BY DATE_TRUNC('month', s.fecha)
    ),
    resueltas AS (
      SELECT
        DATE_TRUNC('month', s.fecha_resolucion) AS mes,
        COUNT(*)::int AS resueltas_en_mes
      FROM sanciones s
      WHERE s.fecha_resolucion IS NOT NULL
        AND s.fecha_resolucion >= $1::date
        AND s.fecha_resolucion < ($2::date + INTERVAL '1 day')
      GROUP BY DATE_TRUNC('month', s.fecha_resolucion)
    )
    SELECT
      TO_CHAR(COALESCE(g.mes, r.mes), 'YYYY-MM') AS anio_mes,
      COALESCE(g.total, 0)::int AS total,
      COALESCE(g.de_ludoteca, 0)::int AS de_ludoteca,
      COALESCE(g.de_instalaciones, 0)::int AS de_instalaciones,
      COALESCE(r.resueltas_en_mes, 0)::int AS resueltas_en_mes
    FROM generadas g
    FULL OUTER JOIN resueltas r ON g.mes = r.mes
    ORDER BY COALESCE(g.mes, r.mes) ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function getTopSanctionedMembersRows() {
  const result = await pool.query(`
    SELECT
      soc.numero_socio,
      TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)) AS nombre_completo,
      COUNT(s.sancion_id)::int AS total_historico,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(s.estado, '')) IN ('activo', 'activa'))::int AS activas,
      MAX(s.fecha) AS ultima_sancion
    FROM sanciones s
    JOIN socios soc ON soc.socio_id = s.socio_id
    JOIN usuarios u ON u.usuario_id = soc.usuario_id
    GROUP BY soc.numero_socio, nombre_completo
    ORDER BY total_historico DESC, ultima_sancion DESC
    LIMIT 20
  `);

  return result.rows;
}

async function getSanctionsDetailRows(desde, hasta) {
  const result = await pool.query(
    `
    SELECT
      s.sancion_id,
      s.fecha,
      s.origen,
      s.motivo,
      TRIM(CONCAT_WS(' ', us.nombres, us.apellido_paterno, us.apellido_materno)) AS nombre_socio,
      s.estado,
      NULLIF(TRIM(CONCAT_WS(' ', ur.nombres, ur.apellido_paterno, ur.apellido_materno)), '') AS resuelto_por,
      s.fecha_resolucion
    FROM sanciones s
    JOIN socios soc ON soc.socio_id = s.socio_id
    JOIN usuarios us ON us.usuario_id = soc.usuario_id
    LEFT JOIN usuarios ur ON ur.usuario_id = s.resuelto_por
    WHERE s.fecha >= $1::date
      AND s.fecha < ($2::date + INTERVAL '1 day')
    ORDER BY s.fecha ASC, s.sancion_id ASC
  `,
    [desde, hasta]
  );

  return result.rows;
}

async function collectSanctionsData(desde, hasta) {
  const [summary, byMonthRows, topRows, detailRows] = await Promise.all([
    getSanctionsSummaryRows(desde, hasta),
    getSanctionsByMonthRows(desde, hasta),
    getTopSanctionedMembersRows(),
    getSanctionsDetailRows(desde, hasta)
  ]);

  return {
    summary: {
      total_sanciones: Number(summary?.total_sanciones || 0),
      activas: Number(summary?.activas || 0),
      resueltas: Number(summary?.resueltas || 0),
      ludoteca: Number(summary?.ludoteca || 0),
      instalaciones: Number(summary?.instalaciones || 0),
      otros: Number(summary?.otros || 0),
      promedio_resolucion_dias:
        summary?.promedio_resolucion_dias == null ? 0 : Number(Number(summary.promedio_resolucion_dias).toFixed(2))
    },
    byMonthRows,
    topRows,
    detailRows
  };
}

async function buildSanctionsWorkbook(desde, hasta) {
  const workbook = createWorkbook();
  const data = await collectSanctionsData(desde, hasta);

  const summarySheet = workbook.addWorksheet('Resumen del período');
  summarySheet.columns = [
    { header: 'Indicador', key: 'indicador', width: 28 },
    { header: 'Valor', key: 'valor', width: 18 }
  ];
  summarySheet.addRows([
    { indicador: 'Total de sanciones generadas', valor: data.summary.total_sanciones },
    { indicador: 'Activas', valor: data.summary.activas },
    { indicador: 'Resueltas', valor: data.summary.resueltas },
    { indicador: 'Por origen: Ludoteca', valor: data.summary.ludoteca },
    { indicador: 'Por origen: Instalaciones', valor: data.summary.instalaciones },
    { indicador: 'Por origen: otros', valor: data.summary.otros },
    {
      indicador: 'Tiempo promedio de resolución (días)',
      valor: data.summary.promedio_resolucion_dias
    }
  ]);
  styleWorksheet(summarySheet);

  const byMonthSheet = workbook.addWorksheet('Sanciones por Mes');
  byMonthSheet.columns = [
    { header: 'Año-Mes', key: 'anio_mes', width: 14 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'De Ludoteca', key: 'de_ludoteca', width: 14 },
    { header: 'De Instalaciones', key: 'de_instalaciones', width: 18 },
    { header: 'Resueltas en el Mes', key: 'resueltas_en_mes', width: 20 }
  ];
  data.byMonthRows.forEach((row) => byMonthSheet.addRow(row));
  styleWorksheet(byMonthSheet);

  const topSheet = workbook.addWorksheet('Socios con más sanciones Top 20');
  topSheet.columns = [
    { header: 'Número de Socio', key: 'numero_socio', width: 18 },
    { header: 'Nombre Completo', key: 'nombre_completo', width: 30 },
    { header: 'Total Histórico', key: 'total_historico', width: 16 },
    { header: 'Activas', key: 'activas', width: 12 },
    { header: 'Última Sanción', key: 'ultima_sancion', width: 18 }
  ];
  data.topRows.forEach((row) => topSheet.addRow(row));
  styleWorksheet(topSheet);
  setDateFormat(topSheet.getColumn(5));

  const detailSheet = workbook.addWorksheet('Detalle completo');
  detailSheet.columns = [
    { header: 'ID de Sanción', key: 'sancion_id', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Origen', key: 'origen', width: 18 },
    { header: 'Motivo', key: 'motivo', width: 34 },
    { header: 'Nombre del Socio', key: 'nombre_socio', width: 30 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Resuelto Por', key: 'resuelto_por', width: 28 },
    { header: 'Fecha de Resolución', key: 'fecha_resolucion', width: 20 }
  ];
  data.detailRows.forEach((row) => detailSheet.addRow(row));
  styleWorksheet(detailSheet);
  setDateFormat(detailSheet.getColumn(2));
  setDateFormat(detailSheet.getColumn(8));

  return workbook;
}

async function buildSanctionsPdf(res, desde, hasta) {
  const data = await collectSanctionsData(desde, hasta);
  const doc = createPdf(res, 'reporte-sanciones-periodo.pdf', 'Reporte de Sanciones por Periodo');

  writePdfTitle(doc, 'Reporte de Sanciones por Periodo', [
    `Rango: ${desde} a ${hasta}`,
    'El promedio de resolucion solo considera sanciones con fecha_resolucion.'
  ]);

  writePdfSection(doc, '1. Resumen del periodo');
  writePdfKeyValueRows(doc, [
    ['Total de sanciones generadas', data.summary.total_sanciones],
    ['Activas', data.summary.activas],
    ['Resueltas', data.summary.resueltas],
    ['Origen Ludoteca', data.summary.ludoteca],
    ['Origen Instalaciones', data.summary.instalaciones],
    ['Origen otros', data.summary.otros],
    ['Tiempo promedio de resolucion (dias)', formatNumber(data.summary.promedio_resolucion_dias)]
  ]);

  writePdfSection(doc, '2. Sanciones por Mes');
  writePdfTable(
    doc,
    ['Año-Mes', 'Total', 'Ludoteca', 'Instalaciones', 'Resueltas'],
    data.byMonthRows.map((row) => [
      row.anio_mes,
      row.total,
      row.de_ludoteca,
      row.de_instalaciones,
      row.resueltas_en_mes
    ]),
    [1.5, 1, 1.2, 1.5, 1.2]
  );

  writePdfSection(doc, '3. Socios con mas sanciones Top 20');
  writePdfTable(
    doc,
    ['#', 'Num. Socio', 'Nombre', 'Histórico', 'Activas', 'Última'],
    data.topRows.map((row, index) => [
      index + 1,
      row.numero_socio || '-',
      row.nombre_completo,
      row.total_historico,
      row.activas,
      formatDateValue(row.ultima_sancion)
    ]),
    [0.5, 1.2, 3, 1, 0.8, 1.5]
  );

  writePdfSection(doc, '4. Detalle de sanciones');
  data.detailRows.forEach((row) => {
    ensurePdfSpace(doc, 72);
    doc.font('Helvetica-Bold').text(`#${row.sancion_id} — ${formatDateValue(row.fecha)}`);
    doc.font('Helvetica').text(`Socio: ${row.nombre_socio}`);
    doc.text(`Origen: ${row.origen}  |  Estado: ${row.estado}`);
    doc.text(`Resuelto por: ${row.resuelto_por || '-'}  |  Fecha: ${formatDateValue(row.fecha_resolucion)}`);
    doc.text(`Motivo: ${row.motivo}`);
    doc.moveDown(0.7);
  });

  finalizePdf(doc);
}

module.exports = { buildSanctionsWorkbook, buildSanctionsPdf };
