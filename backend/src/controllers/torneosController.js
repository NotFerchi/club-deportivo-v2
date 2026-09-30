const torneoService = require('../services/torneoService');
const participanteService = require('../services/participanteService');
const bracketService = require('../services/bracketService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');
const {
  ERROR_DISCIPLINA_NO_EXISTE,
  ERROR_FECHAS_TORNEO,
  ERROR_PARTICIPANTE_DUPLICADO
} = require('../services/torneoComun');

/**
 * Respuesta de error común: ServiceError → su status/cuerpo; errores escalados → errorHandler;
 * el resto se registra y, si `pgErrors[code]` existe, responde ese [status, mensaje]; si no, 500.
 */
function handleError(res, error, logMessage, message, pgErrors = {}) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(logMessage, error);
  const mapped = pgErrors[error.code];
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
  return res.status(500).json({ error: message });
}

// Errores de PostgreSQL al guardar un torneo (INSERT / UPDATE).
const PG_ERRORES_TORNEO = {
  23514: [400, ERROR_FECHAS_TORNEO],
  23503: [400, ERROR_DISCIPLINA_NO_EXISTE],
  22007: [400, 'Formato de fecha invalido'],
  22008: [400, 'Formato de fecha invalido']
};

// Errores de PostgreSQL al inscribir participantes.
const PG_ERRORES_INSCRIPCION = {
  23505: [409, ERROR_PARTICIPANTE_DUPLICADO],
  23503: [400, 'Referencia no encontrada']
};

const torneosController = {
  getTorneos: async (req, res) => {
    try {
      res.json(await torneoService.listarTorneos(req.query));
    } catch (error) {
      handleError(res, error, 'Error al obtener torneos:', 'Error al obtener torneos');
    }
  },

  createTorneo: async (req, res) => {
    try {
      const torneoId = await torneoService.crearTorneo(req.body);
      res.status(201).json({ torneo_id: torneoId });
    } catch (error) {
      handleError(res, error, 'Error al crear torneo:', 'Error al crear torneo', PG_ERRORES_TORNEO);
    }
  },

  updateTorneo: async (req, res) => {
    try {
      const torneoId = await torneoService.actualizarTorneo(req.params.torneo_id, req.body);
      res.json({ ok: true, torneo_id: torneoId, message: 'Torneo actualizado correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al actualizar torneo:', 'Error al actualizar torneo', PG_ERRORES_TORNEO);
    }
  },

  getParticipantes: async (req, res) => {
    try {
      res.json(await participanteService.listarParticipantes(req.params.torneo_id));
    } catch (error) {
      handleError(res, error, 'Error al obtener participantes:', 'Error al obtener participantes del torneo');
    }
  },

  inscribirParticipante: async (req, res) => {
    try {
      const participanteId = await participanteService.inscribirParticipante(req.params.torneo_id, req.body);
      res.status(201).json({ participante_id: participanteId });
    } catch (error) {
      handleError(
        res,
        error,
        'Error al inscribir participante en torneo:',
        'Error al inscribir participante en torneo',
        PG_ERRORES_INSCRIPCION
      );
    }
  },

  cerrarInscripciones: async (req, res) => {
    try {
      await bracketService.cerrarInscripciones(req.params.torneo_id);
      res.json({ message: 'Inscripciones cerradas y bracket generado' });
    } catch (error) {
      handleError(res, error, 'Error al cerrar inscripciones:', 'Error al cerrar inscripciones');
    }
  },

  confirmarBracket: async (req, res) => {
    try {
      await bracketService.confirmarBracket(req.params.torneo_id);
      res.json({ message: 'Bracket confirmado' });
    } catch (error) {
      handleError(res, error, 'Error al confirmar bracket:', 'Error al confirmar bracket');
    }
  },

  getReporte: async (req, res) => {
    try {
      return res.json(await torneoService.obtenerReporte(req.params.torneo_id));
    } catch (error) {
      return handleError(res, error, 'Error al obtener reporte de torneo:', 'Error al obtener el reporte');
    }
  },

  getCategorias: async (req, res) => {
    try {
      res.json(await torneoService.listarCategorias());
    } catch (error) {
      handleError(res, error, 'Error al obtener categorías:', 'Error al obtener categorías');
    }
  },

  // Auto-inscripción del socio autenticado (sin requerir rol staff)
  inscribirSocioPropio: async (req, res) => {
    try {
      const participanteId = await participanteService.inscribirSocioPropio(req.params.torneo_id, req.user);
      res.status(201).json({ participante_id: participanteId });
    } catch (error) {
      handleError(
        res,
        error,
        'Error al inscribir socio en torneo:',
        'Error al inscribirse en el torneo',
        PG_ERRORES_INSCRIPCION
      );
    }
  },

  // Desinscribir a un participante (solo staff: admin, gerente, coordinador)
  desinscribirParticipante: async (req, res) => {
    try {
      await participanteService.desinscribirParticipante(req.params.torneo_id, req.params.participante_id);
      res.json({ ok: true, message: 'Participante desinscrito correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al desinscribir participante:', 'Error al desinscribir participante');
    }
  },

  getMisParticipaciones: async (req, res) => {
    try {
      res.json(await participanteService.misParticipaciones(req.user));
    } catch (error) {
      handleError(res, error, 'Error al obtener participaciones:', 'Error al obtener participaciones');
    }
  },

  getBracket: async (req, res) => {
    try {
      res.json(await bracketService.obtenerBracket(req.params.torneo_id));
    } catch (error) {
      handleError(res, error, 'Error al obtener bracket:', 'Error al obtener bracket');
    }
  },

  finalizarTorneo: async (req, res) => {
    try {
      await torneoService.finalizarTorneo(req.params.torneo_id);
      res.json({ ok: true, message: 'Torneo finalizado correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al finalizar torneo:', 'Error interno del servidor');
    }
  },

  cancelarTorneo: async (req, res) => {
    try {
      await torneoService.cancelarTorneo(req.params.torneo_id);
      res.json({ ok: true, message: 'Torneo cancelado correctamente' });
    } catch (error) {
      handleError(res, error, 'Error al cancelar torneo:', 'Error interno del servidor');
    }
  }
};

module.exports = torneosController;
