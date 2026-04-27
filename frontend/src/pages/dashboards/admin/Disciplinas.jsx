import React, { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Trash2, X, Dumbbell } from 'lucide-react';

function Disciplinas() {
  const [disciplinas, setDisciplinas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [formErrors, setFormErrors] = useState({});
  const token = localStorage.getItem('token');

  const fetchDisciplinas = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/disciplinas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDisciplinas(data);
        setFiltered(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplinas();
  }, []);

  useEffect(() => {
    if (!searchTerm) setFiltered(disciplinas);
    else setFiltered(disciplinas.filter(d => d.nombre.toLowerCase().includes(searchTerm.toLowerCase())));
  }, [searchTerm, disciplinas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      setFormErrors({ nombre: 'El nombre es obligatorio' });
      return;
    }
    const url = editing ? `http://localhost:3000/api/disciplinas/${editing.disciplina_id}` : 'http://localhost:3000/api/disciplinas';
    const method = editing ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchDisciplinas();
        setShowModal(false);
        setEditing(null);
        setFormData({ nombre: '', descripcion: '' });
        setFormErrors({});
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta disciplina? Se perderán los datos asociados.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/disciplinas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchDisciplinas();
      else alert('Error al eliminar');
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando disciplinas...</p></div>;

  return (
    <div className="chart-box">

      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h4>🏋️ Disciplinas Deportivas ({filtered.length})</h4>

        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar disciplina..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setFormData({ nombre: '', descripcion: '' });
              setFormErrors({});
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Nueva Disciplina
          </button>
        </div>
      </div>

      {/* GRID DE TARJETAS */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <Dumbbell size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No hay disciplinas registradas</p>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setFormData({ nombre: '', descripcion: '' });
              setFormErrors({});
              setShowModal(true);
            }}
            style={{ marginTop: '1rem' }}
          >
            <Plus size={16} /> Crear primera disciplina
          </button>
        </div>
      ) : (
        <div className="grid-auto">
          {filtered.map(disciplina => (
            <div key={disciplina.disciplina_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">
                    {disciplina.nombre}
                  </h3>
                  <p className="espacio-sub">
                    ID: {disciplina.disciplina_id}
                  </p>
                </div>
                <span className="badge-info">
                  {disciplina.espacios_count || 0} espacios
                </span>
              </div>

              <div className="espacio-body">
                <div className="espacio-stat">
                  <span className="stat-label">Descripción</span>
                  <span className="stat-value">
                    {disciplina.descripcion || 'Sin descripción'}
                  </span>
                </div>
              </div>

              <div className="espacio-footer">
                <button
                  onClick={() => {
                    setEditing(disciplina);
                    setFormData({
                      nombre: disciplina.nombre,
                      descripcion: disciplina.descripcion || ''
                    });
                    setFormErrors({});
                    setShowModal(true);
                  }}
                  className="btn-icon-modern"
                  title="Editar disciplina"
                >
                  <Edit2 size={16} /> Editar
                </button>

                <button
                  onClick={() => handleDelete(disciplina.disciplina_id)}
                  className="btn-icon-danger"
                  title="Eliminar disciplina"
                >
                  <Trash2 size={16} /> Eliminar
                </button>
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
                <h3>{editing ? '✏️ Editar Disciplina' : '➕ Nueva Disciplina'}</h3>
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
                    <label className="required">Nombre de la disciplina</label>
                    <input
                      type="text"
                      placeholder="Ej: Fútbol, Tenis, Natación..."
                      value={formData.nombre}
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                      style={formErrors.nombre ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                      autoFocus
                    />
                    {formErrors.nombre && <p className="field-error">{formErrors.nombre}</p>}
                  </div>

                  <div className="form-group form-group-full">
                    <label>Descripción (opcional)</label>
                    <textarea
                      rows="4"
                      placeholder="Describe brevemente la disciplina..."
                      value={formData.descripcion}
                      onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                      style={{ resize: 'vertical' }}
                    />
                    <p className="field-hint">💡 Ejemplo: "Deporte de equipo jugado con balón"</p>
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
                  {editing ? 'Actualizar' : 'Crear'} Disciplina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
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
          flex-direction: column;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 0.875rem;
          color: #1f2937;
          word-break: break-word;
        }

        .espacio-footer {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .btn-icon-modern, .btn-icon-danger {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-icon-modern {
          background: #3b82f6;
          color: white;
        }

        .btn-icon-modern:hover {
          background: #2563eb;
        }

        .btn-icon-danger {
          background: #ef4444;
          color: white;
        }

        .btn-icon-danger:hover {
          background: #dc2626;
        }

        .badge-info {
          background: #e0e7ff;
          color: #3730a3;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .field-hint {
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  );
}

export default Disciplinas;