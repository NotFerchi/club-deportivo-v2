const express = require('express');
const router = express.Router();
const socioController = require('../controllers/socioController');
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas de socios
router.get('/', verifyToken, socioController.getSocios);
router.get('/:socio_id/sanciones', verifyToken, sancionesController.getHistorialCompletoSocio);
router.get('/:id', verifyToken, socioController.getSocioById);
router.post('/', verifyToken, checkRole(['admin']), socioController.createSocio);
router.put('/:id', verifyToken, checkRole(['admin']), socioController.updateSocio);
router.delete('/:id', verifyToken, checkRole(['admin']), socioController.deleteSocio);
router.delete('/:id/permanente', verifyToken, checkRole(['admin']), socioController.deletePermanente);
router.put('/:id/reactivar', verifyToken, checkRole(['admin']), socioController.reactivar);

module.exports = router;
