const express = require('express');
const router = express.Router();
const controller = require('../controllers/espaciosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

router.get('/todos', verifyToken, controller.getEspacios);
router.get('/disciplinas', verifyToken, controller.getDisciplinas);
router.get('/:id', verifyToken, controller.getEspacioById);
router.post('/', verifyToken, checkRole(['admin']), controller.createEspacio);
router.put('/:id', verifyToken, checkRole(['admin']), controller.updateEspacio);
router.delete('/:id', verifyToken, checkRole(['admin']), controller.deleteEspacio);

module.exports = router;
