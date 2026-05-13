const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const staffRoles = ['recepcion', 'coordinador', 'admin'];

// Rutas para consulta (cualquier usuario autenticado)
router.get('/socio/:socioId', verifyToken, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, sancionesController.verificarSancionActiva);

// Rutas protegidas para consulta y administracion de sanciones
router.get('/', verifyToken, checkRole(staffRoles), sancionesController.getSanciones);
router.get('/:id', verifyToken, checkRole(staffRoles), sancionesController.getSancionById);
router.post('/', verifyToken, checkRole(['admin']), sancionesController.createSancion);
router.post('/no-shows/sincronizar', verifyToken, checkRole(['admin']), sancionesController.sincronizarNoShows);
router.patch('/:sancion_id', verifyToken, sancionesController.resolverSancion);
router.put('/:id', verifyToken, checkRole(['admin']), sancionesController.updateSancion);
router.put('/:id/perdonar', verifyToken, checkRole(['admin']), sancionesController.perdonarSancion);
router.put('/:id/levantar', verifyToken, checkRole(['admin']), sancionesController.levantarSancion);
router.delete('/:id', verifyToken, checkRole(['admin']), sancionesController.deleteSancion);

module.exports = router;
