const express = require('express');
const router = express.Router();
const reservasController = require('../controllers/reservasController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const writeRoles = ['admin', 'gerente', 'recepcion', 'coordinador'];

router.get('/', verifyToken, reservasController.getReservas);
router.get('/disponibilidad', verifyToken, reservasController.getDisponibilidad);
router.get('/:id', verifyToken, reservasController.getReservaById);

router.post('/', verifyToken, checkRole(writeRoles), reservasController.createReserva);
router.put('/:id', verifyToken, checkRole(writeRoles), reservasController.updateReserva);
router.put('/:id/cancelar', verifyToken, checkRole(writeRoles), reservasController.cancelarReserva);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente']), reservasController.deleteReserva);

module.exports = router;
