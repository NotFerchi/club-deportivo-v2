// Utilidades compartidas por TournamentBracket y sus componentes.

export const DEFAULT_ESTADO_OPTIONS = [
  { value: 'Abierto', label: 'Abierto' },
  { value: 'Inscripciones_cerradas', label: 'Inscripciones cerradas' },
  { value: 'En_curso', label: 'En curso' },
  { value: 'Finalizado', label: 'Finalizado' }
];

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

export function getErrorMessage(error, fallback) {
  if (error?.name === 'AbortError') return '';
  return error?.message || fallback;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
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

export function isWinner(encuentro, participante) {
  if (normalizeEstado(encuentro.estado) !== ESTADOS_ENCUENTRO.finalizado) return false;
  if (encuentro.ganador_id && participante?.participante_id) {
    return String(encuentro.ganador_id) === String(participante.participante_id);
  }
  return (
    Boolean(encuentro.ganador_nombre) &&
    normalizeText(encuentro.ganador_nombre) === normalizeText(getParticipantName(participante))
  );
}
