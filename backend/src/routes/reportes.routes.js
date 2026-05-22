const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { exportarSocios } = require('../controllers/exportacionController');

router.use(verifyToken);

router.get('/asistencia', checkRole(['admin', 'gerente', 'coordinador']), reportesController.getReporteAsistencia);
router.get('/demografico', checkRole(['admin', 'gerente']), reportesController.getReporteDemografico);
router.get('/ocupacion', checkRole(['admin', 'gerente', 'coordinador']), reportesController.getReporteOcupacion);
router.get('/afluencia', checkRole(['admin', 'gerente', 'coordinador']), reportesController.getReporteAfluencia);
router.get('/sanciones', checkRole(['admin', 'gerente']), reportesController.getReporteSanciones);
router.get('/socios/exportar', checkRole(['admin', 'gerente']), exportarSocios);

module.exports = router;
