import React, { useId, useRef } from 'react';
import './SegmentedControl.css';

/**
 * SegmentedControl - elegir una opción de 2 a 4 en una píldora (tablero U4-03: "Individual /
 * Por equipos", "Con límite / Sin límite"). Es un grupo de radios (role="radiogroup"), no
 * pestañas: sirve dentro de formularios.
 *
 *   <SegmentedControl
 *     label="Modalidad de juego"
 *     options={[{ value: 'Individual', label: 'Individual', icon: <User size={16} /> }, …]}
 *     value={modalidad}
 *     onChange={setModalidad}
 *   />
 *
 * Teclado: Tab entra en la opción elegida; ← → (y ↑ ↓) cambian la elección.
 *
 * Props:
 *   label        - texto del label; opcional (sin él, pasa `ariaLabel`)
 *   ariaLabel    - nombre accesible si no hay label visible
 *   options      - [{ value, label, icon?, disabled? }]
 *   value        - valor elegido
 *   onChange     - (value) => void
 *   disabled     - deshabilita todo el grupo
 *   helperText   - mensaje bajo el control; opcional
 *   markRequired - muestra el asterisco de obligatorio
 *   fullWidth    - true reparte el ancho entre las opciones
 *   className    - clase extra; opcional
 */
export function SegmentedControl({ label, ariaLabel, options, value, onChange, disabled = false, helperText, markRequired = false, fullWidth = false, className }) {
  const id = useId();
  const ref = useRef(null);
  const activas = options.filter((o) => !o.disabled);

  const mover = (paso) => {
    if (disabled || activas.length === 0) return;
    const i = activas.findIndex((o) => o.value === value);
    const siguiente = activas[(i + paso + activas.length) % activas.length];
    onChange?.(siguiente.value);
    requestAnimationFrame(() => {
      ref.current?.querySelector(`[data-value="${CSS.escape(String(siguiente.value))}"]`)?.focus();
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      mover(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      mover(-1);
    }
  };

  const elegida = options.some((o) => o.value === value);

  return (
    <div className={['ui-segmented', fullWidth && 'ui-segmented--full', disabled && 'ui-segmented--disabled', className].filter(Boolean).join(' ')}>
      {label && (
        <span id={`${id}-label`} className="ui-segmented__label">
          {label}
          {markRequired && (
            <span className="ui-segmented__required" aria-hidden="true">
              {' '}*
            </span>
          )}
        </span>
      )}
      <div
        ref={ref}
        className="ui-segmented__group"
        role="radiogroup"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={helperText ? `${id}-help` : undefined}
        onKeyDown={onKeyDown}
      >
        {options.map((o, i) => {
          const marcada = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              data-value={o.value}
              aria-checked={marcada}
              tabIndex={marcada || (!elegida && i === 0) ? 0 : -1}
              disabled={disabled || o.disabled}
              className={['ui-segmented__option', marcada && 'ui-segmented__option--selected'].filter(Boolean).join(' ')}
              onClick={() => onChange?.(o.value)}
            >
              {o.icon && (
                <span className="ui-segmented__icon" aria-hidden="true">
                  {o.icon}
                </span>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
      {helperText && (
        <p id={`${id}-help`} className="ui-segmented__message">
          {helperText}
        </p>
      )}
    </div>
  );
}

export default SegmentedControl;
