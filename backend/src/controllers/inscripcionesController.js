const inscripcionService = require('../services/inscripcionService');
const ServiceError = require('../services/serviceError');

function handleError(res, error, fnName, message) {
  if (error instanceof ServiceError) {
    return res.status(error.status).json(error.body);
  }
  console.error(`Error en ${fnName}:`, error);
  return res.status(500).json({ error: message });
}

const inscripcionesController = {
  // ============================================
  // INSCRIBIR SOCIO A UNA CLASE
  // ============================================
  inscribir: async (req, res) => {
    const { sesionId, socioId } = req.body;

    try {
      const { reactivada, inscripcion_id } = await inscripcionService.inscribir(sesionId, socioId);
      res.status(201).json({
        message: reactivada ? 'Inscripción reactivada exitosamente' : 'Inscripción exitosa',
        inscripcion_id
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Ya estás inscrito en esta clase' });
      }
      handleError(res, error, 'inscribir', 'Error al procesar la inscripción');
    }
  },

  // ============================================
  // CANCELAR INSCRIPCIÓN
  // ============================================
  cancelar: async (req, res) => {
    const { sesionId, socioId } = req.body;

    try {
      await inscripcionService.cancelarInscripcion(sesionId, socioId);
      res.json({ message: 'Inscripción cancelada correctamente' });
    } catch (error) {
      handleError(res, error, 'cancelar', 'Error al cancelar la inscripción');
    }
  },

  // ============================================
  // OBTENER INSCRIPCIONES DEL SOCIO
  // ============================================
  getMisInscripciones: async (req, res) => {
    try {
      res.json(await inscripcionService.listarInscripcionesSocio(req.query.socioId));
    } catch (error) {
      handleError(res, error, 'getMisInscripciones', 'Error al obtener inscripciones');
    }
  }
};

module.exports = inscripcionesController;
