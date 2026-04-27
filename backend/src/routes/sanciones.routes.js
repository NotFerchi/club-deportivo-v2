const express = require('express');
const router = express.Router();
const sancionesController = require('../controllers/sancionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas para consulta (cualquier usuario autenticado puede ver)
router.get('/socio/:socioId', verifyToken, sancionesController.getSancionesBySocio);
router.get('/socio/:socioId/verificar', verifyToken, sancionesController.verificarSancionActiva);

// Rutas protegidas solo para admin/gerente
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente', 'coordinador']));

router.get('/', sancionesController.getSanciones);
router.post('/', sancionesController.createSancion);
router.put('/:id/perdonar', sancionesController.perdonarSancion);

module.exports = router;