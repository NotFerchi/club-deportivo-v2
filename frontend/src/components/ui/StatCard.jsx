import React from 'react';
import './StatCard.css';

const TONES = ['primary', 'success', 'warning', 'danger', 'neutral'];
const GRADIENTS = ['reservas', 'clases', 'torneos', 'ludoteca'];

/**
 * StatCard - tarjeta de indicador (KPI): un número grande con su etiqueta.
 * Con `onClick` se vuelve un botón (filtro o acceso directo); con `selected` queda resaltada.
 *
 *   <StatCard label="Reservas hoy" value={12} hint="Espacios reservados" icon={<Calendar size={20} />} tone="warning" />
 *   <StatCard label="Confirmadas" value={8} tone="success" selected={filtro === 'Confirmada'} onClick={() => setFiltro('Confirmada')} />
 *
 * Props:
 *   label    - qué se cuenta
 *   value    - el número (o texto) destacado
 *   hint     - texto de apoyo bajo la etiqueta; opcional
 *   icon     - nodo (ícono) a la derecha del número; opcional
 *   tone     - 'primary' (default) | 'success' | 'warning' | 'danger' | 'neutral'
 *   gradient - 'reservas' | 'clases' | 'torneos' | 'ludoteca': variante destacada con degradado
 *              por área (el texto chico va sobre una pastilla de vidrio oscuro que garantiza ≥4.5:1; el número grande queda con text-shadow, excepción de contraste conocida); ignora `tone`
 *   tag      - etiqueta corta (p. ej. "Hoy") arriba a la derecha, solo con `gradient`; opcional
 *   selected - true resalta la tarjeta y la marca como activa (aria-pressed); úsalo en filtros.
 *              Si se omite, la tarjeta clicable es un simple acceso directo
 *   onClick  - si se pasa, la tarjeta es un <button>
 *   className - clase extra; opcional
 */
export function StatCard({ label, value, hint, icon, tone = 'primary', gradient, tag, selected, onClick, className }) {
  const safeTone = TONES.includes(tone) ? tone : 'primary';
  const safeGradient = GRADIENTS.includes(gradient) ? gradient : undefined;
  const classes = [
    'ui-stat',
    safeGradient ? `ui-stat--gradient ui-stat--${safeGradient}` : `ui-stat--${safeTone}`,
    onClick && 'ui-stat--clickable',
    onClick && selected && 'ui-stat--selected',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      {safeGradient && tag && <span className="ui-stat__tag">{tag}</span>}
      <span className="ui-stat__body">
        <span className="ui-stat__value">{value}</span>
        <span className="ui-stat__caption">
          <span className="ui-stat__label">{label}</span>
          {hint && <span className="ui-stat__hint">{hint}</span>}
        </span>
      </span>
      {icon && <span className="ui-stat__icon" aria-hidden="true">{icon}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-pressed={selected}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}

export default StatCard;
