const express = require('express');
const router = express.Router();
const controller = require('../controllers/ludotecaController');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/activos', verifyToken, controller.registrosActivos);
router.get('/historial', verifyToken, controller.historial);
router.post('/', verifyToken, controller.registrarEntrada);
router.put('/:id/salida', verifyToken, controller.registrarSalida);

module.exports = router;