import React from 'react';
import './StatCard.css';

const TONES = ['primary', 'success', 'warning', 'danger', 'neutral'];

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
 *   selected - true resalta la tarjeta y la marca como activa (aria-pressed); úsalo en filtros.
 *              Si se omite, la tarjeta clicable es un simple acceso directo
 *   onClick  - si se pasa, la tarjeta es un <button>
 *   className - clase extra; opcional
 */
export function StatCard({ label, value, hint, icon, tone = 'primary', selected, onClick, className }) {
  const safeTone = TONES.includes(tone) ? tone : 'primary';
  const classes = [
    'ui-stat',
    `ui-stat--${safeTone}`,
    onClick && 'ui-stat--clickable',
    onClick && selected && 'ui-stat--selected',
    className,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className="ui-stat__body">
        <span className="ui-stat__value">{value}</span>
        <span className="ui-stat__label">{label}</span>
        {hint && <span className="ui-stat__hint">{hint}</span>}
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
