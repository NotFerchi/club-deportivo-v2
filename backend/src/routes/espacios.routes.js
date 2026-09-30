const express = require('express');
const router = express.Router();
const controller = require('../controllers/espaciosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requireFields } = require('../middleware/validators');

router.get('/todos', verifyToken, controller.getEspacios);
router.get('/disciplinas', verifyToken, controller.getDisciplinas);
router.get('/:id/mantenimiento', verifyToken, controller.getMantenimientoHistorial);
router.get('/:id', verifyToken, controller.getEspacioById);
router.post(
  '/',
  verifyToken,
  checkRole(['admin', 'gerente']),
  requireFields(['nombre', 'capacidad_maxima'], { message: 'Nombre y capacidad máxima son requeridos' }),
  controller.createEspacio
);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente']), controller.updateEspacio);
router.patch('/:id/estado', verifyToken, checkRole(['admin', 'gerente']), controller.toggleEstado);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente']), controller.deleteEspacio);

module.exports = router;
