const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/test', (req, res) => {
    res.json({ message: 'Ruta instructor OK', timestamp: new Date() });
});

router.use(verifyToken);
router.get('/clases', instructorController.getClasesPorFecha);
router.get('/clases/:sesionId/alumnos', instructorController.getAlumnosPorClase);
router.post('/asistencia', instructorController.registrarAsistencia);
router.get('/mis-clases', instructorController.getMisClases);
router.get('/metricas', instructorController.getMetricas);
router.get('/clases-general', instructorController.getClasesGeneral);
router.get('/torneos', instructorController.getTorneos);
router.get('/torneos/:torneoId/encuentros', instructorController.getEncuentros);
router.put('/torneos/encuentro/:encuentroId', instructorController.registrarGanador);

module.exports = router;