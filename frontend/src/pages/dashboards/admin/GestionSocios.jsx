import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, RotateCcw, Trash2, UserPlus, Users, X } from 'lucide-react';
import { adminApi, apiRequest } from '../../../services/api';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { getFullName, getSocioNumero, getSocioTipo, isActiveValue, normalizeText, toDateInputValue } from '../../../utils/adminData';

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
  tipo_socio: 'rentista',
  password: ''
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function GestionSocios() {
  const [socios, setSocios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('activos');
  const [sortBy, setSortBy] = useState('nombre-asc');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});

  const fetchSocios = async () => {
    try {
      setSocios(await adminApi.getSocios());
    } catch (error) {
      if (error.status === 401) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }
      alert(`Error al cargar socios: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocios();
  }, []);

  const filteredSocios = useMemo(() => {
    const query = normalizeText(searchTerm);
    const filtered = socios.filter(socio => {
      const tipo = getSocioTipo(socio);
      const activo = isActiveValue(socio.activo);
      const text = normalizeText([
        getFullName(socio),
        socio.email,
        socio.curp,
        getSocioNumero(socio)
      ].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterTipo && tipo !== filterTipo) return false;
      if (filterEstado === 'activos' && !activo) return false;
      if (filterEstado === 'inactivos' && activo) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'numero-asc') return String(getSocioNumero(a)).localeCompare(String(getSocioNumero(b)), 'es', { numeric: true });
      if (sortBy === 'nombre-desc') return getFullName(b).localeCompare(getFullName(a), 'es');
      return getFullName(a).localeCompare(getFullName(b), 'es');
    });
  }, [socios, searchTerm, filterTipo, filterEstado, sortBy]);

  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    const email = formData.email.trim().toLowerCase();
    const curp = formData.curp.trim().toUpperCase();
    const duplicate = (field, value) => socios.some(socio =>
      String(socio[field] || '').toLowerCase() === value.toLowerCase() &&
      socio.socio_id !== editingSocio?.socio_id
    );

    if (formData.nombres.trim().length < 2) errors.nombres = 'Ingresa al menos 2 caracteres';
    if (formData.apellidoPaterno.trim().length < 2) errors.apellidoPaterno = 'Ingresa al menos 2 caracteres';
    if (!email) errors.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Formato de email inválido';
    else if (duplicate('email', email)) errors.email = 'Este email ya pertenece a otro socio';
    if (!curp) errors.curp = 'CURP es obligatoria';
    else if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(curp)) errors.curp = 'Formato de CURP inválido';
    else if (duplicate('curp', curp)) errors.curp = 'Esta CURP ya pertenece a otro socio';
    if (!formData.direccion.trim()) errors.direccion = 'Dirección es obligatoria';
    if (formData.telefono.trim() && !/^\d{10}$/.test(formData.telefono.trim())) errors.telefono = 'Teléfono debe tener 10 dígitos';
    if (formData.fechaNacimiento) {
      const selected = new Date(`${formData.fechaNacimiento}T00:00:00`);
      if (Number.isNaN(selected.getTime()) || selected > new Date()) errors.fechaNacimiento = 'Fecha de nacimiento inválida';
    }
    if (!['accionista', 'rentista'].includes(formData.tipo_socio)) errors.tipo_socio = 'Seleccione tipo de socio';
    if (!editingSocio && formData.password.trim().length < 6) errors.password = 'Contraseña mínima de 6 caracteres';
    if (editingSocio && formData.password.trim() && formData.password.trim().length < 6) errors.password = 'Contraseña mínima de 6 caracteres';

    return errors;
  };

  const resetForm = () => {
    setEditingSocio(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (socio) => {
    setEditingSocio(socio);
    setFormData({
      nombres: socio.nombres || '',
      apellidoPaterno: socio.apellido_paterno || '',
      apellidoMaterno: socio.apellido_materno || '',
      email: socio.email || '',
      telefono: socio.telefono || '',
      curp: socio.curp || '',
      fechaNacimiento: toDateInputValue(socio.fecha_nacimiento),
      genero: socio.genero || '',
      direccion: socio.direccion || '',
      tipo_socio: getSocioTipo(socio),
      password: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const buildPayload = () => {
    const tipo = formData.tipo_socio === 'accionista' ? 'Accionista' : 'Rentista';
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
      tipo,
      tipo_socio: formData.tipo_socio,
      modalidad: editingSocio?.modalidad || 'Individual',
      activo: editingSocio ? editingSocio.activo : true
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
      await adminApi.saveSocio(buildPayload(), editingSocio?.socio_id);
      await fetchSocios();
      setShowModal(false);
      resetForm();
      alert(editingSocio ? 'Socio actualizado correctamente' : 'Socio creado correctamente');
    } catch (error) {
      alert(error.message || 'Error al guardar socio');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Inactivar este socio?')) return;
    try {
      await apiRequest(`/socios/${id}`, { method: 'DELETE' });
      await fetchSocios();
      alert('Socio inactivado correctamente');
    } catch (error) {
      alert(error.message || 'Error al inactivar socio');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('¿Eliminar permanentemente este socio? Esta acción no se puede deshacer.')) return;
    try {
      await apiRequest(`/socios/${id}/permanente`, { method: 'DELETE' });
      await fetchSocios();
      alert('Socio eliminado permanentemente');
    } catch (error) {
      alert(error.message || 'Error al eliminar socio');
    }
  };

  const handleReactivate = async (socio) => {
    try {
      await apiRequest(`/socios/${socio.socio_id}/reactivar`, { method: 'PUT' });
      await fetchSocios();
      alert('Socio reactivado correctamente');
    } catch (error) {
      alert(error.message || 'Error al reactivar socio');
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando socios...</p></div>;

  return (
    <div className="chart-box">
      <ModuleHeader
        icon={Users}
        title="Gestión de Socios"
        count={filteredSocios.length}
        subtitle="Filtros por número, orden alfabético, tipo y estado."
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar nombre, número, email o CURP" />
            <button className="btn-primary" onClick={openCreateModal}>
              <UserPlus size={16} /> Nuevo Socio
            </button>
          </>
        )}
      />

      <div className="admin-filter-row">
        <FilterSelect label="Tipo" value={filterTipo} onChange={setFilterTipo}>
          <option value="">Todos</option>
          <option value="rentista">Rentistas</option>
          <option value="accionista">Accionistas</option>
        </FilterSelect>
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </FilterSelect>
        <FilterSelect label="Orden" value={sortBy} onChange={setSortBy}>
          <option value="nombre-asc">A-Z</option>
          <option value="nombre-desc">Z-A</option>
          <option value="numero-asc">Número</option>
        </FilterSelect>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSocios.map(socio => {
              const tipo = getSocioTipo(socio);
              const activo = isActiveValue(socio.activo);
              return (
                <tr key={socio.socio_id}>
                  <td>{getSocioNumero(socio) || '-'}</td>
                  <td>
                    <strong>{getFullName(socio)}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{socio.curp}</span>
                  </td>
                  <td>{socio.email}</td>
                  <td>
                    <span className={tipo === 'accionista' ? 'badge-info' : 'badge-success'}>
                      {tipo === 'accionista' ? 'Accionista' : 'Rentista'}
                    </span>
                  </td>
                  <td>{socio.telefono || '-'}</td>
                  <td><span className={activo ? 'badge-success' : 'badge-warning'}>{activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleEdit(socio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    {activo ? (
                      <button onClick={() => handleDelete(socio.socio_id)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar">
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleReactivate(socio)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar">
                          <RotateCcw size={16} />
                        </button>
                        <button onClick={() => handlePermanentDelete(socio.socio_id)} className="btn-icon" style={{ color: '#b91c1c' }} title="Eliminar permanentemente">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredSocios.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No hay socios con los filtros actuales.
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
              <h3>{editingSocio ? 'Editar Socio' : 'Nuevo Socio'}</h3>
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
                    <label>Fecha nacimiento</label>
                    <input type="date" value={formData.fechaNacimiento} onChange={event => updateForm('fechaNacimiento', event.target.value)} style={getInputStyles('fechaNacimiento')} />
                    {formErrors.fechaNacimiento && <p className="field-error">{formErrors.fechaNacimiento}</p>}
                  </div>
                  <div className="form-group">
                    <label>Género</label>
                    <select value={formData.genero} onChange={event => updateForm('genero', event.target.value)}>
                      <option value="">Seleccione</option>
                      <option>Masculino</option>
                      <option>Femenino</option>
                      <option>No especificado</option>
                    </select>
                  </div>
                  <div className="form-group form-group-full">
                    <label className="required">Dirección</label>
                    <input value={formData.direccion} onChange={event => updateForm('direccion', event.target.value)} style={getInputStyles('direccion')} />
                    {formErrors.direccion && <p className="field-error">{formErrors.direccion}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Tipo de socio</label>
                    <select value={formData.tipo_socio} onChange={event => updateForm('tipo_socio', event.target.value)} style={getInputStyles('tipo_socio')}>
                      <option value="rentista">Rentista</option>
                      <option value="accionista">Accionista</option>
                    </select>
                    {formErrors.tipo_socio && <p className="field-error">{formErrors.tipo_socio}</p>}
                  </div>
                  <div className="form-group">
                    <label>{editingSocio ? 'Contraseña (opcional)' : 'Contraseña'}</label>
                    <input type="password" value={formData.password} onChange={event => updateForm('password', event.target.value)} style={getInputStyles('password')} />
                    {formErrors.password && <p className="field-error">{formErrors.password}</p>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Socio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionSocios;
