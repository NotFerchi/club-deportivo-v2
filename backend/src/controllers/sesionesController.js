const sesionService = require('../services/sesionService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

function handleError(res, error, fnName, message) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(`Error en ${fnName}:`, error);
  return res.status(500).json({ error: message });
}

const sesionesController = {
  getSesiones: async (req, res) => {
    try {
      res.json(await sesionService.listarSesiones(req.query));
    } catch (error) {
      handleError(res, error, 'getSesiones', 'Error al obtener sesiones');
    }
  },

  getSesionesPorDia: async (req, res) => {
    try {
      res.json(await sesionService.sesionesPorDia(req.params.dia));
    } catch (error) {
      handleError(res, error, 'getSesionesPorDia', 'Error al obtener sesiones por día');
    }
  },

  createSesion: async (req, res) => {
    try {
      const sesionId = await sesionService.crearSesion(req.body);
      res.status(201).json({ message: 'Sesión creada exitosamente', sesion_id: sesionId });
    } catch (error) {
      handleError(res, error, 'createSesion', 'Error al crear sesión');
    }
  },

  updateSesion: async (req, res) => {
    try {
      await sesionService.actualizarSesion(req.params.id, req.body);
      res.json({ message: 'Sesión actualizada correctamente' });
    } catch (error) {
      handleError(res, error, 'updateSesion', 'Error al actualizar sesión');
    }
  },

  deleteSesion: async (req, res) => {
    try {
      await sesionService.eliminarSesion(req.params.id);
      res.json({ message: 'Sesión eliminada correctamente' });
    } catch (error) {
      handleError(res, error, 'deleteSesion', 'Error al eliminar sesión');
    }
  }
};

module.exports = sesionesController;
