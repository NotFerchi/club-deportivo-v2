import React from 'react';
import { Activity, Bike, Dumbbell, Flower2, Footprints, Goal, Music, Swords, Trophy, Volleyball, Waves } from 'lucide-react';

// Palabra clave de la disciplina → ícono. Lo que no coincide usa el trofeo.
const ICONOS = [
  [/tenis|p[aá]del|squash|frontenis|frontón|fronton|raqueta/, Volleyball],
  [/f[uú]tbol|futbol|soccer/, Goal],
  [/nataci[oó]n|acu[aá]tic|nado|waterpolo/, Waves],
  [/atletismo|correr|carrera|maraton|marat[oó]n/, Footprints],
  [/fitness|funcional|acondicionamiento|spinning|gimnasio|pesas/, Dumbbell],
  [/yoga|pilates|meditaci[oó]n|barre|zumba|higiene/, Flower2],
  [/baile|jazz|aerobics|danza/, Music],
  [/taekwondo|tae kwon|box|karate|judo|artes marciales/, Swords],
  [/ciclismo|bici|bike/, Bike],
  [/b[aá]squet|basquet|voleibol|gimnasia/, Activity],
];

/** Ícono (elemento de lucide-react) para el nombre de una disciplina. */
export function iconoDisciplina(nombre, size = 160) {
  const texto = String(nombre || '').toLowerCase();
  const encontrado = ICONOS.find(([patron]) => patron.test(texto));
  const Icono = encontrado ? encontrado[1] : Trophy;
  return <Icono size={size} strokeWidth={1.25} />;
}
