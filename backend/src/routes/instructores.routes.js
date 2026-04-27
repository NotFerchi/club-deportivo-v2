const express = require('express');
const router = express.Router();
const instructoresController = require('../controllers/instructoresController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas públicas para lectura (catálogo de clases)
router.get('/', instructoresController.getInstructores);
router.get('/:id', instructoresController.getInstructorById);

// Rutas protegidas para modificación
router.post('/', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), instructoresController.createInstructor);
router.put('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), instructoresController.updateInstructor);
router.delete('/:id', verifyToken, checkRole(['admin', 'gerente', 'coordinador']), instructoresController.deleteInstructor);

module.exports = router;