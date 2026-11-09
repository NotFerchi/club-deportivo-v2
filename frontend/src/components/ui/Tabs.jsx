import React, { useId, useRef } from 'react';
import './Tabs.css';

/**
 * Tabs - pestañas tipo segmented control (píldora). Controlado por el padre.
 *
 *   <Tabs
 *     ariaLabel="Filtrar socios"
 *     tabs={[
 *       { value: 'todos', label: 'Todos los socios' },
 *       { value: 'activos', label: 'Con membresía activa', count: 120 },
 *     ]}
 *     value={tab}
 *     onChange={setTab}
 *   />
 *
 * Accesibilidad: role="tablist" / role="tab", aria-selected, y teclado con
 * ← → (y Home/End) que mueven la selección. Solo la pestaña activa entra en el Tab.
 * Para enlazar un panel usa `getTabId(value)` / `aria-labelledby` con el mismo `idPrefix`.
 *
 * Props:
 *   tabs      - [{ value, label, count?, icon?, disabled? }]
 *   value     - valor de la pestaña activa
 *   onChange  - (value) => void
 *   ariaLabel - nombre accesible del grupo (obligatorio si no hay un título visible)
 *   idPrefix  - prefijo de ids (default generado): tab → `${idPrefix}-tab-${value}`, panel → `${idPrefix}-panel-${value}`
 *   fullWidth - true reparte el ancho entre las pestañas (típico en móvil)
 *   className - clase extra; opcional
 */
export function Tabs({ tabs, value, onChange, ariaLabel, idPrefix, fullWidth = false, className }) {
  const generated = useId();
  const prefix = idPrefix || generated;
  const listRef = useRef(null);

  const enabled = tabs.filter((t) => !t.disabled);

  const handleKeyDown = (event) => {
    const index = enabled.findIndex((t) => t.value === value);
    let next;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange?.(next.value);
    // el foco sigue a la selección una vez que React pinta la pestaña nueva
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-tab-value="${CSS.escape(String(next.value))}"]`)?.focus();
    });
  };

  const classes = ['ui-tabs', fullWidth && 'ui-tabs--full', className].filter(Boolean).join(' ');

  return (
    <div ref={listRef} className={classes} role="tablist" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${prefix}-tab-${tab.value}`}
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            data-tab-value={tab.value}
            disabled={tab.disabled}
            className={selected ? 'ui-tabs__tab ui-tabs__tab--selected' : 'ui-tabs__tab'}
            onClick={() => onChange?.(tab.value)}
          >
            {tab.icon && <span className="ui-tabs__icon" aria-hidden="true">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && <span className="ui-tabs__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
