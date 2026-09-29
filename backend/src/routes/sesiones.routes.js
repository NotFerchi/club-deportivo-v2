const express = require('express');
const router = express.Router();
const sesionesController = require('../controllers/sesionesController');
const asistenciaQrController = require('../controllers/asistenciaQrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requirePositiveInt, requireNonEmptyString } = require('../middleware/validators');

const asistenciaQrRoles = ['admin', 'gerente', 'coordinador', 'instructor', 'recepcion'];

// Rutas públicas para lectura (catálogo de clases)
router.get('/', sesionesController.getSesiones);
router.get('/dia/:dia', sesionesController.getSesionesPorDia);

// Asistencia por QR (instructor escanea QR de socio o visita)
router.post(
  '/:sesion_id/asistencia-qr',
  verifyToken,
  checkRole(asistenciaQrRoles),
  requirePositiveInt('sesion_id', { body: { error: 'sesion_id debe ser un entero positivo' } }),
  requireNonEmptyString('codigo_qr', {
    missingBody: { error: 'codigo_qr es requerido' },
    invalidBody: { error: 'codigo_qr debe ser una cadena no vacía' }
  }),
  asistenciaQrController.registrarAsistenciaQr
);

// Rutas protegidas para modificación
router.post('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.createSesion);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.updateSesion);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.deleteSesion);

module.exports = router;
