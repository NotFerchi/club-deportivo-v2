const express = require('express');
const router = express.Router();
const instructoresController = require('../controllers/instructoresController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Solo coordinador, admin y gerente pueden modificar
router.get('/', instructoresController.getInstructores);
router.get('/:id', instructoresController.getInstructorById);
router.post('/', checkRole(['admin', 'gerente', 'coordinador']), instructoresController.createInstructor);
router.put('/:id', checkRole(['admin', 'gerente', 'coordinador']), instructoresController.updateInstructor);
router.delete('/:id', checkRole(['admin', 'gerente', 'coordinador']), instructoresController.deleteInstructor);

module.exports = router;