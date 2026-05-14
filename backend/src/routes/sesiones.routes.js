const express = require('express');
const router = express.Router();
const sesionesController = require('../controllers/sesionesController');
const asistenciaQrController = require('../controllers/asistenciaQrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const asistenciaQrRoles = ['admin', 'gerente', 'coordinador', 'instructor', 'recepcion'];

// Rutas públicas para lectura (catálogo de clases)
router.get('/', sesionesController.getSesiones);
router.get('/dia/:dia', sesionesController.getSesionesPorDia);

// Asistencia por QR (instructor escanea QR de socio o visita)
router.post(
  '/:sesion_id/asistencia-qr',
  verifyToken,
  checkRole(asistenciaQrRoles),
  asistenciaQrController.registrarAsistenciaQr
);

// Rutas protegidas para modificación
router.post('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.createSesion);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.updateSesion);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.deleteSesion);

module.exports = router;