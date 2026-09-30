/**
 * Validación de entrada de /api/ludoteca (params y body), con los mismos mensajes,
 * status y orden que tenían el controlador y el servicio.
 *
 * La regla de edad (validarNino) sigue en ludotecaService porque la entrada por QR
 * la aplica después de consultar la BD; aquí se reutiliza para las entradas directas.
 * Donde el original desestructuraba req.body, sin body el error llega al errorHandler.
 */
const { validateInput } = require('./validators');
const { validarNino } = require('../services/ludotecaService');
const ServiceError = require('../services/serviceError');

const bad = (error) => [400, { error }];

/** validarNino lanza ServiceError; se convierte en [status, body]. */
function nino(nombreHijo, fechaNacimiento) {
  try {
    validarNino(nombreHijo, fechaNacimiento);
    return null;
  } catch (error) {
    if (error instanceof ServiceError) return [error.status, error.body];
    throw error;
  }
}

/** :registro_id entero positivo. */
const registroId = validateInput((req) => {
  const valor = Number(req.params.registro_id);
  return !Number.isInteger(valor) || valor <= 0 ? bad('registro_id debe ser un entero válido') : null;
});

/** POST /entrada (staff): campos requeridos, datos del niño y socio_padre_id entero positivo. */
const entradaStaff = validateInput((req) => {
  const { socio_padre_id, nombre_hijo, fecha_nacimiento } = req.body;
  if (!socio_padre_id || !nombre_hijo || !fecha_nacimiento) {
    return bad('socio_padre_id, nombre_hijo y fecha_nacimiento son requeridos');
  }
  const errorNino = nino(nombre_hijo, fecha_nacimiento);
  if (errorNino) return errorNino;
  const socioPadreId = Number(socio_padre_id);
  if (!Number.isInteger(socioPadreId) || socioPadreId <= 0) return bad('socio_padre_id debe ser un entero válido');
  return null;
});

/** POST /socio/entrada: campos requeridos y datos del niño. */
const entradaSocio = validateInput((req) => {
  const { nombre_hijo, fecha_nacimiento } = req.body;
  if (!nombre_hijo || !fecha_nacimiento) return bad('nombre_hijo y fecha_nacimiento son requeridos');
  return nino(nombre_hijo, fecha_nacimiento);
});

/** POST /acceso-qr: codigo_qr requerido. */
const accesoQr = validateInput((req) => {
  const { codigo_qr } = req.body;
  return codigo_qr ? null : bad('codigo_qr es requerido');
});

module.exports = { registroId, entradaStaff, entradaSocio, accesoQr };
