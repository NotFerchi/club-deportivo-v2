const express = require('express');
const router = express.Router();
const espaciosController = require('../controllers/espaciosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Rutas GET
router.get('/todos', verifyToken, espaciosController.getEspacios);
router.get('/', verifyToken, espaciosController.getEspacios);

// Rutas protegidas
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente']));

router.get('/:id', espaciosController.getEspacioById);
router.post('/', espaciosController.createEspacio);
router.put('/:id', espaciosController.updateEspacio);
router.delete('/:id', espaciosController.deleteEspacio);

module.exports = router;