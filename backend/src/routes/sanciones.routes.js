const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const adminRoles = ['admin', 'gerente'];
const staffRoles = ['admin', 'gerente', 'recepcion', 'coordinador'];
const coordRoles = ['admin', 'gerente', 'coordinador'];

router.get('/socio/:socioId', verifyToken, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, sancionesController.verificarSancionActiva);

router.get('/', verifyToken, checkRole(staffRoles), sancionesController.getSanciones);
router.get('/:id', verifyToken, checkRole(staffRoles), sancionesController.getSancionById);

router.post('/', verifyToken, checkRole(coordRoles), sancionesController.createSancion);
router.post('/no-shows/sincronizar', verifyToken, checkRole(adminRoles), sancionesController.sincronizarNoShows);
router.patch('/:sancion_id', verifyToken, checkRole(coordRoles), sancionesController.resolverSancion);
router.put('/:id', verifyToken, checkRole(coordRoles), sancionesController.updateSancion);
router.put('/:id/perdonar', verifyToken, checkRole(coordRoles), sancionesController.perdonarSancion);
router.put('/:id/levantar', verifyToken, checkRole(coordRoles), sancionesController.levantarSancion);
router.delete('/:id', verifyToken, checkRole(adminRoles), sancionesController.deleteSancion);

module.exports = router;