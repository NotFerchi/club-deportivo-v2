const express = require('express');
const router = express.Router();
const espaciosController = require('../controllers/espaciosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const instructorController = require('../controllers/instructorController');

router.get('/test', (req, res) => {
    res.json({ message: 'Ruta instructor OK', timestamp: new Date() });
});

// --- RUTAS PÚBLICAS (O solo con Token) ---
router.get('/todos', verifyToken, espaciosController.getEspacios);
router.get('/', verifyToken, espaciosController.getEspacios);
// --- RUTAS PROTEGIDAS (Solo Staff) ---
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente']));

router.get('/:id', espaciosController.getEspacioById);
router.post('/', espaciosController.createEspacio);
router.put('/:id', espaciosController.updateEspacio);
router.delete('/:id', espaciosController.deleteEspacio);

// Gestión de clases y alumnos
router.get('/clases', instructorController.getClasesPorFecha);
router.get('/clases/:sesionId/alumnos', instructorController.getAlumnosPorClase);
router.post('/asistencia', instructorController.registrarAsistencia);
router.get('/mis-clases', instructorController.getMisClases);
router.get('/metricas', instructorController.getMetricas);
router.get('/clases-general', instructorController.getClasesGeneral);

// Gestión de Torneos
router.get('/torneos', instructorController.getTorneos);
router.get('/torneos/:torneoId/encuentros', instructorController.getEncuentros);
router.put('/torneos/encuentro/:encuentroId', instructorController.registrarGanador);

module.exports = router;