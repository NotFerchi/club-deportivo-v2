const panel = require('../services/instructorPanelService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

/**
 * Escalado → errorHandler; ServiceError → su respuesta.
 * Si no: se registra `Error en ${fnName}:` (si hay fnName) y responde 500 con el mensaje y,
 * salvo `sinDetalle`, el error.message como `detalle`.
 */
function handleError(res, error, fnName, message, { sinDetalle = false } = {}) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  if (fnName) console.error(`Error en ${fnName}:`, error);
  return res.status(500).json(sinDetalle ? { error: message } : { error: message, detalle: error.message });
}

const instructorController = {
  getClasesPorFecha: async (req, res) => {
    const { fecha } = req.query; // requerida: validada en la ruta
    const usuarioId = req.user.usuario_id;

    try {
      res.json(await panel.clasesPorFecha(usuarioId, fecha));
    } catch (error) {
      handleError(res, error, 'getClasesPorFecha', 'Error al obtener clases');
    }
  },

  getAlumnosPorClase: async (req, res) => {
    try {
      res.json(await panel.alumnosPorClase(req.params.sesionId, req.query.fecha));
    } catch (error) {
      handleError(res, error, 'getAlumnosPorClase', 'Error al obtener alumnos');
    }
  },

  registrarAsistencia: async (req, res) => {
    const { sesionId, socioId, fecha, presente } = req.body;
    const usuarioId = req.user.usuario_id;

    try {
      await panel.registrarAsistencia({ sesionId, socioId, fecha, presente }, usuarioId, req.ip);
      res.json({ message: 'Asistencia registrada correctamente' });
    } catch (error) {
      handleError(res, error, 'registrarAsistencia', 'Error al registrar asistencia');
    }
  },

  getMisClases: async (req, res) => {
    const usuarioId = req.user.usuario_id;
    try {
      res.json(await panel.misClases(usuarioId));
    } catch (error) {
      handleError(res, error, 'getMisClases', 'Error al obtener clases');
    }
  },

  getMetricas: async (req, res) => {
    const usuarioId = req.user.usuario_id;
    try {
      res.json(await panel.metricas(usuarioId));
    } catch (error) {
      handleError(res, error, 'getMetricas', 'Error al obtener métricas');
    }
  },

  getClasesGeneral: async (req, res) => {
    const consulta = panel.resolverDiaConsulta(req.query.fecha);
    try {
      res.json(await panel.clasesGeneral(consulta));
    } catch (error) {
      handleError(res, error, 'getClasesGeneral', 'Error al obtener clases');
    }
  },

  getInscritosPorSesion: async (req, res) => {
    try {
      res.json(await panel.inscritosPorSesion(req.params.sesionId, req.query.fecha || null));
    } catch (error) {
      handleError(res, error, 'getInscritosPorSesion', 'Error al obtener inscritos', { sinDetalle: true });
    }
  },

  getTorneos: async (req, res) => {
    try {
      res.json(await panel.listarTorneos());
    } catch (error) {
      handleError(res, error, null, 'Error al obtener torneos');
    }
  },

  getEncuentros: async (req, res) => {
    try {
      res.json(await panel.encuentrosDeTorneo(req.params.torneoId));
    } catch (error) {
      handleError(res, error, null, 'Error al obtener encuentros');
    }
  },

  inscribirSocioClase: async (req, res) => {
    try {
      // Campos requeridos: validados en la ruta
      const reservaId = await panel.inscribirEnClase(req.body);
      res.status(201).json({ ok: true, reserva_id: reservaId });
    } catch (error) {
      handleError(res, error, 'inscribirSocioClase', 'Error al inscribir socio');
    }
  },

  registrarGanador: async (req, res) => {
    const { ganador } = req.body;
    try {
      await panel.registrarGanador(req.params.encuentroId, ganador);
      res.json({ message: 'Ganador registrado correctamente' });
    } catch (error) {
      handleError(res, error, null, 'Error al registrar ganador');
    }
  }
};

module.exports = instructorController;
