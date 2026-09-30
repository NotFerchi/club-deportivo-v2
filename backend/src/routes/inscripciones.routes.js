const express = require('express');
const router = express.Router();
const inscripcionesController = require('../controllers/inscripcionesController');
const { requireFields } = require('../middleware/validators');

// Rutas para inscripciones
router.post(
  '/inscribir',
  requireFields(['sesionId', 'socioId'], { message: 'Faltan datos requeridos: sesionId y socioId' }),
  inscripcionesController.inscribir
);
router.post(
  '/cancelar',
  requireFields(['sesionId', 'socioId'], { message: 'Faltan datos requeridos' }),
  inscripcionesController.cancelar
);
router.get(
  '/mis-inscripciones',
  requireFields(['socioId'], { source: 'query', message: 'socioId requerido' }),
  inscripcionesController.getMisInscripciones
);

module.exports = router;
