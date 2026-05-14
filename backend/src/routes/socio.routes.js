const express = require('express');
const router = express.Router();
const socioController = require('../controllers/socioController');
const sancionesController = require('../controllers/sancionesController');
const qrController = require('../controllers/qrController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const adminRoles = ['admin', 'gerente'];

// Lectura — cualquier autenticado
router.get('/', verifyToken, socioController.getSocios);
router.get('/:socio_id/qr', verifyToken, qrController.obtenerQrActivoSocio);
router.get('/:socio_id/sanciones', verifyToken, sancionesController.getHistorialCompletoSocio);
router.get('/:id', verifyToken, socioController.getSocioById);

// Escritura — admin y gerente
router.post('/', verifyToken, checkRole(adminRoles), socioController.createSocio);
router.put('/:id', verifyToken, checkRole(adminRoles), socioController.updateSocio);
router.put('/:id/reactivar', verifyToken, checkRole(adminRoles), socioController.reactivar);
router.delete('/:id', verifyToken, checkRole(adminRoles), socioController.deleteSocio);
router.delete('/:id/permanente', verifyToken, checkRole(['admin']), socioController.deletePermanente);

module.exports = router;
