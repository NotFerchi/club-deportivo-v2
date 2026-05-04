const express = require('express');
const router = express.Router();
const controller = require('../controllers/ludotecaController');
const { verifyToken } = require('../middleware/auth.middleware');
const checkRole = require('../middleware/checkRole');

// Rutas existentes
router.get('/activos',   verifyToken, controller.registrosActivos);
router.get('/historial', verifyToken, controller.historial);
router.post('/',         verifyToken, controller.registrarEntrada);
router.put('/:id/salida', verifyToken, controller.registrarSalida);

// NUEVO: Registro de entrada con validación de edad
router.post(
  '/entrada',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador']),
  controller.registrarEntradaLudoteca
);

module.exports = router;