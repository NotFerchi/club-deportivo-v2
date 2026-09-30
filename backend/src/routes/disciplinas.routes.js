const express = require('express');
const router = express.Router();
const disciplinasController = require('../controllers/disciplinasController');

const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { requireFields } = require('../middleware/validators');

const nombreRequerido = requireFields(['nombre'], { message: 'El nombre es requerido' });

const adminRoles = ['admin', 'gerente'];

// CRUD de disciplinas
router.get('/', verifyToken, disciplinasController.getDisciplinas);
router.get('/:id', verifyToken, disciplinasController.getDisciplinaById);
router.post('/', verifyToken, checkRole(adminRoles), nombreRequerido, disciplinasController.createDisciplina);
router.put('/:id', verifyToken, checkRole(adminRoles), nombreRequerido, disciplinasController.updateDisciplina);
router.delete('/:id', verifyToken, checkRole(adminRoles), disciplinasController.deleteDisciplina);

module.exports = router;
