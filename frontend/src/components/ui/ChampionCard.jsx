import React from 'react';
import './ChampionCard.css';

/**
 * ChampionCard - tarjeta del campeón de un torneo, con el degradado del módulo. Si todavía no
 * hay campeón, muestra "Por definir" y el texto de apoyo.
 *
 *   <ChampionCard nombre="Sofía Torres" torneo="Copa del Rey" />
 *   <ChampionCard torneo="Copa del Rey" />   // aún sin campeón
 *
 * Props:
 *   nombre    - nombre del campeón; sin nombre = aún no hay
 *   torneo    - nombre del torneo; opcional
 *   className - clase extra; opcional
 */
export function ChampionCard({ nombre, torneo, className }) {
  const classes = ['ui-champion', className].filter(Boolean).join(' ');
  return (
    <section className={classes} aria-label="Campeón del torneo">
      <span className="ui-champion__pill">Campeón del torneo</span>
      <p className="ui-champion__name">{nombre || 'Por definir'}</p>
      <p className="ui-champion__note">
        {nombre ? torneo : 'El campeón se conocerá al terminar la final.'}
      </p>
    </section>
  );
}

export default ChampionCard;
