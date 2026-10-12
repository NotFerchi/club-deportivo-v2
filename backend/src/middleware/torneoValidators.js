/**
 * Validación de entrada de /api/torneos y /api/encuentros (params, query y body).
 *
 * Solo se valida el formato de la entrada, antes de tocar la BD; lo que depende de la BD
 * (existencia, estado, duplicados) sigue en los servicios. El body ausente se trata como {}:
 * responde 400 con el mensaje del campo que falte, nunca 500.
 */
const { validateInput } = require('./validators');
const { ERROR_FECHAS_TORNEO, ERROR_TIPO_PARTICIPANTE, esIdValido, tieneValor } = require('../services/torneoComun');

const bad = (error) => [400, { error }];
const badOk = (error) => [400, { ok: false, error }];

const cuerpo = (req) => req.body ?? {};

// Límites de las columnas: torneos.nombre VARCHAR(150), participantes_torneo.nombre_externo
// VARCHAR(150) y encuentros_torneo.cancha_asignada VARCHAR(50).
const MAX_NOMBRE_TORNEO = 150;
const MAX_NOMBRE_EXTERNO = 150;
const MAX_CANCHA = 50;
const maximo = (limite) => `Máximo ${limite} caracteres`;

const TIPOS_TORNEO = ['Individual', 'Equipos'];
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// ── Torneos ──────────────────────────────────────────────────────────────────

/** :torneo_id válido; el mensaje varía por endpoint ('valido' / 'válido'). */
const torneoId = (mensaje = 'torneo_id debe ser un entero valido') =>
  validateInput((req) => (esIdValido(req.params.torneo_id) === null ? bad(mensaje) : null));
const torneoIdConAcento = () => torneoId('torneo_id debe ser un entero válido');

/** GET /: filtro disciplina_id opcional, id válido si viene. */
const filtroDisciplina = validateInput((req) => {
  const { disciplina_id } = req.query;
  if (tieneValor(disciplina_id) && esIdValido(disciplina_id) === null) {
    return bad('disciplina_id debe ser un entero valido');
  }
  return null;
});

/** nombre y disciplina_id, comunes a POST y PUT. */
function reglasNombreYDisciplina({ nombre, disciplina_id }) {
  if (typeof nombre !== 'string' || nombre.trim() === '') return bad('El nombre es requerido');
  if (nombre.trim().length > MAX_NOMBRE_TORNEO) return bad(maximo(MAX_NOMBRE_TORNEO));
  if (!tieneValor(disciplina_id)) return bad('disciplina_id es requerido');
  if (esIdValido(disciplina_id) === null) return bad('disciplina_id debe ser un entero valido');
  return null;
}

/** Campos opcionales de POST y PUT: categoría, tipo y orden de las fechas. */
function reglasOpcionalesTorneo({ categoria_id, tipo_torneo, fecha_inicio, fecha_fin }) {
  if (tieneValor(categoria_id) && esIdValido(categoria_id) === null) {
    return bad('categoria_id debe ser un entero valido');
  }
  if (tieneValor(tipo_torneo) && !TIPOS_TORNEO.includes(tipo_torneo)) {
    return bad('tipo_torneo debe ser Individual o Equipos');
  }
  // Mismo CHECK que la BD (fecha_fin >= fecha_inicio); otros formatos los valida PostgreSQL
  if (FECHA_ISO.test(fecha_inicio) && FECHA_ISO.test(fecha_fin) && fecha_fin < fecha_inicio) {
    return bad(ERROR_FECHAS_TORNEO);
  }
  return null;
}

/** POST /: nombre (≤ 150) y disciplina_id requeridos; categoría, tipo y fechas si vienen. */
const crearTorneo = validateInput((req) => {
  const body = cuerpo(req);
  return reglasNombreYDisciplina(body) || reglasOpcionalesTorneo(body);
});

/** PUT /:torneo_id: torneo_id, nombre (≤ 150) y disciplina_id; categoría, tipo y fechas si vienen. */
const actualizarTorneo = validateInput((req) => {
  const body = cuerpo(req);
  if (esIdValido(req.params.torneo_id) === null) return bad('torneo_id debe ser un entero valido');
  return reglasNombreYDisciplina(body) || reglasOpcionalesTorneo(body);
});

/**
 * POST /:torneo_id/inscribir: exactamente un tipo de participante, torneo_id, ids válidos,
 * nombre_externo ≤ 150 y categoria_id requerido.
 */
const inscribirParticipante = validateInput((req) => {
  const { socio_id, visita_id, nombre_externo, categoria_id, equipo_id } = cuerpo(req);
  const externo = typeof nombre_externo === 'string' ? nombre_externo.trim() : '';
  const tipos = [tieneValor(socio_id), tieneValor(visita_id), Boolean(externo)].filter(Boolean).length;
  if (tipos !== 1) return bad(ERROR_TIPO_PARTICIPANTE);
  if (esIdValido(req.params.torneo_id) === null) return bad('torneo_id debe ser un entero valido');
  if (tieneValor(socio_id) && esIdValido(socio_id) === null) return bad('socio_id debe ser un entero valido');
  if (tieneValor(visita_id) && esIdValido(visita_id) === null) return bad('visita_id debe ser un entero valido');
  if (externo.length > MAX_NOMBRE_EXTERNO) return bad(maximo(MAX_NOMBRE_EXTERNO));
  if (!tieneValor(categoria_id)) return bad('categoria_id es requerido');
  if (esIdValido(categoria_id) === null) return bad('categoria_id debe ser un entero valido');
  if (tieneValor(equipo_id) && esIdValido(equipo_id) === null) return bad('equipo_id debe ser un entero valido');
  return null;
});

/** DELETE /:torneo_id/participantes/:participante_id: ambos ids válidos. */
const desinscribir = validateInput((req) =>
  esIdValido(req.params.torneo_id) === null || esIdValido(req.params.participante_id) === null
    ? bad('IDs inválidos')
    : null
);

// ── Encuentros ───────────────────────────────────────────────────────────────

const esNoNegativo = (valor) => Number.isInteger(Number(valor)) && Number(valor) >= 0;
const MAX_MARCADOR = 999;

/** PATCH /:encuentro_id/resultado: id válido, marcadores enteros entre 0 y 999 y distintos, cancha ≤ 50 si viene. */
const registrarResultado = validateInput((req) => {
  const body = cuerpo(req);
  if (esIdValido(req.params.encuentro_id) === null) return badOk('encuentro_id debe ser un entero válido');
  const marcador1 = Number(body.marcador_1);
  const marcador2 = Number(body.marcador_2);
  if (!esNoNegativo(marcador1) || !esNoNegativo(marcador2)) {
    return badOk('marcador_1 y marcador_2 deben ser enteros no negativos');
  }
  if (marcador1 > MAX_MARCADOR || marcador2 > MAX_MARCADOR) {
    return badOk(`Los marcadores deben estar entre 0 y ${MAX_MARCADOR}`);
  }
  if (marcador1 === marcador2) {
    return badOk('No se permiten empates. Corrige el marcador para determinar un ganador.');
  }
  if (body.cancha_asignada !== undefined && String(body.cancha_asignada).trim().length > MAX_CANCHA) {
    return badOk(maximo(MAX_CANCHA));
  }
  return null;
});

/** PATCH /:encuentro_id/cancha: id válido y cancha no vacía de hasta 50 caracteres. */
const asignarCancha = validateInput((req) => {
  if (esIdValido(req.params.encuentro_id) === null) return badOk('encuentro_id inválido');
  const cancha = String(cuerpo(req).cancha_asignada || '').trim();
  if (!cancha) return badOk('cancha_asignada es requerida');
  if (cancha.length > MAX_CANCHA) return badOk(maximo(MAX_CANCHA));
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
  asignarCancha
};
