import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle, Clock, CreditCard, Edit2, Hash, Loader2, Lock, Plus, RefreshCw, Search, ShieldAlert, User, UserCheck, X } from 'lucide-react';
import { adminApi, apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDate, formatDateTime, normalizeText } from '../utils/adminData';
import FilterBar from './shared/FilterBar';

const PAGE_SIZE = 20;
// Roles que pueden crear y editar sanciones
const WRITE_ROLES = ['admin', 'coordinador'];
// Roles que pueden marcar una sanción como resuelta
const RESOLVER_ROLES = ['admin', 'coordinador'];
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

const FILTER_INITIAL = {
  socio: '',
  gravedad: '',
  estado: '',
  origen: '',
  fecha_desde: '',
  fecha_hasta: ''
};

function useSancionesFilters() {
  const [filters, setFilters] = useState(FILTER_INITIAL);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const setAllFilters = (newFilters) => setFilters(newFilters);

  const clearFilters = () => setFilters(FILTER_INITIAL);

  return { filters, updateFilter, setAllFilters, clearFilters };
}

// ── Buscador de socios con búsqueda en servidor ───────────────────────────────
function SocioBuscador({ value, onChange }) {
  const [query, setQuery]             = useState('');
  const [resultados, setResultados]   = useState([]);
  const [buscando, setBuscando]       = useState(false);
  const [abierto, setAbierto]         = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const ref      = useRef(null);
  const timerRef = useRef(null);

  const nombreVisible = seleccionado
    ? `${seleccionado.nombre_completo || `${seleccionado.nombres || ''} ${seleccionado.apellido_paterno || ''}`.trim()} — ${seleccionado.numero_socio}`
    : '';

  const buscarEnServidor = (texto) => {
    clearTimeout(timerRef.current);
    if (!texto.trim()) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await apiRequest(`/recepcion/socios?q=${encodeURIComponent(texto)}`);
        setResultados(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 300);
  };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); clearTimeout(timerRef.current); };
  }, []);

  const handleFocus  = () => { setAbierto(true); setQuery(''); setResultados([]); };
  const handleChange = (e) => { setQuery(e.target.value); buscarEnServidor(e.target.value); };
  const handleSelect = (socio) => {
    setSeleccionado(socio);
    onChange(String(socio.socio_id));
    setAbierto(false);
    setQuery('');
    setResultados([]);
  };
  const handleClear = () => { setSeleccionado(null); onChange(''); setQuery(''); setResultados([]); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        {buscando
          ? <Loader2 size={13} className="icon-spin" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          : <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        }
        <input
          style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: 'white' }}
          placeholder="Escribe el nombre o número de socio..."
          value={abierto ? query : nombreVisible}
          onFocus={handleFocus}
          onChange={handleChange}
          autoComplete="off"
        />
        {value && !abierto && (
          <button onMouseDown={handleClear} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={13} color="#94a3b8" />
          </button>
        )}
      </div>

      {abierto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2
        }}>
          {!query.trim() ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
              Empieza a escribir para buscar...
            </div>
          ) : buscando ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '12px', color: '#94a3b8', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Loader2 size={13} className="icon-spin" /> Buscando...
            </div>
          ) : resultados.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
              Sin resultados para "{query}"
            </div>
          ) : resultados.map(s => {
            const nombre = s.nombre_completo || `${s.nombres || ''} ${s.apellido_paterno || ''}`.trim();
            return (
              <div
                key={s.socio_id}
                onMouseDown={() => handleSelect(s)}
                style={{ padding: '0.6rem 1rem', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>{nombre}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{s.tipo} · {s.modalidad}</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>
                  {s.numero_socio}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SancionesPanel() {
  const { rol } = useAuth();
  const { toast, showConfirm } = useNotification();
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, total_pages: 1 });
  const [selected, setSelected] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSancion, setEditingSancion] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);
  const { filters, setAllFilters } = useSancionesFilters();

  const canWrite = WRITE_ROLES.includes(rol);
  const canResolve = RESOLVER_ROLES.includes(rol);

  const fetchSanciones = async () => {
    setLoading(true);
    try {
      const payload = await adminApi.getSancionesPage({
        page,
        limit: PAGE_SIZE,
        socio: filters.socio,
        gravedad: filters.gravedad,
        estado: filters.estado,
        origen: filters.origen,
        fecha_desde: filters.fecha_desde,
        fecha_hasta: filters.fecha_hasta
      });
      setSanciones(Array.isArray(payload?.data) ? payload.data : []);
      setPagination(payload?.pagination || { page, limit: PAGE_SIZE, total: 0, total_pages: 1 });
    } catch (error) {
      toast(error.message || 'Error al cargar sanciones', 'error');
      setSanciones([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSanciones();
  }, [page, filters.socio, filters.gravedad, filters.estado, filters.origen, filters.fecha_desde, filters.fecha_hasta]);

  useEffect(() => {
    setPage(1);
  }, [filters.socio, filters.gravedad, filters.estado, filters.origen, filters.fecha_desde, filters.fecha_hasta]);

  const origenes = useMemo(() => {
    const values = new Set(ORIGENES_BASE);
    sanciones.forEach((sancion) => {
      if (sancion.origen) values.add(sancion.origen);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'es'));
  }, [sanciones]);

  const handleResolve = async (sancion) => {
    if (!await showConfirm('¿Resolver esta sanción?', { confirmLabel: 'Resolver' })) return;
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
      toast(error.message || 'Error al resolver sancion', 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleOpenEdit = (sancion) => {
    setEditingSancion(sancion);
    setFormData({
      socio_id: String(sancion.socio_id || ''),
      origen: sancion.origen || 'Administracion',
      motivo: sancion.motivo || '',
      gravedad: sancion.gravedad || 'Leve'
    });
    setShowCreateModal(true);
  };

  const handleCreateSancion = async (event) => {
    event.preventDefault();

    if (!editingSancion && !formData.socio_id) {
      toast('Selecciona un socio', 'warning');
      return;
    }

    if (formData.motivo.trim().length < 6) {
      toast('Describe el motivo con al menos 6 caracteres', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        origen: formData.origen,
        motivo: formData.motivo.trim(),
        gravedad: formData.gravedad
      };
      if (!editingSancion) payload.socio_id = formData.socio_id;

      await adminApi.saveSancion(payload, editingSancion?.sancion_id);
      setShowCreateModal(false);
      setEditingSancion(null);
      setFormData(initialFormData);
      setSelected(null); // ← cierra el modal de detalle para que no muestre datos viejos
      if (!editingSancion) setPage(1);
      await fetchSanciones();
    } catch (error) {
      toast(error.message || (editingSancion ? 'Error al actualizar sancion' : 'Error al crear sancion'), 'error');
    } finally {
      setSaving(false);
    }
  };

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
          {!canWrite && (
            <span className="sanciones-permission-note">
              <Lock size={14} /> Solo consulta
            </span>
          )}
          {canWrite && (
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

      <FilterBar
        values={filters}
        onFilterChange={setAllFilters}
        searchKey="socio"
        searchPlaceholder="Buscar por socio o número"
        showDateRange
        filters={[
          {
            label: 'Gravedad',
            key: 'gravedad',
            options: [
              { value: 'Leve', label: 'Leve' },
              { value: 'Moderada', label: 'Moderada' },
              { value: 'Grave', label: 'Grave' }
            ]
          },
          {
            label: 'Estado',
            key: 'estado',
            options: [
              { value: 'Activo', label: 'Activa' },
              { value: 'Inactivo', label: 'Resuelta / Inactiva' }
            ]
          },
          {
            label: 'Origen',
            key: 'origen',
            options: origenes.map(o => ({ value: o, label: o }))
          }
        ]}
      />

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

      {selected && (() => {
        const activa = isActiva(selected);
        const gravedad = selected.gravedad || 'Leve';
        const gravedadConfig = gravedad === 'Grave'
          ? { color: '#dc2626', bg: '#fef2f2', borderColor: '#fca5a5' }
          : gravedad === 'Moderada'
            ? { color: '#d97706', bg: '#fffbeb', borderColor: '#fde68a' }
            : { color: '#16a34a', bg: '#f0fdf4', borderColor: '#bbf7d0' };

        return (
          <div className="modal-overlay">
            <div className="modal-content sanciones-modal">
              <div className="modal-header" style={{ borderBottom: `3px solid ${gravedadConfig.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: gravedadConfig.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldAlert size={22} style={{ color: gravedadConfig.color }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>Sancion #{selected.sancion_id}</h3>
                    <p className="sanciones-modal-subtitle">{getNombreSocio(selected)}</p>
                  </div>
                </div>
                <button className="close-modal" type="button" onClick={() => setSelected(null)}><X size={24} /></button>
              </div>

              <div className="modal-body">
                {/* Badges de estado */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <span className={activa ? 'badge-warning' : 'badge-success'}>{estadoLabel(selected)}</span>
                  <span className="badge-neutral">{selected.origen || 'Administracion'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: gravedadConfig.bg, color: gravedadConfig.color, border: `1px solid ${gravedadConfig.borderColor}` }}>
                    <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    {gravedad}
                  </span>
                </div>

                {/* Motivo destacado */}
                <div style={{ background: '#f8fafc', borderLeft: `4px solid ${gravedadConfig.color}`, borderRadius: '0 8px 8px 0', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Motivo</p>
                  <p style={{ margin: 0, fontSize: 15, color: '#0f172a', fontWeight: 600 }}>{selected.motivo}</p>
                </div>

                {/* Grid de info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { Icon: User,       label: 'Socio',   value: getNombreSocio(selected) },
                    { Icon: Hash,       label: 'Número',  value: selected.numero_socio || `ID ${selected.socio_id}` },
                    { Icon: Calendar,   label: 'Fecha',   value: formatDate(selected.fecha_inicio || selected.fecha) },
                    { Icon: CreditCard, label: 'ID Sancion', value: `#${selected.sancion_id}` },
                  ].map(({ Icon, label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={15} style={{ color: '#475569' }} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Card de resolución */}
                <div style={{ border: `1px solid ${activa ? '#fde68a' : '#bbf7d0'}`, borderRadius: 10, background: activa ? '#fffbeb' : '#f0fdf4', padding: '1rem', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: activa ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {activa ? <Clock size={18} style={{ color: '#92400e' }} /> : <UserCheck size={18} style={{ color: '#166534' }} />}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolución</p>
                    {activa ? (
                      <>
                        <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: '#92400e' }}>Pendiente</p>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#78716c' }}>{canResolve ? 'Puedes marcarla como resuelta desde este panel.' : 'Tu rol solo permite consultar el estado.'}</p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 700, color: '#166534' }}>{selected.nombre_resolvente || 'Sin registro'}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#4b7a57' }}>{formatDateTime(selected.fecha_resolucion)}</p>
                      </>
                    )}
                  </div>
                </div>

                {isActiva(selected) && !canWrite && (
                  <div className="sanciones-readonly-alert" style={{ marginTop: '0.75rem' }}>
                    <Lock size={16} />
                    Tu rol permite visualizar sanciones. La creación y resolución corresponde a coordinación o administración.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn-outline" type="button" onClick={() => setSelected(null)}>Cerrar</button>
                {canWrite && activa && (
                  <button className="btn-outline" type="button" onClick={() => { setSelected(null); handleOpenEdit(selected); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Edit2 size={15} /> Editar
                  </button>
                )}
                {canResolve && activa && (
                  <button className="btn-primary" type="button" onClick={() => handleResolve(selected)}>
                    <CheckCircle size={16} /> {resolving ? 'Resolviendo...' : 'Resolver sancion'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showCreateModal && canWrite && (
        <div className="modal-overlay">
          <div className="modal-content sanciones-create-modal">
            <div className="modal-header">
              <div>
                <h3>{editingSancion ? 'Editar sancion' : 'Nueva sancion'}</h3>
                <p className="sanciones-modal-subtitle">
                  {editingSancion
                    ? `Modificando sancion #${editingSancion.sancion_id} — ${getNombreSocio(editingSancion)}`
                    : 'Registro disponible solo para administracion y coordinacion.'}
                </p>
              </div>
              <button className="close-modal" type="button" onClick={() => { setShowCreateModal(false); setEditingSancion(null); setFormData(initialFormData); }}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateSancion}>
              <div className="modal-body">
                <div className="sanciones-form-grid">
                  {!editingSancion && (
                    <div className="form-group form-group-full">
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>Socio</span>
                      <SocioBuscador
                        value={formData.socio_id}
                        onChange={(val) => setFormData((current) => ({ ...current, socio_id: val }))}
                      />
                    </div>
                  )}

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
                <button className="btn-outline" type="button" onClick={() => { setShowCreateModal(false); setEditingSancion(null); setFormData(initialFormData); }}>
                  Cancelar
                </button>
                <button className="btn-primary" type="submit">
                  {saving ? 'Guardando...' : editingSancion ? 'Guardar cambios' : 'Crear sancion'}
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
