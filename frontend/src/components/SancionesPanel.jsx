import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Lock, Plus, RefreshCw, Search, ShieldAlert, UserCheck, X } from 'lucide-react';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, normalizeText } from '../utils/adminData';

const PAGE_SIZE = 20;
const RESOLVER_ROLES = ['admin'];
const ORIGENES_BASE = ['Administracion', 'Ludoteca', 'Instalaciones', 'No-show reserva', 'No-show clase', 'Conducta', 'Reglamento'];
const initialFormData = {
  socio_id: '',
  origen: 'Administracion',
  motivo: '',
  gravedad: 'Leve'
};

function getNombreSocio(sancion) {
  return sancion.nombre_socio || sancion.socio_nombre || 'Socio sin nombre';
}

function isActiva(sancion) {
  const estado = normalizeText(sancion.estado);
  return sancion.activa === true || estado === 'activo' || estado === 'activa';
}

function estadoLabel(sancion) {
  return isActiva(sancion) ? 'Activo' : 'Inactivo';
}

function useSancionesFilters() {
  const [filters, setFilters] = useState({
    origen: '',
    estado: '',
    socio: ''
  });

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ origen: '', estado: '', socio: '' });
  };

  return { filters, updateFilter, clearFilters };
}

function SancionesPanel() {
  const { rol } = useAuth();
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 });
  const [selected, setSelected] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [socios, setSocios] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const { filters, updateFilter, clearFilters } = useSancionesFilters();

  const canResolve = RESOLVER_ROLES.includes(rol);

  const fetchSanciones = async () => {
    setLoading(true);
    try {
      const payload = await adminApi.getSancionesPage({
        page,
        limit: PAGE_SIZE,
        origen: filters.origen,
        estado: filters.estado,
        socio: filters.socio
      });
      setSanciones(Array.isArray(payload?.data) ? payload.data : []);
      setPagination(payload?.pagination || { page, limit: PAGE_SIZE, total: 0, total_pages: 1 });
    } catch (error) {
      alert(error.message || 'Error al cargar sanciones');
      setSanciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSanciones();
  }, [page, filters.origen, filters.estado, filters.socio]);

  useEffect(() => {
    if (!canResolve) return;

    adminApi.getSocios()
      .then((data) => setSocios(data.filter((socio) => socio.activo === true || socio.activo === 'true')))
      .catch(() => setSocios([]));
  }, [canResolve]);

  useEffect(() => {
    setPage(1);
  }, [filters.origen, filters.estado, filters.socio]);

  const origenes = useMemo(() => {
    const values = new Set(ORIGENES_BASE);
    sanciones.forEach((sancion) => {
      if (sancion.origen) values.add(sancion.origen);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'es'));
  }, [sanciones]);

  const handleResolve = async (sancion) => {
    if (!confirm('Resolver esta sancion?')) return;
    setResolving(true);
    try {
      const updated = await adminApi.resolverSancion(sancion.sancion_id);
      setSelected(null);
      await fetchSanciones();
      if (updated?.sancion_id) {
        setSanciones((current) => current.map((item) => (
          item.sancion_id === updated.sancion_id ? updated : item
        )));
      }
    } catch (error) {
      alert(error.message || 'Error al resolver sancion');
    } finally {
      setResolving(false);
    }
  };

  const handleCreateSancion = async (event) => {
    event.preventDefault();

    if (!formData.socio_id) {
      alert('Selecciona un socio');
      return;
    }

    if (formData.motivo.trim().length < 6) {
      alert('Describe el motivo con al menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      await adminApi.saveSancion({
        socio_id: formData.socio_id,
        origen: formData.origen,
        motivo: formData.motivo.trim(),
        gravedad: formData.gravedad
      });
      setShowCreateModal(false);
      setFormData(initialFormData);
      setPage(1);
      await fetchSanciones();
    } catch (error) {
      alert(error.message || 'Error al crear sancion');
    } finally {
      setSaving(false);
    }
  };

  const hasFilters = filters.origen || filters.estado || filters.socio;
  const stats = useMemo(() => {
    const activas = sanciones.filter(isActiva).length;
    return {
      activas,
      inactivas: sanciones.length - activas,
      total: pagination.total || sanciones.length
    };
  }, [sanciones, pagination.total]);

  return (
    <div className="chart-box sanciones-panel">
      <div className="sanciones-header">
        <div>
          <span className="sanciones-eyebrow">Control disciplinario</span>
          <h4><ShieldAlert size={18} /> Sanciones</h4>
          <p>Consulta sanciones, revisa historial por socio y da seguimiento a resoluciones.</p>
        </div>
        <div className="sanciones-header-actions">
          {!canResolve && (
            <span className="sanciones-permission-note">
              <Lock size={14} /> Solo consulta
            </span>
          )}
          {canResolve && (
            <button className="btn-primary" type="button" onClick={() => setShowCreateModal(true)}>
              <Plus size={15} /> Nueva sancion
            </button>
          )}
          <button className="btn-outline" type="button" onClick={fetchSanciones}>
            <RefreshCw size={15} /> Actualizar
          </button>
        </div>
      </div>

      <div className="sanciones-summary">
        <div className="sanciones-summary-item">
          <span>Total filtrado</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="sanciones-summary-item is-active">
          <span>Activas en pagina</span>
          <strong>{stats.activas}</strong>
        </div>
        <div className="sanciones-summary-item is-resolved">
          <span>Resueltas en pagina</span>
          <strong>{stats.inactivas}</strong>
        </div>
      </div>

      <div className="sanciones-filter-row">
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            className="search-input"
            value={filters.socio}
            onChange={(event) => updateFilter('socio', event.target.value)}
            placeholder="Buscar por socio o numero"
          />
        </div>

        <label className="sanciones-filter">
          <span>Origen</span>
          <select value={filters.origen} onChange={(event) => updateFilter('origen', event.target.value)}>
            <option value="">Todos</option>
            {origenes.map((origen) => <option key={origen} value={origen}>{origen}</option>)}
          </select>
        </label>

        <label className="sanciones-filter">
          <span>Estado</span>
          <select value={filters.estado} onChange={(event) => updateFilter('estado', event.target.value)}>
            <option value="">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>
        </label>

        {hasFilters && (
          <button className="btn-outline" type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="empty-message">Cargando sanciones...</p>
      ) : (
        <div className="table-wrapper sanciones-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Origen</th>
                <th>Motivo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sanciones.map((sancion) => (
                <tr key={sancion.sancion_id} onClick={() => setSelected(sancion)} className="sanciones-row">
                  <td>
                    <strong>{getNombreSocio(sancion)}</strong>
                    <br />
                    <span className="sanciones-muted">{sancion.numero_socio || `ID ${sancion.socio_id}`}</span>
                  </td>
                  <td><span className="badge-neutral">{sancion.origen || 'Administracion'}</span></td>
                  <td>{sancion.motivo}</td>
                  <td>{formatDate(sancion.fecha_inicio || sancion.fecha)}</td>
                  <td><span className={isActiva(sancion) ? 'badge-warning' : 'badge-success'}>{estadoLabel(sancion)}</span></td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <button className="btn-outline btn-compact" type="button" onClick={() => setSelected(sancion)}>
                      Detalle
                    </button>
                  </td>
                </tr>
              ))}
              {sanciones.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No hay sanciones con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="recepcion-pagination">
        <button className="btn-outline" disabled={page <= 1} type="button" onClick={() => setPage((current) => Math.max(1, current - 1))}>
          Anterior
        </button>
        <span>Pagina {pagination.page} de {pagination.total_pages || 1} ({pagination.total} registros)</span>
        <button
          className="btn-outline"
          disabled={page >= (pagination.total_pages || 1)}
          type="button"
          onClick={() => setPage((current) => current + 1)}
        >
          Siguiente
        </button>
      </div>

      {selected && (
        <div className="modal-overlay">
          <div className="modal-content sanciones-modal">
            <div className="modal-header">
              <div>
                <h3>Sancion #{selected.sancion_id}</h3>
                <p className="sanciones-modal-subtitle">{getNombreSocio(selected)}</p>
              </div>
              <button className="close-modal" type="button" onClick={() => setSelected(null)}><X size={24} /></button>
            </div>

            <div className="modal-body">
              <div className="sanciones-detail-layout">
                <section className="sanciones-detail-main">
                  <div className="sanciones-detail-title">
                    <span className={isActiva(selected) ? 'badge-warning' : 'badge-success'}>{estadoLabel(selected)}</span>
                    <span className="badge-neutral">{selected.origen || 'Administracion'}</span>
                  </div>
                  <h5>{selected.motivo}</h5>
                  <dl className="sanciones-detail-grid">
                    <div><dt>Socio</dt><dd>{getNombreSocio(selected)}</dd></div>
                    <div><dt>Numero</dt><dd>{selected.numero_socio || `ID ${selected.socio_id}`}</dd></div>
                    <div><dt>Fecha</dt><dd>{formatDateTime(selected.fecha_inicio || selected.fecha)}</dd></div>
                    <div><dt>Gravedad</dt><dd>{selected.gravedad || '-'}</dd></div>
                  </dl>
                </section>

                <aside className={`sanciones-resolution-card ${isActiva(selected) ? 'is-pending' : 'is-done'}`}>
                  <div className="sanciones-resolution-icon">
                    {isActiva(selected) ? <Clock size={18} /> : <UserCheck size={18} />}
                  </div>
                  <div>
                    <span>Resolucion</span>
                    {isActiva(selected) ? (
                      <>
                        <strong>Pendiente</strong>
                        <p>{canResolve ? 'Puedes marcarla como resuelta desde este panel.' : 'Tu rol solo permite consultar el estado de la sancion.'}</p>
                      </>
                    ) : (
                      <>
                        <strong>{selected.nombre_resolvente || 'Sin registro'}</strong>
                        <p>{formatDateTime(selected.fecha_resolucion)}</p>
                      </>
                    )}
                  </div>
                </aside>

                <details className="sanciones-raw-details">
                  <summary>Ver todos los campos</summary>
                  <div>
                    {Object.entries(selected).map(([key, value]) => (
                      <p key={key}>
                        <strong>{key}:</strong> {value === null || value === undefined || value === '' ? '-' : String(value)}
                      </p>
                    ))}
                  </div>
                </details>
              </div>

              {isActiva(selected) && !canResolve && (
                <div className="sanciones-readonly-alert">
                  <Lock size={16} />
                  Coordinacion y recepcion pueden visualizar sanciones, pero la resolucion solo corresponde al administrador.
                </div>
              )}

              {!isActiva(selected) && (
                <div className="sanciones-resolved-alert">
                  <UserCheck size={16} />
                  Resuelta por {selected.nombre_resolvente || 'Sin registro'} el {formatDateTime(selected.fecha_resolucion)}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-outline" type="button" onClick={() => setSelected(null)}>
                Cerrar
              </button>
              {canResolve && isActiva(selected) && (
                <button className="btn-primary" type="button" onClick={() => handleResolve(selected)}>
                  <CheckCircle size={16} /> {resolving ? 'Resolviendo...' : 'Resolver sancion'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && canResolve && (
        <div className="modal-overlay">
          <div className="modal-content sanciones-create-modal">
            <div className="modal-header">
              <div>
                <h3>Nueva sancion</h3>
                <p className="sanciones-modal-subtitle">Registro disponible solo para administracion.</p>
              </div>
              <button className="close-modal" type="button" onClick={() => setShowCreateModal(false)}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateSancion}>
              <div className="modal-body">
                <div className="sanciones-form-grid">
                  <label className="form-group form-group-full">
                    <span>Socio</span>
                    <select value={formData.socio_id} onChange={(event) => setFormData((current) => ({ ...current, socio_id: event.target.value }))}>
                      <option value="">Selecciona un socio</option>
                      {socios.map((socio) => (
                        <option key={socio.socio_id} value={socio.socio_id}>
                          {[socio.nombres, socio.apellido_paterno, socio.apellido_materno].filter(Boolean).join(' ')} - {socio.numero_socio || 'Sin numero'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-group">
                    <span>Origen</span>
                    <select value={formData.origen} onChange={(event) => setFormData((current) => ({ ...current, origen: event.target.value }))}>
                      {ORIGENES_BASE.map((origen) => <option key={origen} value={origen}>{origen}</option>)}
                    </select>
                  </label>

                  <label className="form-group">
                    <span>Gravedad</span>
                    <select value={formData.gravedad} onChange={(event) => setFormData((current) => ({ ...current, gravedad: event.target.value }))}>
                      <option value="Leve">Leve</option>
                      <option value="Moderada">Moderada</option>
                      <option value="Grave">Grave</option>
                    </select>
                  </label>

                  <label className="form-group form-group-full">
                    <span>Motivo</span>
                    <textarea
                      rows="4"
                      value={formData.motivo}
                      onChange={(event) => setFormData((current) => ({ ...current, motivo: event.target.value }))}
                      placeholder="Describe el motivo de la sancion"
                    />
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-outline" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" type="submit">
                  {saving ? 'Guardando...' : 'Crear sancion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SancionesPanel;
