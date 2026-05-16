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

// SCRUM-136 — Exportar socios activos
const { exportarSocios } = require('../controllers/exportacionController');
router.get('/socios/exportar', checkRole(['admin', 'gerente']), exportarSocios);

module.exports = router;