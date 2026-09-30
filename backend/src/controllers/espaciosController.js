const espacioService = require('../services/espacioService');
const disciplinaService = require('../services/disciplinaService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');
const { logAudit } = require('../utils/auditLogger');

function handleError(res, error, fnName, message) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(`Error en ${fnName}:`, error);
  return res.status(500).json({ error: message });
}

const MENSAJE_ESTADO = {
  Activo: 'reactivado',
  Mantenimiento: 'puesto en mantenimiento'
};

const espaciosController = {
  getEspacios: async (req, res) => {
    try {
      res.json(await espacioService.listarEspacios());
    } catch (error) {
      handleError(res, error, 'getEspacios', 'Error al obtener espacios');
    }
  },

  getEspacioById: async (req, res) => {
    try {
      res.json(await espacioService.obtenerEspacio(req.params.id));
    } catch (error) {
      handleError(res, error, 'getEspacioById', 'Error al obtener espacio');
    }
  },

  createEspacio: async (req, res) => {
    try {
      const { id, nombre } = await espacioService.crearEspacio(req.body);
      await logAudit(req, {
        accion: 'crear_espacio',
        tabla_afectada: 'espacios',
        registro_id: id,
        detalles: `Espacio creado: ${nombre}`
      });
      res.json({ ok: true, id, message: 'Espacio creado correctamente' });
    } catch (error) {
      handleError(res, error, 'createEspacio', 'Error al crear espacio');
    }
  },

  updateEspacio: async (req, res) => {
    const { id } = req.params;
    try {
      const nombre = await espacioService.actualizarEspacio(id, req.body);
      await logAudit(req, {
        accion: 'actualizar_espacio',
        tabla_afectada: 'espacios',
        registro_id: id,
        detalles: `Espacio actualizado: ${nombre}`
      });
      res.json({ ok: true, message: 'Espacio actualizado correctamente' });
    } catch (error) {
      handleError(res, error, 'updateEspacio', 'Error al actualizar espacio');
    }
  },

  // PATCH /espacios/:id/estado — toggle mantenimiento / activar / inactivar
  toggleEstado: async (req, res) => {
    const { id } = req.params;
    try {
      const { estadoAnterior, estadoFinal, motivo } = await espacioService.cambiarEstado(
        id,
        req.body,
        req.user?.usuario_id
      );
      await logAudit(req, {
        accion: 'cambiar_estado_espacio',
        tabla_afectada: 'espacios',
        registro_id: id,
        detalles: `Estado cambiado de ${estadoAnterior} a ${estadoFinal}${motivo ? ` — motivo: ${motivo}` : ''}`
      });
      res.json({
        ok: true,
        estado: estadoFinal,
        message: `Espacio ${MENSAJE_ESTADO[estadoFinal] || 'inactivado'} correctamente`
      });
    } catch (error) {
      handleError(res, error, 'toggleEstado', 'Error al cambiar estado del espacio');
    }
  },

  getMantenimientoHistorial: async (req, res) => {
    try {
      res.json(await espacioService.historialMantenimiento(req.params.id));
    } catch (error) {
      console.error('Error en getMantenimientoHistorial:', error);
      if (error?.code === '42P01') return res.json([]);
      res.status(500).json({
        error: 'Error al obtener historial de mantenimiento',
        pg_code: error?.code,
        detail: error?.message
      });
    }
  },

  deleteEspacio: async (req, res) => {
    const { id } = req.params;
    try {
      await espacioService.eliminarEspacio(id);
      await logAudit(req, {
        accion: 'eliminar_espacio',
        tabla_afectada: 'espacios',
        registro_id: id,
        detalles: 'Espacio eliminado'
      });
      res.json({ ok: true, message: 'Espacio eliminado correctamente' });
    } catch (error) {
      handleError(res, error, 'deleteEspacio', 'Error al eliminar espacio');
    }
  },

  getDisciplinas: async (req, res) => {
    try {
      res.json(await disciplinaService.listarDisciplinas());
    } catch (error) {
      handleError(res, error, 'getDisciplinas', 'Error al obtener disciplinas');
    }
  }
};

module.exports = espaciosController;
