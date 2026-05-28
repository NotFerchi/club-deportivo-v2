import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Edit2, History, MapPin, Plus, RotateCcw, Trash2, Wrench, X } from 'lucide-react';
import { adminApi, apiRequest } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { EmptyState, FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { isActiveValue, normalizeText } from '../../../utils/adminData';
import { getDeporteIcono } from '../../../utils/deporteIconos';

const initialFormData = {
  nombre: '',
  disciplina_ids: [],
  capacidad_maxima: '',
  estado: 'Activo'
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

// ── Modal de mantenimiento ────────────────────────────────────────────────────
function MantenimientoModal({ espacio, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onConfirm(motivo.trim(), fechaFin || null);
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wrench size={18} style={{ color: '#f97316' }} />
              Poner en mantenimiento
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              {espacio.nombre}
            </p>
          </div>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group form-group-full">
              <label>Motivo del mantenimiento</label>
              <textarea
                rows={3}
                placeholder="Ej: Reparación de piso, pintura, revisión eléctrica..."
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                style={{ resize: 'vertical', minHeight: 70 }}
                autoFocus
              />
              <p className="field-hint">Opcional pero recomendado para el historial.</p>
            </div>
            <div className="form-group form-group-full">
              <label>Fecha estimada de finalización</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
              />
              <p className="field-hint">Opcional. Puedes reactivar el espacio manualmente en cualquier momento.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-outline" disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}
              style={{ background: '#f97316', borderColor: '#f97316' }}>
              {saving ? 'Guardando...' : 'Confirmar mantenimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function ConfiguracionEspacios({ readOnly = false }) {
  const { toast, showConfirm } = useNotification();
  const [espacios, setEspacios] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMantModal, setShowMantModal] = useState(null);
  const [historialModal, setHistorialModal] = useState(null); // { espacio, registros, error? }
  const [historialLoading, setHistorialLoading] = useState(false);
  const [editingEspacio, setEditingEspacio] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [loadError, setLoadError] = useState('');

  const fetchData = async () => {
    try {
      const [espaciosData, disciplinasData] = await Promise.all([
        adminApi.getEspacios(),
        adminApi.getDisciplinas()
      ]);
      setEspacios(espaciosData);
      setDisciplinas(disciplinasData);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Error al cargar espacios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredEspacios = useMemo(() => {
    const query = normalizeText(searchTerm);
    return espacios.filter(espacio => {
      const estado = espacio.estado || (isActiveValue(espacio.activo) ? 'Activo' : 'Inactivo');
      const text = normalizeText([espacio.nombre, espacio.disciplinas_texto || espacio.disciplina].filter(Boolean).join(' '));
      const disciplinaIds = Array.isArray(espacio.disciplina_ids) ? espacio.disciplina_ids : [];

      if (query && !text.includes(query)) return false;
      if (filterDisciplina && !disciplinaIds.includes(Number(filterDisciplina)) && String(espacio.disciplina_id || '') !== filterDisciplina) return false;
      if (filterEstado === 'activos' && estado !== 'Activo') return false;
      if (filterEstado === 'inactivos' && estado !== 'Inactivo') return false;
      if (filterEstado === 'mantenimiento' && estado !== 'Mantenimiento') return false;
      return true;
    });
  }, [espacios, searchTerm, filterDisciplina, filterEstado]);

  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    const nombre = formData.nombre.trim();
    const capacidad = Number(formData.capacidad_maxima);
    const repeated = espacios.some(e =>
      normalizeText(e.nombre) === normalizeText(nombre) && e.espacio_id !== editingEspacio?.espacio_id
    );
    if (nombre.length < 3) errors.nombre = 'El nombre debe tener al menos 3 caracteres';
    if (repeated) errors.nombre = 'Ya existe un espacio con ese nombre';
    if (!Number.isFinite(capacidad) || capacidad <= 0) errors.capacidad = 'La capacidad debe ser mayor a 0';
    else if (capacidad > 500) errors.capacidad = 'La capacidad máxima no puede superar 500';
    return errors;
  };

  const resetForm = () => {
    setEditingEspacio(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openCreateModal = () => { resetForm(); setShowModal(true); };

  const handleEdit = (espacio) => {
    setEditingEspacio(espacio);
    setFormData({
      nombre: espacio.nombre || '',
      disciplina_ids: Array.isArray(espacio.disciplina_ids) ? espacio.disciplina_ids : (espacio.disciplina_id ? [espacio.disciplina_id] : []),
      capacidad_maxima: espacio.capacidad_maxima?.toString() || '',
      estado: espacio.estado || (isActiveValue(espacio.activo) ? 'Activo' : 'Inactivo')
    });
    setFormErrors({});
    setShowModal(true);
  };

  const showToast = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    const disciplinaIds = formData.disciplina_ids.map(Number).filter(Boolean);
    const payload = {
      nombre: formData.nombre.trim(),
      disciplina_ids: disciplinaIds,
      disciplina_id: disciplinaIds[0] || null,
      capacidad_maxima: Number(formData.capacidad_maxima),
      estado: formData.estado
    };
    try {
      await adminApi.saveEspacio(payload, editingEspacio?.espacio_id);
      await fetchData();
      setShowModal(false);
      resetForm();
      showToast(editingEspacio ? 'Espacio actualizado correctamente' : 'Espacio creado correctamente');
    } catch (error) {
      toast(error.message || 'Error al guardar espacio', 'error');
    }
  };

  // Poner en mantenimiento — abre modal
  const handlePedirMantenimiento = (espacio) => {
    setShowMantModal(espacio);
  };

  // Confirmar mantenimiento con motivo/fecha
  const handleConfirmarMantenimiento = async (motivo, fechaFin) => {
    const espacio = showMantModal;
    try {
      await adminApi.toggleEspacioEstado(espacio.espacio_id, 'Mantenimiento', motivo, fechaFin);
      setShowMantModal(null);
      await fetchData();
      showToast('Espacio puesto en mantenimiento');
    } catch (error) {
      toast(error.message || 'Error al poner en mantenimiento', 'error');
    }
  };

  // Reactivar espacio
  const handleReactivar = async (espacio) => {
    if (!await showConfirm(`¿Reactivar "${espacio.nombre}"?`)) return;
    try {
      await adminApi.toggleEspacioEstado(espacio.espacio_id, 'Activo');
      await fetchData();
      showToast('Espacio reactivado correctamente');
    } catch (error) {
      toast(error.message || 'Error al reactivar espacio', 'error');
    }
  };

  // Inactivar espacio
  const handleInactivar = async (espacio) => {
    if (!await showConfirm(`¿Inactivar "${espacio.nombre}"?`)) return;
    try {
      await adminApi.toggleEspacioEstado(espacio.espacio_id, 'Inactivo');
      await fetchData();
      showToast('Espacio inactivado');
    } catch (error) {
      toast(error.message || 'Error al inactivar espacio', 'error');
    }
  };

  const handleVerHistorial = async (espacio) => {
    setHistorialLoading(true);
    setHistorialModal({ espacio, registros: [], error: null });
    try {
      const data = await adminApi.getMantenimientoHistorial(espacio.espacio_id);
      setHistorialModal({ espacio, registros: Array.isArray(data) ? data : [], error: null });
    } catch (err) {
      const detail = err.data?.pg_code ? ` [${err.data.pg_code}: ${err.data.detail}]` : '';
      setHistorialModal({ espacio, registros: [], error: (err.message || 'Error al cargar historial') + detail });
    } finally {
      setHistorialLoading(false);
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!await showConfirm('¿Eliminar definitivamente este espacio? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await apiRequest(`/espacios/${id}`, { method: 'DELETE' });
      await fetchData();
      showToast('Espacio eliminado permanentemente');
    } catch (error) {
      toast(error.message || 'Error al eliminar espacio', 'error');
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando espacios...</p></div>;
  if (loadError) return <div className="chart-box"><p style={{ color: '#b91c1c' }}>{loadError}</p></div>;

  return (
    <div className="chart-box">
      {showSuccess && (
        <div className="success-toast">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <ModuleHeader
        icon={MapPin}
        title="Configuración de Espacios"
        count={filteredEspacios.length}
        subtitle={readOnly ? 'Vista gerencial de espacios, disponibilidad base y reglas visibles.' : 'Configura espacios, disciplinas, capacidad y disponibilidad.'}
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por nombre o disciplina" />
            {!readOnly && (
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Nuevo Espacio
              </button>
            )}
          </>
        )}
      />

      <div className="admin-filter-row">
        <FilterSelect label="Disciplina" value={filterDisciplina} onChange={setFilterDisciplina}>
          <option value="">Todas</option>
          {disciplinas.map(d => (
            <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="mantenimiento">En mantenimiento</option>
        </FilterSelect>
      </div>

      <div className="space-rules-grid">
        <div><span>Horario operativo</span><strong>06:00 - 22:00</strong><p>Base usada para disponibilidad y reservas del dia.</p></div>
        <div><span>Duracion de reserva</span><strong>60 o 120 minutos</strong><p>El socio elige 1 o 2 horas al hacer la reserva.</p></div>
        <div><span>Regla por socio</span><strong>1 activa por dia</strong><p>Evita sobreocupacion y dobles reservas.</p></div>
      </div>

      {filteredEspacios.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No hay espacios con los filtros actuales."
          action={!readOnly && <button className="btn-primary" onClick={openCreateModal}><Plus size={16} /> Crear espacio</button>}
        />
      ) : (
        <div className="grid-auto">
          {filteredEspacios.map(espacio => {
            const estado = espacio.estado || (isActiveValue(espacio.activo) ? 'Activo' : 'Inactivo');
            const { Icon, color, bg } = getDeporteIcono(espacio.nombre);

            const estadoBadgeStyle = estado === 'Mantenimiento'
              ? { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }
              : estado === 'Inactivo'
              ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }
              : { background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' };

            return (
              <div key={espacio.espacio_id} className="espacio-card-modern"
                style={{ borderTop: `3px solid ${estado === 'Mantenimiento' ? '#f97316' : estado === 'Inactivo' ? '#f59e0b' : color}` }}>

                <div className="espacio-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="espacio-title" style={{ marginBottom: 2 }}>{espacio.nombre}</h3>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ ...estadoBadgeStyle, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                        {estado}
                      </span>
                      {(espacio.disciplinas_texto || espacio.disciplina) && (
                        <span style={{ fontSize: 11, color, background: bg, borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                          {espacio.disciplinas_texto || espacio.disciplina}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                </div>

                <div className="espacio-body" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Capacidad</p>
                    <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{espacio.capacidad_maxima}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>personas</p>
                  </div>
                  <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ID Espacio</p>
                    <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>#{espacio.espacio_id}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>registro</p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="espacio-footer">
                    <button onClick={() => handleVerHistorial(espacio)} className="btn-icon" style={{ color: '#6366f1' }} title="Ver historial de mantenimiento">
                      <History size={16} />
                    </button>
                    <button onClick={() => handleEdit(espacio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar espacio">
                      <Edit2 size={16} />
                    </button>

                    {estado === 'Activo' && (
                      <>
                        <button onClick={() => handlePedirMantenimiento(espacio)} className="btn-icon" style={{ color: '#f97316' }} title="Poner en mantenimiento">
                          <Wrench size={16} />
                        </button>
                        <button onClick={() => handleInactivar(espacio)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar espacio">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}

                    {estado === 'Mantenimiento' && (
                      <>
                        <button onClick={() => handleReactivar(espacio)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar espacio">
                          <RotateCcw size={16} />
                        </button>
                        <button onClick={() => handleInactivar(espacio)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar espacio">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}

                    {estado === 'Inactivo' && (
                      <>
                        <button onClick={() => handleReactivar(espacio)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar espacio">
                          <RotateCcw size={16} />
                        </button>
                        <button onClick={() => handlePermanentDelete(espacio.espacio_id)} className="btn-icon" style={{ color: '#b91c1c' }} title="Eliminar permanentemente">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar espacio */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingEspacio ? 'Editar Espacio' : 'Nuevo Espacio'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>Los campos marcados como obligatorios se validan antes de guardar.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group form-group-full">
                    <label className="required">Nombre del espacio</label>
                    <input
                      type="text"
                      placeholder="Ej: Cancha de Fútbol"
                      value={formData.nombre}
                      onChange={e => updateForm('nombre', e.target.value)}
                      style={getInputStyles('nombre')}
                      autoFocus
                    />
                    {formErrors.nombre && <p className="field-error">{formErrors.nombre}</p>}
                  </div>

                  <div className="form-group form-group-full">
                    <label>Disciplinas</label>
                    {disciplinas.length === 0 ? (
                      <p className="field-hint">No hay disciplinas registradas.</p>
                    ) : (
                      <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, background: '#fff' }}>
                        {disciplinas.map(d => (
                          <label key={d.disciplina_id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#1e293b', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={formData.disciplina_ids.includes(d.disciplina_id)}
                              onChange={e => {
                                const id = d.disciplina_id;
                                const curr = formData.disciplina_ids;
                                updateForm('disciplina_ids', e.target.checked ? [...curr, id] : curr.filter(x => x !== id));
                              }}
                              style={{ accentColor: '#3b82f6', width: 15, height: 15 }}
                            />
                            {d.nombre}
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="field-hint">Selecciona una o más disciplinas que se practican en este espacio.</p>
                  </div>

                  <div className="form-group form-group-full">
                    <label className="required">Capacidad máxima</label>
                    <input
                      type="number"
                      placeholder="Ej: 100"
                      value={formData.capacidad_maxima}
                      onChange={e => updateForm('capacidad_maxima', e.target.value)}
                      style={getInputStyles('capacidad')}
                      min="1"
                      max="500"
                    />
                    {formErrors.capacidad && <p className="field-error">{formErrors.capacidad}</p>}
                    <p className="field-hint">Rango permitido: 1 a 500 personas.</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setFormErrors({}); }} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingEspacio ? 'Actualizar' : 'Crear'} Espacio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de mantenimiento */}
      {showMantModal && (
        <MantenimientoModal
          espacio={showMantModal}
          onClose={() => setShowMantModal(null)}
          onConfirm={handleConfirmarMantenimiento}
        />
      )}

      {/* Modal historial de mantenimiento */}
      {historialModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <History size={18} style={{ color: '#6366f1' }} />
                  Historial de Mantenimiento
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{historialModal.espacio.nombre}</p>
              </div>
              <button onClick={() => setHistorialModal(null)} className="close-modal"><X size={22} /></button>
            </div>
            <div className="modal-body">
              {historialLoading ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>Cargando historial...</p>
              ) : historialModal.error ? (
                <p style={{ textAlign: 'center', color: '#ef4444', padding: '2rem 0' }}>
                  Error: {historialModal.error}
                </p>
              ) : historialModal.registros.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>
                  Este espacio no tiene registros de mantenimiento.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Motivo</th>
                        <th>Registrado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialModal.registros.map(r => (
                        <tr key={r.mant_id}>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            <Clock size={11} style={{ marginRight: 4, color: '#f97316' }} />
                            {r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                          <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            {r.fecha_fin ? new Date(r.fecha_fin).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }) : <span style={{ color: '#f97316', fontWeight: 600 }}>En curso</span>}
                          </td>
                          <td style={{ fontSize: 12 }}>{r.motivo || '—'}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{r.usuario_nombre?.trim() || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setHistorialModal(null)} className="btn-outline">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfiguracionEspacios;
