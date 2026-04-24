const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Solo admin, gerente y coordinador pueden ver reportes
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente', 'coordinador']));

router.get('/asistencia', reportesController.getReporteAsistencia);
router.get('/ocupacion', reportesController.getReporteOcupacion);
router.get('/sanciones', reportesController.getReporteSanciones);
router.get('/sanciones', verifyToken, reportesController.sanciones);

module.exports = router;