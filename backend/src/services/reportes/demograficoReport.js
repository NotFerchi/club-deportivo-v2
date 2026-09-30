// Reporte demográfico de socios: edad, membresía, familias y altas por mes.
const pool = require('../../config/database');
const { normalizeText } = require('../../utils/adminRules');
const { getMexicoDateISO } = require('../../utils/mexicoDate');
const { formatNumber } = require('./reporteComun');
const { createWorkbook, styleWorksheet, setPercentageFormat } = require('./excelExporter');
const { createPdf, finalizePdf, writePdfTitle, writePdfSection, writePdfTable } = require('./pdfExporter');

const AGE_RANGES = ['0-12', '13-17', '18-30', '31-45', '46-60', '61+'];
const MEMBERSHIP_TYPES = ['Accionista', 'Rentista'];
const MEMBERSHIP_MODALITIES = ['Individual', 'Familiar'];

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

  const membershipMap = new Map(membershipRows.map((row) => [`${row.tipo}|${row.modalidad}`, row]));

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
    { header: 'Rango de Edad', key: 'rango', width: 16 },
    { header: 'Total', key: 'total', width: 12 },
    { header: '% del Total', key: 'porcentaje', width: 14 },
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
    { header: 'Número de Acción', key: 'numero_accion', width: 20 },
    { header: 'Nombre del Titular', key: 'nombre_titular', width: 30 },
    { header: 'Total de Miembros', key: 'total_miembros', width: 18 }
  ];
  data.families.forEach((row) => familiesSheet.addRow(row));
  styleWorksheet(familiesSheet);

  const newMembersSheet = workbook.addWorksheet('Socios Nuevos por Mes');
  newMembersSheet.columns = [
    { header: 'Año-Mes', key: 'anio_mes', width: 14 },
    { header: 'Nuevos en el Mes', key: 'nuevos_en_mes', width: 18 },
    { header: 'Total Acumulado', key: 'total_acumulado', width: 16 }
  ];

  data.nuevosPorMes.forEach((row) => newMembersSheet.addRow(row));
  styleWorksheet(newMembersSheet);

  return workbook;
}

async function buildDemographicPdf(res) {
  const data = await collectDemographicData();
  const totalSocios = data.ageDistribution.reduce((sum, row) => sum + row.total, 0);
  const doc = createPdf(res, 'reporte-demografico-socios.pdf', 'Reporte Demografico de Socios');

  writePdfTitle(doc, 'Reporte Demografico de Socios', [
    `Generado: ${getMexicoDateISO()}`,
    `Total de socios considerados: ${totalSocios}`
  ]);

  writePdfSection(doc, '1. Distribucion por Edad');
  writePdfTable(
    doc,
    ['Rango de Edad', 'Total', 'Hombres', 'Mujeres', '% del Total'],
    data.ageDistribution.map((row) => {
      const porcentaje = totalSocios === 0 ? 0 : (row.total / totalSocios) * 100;
      return [row.rango, row.total, row.hombres, row.mujeres, `${formatNumber(porcentaje)}%`];
    }),
    [2.2, 1, 1, 1, 1.3]
  );

  writePdfSection(doc, '2. Distribucion por Tipo de Membresia');
  writePdfTable(
    doc,
    ['Tipo', 'Modalidad', 'Total', 'Titulares', 'Miembros'],
    data.memberships.map((row) => [row.tipo, row.modalidad, row.total, row.titulares, row.miembros]),
    [1.5, 1.5, 1, 1, 1]
  );

  writePdfSection(doc, '3. Familias mas grandes');
  writePdfTable(
    doc,
    ['#', 'Num. Accion', 'Titular', 'Miembros'],
    data.families.map((row, index) => [index + 1, row.numero_accion, row.nombre_titular, row.total_miembros]),
    [0.5, 1.5, 3.5, 1]
  );

  writePdfSection(doc, '4. Socios Nuevos por Mes');
  writePdfTable(
    doc,
    ['Año-Mes', 'Nuevos en el Mes', 'Total Acumulado'],
    data.nuevosPorMes.map((row) => [row.anio_mes, row.nuevos_en_mes, row.total_acumulado]),
    [1.5, 2, 2]
  );

  finalizePdf(doc);
}

module.exports = { buildDemographicWorkbook, buildDemographicPdf };
