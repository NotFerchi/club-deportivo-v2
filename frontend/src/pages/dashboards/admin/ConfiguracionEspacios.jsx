import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bike, CheckCircle, CircleDot, Dumbbell, Edit2, Flame, Heart, MapPin, Music2, Plus, RotateCcw, Shield, Target, Trash2, Waves, X, Zap } from 'lucide-react';
import { adminApi, apiRequest } from '../../../services/api';
import { EmptyState, FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { isActiveValue, normalizeText } from '../../../utils/adminData';

const initialFormData = {
  nombre: '',
  disciplina_id: '',
  capacidad_maxima: '',
  activo: true
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function getEspacioConfig(nombre, disciplina) {
  const n = String(`${nombre || ''} ${disciplina || ''}`).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('tenis') || n.includes('tennis') || n.includes('raqueta')) return { color: '#3b82f6', bg: '#eff6ff', Icon: Target };
  if (n.includes('padel') || n.includes('paddle') || n.includes('fronton') || n.includes('squash')) return { color: '#0d9488', bg: '#f0fdfa', Icon: Zap };
  if (n.includes('alberca') || n.includes('natacion') || n.includes('pool') || n.includes('nado') || n.includes('acuatico')) return { color: '#0ea5e9', bg: '#f0f9ff', Icon: Waves };
  if (n.includes('gimnasio') || n.includes('gym') || n.includes('fitness') || n.includes('pesas') || n.includes('crossfit')) return { color: '#ef4444', bg: '#fef2f2', Icon: Dumbbell };
  if (n.includes('futbol') || n.includes('soccer') || n.includes('foot')) return { color: '#22c55e', bg: '#f0fdf4', Icon: CircleDot };
  if (n.includes('basquet') || n.includes('basketball') || n.includes('volei') || n.includes('volleyball')) return { color: '#f97316', bg: '#fff7ed', Icon: CircleDot };
  if (n.includes('karate') || n.includes('taekwondo') || n.includes('judo') || n.includes('marcial') || n.includes('box') || n.includes('lucha')) return { color: '#dc2626', bg: '#fef2f2', Icon: Flame };
  if (n.includes('yoga') || n.includes('pilates') || n.includes('meditacion') || n.includes('bienestar')) return { color: '#8b5cf6', bg: '#f5f3ff', Icon: Heart };
  if (n.includes('zumba') || n.includes('aerobic') || n.includes('baile') || n.includes('danza')) return { color: '#ec4899', bg: '#fdf2f8', Icon: Music2 };
  if (n.includes('ciclismo') || n.includes('spinning') || n.includes('bici')) return { color: '#84cc16', bg: '#f7fee7', Icon: Bike };
  if (n.includes('sala') || n.includes('salon') || n.includes('multi')) return { color: '#a855f7', bg: '#faf5ff', Icon: Activity };
  if (n.includes('esgrima') || n.includes('tiro') || n.includes('arqueria')) return { color: '#6366f1', bg: '#eef2ff', Icon: Shield };
  return { color: '#6366f1', bg: '#eef2ff', Icon: MapPin };
}

function ConfiguracionEspacios({ readOnly = false }) {
  const [espacios, setEspacios] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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

  useEffect(() => {
    fetchData();
  }, []);

  const filteredEspacios = useMemo(() => {
    const query = normalizeText(searchTerm);
    return espacios.filter(espacio => {
      const activo = isActiveValue(espacio.activo);
      const text = normalizeText([espacio.nombre, espacio.disciplina].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterDisciplina && String(espacio.disciplina_id || '') !== filterDisciplina) return false;
      if (filterEstado === 'activos' && !activo) return false;
      if (filterEstado === 'inactivos' && activo) return false;
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
    const repeated = espacios.some(espacio =>
      normalizeText(espacio.nombre) === normalizeText(nombre) &&
      espacio.espacio_id !== editingEspacio?.espacio_id
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

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (espacio) => {
    setEditingEspacio(espacio);
    setFormData({
      nombre: espacio.nombre || '',
      disciplina_id: espacio.disciplina_id?.toString() || '',
      capacidad_maxima: espacio.capacidad_maxima?.toString() || '',
      activo: isActiveValue(espacio.activo)
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

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      nombre: formData.nombre.trim(),
      disciplina_id: formData.disciplina_id ? Number(formData.disciplina_id) : null,
      capacidad_maxima: Number(formData.capacidad_maxima),
      activo: formData.activo
    };

    try {
      await adminApi.saveEspacio(payload, editingEspacio?.espacio_id);
      await fetchData();
      setShowModal(false);
      resetForm();
      showToast(editingEspacio ? 'Espacio actualizado correctamente' : 'Espacio creado correctamente');
    } catch (error) {
      alert(error.message || 'Error al guardar espacio');
    }
  };

  const handleToggleActivo = async (espacio, activo) => {
    if (!confirm(activo ? '¿Reactivar este espacio?' : '¿Inactivar este espacio?')) return;

    try {
      await adminApi.saveEspacio({
        nombre: espacio.nombre,
        disciplina_id: espacio.disciplina_id || null,
        capacidad_maxima: espacio.capacidad_maxima,
        activo
      }, espacio.espacio_id);
      await fetchData();
      showToast(activo ? 'Espacio reactivado correctamente' : 'Espacio inactivado correctamente');
    } catch (error) {
      alert(error.message || 'Error al actualizar estado del espacio');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('¿Eliminar definitivamente este espacio? Esta acción no se puede deshacer.')) return;
    try {
      await apiRequest(`/espacios/${id}`, { method: 'DELETE' });
      await fetchData();
      showToast('Espacio eliminado permanentemente');
    } catch (error) {
      alert(error.message || 'Error al eliminar espacio');
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
          {disciplinas.map(disciplina => (
            <option key={disciplina.disciplina_id} value={disciplina.disciplina_id}>{disciplina.nombre}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </FilterSelect>
      </div>

      <div className="space-rules-grid">
        <div>
          <span>Horario operativo</span>
          <strong>06:00 - 22:00</strong>
          <p>Base usada para disponibilidad y reservas del dia.</p>
        </div>
        <div>
          <span>Duracion de reserva</span>
          <strong>60 minutos</strong>
          <p>La hora final se calcula automaticamente.</p>
        </div>
        <div>
          <span>Regla por socio</span>
          <strong>1 activa por dia</strong>
          <p>Evita sobreocupacion y dobles reservas.</p>
        </div>
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
            const activo = isActiveValue(espacio.activo);
            const { color, bg, Icon } = getEspacioConfig(espacio.nombre, espacio.disciplina);
            return (
              <div key={espacio.espacio_id} className="espacio-card-modern" style={{ borderTop: `3px solid ${color}` }}>
                <div className="espacio-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="espacio-title" style={{ marginBottom: 2 }}>{espacio.nombre}</h3>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={activo ? 'badge-success' : 'badge-warning'} style={{ fontSize: 11 }}>
                        {activo ? 'Activo' : 'Inactivo'}
                      </span>
                      {espacio.disciplina && (
                        <span style={{ fontSize: 11, color, background: bg, borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                          {espacio.disciplina}
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
                  <button onClick={() => handleEdit(espacio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar espacio">
                    <Edit2 size={16} />
                  </button>
                  {activo ? (
                    <button onClick={() => handleToggleActivo(espacio, false)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar espacio">
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleToggleActivo(espacio, true)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar espacio">
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

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingEspacio ? 'Editar Espacio' : 'Nuevo Espacio'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>Los campos marcados como obligatorios se validan antes de guardar.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-modal">
                <X size={24} />
              </button>
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
                      onChange={event => updateForm('nombre', event.target.value)}
                      style={getInputStyles('nombre')}
                      autoFocus
                    />
                    {formErrors.nombre && <p className="field-error">{formErrors.nombre}</p>}
                  </div>

                  <div className="form-group form-group-full">
                    <label>Disciplina</label>
                    <select value={formData.disciplina_id} onChange={event => updateForm('disciplina_id', event.target.value)}>
                      <option value="">Sin disciplina asignada</option>
                      {disciplinas.map(disciplina => (
                        <option key={disciplina.disciplina_id} value={disciplina.disciplina_id}>{disciplina.nombre}</option>
                      ))}
                    </select>
                    {disciplinas.length === 0 && <p className="field-hint">No hay disciplinas registradas; puedes dejarlo vacío.</p>}
                  </div>

                  <div className="form-group form-group-full">
                    <label className="required">Capacidad máxima</label>
                    <input
                      type="number"
                      placeholder="Ej: 100"
                      value={formData.capacidad_maxima}
                      onChange={event => updateForm('capacidad_maxima', event.target.value)}
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
    </div>
  );
}

export default ConfiguracionEspacios;
