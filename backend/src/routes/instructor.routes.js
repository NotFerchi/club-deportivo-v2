const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const instructorController = require('../controllers/instructorController');
const { requireFields, validateInput } = require('../middleware/validators');

// POST /clases/inscribir: sesion_id, (socio_id o visita_id) y fecha requeridos (sin body → errorHandler).
const inscripcionClase = validateInput((req) => {
  const { sesion_id, socio_id, visita_id, fecha } = req.body;
  if (!sesion_id || (!socio_id && !visita_id) || !fecha) {
    return [400, { error: 'sesion_id, (socio_id o visita_id) y fecha son requeridos' }];
  }
  return null;
});

router.use(verifyToken);
router.use(checkRole(['admin', 'gerente', 'instructor', 'coordinador', 'recepcion']));

// Clases y alumnos
router.get(
  '/clases',
  requireFields(['fecha'], { source: 'query', message: 'La fecha es requerida' }),
  instructorController.getClasesPorFecha
);
router.get('/clases/:sesionId/alumnos', instructorController.getAlumnosPorClase);
router.post('/asistencia', instructorController.registrarAsistencia);
router.post('/clases/inscribir', inscripcionClase, instructorController.inscribirSocioClase);
router.get('/mis-clases', instructorController.getMisClases);
router.get('/metricas', instructorController.getMetricas);
router.get('/clases-general', instructorController.getClasesGeneral);
router.get('/sesiones/:sesionId/inscritos', instructorController.getInscritosPorSesion);

// Torneos
router.get('/torneos', instructorController.getTorneos);
router.get('/torneos/:torneoId/encuentros', instructorController.getEncuentros);
router.put('/torneos/encuentro/:encuentroId', instructorController.registrarGanador);

module.exports = router;
