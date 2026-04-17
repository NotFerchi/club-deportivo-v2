const express = require('express');
const router = express.Router();

// Importamos todas las funciones (la que tenías + las 3 nuevas)
const { 
    crearUsuario,
    listarUsuarios, 
    actualizarUsuario, 
    cambiarEstadoUsuario 
} = require('../controllers/usuarios.controller');

const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Blindaje global: Todo lo que esté debajo de estas líneas exige token y rol admin
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente'])); // Solo admin e gerente pueden gestionar usuarios internos

// Tus rutas limpias y protegidas
router.post('/', crearUsuario);
router.get('/', listarUsuarios);
router.put('/:id', actualizarUsuario);
router.patch('/:id/estado', cambiarEstadoUsuario);

module.exports = router;
