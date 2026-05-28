import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Eye, FilePlus, FileText, Filter, LogIn, LogOut, RefreshCw, RotateCcw, Table, Trash2, Wifi } from 'lucide-react';
import { apiRequest, unwrapList } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { formatLocalDateTime, normalizeText } from '../../../utils/adminData';

function AccionIcon({ accion }) {
  const action = normalizeText(accion);
  if (action.includes('insert') || action.includes('crear') || action.includes('create')) return <FilePlus size={13} />;
  if (action.includes('update') || action.includes('actualizar') || action.includes('edit')) return <Edit2 size={13} />;
  if (action.includes('delete') || action.includes('eliminar') || action.includes('remove')) return <Trash2 size={13} />;
  if (action.includes('login')) return <LogIn size={13} />;
  if (action.includes('logout')) return <LogOut size={13} />;
  if (action.includes('reactivar')) return <RotateCcw size={13} />;
  return <FileText size={13} />;
}

function getAccionClass(accion) {
  const action = normalizeText(accion);
  if (action.includes('insert') || action.includes('crear') || action.includes('create')) return 'badge-success';
  if (action.includes('update') || action.includes('actualizar') || action.includes('edit')) return 'badge-info';
  if (action.includes('delete') || action.includes('eliminar') || action.includes('remove')) return 'badge-danger';
  if (action.includes('login') || action.includes('logout')) return 'badge-warning';
  return 'badge-neutral';
}

function getIPTipo(ip) {
  if (!ip || ip === '-') return 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost' || ip.includes('::1')) return 'local';
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return 'local';
  return 'public';
}

function formatIP(ip) {
  if (!ip || ip === '-') return '-';
  if (getIPTipo(ip) === 'local') return 'Local';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.xxx.xxx`;
  return ip;
}

function AuditoriaLogs() {
  const { toast } = useNotification();
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTabla, setFilterTabla] = useState('');
  const [filterAccion, setFilterAccion] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    try {
      const data = await apiRequest('/logs');
      setLogs(unwrapList(data, ['data', 'logs']));
      setError(null);
    } catch (fetchError) {
      if (fetchError.status === 401) {
        toast('Sesión expirada. Por favor, inicia sesión nuevamente.', 'error');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const tablasUnicas = useMemo(() => [...new Set(logs.map(log => log.tabla_afectada).filter(Boolean))], [logs]);
  const accionesUnicas = useMemo(() => [...new Set(logs.map(log => log.accion).filter(Boolean))], [logs]);

  const filteredLogs = useMemo(() => {
    const query = normalizeText(searchTerm);
    return logs.filter(log => {
      const text = normalizeText([
        log.accion,
        log.usuario_nombre,
        log.usuario_email,
        log.detalles,
        log.tabla_afectada,
        log.ip_origen
      ].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterTabla && log.tabla_afectada !== filterTabla) return false;
      if (filterAccion && log.accion !== filterAccion) return false;
      return true;
    });
  }, [logs, searchTerm, filterTabla, filterAccion]);

  if (loading) return <div className="chart-box"><p>Cargando logs...</p></div>;
  if (error) return <div className="chart-box"><p style={{ color: '#ef4444' }}>Error: {error}</p></div>;

  return (
    <div className="chart-box">
      <ModuleHeader
        icon={FileText}
        title="Auditoría del Sistema"
        subtitle={`Total de registros: ${filteredLogs.length} | Última actualización: ${new Date().toLocaleString()}`}
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar acción, usuario, IP o detalles" />
            <button className={`btn-secondary ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} /> Filtros
            </button>
            <button onClick={fetchLogs} className="btn-secondary" title="Refrescar logs">
              <RefreshCw size={16} /> Refrescar
            </button>
          </>
        )}
      />

      {showFilters && (
        <div className="admin-filter-row">
          <FilterSelect label="Tabla afectada" value={filterTabla} onChange={setFilterTabla}>
            <option value="">Todas las tablas</option>
            {tablasUnicas.map(tabla => <option key={tabla} value={tabla}>{tabla}</option>)}
          </FilterSelect>
          <FilterSelect label="Tipo de acción" value={filterAccion} onChange={setFilterAccion}>
            <option value="">Todas las acciones</option>
            {accionesUnicas.map(accion => <option key={accion} value={accion}>{accion}</option>)}
          </FilterSelect>
          {(filterTabla || filterAccion) && (
            <button onClick={() => { setFilterTabla(''); setFilterAccion(''); }} className="btn-outline">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

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
                <td>{formatLocalDateTime(log.fecha_local || log.fecha)}</td>
                <td>
                  <strong>{log.usuario_nombre || 'Sistema'}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{log.usuario_email || '-'}</span>
                </td>
                <td>
                  <span className={getAccionClass(log.accion)}>
                    <AccionIcon accion={log.accion} />
                    {log.accion}
                  </span>
                </td>
                <td><span className="badge-neutral"><Table size={13} /> {log.tabla_afectada || '-'}</span></td>
                <td style={{ maxWidth: '300px', wordBreak: 'break-word' }}>{log.detalles || '-'}</td>
                <td>
                  <span className="inline-icon" title={`IP completa: ${log.ip_origen || 'No disponible'}`}>
                    <Wifi size={13} />
                    <code>{formatIP(log.ip_origen)}</code>
                    {getIPTipo(log.ip_origen) !== 'unknown' && <span className="badge-neutral">{getIPTipo(log.ip_origen) === 'local' ? 'Local' : 'Pública'}</span>}
                  </span>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  <Eye size={42} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                  <p>No hay registros de auditoría.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditoriaLogs;
