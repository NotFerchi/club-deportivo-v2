import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { IconButton } from './IconButton';
import './Menu.css';

/**
 * Menu - menú de acciones que se abre desde un botón ⋯ (patrón "menu button" de ARIA).
 *
 *   <Menu
 *     label="Opciones de Copa del Rey"
 *     items={[
 *       { id: 'editar', label: 'Editar torneo', icon: <Pencil size={16} />, onSelect: editar },
 *       { id: 'cancelar', label: 'Cancelar torneo', danger: true, onSelect: cancelar },
 *     ]}
 *   />
 *
 * Teclado: Enter, Espacio o ↓ abren y enfocan la primera opción (↑ la última); ↑ ↓ mueven,
 * Home/End saltan, Enter o Espacio eligen, Escape cierra y regresa el foco al botón, Tab cierra.
 * Un clic fuera también cierra. El panel se dibuja en document.body (FloatingPanel) alineado al
 * borde derecho del botón.
 *
 * Props:
 *   label          - nombre accesible del botón (obligatorio; p. ej. "Opciones del torneo")
 *   items          - [{ id, label, icon?, onSelect, danger?, disabled? }]; vacío = no se dibuja nada
 *   triggerVariant - variante del IconButton: 'ghost' (default) | 'glass' (sobre navy)
 *   icon           - ícono del botón (default ⋯)
 *   className      - clase extra del botón; opcional
 */
export function Menu({ label, items = [], triggerVariant = 'ghost', icon, className }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const itemRefs = useRef([]);
  const focusOnOpen = useRef(0);
  const menuId = useId();

  const habilitados = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);

  const abrir = (cual) => {
    focusOnOpen.current = cual === 'last' ? habilitados[habilitados.length - 1] : habilitados[0];
    setOpen(true);
  };

  const cerrar = (devolverFoco = true) => {
    setOpen(false);
    if (devolverFoco) triggerRef.current?.focus({ preventScroll: true });
  };

  // Enfoca la opción pedida cuando el panel ya está en el DOM
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => itemRefs.current[focusOnOpen.current]?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Clic fuera del botón y del panel: cierra sin mover el foco
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  if (items.length === 0) return null;

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      abrir('first');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      abrir('last');
    }
  };

  const enfocar = (index) => itemRefs.current[index]?.focus({ preventScroll: true });

  const mover = (desde, paso) => {
    const pos = habilitados.indexOf(desde);
    enfocar(habilitados[(pos + paso + habilitados.length) % habilitados.length]);
  };

  const onItemKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mover(index, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mover(index, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      enfocar(habilitados[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      enfocar(habilitados[habilitados.length - 1]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cerrar();
    } else if (e.key === 'Tab') {
      cerrar(false);
    }
  };

  const elegir = (item) => {
    if (item.disabled) return;
    cerrar();
    item.onSelect?.();
  };

  return (
    <>
      <IconButton
        ref={triggerRef}
        label={label}
        variant={triggerVariant}
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? cerrar() : abrir('first'))}
        onKeyDown={onTriggerKeyDown}
      >
        {icon || <MoreHorizontal size={18} aria-hidden="true" />}
      </IconButton>
      <FloatingPanel anchorRef={triggerRef} open={open} panelRef={panelRef} align="end" className="ui-menu">
        <ul id={menuId} role="menu" aria-label={label} className="ui-menu__list">
          {items.map((item, index) => (
            <li key={item.id ?? item.label} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                className={['ui-menu__item', item.danger && 'ui-menu__item--danger'].filter(Boolean).join(' ')}
                onClick={() => elegir(item)}
                onKeyDown={(e) => onItemKeyDown(e, index)}
              >
                {item.icon && (
                  <span className="ui-menu__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </>
  );
}

export default Menu;
