/**
 * Validación de entrada de /api/torneos y /api/encuentros (params, query y body).
 *
 * Mismos mensajes, status y orden que tenían los servicios. Solo se valida el formato
 * de la entrada; lo que depende de la BD (existencia, estado, duplicados) sigue en los
 * servicios. Donde el original desestructuraba el body antes de validar, la regla lo
 * lee igual: sin body lanza TypeError → errorHandler global, como antes.
 */
const { validateInput } = require('./validators');
const { ERROR_TIPO_PARTICIPANTE, esEnteroValido, tieneValor } = require('../services/torneoComun');

const bad = (error) => [400, { error }];
const badOk = (error) => [400, { ok: false, error }];

// ── Torneos ──────────────────────────────────────────────────────────────────

/** :torneo_id entero; el mensaje varía por endpoint ('valido' / 'válido'). */
const torneoId = (mensaje = 'torneo_id debe ser un entero valido') =>
  validateInput((req) => (esEnteroValido(req.params.torneo_id) === null ? bad(mensaje) : null));
const torneoIdConAcento = () => torneoId('torneo_id debe ser un entero válido');

/** GET /: filtro disciplina_id opcional, entero si viene. */
const filtroDisciplina = validateInput((req) => {
  const { disciplina_id } = req.query;
  if (tieneValor(disciplina_id) && esEnteroValido(disciplina_id) === null) {
    return bad('disciplina_id debe ser un entero valido');
  }
  return null;
});

/** POST /: nombre y disciplina_id requeridos (disciplina_id entero). */
const crearTorneo = validateInput((req) => {
  const { nombre, disciplina_id } = req.body;
  if (typeof nombre !== 'string' || nombre.trim() === '') return bad('El nombre es requerido');
  if (disciplina_id === undefined || disciplina_id === null || disciplina_id === '') {
    return bad('disciplina_id es requerido');
  }
  if (!Number.isInteger(Number(disciplina_id))) return bad('disciplina_id debe ser un entero valido');
  return null;
});

/** PUT /:torneo_id: body (antes que el id), torneo_id, nombre y disciplina_id entero. */
const actualizarTorneo = validateInput((req) => {
  const { nombre, disciplina_id } = req.body;
  if (esEnteroValido(req.params.torneo_id) === null) return bad('torneo_id debe ser un entero valido');
  if (typeof nombre !== 'string' || nombre.trim() === '') return bad('El nombre es requerido');
  if (esEnteroValido(disciplina_id) === null) return bad('disciplina_id debe ser un entero valido');
  return null;
});

/** POST /:torneo_id/inscribir: exactamente un tipo de participante y torneo_id entero. */
const inscribirParticipante = validateInput((req) => {
  const { socio_id, visita_id, nombre_externo } = req.body;
  const externo = typeof nombre_externo === 'string' ? nombre_externo.trim() : null;
  const tipos = [tieneValor(socio_id), tieneValor(visita_id), Boolean(externo)].filter(Boolean).length;
  if (tipos !== 1) return bad(ERROR_TIPO_PARTICIPANTE);
  if (esEnteroValido(req.params.torneo_id) === null) return bad('torneo_id debe ser un entero valido');
  return null;
});

/** DELETE /:torneo_id/participantes/:participante_id: ambos enteros. */
const desinscribir = validateInput((req) =>
  esEnteroValido(req.params.torneo_id) === null || esEnteroValido(req.params.participante_id) === null
    ? bad('IDs inválidos')
    : null
);

// ── Encuentros ───────────────────────────────────────────────────────────────

const esPositivo = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const esNoNegativo = (valor) => Number.isInteger(Number(valor)) && Number(valor) >= 0;

/** PATCH /:encuentro_id/resultado: id positivo, marcadores enteros ≥ 0 y distintos. */
const registrarResultado = validateInput((req) => {
  if (!esPositivo(req.params.encuentro_id)) return badOk('encuentro_id debe ser un entero válido');
  const marcador1 = Number(req.body.marcador_1);
  const marcador2 = Number(req.body.marcador_2);
  if (!esNoNegativo(marcador1) || !esNoNegativo(marcador2)) {
    return badOk('marcador_1 y marcador_2 deben ser enteros no negativos');
  }
  if (marcador1 === marcador2) {
    return badOk('No se permiten empates. Corrige el marcador para determinar un ganador.');
  }
  return null;
});

/** PATCH /:encuentro_id/cancha: id positivo y cancha no vacía. */
const asignarCancha = validateInput((req) => {
  if (!esPositivo(req.params.encuentro_id)) return badOk('encuentro_id inválido');
  if (!String(req.body.cancha_asignada || '').trim()) return badOk('cancha_asignada es requerida');
  return null;
});

/** PUT /:encuentro_id: body (antes que el id), id entero, participantes enteros y distintos. */
const actualizarEncuentro = validateInput((req) => {
  const { participante_1_id, participante_2_id } = req.body;
  const p1 = Number(participante_1_id);
  const p2 = Number(participante_2_id);
  if (!Number.isInteger(Number(req.params.encuentro_id))) return badOk('encuentro_id debe ser un entero valido');
  if (!Number.isInteger(p1) || !Number.isInteger(p2)) {
    return badOk('participante_1_id y participante_2_id deben ser enteros validos');
  }
  if (p1 === p2) return badOk('Los participantes deben ser distintos');
  return null;
});

module.exports = {
  torneoId,
  torneoIdConAcento,
  filtroDisciplina,
  crearTorneo,
  actualizarTorneo,
  inscribirParticipante,
  desinscribir,
  registrarResultado,
  asignarCancha,
  actualizarEncuentro
};
