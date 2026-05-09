const express = require('express');
const router = express.Router();
const torneosController = require('../controllers/torneosController');
const verifyToken = require('../middleware/verifyToken');

router.get('/', torneosController.getTorneos);
router.get('/categorias', torneosController.getCategorias);
router.get('/mis-participaciones', verifyToken, torneosController.getMisParticipaciones);
router.get('/:torneo_id/bracket', torneosController.getBracket);
router.get('/:torneo_id/reporte', verifyToken, torneosController.getReporte);
router.post('/', torneosController.createTorneo);
router.post('/:torneo_id/inscribir', torneosController.inscribirParticipante);
router.patch('/:torneo_id/cerrar-inscripciones', torneosController.cerrarInscripciones);
router.patch('/:torneo_id/confirmar-bracket', torneosController.confirmarBracket);

module.exports = router;