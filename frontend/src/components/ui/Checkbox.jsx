import React, { useId } from 'react';
import './Checkbox.css';

/**
 * Checkbox - casilla con su texto; al pulsar el texto también se marca.
 *
 *   <Checkbox label="Instructor activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
 *
 * Props:
 *   label     - texto junto a la casilla
 *   disabled  - deshabilita la casilla
 *   id        - id del <input>; si se omite se genera uno
 *   className - clase extra del contenedor; opcional
 *   ...rest   - cualquier otro atributo de <input> (checked, onChange, name, etc.)
 */
export function Checkbox({ label, disabled = false, id, className, ...rest }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const classes = ['ui-checkbox', disabled && 'ui-checkbox--disabled', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <input id={inputId} type="checkbox" className="ui-checkbox__input" disabled={disabled} {...rest} />
      {label && <label className="ui-checkbox__label" htmlFor={inputId}>{label}</label>}
    </div>
  );
}

export default Checkbox;
