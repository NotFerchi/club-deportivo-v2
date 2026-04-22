import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, Plus } from 'lucide-react';

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

  const fetchEspacios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/espacios/todos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEspacios(data);
      setFilteredEspacios(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisciplinas = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/disciplinas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setDisciplinas(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchEspacios();
    fetchDisciplinas();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredEspacios(espacios);
    } else {
      const filtered = espacios.filter(e =>
        e.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.disciplina?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEspacios(filtered);
    }
  }, [searchTerm, espacios]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingEspacio
        ? `http://localhost:3000/api/espacios/${editingEspacio.espacio_id}`
        : 'http://localhost:3000/api/espacios';
      const method = editingEspacio ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchEspacios();
        setShowModal(false);
        setEditingEspacio(null);
        setFormData({ nombre: '', disciplina_id: '', capacidad_maxima: '', activo: true });
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este espacio?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/espacios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchEspacios();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEdit = (espacio) => {
    setEditingEspacio(espacio);
    setFormData({
      nombre: espacio.nombre,
      disciplina_id: espacio.disciplina_id?.toString() || '',
      capacidad_maxima: espacio.capacidad_maxima,
      activo: espacio.activo
    });
    setShowModal(true);
  };

  if (loading) return <div className="chart-box"><p>Cargando espacios...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>🏟️ Configuración de Espacios ({filteredEspacios.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar espacio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => { setEditingEspacio(null); setFormData({ nombre: '', disciplina_id: '', capacidad_maxima: '', activo: true }); setShowModal(true); }} className="btn-primary">
            <Plus size={16} /> Nuevo Espacio
          </button>
        </div>
      </div>

      <div className="grid-auto">
        {filteredEspacios.map(espacio => (
          <div key={espacio.espacio_id} className="espacio-card">
            <div className="flex-between">
              <div className="espacio-nombre">{espacio.nombre}</div>
              <span className={espacio.activo ? 'badge-success' : 'badge-warning'}>{espacio.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            <div className="espacio-detalle">🎯 {espacio.disciplina || 'Sin disciplina'}</div>
            <div className="espacio-detalle">👥 Capacidad: {espacio.capacidad_maxima} personas</div>
            <div className="flex-gap" style={{ marginTop: '0.75rem' }}>
              <button onClick={() => handleEdit(espacio)} className="btn-outline" style={{ padding: '4px 12px', fontSize: '11px' }}>Editar</button>
              <button onClick={() => handleDelete(espacio.espacio_id)} className="btn-danger" style={{ padding: '4px 12px', fontSize: '11px' }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nuevo/Editar Espacio */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editingEspacio ? 'Editar Espacio' : 'Nuevo Espacio'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required">Nombre del Espacio</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} required placeholder="Ej: Cancha Tenis 1, Alberca Olímpica" />
                </div>
                <div className="form-group">
                  <label>Disciplina</label>
                  <select value={formData.disciplina_id} onChange={(e) => setFormData({...formData, disciplina_id: e.target.value})}>
                    <option value="">Seleccione una disciplina</option>
                    {disciplinas.map(d => <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="required">Capacidad Máxima</label>
                  <input type="number" value={formData.capacidad_maxima} onChange={(e) => setFormData({...formData, capacidad_maxima: e.target.value})} required min="1" />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={formData.activo} onChange={(e) => setFormData({...formData, activo: e.target.value === 'true'})}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">{editingEspacio ? 'Actualizar' : 'Crear Espacio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfiguracionEspacios;