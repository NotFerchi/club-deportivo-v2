const express = require('express');
const router = express.Router();
const controller = require('../controllers/espaciosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

router.get('/todos', verifyToken, controller.getEspacios);
router.get('/disciplinas', verifyToken, controller.getDisciplinas);
router.get('/:id/mantenimiento', verifyToken, controller.getMantenimientoHistorial);
router.get('/:id', verifyToken, controller.getEspacioById);
router.post('/', verifyToken, checkRole(['admin', 'gerente']), controller.createEspacio);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente']), controller.updateEspacio);
router.patch('/:id/estado', verifyToken, checkRole(['admin', 'gerente']), controller.toggleEstado);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente']), controller.deleteEspacio);

module.exports = router;
