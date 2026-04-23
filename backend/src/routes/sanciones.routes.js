const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken } = require('../middleware/auth.middleware');

// CRUD de sanciones
router.get('/', verifyToken, sancionesController.getSanciones);
router.get('/:id', verifyToken, sancionesController.getSancionById);
router.post('/', verifyToken, sancionesController.createSancion);
router.put('/:id', verifyToken, sancionesController.updateSancion);
router.delete('/:id', verifyToken, sancionesController.deleteSancion);
// Endpoint específico para levantar sanción
router.put('/:id/levantar', verifyToken, sancionesController.levantarSancion);

module.exports = router;