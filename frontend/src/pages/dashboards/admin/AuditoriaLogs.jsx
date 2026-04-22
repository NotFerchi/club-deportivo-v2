import React, { useEffect, useState } from 'react';
import { Search, Eye, Filter } from 'lucide-react';

function AuditoriaLogs() {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTabla, setFilterTabla] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data);
      setFilteredLogs(data);
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
        l.detalles?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterTabla) {
      filtered = filtered.filter(l => l.tabla_afectada === filterTabla);
    }
    setFilteredLogs(filtered);
  }, [searchTerm, filterTabla, logs]);

  const getAccionColor = (accion) => {
    if (accion.includes('INSERT') || accion.includes('CREAR')) return '#10b981';
    if (accion.includes('UPDATE') || accion.includes('ACTUALIZAR')) return '#3b82f6';
    if (accion.includes('DELETE') || accion.includes('ELIMINAR')) return '#ef4444';
    if (accion.includes('LOGIN')) return '#8b5cf6';
    return '#64748b';
  };

  if (loading) return <div className="chart-box"><p>Cargando logs...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>📋 Auditoría del Sistema</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por acción, usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <select value={filterTabla} onChange={(e) => setFilterTabla(e.target.value)} className="date-picker">
            <option value="">Todas las tablas</option>
            <option value="usuarios">Usuarios</option>
            <option value="socios">Socios</option>
            <option value="reservaciones">Reservaciones</option>
            <option value="espacios">Espacios</option>
          </select>
        </div>
      </div>

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
                <td>{new Date(log.fecha).toLocaleString()}</td>
                <td><strong>{log.usuario_nombre}</strong><br /><span style={{ fontSize: '11px', color: '#64748b' }}>{log.usuario_email}</span></td>
                <td><span style={{ background: getAccionColor(log.accion), color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{log.accion}</span></td>
                <td>{log.tabla_afectada || '—'}</td>
                <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{log.detalles || '—'}</td>
                <td><code style={{ fontSize: '11px' }}>{log.ip_origen || '—'}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLogs.length === 0 && (
        <p className="empty-message">No hay registros de auditoría</p>
      )}
    </div>
  );
}

export default AuditoriaLogs;