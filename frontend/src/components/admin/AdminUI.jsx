import React from 'react';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';

export function ModuleHeader({ icon: Icon, title, subtitle, count, actions }) {
  return (
    <div className="admin-module-header">
      <div className="admin-module-title">
        {Icon && <Icon size={22} className="admin-module-icon" />}
        <div>
          <h4>{title}{typeof count === 'number' ? ` (${count})` : ''}</h4>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="admin-module-actions">{actions}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-wrapper">
      <Search className="search-icon" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="search-input"
      />
    </div>
  );
}

export function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="admin-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'neutral' }) {
  return (
    <div className={`stats-card tone-${tone}`}>
      {Icon && <Icon size={20} />}
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="admin-empty-state">
      {Icon && <Icon size={44} />}
      <p>{title}</p>
      {action}
    </div>
  );
}

export function InlineIcon({ icon: Icon, children, className = '' }) {
  return (
    <span className={`inline-icon ${className}`}>
      {Icon && <Icon size={14} />}
      {children}
    </span>
  );
}

export function LoadingState({ message = 'Cargando...' }) {
  return (
    <div className="admin-state-panel">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ message = 'No se pudo cargar la informacion.', onRetry }) {
  return (
    <div className="admin-state-panel state-error">
      <AlertCircle size={34} />
      <p>{message}</p>
      {onRetry && (
        <button className="btn-outline" onClick={onRetry}>
          <RefreshCw size={15} /> Reintentar
        </button>
      )}
    </div>
  );
}
