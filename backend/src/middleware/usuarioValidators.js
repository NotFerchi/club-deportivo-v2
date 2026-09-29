/**
 * Validación de entrada de /api/usuarios (alta, edición y foto de perfil), con los
 * mismos mensajes, status y orden que tenía usuarioService.
 */
const { validateBody, validateInput } = require('./validators');
const { camposUsuario } = require('../services/usuarioService');
const { validarCURP } = require('../utils/validacionCurp');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bad = (error) => [400, { error }];

/** Validaciones comunes a crear y actualizar (mismo orden y mensajes). */
function validarDatosUsuario({ nombres, apellidoPaterno, email, telefono, curp, rol_id }) {
  if (!nombres?.trim() || !apellidoPaterno?.trim() || !email?.trim() || !curp?.trim() || !rol_id) {
    return bad('Nombres, apellido paterno, email, CURP y rol son obligatorios');
  }
  if (!EMAIL_REGEX.test(email)) return bad('Formato de email inválido');
  const curpValidation = validarCURP(curp);
  if (!curpValidation.valido) return bad(curpValidation.mensaje);
  if (telefono && !/^\d{10}$/.test(telefono)) return bad('El teléfono debe tener 10 dígitos numéricos');
  return null;
}

/** POST / y PUT /:id. `fnName`/`mensaje` replican el catch de cada endpoint. */
const datosUsuario = (fnName, mensaje) =>
  validateBody({ leer: (req) => camposUsuario(req.body), regla: validarDatosUsuario, fnName, mensaje });

/** PUT /me/foto: se requiere el archivo (después de multer). */
const fotoRequerida = validateInput((req) => (req.file ? null : bad('Se requiere una imagen')));

module.exports = { datosUsuario, fotoRequerida };
