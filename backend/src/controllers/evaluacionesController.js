const evaluacionService = require('../services/evaluacionService');
const ServiceError = require('../services/serviceError');
const { logAudit } = require('../utils/auditLogger');

/**
 * Respuesta de error común: ServiceError → su status/cuerpo; el resto se registra y responde 500
 * con un mensaje genérico (nunca detalles de la BD).
 */
function handleError(res, error, logMessage, message) {
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(logMessage, error);
  return res.status(500).json({ error: message });
}

const evaluacionesController = {
  crearEvaluacion: async (req, res) => {
    try {
      const evaluacion = await evaluacionService.crearEvaluacion(req.user.usuario_id, req.body ?? {});
      await logAudit(req, {
        accion: 'crear_evaluacion_instructor',
        tabla_afectada: 'evaluaciones_instructor',
        registro_id: evaluacion.evaluacion_id,
        detalles: {
          sesion_id: evaluacion.sesion_id,
          instructor_id: evaluacion.instructor_id,
          periodo: evaluacion.periodo
        }
      });
      res.status(201).json(evaluacion);
    } catch (error) {
      handleError(res, error, 'Error al crear evaluación:', 'Error al registrar la evaluación');
    }
  },

  listarPorInstructor: async (req, res) => {
    try {
      res.json(await evaluacionService.listarPorInstructor(req.user, req.params.instructor_id, req.query.periodo));
    } catch (error) {
      handleError(res, error, 'Error al listar evaluaciones:', 'Error al obtener las evaluaciones');
    }
  },

  promedioDeInstructor: async (req, res) => {
    try {
      res.json(await evaluacionService.promedioDeInstructor(req.user, req.params.instructor_id, req.query.periodo));
    } catch (error) {
      handleError(res, error, 'Error al calcular promedio de evaluaciones:', 'Error al obtener el promedio');
    }
  },

  misEvaluaciones: async (req, res) => {
    try {
      res.json(await evaluacionService.misEvaluaciones(req.user.usuario_id, req.query.periodo));
    } catch (error) {
      handleError(res, error, 'Error al listar mis evaluaciones:', 'Error al obtener tus evaluaciones');
    }
  }
};

module.exports = evaluacionesController;
