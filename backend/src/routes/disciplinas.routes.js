const express = require('express');
const router = express.Router();
const disciplinasController = require('../controllers/disciplinasController');

const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// CRUD de disciplinas
router.get('/', verifyToken, disciplinasController.getDisciplinas);
router.get('/:id', verifyToken, disciplinasController.getDisciplinaById);
router.post('/', verifyToken, checkRole(['admin']), disciplinasController.createDisciplina);
router.put('/:id', verifyToken, checkRole(['admin']), disciplinasController.updateDisciplina);
router.delete('/:id', verifyToken, checkRole(['admin']), disciplinasController.deleteDisciplina);

module.exports = router;
