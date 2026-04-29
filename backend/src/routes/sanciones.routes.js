const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas para consulta (cualquier usuario autenticado)
router.get('/socio/:socioId', verifyToken, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, sancionesController.verificarSancionActiva);

// Rutas protegidas para admin, gerente y coordinador
router.get('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.getSanciones);
router.post('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.createSancion);
router.put('/:id/perdonar', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sancionesController.perdonarSancion);

module.exports = router;