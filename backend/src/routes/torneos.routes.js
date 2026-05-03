const express = require('express');
const router = express.Router();
const torneosController = require('../controllers/torneosController');

router.get('/', torneosController.getTorneos);
router.post('/', torneosController.createTorneo);
router.post('/:torneo_id/inscribir', torneosController.inscribirParticipante);

module.exports = router;
