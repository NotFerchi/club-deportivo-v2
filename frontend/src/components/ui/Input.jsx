import React, { useId } from 'react';
import './Input.css';

/**
 * Input - campo de texto con label y mensaje de ayuda (Figma: Input, state).
 *
 *   <Input label="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
 *   <Input label="Correo" error="Este campo es obligatorio" />
 *   <Input label="Folio" helperText="Campo no editable" disabled />
 *
 * Los estados focus y hover los resuelve el CSS.
 *
 * Props:
 *   label      - texto del label; opcional
 *   helperText - mensaje de ayuda bajo el campo; opcional
 *   error      - true marca el campo en error; un string además reemplaza al helperText
 *   disabled   - deshabilita el campo
 *   markRequired - muestra el asterisco de obligatorio sin activar la validación nativa;
 *                el asterisco también aparece si se pasa `required`
 *   id         - id del <input>; si se omite se genera uno
 *   className  - clase extra del contenedor; opcional
 *   ref        - ref al <input> (React 19 la recibe como prop)
 *   ...rest    - cualquier otro atributo de <input> (value, onChange, type, placeholder, etc.)
 */
export function Input({ label, helperText, error = false, disabled = false, markRequired = false, id, className, ref, ...rest }) {
  const generatedId = useId();
  const showRequiredMark = markRequired || Boolean(rest.required);
  const inputId = id || generatedId;
  const message = typeof error === 'string' && error ? error : helperText;
  const messageId = message ? `${inputId}-message` : undefined;

  const classes = [
    'ui-input',
    error && 'ui-input--error',
    disabled && 'ui-input--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && (
        <label className="ui-input__label" htmlFor={inputId}>
          {label}
          {showRequiredMark && <span className="ui-input__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className="ui-input__field"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        {...rest}
      />
      {message && <p id={messageId} className="ui-input__message">{message}</p>}
    </div>
  );
}

export default Input;
