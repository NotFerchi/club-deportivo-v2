const express = require('express');
const router = express.Router();
const qrController = require('../controllers/qrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['admin', 'gerente', 'coordinador', 'recepcion'];

router.post(
  '/generar-socio',
  verifyToken,
  checkRole(staffRoles),
  qrController.generarQrSocio
);

module.exports = router;
