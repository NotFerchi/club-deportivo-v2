import React from 'react';
import './ProgressBar.css';

/**
 * ProgressBar - barra de avance con texto "valor/máximo" (p. ej. cupo de un torneo).
 *
 *   <ProgressBar value={6} max={16} label="Inscritos" />
 *
 * El color cambia solo: normal por debajo del 80 %, de advertencia desde el 80 % y
 * de peligro cuando llega al máximo. El texto "6/16" siempre se muestra, así el
 * estado no depende solo del color.
 *
 * Props:
 *   value     - valor actual (se limita entre 0 y max)
 *   max       - valor máximo; si no es un número mayor que 0 la barra no se dibuja
 *   label     - texto a la izquierda del contador; opcional
 *   className - clase extra del contenedor; opcional
 */
export function ProgressBar({ value = 0, max, label, className }) {
  const maxNumber = Number(max);
  const valid = Number.isFinite(maxNumber) && maxNumber > 0;
  const current = valid ? Math.min(Math.max(Number(value) || 0, 0), maxNumber) : 0;
  const percent = valid ? (current / maxNumber) * 100 : 0;

  let level = 'normal';
  if (valid && current >= maxNumber) level = 'full';
  else if (percent >= 80) level = 'high';

  const classes = ['ui-progress', `ui-progress--${level}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="ui-progress__text">
        {label && <span className="ui-progress__label">{label}</span>}
        {valid && <span className="ui-progress__count">{current}/{maxNumber}</span>}
      </div>
      {valid && (
        <div
          className="ui-progress__track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxNumber}
          aria-valuenow={current}
          aria-label={label || 'Avance'}
        >
          <div className="ui-progress__fill" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

export default ProgressBar;
