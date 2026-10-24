import React, { useId } from 'react';
import './Select.css';

/**
 * Select - lista desplegable con label y mensaje de ayuda. Mismo aspecto y props que Input.
 *
 *   <Select
 *     label="Disciplina"
 *     placeholder="Todas"
 *     options={[{ value: 1, label: 'Tenis' }, { value: 2, label: 'Pádel' }]}
 *     value={disciplina}
 *     onChange={(e) => setDisciplina(e.target.value)}
 *   />
 *   <Select label="Categoría" options={categorias} error="Elige una categoría" />
 *
 * Los estados focus y hover los resuelve el CSS.
 *
 * Props:
 *   label       - texto del label; opcional
 *   options     - [{ value, label }]; si se omite se usan los <option> de children
 *   placeholder - texto de la primera opción vacía (value ''); opcional
 *   helperText  - mensaje de ayuda bajo el campo; opcional
 *   error       - true marca el campo en error; un string además reemplaza al helperText
 *   disabled    - deshabilita el campo
 *   markRequired - muestra el asterisco sin activar la validación nativa;
 *                 también aparece si se pasa `required`
 *   id          - id del <select>; si se omite se genera uno
 *   className   - clase extra del contenedor; opcional
 *   ref         - ref al <select> (React 19 la recibe como prop)
 *   ...rest     - cualquier otro atributo de <select> (value, onChange, name, etc.)
 */
export function Select({
  label,
  options,
  placeholder,
  helperText,
  error = false,
  disabled = false,
  markRequired = false,
  id,
  className,
  ref,
  children,
  ...rest
}) {
  const generatedId = useId();
  const showRequiredMark = markRequired || Boolean(rest.required);
  const selectId = id || generatedId;
  const message = typeof error === 'string' && error ? error : helperText;
  const messageId = message ? `${selectId}-message` : undefined;

  const classes = [
    'ui-select',
    error && 'ui-select--error',
    disabled && 'ui-select--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && (
        <label className="ui-select__label" htmlFor={selectId}>
          {label}
          {showRequiredMark && <span className="ui-select__required" aria-hidden="true"> *</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className="ui-select__field"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))
          : children}
      </select>
      {message && <p id={messageId} className="ui-select__message">{message}</p>}
    </div>
  );
}

export default Select;
