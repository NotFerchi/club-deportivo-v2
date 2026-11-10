import React from 'react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import './MatchCard.css';

function Jugador({ nombre, marcador, ganador, apagado }) {
  const classes = ['ui-match__player', ganador && 'ui-match__player--winner', apagado && 'ui-match__player--muted']
    .filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <Avatar name={nombre} size="sm" />
      <span className="ui-match__name">{nombre}</span>
      {ganador && <span className="ui-match__crown" aria-label="Ganador">✓</span>}
      <span className="ui-match__score">{marcador ?? '–'}</span>
    </div>
  );
}

/**
 * MatchCard - un encuentro de un bracket: dos jugadores con su marcador, el estado y los datos
 * del partido. Solo muestra; no tiene acciones.
 *
 *   <MatchCard
 *     jugador1={{ nombre: 'Sofía Torres', marcador: 2, ganador: true }}
 *     jugador2={{ nombre: 'Patricia Flores', marcador: 1 }}
 *     estado={{ label: 'Finalizado', variant: 'success' }}
 *     meta="Cancha 1 · 10:30"
 *     avanza="Avanza a: Final"
 *   />
 *
 * Props:
 *   jugador1, jugador2 - { nombre, marcador?, ganador? }; sin nombre se muestra "Por definir"
 *   estado             - { label, variant } del Badge del kit
 *   meta               - texto de apoyo (cancha, hora); opcional
 *   avanza             - texto "Avanza a: …"; opcional
 *   bye                - true si pasa directo (sin rival)
 *   className          - clase extra; opcional
 */
export function MatchCard({ jugador1, jugador2, estado, meta, avanza, bye = false, className }) {
  const j1 = { nombre: 'Por definir', ...jugador1 };
  const j2 = { nombre: 'Por definir', ...jugador2 };
  const classes = ['ui-match', className].filter(Boolean).join(' ');
  return (
    <article className={classes}>
      <header className="ui-match__head">
        {estado && <Badge variant={estado.variant}>{estado.label}</Badge>}
        {meta && <span className="ui-match__meta">{meta}</span>}
      </header>
      <Jugador {...j1} apagado={j2.ganador} />
      {bye
        ? <p className="ui-match__bye">Pasa directo (sin rival)</p>
        : <Jugador {...j2} apagado={j1.ganador} />}
      {avanza && <footer className="ui-match__foot">{avanza}</footer>}
    </article>
  );
}

export default MatchCard;
