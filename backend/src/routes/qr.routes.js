const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['admin', 'gerente', 'coordinador', 'recepcion'];

router.get('/mi-qr', verifyToken, qrController.obtenerMiQr);

router.post(
  '/generar-socio',
  verifyToken,
  checkRole(staffRoles),
  qrController.generarQrSocio
);

router.post(
  '/generar-visita',
  verifyToken,
  checkRole(staffRoles),
  qrController.generarQrVisita
);

router.post(
  '/identificar-socio',
  verifyToken,
  checkRole(['admin', 'gerente', 'coordinador', 'recepcion', 'instructor']),
  qrController.identificarSocio
);

module.exports = router;
