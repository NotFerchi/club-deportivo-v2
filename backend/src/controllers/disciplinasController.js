const disciplinaService = require('../services/disciplinaService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');
const { logAudit } = require('../utils/auditLogger');

/** Escalado → errorHandler; ServiceError → su respuesta; si no, se registra y responde 400 por nombre duplicado (23505) o 500. */
function handleError(res, error, message, { duplicado = false } = {}) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(error);
  if (duplicado && error.code === '23505') {
    return res.status(400).json({ error: 'Ya existe una disciplina con ese nombre' });
  }
  return res.status(500).json({ error: message });
}

const disciplinasController = {
  // Obtener todas las disciplinas
  getDisciplinas: async (req, res) => {
    try {
      res.json(await disciplinaService.listarDisciplinas());
    } catch (error) {
      handleError(res, error, 'Error al obtener disciplinas');
    }
  },

  // Obtener una disciplina por ID
  getDisciplinaById: async (req, res) => {
    try {
      res.json(await disciplinaService.obtenerDisciplina(req.params.id));
    } catch (error) {
      handleError(res, error, 'Error al obtener disciplina');
    }
  },

  // Crear nueva disciplina
  createDisciplina: async (req, res) => {
    try {
      const nombre = disciplinaService.nombreRequerido(req.body);
      const id = await disciplinaService.crearDisciplina(nombre);
      await logAudit(req, {
        accion: 'crear_disciplina',
        tabla_afectada: 'disciplinas',
        registro_id: id,
        detalles: `Disciplina creada: ${nombre}`
      });
      res.json({ ok: true, id, message: 'Disciplina creada correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al crear disciplina', { duplicado: true });
    }
  },

  // Actualizar disciplina
  updateDisciplina: async (req, res) => {
    const { id } = req.params;
    try {
      const nombre = disciplinaService.nombreRequerido(req.body);
      await disciplinaService.actualizarDisciplina(id, nombre);
      await logAudit(req, {
        accion: 'actualizar_disciplina',
        tabla_afectada: 'disciplinas',
        registro_id: id,
        detalles: `Disciplina actualizada: ${nombre}`
      });
      res.json({ ok: true, message: 'Disciplina actualizada correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al actualizar disciplina', { duplicado: true });
    }
  },

  // Eliminar disciplina (si ningún espacio la usa)
  deleteDisciplina: async (req, res) => {
    const { id } = req.params;
    try {
      await disciplinaService.eliminarDisciplina(id);
      await logAudit(req, {
        accion: 'eliminar_disciplina',
        tabla_afectada: 'disciplinas',
        registro_id: id,
        detalles: 'Disciplina eliminada'
      });
      res.json({ ok: true, message: 'Disciplina eliminada correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al eliminar disciplina');
    }
  }
};

module.exports = disciplinasController;
