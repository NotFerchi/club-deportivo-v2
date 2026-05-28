const express = require('express');
const router = express.Router();
const torneosController = require('../controllers/torneosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['admin', 'gerente', 'coordinador'];

router.get('/', verifyToken, torneosController.getTorneos);
router.get('/categorias', verifyToken, torneosController.getCategorias);
router.get('/mis-participaciones', verifyToken, torneosController.getMisParticipaciones);
router.get('/:torneo_id/participantes', verifyToken, torneosController.getParticipantes);
router.get('/:torneo_id/bracket', verifyToken, torneosController.getBracket);
router.get('/:torneo_id/reporte', verifyToken, torneosController.getReporte);

router.post('/', verifyToken, checkRole(staffRoles), torneosController.createTorneo);
router.put('/:torneo_id', verifyToken, checkRole(staffRoles), torneosController.updateTorneo);
router.post('/:torneo_id/inscribir',    verifyToken, checkRole(staffRoles), torneosController.inscribirParticipante);
router.post('/:torneo_id/inscribir-me', verifyToken, torneosController.inscribirSocioPropio);  // auto-inscripción del socio
router.patch('/:torneo_id/cerrar-inscripciones', verifyToken, checkRole(staffRoles), torneosController.cerrarInscripciones);
router.patch('/:torneo_id/confirmar-bracket',    verifyToken, checkRole(staffRoles), torneosController.confirmarBracket);
router.patch('/:torneo_id/finalizar',            verifyToken, checkRole(staffRoles), torneosController.finalizarTorneo);
router.patch('/:torneo_id/cancelar',             verifyToken, checkRole(staffRoles), torneosController.cancelarTorneo);
router.delete('/:torneo_id/participantes/:participante_id', verifyToken, checkRole(staffRoles), torneosController.desinscribirParticipante);

module.exports = router;
