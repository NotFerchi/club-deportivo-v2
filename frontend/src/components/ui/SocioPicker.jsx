import React, { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { FloatingPanel } from './FloatingPanel';
import { Badge } from './Badge';
import './SocioPicker.css';

/**
 * SocioPicker - buscador de socio con resultados en tarjetas (tablero M0, "Member Search Picker").
 * Es solo presentación: NO llama a la API. El padre recibe `onSearch(texto)` (con debounce),
 * hace la consulta que ya tenga y devuelve los resultados en `options`.
 *
 *   <SocioPicker
 *     label="Socio anfitrión"
 *     value={socio}                       // { id, nombre, numero, detalle?, estado? } | null
 *     onChange={setSocio}
 *     onSearch={buscarSocios}             // (texto) => void; el padre actualiza `options`
 *     options={resultados}
 *     loading={buscando}
 *   />
 *
 * Teclado: escribe para buscar; ↑ ↓ recorren los resultados, Enter elige, Escape cierra.
 * Con un socio elegido se muestra su tarjeta con un botón para cambiarlo.
 *
 * Props:
 *   value        - socio elegido o null
 *   onChange     - (socio | null) => void
 *   onSearch     - (texto) => void, llamado tras `debounceMs` y con al menos `minChars` caracteres
 *   options      - [{ id, nombre, numero, detalle?, estado?, estadoVariant? }]
 *   loading      - true muestra "Buscando…"
 *   label, placeholder, helperText, error (true | string), disabled, markRequired
 *   minChars     - mínimo de caracteres para buscar (default 2)
 *   debounceMs   - espera antes de llamar a onSearch (default 300)
 *   emptyMessage - texto sin resultados (default "No se encontraron socios")
 *   id, className
 */
export function SocioPicker({
  value = null,
  onChange,
  onSearch,
  options = [],
  loading = false,
  label,
  placeholder = 'Buscar por nombre o número de socio',
  helperText,
  error = false,
  disabled = false,
  markRequired = false,
  minChars = 2,
  debounceMs = 300,
  emptyMessage = 'No se encontraron socios',
  id,
  className,
}) {
  const generatedId = useId();
  const baseId = id || generatedId;
  const listId = `${baseId}-list`;
  const messageId = `${baseId}-message`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const controlRef = useRef(null);
  const panelRef = useRef(null);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // debounce: avisa al padre solo cuando se deja de escribir
  useEffect(() => {
    if (query.trim().length < minChars) return undefined;
    const timer = setTimeout(() => onSearchRef.current?.(query.trim()), debounceMs);
    return () => clearTimeout(timer);
  }, [query, minChars, debounceMs]);

  // cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      if (rootRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const message = typeof error === 'string' && error ? error : helperText;
  const searching = query.trim().length >= minChars;
  const showPanel = open && searching && !disabled;

  const choose = (socio) => {
    onChange?.(socio);
    setQuery('');
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : -1));
    } else if (event.key === 'Enter') {
      if (showPanel && options[active]) {
        event.preventDefault();
        choose(options[active]);
      }
    } else if (event.key === 'Escape' && showPanel) {
      // no dejar que Escape cierre también el Modal que contenga al picker
      event.stopPropagation();
      setOpen(false);
    }
  };

  const classes = [
    'ui-socio-picker',
    error && 'ui-socio-picker--error',
    disabled && 'ui-socio-picker--disabled',
    className,
  ].filter(Boolean).join(' ');

  const labelNode = label && (
    <label className="ui-socio-picker__label" htmlFor={value ? undefined : baseId}>
      {label}
      {(markRequired) && <span className="ui-socio-picker__required" aria-hidden="true"> *</span>}
    </label>
  );

  if (value) {
    return (
      <div className={classes} ref={rootRef}>
        {labelNode}
        <div className="ui-socio-picker__selected">
          <Avatar name={value.nombre} size="sm" />
          <span className="ui-socio-picker__info">
            <span className="ui-socio-picker__name">{value.nombre}</span>
            <span className="ui-socio-picker__meta">{value.numero ? `No. ${value.numero}` : ''}{value.detalle ? ` · ${value.detalle}` : ''}</span>
          </span>
          {!disabled && (
            <button
              type="button"
              className="ui-socio-picker__clear"
              onClick={() => onChange?.(null)}
              aria-label={`Quitar a ${value.nombre}`}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {message && <p id={messageId} className="ui-socio-picker__message">{message}</p>}
      </div>
    );
  }

  return (
    <div className={classes} ref={rootRef}>
      {labelNode}
      <div className="ui-socio-picker__control" ref={controlRef}>
        <Search size={16} className="ui-socio-picker__search-icon" aria-hidden="true" />
        <input
          id={baseId}
          type="text"
          role="combobox"
          autoComplete="off"
          className="ui-socio-picker__input"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? `${baseId}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <FloatingPanel anchorRef={controlRef} panelRef={panelRef} open={showPanel} className="ui-socio-picker__panel">
          <>
            {loading ? (
              <p className="ui-socio-picker__status" role="status">Buscando…</p>
            ) : options.length === 0 ? (
              <p className="ui-socio-picker__status" role="status">{emptyMessage}</p>
            ) : (
              <ul id={listId} role="listbox" aria-label={label || 'Resultados de socios'} className="ui-socio-picker__list">
                {options.map((socio, index) => (
                  <li
                    key={socio.id}
                    id={`${baseId}-opt-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className={index === active ? 'ui-socio-picker__option ui-socio-picker__option--active' : 'ui-socio-picker__option'}
                    onMouseEnter={() => setActive(index)}
                    // mousedown (no click) para elegir antes de que el input pierda el foco
                    onMouseDown={(event) => {
                      event.preventDefault();
                      choose(socio);
                    }}
                  >
                    <Avatar name={socio.nombre} size="sm" />
                    <span className="ui-socio-picker__info">
                      <span className="ui-socio-picker__name">{socio.nombre}</span>
                      <span className="ui-socio-picker__meta">{socio.numero ? `No. ${socio.numero}` : ''}{socio.detalle ? ` · ${socio.detalle}` : ''}</span>
                    </span>
                    {socio.estado && <Badge variant={socio.estadoVariant || 'success'}>{socio.estado}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </>
        </FloatingPanel>
      </div>
      {message && <p id={messageId} className="ui-socio-picker__message">{message}</p>}
    </div>
  );
}

export default SocioPicker;
