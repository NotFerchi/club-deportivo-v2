import React from 'react';
import './Button.css';

const VARIANTS = ['primary', 'secondary', 'error'];

/**
 * Button - botón del UI Kit (Figma: Button, variant × state).
 *
 *   <Button onClick={guardar}>Guardar</Button>
 *   <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
 *   <Button variant="error" disabled>Eliminar</Button>
 *
 * El estado hover lo resuelve el CSS; disabled es el atributo nativo.
 *
 * Props:
 *   variant   - 'primary' (default) | 'secondary' | 'error'
 *   disabled  - deshabilita el botón
 *   type      - atributo type (default 'button', para no enviar formularios por accidente)
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <button> (onClick, aria-*, etc.)
 */
export function Button({ variant = 'primary', disabled = false, type = 'button', className, children, ...rest }) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'primary';
  const classes = ['ui-button', `ui-button--${safeVariant}`, className].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export default Button;
