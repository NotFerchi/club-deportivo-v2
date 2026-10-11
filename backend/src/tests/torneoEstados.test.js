'use strict';

/**
 * Máquina de estados del torneo (B-02): la matriz completa de transiciones.
 * Válidas: Abierto → Inscripciones_cerradas → En_curso → Finalizado, y Cancelado
 * desde cualquier estado no final. El resto, incluidas las de regreso, lanza 409.
 */

const ServiceError = require('../services/serviceError');
const {
  ESTADOS,
  puedeTransicionar,
  validarTransicion,
  admiteInscripciones,
  admiteResultados,
  admiteAsignarCancha
} = require('../services/torneoEstados');

const { ABIERTO, INSCRIPCIONES_CERRADAS, EN_CURSO, FINALIZADO, CANCELADO } = ESTADOS;
const TODOS = Object.values(ESTADOS);

const VALIDAS = [
  [ABIERTO, INSCRIPCIONES_CERRADAS],
  [INSCRIPCIONES_CERRADAS, EN_CURSO],
  [EN_CURSO, FINALIZADO],
  [ABIERTO, CANCELADO],
  [INSCRIPCIONES_CERRADAS, CANCELADO],
  [EN_CURSO, CANCELADO]
];
const esValida = (a, d) => VALIDAS.some(([x, y]) => x === a && y === d);
const INVALIDAS = TODOS.flatMap((a) => TODOS.map((d) => [a, d])).filter(([a, d]) => !esValida(a, d));

function errorDe(actual, destino) {
  try {
    validarTransicion(actual, destino);
  } catch (error) {
    return error;
  }
  return null;
}

describe('validarTransicion', () => {
  it.each(VALIDAS)('%s → %s es válida', (actual, destino) => {
    expect(puedeTransicionar(actual, destino)).toBe(true);
    expect(errorDe(actual, destino)).toBeNull();
  });

  it.each(INVALIDAS)('%s → %s lanza 409', (actual, destino) => {
    expect(puedeTransicionar(actual, destino)).toBe(false);
    const error = errorDe(actual, destino);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error.status).toBe(409);
    expect(typeof error.body.error).toBe('string');
  });

  it('hay 6 transiciones válidas y 19 inválidas', () => {
    expect(VALIDAS).toHaveLength(6);
    expect(INVALIDAS).toHaveLength(19);
  });

  it.each([
    [FINALIZADO, ABIERTO, 'El torneo ya está finalizado'],
    [CANCELADO, EN_CURSO, 'El torneo ya está cancelado'],
    [FINALIZADO, CANCELADO, 'El torneo ya está finalizado'],
    [INSCRIPCIONES_CERRADAS, INSCRIPCIONES_CERRADAS, 'Las inscripciones del torneo ya están cerradas'],
    [EN_CURSO, EN_CURSO, 'El torneo ya está en curso'],
    [EN_CURSO, ABIERTO, 'No se permite reabrir: el torneo está en estado "En curso"'],
    [INSCRIPCIONES_CERRADAS, ABIERTO, 'No se permite reabrir: el torneo está en estado "Inscripciones cerradas"'],
    [ABIERTO, EN_CURSO, 'No se permite confirmar el bracket: el torneo está en estado "Abierto"'],
    [ABIERTO, FINALIZADO, 'No se permite finalizar: el torneo está en estado "Abierto"'],
    ['Lo que sea', CANCELADO, 'El torneo tiene un estado no reconocido ("Lo que sea")']
  ])('%s → %s: mensaje claro', (actual, destino, mensaje) => {
    expect(errorDe(actual, destino).body).toEqual({ error: mensaje });
  });

  it.each(['constructor', 'toString', null, undefined])('estado %p no reconocido → 409, sin TypeError', (actual) => {
    expect(puedeTransicionar(actual, CANCELADO)).toBe(false);
    expect(errorDe(actual, CANCELADO).status).toBe(409);
  });
});

describe('operaciones permitidas por estado', () => {
  it.each([
    [ABIERTO, true, false, false],
    [INSCRIPCIONES_CERRADAS, false, false, true],
    [EN_CURSO, false, true, true],
    [FINALIZADO, false, false, false],
    [CANCELADO, false, false, false],
    ['Lo que sea', false, false, false]
  ])('%s: inscripciones=%s, resultados=%s, cancha=%s', (estado, inscripciones, resultados, cancha) => {
    expect(admiteInscripciones(estado)).toBe(inscripciones);
    expect(admiteResultados(estado)).toBe(resultados);
    expect(admiteAsignarCancha(estado)).toBe(cancha);
  });
});
