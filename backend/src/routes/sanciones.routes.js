const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const adminRoles = ['admin', 'gerente'];
const staffRoles = ['admin', 'gerente', 'recepcion', 'coordinador'];

// Consulta por socio — cualquier autenticado
router.get('/socio/:socioId', verifyToken, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, sancionesController.verificarSancionActiva);

// Consulta general — solo staff
router.get('/', verifyToken, checkRole(staffRoles), sancionesController.getSanciones);
router.get('/:id', verifyToken, checkRole(staffRoles), sancionesController.getSancionById);

// Escritura — admin y gerente
router.post('/', verifyToken, checkRole(adminRoles), sancionesController.createSancion);
router.post('/no-shows/sincronizar', verifyToken, checkRole(adminRoles), sancionesController.sincronizarNoShows);
router.patch('/:sancion_id', verifyToken, checkRole(adminRoles), sancionesController.resolverSancion);
router.put('/:id', verifyToken, checkRole(adminRoles), sancionesController.updateSancion);
router.put('/:id/perdonar', verifyToken, checkRole(adminRoles), sancionesController.perdonarSancion);
router.put('/:id/levantar', verifyToken, checkRole(adminRoles), sancionesController.levantarSancion);
router.delete('/:id', verifyToken, checkRole(adminRoles), sancionesController.deleteSancion);

module.exports = router;
