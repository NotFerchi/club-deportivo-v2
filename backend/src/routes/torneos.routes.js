const express = require('express');
const router = express.Router();
const torneosController = require('../controllers/torneosController');

router.get('/', torneosController.getTorneos);
router.post('/', torneosController.createTorneo);
router.post('/:torneo_id/inscribir', torneosController.inscribirParticipante);
router.patch('/:torneo_id/cerrar-inscripciones', torneosController.cerrarInscripciones);
router.patch('/:torneo_id/confirmar-bracket', torneosController.confirmarBracket);

module.exports = router;
