const express = require('express');
const router = express.Router();
const accesoController = require('../controllers/accesoController');
const accesoMetricasController = require('../controllers/accesoMetricasController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['admin', 'gerente', 'coordinador', 'recepcion'];
const metricasRoles = ['admin', 'gerente', 'coordinador'];

router.post(
  '/lectura-qr',
  verifyToken,
  checkRole(staffRoles),
  accesoController.lecturaQr
);

router.get(
  '/metricas',
  verifyToken,
  checkRole(metricasRoles),
  accesoMetricasController.getMetricas
);

module.exports = router;
