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
const importarSocios = async (req, res) => {
  let filas;
  try {
    filas = await importacionService.leerFilasExcel(req.file.buffer);
  } catch {
    return res.status(400).json({ error: 'No se pudo leer el archivo Excel' });
  }

  const errorArchivo = importacionService.validarFilas(filas);
  if (errorArchivo) {
    return res.status(400).json({ error: errorArchivo });
  }

  try {
    const { nuevos, actualizados, errores } = await importacionService.importarFilas(filas);
    return res.json({ total_procesados: filas.length, nuevos, actualizados, errores });
  } catch (error) {
    // Solo ServiceError; los fallos escalados (conexión) llegan al errorHandler.
    if (error instanceof ServiceError) return res.status(error.status).json(error.body);
    throw error;
  }
};

module.exports = { descargarTemplate, importarSocios };
