const express = require('express');
const router = express.Router();
const sesionesController = require('../controllers/sesionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas públicas para lectura (catálogo de clases)
router.get('/', sesionesController.getSesiones);
router.get('/dia/:dia', sesionesController.getSesionesPorDia);

// Rutas protegidas para modificación
router.post('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.createSesion);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.updateSesion);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), sesionesController.deleteSesion);

module.exports = router;