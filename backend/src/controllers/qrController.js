const qrService = require('../services/qrService');
const ServiceError = require('../services/serviceError');
const { isEscalated } = require('../services/escalate');

/**
 * Errores escalados → errorHandler global; ServiceError → su status/cuerpo;
 * el resto se registra y responde error.statusCode (si lo trae) o 500.
 */
function responderError(res, error, fnName, mensaje, { usarStatusCode = false } = {}) {
  if (isEscalated(error)) throw error;
  if (error instanceof ServiceError) return res.status(error.status).json(error.body);
  console.error(`Error en ${fnName}:`, error);
  if (usarStatusCode && error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  return res.status(500).json({ error: mensaje });
}

const qrController = {
  generarQrSocio: async (req, res) => {
    try {
      return res.status(201).json(await qrService.generarQrSocio(req.body?.socio_id));
    } catch (error) {
      return responderError(res, error, 'generarQrSocio', 'Error al generar codigo QR del socio', {
        usarStatusCode: true
      });
    }
  },

  generarQrVisita: async (req, res) => {
    try {
      return res.status(201).json(await qrService.generarQrVisita(req.body?.visita_id));
    } catch (error) {
      return responderError(res, error, 'generarQrVisita', 'Error al generar codigo QR de la visita', {
        usarStatusCode: true
      });
    }
  },

  obtenerQrActivoSocio: async (req, res) => {
    try {
      return res.json(await qrService.qrActivoSocio(req.params?.socio_id));
    } catch (error) {
      return responderError(res, error, 'obtenerQrActivoSocio', 'Error al consultar codigo QR del socio');
    }
  },

  obtenerMiQr: async (req, res) => {
    try {
      return res.json(await qrService.miQr(req.user?.usuario_id));
    } catch (error) {
      return responderError(res, error, 'obtenerMiQr', 'Error al obtener tu código QR');
    }
  },

  identificarSocio: async (req, res) => {
    const { codigo_qr } = req.body;

    try {
      const socioId = qrService.socioIdDesdeQr(codigo_qr);
      return res.json(await qrService.identificarSocio(socioId));
    } catch (error) {
      return responderError(res, error, 'identificarSocio', 'Error interno del servidor');
    }
  }
};

module.exports = qrController;
