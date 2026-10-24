// Estado de un torneo → texto y variante del Badge del kit. Un solo lugar para toda la UI nueva.
// (No reutiliza components/torneos/torneoUtils.js: ese archivo usa colores sueltos y lo
// reemplaza E3.3.)

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

/**
 * Motivo por el que un torneo no admite inscripción, para explicárselo al socio.
 * Usa solo campos del contrato (§3.2); devuelve null si sí admite inscripción.
 */
export function motivoSinInscripcion(torneo) {
  if (torneo.admite_inscripcion) return null;
  if (torneo.estado !== 'Abierto') return 'El torneo no está abierto para inscripciones.';
  if (!torneo.categoria_id) return 'El torneo no tiene categoría asignada.';
  if (torneo.cupo_maximo !== null && torneo.total_participantes >= torneo.cupo_maximo) {
    return `El torneo alcanzó su cupo máximo (${torneo.cupo_maximo} participantes).`;
  }
  return 'El periodo de inscripción ya terminó.';
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
