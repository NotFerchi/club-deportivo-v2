// Presentación del cuadro del personal (U4-03, Paso 2): convierte el bracket de GET /torneos/:id/bracket
// al formato del Bracket del kit. Solo formatea; ganadores, byes y estados salen de la API
// (mismas reglas de torneos/torneoUtils que usaba BracketVisual).
import { getParticipantName, isBye, isWinner, normalizeEstado } from '../torneos/torneoUtils';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ZONA_CLUB = 'America/Mexico_City';

/** Nombre de la ronda por su distancia a la final. */
export function nombreRonda(indice, total) {
  const faltan = total - 1 - indice;
  if (faltan === 0) return 'Final';
  if (faltan === 1) return 'Semifinal';
  if (faltan === 2) return 'Cuartos de final';
  if (faltan === 3) return 'Octavos de final';
  return `Ronda ${indice + 1}`;
}

/** Rondas ordenadas (1, 2, …) con sus encuentros por encuentro_id, como BracketVisual. */
export function rondasOrdenadas(bracket) {
  return [...bracket]
    .filter((r) => Array.isArray(r.encuentros) && r.encuentros.length > 0)
    .sort((a, b) => Number(a.ronda) - Number(b.ronda))
    .map((r) => ({ ...r, encuentros: [...r.encuentros].sort((a, b) => Number(a.encuentro_id) - Number(b.encuentro_id)) }));
}

/**
 * hora_programada → { fecha: 'YYYY-MM-DD', hora: 'HH:mm' } en la hora del club; vacíos si no hay.
 * Si llega como texto local ('YYYY-MM-DDTHH:mm…' sin zona) se toma tal cual; si trae zona, se
 * convierte a la del club (igual que formatTime).
 */
export function partesHorario(valor) {
  if (!valor) return { fecha: '', hora: '' };
  const texto = String(valor);
  const local = texto.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/);
  if (local) return { fecha: local[1], hora: local[2] };
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return { fecha: '', hora: '' };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_CLUB,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** "Sáb 18:00" para la pastilla del encuentro; '' si no hay horario. */
export function horarioCorto(valor) {
  const { fecha, hora } = partesHorario(valor);
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${DIAS_CORTOS[new Date(y, m - 1, d).getDay()]} ${hora}`;
}

/** "18 Nov 2026 · 10:00" para la vista de solo lectura; '' si no hay horario. */
export function horarioLargo(valor) {
  const { fecha, hora } = partesHorario(valor);
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MESES_CORTOS[m - 1]} ${y} · ${hora}`;
}

function estadoEncuentro(enc, bye) {
  const est = normalizeEstado(enc.estado);
  if (est === 'finalizado') return { label: bye ? 'Pase directo' : 'Finalizado', tone: 'success' };
  const corto = horarioCorto(enc.hora_programada);
  if (corto) return { label: corto, tone: 'info' };
  if (est === 'programado') return { label: 'Programado', tone: 'neutral' };
  return { label: 'Pendiente', tone: 'neutral' };
}

function lado(enc, participante, bye, done) {
  const sinRival = bye && !participante?.participante_id;
  const nombre = sinRival ? 'Sin rival' : getParticipantName(participante);
  const marcador = participante === enc.participante_1 ? enc.marcador_1 : enc.marcador_2;
  return {
    name: nombre,
    empty: sinRival || nombre === 'Por definir',
    winner: isWinner(enc, participante),
    score: done && !bye ? (marcador ?? undefined) : undefined
  };
}

/**
 * Bracket de la API → { rounds, champion } para <Bracket>. La siembra no se muestra: la API del
 * cuadro no la da.
 */
export function cuadroParaKit(bracket) {
  const rondas = rondasOrdenadas(bracket);
  const rounds = rondas.map((r, i) => ({
    key: r.ronda,
    label: nombreRonda(i, rondas.length),
    matches: r.encuentros.map((enc) => {
      const bye = isBye(enc, r.ronda);
      const done = normalizeEstado(enc.estado) === 'finalizado';
      return {
        id: enc.encuentro_id,
        label: `#${enc.encuentro_id}`,
        name: `Encuentro #${enc.encuentro_id}`,
        status: estadoEncuentro(enc, bye),
        a: lado(enc, enc.participante_1, bye, done),
        b: lado(enc, enc.participante_2, bye, done)
      };
    })
  }));
  const final = rondas[rondas.length - 1]?.encuentros[0];
  const champion = final && normalizeEstado(final.estado) === 'finalizado' ? final.ganador_nombre || null : null;
  return { rounds, champion };
}

/** Nombre de la ronda de un encuentro (para el subtítulo del panel). */
export function rondaDeEncuentro(bracket, encuentroId) {
  const rondas = rondasOrdenadas(bracket);
  const i = rondas.findIndex((r) => r.encuentros.some((e) => String(e.encuentro_id) === String(encuentroId)));
  return i >= 0 ? nombreRonda(i, rondas.length) : '';
}
