import React, { useId } from 'react';
import './Textarea.css';

/**
 * Textarea - campo de texto de varias líneas con label, ayuda y contador. Mismo aspecto y props que Input.
 *
 *   <Textarea label="Comentario" value={texto} onChange={e => setTexto(e.target.value)} />
 *   <Textarea label="Comentario" maxLength={500} showCount value={texto} onChange={...} />
 *   <Textarea label="Motivo" error="Este campo es obligatorio" />
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
 *   showCount  - muestra "n / maxLength" bajo el campo; necesita `value` (controlado) y `maxLength`
 *   rows       - líneas visibles; 4 por defecto
 *   id         - id del <textarea>; si se omite se genera uno
 *   className  - clase extra del contenedor; opcional
 *   ref        - ref al <textarea> (React 19 la recibe como prop)
 *   ...rest    - cualquier otro atributo de <textarea> (value, onChange, maxLength, placeholder, etc.)
 */
export function Textarea({
  label,
  helperText,
  error = false,
  disabled = false,
  markRequired = false,
  showCount = false,
  rows = 4,
  id,
  className,
  ref,
  ...rest
}) {
  const generatedId = useId();
  const showRequiredMark = markRequired || Boolean(rest.required);
  const textareaId = id || generatedId;
  const message = typeof error === 'string' && error ? error : helperText;
  const messageId = message ? `${textareaId}-message` : undefined;
  const mostrarContador = showCount && rest.maxLength !== undefined && rest.value !== undefined;

  const classes = [
    'ui-textarea',
    error && 'ui-textarea--error',
    disabled && 'ui-textarea--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && (
        <label className="ui-textarea__label" htmlFor={textareaId}>
          {label}
          {showRequiredMark && <span className="ui-textarea__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className="ui-textarea__field"
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        {...rest}
      />
      {(message || mostrarContador) && (
        <div className="ui-textarea__footer">
          {message && <p id={messageId} className="ui-textarea__message">{message}</p>}
          {mostrarContador && (
            <span className="ui-textarea__count">{String(rest.value).length} / {rest.maxLength}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default Textarea;
