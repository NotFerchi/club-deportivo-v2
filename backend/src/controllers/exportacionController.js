const { getMexicoDateISO } = require('../utils/mexicoDate');
const { consultarSociosExport, buildSociosWorkbook } = require('../services/reportes/sociosExport');

const exportarSocios = async (req, res) => {
  const { activo = 'true', tipo, modalidad } = req.query;

  let socios;
  try {
    socios = await consultarSociosExport({ activo, tipo, modalidad });
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar socios: ' + err.message });
  }

  const workbook = buildSociosWorkbook(socios);

  const fecha = getMexicoDateISO();
  const filename = `socios_${fecha}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = { exportarSocios };
