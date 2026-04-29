const express = require('express');
const router = express.Router();
const recepcionController = require('../controllers/recepcionController');
const { verifyToken } = require('../middleware/auth.middleware');

// Visitas
<<<<<<< Updated upstream
router.get('/visitas/activas', verifyToken, recepcionController.visitasActivas);
router.get('/visitas/historial', verifyToken, recepcionController.historialVisitas);
router.post('/visitas', verifyToken, recepcionController.crearVisita);
router.put('/visitas/:id/salida', verifyToken, recepcionController.registrarSalida);
router.get('/socios-lista', verifyToken, recepcionController.listaSociosParaVisitas);
=======
router.get('/visitas/activas', recepcionController.visitasActivas);
router.get('/visitas/historial', recepcionController.historialVisitas);
router.get('/visitas', recepcionController.listarVisitas);
router.post('/visitas', recepcionController.crearVisita);
router.put('/visitas/:id/salida', recepcionController.registrarSalidaVisita);
router.get('/socios-lista', recepcionController.listaSociosParaVisitas);

// Ludoteca
router.get('/ludoteca/activos', recepcionController.getLudotecaActivos);
router.post('/ludoteca/entrada', recepcionController.registrarEntradaLudoteca);
router.put('/ludoteca/salida/:id', recepcionController.registrarSalidaLudoteca);

// Pase de lista
router.get('/clases', recepcionController.getClasesDia);
router.get('/clases/:sesionId/alumnos', recepcionController.getAlumnosPorSesion);
router.post('/asistencia/manual', recepcionController.registrarAsistenciaManual);
>>>>>>> Stashed changes

module.exports = router;
