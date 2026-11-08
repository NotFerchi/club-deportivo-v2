import React, { Children, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import './Select.css';

/** Opciones desde <option> hijos (compatibilidad con el uso anterior del <select> nativo). */
function optionsFromChildren(children) {
  return Children.toArray(children)
    .filter((child) => child && child.type === 'option')
    .map((child) => {
      const text = Children.toArray(child.props.children).join('');
      return { value: child.props.value ?? text, label: text, disabled: child.props.disabled };
    });
}

/**
 * Select - lista desplegable accesible (listbox propio, NO el <select> nativo) con el panel
 * de vidrio del diseño. Misma API que antes para no tocar las pantallas.
 *
 *   <Select
 *     label="Disciplina"
 *     placeholder="Todas"
 *     options={[{ value: 1, label: 'Tenis' }, { value: 2, label: 'Pádel' }]}
 *     value={disciplina}
 *     onChange={(e) => setDisciplina(e.target.value)}
 *   />
 *
 * `onChange` recibe un objeto con la forma `{ target: { name, value } }` (value siempre como
 * texto, igual que el <select> nativo), así que `e.target.value` y `e.target.name` siguen
 * funcionando.
 *
 * Teclado: con el foco en el campo, ↑ ↓ Enter o Espacio abren la lista; dentro, ↑ ↓ mueven,
 * Home/End saltan, escribir una letra busca, Enter o Espacio eligen y Escape cierra (sin cerrar
 * el Modal que lo contenga). Tab cierra y sigue.
 *
 * Props:
 *   label        - texto del label; opcional
 *   options      - [{ value, label, disabled? }]; si se omite se usan los <option> de children
 *   placeholder  - si se pasa, se añade una primera opción vacía (value '') con ese texto
 *   value        - valor controlado; sin `value` el componente guarda su propio estado (defaultValue)
 *   onChange     - (e) => void, con e.target.name y e.target.value
 *   name         - se incluye en e.target.name y en un <input type="hidden"> para formularios
 *   helperText   - mensaje de ayuda bajo el campo; opcional
 *   error        - true marca el campo en error; un string además reemplaza al helperText
 *   disabled     - deshabilita el campo
 *   markRequired - muestra el asterisco sin activar la validación nativa; también con `required`
 *                  (que además pone aria-required; el navegador NO valida este campo al enviar)
 *   id           - id del campo; si se omite se genera uno
 *   className    - clase extra del contenedor; opcional
 *   ref          - ref al botón del campo (React 19 la recibe como prop)
 *   ...rest      - otros atributos para el botón del campo (aria-*, data-*, etc.)
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
  value: valueProp,
  defaultValue,
  onChange,
  name,
  required,
  ...rest
}) {
  const generatedId = useId();
  const baseId = id || generatedId;
  const listId = `${baseId}-list`;
  const labelId = `${baseId}-label`;
  const valueId = `${baseId}-value`;
  const messageId = `${baseId}-message`;

  const isControlled = valueProp !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');
  const current = String(isControlled ? (valueProp ?? '') : innerValue);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const typeahead = useRef({ text: '', timer: null });

  const items = [
    ...(placeholder !== undefined ? [{ value: '', label: placeholder, isPlaceholder: true }] : []),
    ...(options || optionsFromChildren(children)),
  ];
  const selectedIndex = items.findIndex((item) => String(item.value) === current);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null;
  const showsPlaceholder = !selectedItem || selectedItem.isPlaceholder;
  const displayText = showsPlaceholder ? (placeholder ?? '') : selectedItem.label;

  const setRefs = (node) => {
    triggerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const message = typeof error === 'string' && error ? error : helperText;
  const showRequiredMark = markRequired || Boolean(required);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActive(selectedIndex >= 0 ? selectedIndex : items.findIndex((item) => !item.disabled));
  };

  const choose = (index) => {
    const item = items[index];
    if (!item || item.disabled) return;
    const next = String(item.value);
    if (!isControlled) setInnerValue(next);
    if (next !== current) {
      const target = { name, value: next };
      onChange?.({ target, currentTarget: target, type: 'change' });
    }
    close();
    triggerRef.current?.focus();
  };

  // mueve el índice activo saltando opciones deshabilitadas
  const move = (from, step) => {
    if (items.length === 0) return -1;
    let index = from;
    for (let i = 0; i < items.length; i += 1) {
      index = (index + step + items.length) % items.length;
      if (!items[index].disabled) return index;
    }
    return from;
  };

  // cerrar con clic fuera (el panel vive en un portal, por eso se revisa aparte)
  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // la opción activa siempre visible al navegar con teclado
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${baseId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, baseId]);

  useEffect(() => () => clearTimeout(typeahead.current.timer), []);

  const handleKeyDown = (event) => {
    if (disabled) return;
    const { key } = event;

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => move(i, 1));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => move(i, -1));
    } else if (key === 'Home') {
      event.preventDefault();
      setActive(move(-1, 1));
    } else if (key === 'End') {
      event.preventDefault();
      setActive(move(0, -1));
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (key === 'Escape') {
      // evita que el mismo Escape cierre el Modal que contiene al Select
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (key === 'Tab') {
      close();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // búsqueda por letras
      const state = typeahead.current;
      clearTimeout(state.timer);
      state.text += key.toLowerCase();
      state.timer = setTimeout(() => { state.text = ''; }, 600);
      const match = items.findIndex((item) => !item.disabled && String(item.label).toLowerCase().startsWith(state.text));
      if (match >= 0) setActive(match);
    }
  };

  const classes = [
    'ui-select',
    open && 'ui-select--open',
    error && 'ui-select--error',
    disabled && 'ui-select--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && (
        <span id={labelId} className="ui-select__label" onClick={() => !disabled && triggerRef.current?.focus()}>
          {label}
          {showRequiredMark && <span className="ui-select__required" aria-hidden="true"> *</span>}
        </span>
      )}
      <button
        {...rest}
        ref={setRefs}
        id={baseId}
        type="button"
        role="combobox"
        className="ui-select__field"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
        aria-activedescendant={open && active >= 0 ? `${baseId}-opt-${active}` : undefined}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
      >
        <span id={valueId} className={showsPlaceholder ? 'ui-select__value ui-select__value--placeholder' : 'ui-select__value'}>
          {displayText || ' '}
        </span>
        <ChevronDown size={18} className="ui-select__chevron" aria-hidden="true" />
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      <FloatingPanel anchorRef={triggerRef} panelRef={panelRef} open={open} className="ui-select__panel">
        <ul id={listId} role="listbox" aria-labelledby={label ? labelId : undefined} className="ui-select__list">
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            const classesOption = [
              'ui-select__option',
              index === active && 'ui-select__option--active',
              selected && 'ui-select__option--selected',
              item.disabled && 'ui-select__option--disabled',
              item.isPlaceholder && 'ui-select__option--placeholder',
            ].filter(Boolean).join(' ');
            return (
              <li
                key={`${item.value}-${index}`}
                id={`${baseId}-opt-${index}`}
                role="option"
                aria-selected={selected}
                aria-disabled={item.disabled || undefined}
                className={classesOption}
                onMouseEnter={() => !item.disabled && setActive(index)}
                // mousedown (no click) para elegir antes de que el campo pierda el foco
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(index);
                }}
              >
                <span className="ui-select__option-label">{item.label}</span>
                {selected && !item.isPlaceholder && <Check size={16} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      </FloatingPanel>
      {message && <p id={messageId} className="ui-select__message">{message}</p>}
    </div>
  );
}

export default Select;
