const express = require('express');
const router = express.Router();
const controller = require('../controllers/espaciosController');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/todos', verifyToken, controller.getEspacios);
router.get('/disciplinas', verifyToken, controller.getDisciplinas);
router.get('/:id', verifyToken, controller.getEspacioById);
router.post('/', verifyToken, controller.createEspacio);
router.put('/:id', verifyToken, controller.updateEspacio);
router.delete('/:id', verifyToken, controller.deleteEspacio);

module.exports = router;