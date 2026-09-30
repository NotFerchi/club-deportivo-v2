const express = require('express');
const router = express.Router();
const socioController = require('../controllers/socioController');
const sancionesController = require('../controllers/sancionesController');
const qrController = require('../controllers/qrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requirePositiveInt } = require('../middleware/validators');

const adminRoles = ['admin', 'gerente'];
const staffRoles = ['admin', 'gerente', 'recepcion', 'coordinador'];

// Lectura — cualquier autenticado
router.get('/', verifyToken, socioController.getSocios);
router.get(
  '/:socio_id/qr',
  verifyToken,
  requirePositiveInt('socio_id', { body: { error: 'socio_id debe ser un entero positivo' } }),
  qrController.obtenerQrActivoSocio
);
router.get(
  '/:socio_id/sanciones',
  verifyToken,
  requirePositiveInt('socio_id', { body: { error: 'socio_id debe ser un entero valido' } }),
  sancionesController.getHistorialCompletoSocio
);
router.get('/:id', verifyToken, socioController.getSocioById);

// Escritura — staff (recepcion y coordinador pueden crear/editar, solo admin/gerente pueden eliminar)
router.post('/', verifyToken, checkRole(staffRoles), socioController.createSocio);
router.put('/:id', verifyToken, checkRole(staffRoles), socioController.updateSocio);
router.put('/:id/reactivar', verifyToken, checkRole(staffRoles), socioController.reactivar);
router.delete('/:id', verifyToken, checkRole(adminRoles), socioController.deleteSocio);
router.delete('/:id/permanente', verifyToken, checkRole(['admin']), socioController.deletePermanente);

module.exports = router;
