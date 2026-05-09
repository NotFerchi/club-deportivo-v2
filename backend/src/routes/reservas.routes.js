const express = require('express');
const router = express.Router();
const reservasController = require('../controllers/reservasController');
const { verifyToken } = require('../middleware/auth.middleware');

// CRUD de reservas
router.get('/', verifyToken, reservasController.getReservas);
router.get('/disponibilidad', verifyToken, reservasController.getDisponibilidad);
router.get('/:id', verifyToken, reservasController.getReservaById);
router.post('/', verifyToken, reservasController.createReserva);
router.put('/:id', verifyToken, reservasController.updateReserva);
router.delete('/:id', verifyToken, reservasController.deleteReserva);
// Endpoint específico para cancelar
router.put('/:id/cancelar', verifyToken, reservasController.cancelarReserva);

module.exports = router;