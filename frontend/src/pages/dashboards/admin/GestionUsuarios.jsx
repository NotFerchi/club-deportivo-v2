import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, UserPlus, RotateCcw } from 'lucide-react';

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
    fechaNacimiento: '',
    genero: '',
    direccion: '',
    rol_id: '',
    password: ''
  });

  const [roles, setRoles] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validarCurp = (curp) => /^[A-Z0-9]{18}$/i.test(curp);
  const getInputStyles = (field) => formErrors[field] ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {};

  const validateForm = () => {
    const errors = {};

    if (!formData.nombres?.trim()) {
      errors.nombres = 'Nombres es obligatorio';
    }
    if (!formData.apellidoPaterno?.trim()) {
      errors.apellidoPaterno = 'Apellido paterno es obligatorio';
    }
    if (!formData.email?.trim()) {
      errors.email = 'Email es obligatorio';
    } else if (!validarEmail(formData.email)) {
      errors.email = 'Formato de email inválido';
    }
    if (!formData.curp?.trim()) {
      errors.curp = 'CURP es obligatorio';
    } else if (!validarCurp(formData.curp)) {
      errors.curp = 'CURP debe tener 18 caracteres alfanuméricos';
    }
    if (!formData.rol_id) {
      errors.rol_id = 'Selecciona un rol';
    }
    if (!formData.direccion?.trim()) {
      errors.direccion = 'Dirección es obligatoria';
    }
    if (formData.telefono?.trim() && !/^\d{10}$/.test(formData.telefono)) {
      errors.telefono = 'Teléfono debe tener 10 dígitos numéricos';
    }
    if (formData.fechaNacimiento?.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(formData.fechaNacimiento)) {
      errors.fechaNacimiento = 'Fecha de nacimiento inválida';
    }

    return errors;
  };

  // ==============================
  // 🔹 CARGAR USUARIOS (excluyendo socios) - CORREGIDO
  // ==============================
  const fetchUsuarios = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('No hay token');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/usuarios', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Status usuarios:', res.status);
      
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
      console.log('Respuesta usuarios:', data);
      
      // Verificar si data es un array
      let listaUsuarios = [];
      if (Array.isArray(data)) {
        listaUsuarios = data;
      } else if (data.data && Array.isArray(data.data)) {
        listaUsuarios = data.data;
      } else if (data.usuarios && Array.isArray(data.usuarios)) {
        listaUsuarios = data.usuarios;
      } else {
        console.error('La respuesta no es un array:', data);
        listaUsuarios = [];
      }
      
      // Filtrar para excluir socios (solo admin, gerente, instructor, recepcion)
      const filtrados = listaUsuarios.filter(u => u.rol?.toLowerCase() !== 'socio');
      setUsuarios(filtrados);
      setFilteredUsuarios(filtrados);
    } catch (error) {
      console.error('Error en fetchUsuarios:', error);
      alert('Error al cargar usuarios: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // 🔹 ROLES (excluyendo socio) - CORREGIDO
  // ==============================
  const fetchRoles = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const res = await fetch('http://localhost:3000/api/roles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }
      
      const data = await res.json();
      let listaRoles = [];
      if (Array.isArray(data)) {
        listaRoles = data;
      } else if (data.data && Array.isArray(data.data)) {
        listaRoles = data.data;
      } else if (data.roles && Array.isArray(data.roles)) {
        listaRoles = data.roles;
      }
      
      // Filtrar para excluir el rol de socio
      setRoles(listaRoles.filter(r => r.nombre?.toLowerCase() !== 'socio'));
    } catch (error) {
      console.error('Error en fetchRoles:', error);
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchRoles();
  }, []);

  // ==============================
  // 🔍 BUSCADOR
  // ==============================
  useEffect(() => {
    if (!searchTerm) {
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

  // ==============================
  // ➕ CREAR / EDITAR
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

    const url = editingUser
      ? `http://localhost:3000/api/usuarios/${editingUser.usuario_id}`
      : 'http://localhost:3000/api/usuarios';

    const method = editingUser ? 'PUT' : 'POST';

    const payload = {
      nombres: formData.nombres,
      apellidoPaterno: formData.apellidoPaterno,
      apellidoMaterno: formData.apellidoMaterno,
      email: formData.email,
      telefono: formData.telefono,
      curp: formData.curp,
      fechaNacimiento: formData.fechaNacimiento,
      genero: formData.genero,
      direccion: formData.direccion,
      rol_id: formData.rol_id,
      activo: editingUser ? editingUser.activo ?? true : true
    };

    // Solo incluir password si no está vacío
    if (formData.password) {
      payload.password = formData.password;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchUsuarios();
        setShowModal(false);
        setEditingUser(null);
        setFormErrors({});
        setFormData({
          nombres: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          email: '',
          telefono: '',
          curp: '',
          fechaNacimiento: '',
          genero: '',
          direccion: '',
          rol_id: '',
          password: ''
        });
        alert(editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar usuario');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // ❌ INACTIVAR
  // ==============================
  const handleDelete = async (id) => {
    if (!confirm('¿Inactivar este usuario?')) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchUsuarios();
        alert('Usuario inactivado correctamente');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al inactivar usuario');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // 🗑️ ELIMINAR PERMANENTEMENTE
  // ==============================
  const handlePermanentDelete = async (id) => {
    if (!confirm('¿Eliminar permanentemente este usuario? Esta acción no se puede deshacer.')) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/usuarios/${id}/permanente`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchUsuarios();
        alert('Usuario eliminado permanentemente');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar definitivamente el usuario');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // ♻️ REACTIVAR
  // ==============================
  const handleReactivate = async (user) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/usuarios/${user.usuario_id}/reactivar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchUsuarios();
        alert('Usuario reactivado correctamente');
      } else {
        const data = await res.json();
        alert(data.error || 'Error al reactivar usuario');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // ==============================
  // ✏️ EDITAR
  // ==============================
  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      nombres: user.nombres,
      apellidoPaterno: user.apellido_paterno,
      apellidoMaterno: user.apellido_materno || '',
      email: user.email,
      telefono: user.telefono || '',
      curp: user.curp || '',
      fechaNacimiento: user.fecha_nacimiento || '',
      genero: user.genero || '',
      direccion: user.direccion || '',
      rol_id: user.rol_id?.toString() || '',
      password: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const getRolColor = (rol) => {
    const colores = {
      admin: '#ef4444',
      gerente: '#3b82f6',
      instructor: '#10b981',
      recepcion: '#f59e0b'
    };
    return colores[rol?.toLowerCase()] || '#64748b';
  };

  if (loading) return <div className="chart-box"><p>Cargando usuarios...</p></div>;

  return (
    <div className="chart-box">

      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
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

          <button className="btn-primary" onClick={() => {
            setEditingUser(null);
            setFormData({
              nombres: '',
              apellidoPaterno: '',
              apellidoMaterno: '',
              email: '',
              telefono: '',
              curp: '',
              fechaNacimiento: '',
              genero: '',
              direccion: '',
              rol_id: '',
              password: ''
            });
            setFormErrors({});
            setShowModal(true);
          }}>
            <UserPlus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      {/* TABLA */}
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
                <td>
                  <strong>{user.nombres} {user.apellido_paterno}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{user.curp}</span>
                </td>
                <td>{user.email}</td>
                <td>
                  <span style={{
                    background: getRolColor(user.rol),
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px'
                  }}>
                    {user.rol}
                  </span>
                </td>
                <td>{user.telefono || '—'}</td>
                <td>
                  <span className={user.activo ? 'badge-success' : 'badge-warning'}>
                    {user.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button onClick={() => handleEdit(user)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar usuario">
                    <Edit2 size={16} />
                  </button>

                  {user.activo ? (
                    <button onClick={() => handleDelete(user.usuario_id)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar usuario">
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleReactivate(user)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar usuario">
                        <RotateCcw size={16} />
                      </button>
                      <button onClick={() => handlePermanentDelete(user.usuario_id)} className="btn-icon" style={{ color: '#b91c1c' }} title="Eliminar permanentemente">
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
          <div className="modal-content" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>
                  Los campos marcados con * son obligatorios. Los usuarios creados aquí son empleados (no socios).
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-modal">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombres</label>
                    <input
                      placeholder="Nombre(s)"
                      style={getInputStyles('nombres')}
                      value={formData.nombres}
                      onChange={e => setFormData({...formData, nombres: e.target.value})}
                    />
                    {formErrors.nombres && <p className="field-error">{formErrors.nombres}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Apellido Paterno</label>
                    <input
                      placeholder="Apellido paterno"
                      style={getInputStyles('apellidoPaterno')}
                      value={formData.apellidoPaterno}
                      onChange={e => setFormData({...formData, apellidoPaterno: e.target.value})}
                    />
                    {formErrors.apellidoPaterno && <p className="field-error">{formErrors.apellidoPaterno}</p>}
                  </div>

                  <div className="form-group">
                    <label>Apellido Materno</label>
                    <input
                      placeholder="Apellido materno"
                      value={formData.apellidoMaterno}
                      onChange={e => setFormData({...formData, apellidoMaterno: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="required">Email</label>
                    <input
                      type="email"
                      placeholder="usuario@dominio.com"
                      style={getInputStyles('email')}
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                    {formErrors.email && <p className="field-error">{formErrors.email}</p>}
                  </div>

                  <div className="form-group">
                    <label>Teléfono</label>
                    <input
                      placeholder="10 dígitos"
                      style={getInputStyles('telefono')}
                      value={formData.telefono}
                      onChange={e => setFormData({...formData, telefono: e.target.value})}
                    />
                    {formErrors.telefono && <p className="field-error">{formErrors.telefono}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">CURP</label>
                    <input
                      placeholder="18 caracteres"
                      style={getInputStyles('curp')}
                      value={formData.curp}
                      onChange={e => setFormData({...formData, curp: e.target.value.toUpperCase()})}
                    />
                    {formErrors.curp && <p className="field-error">{formErrors.curp}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Rol</label>
                    <select
                      style={getInputStyles('rol_id')}
                      value={formData.rol_id}
                      onChange={(e) => setFormData({...formData, rol_id: e.target.value})}
                    >
                      <option value="">Seleccione</option>
                      {roles.map(r => (
                        <option key={r.rol_id} value={r.rol_id}>{r.nombre}</option>
                      ))}
                    </select>
                    {formErrors.rol_id && <p className="field-error">{formErrors.rol_id}</p>}
                  </div>

                  <div className="form-group">
                    <label>Fecha de nacimiento</label>
                    <input
                      type="date"
                      style={getInputStyles('fechaNacimiento')}
                      value={formData.fechaNacimiento}
                      onChange={e => setFormData({...formData, fechaNacimiento: e.target.value})}
                    />
                    {formErrors.fechaNacimiento && <p className="field-error">{formErrors.fechaNacimiento}</p>}
                  </div>

                  <div className="form-group">
                    <label>Género</label>
                    <select value={formData.genero} onChange={e => setFormData({...formData, genero: e.target.value})}>
                      <option value="">Seleccione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="No especificado">No especificado</option>
                    </select>
                  </div>

                  <div className="form-group form-group-full">
                    <label className="required">Dirección</label>
                    <input
                      placeholder="Calle, número, colonia"
                      style={getInputStyles('direccion')}
                      value={formData.direccion}
                      onChange={e => setFormData({...formData, direccion: e.target.value})}
                    />
                    {formErrors.direccion && <p className="field-error">{formErrors.direccion}</p>}
                  </div>

                  <div className="form-group form-group-full">
                    <label>{editingUser ? 'Contraseña (solo si desea cambiarla)' : 'Contraseña *'}</label>
                    <input
                      type="password"
                      placeholder={editingUser ? 'Dejar en blanco para no cambiar' : 'Contraseña nueva'}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                    <p className="field-hint">💡 Mínimo 6 caracteres, incluir mayúsculas, números y símbolos</p>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setFormErrors({}); }} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionUsuarios;