const express = require('express');
const router = express.Router();
const inscripcionesController = require('../controllers/inscripcionesController');

// Rutas para inscripciones
router.post('/inscribir', inscripcionesController.inscribir);
router.post('/cancelar', inscripcionesController.cancelar);
router.get('/mis-inscripciones', inscripcionesController.getMisInscripciones);

module.exports = router;