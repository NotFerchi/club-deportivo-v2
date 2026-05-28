import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Eye, RotateCcw, Trash2, UserPlus, Users, X } from 'lucide-react';
import { adminApi, apiRequest } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { getFullName, isActiveValue, normalizeText, toDateInputValue } from '../../../utils/adminData';

const initialFormData = {
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
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function GestionUsuarios() {
  const { toast, showConfirm } = useNotification();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRol, setFilterRol] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [sortBy, setSortBy] = useState('nombre-asc');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});

  const fetchData = async () => {
    try {
      const [usuariosData, rolesData] = await Promise.all([
        adminApi.getUsuarios(),
        adminApi.getRoles()
      ]);
      setUsuarios(usuariosData.filter(user => normalizeText(user.rol) !== 'socio'));
      setRoles(rolesData.filter(role => normalizeText(role.nombre) !== 'socio'));
    } catch (error) {
      if (error.status === 401) {
        toast('Sesión expirada. Por favor, inicia sesión nuevamente.', 'error');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }
      toast(`Error al cargar usuarios: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredUsuarios = useMemo(() => {
    const query = normalizeText(searchTerm);
    const filtered = usuarios.filter(user => {
      const text = normalizeText([getFullName(user), user.email, user.curp, user.rol].filter(Boolean).join(' '));
      const activo = isActiveValue(user.activo);

      if (query && !text.includes(query)) return false;
      if (filterRol && normalizeText(user.rol) !== filterRol) return false;
      if (filterEstado === 'activos' && !activo) return false;
      if (filterEstado === 'inactivos' && activo) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'rol') return String(a.rol || '').localeCompare(String(b.rol || ''), 'es');
      if (sortBy === 'nombre-desc') return getFullName(b).localeCompare(getFullName(a), 'es');
      return getFullName(a).localeCompare(getFullName(b), 'es');
    });
  }, [usuarios, searchTerm, filterRol, filterEstado, sortBy]);

  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    const email = formData.email.trim().toLowerCase();
    const curp = formData.curp.trim().toUpperCase();
    const duplicate = (field, value) => usuarios.some(user =>
      String(user[field] || '').toLowerCase() === value.toLowerCase() &&
      user.usuario_id !== editingUser?.usuario_id
    );

    if (formData.nombres.trim().length < 2) errors.nombres = 'Ingresa al menos 2 caracteres';
    if (formData.apellidoPaterno.trim().length < 2) errors.apellidoPaterno = 'Ingresa al menos 2 caracteres';
    if (!email) errors.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Formato de email inválido';
    else if (duplicate('email', email)) errors.email = 'Este email ya está registrado';
    if (!curp) errors.curp = 'CURP es obligatoria';
    else if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(curp)) errors.curp = 'Formato de CURP inválido';
    else if (duplicate('curp', curp)) errors.curp = 'Esta CURP ya está registrada';
    if (!formData.rol_id) errors.rol_id = 'Selecciona un rol';
    if (!formData.direccion.trim()) errors.direccion = 'Dirección es obligatoria';
    if (formData.telefono.trim() && !/^\d{10}$/.test(formData.telefono.trim())) errors.telefono = 'Teléfono debe tener 10 dígitos';
    if (formData.fechaNacimiento) {
      const selected = new Date(`${formData.fechaNacimiento}T00:00:00`);
      if (Number.isNaN(selected.getTime()) || selected > new Date()) errors.fechaNacimiento = 'Fecha de nacimiento inválida';
    }
    if (!editingUser && formData.password.trim().length < 6) errors.password = 'Contraseña mínima de 6 caracteres';
    if (editingUser && formData.password.trim() && formData.password.trim().length < 6) errors.password = 'Contraseña mínima de 6 caracteres';

    return errors;
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      nombres: user.nombres || '',
      apellidoPaterno: user.apellido_paterno || '',
      apellidoMaterno: user.apellido_materno || '',
      email: user.email || '',
      telefono: user.telefono || '',
      curp: user.curp || '',
      fechaNacimiento: toDateInputValue(user.fecha_nacimiento),
      genero: user.genero || '',
      direccion: user.direccion || '',
      rol_id: user.rol_id?.toString() || '',
      password: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const buildPayload = () => {
    const payload = {
      nombres: formData.nombres.trim(),
      apellidoPaterno: formData.apellidoPaterno.trim(),
      apellidoMaterno: formData.apellidoMaterno.trim(),
      email: formData.email.trim().toLowerCase(),
      telefono: formData.telefono.trim(),
      curp: formData.curp.trim().toUpperCase(),
      fechaNacimiento: formData.fechaNacimiento || null,
      genero: formData.genero || null,
      direccion: formData.direccion.trim(),
      rol_id: formData.rol_id,
      activo: editingUser ? editingUser.activo ?? true : true
    };

    if (formData.password.trim()) payload.password = formData.password.trim();
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await adminApi.saveUsuario(buildPayload(), editingUser?.usuario_id);
      await fetchData();
      setShowModal(false);
      resetForm();
      toast(editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
    } catch (error) {
      toast(error.message || 'Error al guardar usuario', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!await showConfirm('¿Inactivar este usuario?')) return;
    try {
      await apiRequest(`/usuarios/${id}`, { method: 'DELETE' });
      await fetchData();
      toast('Usuario inactivado correctamente', 'success');
    } catch (error) {
      toast(error.message || 'Error al inactivar usuario', 'error');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!await showConfirm('¿Eliminar permanentemente este usuario? Esta acción no se puede deshacer.', { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await apiRequest(`/usuarios/${id}/permanente`, { method: 'DELETE' });
      await fetchData();
      toast('Usuario eliminado permanentemente', 'success');
    } catch (error) {
      toast(error.message || 'Error al eliminar usuario', 'error');
    }
  };

  const handleReactivate = async (user) => {
    try {
      await apiRequest(`/usuarios/${user.usuario_id}/reactivar`, { method: 'PUT' });
      await fetchData();
      toast('Usuario reactivado correctamente', 'success');
    } catch (error) {
      toast(error.message || 'Error al reactivar usuario', 'error');
    }
  };

  const getRolClass = (rol) => {
    const normalized = normalizeText(rol);
    if (normalized === 'admin') return 'badge-danger';
    if (normalized === 'gerente') return 'badge-info';
    if (normalized === 'instructor') return 'badge-success';
    return 'badge-warning';
  };

  if (loading) return <div className="chart-box"><p>Cargando usuarios...</p></div>;

  return (
    <div className="chart-box">
      <ModuleHeader
        icon={Users}
        title="Gestión de Usuarios"
        count={filteredUsuarios.length}
        subtitle="Usuarios internos; socios excluidos del listado."
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar nombre, email, CURP o rol" />
            <button className="btn-primary" onClick={openCreateModal}>
              <UserPlus size={16} /> Nuevo Usuario
            </button>
          </>
        )}
      />

      <div className="admin-filter-row">
        <FilterSelect label="Rol" value={filterRol} onChange={setFilterRol}>
          <option value="">Todos</option>
          {roles.map(role => (
            <option key={role.rol_id} value={normalizeText(role.nombre)}>{role.nombre}</option>
          ))}
        </FilterSelect>
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </FilterSelect>
        <FilterSelect label="Orden" value={sortBy} onChange={setSortBy}>
          <option value="nombre-asc">A-Z</option>
          <option value="nombre-desc">Z-A</option>
          <option value="rol">Rol</option>
        </FilterSelect>
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
            {filteredUsuarios.map(user => {
              const activo = isActiveValue(user.activo);
              return (
                <tr key={user.usuario_id}>
                  <td>
                    <strong>{getFullName(user)}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{user.curp}</span>
                  </td>
                  <td>{user.email}</td>
                  <td><span className={getRolClass(user.rol)}>{user.rol}</span></td>
                  <td>{user.telefono || '-'}</td>
                  <td><span className={activo ? 'badge-success' : 'badge-warning'}>{activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button onClick={() => setViewingUser(user)} className="btn-icon" style={{ color: '#6366f1' }} title="Ver detalle">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => handleEdit(user)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar usuario">
                      <Edit2 size={16} />
                    </button>
                    {activo ? (
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
              );
            })}
            {filteredUsuarios.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No hay usuarios con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>Los usuarios creados aquí son empleados, no socios.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombres</label>
                    <input value={formData.nombres} onChange={event => updateForm('nombres', event.target.value)} style={getInputStyles('nombres')} />
                    {formErrors.nombres && <p className="field-error">{formErrors.nombres}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Apellido paterno</label>
                    <input value={formData.apellidoPaterno} onChange={event => updateForm('apellidoPaterno', event.target.value)} style={getInputStyles('apellidoPaterno')} />
                    {formErrors.apellidoPaterno && <p className="field-error">{formErrors.apellidoPaterno}</p>}
                  </div>
                  <div className="form-group">
                    <label>Apellido materno</label>
                    <input value={formData.apellidoMaterno} onChange={event => updateForm('apellidoMaterno', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required">Email</label>
                    <input type="email" value={formData.email} onChange={event => updateForm('email', event.target.value)} style={getInputStyles('email')} />
                    {formErrors.email && <p className="field-error">{formErrors.email}</p>}
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input value={formData.telefono} onChange={event => updateForm('telefono', event.target.value.replace(/\D/g, '').slice(0, 10))} style={getInputStyles('telefono')} />
                    {formErrors.telefono && <p className="field-error">{formErrors.telefono}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">CURP</label>
                    <input value={formData.curp} onChange={event => updateForm('curp', event.target.value.toUpperCase().slice(0, 18))} style={getInputStyles('curp')} />
                    {formErrors.curp && <p className="field-error">{formErrors.curp}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Rol</label>
                    <select value={formData.rol_id} onChange={event => updateForm('rol_id', event.target.value)} style={getInputStyles('rol_id')}>
                      <option value="">Seleccione</option>
                      {roles.map(role => (
                        <option key={role.rol_id} value={role.rol_id}>{role.nombre}</option>
                      ))}
                    </select>
                    {formErrors.rol_id && <p className="field-error">{formErrors.rol_id}</p>}
                  </div>
                  <div className="form-group">
                    <label>Fecha de nacimiento</label>
                    <input type="date" value={formData.fechaNacimiento} onChange={event => updateForm('fechaNacimiento', event.target.value)} style={getInputStyles('fechaNacimiento')} />
                    {formErrors.fechaNacimiento && <p className="field-error">{formErrors.fechaNacimiento}</p>}
                  </div>
                  <div className="form-group">
                    <label>Género</label>
                    <select value={formData.genero} onChange={event => updateForm('genero', event.target.value)}>
                      <option value="">Seleccione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="No especificado">No especificado</option>
                    </select>
                  </div>
                  <div className="form-group form-group-full">
                    <label className="required">Dirección</label>
                    <input value={formData.direccion} onChange={event => updateForm('direccion', event.target.value)} style={getInputStyles('direccion')} />
                    {formErrors.direccion && <p className="field-error">{formErrors.direccion}</p>}
                  </div>
                  <div className="form-group form-group-full">
                    <label>{editingUser ? 'Contraseña (opcional)' : 'Contraseña'}</label>
                    <input type="password" value={formData.password} onChange={event => updateForm('password', event.target.value)} style={getInputStyles('password')} />
                    <p className="field-hint">Mínimo 6 caracteres.</p>
                    {formErrors.password && <p className="field-error">{formErrors.password}</p>}
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

      {viewingUser && (() => {
        const u = viewingUser;
        const activo = isActiveValue(u.activo);
        const fields = [
          { label: 'Rol', value: u.rol || '-' },
          { label: 'Estado', value: activo ? 'Activo' : 'Inactivo' },
          { label: 'Email', value: u.email || '-' },
          { label: 'Teléfono', value: u.telefono || '-' },
          { label: 'CURP', value: u.curp || '-' },
          { label: 'Fecha nacimiento', value: u.fecha_nacimiento ? new Date(String(u.fecha_nacimiento).split('T')[0] + 'T00:00:00').toLocaleDateString('es-MX') : '-' },
          { label: 'Género', value: u.genero || '-' },
          { label: 'Dirección', value: u.direccion || '-', full: true },
        ];
        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '580px' }}>
              <div className="modal-header">
                <div>
                  <h3>{getFullName(u)}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Ficha de usuario interno</p>
                </div>
                <button onClick={() => setViewingUser(null)} className="close-modal"><X size={24} /></button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
                  {fields.map(f => (
                    <div key={f.label} style={f.full ? { gridColumn: '1 / -1' } : {}}>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 14, color: '#1e293b', fontWeight: 500 }}>{String(f.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setViewingUser(null)} className="btn-outline">Cerrar</button>
                <button type="button" onClick={() => { setViewingUser(null); handleEdit(u); }} className="btn-primary">
                  <Edit2 size={15} /> Editar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default GestionUsuarios;
