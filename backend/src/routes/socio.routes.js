const express = require('express');
const router = express.Router();
const socioController = require('../controllers/socioController');
const sancionesController = require('../controllers/sancionesController');
const { verifyToken } = require('../middleware/auth.middleware');

// Rutas de socios
router.get('/', verifyToken, socioController.getSocios);
router.get('/:socio_id/sanciones', verifyToken, sancionesController.getHistorialCompletoSocio);
router.get('/:id', verifyToken, socioController.getSocioById);
router.post('/', verifyToken, socioController.createSocio);
router.put('/:id', verifyToken, socioController.updateSocio);
router.delete('/:id', verifyToken, socioController.deleteSocio);
router.delete('/:id/permanente', verifyToken, socioController.deletePermanente);
router.put('/:id/reactivar', verifyToken, socioController.reactivar);

module.exports = router;
