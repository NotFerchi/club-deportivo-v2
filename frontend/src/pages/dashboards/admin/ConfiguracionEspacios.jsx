import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, Plus, RotateCcw } from 'lucide-react';

function ConfiguracionEspacios() {
  const [espacios, setEspacios] = useState([]);
  const [filteredEspacios, setFilteredEspacios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEspacio, setEditingEspacio] = useState(null);
  const [disciplinas, setDisciplinas] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    nombre: '',
    disciplina_id: '',
    capacidad_maxima: '',
    activo: true
  });

  const [formErrors, setFormErrors] = useState({});
  const [loadError, setLoadError] = useState('');

  const getInputStyles = (field) => formErrors[field] ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {};

  // ==============================
  // VALIDACIÓN
  // ==============================
  const validateForm = () => {
    const errors = {};

    if (!formData.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio';
    } else if (formData.nombre.length < 3) {
      errors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (!formData.capacidad_maxima) {
      errors.capacidad = 'La capacidad es obligatoria';
    } else if (Number(formData.capacidad_maxima) <= 0) {
      errors.capacidad = 'Capacidad inválida (debe ser mayor a 0)';
    } else if (Number(formData.capacidad_maxima) > 500) {
      errors.capacidad = 'Capacidad máxima no puede superar 500';
    }

    return errors;
  };

  // ==============================
  // FETCH ESPACIOS - CORREGIDO
  // ==============================
  const fetchEspacios = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoadError('No hay sesión activa');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/espacios/todos', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('Status espacios:', res.status);

      if (!res.ok) {
        if (res.status === 401) {
          alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          window.location.href = '/login';
          return;
        }
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Respuesta espacios:', data);
      
      // Verificar si data es un array
      let listaEspacios = [];
      if (Array.isArray(data)) {
        listaEspacios = data;
      } else if (data.data && Array.isArray(data.data)) {
        listaEspacios = data.data;
      } else if (data.espacios && Array.isArray(data.espacios)) {
        listaEspacios = data.espacios;
      } else {
        console.error('La respuesta no es un array:', data);
        listaEspacios = [];
      }

      setEspacios(listaEspacios);
      setFilteredEspacios(listaEspacios);
    } catch (error) {
      console.error('Error en fetchEspacios:', error);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // FETCH DISCIPLINAS - CORREGIDO
  // ==============================
  const fetchDisciplinas = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:3000/api/espacios/disciplinas', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error('Error al cargar disciplinas');
      }

      const data = await res.json();
      let listaDisciplinas = [];
      if (Array.isArray(data)) {
        listaDisciplinas = data;
      } else if (data.data && Array.isArray(data.data)) {
        listaDisciplinas = data.data;
      } else if (data.disciplinas && Array.isArray(data.disciplinas)) {
        listaDisciplinas = data.disciplinas;
      }
      setDisciplinas(listaDisciplinas);
    } catch (error) {
      console.error('fetchDisciplinas error:', error);
    }
  };

  useEffect(() => {
    fetchEspacios();
    fetchDisciplinas();
  }, []);

  // ==============================
  // BUSCADOR
  // ==============================
  useEffect(() => {
    if (!searchTerm) {
      setFilteredEspacios(espacios);
    } else {
      const filtered = espacios.filter(e =>
        e.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.disciplina?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEspacios(filtered);
    }
  }, [searchTerm, espacios]);

  // ==============================
  // GUARDAR (CREAR/EDITAR) - CORREGIDO
  // ==============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('No hay sesión activa');
      return;
    }

    const url = editingEspacio
      ? `http://localhost:3000/api/espacios/${editingEspacio.espacio_id}`
      : 'http://localhost:3000/api/espacios';

    const method = editingEspacio ? 'PUT' : 'POST';

    const datosEnviar = {
      nombre: formData.nombre.trim(),
      disciplina_id: formData.disciplina_id ? parseInt(formData.disciplina_id) : null,
      capacidad_maxima: parseInt(formData.capacidad_maxima),
      activo: formData.activo
    };

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(datosEnviar)
      });

      if (res.ok) {
        await fetchEspacios();
        setShowModal(false);
        setEditingEspacio(null);
        setFormErrors({});
        setFormData({ nombre: '', disciplina_id: '', capacidad_maxima: '', activo: true });
        setSuccessMessage(editingEspacio ? 'Espacio actualizado correctamente' : 'Espacio creado correctamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // INACTIVAR/REACTIVAR - CORREGIDO
  // ==============================
  const handleToggleActivo = async (espacio, activo) => {
    const confirmMessage = activo
      ? '¿Reactivar este espacio?'
      : '¿Inactivar este espacio?';
    if (!confirm(confirmMessage)) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('No hay sesión activa');
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/espacios/${espacio.espacio_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: espacio.nombre,
          disciplina_id: espacio.disciplina_id,
          capacidad_maxima: espacio.capacidad_maxima,
          activo: activo
        })
      });

      if (res.ok) {
        await fetchEspacios();
        setSuccessMessage(activo ? 'Espacio reactivado correctamente' : 'Espacio inactivado correctamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al actualizar estado del espacio');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // ELIMINAR PERMANENTE - CORREGIDO
  // ==============================
  const handlePermanentDelete = async (id) => {
    if (!confirm('⚠️ ¿Eliminar DEFINITIVAMENTE este espacio?\n\nEsta acción no se puede deshacer.')) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('No hay sesión activa');
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/espacios/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchEspacios();
        setSuccessMessage('Espacio eliminado permanentemente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar el espacio');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // EDITAR
  // ==============================
  const handleEdit = (espacio) => {
    setEditingEspacio(espacio);
    setFormData({
      nombre: espacio.nombre,
      disciplina_id: espacio.disciplina_id?.toString() || '',
      capacidad_maxima: espacio.capacidad_maxima?.toString() || '',
      activo: espacio.activo
    });
    setFormErrors({});
    setShowModal(true);
  };

  if (loading) return <div className="chart-box"><p>Cargando espacios...</p></div>;
  if (loadError) return <div className="chart-box"><p style={{ color: '#b91c1c' }}>{loadError}</p></div>;

  return (
    <div className="chart-box">

      {/* Mensaje de éxito */}
      {showSuccess && (
        <div className="success-toast">
          <span>✅ {successMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h4>🏟️ Configuración de Espacios ({filteredEspacios.length})</h4>

        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre o disciplina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              setEditingEspacio(null);
              setFormData({ nombre: '', disciplina_id: '', capacidad_maxima: '', activo: true });
              setFormErrors({});
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Nuevo Espacio
          </button>
        </div>
      </div>

      {/* GRID DE TARJETAS */}
      {filteredEspacios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p>No hay espacios registrados</p>
          <button
            className="btn-primary"
            onClick={() => {
              setEditingEspacio(null);
              setFormData({ nombre: '', disciplina_id: '', capacidad_maxima: '', activo: true });
              setFormErrors({});
              setShowModal(true);
            }}
            style={{ marginTop: '1rem' }}
          >
            <Plus size={16} /> Crear primer espacio
          </button>
        </div>
      ) : (
        <div className="grid-auto">
          {filteredEspacios.map(espacio => (
            <div key={espacio.espacio_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{espacio.nombre}</h3>
                  <p className="espacio-sub">
                    ID: {espacio.espacio_id}
                  </p>
                </div>
                <span className={espacio.activo ? 'badge-success' : 'badge-warning'}>
                  {espacio.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="espacio-body">
                <div className="espacio-stat">
                  <span className="stat-label">Disciplina</span>
                  <span className="stat-value">
                    {espacio.disciplina || 'Sin disciplina asignada'}
                  </span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Capacidad máxima</span>
                  <span className="stat-value">
                    {espacio.capacidad_maxima} personas
                  </span>
                </div>
              </div>

              <div className="espacio-footer">
                <button
                  onClick={() => handleEdit(espacio)}
                  className="btn-icon-edit"
                  title="Editar espacio"
                >
                  <Edit2 size={14} />
                </button>

                {espacio.activo ? (
                  <button
                    onClick={() => handleToggleActivo(espacio, false)}
                    className="btn-icon-inactive"
                    title="Inactivar espacio"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="btn-group">
                    <button
                      onClick={() => handleToggleActivo(espacio, true)}
                      className="btn-icon-reactivate"
                      title="Reactivar espacio"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(espacio.espacio_id)}
                      className="btn-icon-delete"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingEspacio ? '✏️ Editar Espacio' : '➕ Nuevo Espacio'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>
                  Los campos marcados con * son obligatorios.
                </p>
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
                      placeholder="Ej: Auditorio Principal, Cancha de Fútbol"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      style={getInputStyles('nombre')}
                      autoFocus
                    />
                    {formErrors.nombre && <p className="field-error">{formErrors.nombre}</p>}
                  </div>

                  <div className="form-group form-group-full">
                    <label>Disciplina (opcional)</label>
                    <select
                      value={formData.disciplina_id}
                      onChange={(e) => setFormData({ ...formData, disciplina_id: e.target.value })}
                    >
                      <option value="">Seleccione una disciplina</option>
                      {disciplinas.map(d => (
                        <option key={d.disciplina_id} value={d.disciplina_id}>
                          {d.nombre}
                        </option>
                      ))}
                    </select>
                    {disciplinas.length === 0 && (
                      <p className="field-hint">💡 No hay disciplinas registradas. Puedes dejarlo vacío.</p>
                    )}
                  </div>

                  <div className="form-group form-group-full">
                    <label className="required">Capacidad máxima</label>
                    <input
                      type="number"
                      placeholder="Ej: 100"
                      value={formData.capacidad_maxima}
                      onChange={(e) => setFormData({ ...formData, capacidad_maxima: e.target.value })}
                      style={getInputStyles('capacidad')}
                      min="1"
                      max="500"
                    />
                    {formErrors.capacidad && <p className="field-error">{formErrors.capacidad}</p>}
                    <p className="field-hint">💡 Capacidad máxima (1-500 personas)</p>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormErrors({});
                  }}
                  className="btn-outline"
                >
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

      <style jsx>{`
        .success-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .grid-auto {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .espacio-card-modern {
          background: white;
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .espacio-card-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .espacio-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .espacio-title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }
        .espacio-sub {
          margin: 0.25rem 0 0;
          font-size: 0.75rem;
          color: #6b7280;
        }
        .espacio-body {
          margin-bottom: 1rem;
        }
        .espacio-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .stat-label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .stat-value {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f2937;
        }
        .espacio-footer {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }
        .btn-group {
          display: flex;
          gap: 0.5rem;
        }
        .btn-icon-edit, .btn-icon-inactive, .btn-icon-reactivate, .btn-icon-delete {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 0.5rem;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-icon-edit { background: #3b82f6; color: white; }
        .btn-icon-edit:hover { background: #2563eb; }
        .btn-icon-inactive { background: #ef4444; color: white; }
        .btn-icon-inactive:hover { background: #dc2626; }
        .btn-icon-reactivate { background: #10b981; color: white; }
        .btn-icon-reactivate:hover { background: #059669; }
        .btn-icon-delete { background: #b91c1c; color: white; }
        .btn-icon-delete:hover { background: #991b1b; }
        .badge-success { background: #d1fae5; color: #065f46; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .badge-warning { background: #fed7aa; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .field-hint { font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem; }
      `}</style>
    </div>
  );
}

export default ConfiguracionEspacios;