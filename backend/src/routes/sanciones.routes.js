const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['instructor', 'recepcion', 'gerente', 'coordinador', 'admin'];

// Rutas para consulta (cualquier usuario autenticado)
router.get('/socio/:socioId', verifyToken, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, sancionesController.verificarSancionActiva);

// Rutas protegidas para admin, gerente y coordinador
router.get('/', verifyToken, checkRole(staffRoles), sancionesController.getSanciones);
router.get('/:id', verifyToken, checkRole(staffRoles), sancionesController.getSancionById);
router.post('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.createSancion);
router.post('/no-shows/sincronizar', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.sincronizarNoShows);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.updateSancion);
router.put('/:id/perdonar', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.perdonarSancion);
router.put('/:id/levantar', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.levantarSancion);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.deleteSancion);

module.exports = router;
