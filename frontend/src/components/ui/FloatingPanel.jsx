import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * FloatingPanel - panel flotante anclado a un elemento (lo usan Select y SocioPicker).
 * Se dibuja en document.body con position: fixed para que no lo recorte un contenedor con
 * overflow (p. ej. el cuerpo de un Modal). Se coloca debajo del ancla y, si abajo no cabe, arriba.
 * Se reposiciona con scroll y resize mientras está abierto.
 *
 * Props:
 *   anchorRef - ref del elemento ancla (el panel toma su ancho)
 *   open      - muestra u oculta el panel
 *   panelRef  - ref al div del panel (para detectar clics dentro/fuera); opcional
 *   className - clase del panel
 *   maxHeight - alto máximo en px (default 288)
 */
export function FloatingPanel({ anchorRef, open, panelRef, className, maxHeight = 288, children, ...rest }) {
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 4;
      const margin = 12;
      const below = window.innerHeight - rect.bottom - margin;
      const above = rect.top - margin;
      const openUp = below < Math.min(maxHeight, 160) && above > below;
      const available = Math.max(96, openUp ? above : below);
      setStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(maxHeight, available),
        ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchorRef, maxHeight]);

  if (!open || !style) return null;

  return createPortal(
    <div ref={panelRef} className={className} style={style} {...rest}>
      {children}
    </div>,
    document.body,
  );
}

export default FloatingPanel;
