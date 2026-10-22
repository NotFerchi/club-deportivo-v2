/**
 * Validación de entrada de /api/evaluaciones (params, query y body). Contrato: docs/api-evaluaciones.md.
 *
 * Solo se valida el formato, antes de tocar la BD; lo que depende de la BD (socio, sesión, inscripción,
 * instructor, duplicados) está en evaluacionService. El body ausente se trata como {}: responde 400
 * con el mensaje del campo que falte, nunca 500.
 */
const { validateInput } = require('./validators');
const { esIdValido, tieneValor } = require('../services/torneoComun');

const bad = (error) => [400, { error }];
const cuerpo = (req) => req.body ?? {};

// evaluaciones_instructor.comentario VARCHAR(500)
const MAX_COMENTARIO = 500;
// YYYY-MM con mes de 01 a 12
const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Calificación entera de 1 a 5, como número o como texto de un dígito; null si no lo es. */
function calificacionValida(valor) {
  let numero = NaN;
  if (typeof valor === 'number') numero = valor;
  else if (typeof valor === 'string' && /^\s*\d\s*$/.test(valor)) numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= 5 ? numero : null;
}

/** POST /: sesion_id, calificacion de 1 a 5 y comentario opcional (texto de hasta 500 tras recortar). */
const crearEvaluacion = validateInput((req) => {
  const { sesion_id, calificacion, comentario } = cuerpo(req);
  if (esIdValido(sesion_id) === null) return bad('sesion_id debe ser un entero válido');
  if (calificacionValida(calificacion) === null) return bad('calificacion debe ser un entero de 1 a 5');
  if (comentario !== undefined && comentario !== null) {
    if (typeof comentario !== 'string' || comentario.trim().length > MAX_COMENTARIO) {
      return bad(`comentario debe ser texto de máximo ${MAX_COMENTARIO} caracteres`);
    }
  }
  return null;
});

/** :instructor_id válido. */
const instructorId = validateInput((req) =>
  esIdValido(req.params.instructor_id) === null ? bad('instructor_id debe ser un entero válido') : null
);

/** ?periodo opcional: si viene, YYYY-MM. */
const periodo = validateInput((req) => {
  const valor = req.query?.periodo;
  if (tieneValor(valor) && !(typeof valor === 'string' && PERIODO.test(valor))) {
    return bad('periodo debe tener el formato YYYY-MM');
  }
  return null;
});

module.exports = { crearEvaluacion, instructorId, periodo };
