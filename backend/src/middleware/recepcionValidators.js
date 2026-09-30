/**
 * Validación de entrada de /api/recepcion (visitas y pase de lista), con los mismos
 * mensajes, status y orden que tenían visitaService y paseListaService.
 */
const { validateInput } = require('./validators');
const { normalizarVisita } = require('../services/visitaService');

const bad = (error) => [400, { error }];

/** POST /visitas: tipo de pase, nombre y (formato nuevo) teléfono y mayor_16. Sin body → errorHandler. */
const nuevaVisita = validateInput((req) => {
  const v = normalizarVisita(req.body);
  if (!['visita', 'dia'].includes(v.tipoPase)) return bad('Tipo de pase invalido');
  if (!v.nombre) return bad('Nombre completo es requerido');
  if (!v.legacyPayload && (!v.telefonoNormalizado || v.telefonoNormalizado.length < 10)) {
    return bad('Telefono valido es requerido');
  }
  if (!v.legacyPayload && typeof req.body.mayor_16 !== 'boolean') return bad('Debe indicar si es mayor de 16 anos');
  return null;
});

/**
 * GET /clases: ?fecha (si viene) debe tener año, mes y día. Sin fecha se usa hoy (siempre válida).
 * Un ?fecha repetido llega como arreglo: .split lanza y responde el errorHandler, como antes.
 */
const fechaClases = validateInput((req) => {
  const { fecha } = req.query;
  if (!fecha) return null;
  const [year, month, day] = fecha.split('-').map(Number);
  return !year || !month || !day ? bad('Fecha invalida') : null;
});

/** GET /clases/:sesionId/alumnos: sesión y fecha requeridas. */
const alumnosClase = validateInput((req) => {
  const sesionId = req.params.sesionId || req.query.sesionId;
  return !sesionId || !req.query.fecha ? bad('Sesion y fecha son requeridas') : null;
});

module.exports = { nuevaVisita, fechaClases, alumnosClase };
