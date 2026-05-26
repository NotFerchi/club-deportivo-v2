const express = require('express');
const router = express.Router();
const disciplinasController = require('../controllers/disciplinasController');

const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const adminRoles = ['admin', 'gerente'];

// CRUD de disciplinas
router.get('/', verifyToken, disciplinasController.getDisciplinas);
router.get('/:id', verifyToken, disciplinasController.getDisciplinaById);
router.post('/', verifyToken, checkRole(adminRoles), disciplinasController.createDisciplina);
router.put('/:id', verifyToken, checkRole(adminRoles), disciplinasController.updateDisciplina);
router.delete('/:id', verifyToken, checkRole(adminRoles), disciplinasController.deleteDisciplina);

module.exports = router;
