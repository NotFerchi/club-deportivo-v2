const express = require('express');
const router = express.Router();
const espaciosController = require('../controllers/espaciosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas públicas (con autenticación pero sin rol específico)
router.get('/disponibles', verifyToken, espaciosController.getEspaciosDisponibles);

// Rutas protegidas solo para admin/gerente
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente']));

router.get('/', espaciosController.getEspacios);
router.get('/todos', espaciosController.getEspacios);
router.get('/:id', espaciosController.getEspacioById);
router.post('/', espaciosController.createEspacio);
router.put('/:id', espaciosController.updateEspacio);
router.delete('/:id', espaciosController.deleteEspacio);

module.exports = router;