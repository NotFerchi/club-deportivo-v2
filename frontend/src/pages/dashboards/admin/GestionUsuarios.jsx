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
    }

    if (!formData.capacidad_maxima || Number(formData.capacidad_maxima) <= 0) {
      errors.capacidad = 'Capacidad inválida';
    }

    return errors;
  };

  // ==============================
  // FETCH
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

      if (!res.ok) {
        throw new Error('Error al cargar espacios');
      }

      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];

      setEspacios(lista);
      setFilteredEspacios(lista);
    } catch (error) {
      console.error(error);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisciplinas = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('http://localhost:3000/api/espacios/disciplinas', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Error al cargar disciplinas');
      }

      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setDisciplinas(lista);
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
  // GUARDAR (CREAR/EDITAR)
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
  // INACTIVAR/REACTIVAR
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
  // ELIMINAR PERMANENTE
  // ==============================
  const handlePermanentDelete = async (id) => {
    if (!confirm('¿Eliminar definitivamente este espacio? Esta acción no se puede deshacer.')) return;

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

      {/* TABLA */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Disciplina</th>
              <th>Capacidad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filteredEspacios.map(espacio => (
              <tr key={espacio.espacio_id}>
                <td>
                  <strong>{espacio.nombre}</strong>
                </td>
                <td>
                  {espacio.disciplina || '—'}
                </td>
                <td>
                  {espacio.capacidad_maxima} personas
                </td>
                <td>
                  <span className={espacio.activo ? 'badge-success' : 'badge-warning'}>
                    {espacio.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button onClick={() => handleEdit(espacio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar espacio">
                    <Edit2 size={16} />
                  </button>

                  {espacio.activo ? (
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingEspacio ? 'Editar Espacio' : 'Nuevo Espacio'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>
                  Los campos marcados con * son obligatorios.
                </p>
              </div>
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
                    />
                    {formErrors.capacidad && <p className="field-error">{formErrors.capacidad}</p>}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setFormErrors({}); }} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar
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