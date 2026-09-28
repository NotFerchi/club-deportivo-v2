const sancionService = require('../services/sancionService');
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

const sancionesController = {
  getSanciones: async (req, res) => {
    try {
      res.json(await sancionService.listarSanciones(req.query));
    } catch (error) {
      // Filtros inválidos llegan como Error con status 400 (se registran igual que antes).
      console.error('Error en getSanciones:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Error al obtener sanciones' });
    }
  },

  getSancionById: async (req, res) => {
    try {
      res.json(await sancionService.obtenerSancion(req.params.id));
    } catch (error) {
      handleError(res, error, 'getSancionById', 'Error al obtener sancion');
    }
  },

  getSancionesBySocio: async (req, res) => {
    try {
      const socioId = await sancionService.autorizarConsultaSocio(req.user, req.params.socioId);
      res.json(await sancionService.sancionesDeSocio(socioId));
    } catch (error) {
      handleError(res, error, 'getSancionesBySocio', 'Error al obtener sanciones');
    }
  },

  verificarSancionActiva: async (req, res) => {
    try {
      const socioId = await sancionService.autorizarConsultaSocio(req.user, req.params.socioId);
      res.json({ tiene_sancion: await sancionService.tieneSancionActiva(socioId) });
    } catch (error) {
      handleError(res, error, 'verificarSancionActiva', 'Error al verificar sancion');
    }
  },

  getHistorialCompletoSocio: async (req, res) => {
    try {
      const socioId = await sancionService.autorizarConsultaSocio(req.user, req.params.socio_id);
      res.json(await sancionService.historialCompletoSocio(socioId));
    } catch (error) {
      handleError(res, error, 'getHistorialCompletoSocio', 'Error al obtener historial de sanciones del socio');
    }
  },

  createSancion: async (req, res) => {
    try {
      const { sancionId, gravedad, fechaFin } = await sancionService.crearSancion(req.body);
      res.status(201).json({ message: 'Sancion creada', sancion_id: sancionId, gravedad, fecha_fin: fechaFin });
    } catch (error) {
      handleError(res, error, 'createSancion', 'Error al crear sancion');
    }
  },

  updateSancion: async (req, res) => {
    try {
      await sancionService.actualizarSancion(req.params.id, req.body, req.user);
      res.json({ message: 'Sancion actualizada' });
    } catch (error) {
      handleError(res, error, 'updateSancion', 'Error al actualizar sancion');
    }
  },

  deleteSancion: async (req, res) => {
    try {
      await sancionService.eliminarSancion(req.params.id);
      res.json({ message: 'Sancion eliminada' });
    } catch (error) {
      handleError(res, error, 'deleteSancion', 'Error al eliminar sancion');
    }
  },

  perdonarSancion: async (req, res) => {
    return sancionesController.levantarSancion(req, res);
  },

  levantarSancion: async (req, res) => {
    try {
      await sancionService.levantarSancion(req.params.id, req.user);
      res.json({ message: 'Sancion levantada' });
    } catch (error) {
      handleError(res, error, 'levantarSancion', 'Error al levantar sancion');
    }
  },

  resolverSancion: async (req, res) => {
    try {
      res.json(await sancionService.resolverSancion(req.params.sancion_id, req.user));
    } catch (error) {
      handleError(res, error, 'resolverSancion', 'Error al resolver sanción');
    }
  },

  sincronizarNoShows: async (req, res) => {
    try {
      const creadas = await sancionService.sincronizarNoShows();
      res.json({ ok: true, creadas, message: `No-shows sincronizados. Sanciones creadas: ${creadas}` });
    } catch (error) {
      handleError(res, error, 'sincronizarNoShows', 'Error al sincronizar no-shows');
    }
  }
};

module.exports = sancionesController;
