const express = require('express');
const router = express.Router();
const recepcionController = require('../controllers/recepcionController');
const { verifyToken } = require('../middleware/auth.middleware');

// Visitas
router.get('/visitas/activas', verifyToken, recepcionController.visitasActivas);
router.get('/visitas/historial', verifyToken, recepcionController.historialVisitas);
router.post('/visitas', verifyToken, recepcionController.crearVisita);
router.put('/visitas/:id/salida', verifyToken, recepcionController.registrarSalida);
router.get('/socios-lista', verifyToken, recepcionController.listaSociosParaVisitas);

module.exports = router;