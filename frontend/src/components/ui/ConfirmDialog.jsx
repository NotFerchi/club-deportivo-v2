import React from 'react';
import { HelpCircle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import './ConfirmDialog.css';

/**
 * ConfirmDialog - diálogo centrado para confirmar una acción (normal o destructiva).
 * Es solo presentación: el padre controla `isOpen` y recibe `onConfirm` / `onCancel`.
 *
 *   <ConfirmDialog
 *     isOpen={!!aEliminar}
 *     destructive
 *     title="¿Eliminar inscripción del torneo?"
 *     message="Esta acción liberará el lugar en el cuadro y no se puede deshacer."
 *     confirmLabel="Eliminar"
 *     onConfirm={eliminar}
 *     onCancel={() => setAEliminar(null)}
 *   />
 *
 * Props:
 *   isOpen, title, message, onConfirm, onCancel
 *   confirmLabel - default "Confirmar"; cancelLabel - default "Cancelar"
 *   destructive  - true: icono de papelera y botón rojo
 *   loading      - true deshabilita ambos botones mientras se procesa
 *   icon         - nodo para reemplazar el icono; opcional
 *   children     - contenido extra bajo el mensaje (p. ej. un campo de motivo); opcional
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  icon,
  children,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} hideHeader maxWidth={400} className="ui-confirm">
      <div className="ui-confirm__content">
        <span className={`ui-confirm__icon ${destructive ? 'ui-confirm__icon--danger' : 'ui-confirm__icon--ice'}`} aria-hidden="true">
          {icon || (destructive ? <Trash2 size={24} /> : <HelpCircle size={24} />)}
        </span>
        <h3 className="ui-confirm__title">{title}</h3>
        {message && <p className="ui-confirm__message">{message}</p>}
        {children}
        <div className="ui-confirm__actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={destructive ? 'error' : 'primary'} onClick={onConfirm} disabled={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
