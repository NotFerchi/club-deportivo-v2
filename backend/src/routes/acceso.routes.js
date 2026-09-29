const express = require('express');
const router = express.Router();
const accesoController = require('../controllers/accesoController');
const accesoMetricasController = require('../controllers/accesoMetricasController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requireNonEmptyString, requireIsoDates, optionalOneOf } = require('../middleware/validators');

const staffRoles = ['admin', 'gerente', 'coordinador', 'recepcion'];
const metricasRoles = ['admin', 'gerente', 'coordinador'];

router.post(
  '/lectura-qr',
  verifyToken,
  checkRole(staffRoles),
  requireNonEmptyString('codigo_qr', {
    missingBody: { error: 'codigo_qr es requerido' },
    invalidBody: { error: 'codigo_qr debe ser una cadena no vacia' }
  }),
  accesoController.lecturaQr
);

router.get(
  '/metricas',
  verifyToken,
  checkRole(metricasRoles),
  requireIsoDates(['desde', 'hasta'], {
    missingBody: { error: 'Los parámetros desde y hasta son requeridos' },
    invalidBody: { error: 'Formato de fecha inválido. Use YYYY-MM-DD' }
  }),
  optionalOneOf('tipo', ['socio', 'visita'], { body: { error: 'El parámetro tipo debe ser "socio" o "visita"' } }),
  accesoMetricasController.getMetricas
);

module.exports = router;
