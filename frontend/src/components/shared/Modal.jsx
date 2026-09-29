import React from 'react';
import { X } from 'lucide-react';

/**
 * Modal - armazón compartido de los modales de gestión (clases .modal-* de Dashboard.css).
 *
 * Solo aporta la estructura; cada pantalla pone su contenido:
 *
 *   <Modal maxWidth="500px">
 *     <ModalHeader onClose={cerrar}><h3>Título</h3></ModalHeader>
 *     <form onSubmit={guardar}>
 *       <ModalBody>…campos…</ModalBody>
 *       <ModalFooter>…botones…</ModalFooter>
 *     </form>
 *   </Modal>
 *
 * No cierra con Escape ni con clic en el overlay: solo la X y los botones que
 * ponga cada pantalla (comportamiento heredado de la V1).
 *
 * Props:
 *   maxWidth  - ancho máximo de .modal-content; se pasa tal cual ('500px' o 440)
 *   className - clase extra de .modal-content (p. ej. 'sanciones-modal'); opcional
 */
export function Modal({ maxWidth, className, children }) {
  return (
    <div className="modal-overlay">
      <div className={className ? `modal-content ${className}` : 'modal-content'} style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Cabecera con botón de cierre (X). El título va como children: un <h3> o un
 * <div> con <h3> y subtítulo.
 *
 * Props:
 *   onClose         - acción de la X (puede diferir de la del botón Cancelar)
 *   closeIconSize   - tamaño del ícono X (default 24)
 *   style           - estilo en línea de .modal-header (p. ej. borde de color); opcional
 *   closeButtonType - atributo type de la X ('button' dentro de formularios); si se omite, no se pone
 */
export function ModalHeader({ onClose, closeIconSize = 24, style, closeButtonType, children }) {
  return (
    <div className="modal-header" style={style}>
      {children}
      <button onClick={onClose} className="close-modal" type={closeButtonType}>
        <X size={closeIconSize} />
      </button>
    </div>
  );
}

export function ModalBody({ children }) {
  return <div className="modal-body">{children}</div>;
}

/** Pie del modal; los botones los define cada pantalla. */
export function ModalFooter({ children }) {
  return <div className="modal-footer">{children}</div>;
}
