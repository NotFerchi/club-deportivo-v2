import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, UserPlus } from 'lucide-react';

function GestionInstructores() {
  const [instructores, setInstructores] = useState([]);
  const [filteredInstructores, setFilteredInstructores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    especialidad: '',
    telefono: '',
    email: '',
    activo: true
  });

  const fetchInstructores = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/instructores', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setInstructores(data);
      setFilteredInstructores(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructores();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredInstructores(instructores);
    } else {
      const filtered = instructores.filter(i =>
        i.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.especialidad?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredInstructores(filtered);
    }
  }, [searchTerm, instructores]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingInstructor
        ? `http://localhost:3000/api/instructores/${editingInstructor.instructor_id}`
        : 'http://localhost:3000/api/instructores';
      const method = editingInstructor ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchInstructores();
        setShowModal(false);
        setEditingInstructor(null);
        setFormData({ nombre: '', especialidad: '', telefono: '', email: '', activo: true });
        alert(editingInstructor ? 'Instructor actualizado' : 'Instructor creado');
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este instructor?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/instructores/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchInstructores();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEdit = (instructor) => {
    setEditingInstructor(instructor);
    setFormData({
      nombre: instructor.nombre,
      especialidad: instructor.especialidad || '',
      telefono: instructor.telefono || '',
      email: instructor.email || '',
      activo: instructor.activo
    });
    setShowModal(true);
  };

  if (loading) return <div className="chart-box"><p>Cargando instructores...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>👨‍🏫 Gestión de Instructores ({filteredInstructores.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => { setEditingInstructor(null); setFormData({ nombre: '', especialidad: '', telefono: '', email: '', activo: true }); setShowModal(true); }} className="btn-primary">
            <UserPlus size={16} /> Nuevo Instructor
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Especialidad</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredInstructores.map(instructor => (
              <tr key={instructor.instructor_id}>
                <td><strong>{instructor.nombre}</strong></td>
                <td>{instructor.especialidad || '—'}</td>
                <td>
                  {instructor.email && <div style={{ fontSize: '11px' }}>{instructor.email}</div>}
                  {instructor.telefono && <div style={{ fontSize: '11px', color: '#64748b' }}>{instructor.telefono}</div>}
                </td>
                <td>
                  <span className={instructor.activo ? 'badge-success' : 'badge-warning'}>
                    {instructor.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button onClick={() => handleEdit(instructor)} className="btn-icon" style={{ color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(instructor.instructor_id)} className="btn-icon" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo/Editar Instructor */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{editingInstructor ? 'Editar Instructor' : 'Nuevo Instructor'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required">Nombre Completo</label>
                  <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Especialidad</label>
                  <input type="text" value={formData.especialidad} onChange={(e) => setFormData({...formData, especialidad: e.target.value})} placeholder="Ej: Yoga, Natación, Tenis" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} />
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
                <button type="submit" className="btn-primary">{editingInstructor ? 'Actualizar' : 'Crear Instructor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionInstructores;