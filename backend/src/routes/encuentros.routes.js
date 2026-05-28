const express = require('express');
const router = express.Router();
const encuentrosController = require('../controllers/encuentrosController');
const verifyToken = require('../middleware/verifyToken');
const checkRole   = require('../middleware/checkRole');

router.put('/:encuentro_id', encuentrosController.updateEncuentro);

router.patch(
  '/:encuentro_id/resultado',
  verifyToken,
  checkRole(['instructor', 'admin', 'gerente', 'coordinador']),
  encuentrosController.registrarResultado
);

router.patch(
  '/:encuentro_id/cancha',
  verifyToken,
  checkRole(['admin', 'gerente', 'coordinador']),
  encuentrosController.asignarCancha
);

module.exports = router;