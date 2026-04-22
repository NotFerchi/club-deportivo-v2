const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const { verifyToken } = require('../middleware/auth.middleware');


router.get('/test', (req, res) => {
    console.log('=== RUTA TEST LLAMADA ===');
    res.json({ message: 'Ruta de instructor funcionando correctamente', timestamp: new Date() });
});


router.get('/clases', async (req, res) => {
    console.log('=== RUTA CLASES LLAMADA ===');
    console.log('Fecha:', req.query.fecha);
    res.json([
        {
            sesion_id: 1,
            disciplina: 'Yoga',
            espacio: 'Salón Yoga',
            hora_inicio: '08:00',
            hora_fin: '09:30',
            cupo_maximo: 15,
            cupo_actual: 8
        },
        {
            sesion_id: 2,
            disciplina: 'Natación',
            espacio: 'Alberca Olímpica',
            hora_inicio: '10:00',
            hora_fin: '11:00',
            cupo_maximo: 10,
            cupo_actual: 5
        }
    ]);
});

router.use(verifyToken);
router.get('/clases', instructorController.getClasesPorFecha);
router.get('/clases/:sesionId/alumnos', instructorController.getAlumnosPorClase);
router.post('/asistencia', instructorController.registrarAsistencia);
router.get('/mis-clases', instructorController.getMisClases);
router.get('/metricas', instructorController.getMetricas);
router.get('/clases-general', instructorController.getClasesGeneral);

module.exports = router;