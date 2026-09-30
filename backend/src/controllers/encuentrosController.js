const encuentroService = require('../services/encuentroService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

function handleError(res, error, logMessage) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(logMessage, error);
  return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
}

const encuentrosController = {
  registrarResultado: async (req, res) => {
    try {
      return res.json(await encuentroService.registrarResultado(req.user, req.params.encuentro_id, req.body));
    } catch (error) {
      return handleError(res, error, 'Error al registrar resultado:');
    }
  },

  asignarCancha: async (req, res) => {
    try {
      const encuentro = await encuentroService.asignarCancha(req.params.encuentro_id, req.body);
      return res.json({ ok: true, message: 'Cancha asignada correctamente', encuentro });
    } catch (error) {
      return handleError(res, error, 'Error al asignar cancha:');
    }
  },

  updateEncuentro: async (req, res) => {
    try {
      const encuentro = await encuentroService.actualizarParticipantes(req.params.encuentro_id, req.body);
      return res.json({ ok: true, message: 'Encuentro actualizado correctamente', encuentro });
    } catch (error) {
      return handleError(res, error, 'Error al actualizar encuentro:');
    }
  }
};

module.exports = encuentrosController;
