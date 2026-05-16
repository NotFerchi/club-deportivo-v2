const express = require('express');
const router = express.Router();
const controller = require('../controllers/ludotecaController');
const { verifyToken } = require('../middleware/auth.middleware');
const checkRole = require('../middleware/checkRole');

// Aforo público
router.get('/aforo', controller.getAforo);

// Autoservicio del socio (entrada y salida propias)
router.post('/socio/entrada', verifyToken, controller.socioEntradaLudoteca);
router.patch('/socio/salida/:registro_id', verifyToken, controller.socioSalidaLudoteca);

// Rutas existentes
router.get(
  '/activos',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  controller.registrosActivos
);
router.get('/historial',  verifyToken, controller.historial);
router.post('/',          verifyToken, controller.registrarEntrada);
router.put('/:id/salida', verifyToken, controller.registrarSalida);

// SCRUM-108: Registro de entrada con validación de edad
router.post(
  '/entrada',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  controller.registrarEntradaLudoteca
);

// SCRUM-109: Registro de salida con sanción automática
router.patch(
  '/salida/:registro_id',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  controller.registrarSalidaLudoteca
);

// Registros activos del socio logueado
router.get(
  '/mis-registros',
  verifyToken,
  controller.misRegistros
);

router.post(
  '/acceso-qr',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  controller.accesoQrLudoteca
);

module.exports = router;
