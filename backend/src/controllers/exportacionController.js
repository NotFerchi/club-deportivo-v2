const ExcelJS = require('exceljs');
const pool    = require('../config/database');

const exportarSocios = async (req, res) => {
  const { activo = 'true', tipo, modalidad } = req.query;

  const condiciones = [`s.activo = ${activo === 'false' ? 'FALSE' : 'TRUE'}`];
  const valores     = [];

  if (tipo) {
    valores.push(tipo);
    condiciones.push(`s.tipo = $${valores.length}`);
  }
  if (modalidad) {
    valores.push(modalidad);
    condiciones.push(`s.modalidad = $${valores.length}`);
  }

  const where = condiciones.join(' AND ');

  let socios;
  try {
    const result = await pool.query(
      `SELECT
         af.codigo_accion,
         s.modalidad,
         s.tipo,
         s.es_titular,
         u.nombres,
         u.apellido_paterno,
         u.apellido_materno,
         u.genero,
         u.fecha_nacimiento,
         u.direccion,
         u.username,
         u.telefono,
         s.tel_emergencia,
         DATE_PART('year', AGE(CURRENT_DATE, u.fecha_nacimiento))::int AS edad
       FROM socios s
       JOIN usuarios u ON s.usuario_id = u.usuario_id
       JOIN acciones_familiares af ON s.accion_id = af.accion_id
       WHERE ${where}
       ORDER BY CAST(af.codigo_accion AS INT), s.es_titular DESC`,
      valores
    );
    socios = result.rows;
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar socios: ' + err.message });
  }

  const workbook = new ExcelJS.Workbook();
  const hoja     = workbook.addWorksheet('Socios');

  hoja.columns = [
    { header: 'Numero_Accion',       key: 'Numero_Accion',       width: 15 },
    { header: 'Tipo_Accion',         key: 'Tipo_Accion',         width: 15 },
    { header: 'Estatus_Accion',      key: 'Estatus_Accion',      width: 16 },
    { header: 'Rol',                 key: 'Rol',                 width: 12 },
    { header: 'Nombre_Completo',     key: 'Nombre_Completo',     width: 35 },
    { header: 'Genero',              key: 'Genero',              width: 12 },
    { header: 'Fecha_Nacimiento',    key: 'Fecha_Nacimiento',    width: 18 },
    { header: 'Edad',                key: 'Edad',                width: 8  },
    { header: 'Parentesco',          key: 'Parentesco',          width: 15 },
    { header: 'Domicilio',           key: 'Domicilio',           width: 35 },
    { header: 'Email',               key: 'Email',               width: 30 },
    { header: 'Telefono_Celular',    key: 'Telefono_Celular',    width: 18 },
    { header: 'Telefono_Particular', key: 'Telefono_Particular', width: 18 },
  ];

  // Estilo headers
  hoja.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FF1e3a5f' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFbfdbfe' } };
    cell.border    = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Filas de datos
  socios.forEach(s => {
    const nombreCompleto = [s.nombres, s.apellido_paterno, s.apellido_materno]
      .filter(Boolean).join(' ');
    const estatusAccion  = s.tipo === 'Accionista' ? 'Propia' : 'Rentada';
    const rol            = s.es_titular ? 'Titular' : 'Miembro';
    const email          = s.username || '';

    hoja.addRow({
      Numero_Accion:       s.codigo_accion,
      Tipo_Accion:         s.modalidad,
      Estatus_Accion:      estatusAccion,
      Rol:                 rol,
      Nombre_Completo:     nombreCompleto,
      Genero:              s.genero || '',
      Fecha_Nacimiento:    s.fecha_nacimiento ? String(s.fecha_nacimiento).split('T')[0] : '',
      Edad:                s.edad || '',
      Parentesco:          s.es_titular ? '' : '',
      Domicilio:           s.direccion || '',
      Email:               email,
      Telefono_Celular:    s.telefono || '',
      Telefono_Particular: s.tel_emergencia || '',
    });
  });

  const fecha    = new Date().toISOString().split('T')[0];
  const filename = `socios_${fecha}.xlsx`;

  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = { exportarSocios };