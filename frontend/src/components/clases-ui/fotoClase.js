// Foto local por familia de disciplina para las tarjetas de Clases (mismas fotos que Reservar).
// Sin acentos ni mayúsculas. El orden importa: "frontenis" contiene "tenis", por eso el frontón va
// antes. Sin coincidencia (p. ej. Pilates sí usa la del estudio; Atletismo no tiene) → undefined y
// la tarjeta se queda con su degradado y el ícono de la disciplina.
import fotoPadel from '../../assets/img/deporte-padel.webp';
import fotoTenis from '../../assets/img/deporte-tenis.webp';
import fotoFutbol from '../../assets/img/deporte-futbol.webp';
import fotoNatacion from '../../assets/img/deporte-natacion.webp';
import fotoFitness from '../../assets/img/deporte-fitness.webp';
import fotoSquash from '../../assets/img/deporte-squash.webp';
import fotoBasquetbol from '../../assets/img/deporte-basquetbol.webp';
import fotoFronton from '../../assets/img/deporte-fronton.webp';
import fotoVoleibol from '../../assets/img/deporte-voleibol.webp';
import fotoEstudio from '../../assets/img/deporte-estudio.webp';

const FOTOS_POR_FAMILIA = [
  [/padel/, fotoPadel],
  [/squash/, fotoSquash],
  [/fronton|frontenis/, fotoFronton],
  [/tenis/, fotoTenis],
  [/futbol/, fotoFutbol],
  [/basquet/, fotoBasquetbol],
  [/volei|voley/, fotoVoleibol],
  [/natacion|alberca/, fotoNatacion],
  [/fitness|gimnasio|acondicionamiento|funcional|spinning|zumba|aerobic/, fotoFitness],
  [/yoga|pilates|meditacion|barre|higiene/, fotoEstudio],
];

/** Foto de una disciplina, o undefined si no hay. */
export function fotoClase(nombre) {
  const texto = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return FOTOS_POR_FAMILIA.find(([patron]) => patron.test(texto))?.[1];
}
