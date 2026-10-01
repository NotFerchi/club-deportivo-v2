import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Elementos enfocables visibles dentro de `container`, en orden de tabulación del DOM. */
function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE))
    .filter((el) => el.getClientRects().length > 0);
}

/**
 * Modal - diálogo con header (título + cerrar), body y footer (Figma: Modal).
 *
 *   <Modal
 *     isOpen={abierto}
 *     onClose={cerrar}
 *     title="Nueva reserva"
 *     footer={<>
 *       <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
 *       <Button onClick={guardar}>Guardar</Button>
 *     </>}
 *   >
 *     …contenido…
 *   </Modal>
 *
 * Cierra con la X y con Escape. No cierra con clic en el overlay, igual que
 * components/shared/Modal.jsx. Se monta en document.body con un portal.
 * Mientras está abierto bloquea el scroll del body y atrapa el foco (Tab /
 * Shift+Tab ciclan dentro del diálogo); al cerrar devuelve el foco al
 * elemento que lo tenía antes de abrir.
 *
 * Props:
 *   isOpen   - muestra u oculta el modal
 *   onClose  - acción de la X y de Escape
 *   title    - título del header
 *   subtitle - texto secundario bajo el título; opcional
 *   footer   - contenido del footer (normalmente Button secondary + primary); opcional
 *   maxWidth - ancho máximo del diálogo (default 480px, como en Figma)
 *   className - clase extra del diálogo; opcional
 *   closeOnOverlayClick - true cierra también con clic en el fondo (default false)
 *   portal   - false renderiza en el lugar en vez de en document.body, para heredar
 *              estilos con ámbito (p. ej. `.dashboard-root …`); default true
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  footer,
  maxWidth,
  className,
  closeOnOverlayClick = false,
  portal = true,
  children,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  // onClose va en un ref para que el efecto dependa solo de isOpen: si el padre
  // pasa una función inline, re-ejecutarlo en cada render movería el foco.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const dialog = dialogRef.current;
    const bodyStyle = document.body.style;
    const previousOverflow = bodyStyle.getPropertyValue('overflow');
    const previousPriority = bodyStyle.getPropertyPriority('overflow');
    const previouslyFocused = document.activeElement;

    // 'important' porque css/index.css fija `overflow-y: auto !important` en body,
    // que ganaría a un estilo inline normal.
    bodyStyle.setProperty('overflow', 'hidden', 'important');
    dialog?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);

      if (event.shiftKey) {
        if (active === first || active === dialog || outside) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || active === dialog || outside) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousOverflow) bodyStyle.setProperty('overflow', previousOverflow, previousPriority);
      else bodyStyle.removeProperty('overflow');
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const classes = ['ui-modal', className].filter(Boolean).join(' ');

  const handleOverlayClick = (event) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) onClose?.();
  };

  const content = (
    <div className="ui-modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={classes}
        style={maxWidth ? { maxWidth } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <header className="ui-modal__header">
          {(title || subtitle) && (
            <div className="ui-modal__heading">
              {title && <h3 id={titleId} className="ui-modal__title">{title}</h3>}
              {subtitle && <p className="ui-modal__subtitle">{subtitle}</p>}
            </div>
          )}
          <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>
  );

  return portal ? createPortal(content, document.body) : content;
}

export default Modal;
