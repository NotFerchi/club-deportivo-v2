const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requireFields, requirePositiveInt } = require('../middleware/validators');

const staffRoles = ['admin', 'gerente', 'coordinador', 'recepcion'];

router.get('/mi-qr', verifyToken, qrController.obtenerMiQr);

router.post(
  '/generar-socio',
  verifyToken,
  checkRole(staffRoles),
  requirePositiveInt('socio_id', { source: 'body', body: { error: 'socio_id debe ser un entero positivo' } }),
  qrController.generarQrSocio
);

router.post(
  '/generar-visita',
  verifyToken,
  checkRole(staffRoles),
  requirePositiveInt('visita_id', { source: 'body', body: { error: 'visita_id debe ser un entero positivo' } }),
  qrController.generarQrVisita
);

router.post(
  '/identificar-socio',
  verifyToken,
  checkRole(['admin', 'gerente', 'coordinador', 'recepcion', 'instructor']),
  requireFields(['codigo_qr'], { message: 'codigo_qr es requerido' }),
  qrController.identificarSocio
);

module.exports = router;
