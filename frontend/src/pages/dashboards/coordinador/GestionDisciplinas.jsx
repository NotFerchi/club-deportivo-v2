import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, Plus } from 'lucide-react';

function GestionDisciplinas() {
  const [disciplinas, setDisciplinas] = useState([]);
  const [filteredDisciplinas, setFilteredDisciplinas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDisciplina, setEditingDisciplina] = useState(null);
  const [formData, setFormData] = useState({ nombre: '' });

  const fetchDisciplinas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/disciplinas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDisciplinas(data);
      setFilteredDisciplinas(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisciplinas();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredDisciplinas(disciplinas);
    } else {
      const filtered = disciplinas.filter(d =>
        d.nombre?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDisciplinas(filtered);
    }
  }, [searchTerm, disciplinas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingDisciplina
        ? `http://localhost:3000/api/disciplinas/${editingDisciplina.disciplina_id}`
        : 'http://localhost:3000/api/disciplinas';
      const method = editingDisciplina ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchDisciplinas();
        setShowModal(false);
        setEditingDisciplina(null);
        setFormData({ nombre: '' });
        alert(editingDisciplina ? 'Disciplina actualizada' : 'Disciplina creada');
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta disciplina?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/disciplinas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDisciplinas();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando disciplinas...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>🏋️ Disciplinas Deportivas ({filteredDisciplinas.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar disciplina..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => { setEditingDisciplina(null); setFormData({ nombre: '' }); setShowModal(true); }} className="btn-primary">
            <Plus size={16} /> Nueva Disciplina
          </button>
        </div>
      </div>

      <div className="grid-auto">
        {filteredDisciplinas.map(disciplina => (
          <div key={disciplina.disciplina_id} className="espacio-card">
            <div className="flex-between">
              <div className="espacio-nombre">{disciplina.nombre}</div>
              <div className="flex-gap">
                <button onClick={() => { setEditingDisciplina(disciplina); setFormData({ nombre: disciplina.nombre }); setShowModal(true); }} className="btn-icon" style={{ color: '#3b82f6' }}><Edit2 size={16} /></button>
                <button onClick={() => handleDelete(disciplina.disciplina_id)} className="btn-icon" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nueva/Editar Disciplina */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{editingDisciplina ? 'Editar Disciplina' : 'Nueva Disciplina'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required">Nombre de la Disciplina</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} required placeholder="Ej: Yoga, Natación, Tenis" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">{editingDisciplina ? 'Actualizar' : 'Crear Disciplina'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionDisciplinas;