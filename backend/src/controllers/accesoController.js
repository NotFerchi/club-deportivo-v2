const accesoService = require('../services/accesoService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

const accesoController = {
  lecturaQr: async (req, res) => {
    let lectura;
    try {
      lectura = await accesoService.validarLectura(req.body?.codigo_qr);
    } catch (error) {
      if (error instanceof ServiceError) return res.status(error.status).json(error.body);
      throw error;
    }

    try {
      const acceso = await accesoService.registrarLectura(lectura);
      return res.status(201).json({
        ...acceso,
        mensaje: acceso.tipo === 'entrada' ? 'Entrada registrada correctamente' : 'Salida registrada correctamente'
      });
    } catch (error) {
      if (isEscalated(error)) throw error;
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Error en lecturaQr:', error);
      return res.status(500).json({ error: 'Error al registrar acceso por QR' });
    }
  }
};

module.exports = accesoController;
