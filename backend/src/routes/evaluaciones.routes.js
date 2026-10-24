const express = require('express');
const router = express.Router();
const evaluacionesController = require('../controllers/evaluacionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const validar = require('../middleware/evaluacionValidators');

// Contrato: docs/api-evaluaciones.md
const staffRoles = ['admin', 'gerente', 'coordinador'];
const verResultados = [...staffRoles, 'instructor']; // el instructor solo las suyas (lo comprueba el servicio)

router.post('/', verifyToken, checkRole(['socio']), validar.crearEvaluacion, evaluacionesController.crearEvaluacion);
router.get('/mias', verifyToken, checkRole(['socio']), validar.periodo, evaluacionesController.misEvaluaciones);
router.get(
  '/instructor/:instructor_id',
  verifyToken,
  checkRole(verResultados),
  validar.instructorId,
  validar.periodo,
  evaluacionesController.listarPorInstructor
);
router.get(
  '/instructor/:instructor_id/promedio',
  verifyToken,
  checkRole(verResultados),
  validar.instructorId,
  validar.periodo,
  evaluacionesController.promedioDeInstructor
);

module.exports = router;
