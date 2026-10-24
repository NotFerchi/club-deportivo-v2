import React from 'react';
import './Badge.css';

const VARIANTS = ['neutral', 'success', 'warning', 'danger', 'info'];

/**
 * Badge - etiqueta pequeña para estados (p. ej. Abierto, En curso, Cancelado).
 *
 *   <Badge variant="success">Abierto</Badge>
 *   <Badge variant="warning">Inscripciones cerradas</Badge>
 *   <Badge variant="danger">Cancelado</Badge>
 *
 * El color no es lo único que comunica el estado: el texto siempre va dentro.
 *
 * Props:
 *   variant   - 'neutral' (default) | 'success' | 'warning' | 'danger' | 'info'
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <span>
 */
export function Badge({ variant = 'neutral', className, children, ...rest }) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'neutral';
  const classes = ['ui-badge', `ui-badge--${safeVariant}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

export default Badge;
