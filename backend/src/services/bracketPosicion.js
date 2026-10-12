// Regla única de posición del bracket, la misma que dibuja BracketVisual:
// dentro de cada ronda, la posición de un encuentro es su orden por encuentro_id (0, 1, 2…),
// y el ganador del encuentro en la posición i de la ronda r va al encuentro en la posición
// ⌊i/2⌋ de la ronda r+1, como participante_1_id si i es par y como participante_2_id si es impar.
const ServiceError = require('./serviceError');

const ERROR_BRACKET_INCONSISTENTE = 'El bracket de este torneo tiene datos inconsistentes';

/** Posición y campo del encuentro destino del ganador del encuentro en la posición `posicion`. */
function destinoDelGanador(posicion) {
  return {
    posicion: Math.floor(posicion / 2),
    campo: posicion % 2 === 0 ? 'participante_1_id' : 'participante_2_id'
  };
}

/**
 * Encuentro destino del ganador de `enc` (con torneo_id, ronda y encuentro_id), bloqueado FOR UPDATE,
 * junto con el `campo` que le toca. null si `enc` es la final (única de su ronda).
 * 409 { ok: false, error } si los datos no permiten aplicar la regla (ronda nula o falta el destino).
 */
async function encuentroDestino(client, enc) {
  const inconsistente = () => new ServiceError(409, { ok: false, error: ERROR_BRACKET_INCONSISTENTE });
  if (enc.ronda === null || enc.ronda === undefined) throw inconsistente();

  const { rows: ronda } = await client.query(
    `SELECT COUNT(*) FILTER (WHERE encuentro_id < $3)::int AS posicion, COUNT(*)::int AS total
       FROM encuentros_torneo
       WHERE torneo_id = $1 AND ronda = $2`,
    [enc.torneo_id, enc.ronda, enc.encuentro_id]
  );
  if (ronda[0].total <= 1) return null;

  const destino = destinoDelGanador(ronda[0].posicion);
  const { rows } = await client.query(
    `SELECT encuentro_id, ronda, estado, participante_1_id, participante_2_id
       FROM encuentros_torneo
       WHERE torneo_id = $1 AND ronda = $2
       ORDER BY encuentro_id
       OFFSET $3 LIMIT 1
       FOR UPDATE`,
    [enc.torneo_id, enc.ronda + 1, destino.posicion]
  );
  if (rows.length === 0) throw inconsistente();
  return { ...rows[0], campo: destino.campo };
}

module.exports = { ERROR_BRACKET_INCONSISTENTE, destinoDelGanador, encuentroDestino };
