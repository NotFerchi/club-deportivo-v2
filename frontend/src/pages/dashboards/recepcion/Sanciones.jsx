import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { formatDate, gravedadDias, normalizeGravedad, normalizeText } from '../../../utils/adminData';

const origenes = ['Administración', 'Ludoteca', 'Instalaciones', 'No-show reserva', 'No-show clase', 'Conducta', 'Reglamento'];

function getSancionActiva(sancion) {
  const estado = normalizeText(sancion.estado);
  return sancion.activa === true || estado === 'activa' || estado === 'activo';
}

function gravedadClass(gravedad) {
  const normalized = normalizeGravedad(gravedad);
  if (normalized === 'Grave') return 'badge-danger';
  if (normalized === 'Moderada') return 'badge-warning';
  return 'badge-info';
}

function getNombreSocio(sancion) {
  return sancion.nombre_socio || sancion.socio_nombre || 'Socio sin nombre';
}

function SancionesRecepcion() {
  const { toast } = useNotification();
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterOrigen, setFilterOrigen] = useState('');
  const [filterGravedad, setFilterGravedad] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 });

  const fetchSanciones = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      });

      if (filterEstado) params.set('estado', filterEstado);
      if (filterOrigen) params.set('origen', filterOrigen);

      const data = await apiRequest(`/sanciones?${params.toString()}`);
      setSanciones(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || { page, limit: 20, total: 0, total_pages: 1 });
    } catch (error) {
      toast(error.message || 'Error al cargar sanciones', 'error');
      setSanciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSanciones();
  }, [page, filterEstado, filterOrigen]);

  useEffect(() => {
    setPage(1);
  }, [filterEstado, filterOrigen]);

  const sancionesFiltradas = useMemo(() => {
    const query = normalizeText(searchTerm);

    return sanciones.filter((sancion) => {
      const gravedad = normalizeGravedad(sancion.gravedad);
      const text = normalizeText([
        getNombreSocio(sancion),
        sancion.numero_socio,
        sancion.motivo,
        sancion.origen,
        sancion.estado
      ].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterGravedad && gravedad !== filterGravedad) return false;
      return true;
    });
  }, [sanciones, searchTerm, filterGravedad]);

  const stats = useMemo(() => ({
    activas: sanciones.filter(getSancionActiva).length,
    resueltas: sanciones.filter((sancion) => !getSancionActiva(sancion)).length,
    visibles: sancionesFiltradas.length
  }), [sanciones, sancionesFiltradas]);

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFilterEstado('');
    setFilterOrigen('');
    setFilterGravedad('');
    setPage(1);
  };

  if (loading) {
    return (
      <div className="chart-box">
        <p className="empty-message">Cargando sanciones...</p>
      </div>
    );
  }

  return (
    <div className="chart-box">
      <div className="recepcion-section-header">
        <div>
          <h4><ShieldAlert size={18} /> Sanciones</h4>
          <p>Consulta de historial para validar el comportamiento de socios antes de aprobar servicios.</p>
        </div>
        <button className="btn-outline" onClick={fetchSanciones}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      <div className="top-kpi-grid recepcion-kpi-compact">
        <div className="kpi-card">
          <AlertTriangle className="kpi-icon red" />
          <div>
            <h3>{stats.activas}</h3>
            <p>Activas en página</p>
          </div>
        </div>
        <div className="kpi-card">
          <CheckCircle className="kpi-icon green" />
          <div>
            <h3>{stats.resueltas}</h3>
            <p>Resueltas en página</p>
          </div>
        </div>
        <div className="kpi-card">
          <ShieldAlert className="kpi-icon blue" />
          <div>
            <h3>{pagination.total}</h3>
            <p>Total con filtros</p>
          </div>
        </div>
      </div>

      <div className="admin-filter-row">
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar socio, motivo u origen"
          />
        </div>

        <label className="admin-filter">
          <span>Estado</span>
          <select value={filterEstado} onChange={(event) => setFilterEstado(event.target.value)}>
            <option value="">Todos</option>
            <option value="Activo">Activas</option>
            <option value="Inactivo">Inactivas / resueltas</option>
          </select>
        </label>

        <label className="admin-filter">
          <span>Origen</span>
          <select value={filterOrigen} onChange={(event) => setFilterOrigen(event.target.value)}>
            <option value="">Todos</option>
            {origenes.map((origen) => <option key={origen} value={origen}>{origen}</option>)}
          </select>
        </label>

        <label className="admin-filter">
          <span>Gravedad</span>
          <select value={filterGravedad} onChange={(event) => setFilterGravedad(event.target.value)}>
            <option value="">Todas</option>
            <option value="Leve">Leve</option>
            <option value="Moderada">Moderada</option>
            <option value="Grave">Grave</option>
          </select>
        </label>

        {(searchTerm || filterEstado || filterOrigen || filterGravedad) && (
          <button className="btn-outline" onClick={limpiarFiltros}>Limpiar filtros</button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Socio</th>
              <th>Motivo</th>
              <th>Origen</th>
              <th>Gravedad</th>
              <th>Fecha</th>
              <th>Resolución</th>
              <th>Resuelto por</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {sancionesFiltradas.map((sancion) => {
              const activa = getSancionActiva(sancion);
              const gravedad = normalizeGravedad(sancion.gravedad);

              return (
                <tr key={sancion.sancion_id}>
                  <td>
                    <strong>{getNombreSocio(sancion)}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{sancion.numero_socio || `ID ${sancion.socio_id}`}</span>
                  </td>
                  <td>{sancion.motivo}</td>
                  <td><span className="badge-neutral">{sancion.origen || 'Administración'}</span></td>
                  <td><span className={gravedadClass(gravedad)}>{gravedad} ({gravedadDias[gravedad]} días)</span></td>
                  <td>{formatDate(sancion.fecha_inicio || sancion.fecha)}</td>
                  <td>{sancion.fecha_resolucion ? formatDate(sancion.fecha_resolucion) : '-'}</td>
                  <td>{sancion.nombre_resolvente || '-'}</td>
                  <td><span className={activa ? 'badge-warning' : 'badge-success'}>{activa ? 'Activa' : 'Resuelta'}</span></td>
                </tr>
              );
            })}
            {sancionesFiltradas.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No hay sanciones con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="recepcion-pagination">
        <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          Anterior
        </button>
        <span>Página {pagination.page} de {pagination.total_pages || 1}</span>
        <button className="btn-outline" disabled={page >= (pagination.total_pages || 1)} onClick={() => setPage((current) => current + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default SancionesRecepcion;
