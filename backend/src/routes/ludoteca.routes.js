const express = require('express');
const router = express.Router();
const controller = require('../controllers/ludotecaController');
const { verifyToken } = require('../middleware/auth.middleware');
const checkRole = require('../middleware/checkRole');
const validar = require('../middleware/ludotecaValidators');

// Aforo público
router.get('/aforo', controller.getAforo);

// Autoservicio del socio (entrada y salida propias)
router.post('/socio/entrada', verifyToken, validar.entradaSocio, controller.socioEntradaLudoteca);
router.patch('/socio/salida/:registro_id', verifyToken, validar.registroId, controller.socioSalidaLudoteca);

// Rutas existentes
router.get(
  '/activos',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  controller.registrosActivos
);
router.get('/historial', verifyToken, controller.historial);
router.post('/', verifyToken, controller.aliasEntrada, validar.entradaStaff, controller.registrarEntradaLudoteca);
router.put('/:id/salida', verifyToken, controller.aliasSalida, validar.registroId, controller.registrarSalidaLudoteca);

// SCRUM-108: Registro de entrada con validación de edad
router.post(
  '/entrada',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  validar.entradaStaff,
  controller.registrarEntradaLudoteca
);

// SCRUM-109: Registro de salida con sanción automática
router.patch(
  '/salida/:registro_id',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  validar.registroId,
  controller.registrarSalidaLudoteca
);

// Registros activos del socio logueado
router.get('/mis-registros', verifyToken, controller.misRegistros);

router.post(
  '/acceso-qr',
  verifyToken,
  checkRole(['instructor', 'recepcion', 'admin', 'coordinador', 'gerente']),
  validar.accesoQr,
  controller.accesoQrLudoteca
);

module.exports = router;
