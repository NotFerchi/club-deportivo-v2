import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

const NotificationContext = createContext(null);

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolveRef = useRef(null);
  const nextId = useRef(0);

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise(resolve => {
      confirmResolveRef.current = resolve;
      setConfirmState({ message, ...options });
    });
  }, []);

  const handleConfirm = (result) => {
    setConfirmState(null);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result);
      confirmResolveRef.current = null;
    }
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <NotificationContext.Provider value={{ toast, showConfirm }}>
      {children}

      <div className="toast-container">
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span>{t.message}</span>
              <button className="toast-close" onClick={() => removeToast(t.id)}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {confirmState.danger ? 'Confirmar eliminación' : 'Confirmar acción'}
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                {confirmState.message}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => handleConfirm(false)}>
                {confirmState.cancelLabel || 'Cancelar'}
              </button>
              <button
                className={confirmState.danger ? 'btn-danger' : 'btn-primary'}
                onClick={() => handleConfirm(true)}
              >
                {confirmState.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
}
