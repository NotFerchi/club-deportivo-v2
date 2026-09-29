const express = require('express');
const router = express.Router();
const encuentrosController = require('../controllers/encuentrosController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const validar = require('../middleware/torneoValidators');

router.put('/:encuentro_id', validar.actualizarEncuentro, encuentrosController.updateEncuentro);

router.patch(
  '/:encuentro_id/resultado',
  verifyToken,
  checkRole(['instructor', 'admin', 'gerente', 'coordinador']),
  validar.registrarResultado,
  encuentrosController.registrarResultado
);

router.patch(
  '/:encuentro_id/cancha',
  verifyToken,
  checkRole(['admin', 'gerente', 'coordinador']),
  validar.asignarCancha,
  encuentrosController.asignarCancha
);

module.exports = router;
