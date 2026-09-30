const express = require('express');
const router = express.Router();
const torneosController = require('../controllers/torneosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const validar = require('../middleware/torneoValidators');

const staffRoles = ['admin', 'gerente', 'coordinador'];

router.get('/', verifyToken, validar.filtroDisciplina, torneosController.getTorneos);
router.get('/categorias', verifyToken, torneosController.getCategorias);
router.get('/mis-participaciones', verifyToken, torneosController.getMisParticipaciones);
router.get('/:torneo_id/participantes', verifyToken, validar.torneoId(), torneosController.getParticipantes);
router.get('/:torneo_id/bracket', verifyToken, validar.torneoId(), torneosController.getBracket);
router.get('/:torneo_id/reporte', verifyToken, validar.torneoIdConAcento(), torneosController.getReporte);

router.post('/', verifyToken, checkRole(staffRoles), validar.crearTorneo, torneosController.createTorneo);
router.put('/:torneo_id', verifyToken, checkRole(staffRoles), validar.actualizarTorneo, torneosController.updateTorneo);
router.post(
  '/:torneo_id/inscribir',
  verifyToken,
  checkRole(staffRoles),
  validar.inscribirParticipante,
  torneosController.inscribirParticipante
);
router.post('/:torneo_id/inscribir-me', verifyToken, validar.torneoId(), torneosController.inscribirSocioPropio); // auto-inscripción del socio
router.patch(
  '/:torneo_id/cerrar-inscripciones',
  verifyToken,
  checkRole(staffRoles),
  validar.torneoIdConAcento(),
  torneosController.cerrarInscripciones
);
router.patch(
  '/:torneo_id/confirmar-bracket',
  verifyToken,
  checkRole(staffRoles),
  validar.torneoIdConAcento(),
  torneosController.confirmarBracket
);
router.patch(
  '/:torneo_id/finalizar',
  verifyToken,
  checkRole(staffRoles),
  validar.torneoIdConAcento(),
  torneosController.finalizarTorneo
);
router.patch(
  '/:torneo_id/cancelar',
  verifyToken,
  checkRole(staffRoles),
  validar.torneoIdConAcento(),
  torneosController.cancelarTorneo
);
router.delete(
  '/:torneo_id/participantes/:participante_id',
  verifyToken,
  checkRole(staffRoles),
  validar.desinscribir,
  torneosController.desinscribirParticipante
);

module.exports = router;
