const { logAudit } = require('../utils/auditLogger');
const reservaService = require('../services/reservaService');
const ServiceError = require('../services/serviceError');

function handleError(res, error, fnName, status = 500, body = { error: error.message }) {
  if (error instanceof ServiceError) {
    return res.status(error.status).json(error.body);
  }
  console.error(`Error en ${fnName}:`, error);
  return res.status(status).json(body);
}

function estadoInvalidoStatus(error) {
  return error.message?.includes('Estado de reserva invalido') ? 400 : 500;
}

const reservasController = {
  getReservas: async (req, res) => {
    try {
      res.json(await reservaService.listarReservas());
    } catch (error) {
      handleError(res, error, 'getReservas', 500, { error: `Error al obtener reservas: ${error.message}` });
    }
  },

  getReservaById: async (req, res) => {
    try {
      res.json(await reservaService.obtenerReserva(req.params.id));
    } catch (error) {
      handleError(res, error, 'getReservaById');
    }
  },

  createReserva: async (req, res) => {
    const { espacio_id, socio_id, fecha, hora_inicio, hora_fin, estado } = req.body;

    try {
      const reservaId = await reservaService.crearReserva({
        espacio_id,
        socio_id,
        fecha,
        hora_inicio,
        hora_fin,
        estado
      });
      await logAudit(req, {
        accion: 'crear_reserva',
        tabla_afectada: 'reservaciones',
        registro_id: reservaId,
        detalles: `Reserva creada para espacio ${espacio_id} y socio ${socio_id}`
      });

      res.status(201).json({ ok: true, id: reservaId, message: 'Reserva creada correctamente' });
    } catch (error) {
      handleError(res, error, 'createReserva', estadoInvalidoStatus(error));
    }
  },

  updateReserva: async (req, res) => {
    const { id } = req.params;

    try {
      const estado = await reservaService.actualizarReserva(id, req.body);
      await logAudit(req, {
        accion: 'actualizar_reserva',
        tabla_afectada: 'reservaciones',
        registro_id: id,
        detalles: `Reserva actualizada con estado ${estado}`
      });
      res.json({ ok: true, message: 'Reserva actualizada correctamente' });
    } catch (error) {
      handleError(res, error, 'updateReserva', estadoInvalidoStatus(error));
    }
  },

  cancelarReserva: async (req, res) => {
    const { id } = req.params;
    try {
      await reservaService.cancelarReserva(id);
      await logAudit(req, {
        accion: 'cancelar_reserva',
        tabla_afectada: 'reservaciones',
        registro_id: id,
        detalles: 'Reserva cancelada'
      });

      res.json({ ok: true, message: 'Reserva cancelada correctamente' });
    } catch (error) {
      handleError(res, error, 'cancelarReserva');
    }
  },

  deleteReserva: async (req, res) => {
    const { id } = req.params;
    try {
      await reservaService.eliminarReserva(id);
      await logAudit(req, {
        accion: 'eliminar_reserva',
        tabla_afectada: 'reservaciones',
        registro_id: id,
        detalles: 'Reserva eliminada permanentemente'
      });

      res.json({ ok: true, message: 'Reserva eliminada correctamente' });
    } catch (error) {
      handleError(res, error, 'deleteReserva');
    }
  },

  getDisponibilidad: async (req, res) => {
    try {
      res.json(await reservaService.obtenerDisponibilidad(Number(req.query.espacio_id)));
    } catch (error) {
      handleError(res, error, 'getDisponibilidad');
    }
  }
};

module.exports = reservasController;
