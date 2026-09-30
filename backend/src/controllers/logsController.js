const logService = require('../services/logService');
const { logAudit } = require('../utils/auditLogger');

const logsController = {
  createLog: async (req, res) => {
    // accion requerida: validada en la ruta
    const { accion, tabla_afectada, detalles, registro_id } = req.body || {};

    await logAudit(req, {
      accion,
      tabla_afectada,
      detalles,
      registro_id
    });

    res.status(201).json({ ok: true, message: 'Log registrado' });
  },

  getLogs: async (req, res) => {
    try {
      res.json(await logService.listarLogs(req.query));
    } catch (error) {
      console.error('Error en getLogs:', error);
      res.status(500).json({ error: 'Error al obtener logs' });
    }
  },

  getLogsByTabla: async (req, res) => {
    try {
      res.json(await logService.logsPorTabla(req.params.tabla));
    } catch (error) {
      console.error('Error en getLogsByTabla:', error);
      res.status(500).json({ error: 'Error al obtener logs por tabla' });
    }
  },

  getLogsEstadisticas: async (req, res) => {
    try {
      res.json(await logService.estadisticasLogs());
    } catch (error) {
      console.error('Error en getLogsEstadisticas:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas de logs' });
    }
  }
};

module.exports = logsController;
