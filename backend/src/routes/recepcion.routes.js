const express = require('express');
const router = express.Router();

const recepcionController = require('../controllers/recepcionController');
const { verifyToken } = require('../middleware/auth.middleware');

// Todas las rutas de recepción requieren token
router.use(verifyToken);

// Dashboard
router.get('/dashboard', recepcionController.getDashboard);

// Socios
router.get('/socios', recepcionController.listarSocios);
router.post('/socios', recepcionController.crearSocio);
router.put('/socios/:id', recepcionController.actualizarSocio);
router.delete('/socios/:id', recepcionController.eliminarSocio);

// Reservas
router.get('/reservas', recepcionController.getReservasCentral);
router.get('/espacios', recepcionController.getEspacios);

// Visitas
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

module.exports = router;