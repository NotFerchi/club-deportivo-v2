const express = require('express');
const router = express.Router();
const accesoController = require('../controllers/accesoController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['admin', 'gerente', 'coordinador', 'recepcion'];

router.post(
  '/lectura-qr',
  verifyToken,
  checkRole(staffRoles),
  accesoController.lecturaQr
);

module.exports = router;
