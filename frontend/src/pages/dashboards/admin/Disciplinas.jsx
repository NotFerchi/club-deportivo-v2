import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bike, CircleDot, Dumbbell, Edit2, Flame, Heart, Music2, Plus, Shield, Target, Trash2, Waves, X, Zap } from 'lucide-react';
import { adminApi, apiRequest } from '../../../services/api';
import { EmptyState, FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { normalizeText } from '../../../utils/adminData';

const initialFormData = { nombre: '' };
const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function getDisciplinaConfig(nombre) {
  const n = String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('tenis') || n.includes('tennis') || n.includes('raqueta')) return { color: '#3b82f6', bg: '#eff6ff', Icon: Target };
  if (n.includes('padel') || n.includes('paddle') || n.includes('fronton') || n.includes('squash')) return { color: '#0d9488', bg: '#f0fdfa', Icon: Zap };
  if (n.includes('alberca') || n.includes('natacion') || n.includes('pool') || n.includes('nado') || n.includes('acuatico')) return { color: '#0ea5e9', bg: '#f0f9ff', Icon: Waves };
  if (n.includes('gimnasio') || n.includes('gym') || n.includes('fitness') || n.includes('pesas') || n.includes('crossfit')) return { color: '#ef4444', bg: '#fef2f2', Icon: Dumbbell };
  if (n.includes('futbol') || n.includes('soccer') || n.includes('foot')) return { color: '#22c55e', bg: '#f0fdf4', Icon: CircleDot };
  if (n.includes('basquet') || n.includes('basketball') || n.includes('volei') || n.includes('volleyball')) return { color: '#f97316', bg: '#fff7ed', Icon: CircleDot };
  if (n.includes('karate') || n.includes('taekwondo') || n.includes('judo') || n.includes('artes marciales') || n.includes('box') || n.includes('lucha')) return { color: '#dc2626', bg: '#fef2f2', Icon: Flame };
  if (n.includes('yoga') || n.includes('pilates') || n.includes('meditacion') || n.includes('bienestar')) return { color: '#8b5cf6', bg: '#f5f3ff', Icon: Heart };
  if (n.includes('zumba') || n.includes('aerobics') || n.includes('aerobic') || n.includes('baile') || n.includes('danza')) return { color: '#ec4899', bg: '#fdf2f8', Icon: Music2 };
  if (n.includes('ciclismo') || n.includes('spinning') || n.includes('bici')) return { color: '#84cc16', bg: '#f7fee7', Icon: Bike };
  if (n.includes('esgrima') || n.includes('tiro') || n.includes('arqueria')) return { color: '#6366f1', bg: '#eef2ff', Icon: Shield };
  return { color: '#6366f1', bg: '#eef2ff', Icon: Activity };
}

function Disciplinas({ readOnly = false }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('nombre-asc');
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});

  const fetchDisciplinas = async () => {
    try {
      setDisciplinas(await adminApi.getDisciplinas());
    } catch (error) {
      alert(error.message || 'Error al cargar disciplinas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplinas();
  }, []);

  const filtered = useMemo(() => {
    const query = normalizeText(searchTerm);
    const list = disciplinas.filter(disciplina => !query || normalizeText(disciplina.nombre).includes(query));
    return [...list].sort((a, b) => {
      if (sortBy === 'nombre-desc') return String(b.nombre || '').localeCompare(String(a.nombre || ''), 'es');
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });
  }, [disciplinas, searchTerm, sortBy]);

  const resetForm = () => {
    setEditing(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (disciplina) => {
    setEditing(disciplina);
    setFormData({ nombre: disciplina.nombre || '' });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = {};
    const nombre = formData.nombre.trim();
    const repeated = disciplinas.some(disciplina =>
      normalizeText(disciplina.nombre) === normalizeText(nombre) &&
      disciplina.disciplina_id !== editing?.disciplina_id
    );

    if (nombre.length < 3) errors.nombre = 'El nombre debe tener al menos 3 caracteres';
    if (repeated) errors.nombre = 'Ya existe una disciplina con ese nombre';
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
      await adminApi.saveDisciplina({ nombre: formData.nombre.trim() }, editing?.disciplina_id);
      await fetchDisciplinas();
      setShowModal(false);
      resetForm();
    } catch (error) {
      alert(error.message || 'Error al guardar disciplina');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta disciplina? Se bloqueará si tiene datos asociados.')) return;
    try {
      await apiRequest(`/disciplinas/${id}`, { method: 'DELETE' });
      await fetchDisciplinas();
    } catch (error) {
      alert(error.message || 'Error al eliminar disciplina');
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando disciplinas...</p></div>;

  return (
    <div className="chart-box">
      <ModuleHeader
        icon={Dumbbell}
        title="Disciplinas Deportivas"
        count={filtered.length}
        subtitle={readOnly ? 'Vista gerencial de catalogo deportivo.' : 'Administra el catalogo base de disciplinas.'}
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar disciplina" />
            {!readOnly && (
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Nueva Disciplina
              </button>
            )}
          </>
        )}
      />

      <div className="admin-filter-row">
        <FilterSelect label="Orden" value={sortBy} onChange={setSortBy}>
          <option value="nombre-asc">A-Z</option>
          <option value="nombre-desc">Z-A</option>
        </FilterSelect>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No hay disciplinas con los filtros actuales."
          action={!readOnly && <button className="btn-primary" onClick={openCreateModal}><Plus size={16} /> Crear disciplina</button>}
        />
      ) : (
        <div className="grid-auto">
          {filtered.map(disciplina => {
            const { color, bg, Icon } = getDisciplinaConfig(disciplina.nombre);
            return (
              <div key={disciplina.disciplina_id} className="espacio-card-modern" style={{ borderTop: `3px solid ${color}` }}>
                <div className="espacio-header">
                  <div>
                    <h3 className="espacio-title">{disciplina.nombre}</h3>
                    <p className="espacio-sub">ID: {disciplina.disciplina_id}</p>
                  </div>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} style={{ color }} />
                  </div>
                </div>
                {!readOnly && (
                  <div className="espacio-footer">
                    <button onClick={() => openEditModal(disciplina)} className="btn-outline" title="Editar disciplina">
                      <Edit2 size={16} /> Editar
                    </button>
                    <button onClick={() => handleDelete(disciplina.disciplina_id)} className="btn-outline" title="Eliminar disciplina" style={{ color: '#b91c1c' }}>
                      <Trash2 size={16} /> Eliminar
                    </button>
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
              <h3>{editing ? 'Editar Disciplina' : 'Nueva Disciplina'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group form-group-full">
                  <label className="required">Nombre de la disciplina</label>
                  <input
                    type="text"
                    placeholder="Ej: Fútbol, Tenis, Natación"
                    value={formData.nombre}
                    onChange={event => {
                      setFormData({ nombre: event.target.value });
                      setFormErrors({});
                    }}
                    style={formErrors.nombre ? inputErrorStyle : {}}
                    autoFocus
                  />
                  {formErrors.nombre && <p className="field-error">{formErrors.nombre}</p>}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setFormErrors({}); }} className="btn-outline">
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
    </div>
  );
}

export default Disciplinas;
