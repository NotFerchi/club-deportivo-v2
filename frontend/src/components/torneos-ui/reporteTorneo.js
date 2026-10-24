// Cálculos del reporte de un torneo (E3.2). Todo sale de la respuesta de
// GET /api/torneos/:id/reporte (docs/api-torneos.md §5.1); no se inventa ningún dato.
// Aplica a torneos de eliminación directa, que es el único bracket que genera el backend.

/** Estado de un encuentro → texto y variante de Badge. */
const ESTADOS_ENCUENTRO = {
  pendiente: { label: 'Pendiente', variant: 'neutral' },
  programado: { label: 'Programado', variant: 'info' },
  finalizado: { label: 'Finalizado', variant: 'success' },
};

export function estadoEncuentro(estado) {
  const clave = String(estado ?? '').trim().toLowerCase();
  return ESTADOS_ENCUENTRO[clave] || { label: estado || 'Sin estado', variant: 'neutral' };
}

/** Número de rondas del bracket = la ronda más alta con encuentros. */
export function totalRondas(encuentros) {
  return encuentros.reduce((max, e) => Math.max(max, e.ronda), 0);
}

/** Nombre de la ronda según su distancia a la final. */
export function etiquetaRonda(ronda, total) {
  if (ronda === total) return 'Final';
  if (ronda === total - 1) return 'Semifinal';
  if (ronda === total - 2) return 'Cuartos de final';
  return `Ronda ${ronda}`;
}

/** Encuentro terminado con dos participantes (un "bye" tiene solo uno y no tiene perdedor). */
function jugado(encuentro) {
  return encuentro.estado === 'finalizado'
    && Boolean(encuentro.ganador)
    && Boolean(encuentro.participante_1)
    && Boolean(encuentro.participante_2);
}

function perdedor(encuentro) {
  const { participante_1: p1, participante_2: p2, ganador } = encuentro;
  return ganador.id === p1.id ? p2 : p1;
}

/**
 * Campeón y posiciones finales, o null si la final aún no tiene ganador.
 * Posiciones: 1.º campeón, 2.º subcampeón y 3.º–4.º los perdedores de las semifinales.
 */
export function calcularPosiciones(encuentros) {
  const total = totalRondas(encuentros);
  if (total === 0) return null;

  const final = encuentros.filter((e) => e.ronda === total && jugado(e)).at(-1);
  if (!final) return null;

  const posiciones = [
    { lugar: '1.º', nombre: final.ganador.nombre, detalle: 'Campeón' },
    { lugar: '2.º', nombre: perdedor(final).nombre, detalle: 'Subcampeón' },
  ];

  if (total >= 2) {
    encuentros
      .filter((e) => e.ronda === total - 1 && jugado(e))
      .forEach((semifinal) => {
        posiciones.push({ lugar: '3.º–4.º', nombre: perdedor(semifinal).nombre, detalle: 'Semifinalista' });
      });
  }

  return { campeon: final.ganador, posiciones };
}

/** Marcador como "6 – 3", o un guion si el encuentro no se ha jugado. */
export function formatMarcador(encuentro) {
  if (encuentro.marcador_1 === null || encuentro.marcador_2 === null) return '—';
  return `${encuentro.marcador_1} – ${encuentro.marcador_2}`;
}
