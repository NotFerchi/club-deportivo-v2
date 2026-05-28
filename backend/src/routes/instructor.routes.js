const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const instructorController = require('../controllers/instructorController');


router.use(verifyToken);
router.use(checkRole(['admin', 'gerente', 'instructor', 'coordinador', 'recepcion']));


// Clases y alumnos
router.get('/clases', instructorController.getClasesPorFecha);
router.get('/clases/:sesionId/alumnos', instructorController.getAlumnosPorClase);
router.post('/asistencia', instructorController.registrarAsistencia);
router.post('/clases/inscribir', instructorController.inscribirSocioClase);
router.get('/mis-clases', instructorController.getMisClases);
router.get('/metricas', instructorController.getMetricas);
router.get('/clases-general', instructorController.getClasesGeneral);
router.get('/sesiones/:sesionId/inscritos', instructorController.getInscritosPorSesion);

// Torneos
router.get('/torneos', instructorController.getTorneos);
router.get('/torneos/:torneoId/encuentros', instructorController.getEncuentros);
router.put('/torneos/encuentro/:encuentroId', instructorController.registrarGanador);

module.exports = router;