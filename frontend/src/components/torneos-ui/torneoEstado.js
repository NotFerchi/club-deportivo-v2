// Estado de un torneo → texto y variante del Badge del kit. Un solo lugar para toda la UI nueva.
// (No reutiliza components/torneos/torneoUtils.js: ese archivo usa colores sueltos y sigue
// siendo de las pantallas viejas, como el bracket.)

export const ESTADOS_TORNEO = [
  { value: 'Abierto', label: 'Abierto', variant: 'success' },
  { value: 'Inscripciones_cerradas', label: 'Inscripciones cerradas', variant: 'warning' },
  { value: 'En_curso', label: 'En curso', variant: 'info' },
  { value: 'Finalizado', label: 'Finalizado', variant: 'neutral' },
  { value: 'Cancelado', label: 'Cancelado', variant: 'danger' },
];

/** Etiqueta y variante de Badge de un estado; un valor desconocido se muestra tal cual. */
export function estadoTorneo(estado) {
  return ESTADOS_TORNEO.find((e) => e.value === estado) || {
    value: estado,
    label: estado || 'Sin estado',
    variant: 'neutral',
  };
}

/** "2026-11-07" → "07 nov 2026". Sin fecha → "Sin fecha". No pasa por Date en UTC. */
export function formatFecha(valor) {
  const m = String(valor ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 'Sin fecha';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ZONA_CLUB = 'America/Mexico_City';

/** Hoy en la zona del club como "YYYY-MM-DD" (el backend compara con esa misma fecha, no con la UTC). */
export function hoyEnClub(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CLUB, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

const soloFecha = (valor) => String(valor ?? '').match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

function diaAnterior(ymd) {
  const [a, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Periodo de inscripción de un torneo según el contrato (§3.2, F-07): { abre, cierra } como "YYYY-MM-DD".
 * Abre en fecha_inicio_inscripcion (inclusive). Cierra en fecha_fin_inscripcion (inclusive) o, si no
 * hay, el día anterior a fecha_inicio. Un valor null significa sin límite en ese extremo.
 */
export function periodoInscripcion(torneo) {
  const abre = soloFecha(torneo.fecha_inicio_inscripcion);
  const fin = soloFecha(torneo.fecha_fin_inscripcion);
  const inicio = soloFecha(torneo.fecha_inicio);
  return { abre, cierra: fin || (inicio ? diaAnterior(inicio) : null) };
}

/** "2026-11-14" → "14/11" */
const formatDiaMes = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * Motivo por el que un torneo no admite inscripción, para explicárselo al socio.
 * Usa solo campos del contrato (§3.2); devuelve null si sí admite inscripción.
 * `hoy` ("YYYY-MM-DD", zona del club) se puede pasar para probar.
 */
export function motivoSinInscripcion(torneo, hoy = hoyEnClub()) {
  if (torneo.admite_inscripcion) return null;
  if (torneo.estado !== 'Abierto') return 'El torneo no está abierto para inscripciones.';
  if (!torneo.categoria_id) return 'El torneo no tiene categoría asignada.';
  const { abre, cierra } = periodoInscripcion(torneo);
  if (abre && hoy < abre) return `El periodo de inscripción aún no abre (abre el ${formatDiaMes(abre)}).`;
  if (cierra && hoy > cierra) return 'El periodo de inscripción ya terminó.';
  if (torneo.cupo_maximo !== null && torneo.total_participantes >= torneo.cupo_maximo) {
    return `El torneo alcanzó su cupo máximo (${torneo.cupo_maximo} participantes).`;
  }
  return 'Por ahora no se puede inscribir en este torneo.';
}

/**
 * "2026-11-08T10:30" → "08 nov 2026, 10:30". Sin valor → "Por programar".
 * El backend manda la hora del club como texto local, sin zona: no se pasa por Date en UTC.
 */
export function formatFechaHora(valor) {
  const m = String(valor ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return 'Por programar';
  return `${formatFecha(m[1])}, ${m[2]}`;
}
