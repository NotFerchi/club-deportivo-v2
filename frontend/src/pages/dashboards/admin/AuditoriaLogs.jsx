import React, { useEffect, useState } from 'react';
import { Search, Eye, Filter, Calendar, User, Table, Info, MapPin } from 'lucide-react';

function AuditoriaLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTabla, setFilterTabla] = useState('');
  const [filterAccion, setFilterAccion] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        setFilteredLogs(data);
      } else {
        console.error('Error al cargar logs');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;
    
    if (searchTerm) {
      filtered = filtered.filter(l =>
        l.accion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.usuario_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.usuario_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.detalles?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.tabla_afectada?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterTabla) {
      filtered = filtered.filter(l => l.tabla_afectada === filterTabla);
    }
    
    if (filterAccion) {
      filtered = filtered.filter(l => l.accion?.toLowerCase().includes(filterAccion.toLowerCase()));
    }
    
    setFilteredLogs(filtered);
  }, [searchTerm, filterTabla, filterAccion, logs]);

  const getAccionColor = (accion) => {
    const action = accion?.toLowerCase() || '';
    if (action.includes('insert') || action.includes('crear') || action.includes('create')) return '#10b981';
    if (action.includes('update') || action.includes('actualizar') || action.includes('edit')) return '#3b82f6';
    if (action.includes('delete') || action.includes('eliminar') || action.includes('remove')) return '#ef4444';
    if (action.includes('login') || action.includes('logout')) return '#8b5cf6';
    if (action.includes('inactivar') || action.includes('reactivar')) return '#f59e0b';
    return '#64748b';
  };

  const getAccionIcon = (accion) => {
    const action = accion?.toLowerCase() || '';
    if (action.includes('insert') || action.includes('crear')) return '➕';
    if (action.includes('update') || action.includes('actualizar')) return '✏️';
    if (action.includes('delete') || action.includes('eliminar')) return '🗑️';
    if (action.includes('login')) return '🔐';
    if (action.includes('logout')) return '🚪';
    return '📝';
  };

  const tablasUnicas = [...new Set(logs.map(l => l.tabla_afectada).filter(Boolean))];
  const accionesUnicas = [...new Set(logs.map(l => l.accion).filter(Boolean))];

  if (loading) return <div className="chart-box"><p>Cargando logs...</p></div>;

  return (
    <div className="chart-box">

      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4>📋 Auditoría del Sistema</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Total de registros: {filteredLogs.length}
          </p>
        </div>

        <div className="flex-gap" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por acción, usuario, detalles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            className={`btn-secondary ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Filter size={16} /> Filtros
          </button>
        </div>
      </div>

      {/* FILTROS AVANZADOS */}
      {showFilters && (
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: '#f9fafb', 
          borderRadius: '8px',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              <Table size={12} /> Tabla afectada
            </label>
            <select
              value={filterTabla}
              onChange={(e) => setFilterTabla(e.target.value)}
              className="date-picker"
              style={{ width: '100%' }}
            >
              <option value="">Todas las tablas</option>
              {tablasUnicas.map(tabla => (
                <option key={tabla} value={tabla}>{tabla}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              <Eye size={12} /> Tipo de acción
            </label>
            <select
              value={filterAccion}
              onChange={(e) => setFilterAccion(e.target.value)}
              className="date-picker"
              style={{ width: '100%' }}
            >
              <option value="">Todas las acciones</option>
              {accionesUnicas.map(accion => (
                <option key={accion} value={accion}>{accion}</option>
              ))}
            </select>
          </div>

          {(filterTabla || filterAccion) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => {
                  setFilterTabla('');
                  setFilterAccion('');
                }}
                className="btn-outline"
                style={{ padding: '0.5rem 1rem' }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* TABLA DE LOGS */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Tabla</th>
              <th>Detalles</th>
              <th>IP Origen</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.log_id}>
                <td>
                  <span style={{ fontWeight: 500 }}>{new Date(log.fecha).toLocaleDateString()}</span>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Date(log.fecha).toLocaleTimeString()}
                  </span>
                </td>
                <td>
                  <strong>{log.usuario_nombre}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {log.usuario_email || '—'}
                  </span>
                </td>
                <td>
                  <span style={{ 
                    background: getAccionColor(log.accion), 
                    color: 'white', 
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '11px',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{getAccionIcon(log.accion)}</span>
                    {log.accion}
                  </span>
                </td>
                <td>
                  <span style={{
                    background: '#f3f4f6',
                    color: '#374151',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px'
                  }}>
                    {log.tabla_afectada || '—'}
                  </span>
                </td>
                <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>
                  <span style={{ fontSize: '0.875rem' }}>{log.detalles || '—'}</span>
                </td>
                <td>
                  <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                    {log.ip_origen || '—'}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MENSAJE SIN DATOS */}
      {filteredLogs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <Eye size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No hay registros de auditoría</p>
          <p style={{ fontSize: '0.875rem' }}>Los logs aparecerán cuando los usuarios realicen acciones en el sistema</p>
        </div>
      )}

      <style jsx>{`
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-secondary.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .date-picker {
          padding: 0.5rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          font-size: 0.875rem;
        }

        .flex-gap {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}

export default AuditoriaLogs;