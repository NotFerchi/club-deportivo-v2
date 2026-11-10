import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './Input.css';

/**
 * Input - campo de texto con label y mensaje de ayuda (Figma: Input, state).
 *
 *   <Input label="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} />
 *   <Input label="Correo" error="Este campo es obligatorio" />
 *   <Input label="Folio" helperText="Campo no editable" disabled />
 *   <Input label="Contraseña" type="password" icon={<Lock size={16} />} revealable />
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
 *   icon       - ícono decorativo a la izquierda del texto; opcional
 *   revealable - con type="password", agrega el botón del ojo para mostrar u ocultar el texto
 *   id         - id del <input>; si se omite se genera uno
 *   className  - clase extra del contenedor; opcional
 *   ref        - ref al <input> (React 19 la recibe como prop)
 *   ...rest    - cualquier otro atributo de <input> (value, onChange, type, placeholder, etc.)
 */
export function Input({
  label,
  helperText,
  error = false,
  disabled = false,
  markRequired = false,
  icon,
  revealable = false,
  id,
  className,
  ref,
  type,
  ...rest
}) {
  const generatedId = useId();
  const [revealed, setRevealed] = useState(false);
  const showRequiredMark = markRequired || Boolean(rest.required);
  const inputId = id || generatedId;
  const message = typeof error === 'string' && error ? error : helperText;
  const messageId = message ? `${inputId}-message` : undefined;
  const canReveal = revealable && type === 'password';

  const classes = [
    'ui-input',
    error && 'ui-input--error',
    disabled && 'ui-input--disabled',
    icon && 'ui-input--with-icon',
    canReveal && 'ui-input--with-action',
    className,
  ].filter(Boolean).join(' ');

  const field = (
    <input
      ref={ref}
      id={inputId}
      className="ui-input__field"
      type={canReveal && revealed ? 'text' : type}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={messageId}
      {...rest}
    />
  );

  return (
    <div className={classes}>
      {label && (
        <label className="ui-input__label" htmlFor={inputId}>
          {label}
          {showRequiredMark && <span className="ui-input__required" aria-hidden="true"> *</span>}
        </label>
      )}
      {icon || canReveal ? (
        <div className="ui-input__control">
          {icon && <span className="ui-input__icon" aria-hidden="true">{icon}</span>}
          {field}
          {canReveal && (
            <button
              type="button"
              className="ui-input__action"
              onClick={() => setRevealed((v) => !v)}
              disabled={disabled}
              aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={revealed}
              aria-controls={inputId}
            >
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
      ) : field}
      {message && <p id={messageId} className="ui-input__message">{message}</p>}
    </div>
  );
}

export default Input;
