import React from 'react';
import './IconButton.css';

const VARIANTS = ['ghost', 'glass'];

/**
 * IconButton - botón redondo solo con ícono (editar, más opciones, cerrar…).
 *
 *   <IconButton label="Editar torneo" onClick={editar}><Pencil size={16} /></IconButton>
 *   <IconButton label="Más opciones" variant="glass"><MoreHorizontal size={18} /></IconButton>
 *
 * El texto de `label` es el nombre accesible (aria-label) y el tooltip nativo: es obligatorio
 * porque el botón no tiene texto visible.
 *
 * Props:
 *   label     - nombre accesible del botón (obligatorio)
 *   variant   - 'ghost' (default; transparente, para fondos claros) | 'glass' (vidrio, para fondos navy)
 *   disabled  - deshabilita el botón
 *   type      - atributo type (default 'button')
 *   className - clase extra; opcional
 *   ref       - ref al <button> (React 19 la recibe como prop)
 *   ...rest   - cualquier otro atributo de <button> (onClick, aria-*, etc.)
 */
export function IconButton({ label, variant = 'ghost', disabled = false, type = 'button', className, ref, children, ...rest }) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'ghost';
  const classes = ['ui-icon-button', `ui-icon-button--${safeVariant}`, className].filter(Boolean).join(' ');

  return (
    <button ref={ref} type={type} className={classes} aria-label={label} title={label} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export default IconButton;
