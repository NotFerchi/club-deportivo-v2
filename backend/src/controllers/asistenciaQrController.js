const asistenciaQrService = require('../services/asistenciaQrService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

const sendError = (res, status, message) => res.status(status).json({ error: message });

const asistenciaQrController = {
  registrarAsistenciaQr: async (req, res) => {
    let lectura;
    try {
      lectura = asistenciaQrService.validarLectura(req.params.sesion_id, req.body);
    } catch (error) {
      if (error instanceof ServiceError) return res.status(error.status).json(error.body);
      throw error;
    }

    try {
      const resultado = await asistenciaQrService.registrarAsistencia(lectura);
      return res.status(201).json({
        asistencia_id: resultado.asistencia_id,
        nombre: resultado.nombre,
        tipo_participante: resultado.tipo_participante,
        sesion_id: lectura.sesionId,
        presente: true
      });
    } catch (error) {
      if (isEscalated(error)) throw error;
      if (error instanceof ServiceError) return res.status(error.status).json(error.body);

      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }

      console.error('Error en registrarAsistenciaQr:', error);
      return sendError(res, 500, 'Error al registrar asistencia por QR');
    }
  }
};

module.exports = asistenciaQrController;
