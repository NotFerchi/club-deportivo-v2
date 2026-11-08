import React from 'react';
import { AlertCircle, RefreshCw, SearchX } from 'lucide-react';
import { Button } from './Button';
import './States.css';

/**
 * Estados de una vista (tablero M0, patrón 04): cargando, vacío y error.
 *
 *   {cargando && <LoadingState />}
 *   {!cargando && error && <ErrorState message={error} onRetry={recargar} />}
 *   {!cargando && !error && items.length === 0 && (
 *     <EmptyState title="Aún no hay torneos" message="Crea el primero." action={<Button>Crear torneo</Button>} />
 *   )}
 */

/** Skeleton - bloque gris pulsante. `width`/`height` en px o CSS (opcional). */
export function Skeleton({ width, height, circle = false, className }) {
  const classes = ['ui-skeleton', circle && 'ui-skeleton--circle', className].filter(Boolean).join(' ');
  return <span className={classes} style={{ width, height }} aria-hidden="true" />;
}

/** Spinner - indicador circular para botones o cargas cortas. */
export function Spinner({ label = 'Cargando…', className }) {
  return (
    <span className={['ui-spinner', className].filter(Boolean).join(' ')} role="status">
      <span className="ui-spinner__ring" aria-hidden="true" />
      <span className="ui-visually-hidden">{label}</span>
    </span>
  );
}

/**
 * LoadingState - tarjetas esqueleto para listas y tablas.
 *   rows  - número de filas esqueleto (default 3)
 *   label - texto para lectores de pantalla (default "Cargando…")
 */
export function LoadingState({ rows = 3, label = 'Cargando…', className }) {
  return (
    <div className={['ui-state-loading', className].filter(Boolean).join(' ')} role="status" aria-busy="true">
      <span className="ui-visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-state-loading__row" aria-hidden="true">
          <Skeleton circle width={36} height={36} />
          <div className="ui-state-loading__lines">
            <Skeleton height={12} width="55%" />
            <Skeleton height={10} width="35%" />
          </div>
          <Skeleton height={24} width={72} />
        </div>
      ))}
    </div>
  );
}

/**
 * EmptyState - no hay datos. Siempre con texto y, si aplica, una acción.
 *   title, message, icon (nodo; por defecto una lupa), action (nodo)
 */
export function EmptyState({ title, message, icon, action, className }) {
  return (
    <div className={['ui-state', className].filter(Boolean).join(' ')}>
      <span className="ui-state__icon ui-state__icon--ice" aria-hidden="true">{icon || <SearchX size={24} />}</span>
      {title && <p className="ui-state__title">{title}</p>}
      {message && <p className="ui-state__message">{message}</p>}
      {action && <div className="ui-state__action">{action}</div>}
    </div>
  );
}

/**
 * ErrorState - falló la carga. Muestra el mensaje (el del backend, tal cual) y Reintentar.
 *   title (default "No se pudieron cargar los datos"), message, onRetry (muestra el botón), retryLabel
 */
export function ErrorState({ title = 'No se pudieron cargar los datos', message, onRetry, retryLabel = 'Reintentar', className }) {
  return (
    <div className={['ui-state', className].filter(Boolean).join(' ')} role="alert">
      <span className="ui-state__icon ui-state__icon--danger" aria-hidden="true"><AlertCircle size={24} /></span>
      <p className="ui-state__title">{title}</p>
      {message && <p className="ui-state__message">{message}</p>}
      {onRetry && (
        <div className="ui-state__action">
          <Button variant="secondary" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" />{retryLabel}</Button>
        </div>
      )}
    </div>
  );
}
