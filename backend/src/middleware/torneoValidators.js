/**
 * Validación de entrada de /api/torneos y /api/encuentros (params, query y body).
 *
 * Solo se valida el formato de la entrada, antes de tocar la BD; lo que depende de la BD
 * (existencia, estado, duplicados) sigue en los servicios. El body ausente se trata como {}:
 * responde 400 con el mensaje del campo que falte, nunca 500.
 */
const { validateInput } = require('./validators');
const {
  ERROR_CATEGORIA_REQUERIDA,
  ERROR_FECHAS_TORNEO,
  ERROR_TIPO_PARTICIPANTE,
  esIdValido,
  tieneValor
} = require('../services/torneoComun');
const { FECHA_ISO, validarFechasInscripcion } = require('../services/torneoFechas');

const bad = (error) => [400, { error }];
const badOk = (error) => [400, { ok: false, error }];

const cuerpo = (req) => req.body ?? {};

// Límites de las columnas: torneos.nombre VARCHAR(150), participantes_torneo.nombre_externo
// VARCHAR(150) y encuentros_torneo.cancha_asignada VARCHAR(100) (ampliada en el paso de esquema, B-17).
const MAX_NOMBRE_TORNEO = 150;
const MAX_NOMBRE_EXTERNO = 150;
const MAX_CANCHA = 100;
const maximo = (limite) => `Máximo ${limite} caracteres`;

const TIPOS_TORNEO = ['Individual', 'Equipos'];
const FECHAS_INSCRIPCION = ['fecha_inicio_inscripcion', 'fecha_fin_inscripcion'];

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

/**
 * Campos opcionales de POST y PUT: categoría, tipo, orden de las fechas del torneo y periodo de
 * inscripción (formato YYYY-MM-DD y orden con lo que venga en el body; en PUT el servicio vuelve a
 * comprobar el orden con los valores guardados de los campos que no vienen).
 */
function reglasOpcionalesTorneo(body) {
  const { categoria_id, tipo_torneo, fecha_inicio, fecha_fin } = body;
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
  const formatoMal = FECHAS_INSCRIPCION.find(
    (campo) => tieneValor(body[campo]) && !(typeof body[campo] === 'string' && FECHA_ISO.test(body[campo]))
  );
  if (formatoMal) return bad(`${formatoMal} debe tener el formato YYYY-MM-DD`);
  const ordenMal = validarFechasInscripcion(body);
  return ordenMal ? bad(ordenMal) : null;
}

/** POST /: nombre (≤ 150), disciplina_id y categoria_id requeridos (B-10); tipo y fechas si vienen. */
const crearTorneo = validateInput((req) => {
  const body = cuerpo(req);
  const falla = reglasNombreYDisciplina(body);
  if (falla) return falla;
  if (!tieneValor(body.categoria_id)) return bad(ERROR_CATEGORIA_REQUERIDA);
  return reglasOpcionalesTorneo(body);
});

/**
 * PUT /:torneo_id: torneo_id, nombre (≤ 150) y disciplina_id; categoría, tipo y fechas si vienen.
 * La categoría es obligatoria solo con el torneo Abierto: lo comprueba el servicio, que conoce el estado.
 */
const actualizarTorneo = validateInput((req) => {
  const body = cuerpo(req);
  if (esIdValido(req.params.torneo_id) === null) return bad('torneo_id debe ser un entero valido');
  return reglasNombreYDisciplina(body) || reglasOpcionalesTorneo(body);
});

/**
 * POST /:torneo_id/inscribir: exactamente un tipo de participante, torneo_id, ids válidos y
 * nombre_externo ≤ 150. categoria_id es opcional: la categoría es la del torneo (B-14).
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
  if (tieneValor(categoria_id) && esIdValido(categoria_id) === null) {
    return bad('categoria_id debe ser un entero valido');
  }
  if (tieneValor(equipo_id) && esIdValido(equipo_id) === null) return bad('equipo_id debe ser un entero valido');
  return null;
});

/** DELETE /:torneo_id/participantes/:participante_id: ambos ids válidos. */
const desinscribir = validateInput((req) =>
  esIdValido(req.params.torneo_id) === null || esIdValido(req.params.participante_id) === null
    ? bad('IDs inválidos')
    : null
);

// ── Categorías (E2.6) ────────────────────────────────────────────────────────

// categorias_torneo.nombre es VARCHAR(50).
const MAX_NOMBRE_CATEGORIA = 50;

const reglaCategoriaId = (req) =>
  esIdValido(req.params.categoria_id) === null ? bad('categoria_id debe ser un entero valido') : null;

function reglaNombreCategoria(req) {
  const { nombre } = cuerpo(req);
  if (typeof nombre !== 'string' || nombre.trim() === '') return bad('El nombre es requerido');
  if (nombre.trim().length > MAX_NOMBRE_CATEGORIA) return bad(maximo(MAX_NOMBRE_CATEGORIA));
  return null;
}

/** GET /categorias: `activas` opcional, 'true' o 'false'. */
const filtroCategorias = validateInput((req) => {
  const { activas } = req.query;
  if (tieneValor(activas) && !['true', 'false'].includes(activas)) return bad('activas debe ser true o false');
  return null;
});

/** POST /categorias: nombre requerido (≤ 50). */
const crearCategoria = validateInput(reglaNombreCategoria);

/** PUT /categorias/:categoria_id: id válido y nombre requerido (≤ 50). */
const renombrarCategoria = validateInput((req) => reglaCategoriaId(req) || reglaNombreCategoria(req));

/** PATCH /categorias/:categoria_id/desactivar: id válido. */
const categoriaId = validateInput(reglaCategoriaId);

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

const HORA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** 'YYYY-MM-DDTHH:mm' con fecha y hora que existen (sin 2026-02-30 ni 25:00). */
function esHoraLocalValida(valor) {
  const partes = typeof valor === 'string' ? HORA_LOCAL.exec(valor) : null;
  if (!partes) return false;
  const [anio, mes, dia, hora, minuto] = partes.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia &&
    fecha.getUTCHours() === hora &&
    fecha.getUTCMinutes() === minuto
  );
}

/** PATCH /:encuentro_id/horario: id válido; hora_programada presente, null o 'YYYY-MM-DDTHH:mm' válida. */
const asignarHorario = validateInput((req) => {
  if (esIdValido(req.params.encuentro_id) === null) return badOk('encuentro_id inválido');
  const { hora_programada } = cuerpo(req);
  if (hora_programada === undefined) return badOk('hora_programada es requerida');
  if (hora_programada !== null && !esHoraLocalValida(hora_programada)) {
    return badOk('hora_programada debe tener el formato YYYY-MM-DDTHH:mm');
  }
  return null;
});

module.exports = {
  asignarHorario,
  torneoId,
  torneoIdConAcento,
  filtroDisciplina,
  crearTorneo,
  actualizarTorneo,
  inscribirParticipante,
  desinscribir,
  filtroCategorias,
  crearCategoria,
  renombrarCategoria,
  categoriaId,
  registrarResultado,
  asignarCancha
};
