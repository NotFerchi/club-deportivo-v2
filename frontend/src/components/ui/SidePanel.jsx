import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './SidePanel.css';

/**
 * SidePanel - panel lateral flotante a la derecha (tablero U4-03, "Editar encuentro"). No es
 * modal: la página de atrás se sigue usando (p. ej. para elegir otro encuentro). Cierra con la X
 * y con Escape; al abrir lleva el foco al panel y al cerrar lo devuelve a donde estaba.
 * En pantallas angostas ocupa todo el ancho.
 *
 *   <SidePanel
 *     open={Boolean(encuentro)}
 *     onClose={cerrar}
 *     title="Editar encuentro"
 *     subtitle="Semifinal · Encuentro #12"
 *     footer={<><Button variant="secondary" onClick={cerrar}>Cancelar</Button><Button>Guardar</Button></>}
 *   >
 *     …campos…
 *   </SidePanel>
 *
 * Props:
 *   open      - muestra u oculta el panel
 *   onClose   - acción de la X y de Escape
 *   title     - título (con el punto navy del diseño)
 *   subtitle  - texto bajo el título; opcional
 *   footer    - botones al pie; opcional
 *   className - clase extra; opcional
 */
export function SidePanel({ open, onClose, title, subtitle, footer, className, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const previo = useRef(null);
  // onClose puede cambiar en cada render; el efecto de abrir/cerrar usa siempre el último
  const cerrar = useRef(onClose);
  useEffect(() => {
    cerrar.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    previo.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => {
      // Escape dentro de un Select abierto lo cierra el Select (stopPropagation)
      if (e.key === 'Escape') cerrar.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previo.current && document.contains(previo.current)) previo.current.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <section
      ref={panelRef}
      className={['ui-side-panel', className].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header className="ui-side-panel__header">
        <div className="ui-side-panel__heading">
          <h2 id={titleId} className="ui-side-panel__title">
            <span className="ui-side-panel__dot" aria-hidden="true" />
            {title}
          </h2>
          {subtitle && <p className="ui-side-panel__subtitle">{subtitle}</p>}
        </div>
        <button type="button" className="ui-side-panel__close" onClick={onClose} aria-label="Cerrar panel">
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="ui-side-panel__body">{children}</div>
      {footer && <footer className="ui-side-panel__footer">{footer}</footer>}
    </section>,
    document.body
  );
}

export default SidePanel;
