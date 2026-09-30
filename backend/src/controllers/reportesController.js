const { reporteAsistenciaInstructores } = require('../services/reportes/asistenciaReport');
const { buildDemographicWorkbook, buildDemographicPdf } = require('../services/reportes/demograficoReport');
const { buildOccupationWorkbook, buildOccupationPdf } = require('../services/reportes/ocupacionReport');
const { buildAttendanceWorkbook, buildAttendancePdf } = require('../services/reportes/afluenciaReport');
const { buildSanctionsWorkbook, buildSanctionsPdf } = require('../services/reportes/sancionesReport');
const { sendWorkbook } = require('../services/reportes/excelExporter');

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
      res.json(await reporteAsistenciaInstructores({ fechaInicio, fechaFin, instructorId }));
    } catch (error) {
      console.error('Error en getReporteAsistencia:', error);
      res.status(500).json({ error: 'Error al obtener reporte de asistencia' });
    }
  },

  getReporteDemografico: async (req, res) => {
    try {
      const { formato: format } = res.locals; // validado en la ruta
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
      const { formato: format } = res.locals; // validado en la ruta
      const { desde, hasta } = res.locals.rango; // validado en la ruta
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
      const { formato: format } = res.locals; // validado en la ruta
      const { desde, hasta } = res.locals.rango; // validado en la ruta
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
      const { formato: format } = res.locals; // validado en la ruta
      const { desde, hasta } = res.locals.rango; // validado en la ruta
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
