// Utilidades compartidas por TournamentBracket y sus componentes.

// Estados del torneo: etiqueta legible y colores, en un solo lugar (B-23)
export const ESTADOS_TORNEO = [
  { value: 'Abierto', label: 'Abierto', color: '#15803d', bg: '#dcfce7' },
  { value: 'Inscripciones_cerradas', label: 'Inscripciones cerradas', color: '#b45309', bg: '#fef3c7' },
  { value: 'En_curso', label: 'En curso', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'Finalizado', label: 'Finalizado', color: '#475569', bg: '#f1f5f9' },
  { value: 'Cancelado', label: 'Cancelado', color: '#b91c1c', bg: '#fee2e2' }
];

export const DEFAULT_ESTADO_OPTIONS = ESTADOS_TORNEO.map(({ value, label }) => ({ value, label }));

/** Etiqueta y colores de un estado del torneo; un valor desconocido se muestra tal cual. */
export function estadoTorneo(estado) {
  return (
    ESTADOS_TORNEO.find((e) => e.value === estado) || {
      value: estado,
      label: estado || 'Sin estado',
      color: '#475569',
      bg: '#f1f5f9'
    }
  );
}

const ESTADOS_ENCUENTRO = {
  pendiente: 'pendiente',
  programado: 'programado',
  finalizado: 'finalizado'
};

export function normalizeEstado(estado) {
  return String(estado || '')
    .trim()
    .toLowerCase();
}

export function formatDate(value) {
  if (!value) return 'Sin fecha';
  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(value) {
  if (!value) return '';
  const stringValue = String(value);
  const timeOnlyMatch = stringValue.match(/^(\d{2}):(\d{2})/);
  if (timeOnlyMatch && !stringValue.includes('T')) return `${timeOnlyMatch[1]}:${timeOnlyMatch[2]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return stringValue;
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
}

export function buildTorneosPath(filters) {
  const params = new URLSearchParams();
  if (filters.disciplina_id) params.set('disciplina_id', filters.disciplina_id);
  if (filters.estado) params.set('estado', filters.estado);
  const queryString = params.toString();
  return `/torneos${queryString ? `?${queryString}` : ''}`;
}

/**
 * Mensaje de un error de apiRequest: el del backend si hubo respuesta (error.status);
 * si no hubo respuesta (backend caído, sin red), "Error de conexión".
 */
export function mensajeDeError(error, fallback = 'Error de conexión') {
  return error?.status ? error.message || fallback : fallback;
}

export function getParticipantName(participante) {
  if (!participante) return 'Por definir';
  return (
    participante.nombre ||
    participante.nombre_completo ||
    participante.nombre_socio ||
    participante.socio_nombre ||
    participante.usuario_nombre ||
    participante.persona_nombre ||
    participante.socio?.nombre ||
    participante.socio?.nombre_completo ||
    participante.usuario?.nombre ||
    participante.persona?.nombre ||
    participante.miembro?.nombre ||
    'Por definir'
  );
}

/** Ganador del encuentro: solo por ganador_id, nunca por nombre (B-17). */
export function isWinner(encuentro, participante) {
  if (normalizeEstado(encuentro.estado) !== ESTADOS_ENCUENTRO.finalizado) return false;
  if (!encuentro.ganador_id || !participante?.participante_id) return false;
  return String(encuentro.ganador_id) === String(participante.participante_id);
}

/** Bye (pase directo): encuentro de ronda 1, finalizado y con un solo participante. */
export function isBye(encuentro, ronda) {
  if (Number(ronda) !== 1 || normalizeEstado(encuentro?.estado) !== ESTADOS_ENCUENTRO.finalizado) return false;
  const tiene1 = Boolean(encuentro.participante_1?.participante_id);
  const tiene2 = Boolean(encuentro.participante_2?.participante_id);
  return tiene1 !== tiene2;
}
