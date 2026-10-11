// Máquina de estados del torneo: única fuente de verdad de qué transiciones y operaciones permite cada estado.
//
//   Abierto → Inscripciones_cerradas → En_curso → Finalizado
//   Cancelado desde cualquier estado que no sea Finalizado ni Cancelado.
//
// Cada transición tiene su acción: cerrar-inscripciones, confirmar-bracket, finalizar y cancelar.
const ServiceError = require('./serviceError');

const ESTADOS = Object.freeze({
  ABIERTO: 'Abierto',
  INSCRIPCIONES_CERRADAS: 'Inscripciones_cerradas',
  EN_CURSO: 'En_curso',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado'
});

const TRANSICIONES = Object.freeze({
  [ESTADOS.ABIERTO]: [ESTADOS.INSCRIPCIONES_CERRADAS, ESTADOS.CANCELADO],
  [ESTADOS.INSCRIPCIONES_CERRADAS]: [ESTADOS.EN_CURSO, ESTADOS.CANCELADO],
  [ESTADOS.EN_CURSO]: [ESTADOS.FINALIZADO, ESTADOS.CANCELADO],
  [ESTADOS.FINALIZADO]: [],
  [ESTADOS.CANCELADO]: []
});

const ETIQUETAS = Object.freeze({
  [ESTADOS.ABIERTO]: 'Abierto',
  [ESTADOS.INSCRIPCIONES_CERRADAS]: 'Inscripciones cerradas',
  [ESTADOS.EN_CURSO]: 'En curso',
  [ESTADOS.FINALIZADO]: 'Finalizado',
  [ESTADOS.CANCELADO]: 'Cancelado'
});

// Mensaje cuando el torneo ya está en el estado destino (o en uno final).
const YA_EN_ESTADO = Object.freeze({
  [ESTADOS.ABIERTO]: 'El torneo ya está abierto',
  [ESTADOS.INSCRIPCIONES_CERRADAS]: 'Las inscripciones del torneo ya están cerradas',
  [ESTADOS.EN_CURSO]: 'El torneo ya está en curso',
  [ESTADOS.FINALIZADO]: 'El torneo ya está finalizado',
  [ESTADOS.CANCELADO]: 'El torneo ya está cancelado'
});

// Acción que lleva a cada estado, para el mensaje de transición inválida.
const ACCIONES = Object.freeze({
  [ESTADOS.ABIERTO]: 'reabrir',
  [ESTADOS.INSCRIPCIONES_CERRADAS]: 'cerrar las inscripciones',
  [ESTADOS.EN_CURSO]: 'confirmar el bracket',
  [ESTADOS.FINALIZADO]: 'finalizar',
  [ESTADOS.CANCELADO]: 'cancelar'
});

const esConocido = (estado) => Object.hasOwn(TRANSICIONES, estado);
const esFinal = (estado) => esConocido(estado) && TRANSICIONES[estado].length === 0;

function puedeTransicionar(actual, destino) {
  return esConocido(actual) && TRANSICIONES[actual].includes(destino);
}

function mensajeTransicion(actual, destino) {
  if (!esConocido(actual)) return `El torneo tiene un estado no reconocido ("${actual}")`;
  if (actual === destino || esFinal(actual)) return YA_EN_ESTADO[actual];
  return `No se permite ${ACCIONES[destino]}: el torneo está en estado "${ETIQUETAS[actual]}"`;
}

/** Lanza 409 si el torneo no puede pasar de `actual` a `destino`. */
function validarTransicion(actual, destino) {
  if (!puedeTransicionar(actual, destino)) {
    throw new ServiceError(409, { error: mensajeTransicion(actual, destino) });
  }
}

// ── Operaciones permitidas por estado ────────────────────────────────────────

/** Inscribir, desinscribir y cambiar disciplina, tipo o categoría: solo con inscripciones abiertas. */
const admiteInscripciones = (estado) => estado === ESTADOS.ABIERTO;

/** Registrar o editar resultados: solo con el torneo en curso. */
const admiteResultados = (estado) => estado === ESTADOS.EN_CURSO;

/** Asignar cancha: con el bracket generado y antes de terminar. */
const admiteAsignarCancha = (estado) => estado === ESTADOS.INSCRIPCIONES_CERRADAS || estado === ESTADOS.EN_CURSO;

module.exports = {
  ESTADOS,
  TRANSICIONES,
  ETIQUETAS,
  puedeTransicionar,
  validarTransicion,
  admiteInscripciones,
  admiteResultados,
  admiteAsignarCancha
};
