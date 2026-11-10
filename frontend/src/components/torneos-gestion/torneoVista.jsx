// Datos de presentación de la lista de torneos del personal (U4-03). Solo formatea lo que manda
// GET /torneos; no calcula reglas de negocio (el estado y admite_inscripcion vienen del backend).
import React from 'react';
import {
  Bike,
  Dumbbell,
  Flower2,
  Footprints,
  Goal,
  Medal,
  PersonStanding,
  Swords,
  Target,
  Trophy,
  Volleyball,
  Waves
} from 'lucide-react';
import { estadoTorneo } from '../torneos/torneoUtils';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

/** 'YYYY-MM-DD…' → { y, m (0-11), d, fecha (Date local) }; null si no hay fecha. Igual que formatDate. */
export function partesFecha(valor) {
  const match = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  return { y, m, d, fecha: new Date(y, m, d) };
}

/** Bloque de fecha de la fila: { weekday: 'SÁB', day: '15' } (vacío si no hay fecha). */
export function bloqueFecha(torneo) {
  const p = partesFecha(torneo.fecha_inicio);
  if (!p) return { weekday: '', day: '' };
  return { weekday: DIAS[p.fecha.getDay()], day: String(p.d).padStart(2, '0') };
}

/** "15 - 22 Nov", "28 Nov", "28 Nov - 02 Dic" o "Sin fecha". */
export function rangoFechas(torneo) {
  const a = partesFecha(torneo.fecha_inicio);
  const b = partesFecha(torneo.fecha_fin);
  if (!a) return 'Sin fecha';
  const dd = (p) => String(p.d).padStart(2, '0');
  if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) return `${dd(a)} ${MESES_CORTOS[a.m]}`;
  if (a.y === b.y && a.m === b.m) return `${dd(a)} - ${dd(b)} ${MESES_CORTOS[a.m]}`;
  return `${dd(a)} ${MESES_CORTOS[a.m]} - ${dd(b)} ${MESES_CORTOS[b.m]}`;
}

/** "15 al 22 Nov" para el hero. */
export function rangoFechasLargo(torneo) {
  return rangoFechas(torneo).replace(' - ', ' al ');
}

/** Clave y rótulo del mes del torneo para agrupar ("noviembre 2026"). */
export function mesDe(torneo) {
  const p = partesFecha(torneo.fecha_inicio);
  if (!p) return { clave: 'sin-fecha', rotulo: 'Sin fecha' };
  return { clave: `${p.y}-${String(p.m + 1).padStart(2, '0')}`, rotulo: `${MESES[p.m]} ${p.y}` };
}

/** Año para la pastilla "Temporada {año}": el de inicio; si no hay, el actual. */
export function temporadaDe(torneo) {
  return partesFecha(torneo.fecha_inicio)?.y ?? new Date().getFullYear();
}

/** Ordena por fecha de inicio ascendente (como el diseño); los torneos sin fecha van al final. */
export function ordenarPorFecha(torneos) {
  return [...torneos].sort((a, b) => {
    const fa = String(a.fecha_inicio || '');
    const fb = String(b.fecha_inicio || '');
    if (!fa && !fb) return Number(a.torneo_id) - Number(b.torneo_id);
    if (!fa) return 1;
    if (!fb) return -1;
    return fa < fb ? -1 : fa > fb ? 1 : Number(a.torneo_id) - Number(b.torneo_id);
  });
}

/** Agrupa la lista ya ordenada por mes: [{ clave, rotulo, torneos }]. */
export function agruparPorMes(torneos) {
  const grupos = [];
  for (const t of torneos) {
    const { clave, rotulo } = mesDe(t);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === clave) ultimo.torneos.push(t);
    else grupos.push({ clave, rotulo, torneos: [t] });
  }
  return grupos;
}

/** Hoy en la zona del club, 'YYYY-MM-DD'. */
function hoyClub() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

/** Cupo: { inscritos, maximo (número o null), lleno, quedan }. */
export function cupoDe(torneo) {
  const inscritos = Number(torneo.total_participantes) || 0;
  const maximo = Number(torneo.cupo_maximo) > 0 ? Number(torneo.cupo_maximo) : null;
  return {
    inscritos,
    maximo,
    lleno: maximo !== null && inscritos >= maximo,
    quedan: maximo !== null ? Math.max(0, maximo - inscritos) : null
  };
}

/**
 * Pastilla de estado de la fila (variante del Badge del kit + texto):
 * En curso = ice · Inscripciones abiertas = sky · Próximamente = glass · Cupo lleno = muted ·
 * Inscripciones cerradas = warning · Finalizado = neutral · Cancelado = danger.
 */
export function pastillaDe(torneo) {
  switch (torneo.estado) {
    case 'En_curso':
      return { variant: 'ice', label: 'En curso' };
    case 'Abierto': {
      if (cupoDe(torneo).lleno) return { variant: 'muted', label: 'Cupo lleno' };
      const inicioInscripcion = partesFecha(torneo.fecha_inicio_inscripcion);
      if (!torneo.admite_inscripcion && inicioInscripcion && String(torneo.fecha_inicio_inscripcion).slice(0, 10) > hoyClub()) {
        return { variant: 'glass', label: 'Próximamente' };
      }
      return { variant: 'sky', label: 'Inscripciones abiertas' };
    }
    case 'Inscripciones_cerradas':
      return { variant: 'warning', label: 'Inscripciones cerradas' };
    case 'Finalizado':
      return { variant: 'neutral', label: 'Finalizado' };
    case 'Cancelado':
      return { variant: 'danger', label: 'Cancelado' };
    default:
      return { variant: 'neutral', label: estadoTorneo(torneo.estado).label };
  }
}

/** "Cierre de inscripciones 10 Dic 2026" (la API solo da la fecha, sin hora); null si no hay. */
export function cierreInscripciones(torneo) {
  const p = partesFecha(torneo.fecha_fin_inscripcion);
  if (!p) return null;
  return `${String(p.d).padStart(2, '0')} ${MESES_CORTOS[p.m]} ${p.y}`;
}

const ICONOS = [
  [/tenis|p[aá]del|front[oó]n|frontenis|squash/i, Target],
  [/f[uú]tbol/i, Goal],
  [/b[aá]squet|voleibol|voley/i, Volleyball],
  [/nataci[oó]n|acu[aá]t/i, Waves],
  [/atletismo|carrera/i, Footprints],
  [/spinning|ciclismo/i, Bike],
  [/gimnasio|fitness|funcional|acondicionamiento/i, Dumbbell],
  [/yoga|pilates|meditaci[oó]n|barre|columna/i, Flower2],
  [/tae kwon do|karate|box|esgrima/i, Swords],
  [/baile|zumba|jazz|aerobics|gimnasia/i, PersonStanding],
  [/evento/i, Medal]
];

/** Ícono de la disciplina por su nombre; trofeo para las demás. */
export function IconoDisciplina({ nombre, size = 20 }) {
  const Icono = ICONOS.find(([re]) => re.test(String(nombre || '')))?.[1] || Trophy;
  return <Icono size={size} aria-hidden="true" />;
}
