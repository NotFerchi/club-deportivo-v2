const instructorService = require('../services/instructorService');
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

const instructoresController = {
  getInstructores: async (req, res) => {
    try {
      res.json(await instructorService.listarInstructores());
    } catch (error) {
      handleError(res, error, 'getInstructores', 'Error al obtener instructores');
    }
  },

  getInstructorById: async (req, res) => {
    try {
      res.json(await instructorService.obtenerInstructor(req.params.id));
    } catch (error) {
      handleError(res, error, 'getInstructorById', 'Error al obtener instructor');
    }
  },

  createInstructor: async (req, res) => {
    try {
      const instructorId = await instructorService.crearInstructor(req.body);
      res.status(201).json({ message: 'Instructor creado', instructor_id: instructorId });
    } catch (error) {
      handleError(res, error, 'createInstructor', 'Error al crear instructor');
    }
  },

  updateInstructor: async (req, res) => {
    try {
      await instructorService.actualizarInstructor(req.params.id, req.body);
      res.json({ message: 'Instructor actualizado correctamente' });
    } catch (error) {
      handleError(res, error, 'updateInstructor', 'Error al actualizar instructor');
    }
  },

  deleteInstructor: async (req, res) => {
    try {
      await instructorService.eliminarInstructor(req.params.id);
      res.json({ message: 'Instructor eliminado correctamente' });
    } catch (error) {
      handleError(res, error, 'deleteInstructor', 'Error al eliminar instructor');
    }
  }
};

module.exports = instructoresController;
