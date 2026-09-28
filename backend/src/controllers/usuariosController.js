const usuarioService = require('../services/usuarioService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

function handleError(res, error, fnName, message) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) {
    return res.status(error.status).json(error.body);
  }
  console.error(`Error en ${fnName}:`, error);
  return res.status(500).json({ error: message });
}

const usuariosController = {
  getUsuarios: async (req, res) => {
    try {
      res.json(await usuarioService.listarUsuarios());
    } catch (error) {
      handleError(res, error, 'getUsuarios', 'Error al obtener usuarios');
    }
  },

  getUsuarioById: async (req, res) => {
    try {
      res.json(await usuarioService.obtenerUsuario(req.params.id));
    } catch (error) {
      handleError(res, error, 'getUsuarioById', 'Error al obtener usuario');
    }
  },

  createUsuario: async (req, res) => {
    try {
      const { usuario_id, password } = await usuarioService.crearUsuario(req.body);
      res.status(201).json({ message: 'Usuario creado', usuario_id, password });
    } catch (error) {
      handleError(res, error, 'createUsuario', 'Error al crear usuario');
    }
  },

  updateUsuario: async (req, res) => {
    try {
      await usuarioService.actualizarUsuario(req.params.id, req.body);
      res.json({ message: 'Usuario actualizado correctamente' });
    } catch (error) {
      handleError(res, error, 'updateUsuario', 'Error al actualizar usuario');
    }
  },

  // Baja lógica
  deleteUsuario: async (req, res) => {
    try {
      await usuarioService.cambiarActivo(req.params.id, false);
      res.json({ message: 'Usuario eliminado (inactivo)' });
    } catch (error) {
      handleError(res, error, 'deleteUsuario', 'Error al eliminar usuario');
    }
  },

  getRoles: async (req, res) => {
    try {
      res.json(await usuarioService.listarRoles());
    } catch (error) {
      handleError(res, error, 'getRoles', 'Error al obtener roles');
    }
  },

  desactivarUsuario: async (req, res) => {
    try {
      await usuarioService.cambiarActivo(req.params.id, false);
      res.json({ message: 'Usuario desactivado' });
    } catch (error) {
      handleError(res, error, 'desactivarUsuario', 'Error al desactivar usuario');
    }
  },

  reactivarUsuario: async (req, res) => {
    try {
      await usuarioService.cambiarActivo(req.params.id, true);
      res.json({ message: 'Usuario reactivado' });
    } catch (error) {
      handleError(res, error, 'reactivarUsuario', 'Error al reactivar usuario');
    }
  },

  deleteUsuarioPermanente: async (req, res) => {
    try {
      await usuarioService.eliminarPermanente(req.params.id);
      res.json({ message: 'Usuario eliminado definitivamente' });
    } catch (error) {
      handleError(res, error, 'deleteUsuarioPermanente', 'Error al eliminar definitivamente el usuario');
    }
  },

  getMiPerfil: async (req, res) => {
    try {
      res.json(await usuarioService.obtenerPerfil(req.user.usuario_id));
    } catch (error) {
      handleError(res, error, 'getMiPerfil', 'Error interno del servidor');
    }
  },

  actualizarFotoPerfil: async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Se requiere una imagen' });

      const fotoPerfil = await usuarioService.actualizarFotoPerfil(req.user.usuario_id, req.file);
      res.json({
        ok: true,
        message: 'Foto de perfil actualizada correctamente',
        foto_perfil: fotoPerfil
      });
    } catch (error) {
      handleError(res, error, 'actualizarFotoPerfil', 'Error interno del servidor');
    }
  }
};

module.exports = usuariosController;
