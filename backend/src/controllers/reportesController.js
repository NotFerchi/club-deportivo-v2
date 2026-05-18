const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../config/database');
const { normalizeText } = require('../utils/adminRules');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PDF_MIME = 'application/pdf';
const DEFAULT_RANGE_DAYS = 30;
const AGE_RANGES = ['0-12', '13-17', '18-30', '31-45', '46-60', '61+'];
const MEMBERSHIP_TYPES = ['Accionista', 'Rentista'];
const MEMBERSHIP_MODALITIES = ['Individual', 'Familiar'];
const DAYS_ES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

function parseISODate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(query, defaultDays = DEFAULT_RANGE_DAYS) {
  const rawDesde = query.desde || query.fechaInicio || null;
  const rawHasta = query.hasta || query.fechaFin || query.fecha || null;

  if (!rawDesde && !rawHasta) {
    const hasta = getTodayISO();
    return { desde: addDaysISO(hasta, -(defaultDays - 1)), hasta, defaulted: true };
  }

  const desde = parseISODate(rawDesde || rawHasta);
  const hasta = parseISODate(rawHasta || rawDesde);

  if (!desde || !hasta) {
    const error = new Error('Las fechas deben tener formato YYYY-MM-DD');
    error.status = 400;
    throw error;
  }

  if (desde > hasta) {
    const error = new Error('La fecha desde no puede ser mayor que la fecha hasta');
    error.status = 400;
    throw error;
  }

  return { desde, hasta, defaulted: false };
}

function resolveFormat(value) {
  const format = String(value || 'xlsx').toLowerCase();
  if (format !== 'xlsx' && format !== 'pdf') {
    const error = new Error('El parametro formato debe ser xlsx o pdf');
    error.status = 400;
    throw error;
  }
  return format;
}

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Club Deportivo';
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

function styleWorksheet(worksheet) {
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };
  });
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function setDateFormat(column) {
  column.eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    cell.numFmt = 'yyyy-mm-dd';
  });
}

function setPercentageFormat(column) {
  column.eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;
    cell.numFmt = '0.00%';
  });
}

function buildFullName(row, keys = ['nombres', 'apellido_paterno', 'apellido_materno']) {
  return keys.map((key) => row[key]).filter(Boolean).join(' ').trim();
}

async function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

function createPdf(res, filename, title) {
  res.setHeader('Content-Type', PDF_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const now = new Date();
  doc.info = {
    Title: title,
    Author: 'Club Deportivo',
    Subject: title,
    Creator: 'Club Deportivo',
    Producer: 'PDFKit',
    CreationDate: now,
    ModDate: now
  };
  doc.on('error', (error) => {
    console.error(`Error generando PDF ${filename}:`, error);
    if (!res.destroyed) res.destroy(error);
  });
  res.on('error', (error) => {
    console.error(`Error enviando PDF ${filename}:`, error);
  });
  doc.pipe(res);
  return doc;
}

function finalizePdf(doc) {
  doc.end();
}

function formatDateValue(value) {
  if (!value) return '-';
  return String(value).split('T')[0];
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function ensurePdfSpace(doc, requiredHeight = 48) {
  if (doc.y + requiredHeight <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
}

function writePdfTitle(doc, title, subtitleLines = []) {
  doc.font('Helvetica-Bold').fontSize(18).text(title);
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10);
  subtitleLines.forEach((line) => doc.text(line));
  doc.moveDown();
}

function writePdfSection(doc, title) {
  ensurePdfSpace(doc, 40);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#1E3A5F').text(title);
  doc.moveDown(0.35);
  doc.fillColor('black').font('Helvetica').fontSize(10);
}

function writePdfBulletList(doc, rows) {
  rows.forEach((row) => {
    ensurePdfSpace(doc, 20);
    doc.text(`- ${row}`);
  });
  doc.moveDown(0.7);
}

function writePdfKeyValueRows(doc, rows) {
  rows.forEach(([key, value]) => {
    ensurePdfSpace(doc, 20);
    doc.font('Helvetica-Bold').text(`${key}: `, { continued: true });
    doc.font('Helvetica').text(String(value));
  });
  doc.moveDown(0.7);
}

async function getDemographicRows() {
  const result = await pool.query(`
    WITH socios_base AS (
      SELECT
        COALESCE(
          u.fecha_nacimiento,
          NULLIF(to_jsonb(s)->>'fecha_nacimiento', '')::date
        ) AS fecha_nacimiento,
        COALESCE(u.genero, to_jsonb(s)->>'genero') AS genero
      FROM socios s
      LEFT JOIN usuarios u ON s.usuario_id = u.usuario_id
      WHERE COALESCE(
        (to_jsonb(s)->>'activo')::boolean,
        LOWER(COALESCE(to_jsonb(s)->>'estado', 'activo')) = 'activo',
        true
      ) = true
    )
    SELECT
      CASE
        WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= 12 THEN '0-12'
        WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= 17 THEN '13-17'
        WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= 30 THEN '18-30'
        WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= 45 THEN '31-45'
        WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= 60 THEN '46-60'
        ELSE '61+'
      END AS rango,
      genero,
      COUNT(*)::int AS total
    FROM socios_base
    WHERE fecha_nacimiento IS NOT NULL
    GROUP BY rango, genero
  `);

  return result.rows;
}

async function getMembershipRows() {
  const result = await pool.query(`
    SELECT
      INITCAP(LOWER(COALESCE(to_jsonb(s)->>'tipo', to_jsonb(s)->>'tipo_socio', 'Sin tipo'))) AS tipo,
      INITCAP(LOWER(COALESCE(to_jsonb(s)->>'modalidad', 'Sin modalidad'))) AS modalidad,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE((to_jsonb(s)->>'es_titular')::boolean, false) = true)::int AS titulares,
      COUNT(*) FILTER (WHERE COALESCE((to_jsonb(s)->>'es_titular')::boolean, false) = false)::int AS miembros
    FROM socios s
    WHERE COALESCE(
      (to_jsonb(s)->>'activo')::boolean,
      LOWER(COALESCE(to_jsonb(s)->>'estado', 'activo')) = 'activo',
      true
    ) = true
    GROUP BY 1, 2
  `);

  return result.rows;
}

async function getLargestFamiliesRows() {
  const result = await pool.query(`
    WITH socios_base AS (
      SELECT
        s.socio_id,
        s.numero_socio,
        NULLIF(COALESCE(to_jsonb(s)->>'accion_id', to_jsonb(s)->>'accion_familiar_id'), '') AS accion_key,
        COALESCE((to_jsonb(s)->>'es_titular')::boolean, false) AS es_titular,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno)), ''),
          NULLIF(TRIM(CONCAT_WS(' ', to_jsonb(s)->>'nombre', to_jsonb(s)->>'apellido')), ''),
          CONCAT('Socio ', s.socio_id)
        ) AS nombre_socio
      FROM socios s
      LEFT JOIN usuarios u ON u.usuario_id = s.usuario_id
      WHERE COALESCE(
        (to_jsonb(s)->>'activo')::boolean,
        LOWER(COALESCE(to_jsonb(s)->>'estado', 'activo')) = 'activo',
        true
      ) = true
    ),
    grupos AS (
      SELECT
        COALESCE(af.codigo_accion, sb.accion_key, sb.numero_socio, CONCAT('SOC-', sb.socio_id)) AS numero_accion,
        sb.nombre_socio,
        sb.es_titular,
        sb.socio_id
      FROM socios_base sb
      LEFT JOIN acciones_familiares af
        ON af.accion_id = CASE
          WHEN sb.accion_key ~ '^\\d+$' THEN sb.accion_key::int
          ELSE NULL
        END
    )
    SELECT
      numero_accion,
      COALESCE(
        NULLIF(MAX(nombre_socio) FILTER (WHERE es_titular = true), ''),
        NULLIF(MAX(nombre_socio), ''),
        'Sin titular asignado'
      ) AS nombre_titular,
      COUNT(socio_id)::int AS total_miembros
    FROM grupos
    GROUP BY numero_accion
    ORDER BY total_miembros DESC, numero_accion ASC
    LIMIT 20
  `);

  return result.rows;
}

async function getNewMembersByMonthRows() {
  const result = await pool.query(`
    WITH socios_base AS (
      SELECT
        COALESCE(
          NULLIF(to_jsonb(s)->>'fecha_alta', '')::timestamp,
          NULLIF(to_jsonb(s)->>'created_at', '')::timestamp
        ) AS fecha_alta
      FROM socios s
      WHERE COALESCE(
        (to_jsonb(s)->>'activo')::boolean,
        LOWER(COALESCE(to_jsonb(s)->>'estado', 'activo')) = 'activo',
        true
      ) = true
    )
    SELECT
      TO_CHAR(DATE_TRUNC('month', fecha_alta), 'YYYY-MM') AS anio_mes,
      COUNT(*)::int AS nuevos_en_mes
    FROM socios_base
    WHERE fecha_alta IS NOT NULL
    GROUP BY DATE_TRUNC('month', fecha_alta)
    ORDER BY DATE_TRUNC('month', fecha_alta) ASC
  `);

  return result.rows;
}

async function collectDemographicData() {
  const [demographicRows, membershipRows, familyRows, newMembersRows] = await Promise.all([
    getDemographicRows(),
    getMembershipRows(),
    getLargestFamiliesRows(),
    getNewMembersByMonthRows()
  ]);

  const ageMap = new Map(AGE_RANGES.map((range) => [range, { total: 0, hombres: 0, mujeres: 0 }]));
  for (const row of demographicRows) {
    if (!ageMap.has(row.rango)) continue;
    const item = ageMap.get(row.rango);
    item.total += Number(row.total || 0);
    const gender = normalizeText(row.genero);
    if (gender === 'hombre') item.hombres += Number(row.total || 0);
    if (gender === 'mujer') item.mujeres += Number(row.total || 0);
  }

  const ageDistribution = AGE_RANGES.map((range) => {
    const values = ageMap.get(range);
    return {
      rango: range,
      total: values.total,
      hombres: values.hombres,
      mujeres: values.mujeres
    };
  });

  const membershipMap = new Map(
    membershipRows.map((row) => [`${row.tipo}|${row.modalidad}`, row])
  );

  const memberships = [];
  MEMBERSHIP_TYPES.forEach((tipo) => {
    MEMBERSHIP_MODALITIES.forEach((modalidad) => {
      const row = membershipMap.get(`${tipo}|${modalidad}`);
      memberships.push({
        tipo,
        modalidad,
        total: Number(row?.total || 0),
        titulares: Number(row?.titulares || 0),
        miembros: Number(row?.miembros || 0)
      });
    });
  });

  let acumulado = 0;
  const nuevosPorMes = newMembersRows.map((row) => {
    acumulado += Number(row.nuevos_en_mes || 0);
    return {
      anio_mes: row.anio_mes,
      nuevos_en_mes: Number(row.nuevos_en_mes || 0),
      total_acumulado: acumulado
    };
  });

  return {
    ageDistribution,
    memberships,
    families: familyRows.map((row) => ({
      numero_accion: row.numero_accion,
      nombre_titular: row.nombre_titular,
      total_miembros: Number(row.total_miembros || 0)
    })),
    nuevosPorMes
  };
}

async function buildDemographicWorkbook() {
  const workbook = createWorkbook();
  const data = await collectDemographicData();

  const demographicSheet = workbook.addWorksheet('Distribución por Edad');
  demographicSheet.columns = [
    { header: 'Rango_Edad', key: 'rango', width: 16 },
    { header: 'Total', key: 'total', width: 12 },
    { header: '% del total', key: 'porcentaje', width: 14 },
    { header: 'Hombres', key: 'hombres', width: 12 },
    { header: 'Mujeres', key: 'mujeres', width: 12 }
  ];

  data.ageDistribution.forEach((values, index) => {
    const excelRow = index + 2;
    demographicSheet.addRow({
      rango: values.rango,
      total: values.total,
      porcentaje: { formula: `IFERROR(B${excelRow}/SUM($B$2:$B$7),0)` },
      hombres: values.hombres,
      mujeres: values.mujeres
    });
  });

  styleWorksheet(demographicSheet);
  setPercentageFormat(demographicSheet.getColumn(3));

  const membershipSheet = workbook.addWorksheet('Distribución por Tipo de Membresía');
  membershipSheet.columns = [
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Modalidad', key: 'modalidad', width: 16 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Titulares', key: 'titulares', width: 12 },
    { header: 'Miembros', key: 'miembros', width: 12 }
  ];

  data.memberships.forEach((row) => membershipSheet.addRow(row));

  styleWorksheet(membershipSheet);

  const familiesSheet = workbook.addWorksheet('Familias más grandes');
  familiesSheet.columns = [
    { header: 'Numero_Accion', key: 'numero_accion', width: 18 },
    { header: 'Nombre_Titular', key: 'nombre_titular', width: 30 },
    { header: 'Total_Miembros', key: 'total_miembros', width: 16 }
  ];
  data.families.forEach((row) => familiesSheet.addRow(row));
  styleWorksheet(familiesSheet);

  const newMembersSheet = workbook.addWorksheet('Socios Nuevos por Mes');
  newMembersSheet.columns = [
    { header: 'Año-Mes', key: 'anio_mes', width: 14 },
    { header: 'Nuevos_en_mes', key: 'nuevos_en_mes', width: 16 },
    { header: 'Total_Acumulado', key: 'total_acumulado', width: 16 }
  ];

  data.nuevosPorMes.forEach((row) => newMembersSheet.addRow(row));
  styleWorksheet(newMembersSheet);

  return workbook;
}

async function getOccupationSummaryRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows;
}

async function getParticipationByDisciplineRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows;
}

async function getInstructorRankingRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows;
}

function getDatesBetween(desde, hasta) {
  const dates = [];
  let current = desde;
  while (current <= hasta) {
    dates.push(current);
    current = addDaysISO(current, 1);
  }
  return dates;
}

function getDayName(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  return DAYS_ES[(date.getUTCDay() + 6) % 7];
}

function overlaps(slotStart, slotEnd, rangeStart, rangeEnd) {
  return String(rangeStart).slice(0, 5) < slotEnd && String(rangeEnd).slice(0, 5) > slotStart;
}

async function getLowActivityRows(desde, hasta) {
  const [spacesResult, reservationsResult, sessionsResult] = await Promise.all([
    pool.query(`SELECT espacio_id, nombre FROM espacios WHERE COALESCE(activo, true) = true ORDER BY nombre ASC`),
    pool.query(`
      SELECT espacio_id, fecha_reserva, hora_inicio, hora_fin, estado
      FROM reservaciones
      WHERE fecha_reserva >= $1::date
        AND fecha_reserva < ($2::date + INTERVAL '1 day')
        AND LOWER(estado::text) <> 'cancelada'
    `, [desde, hasta]),
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
        reservationKeys.add(`${row.espacio_id}|${row.fecha_reserva}|${start}`);
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

  rows.sort((a, b) =>
    a.espacio.localeCompare(b.espacio)
    || DAYS_ES.indexOf(a.dia_semana) - DAYS_ES.indexOf(b.dia_semana)
    || a.hora_inicio.localeCompare(b.hora_inicio)
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
    { header: 'Total_Reservas', key: 'total_reservas', width: 16 },
    { header: 'Confirmadas', key: 'confirmadas', width: 14 },
    { header: 'Canceladas', key: 'canceladas', width: 14 },
    { header: 'No_Show', key: 'no_show', width: 12 },
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
    { header: 'Total_Sesiones', key: 'total_sesiones', width: 16 },
    { header: 'Total_Asistentes', key: 'total_asistentes', width: 16 },
    { header: 'Promedio_por_Sesión', key: 'promedio', width: 18 }
  ];
  data.disciplineRows.forEach((row) => disciplineSheet.addRow(row));
  styleWorksheet(disciplineSheet);

  const instructorSheet = workbook.addWorksheet('Ranking de Instructores por Asistencia');
  instructorSheet.columns = [
    { header: 'Instructor', key: 'instructor', width: 30 },
    { header: 'Disciplina', key: 'disciplina', width: 22 },
    { header: 'Total_Sesiones', key: 'total_sesiones', width: 16 },
    { header: 'Total_Asistentes', key: 'total_asistentes', width: 16 },
    { header: 'Promedio', key: 'promedio', width: 12 }
  ];
  data.instructorRows.forEach((row) => instructorSheet.addRow(row));
  styleWorksheet(instructorSheet);

  const lowActivitySheet = workbook.addWorksheet('Horas con baja actividad por Espacio');
  lowActivitySheet.columns = [
    { header: 'Espacio', key: 'espacio', width: 24 },
    { header: 'Día_semana', key: 'dia_semana', width: 16 },
    { header: 'Hora_inicio', key: 'hora_inicio', width: 12 },
    { header: 'Hora_fin', key: 'hora_fin', width: 12 },
    { header: 'Estado', key: 'estado', width: 16 }
  ];
  data.lowActivityRows.forEach((row) => lowActivitySheet.addRow(row));
  styleWorksheet(lowActivitySheet);

  return workbook;
}

async function getAttendanceSummaryRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows[0];
}

async function getAttendanceDailyRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows;
}

async function getAttendanceByWeekdayRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows;
}

async function getAttendanceHourlyRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows;
}

async function getAttendanceTopMembersRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

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
    { header: 'Dia_semana', key: 'dia_semana', width: 16 },
    { header: 'Total_Entradas', key: 'total_entradas', width: 16 },
    { header: 'Entradas_Socios', key: 'entradas_socios', width: 16 },
    { header: 'Entradas_Visitas', key: 'entradas_visitas', width: 16 },
    { header: 'Socios_Unicos', key: 'socios_unicos', width: 14 },
    { header: 'Visitas_Unicas', key: 'visitas_unicas', width: 14 }
  ];
  data.dailyRows.forEach((row) => dailySheet.addRow(row));
  styleWorksheet(dailySheet);

  const weekdaySheet = workbook.addWorksheet('Dias mas frecuentados');
  weekdaySheet.columns = [
    { header: 'Dia_semana', key: 'dia_semana', width: 16 },
    { header: 'Total_Entradas', key: 'total_entradas', width: 16 },
    { header: 'Entradas_Socios', key: 'entradas_socios', width: 16 },
    { header: 'Entradas_Visitas', key: 'entradas_visitas', width: 16 },
    { header: 'Dias_Considerados', key: 'dias_considerados', width: 18 },
    { header: 'Promedio_Diario', key: 'promedio_diario', width: 16 }
  ];
  data.weekdayRows.forEach((row) => weekdaySheet.addRow(row));
  styleWorksheet(weekdaySheet);

  const hourlySheet = workbook.addWorksheet('Horarios pico');
  hourlySheet.columns = [
    { header: 'Hora', key: 'hora', width: 12 },
    { header: 'Total_Entradas', key: 'total_entradas', width: 16 },
    { header: 'Entradas_Socios', key: 'entradas_socios', width: 16 },
    { header: 'Entradas_Visitas', key: 'entradas_visitas', width: 16 }
  ];
  data.hourlyRows.forEach((row) => hourlySheet.addRow(row));
  styleWorksheet(hourlySheet);

  const topDatesSheet = workbook.addWorksheet('Top fechas');
  topDatesSheet.columns = [
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Dia_semana', key: 'dia_semana', width: 16 },
    { header: 'Total_Entradas', key: 'total_entradas', width: 16 },
    { header: 'Entradas_Socios', key: 'entradas_socios', width: 16 },
    { header: 'Entradas_Visitas', key: 'entradas_visitas', width: 16 }
  ];
  data.topDatesRows.forEach((row) => topDatesSheet.addRow(row));
  styleWorksheet(topDatesSheet);

  const topMembersSheet = workbook.addWorksheet('Socios frecuentes');
  topMembersSheet.columns = [
    { header: 'Socio_ID', key: 'socio_id', width: 12 },
    { header: 'Nombre_Socio', key: 'nombre_socio', width: 32 },
    { header: 'Total_Entradas', key: 'total_entradas', width: 16 }
  ];
  data.topMembersRows.forEach((row) => topMembersSheet.addRow(row));
  styleWorksheet(topMembersSheet);

  return workbook;
}

async function getSanctionsSummaryRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

  return result.rows[0];
}

async function getSanctionsByMonthRows(desde, hasta) {
  const result = await pool.query(`
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
  `, [desde, hasta]);

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
  const result = await pool.query(`
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
  `, [desde, hasta]);

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
      promedio_resolucion_dias: summary?.promedio_resolucion_dias == null
        ? 0
        : Number(Number(summary.promedio_resolucion_dias).toFixed(2))
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
    { header: 'De_Ludoteca', key: 'de_ludoteca', width: 14 },
    { header: 'De_Instalaciones', key: 'de_instalaciones', width: 18 },
    { header: 'Resueltas_en_mes', key: 'resueltas_en_mes', width: 18 }
  ];
  data.byMonthRows.forEach((row) => byMonthSheet.addRow(row));
  styleWorksheet(byMonthSheet);

  const topSheet = workbook.addWorksheet('Socios con más sanciones Top 20');
  topSheet.columns = [
    { header: 'Numero_Socio', key: 'numero_socio', width: 18 },
    { header: 'Nombre_Completo', key: 'nombre_completo', width: 30 },
    { header: 'Total_Historico', key: 'total_historico', width: 16 },
    { header: 'Activas', key: 'activas', width: 12 },
    { header: 'Ultima_Sancion', key: 'ultima_sancion', width: 18 }
  ];
  data.topRows.forEach((row) => topSheet.addRow(row));
  styleWorksheet(topSheet);
  setDateFormat(topSheet.getColumn(5));

  const detailSheet = workbook.addWorksheet('Detalle completo');
  detailSheet.columns = [
    { header: 'sancion_id', key: 'sancion_id', width: 12 },
    { header: 'fecha', key: 'fecha', width: 18 },
    { header: 'origen', key: 'origen', width: 18 },
    { header: 'motivo', key: 'motivo', width: 32 },
    { header: 'nombre_socio', key: 'nombre_socio', width: 30 },
    { header: 'estado', key: 'estado', width: 14 },
    { header: 'resuelto_por', key: 'resuelto_por', width: 28 },
    { header: 'fecha_resolucion', key: 'fecha_resolucion', width: 18 }
  ];
  data.detailRows.forEach((row) => detailSheet.addRow(row));
  styleWorksheet(detailSheet);
  setDateFormat(detailSheet.getColumn(2));
  setDateFormat(detailSheet.getColumn(8));

  return workbook;
}

async function buildDemographicPdf(res) {
  const data = await collectDemographicData();
  const totalSocios = data.ageDistribution.reduce((sum, row) => sum + row.total, 0);
  const doc = createPdf(res, 'reporte-demografico-socios.pdf', 'Reporte Demografico de Socios');

  writePdfTitle(doc, 'Reporte Demografico de Socios', [
    `Generado: ${formatDateValue(new Date().toISOString())}`,
    `Total de socios considerados: ${totalSocios}`
  ]);

  writePdfSection(doc, '1. Distribucion por Edad');
  writePdfBulletList(doc, data.ageDistribution.map((row) => {
    const porcentaje = totalSocios === 0 ? 0 : (row.total / totalSocios) * 100;
    return `${row.rango}: Total ${row.total}, Hombres ${row.hombres}, Mujeres ${row.mujeres}, ${formatNumber(porcentaje)}%`;
  }));

  writePdfSection(doc, '2. Distribucion por Tipo de Membresia');
  writePdfBulletList(doc, data.memberships.map((row) =>
    `${row.tipo} / ${row.modalidad}: Total ${row.total}, Titulares ${row.titulares}, Miembros ${row.miembros}`
  ));

  writePdfSection(doc, '3. Familias mas grandes');
  writePdfBulletList(doc, data.families.map((row, index) =>
    `${index + 1}. Accion ${row.numero_accion} - ${row.nombre_titular} - ${row.total_miembros} miembros`
  ));

  writePdfSection(doc, '4. Socios Nuevos por Mes');
  writePdfBulletList(doc, data.nuevosPorMes.map((row) =>
    `${row.anio_mes}: Nuevos ${row.nuevos_en_mes}, Acumulado ${row.total_acumulado}`
  ));

  finalizePdf(doc);
}

async function buildOccupationPdf(res, desde, hasta) {
  const data = await collectOccupationData(desde, hasta);
  const doc = createPdf(res, 'reporte-ocupacion-espacios.pdf', 'Reporte de Ocupacion de Espacios y Disciplinas');

  writePdfTitle(doc, 'Reporte de Ocupacion de Espacios y Disciplinas', [
    `Rango: ${desde} a ${hasta}`,
    'Horario operativo usado para baja actividad: 06:00 a 22:00'
  ]);

  writePdfSection(doc, '1. Reservaciones por Espacio');
  writePdfBulletList(doc, data.summaryRows.map((row) => {
    const ocupacion = row.total_reservas === 0 ? 0 : (row.confirmadas / row.total_reservas) * 100;
    return `${row.espacio}: Total ${row.total_reservas}, Confirmadas ${row.confirmadas}, Canceladas ${row.canceladas}, No-show ${row.no_show}, Ocupacion ${formatNumber(ocupacion)}%`;
  }));

  writePdfSection(doc, '2. Participacion por Disciplina');
  writePdfBulletList(doc, data.disciplineRows.map((row) =>
    `${row.disciplina}: Sesiones ${row.total_sesiones}, Asistentes ${row.total_asistentes}, Promedio ${formatNumber(row.promedio)}`
  ));

  writePdfSection(doc, '3. Ranking de Instructores por Asistencia');
  writePdfBulletList(doc, data.instructorRows.map((row, index) =>
    `${index + 1}. ${row.instructor} - ${row.disciplina}: Sesiones ${row.total_sesiones}, Asistentes ${row.total_asistentes}, Promedio ${formatNumber(row.promedio)}`
  ));

  writePdfSection(doc, '4. Horas con baja actividad por Espacio');
  writePdfBulletList(doc, data.lowActivityRows.map((row) =>
    `${row.espacio} - ${row.dia_semana} ${row.hora_inicio} a ${row.hora_fin}: ${row.estado}`
  ));

  finalizePdf(doc);
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
  writePdfBulletList(doc, data.weekdayRows.map((row, index) =>
    `${index + 1}. ${row.dia_semana}: ${row.total_entradas} entradas, promedio ${formatNumber(row.promedio_diario)} por dia`
  ));

  writePdfSection(doc, '3. Top fechas');
  writePdfBulletList(doc, data.topDatesRows.map((row, index) =>
    `${index + 1}. ${row.fecha} (${row.dia_semana}): ${row.total_entradas} entradas, socios ${row.entradas_socios}, visitas ${row.entradas_visitas}`
  ));

  writePdfSection(doc, '4. Horarios pico');
  writePdfBulletList(doc, data.hourlyRows.slice(0, 10).map((row, index) =>
    `${index + 1}. ${row.hora}: ${row.total_entradas} entradas, socios ${row.entradas_socios}, visitas ${row.entradas_visitas}`
  ));

  writePdfSection(doc, '5. Socios frecuentes');
  writePdfBulletList(doc, data.topMembersRows.map((row, index) =>
    `${index + 1}. ${row.nombre_socio}: ${row.total_entradas} entradas`
  ));

  finalizePdf(doc);
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
  writePdfBulletList(doc, data.byMonthRows.map((row) =>
    `${row.anio_mes}: Total ${row.total}, Ludoteca ${row.de_ludoteca}, Instalaciones ${row.de_instalaciones}, Resueltas ${row.resueltas_en_mes}`
  ));

  writePdfSection(doc, '3. Socios con mas sanciones Top 20');
  writePdfBulletList(doc, data.topRows.map((row, index) =>
    `${index + 1}. ${row.numero_socio || '-'} - ${row.nombre_completo}: Historico ${row.total_historico}, Activas ${row.activas}, Ultima ${formatDateValue(row.ultima_sancion)}`
  ));

  writePdfSection(doc, '4. Detalle completo');
  data.detailRows.forEach((row) => {
    ensurePdfSpace(doc, 72);
    doc.font('Helvetica-Bold').text(`#${row.sancion_id} - ${formatDateValue(row.fecha)}`);
    doc.font('Helvetica').text(`Socio: ${row.nombre_socio}`);
    doc.text(`Origen: ${row.origen}`);
    doc.text(`Estado: ${row.estado}`);
    doc.text(`Resuelto por: ${row.resuelto_por || '-'}`);
    doc.text(`Fecha resolucion: ${formatDateValue(row.fecha_resolucion)}`);
    doc.text(`Motivo: ${row.motivo}`);
    doc.moveDown(0.7);
  });

  finalizePdf(doc);
}

async function sendReport(res, format, xlsxFilename, xlsxBuilder, pdfBuilder) {
  if (format === 'pdf') {
    await pdfBuilder();
    return;
  }

  const workbook = await xlsxBuilder();
  await sendWorkbook(res, workbook, xlsxFilename);
}

function sendReportError(res, error, fallbackMessage) {
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  res.status(error.status || 500).json({ error: error.message || fallbackMessage });
}

const reportesController = {
  getReporteAsistencia: async (req, res) => {
    const { fechaInicio, fechaFin, instructorId } = req.query;

    try {
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
        paramCount += 1;
      }

      query += `
        GROUP BY i.instructor_id, instructor_nombre, d.nombre, sp.cupo_maximo
        ORDER BY asistencia_promedio DESC
      `;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error en getReporteAsistencia:', error);
      res.status(500).json({ error: 'Error al obtener reporte de asistencia' });
    }
  },

  getReporteDemografico: async (req, res) => {
    try {
      const format = resolveFormat(req.query.formato);
      await sendReport(
        res,
        format,
        'reporte-demografico-socios.xlsx',
        () => buildDemographicWorkbook(),
        () => buildDemographicPdf(res)
      );
    } catch (error) {
      console.error('Error en getReporteDemografico:', error);
      sendReportError(res, error, 'Error al generar reporte demografico');
    }
  },

  getReporteOcupacion: async (req, res) => {
    try {
      const format = resolveFormat(req.query.formato);
      const { desde, hasta } = resolveDateRange(req.query);
      await sendReport(
        res,
        format,
        'reporte-ocupacion-espacios.xlsx',
        () => buildOccupationWorkbook(desde, hasta),
        () => buildOccupationPdf(res, desde, hasta)
      );
    } catch (error) {
      console.error('Error en getReporteOcupacion:', error);
      sendReportError(res, error, 'Error al generar reporte de ocupacion');
    }
  },

  getReporteAfluencia: async (req, res) => {
    try {
      const format = resolveFormat(req.query.formato);
      const { desde, hasta } = resolveDateRange(req.query);
      await sendReport(
        res,
        format,
        'reporte-afluencia-dias-frecuentados.xlsx',
        () => buildAttendanceWorkbook(desde, hasta),
        () => buildAttendancePdf(res, desde, hasta)
      );
    } catch (error) {
      console.error('Error en getReporteAfluencia:', error);
      sendReportError(res, error, 'Error al generar reporte de afluencia');
    }
  },

  getReporteSanciones: async (req, res) => {
    try {
      const format = resolveFormat(req.query.formato);
      const { desde, hasta } = resolveDateRange(req.query);
      await sendReport(
        res,
        format,
        'reporte-sanciones-periodo.xlsx',
        () => buildSanctionsWorkbook(desde, hasta),
        () => buildSanctionsPdf(res, desde, hasta)
      );
    } catch (error) {
      console.error('Error en getReporteSanciones:', error);
      sendReportError(res, error, 'Error al generar reporte de sanciones');
    }
  }
};

module.exports = reportesController;

