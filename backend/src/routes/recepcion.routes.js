const express = require('express');
const router = express.Router();

const recepcionController = require('../controllers/recepcionController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['admin', 'gerente', 'recepcion', 'coordinador'];

router.use(verifyToken);

router.get('/dashboard', recepcionController.getDashboard);

// Socios — solo lectura para todos; escritura restringida
router.get('/socios', recepcionController.listarSocios);
router.post('/socios', checkRole(staffRoles), recepcionController.crearSocio);
router.put('/socios/:id', checkRole(staffRoles), recepcionController.actualizarSocio);
router.delete('/socios/:id', checkRole(['admin', 'gerente']), recepcionController.eliminarSocio);

// Reservas
router.get('/reservas', recepcionController.getReservasCentral);
router.get('/espacios', recepcionController.getEspacios);

// Visitas
router.get('/visitas/activas', recepcionController.visitasActivas);
router.get('/visitas/historial', recepcionController.historialVisitas);
router.get('/visitas', recepcionController.listarVisitas);
router.post('/visitas/cerrar-vencidas', checkRole(staffRoles), recepcionController.cerrarVisitasVencidas);
router.post('/visitas', checkRole(staffRoles), recepcionController.crearVisita);
router.put('/visitas/:id/salida', checkRole(staffRoles), recepcionController.registrarSalidaVisita);
router.put('/visitas/:id', checkRole(['admin', 'gerente']), recepcionController.actualizarVisita);
router.get('/visitas/:id/qr', checkRole(staffRoles), recepcionController.obtenerQrPase);
router.post('/visitas/:id/enviar-qr', checkRole(staffRoles), recepcionController.enviarQrVisita);
router.get('/socios-lista', recepcionController.listaSociosParaVisitas);

// Ludoteca
router.get('/ludoteca/activos', recepcionController.getLudotecaActivos);
router.post('/ludoteca/entrada', checkRole(staffRoles), recepcionController.registrarEntradaLudoteca);
router.put('/ludoteca/salida/:id', checkRole(staffRoles), recepcionController.registrarSalidaLudoteca);

// Pase de lista
router.get('/clases', recepcionController.getClasesDia);
router.get('/clases/:sesionId/alumnos', recepcionController.getAlumnosPorSesion);
router.post('/asistencia/manual', checkRole(staffRoles), recepcionController.registrarAsistenciaManual);

module.exports = router;
