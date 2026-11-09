import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ellipsis } from 'lucide-react';
import './MemberTabBar.css';

/**
 * MemberTabBar - barra inferior flotante del socio (patrón 2 del tablero M0, "iOS 26 Liquid Glass").
 * Píldora de cristal con 4 accesos y un botón "Más" que abre una hoja con el resto (decisión D3).
 * Solo se muestra en móvil; en escritorio el socio usa las pestañas de arriba.
 *
 *   <MemberTabBar
 *     items={[{ id: 'inicio', label: 'Inicio', icon: LayoutDashboard, to: '/dashboard-socio' }, …]}
 *     moreItems={[{ id: 'evaluar', label: 'Evaluar', icon: Star, to: '/evaluaciones' }, …]}
 *     activeId="inicio"
 *   />
 *
 * Props:
 *   items     - accesos directos (máximo 4): { id, label, icon (componente), to }
 *   moreItems - accesos que van dentro de "Más"; opcional
 *   activeId  - id del acceso activo (de items o de moreItems)
 *   moreLabel - texto del botón de la hoja (default 'Más')
 *   className - clase extra; opcional
 */
export function MemberTabBar({ items, moreItems = [], activeId, moreLabel = 'Más', className }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const moreActive = moreItems.some((item) => item.id === activeId);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const classes = ['ui-memberbar', className].filter(Boolean).join(' ');

  return (
    <nav ref={rootRef} className={classes} aria-label="Navegación principal">
      {open && moreItems.length > 0 && (
        <div className="ui-memberbar__sheet" role="menu" aria-label={moreLabel}>
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <Link
                key={item.id}
                to={item.to}
                role="menuitem"
                className={`ui-memberbar__sheet-item${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {Icon && <Icon size={20} aria-hidden="true" />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={`ui-memberbar__item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {Icon && <Icon size={22} aria-hidden="true" />}
            <span className="ui-memberbar__label">{item.label}</span>
          </Link>
        );
      })}

      {moreItems.length > 0 && (
        <button
          type="button"
          className={`ui-memberbar__item${moreActive || open ? ' is-active' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <Ellipsis size={22} aria-hidden="true" />
          <span className="ui-memberbar__label">{moreLabel}</span>
        </button>
      )}
    </nav>
  );
}

export default MemberTabBar;
