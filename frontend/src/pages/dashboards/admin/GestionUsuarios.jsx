import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, UserPlus } from 'lucide-react';

function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    email: '',
    telefono: '',
    curp: '',
    rol: '',
    password: ''
  });
  const [roles, setRoles] = useState([]);

  // Cargar usuarios
  const fetchUsuarios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/usuarios', {
    headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsuarios(data);
      setFilteredUsuarios(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar roles disponibles
  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/roles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRoles(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
  }, []);

  // Búsqueda
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredUsuarios(usuarios);
    } else {
      const filtered = usuarios.filter(u =>
        u.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.apellido_paterno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.rol?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsuarios(filtered);
    }
  }, [searchTerm, usuarios]);

  // Crear o actualizar usuario
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingUser
        ? `http://localhost:3000/api/usuarios/${editingUser.usuario_id}`
        : 'http://localhost:3000/api/usuarios';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchUsuarios();
        setShowModal(false);
        setEditingUser(null);
        setFormData({ nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '', telefono: '', curp: '', rol: '', password: '' });
        alert(editingUser ? 'Usuario actualizado' : 'Usuario creado. Contraseña: ' + (formData.password || 'empleado123'));
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchUsuarios();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      nombres: user.nombres,
      apellidoPaterno: user.apellido_paterno,
      apellidoMaterno: user.apellido_materno || '',
      email: user.email,
      telefono: user.telefono || '',
      curp: user.curp || '',
      rol: user.rol_id?.toString() || '',
      password: ''
    });
    setShowModal(true);
  };

  const getRolColor = (rol) => {
    const colores = {
      admin: '#ef4444',
      gerente: '#3b82f6',
      instructor: '#10b981',
      recepcion: '#f59e0b',
      socio: '#8b5cf6'
    };
    return colores[rol?.toLowerCase()] || '#64748b';
  };

  if (loading) return <div className="chart-box"><p>Cargando usuarios...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>👥 Gestión de Usuarios ({filteredUsuarios.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o rol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => { setEditingUser(null); setFormData({ nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '', telefono: '', curp: '', rol: '', password: '' }); setShowModal(true); }} className="btn-primary">
            <UserPlus size={16} /> Nuevo Empleado
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsuarios.map(user => (
              <tr key={user.usuario_id}>
                <td><strong>{user.nombres} {user.apellido_paterno}</strong><br /><span style={{ fontSize: '11px', color: '#64748b' }}>{user.curp}</span></td>
                <td>{user.email}</td>
                <td><span style={{ background: getRolColor(user.rol), color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{user.rol}</span></td>
                <td>{user.telefono || '—'}</td>
                <td><span className={user.activo ? 'badge-success' : 'badge-warning'}>{user.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <button onClick={() => handleEdit(user)} className="btn-icon" style={{ color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(user.usuario_id)} className="btn-icon" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo/Editar Usuario */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{editingUser ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-section-title">INFORMACIÓN PERSONAL</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombres</label>
                    <input type="text" value={formData.nombres} onChange={(e) => setFormData({...formData, nombres: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="required">Apellido Paterno</label>
                    <input type="text" value={formData.apellidoPaterno} onChange={(e) => setFormData({...formData, apellidoPaterno: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Apellido Materno</label>
                    <input type="text" value={formData.apellidoMaterno} onChange={(e) => setFormData({...formData, apellidoMaterno: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="required">CURP</label>
                    <input type="text" value={formData.curp} onChange={(e) => setFormData({...formData, curp: e.target.value})} maxLength="18" required />
                  </div>
                  <div className="form-group">
                    <label className="required">Correo Electrónico</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} />
                  </div>
                </div>

                <div className="form-section-title">DATOS LABORALES</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Rol en la Empresa</label>
                    <select value={formData.rol} onChange={(e) => setFormData({...formData, rol: e.target.value})} required>
                      <option value="">Seleccione un rol...</option>
                      {roles.map(r => <option key={r.rol_id} value={r.rol_id}>{r.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="required">Contraseña Temporal</label>
                    <input type="text" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Dejar vacío para auto-generar" />
                  </div>
                </div>

                <div className="form-alert" style={{ marginTop: '1rem' }}>
                  El estado del usuario se asignará como "Activo" automáticamente al confirmar el registro.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">{editingUser ? 'Actualizar' : 'Registrar Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionUsuarios;