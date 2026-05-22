const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const multer = require('multer');

const adminRoles = ['admin', 'gerente'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// Ruta pública para foto de perfil — cualquier usuario autenticado
router.put('/me/foto', verifyToken, upload.single('foto'), usuariosController.actualizarFotoPerfil);
router.get('/me/perfil', verifyToken, usuariosController.getMiPerfil);

// Rutas de admin
router.use(verifyToken, checkRole(adminRoles));
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