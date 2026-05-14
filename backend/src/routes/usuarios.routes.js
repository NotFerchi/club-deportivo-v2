const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const adminRoles = ['admin', 'gerente'];

router.use(verifyToken);
router.use(checkRole(adminRoles));

router.get('/', usuariosController.getUsuarios);
router.get('/roles', usuariosController.getRoles);
router.get('/:id', usuariosController.getUsuarioById);
router.post('/', usuariosController.createUsuario);
router.put('/:id', usuariosController.updateUsuario);
router.put('/:id/desactivar', usuariosController.desactivarUsuario);
router.put('/:id/reactivar', usuariosController.reactivarUsuario);
router.delete('/:id', usuariosController.deleteUsuario);
router.delete('/:id/permanente', usuariosController.deleteUsuarioPermanente);

module.exports = router;
