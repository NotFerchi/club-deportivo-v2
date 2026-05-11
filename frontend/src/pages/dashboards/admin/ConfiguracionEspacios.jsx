import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Edit2, MapPin, Plus, RotateCcw, Trash2, X } from 'lucide-react';
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
      if (error.status === 401) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }
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
            return (
              <div key={espacio.espacio_id} className="espacio-card-modern">
                <div className="espacio-header">
                  <div>
                    <h3 className="espacio-title">{espacio.nombre}</h3>
                    <p className="espacio-sub">ID: {espacio.espacio_id}</p>
                  </div>
                  <span className={activo ? 'badge-success' : 'badge-warning'}>
                    {activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="espacio-body">
                  <div className="espacio-stat">
                    <span className="stat-label">Disciplina</span>
                    <span className="stat-value">{espacio.disciplina || 'Sin disciplina asignada'}</span>
                  </div>
                  <div className="espacio-stat">
                    <span className="stat-label">Capacidad máxima</span>
                    <span className="stat-value">{espacio.capacidad_maxima} personas</span>
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
