import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Edit2, Plus, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react';
import { adminApi } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { FilterSelect, ModuleHeader, SearchInput, StatCard } from '../../../components/admin/AdminUI';
import { fechaFinPorGravedad, formatDate, gravedadDias, normalizeGravedad, normalizeText, todayISO, toDateInputValue } from '../../../utils/adminData';

const initialFormData = {
  socio_id: '',
  motivo: '',
  origen: 'Administración',
  gravedad: 'Leve',
  fecha_inicio: todayISO(),
  fecha_fin: fechaFinPorGravedad(todayISO(), 'Leve')
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };
const origenes = ['Administración', 'No-show reserva', 'No-show clase', 'Conducta', 'Reglamento'];

function getSancionActiva(sancion) {
  const estado = String(sancion.estado || '').toLowerCase();
  return sancion.activa === true || estado === 'activa' || estado === 'activo';
}

function getSocioName(socio) {
  return [socio?.nombres, socio?.apellido_paterno].filter(Boolean).join(' ').trim();
}

function gravedadClass(gravedad) {
  const normalized = normalizeGravedad(gravedad);
  if (normalized === 'Grave') return 'badge-danger';
  if (normalized === 'Moderada') return 'badge-warning';
  return 'badge-info';
}

function ReporteSanciones({ readOnly = false }) {
  const { toast, showConfirm } = useNotification();
  const [sanciones, setSanciones] = useState([]);
  const [socios, setSocios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGravedad, setFilterGravedad] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterOrigen, setFilterOrigen] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSancion, setEditingSancion] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState(initialFormData);

  const fetchData = async () => {
    try {
      const [sancionesData, sociosData] = await Promise.all([
        adminApi.getSanciones(),
        adminApi.getSocios()
      ]);
      setSanciones(sancionesData);
      setSocios(sociosData.filter(socio => socio.activo === true || socio.activo === 'true'));
    } catch (error) {
      toast(error.message || 'Error al cargar sanciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const sancionesPorSocio = useMemo(() => {
    const map = new Map();
    sanciones.forEach(sancion => {
      const socioId = String(sancion.socio_id);
      const entry = map.get(socioId) || { total: 0, activas: 0, graves: 0 };
      entry.total += 1;
      if (getSancionActiva(sancion)) entry.activas += 1;
      if (normalizeGravedad(sancion.gravedad) === 'Grave') entry.graves += 1;
      map.set(socioId, entry);
    });
    return map;
  }, [sanciones]);

  const filteredSanciones = useMemo(() => {
    const query = normalizeText(searchTerm);
    return sanciones.filter(sancion => {
      const text = normalizeText([
        sancion.socio_nombre,
        sancion.numero_socio,
        sancion.motivo,
        sancion.tipo_socio,
        sancion.origen
      ].filter(Boolean).join(' '));
      const activa = getSancionActiva(sancion);

      if (query && !text.includes(query)) return false;
      if (filterGravedad && normalizeGravedad(sancion.gravedad) !== filterGravedad) return false;
      if (filterEstado === 'activa' && !activa) return false;
      if (filterEstado === 'resuelta' && activa) return false;
      if (filterOrigen && normalizeText(sancion.origen) !== normalizeText(filterOrigen)) return false;
      return true;
    });
  }, [sanciones, searchTerm, filterGravedad, filterEstado, filterOrigen]);

  const estadisticas = useMemo(() => ({
    activas: sanciones.filter(getSancionActiva).length,
    resueltas: sanciones.filter(sancion => !getSancionActiva(sancion)).length,
    leves: sanciones.filter(sancion => normalizeGravedad(sancion.gravedad) === 'Leve').length,
    moderadas: sanciones.filter(sancion => normalizeGravedad(sancion.gravedad) === 'Moderada').length,
    graves: sanciones.filter(sancion => normalizeGravedad(sancion.gravedad) === 'Grave').length
  }), [sanciones]);

  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

  const updateForm = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'gravedad' || field === 'fecha_inicio') {
        next.fecha_fin = fechaFinPorGravedad(next.fecha_inicio, next.gravedad);
      }
      if (field === 'origen' && normalizeText(value).includes('no-show')) {
        next.gravedad = normalizeGravedad(next.gravedad) === 'Leve' ? 'Moderada' : next.gravedad;
        next.fecha_fin = fechaFinPorGravedad(next.fecha_inicio, next.gravedad);
      }
      return next;
    });
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const suggestedGravedad = (socioId) => {
    const historial = sancionesPorSocio.get(String(socioId));
    if (!historial) return 'Leve';
    if (historial.graves > 0 || historial.activas >= 2) return 'Grave';
    if (historial.total > 0) return 'Moderada';
    return 'Leve';
  };

  const resetForm = () => {
    setEditingSancion(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (sancion) => {
    const gravedad = normalizeGravedad(sancion.gravedad);
    const fechaInicio = toDateInputValue(sancion.fecha_inicio || sancion.fecha) || todayISO();
    setEditingSancion(sancion);
    setFormData({
      socio_id: sancion.socio_id?.toString() || '',
      motivo: sancion.motivo || '',
      origen: sancion.origen || 'Administración',
      gravedad,
      fecha_inicio: fechaInicio,
      fecha_fin: toDateInputValue(sancion.fecha_fin) || fechaFinPorGravedad(fechaInicio, gravedad)
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.socio_id) errors.socio_id = 'Seleccione un socio';
    if (formData.motivo.trim().length < 6) errors.motivo = 'Describe el motivo con al menos 6 caracteres';
    if (!['Leve', 'Moderada', 'Grave'].includes(formData.gravedad)) errors.gravedad = 'Seleccione la gravedad';
    if (!formData.fecha_inicio) errors.fecha_inicio = 'Seleccione fecha de inicio';
    if (!formData.fecha_fin) errors.fecha_fin = 'Fecha fin requerida según gravedad';
    if (formData.fecha_inicio && formData.fecha_fin && formData.fecha_fin < formData.fecha_inicio) {
      errors.fecha_fin = 'Fecha fin no puede ser anterior al inicio';
    }
    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await adminApi.saveSancion({
        socio_id: formData.socio_id,
        motivo: formData.motivo.trim(),
        origen: formData.origen,
        gravedad: formData.gravedad,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin
      }, editingSancion?.sancion_id);
      await fetchData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast(error.message || 'Error al guardar sanción', 'error');
    }
  };

  const handleLevantarSancion = async (id) => {
    if (!await showConfirm('¿Levantar esta sanción? El socio quedará habilitado nuevamente.')) return;
    try {
      await adminApi.levantarSancion(id);
      await fetchData();
    } catch (error) {
      toast(error.message || 'Error al levantar sanción', 'error');
    }
  };

  const handleDeleteSancion = async (id) => {
    if (!await showConfirm('¿Eliminar esta sanción permanentemente? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await adminApi.deleteSancion(id);
      await fetchData();
    } catch (error) {
      toast(error.message || 'Error al eliminar sanción', 'error');
    }
  };

  const syncNoShows = async () => {
    try {
      const result = await adminApi.sincronizarNoShows();
      await fetchData();
      toast(result?.message || 'No-shows sincronizados correctamente', 'success');
    } catch (error) {
      toast(error.message || 'Error al sincronizar no-shows', 'error');
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando sanciones...</p></div>;

  return (
    <div className="chart-box">
      <ModuleHeader
        icon={ShieldAlert}
        title="Reporte de Sanciones"
        count={filteredSanciones.length}
        subtitle="Gravedad configurable por días y reglas de historial/no-show."
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar socio, motivo u origen" />
            {!readOnly && (
              <button className="btn-outline" onClick={syncNoShows}>
                <RefreshCw size={16} /> Sincronizar no-shows
              </button>
            )}
            {!readOnly && (
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Nueva Sanción
              </button>
            )}
          </>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={AlertTriangle} label="Activas" value={estadisticas.activas} tone="danger" />
        <StatCard icon={CheckCircle} label="Resueltas" value={estadisticas.resueltas} tone="success" />
        <StatCard icon={ShieldAlert} label="Leves" value={estadisticas.leves} tone="info" />
        <StatCard icon={ShieldAlert} label="Moderadas" value={estadisticas.moderadas} tone="warning" />
        <StatCard icon={ShieldAlert} label="Graves" value={estadisticas.graves} tone="danger" />
      </div>

      <div className="admin-filter-row">
        <FilterSelect label="Gravedad" value={filterGravedad} onChange={setFilterGravedad}>
          <option value="">Todas</option>
          <option value="Leve">Leve</option>
          <option value="Moderada">Moderada</option>
          <option value="Grave">Grave</option>
        </FilterSelect>
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="activa">Activas</option>
          <option value="resuelta">Resueltas</option>
        </FilterSelect>
        <FilterSelect label="Origen" value={filterOrigen} onChange={setFilterOrigen}>
          <option value="">Todos</option>
          {origenes.map(origen => <option key={origen} value={origen}>{origen}</option>)}
        </FilterSelect>
        {(filterGravedad || filterEstado || filterOrigen) && (
          <button onClick={() => { setFilterGravedad(''); setFilterEstado(''); setFilterOrigen(''); }} className="btn-outline">
            Limpiar filtros
          </button>
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
              <th>Inicio</th>
              <th>Fin</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSanciones.map(sancion => {
              const activa = getSancionActiva(sancion);
              const gravedad = normalizeGravedad(sancion.gravedad);
              return (
                <tr key={sancion.sancion_id} style={!activa ? { opacity: 0.7 } : {}}>
                  <td>
                    <strong>{sancion.socio_nombre}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{sancion.numero_socio || 'Sin número'}</span>
                  </td>
                  <td>{sancion.motivo}</td>
                  <td><span className="badge-neutral">{sancion.origen || 'Administración'}</span></td>
                  <td><span className={gravedadClass(gravedad)}>{gravedad} ({gravedadDias[gravedad]} días)</span></td>
                  <td>{formatDate(sancion.fecha_inicio || sancion.fecha)}</td>
                  <td>{sancion.fecha_fin ? formatDate(sancion.fecha_fin) : 'Indefinida'}</td>
                  <td><span className={activa ? 'badge-warning' : 'badge-success'}>{activa ? 'Activa' : 'Resuelta'}</span></td>
                  <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {!readOnly && (
                      <button onClick={() => handleEdit(sancion)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar sanción">
                        <Edit2 size={16} />
                      </button>
                    )}
                    {!readOnly && activa && (
                      <button onClick={() => handleLevantarSancion(sancion.sancion_id)} className="btn-icon" style={{ color: '#10b981' }} title="Levantar sanción">
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {!readOnly && (
                      <button onClick={() => handleDeleteSancion(sancion.sancion_id)} className="btn-icon" style={{ color: '#ef4444' }} title="Eliminar permanentemente">
                        <Trash2 size={16} />
                      </button>
                    )}
                    {readOnly && <span style={{ fontSize: 12, color: '#94a3b8' }}>Solo lectura</span>}
                  </td>
                </tr>
              );
            })}
            {filteredSanciones.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No hay sanciones con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingSancion ? 'Editar Sanción' : 'Nueva Sanción'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>
                  Días por gravedad: leve {gravedadDias.Leve}, moderada {gravedadDias.Moderada}, grave {gravedadDias.Grave}.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group form-group-full">
                  <label className="required">Socio</label>
                  <select
                    value={formData.socio_id}
                    onChange={event => {
                      const socioId = event.target.value;
                      const gravedad = suggestedGravedad(socioId);
                      setFormData(prev => ({
                        ...prev,
                        socio_id: socioId,
                        gravedad,
                        fecha_fin: fechaFinPorGravedad(prev.fecha_inicio, gravedad)
                      }));
                      setFormErrors(prev => ({ ...prev, socio_id: undefined }));
                    }}
                    style={getInputStyles('socio_id')}
                  >
                    <option value="">Seleccione un socio</option>
                    {socios.map(socio => {
                      const historial = sancionesPorSocio.get(String(socio.socio_id));
                      return (
                        <option key={socio.socio_id} value={socio.socio_id}>
                          {getSocioName(socio)} - {socio.numero_socio || 'Sin número'}{historial ? ` (${historial.activas} activas / ${historial.total} total)` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {formErrors.socio_id && <p className="field-error">{formErrors.socio_id}</p>}
                </div>

                <div className="form-group form-group-full">
                  <label className="required">Motivo</label>
                  <textarea
                    rows="3"
                    value={formData.motivo}
                    onChange={event => updateForm('motivo', event.target.value)}
                    placeholder="Describa el motivo de la sanción"
                    style={getInputStyles('motivo')}
                  />
                  {formErrors.motivo && <p className="field-error">{formErrors.motivo}</p>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Origen</label>
                    <select value={formData.origen} onChange={event => updateForm('origen', event.target.value)}>
                      {origenes.map(origen => <option key={origen} value={origen}>{origen}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="required">Gravedad</label>
                    <select value={formData.gravedad} onChange={event => updateForm('gravedad', event.target.value)} style={getInputStyles('gravedad')}>
                      <option value="Leve">Leve</option>
                      <option value="Moderada">Moderada</option>
                      <option value="Grave">Grave</option>
                    </select>
                    {formErrors.gravedad && <p className="field-error">{formErrors.gravedad}</p>}
                  </div>
                  <div className="form-group">
                    <label>Fecha inicio</label>
                    <input type="date" value={formData.fecha_inicio} onChange={event => updateForm('fecha_inicio', event.target.value)} style={getInputStyles('fecha_inicio')} />
                    {formErrors.fecha_inicio && <p className="field-error">{formErrors.fecha_inicio}</p>}
                  </div>
                  <div className="form-group">
                    <label>Fecha fin</label>
                    <input type="date" value={formData.fecha_fin} onChange={event => updateForm('fecha_fin', event.target.value)} style={getInputStyles('fecha_fin')} />
                    {formErrors.fecha_fin && <p className="field-error">{formErrors.fecha_fin}</p>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingSancion ? 'Actualizar' : 'Crear'} Sanción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReporteSanciones;
