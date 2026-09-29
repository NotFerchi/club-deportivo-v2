const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { exportarSocios } = require('../controllers/exportacionController');
const { formatoReporte, rangoReporte } = require('../middleware/reporteValidators');

router.use(verifyToken);

router.get('/asistencia', checkRole(['admin', 'gerente', 'coordinador']), reportesController.getReporteAsistencia);
router.get('/demografico', checkRole(['admin', 'gerente']), formatoReporte, reportesController.getReporteDemografico);
router.get(
  '/ocupacion',
  checkRole(['admin', 'gerente', 'coordinador']),
  formatoReporte,
  rangoReporte,
  reportesController.getReporteOcupacion
);
router.get(
  '/afluencia',
  checkRole(['admin', 'gerente', 'coordinador']),
  formatoReporte,
  rangoReporte,
  reportesController.getReporteAfluencia
);
router.get(
  '/sanciones',
  checkRole(['admin', 'gerente']),
  formatoReporte,
  rangoReporte,
  reportesController.getReporteSanciones
);
router.get('/socios/exportar', checkRole(['admin', 'gerente']), exportarSocios);

module.exports = router;
