import React from 'react';
import './Stepper.css';

/**
 * Stepper - barra de progreso por pasos (p. ej. las rondas de un torneo). Solo muestra; no se toca.
 *
 *   <Stepper
 *     ariaLabel="Progreso del torneo"
 *     steps={[
 *       { label: 'Cuartos', done: true },
 *       { label: 'Semifinal', current: true },
 *       { label: 'Final' },
 *     ]}
 *   />
 *
 * Props:
 *   steps     - [{ label, done?, current? }]; done = paso terminado, current = paso en que está
 *   ariaLabel - nombre accesible
 *   className - clase extra; opcional
 */
export function Stepper({ steps, ariaLabel, className }) {
  const classes = ['ui-stepper', className].filter(Boolean).join(' ');
  return (
    <ol className={classes} aria-label={ariaLabel}>
      {steps.map((s) => (
        <li
          key={s.label}
          className={['ui-stepper__step', s.done && 'ui-stepper__step--done', s.current && 'ui-stepper__step--current']
            .filter(Boolean).join(' ')}
          aria-current={s.current ? 'step' : undefined}
        >
          <span className="ui-stepper__dot" aria-hidden="true">{s.done ? '✓' : ''}</span>
          <span className="ui-stepper__label">{s.label}{s.done ? ' (terminada)' : ''}</span>
        </li>
      ))}
    </ol>
  );
}

export default Stepper;
