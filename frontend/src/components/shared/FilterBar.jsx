import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * FilterBar - barra de filtros reutilizable para todas las secciones del dashboard.
 *
 * Props:
 *   values          - objeto con el estado actual de todos los filtros
 *   onFilterChange  - callback(newValues) llamado al cambiar cualquier filtro
 *   filters         - array de { label, key, options: [{label, value}] }
 *   searchKey       - key del campo de búsqueda de texto (default 'search')
 *   searchPlaceholder
 *   showDateRange   - mostrar inputs de rango de fecha
 *   dateFromKey     - key para "desde" (default 'fecha_desde')
 *   dateToKey       - key para "hasta" (default 'fecha_hasta')
 */
export default function FilterBar({
  values = {},
  onFilterChange,
  filters = [],
  searchKey = 'search',
  searchPlaceholder = 'Buscar...',
  showDateRange = false,
  dateFromKey = 'fecha_desde',
  dateToKey = 'fecha_hasta'
}) {
  const hasAnyFilter = Object.values(values).some(v => v !== '' && v !== undefined && v !== null);

  const set = (key, value) => onFilterChange({ ...values, [key]: value });

  const clear = () => {
    const cleared = {};
    Object.keys(values).forEach(k => { cleared[k] = ''; });
    onFilterChange(cleared);
  };

  return (
    <div className="admin-filter-row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
      <div className="search-wrapper" style={{ minWidth: 200 }}>
        <Search className="search-icon" size={15} />
        <input
          className="search-input"
          value={values[searchKey] || ''}
          onChange={e => set(searchKey, e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>

      {filters.map(f => (
        <label key={f.key} className="admin-filter">
          <span>{f.label}</span>
          <select value={values[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
            <option value="">Todos</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      ))}

      {showDateRange && (
        <>
          <label className="admin-filter">
            <span>Desde</span>
            <input
              type="date"
              value={values[dateFromKey] || ''}
              onChange={e => set(dateFromKey, e.target.value)}
            />
          </label>
          <label className="admin-filter">
            <span>Hasta</span>
            <input
              type="date"
              value={values[dateToKey] || ''}
              onChange={e => set(dateToKey, e.target.value)}
            />
          </label>
        </>
      )}

      {hasAnyFilter && (
        <button className="btn-outline" type="button" onClick={clear} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <X size={14} /> Limpiar filtros
        </button>
      )}
    </div>
  );
}
