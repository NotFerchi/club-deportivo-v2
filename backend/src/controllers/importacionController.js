const importacionService = require('../services/importacionService');
const ServiceError = require('../services/serviceError');

// ── SCRUM-134: GET /api/importacion/template ─────────────────────────────────
// ?tipo (si viene) debe ser 'socios': validado en la ruta.
const descargarTemplate = async (req, res) => {
  const workbook = importacionService.crearTemplateSocios();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="template_socios.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
};

// ── SCRUM-135: POST /api/importacion/socios ──────────────────────────────────
// req.file requerido: validado en la ruta.
// 200 importado · 400 archivo/columnas inválidos · 422 reporte de filas (nada se guardó).
const importarSocios = async (req, res) => {
  try {
    return res.json(await importacionService.importarSocios(req.file.buffer));
  } catch (error) {
    // Solo ServiceError; los fallos escalados (conexión) llegan al errorHandler.
    if (error instanceof ServiceError) return res.status(error.status).json(error.body);
    throw error;
  }
};

module.exports = { descargarTemplate, importarSocios };
