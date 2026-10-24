// DATOS SIMULADOS de la maqueta de torneos (E3.1). Se borra COMPLETO en E3.3.
//
// Sigue la forma de docs/api-torneos.md y los mensajes reales del backend. Las funciones
// tienen el mismo trabajo que sus endpoints, así E3.3 solo cambia la llamada:
//
//   listarTorneos(filtros)      →  GET  /api/torneos            (§3.2)
//   guardarTorneo(payload, id)  →  POST /api/torneos  |  PUT /api/torneos/:id   (§3.3, §3.4)
//   inscribirme(torneoId)       →  POST /api/torneos/:id/inscribir-me           (§3.6)
//   listarDisciplinas / listarCategorias  →  GET /api/disciplinas, /api/torneos/categorias
//
// Para ver los estados de la pantalla, agrega ?modo= a la URL:
//   ?modo=lento  → la carga tarda 3 s (estado de carga)
//   ?modo=vacio  → la lista llega sin torneos (estado vacío)
//   ?modo=error  → la lista falla (estado de error con Reintentar)
//   ?modo=conflicto → inscribirme responde 409 de cupo lleno (error del backend en el modal)

const MS_DEMORA = 500;

/** Fecha del club (America/Mexico_City) como "YYYY-MM-DD", igual que el backend. */
export function hoyClub() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  const fechaUtc = new Date(Date.UTC(y, m - 1, d + dias));
  return fechaUtc.toISOString().slice(0, 10);
}

function modoDeLaUrl() {
  return new URLSearchParams(window.location.search).get('modo');
}

/** Error con la misma forma que lanza apiRequest: message del backend y status HTTP. */
function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function esperar(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

export const DISCIPLINAS = [
  { disciplina_id: 1, nombre: 'Tenis' },
  { disciplina_id: 2, nombre: 'Pádel' },
  { disciplina_id: 3, nombre: 'Natación' },
  { disciplina_id: 4, nombre: 'Basquetbol' },
];

export const CATEGORIAS = [
  { categoria_id: 1, nombre: 'Adulto' },
  { categoria_id: 2, nombre: 'Juvenil' },
  { categoria_id: 3, nombre: 'Libre' },
];

const hoy = hoyClub();

// Estado interno de la maqueta; se reinicia al recargar la página.
// admite_inscripcion NO se guarda: se calcula al listar, como hace el backend.
let torneosGuardados = [
  {
    torneo_id: 45, nombre: 'Copa Otoño 2026', disciplina_id: 1, categoria_id: 1, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, 14), fecha_fin: sumarDias(hoy, 22), estado: 'Abierto', total_participantes: 6, cupo_maximo: 16,
  },
  {
    torneo_id: 46, nombre: 'Relámpago de Pádel', disciplina_id: 2, categoria_id: 2, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, 10), fecha_fin: sumarDias(hoy, 11), estado: 'Abierto', total_participantes: 8, cupo_maximo: 8,
  },
  {
    torneo_id: 47, nombre: 'Liga de Natación Libre', disciplina_id: 3, categoria_id: 3, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, -3), fecha_fin: sumarDias(hoy, 20), estado: 'Abierto', total_participantes: 5, cupo_maximo: null,
  },
  {
    torneo_id: 48, nombre: 'Interclubes de Basquetbol', disciplina_id: 4, categoria_id: 1, tipo_torneo: 'Equipos',
    fecha_inicio: sumarDias(hoy, 20), fecha_fin: sumarDias(hoy, 40), estado: 'Abierto', total_participantes: 3, cupo_maximo: 12,
  },
  {
    torneo_id: 49, nombre: 'Torneo de Tenis sin categoría', disciplina_id: 1, categoria_id: null, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, 30), fecha_fin: null, estado: 'Abierto', total_participantes: 0, cupo_maximo: null,
  },
  {
    torneo_id: 50, nombre: 'Copa Verano', disciplina_id: 2, categoria_id: 1, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, 2), fecha_fin: sumarDias(hoy, 5), estado: 'Inscripciones_cerradas', total_participantes: 8, cupo_maximo: 8,
  },
  {
    torneo_id: 51, nombre: 'Open de Tenis', disciplina_id: 1, categoria_id: 1, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, -2), fecha_fin: sumarDias(hoy, 3), estado: 'En_curso', total_participantes: 16, cupo_maximo: 16,
  },
  {
    torneo_id: 33, nombre: 'Copa Primavera', disciplina_id: 1, categoria_id: 1, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, -60), fecha_fin: sumarDias(hoy, -52), estado: 'Finalizado', total_participantes: 12, cupo_maximo: null,
  },
  {
    torneo_id: 34, nombre: 'Copa Invierno', disciplina_id: 3, categoria_id: 2, tipo_torneo: 'Individual',
    fecha_inicio: sumarDias(hoy, -45), fecha_fin: sumarDias(hoy, -40), estado: 'Cancelado', total_participantes: 2, cupo_maximo: null,
  },
];

let siguienteId = 60;

/** Forma de un torneo en GET /api/torneos (§3.2). */
function aRespuesta(torneo) {
  const disciplina = DISCIPLINAS.find((d) => d.disciplina_id === torneo.disciplina_id);
  const categoria = CATEGORIAS.find((c) => c.categoria_id === torneo.categoria_id);
  const hayCupo = torneo.cupo_maximo === null || torneo.total_participantes < torneo.cupo_maximo;
  const enPeriodo = torneo.fecha_inicio === null || torneo.fecha_inicio > hoy;
  return {
    ...torneo,
    nombre_disciplina: disciplina?.nombre ?? null,
    nombre_categoria: categoria?.nombre ?? null,
    se_realiza: torneo.total_participantes >= 4,
    admite_inscripcion: torneo.estado === 'Abierto' && torneo.categoria_id !== null && enPeriodo && hayCupo,
  };
}

export async function listarTorneos({ disciplina_id, estado } = {}) {
  const modo = modoDeLaUrl();
  await esperar(modo === 'lento' ? 3000 : MS_DEMORA);
  if (modo === 'error') throw errorHttp(500, 'Error al obtener los torneos');
  if (modo === 'vacio') return [];
  return torneosGuardados
    .filter((t) => !disciplina_id || String(t.disciplina_id) === String(disciplina_id))
    .filter((t) => !estado || t.estado.toLowerCase() === String(estado).toLowerCase())
    .map(aRespuesta);
}

export async function listarDisciplinas() {
  await esperar(150);
  return DISCIPLINAS;
}

export async function listarCategorias() {
  await esperar(150);
  return CATEGORIAS;
}

/** Valida como POST/PUT /api/torneos y devuelve el torneo normalizado; lanza 400 con el mensaje del backend. */
function validarTorneo(payload, actual) {
  const nombre = String(payload.nombre ?? '').trim();
  if (!nombre) throw errorHttp(400, 'El nombre es requerido');
  if (nombre.length > 150) throw errorHttp(400, 'Máximo 150 caracteres');
  if (!payload.disciplina_id) throw errorHttp(400, 'disciplina_id es requerido');
  if (!payload.categoria_id) throw errorHttp(400, 'categoria_id es requerido');
  if (!['Individual', 'Equipos'].includes(payload.tipo_torneo)) {
    throw errorHttp(400, 'tipo_torneo debe ser Individual o Equipos');
  }
  const inicio = payload.fecha_inicio || null;
  const fin = payload.fecha_fin || null;
  if (inicio && fin && fin < inicio) throw errorHttp(400, 'La fecha de fin no puede ser menor que la fecha de inicio');
  // La fecha pasada solo se rechaza si cambia (§3.4), para poder editar torneos antiguos
  if (inicio && inicio < hoy && inicio !== actual?.fecha_inicio) {
    throw errorHttp(400, 'La fecha de inicio no puede ser anterior a hoy');
  }
  let cupo = null;
  if (payload.cupo_maximo !== null && payload.cupo_maximo !== undefined && payload.cupo_maximo !== '') {
    cupo = Number(payload.cupo_maximo);
    if (!Number.isInteger(cupo) || cupo < 4 || cupo > 256) {
      throw errorHttp(400, 'cupo_maximo debe ser un entero entre 4 y 256');
    }
  }
  if (actual && cupo !== null && cupo < actual.total_participantes) {
    throw errorHttp(409, `El cupo no puede ser menor que los inscritos actuales (${actual.total_participantes})`);
  }
  return {
    nombre,
    disciplina_id: Number(payload.disciplina_id),
    categoria_id: Number(payload.categoria_id),
    tipo_torneo: payload.tipo_torneo,
    fecha_inicio: inicio,
    fecha_fin: fin,
    cupo_maximo: cupo,
  };
}

/** Sin `id` crea (POST, 201 → { torneo_id }); con `id` edita (PUT, 200 → { ok, torneo_id, message }). */
export async function guardarTorneo(payload, id) {
  await esperar(MS_DEMORA);
  if (!id) {
    const nuevo = { torneo_id: siguienteId, ...validarTorneo(payload), estado: 'Abierto', total_participantes: 0 };
    siguienteId += 1;
    torneosGuardados = [nuevo, ...torneosGuardados];
    return { torneo_id: nuevo.torneo_id };
  }
  const actual = torneosGuardados.find((t) => t.torneo_id === id);
  if (!actual) throw errorHttp(404, 'Torneo no encontrado');
  const cambios = validarTorneo(payload, actual);
  torneosGuardados = torneosGuardados.map((t) => (t.torneo_id === id ? { ...t, ...cambios } : t));
  return { ok: true, torneo_id: id, message: 'Torneo actualizado correctamente' };
}

/** Mismo orden de reglas que §3.6; los mensajes son los del código del backend. */
export async function inscribirme(torneoId) {
  await esperar(MS_DEMORA);
  if (modoDeLaUrl() === 'conflicto') throw errorHttp(409, 'El torneo alcanzó su cupo máximo (16 participantes)');
  const torneo = torneosGuardados.find((t) => t.torneo_id === torneoId);
  if (!torneo) throw errorHttp(404, 'Torneo no encontrado');
  if (torneo.estado !== 'Abierto') throw errorHttp(409, 'El torneo no está abierto para inscripciones');
  if (torneo.fecha_inicio !== null && torneo.fecha_inicio <= hoy) {
    throw errorHttp(409, 'Las inscripciones de este torneo están cerradas');
  }
  if (torneo.tipo_torneo === 'Equipos') {
    throw errorHttp(409, 'Este torneo es por equipos: la inscripción la hace el staff');
  }
  if (torneo.categoria_id === null) throw errorHttp(409, 'Este torneo no tiene categoría asignada');
  if (torneo.cupo_maximo !== null && torneo.total_participantes >= torneo.cupo_maximo) {
    throw errorHttp(409, `El torneo alcanzó su cupo máximo (${torneo.cupo_maximo} participantes)`);
  }
  torneosGuardados = torneosGuardados.map((t) => (
    t.torneo_id === torneoId ? { ...t, total_participantes: t.total_participantes + 1 } : t
  ));
  return { participante_id: 200 + torneo.total_participantes };
}
