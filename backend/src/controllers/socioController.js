const { logAudit } = require('../utils/auditLogger');
const socioService = require('../services/socioService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

function handleError(res, error, fnName, body = { error: error.message }) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) {
    return res.status(error.status).json(error.body);
  }
  console.error(`Error en ${fnName}:`, error);
  return res.status(500).json(body);
}

const socioController = {
  // Obtener todos los socios CON JOIN a usuarios
  getSocios: async (req, res) => {
    try {
      res.json(await socioService.listarSocios());
    } catch (error) {
      handleError(res, error, 'getSocios', { error: 'Error al obtener socios: ' + error.message });
    }
  },

  getSocioById: async (req, res) => {
    try {
      res.json(await socioService.obtenerSocio(req.params.id));
    } catch (error) {
      handleError(res, error, 'getSocioById');
    }
  },

  createSocio: async (req, res) => {
    try {
      const { socioId, numeroSocio } = await socioService.crearSocio(req.body);
      await logAudit(req, {
        accion: 'crear_socio',
        tabla_afectada: 'socios',
        registro_id: socioId,
        detalles: `Socio creado con numero ${numeroSocio}`
      });
      res.json({ ok: true, message: 'Socio creado exitosamente' });
    } catch (error) {
      handleError(res, error, 'createSocio');
    }
  },

  updateSocio: async (req, res) => {
    const { id } = req.params;
    try {
      await socioService.actualizarSocio(id, req.body);
      await logAudit(req, {
        accion: 'actualizar_socio',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio actualizado'
      });
      res.json({ ok: true, message: 'Socio actualizado exitosamente' });
    } catch (error) {
      handleError(res, error, 'updateSocio');
    }
  },

  // Inactivar socio
  deleteSocio: async (req, res) => {
    const { id } = req.params;
    try {
      await socioService.cambiarActivoSocio(id, false);
      await logAudit(req, {
        accion: 'inactivar_socio',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio inactivado'
      });
      res.json({ ok: true, message: 'Socio inactivado correctamente' });
    } catch (error) {
      handleError(res, error, 'deleteSocio', { error: 'Error al inactivar socio' });
    }
  },

  deletePermanente: async (req, res) => {
    const { id } = req.params;
    try {
      await socioService.eliminarSocioPermanente(id);
      await logAudit(req, {
        accion: 'eliminar_socio_permanente',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio eliminado permanentemente'
      });
      res.json({ ok: true, message: 'Socio eliminado permanentemente' });
    } catch (error) {
      handleError(res, error, 'deletePermanente');
    }
  },

  reactivar: async (req, res) => {
    const { id } = req.params;
    try {
      await socioService.cambiarActivoSocio(id, true);
      await logAudit(req, {
        accion: 'reactivar_socio',
        tabla_afectada: 'socios',
        registro_id: id,
        detalles: 'Socio reactivado'
      });
      res.json({ ok: true, message: 'Socio reactivado correctamente' });
    } catch (error) {
      handleError(res, error, 'reactivar', { error: 'Error al reactivar socio' });
    }
  }
};

module.exports = socioController;
