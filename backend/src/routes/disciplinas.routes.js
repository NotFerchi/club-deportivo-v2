const express = require('express');
const router = express.Router();
const disciplinasController = require('../controllers/disciplinasController');
const { verifyToken } = require('../middleware/auth.middleware');

// CRUD de disciplinas
router.get('/', verifyToken, disciplinasController.getDisciplinas);
router.get('/:id', verifyToken, disciplinasController.getDisciplinaById);
router.post('/', verifyToken, disciplinasController.createDisciplina);
router.put('/:id', verifyToken, disciplinasController.updateDisciplina);
router.delete('/:id', verifyToken, disciplinasController.deleteDisciplina);

module.exports = router;