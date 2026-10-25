import React from 'react';
import './Chip.css';

/**
 * Chip - etiqueta seleccionable (activa/inactiva), para elegir varias opciones de una lista corta.
 *
 *   {disciplinas.map((d) => (
 *     <Chip key={d.id} selected={elegidas.includes(d.nombre)} onClick={() => alternar(d.nombre)}>
 *       {d.nombre}
 *     </Chip>
 *   ))}
 *
 * Es un <button aria-pressed>: el estado también lo leen los lectores de pantalla,
 * no solo se ve por el color.
 *
 * Props:
 *   selected  - true la marca como elegida (muestra además una palomita)
 *   disabled  - deshabilita el chip
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <button> (onClick, aria-*, etc.)
 */
export function Chip({ selected = false, disabled = false, className, children, ...rest }) {
  const classes = ['ui-chip', selected && 'ui-chip--selected', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} aria-pressed={selected} disabled={disabled} {...rest}>
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

export default Chip;
