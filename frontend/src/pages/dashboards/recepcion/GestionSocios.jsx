import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, UserPlus, RotateCcw, SlidersHorizontal } from 'lucide-react';

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
  tipo: 'Rentista',
  modalidad: 'Individual',
  es_titular: false,
  password: ''
};

const initialFilters = {
  tipo: 'todos',
  estado: 'todos',
  edad: 'todos',
  titularidad: 'todos'
};

const chipBaseStyle = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  borderRadius: '999px',
  padding: '0.4rem 0.85rem',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const activeChipStyle = {
  background: '#0f172a',
  color: '#fff',
  borderColor: '#0f172a'
};

function GestionSocios() {
  const [socios, setSocios] = useState([]);
  const [filteredSocios, setFilteredSocios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validarCurp = (curp) => /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(curp);
  const getInputStyles = (field) => formErrors[field] ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {};

  const normalizeCurp = (curp) => curp.replace(/\s+/g, '').toUpperCase();

  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;

    const fecha = new Date(fechaNacimiento);
    if (Number.isNaN(fecha.getTime())) return null;

    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const mes = hoy.getMonth() - fecha.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
      edad -= 1;
    }

    return edad >= 0 ? edad : null;
  };

  const getEdadLabel = (edad) => {
    if (edad === null) return 'Sin fecha';
    if (edad < 18) return 'Menor';
    if (edad <= 29) return '18-29';
    if (edad <= 44) return '30-44';
    if (edad <= 59) return '45-59';
    return '60+';
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setFormErrors({});
    setEditingSocio(null);
  };

  const validateForm = () => {
    const errors = {};
    const normalizedCurp = normalizeCurp(formData.curp || '');
    const telefonoLimpio = (formData.telefono || '').replace(/\D/g, '');

    if (!formData.nombres?.trim()) errors.nombres = 'Nombres es obligatorio';
    if (!formData.apellidoPaterno?.trim()) errors.apellidoPaterno = 'Apellido paterno es obligatorio';

    if (!formData.email?.trim()) errors.email = 'Email es obligatorio';
    else if (!validarEmail(formData.email.trim())) errors.email = 'Formato de email invalido';

    if (!normalizedCurp) errors.curp = 'CURP es obligatorio';
    else if (normalizedCurp.length !== 18) errors.curp = 'La CURP debe tener 18 caracteres';
    else if (!validarCurp(normalizedCurp)) errors.curp = 'Formato de CURP invalido';

    if (!formData.direccion?.trim()) errors.direccion = 'Direccion es obligatoria';
    if (telefonoLimpio && telefonoLimpio.length !== 10) errors.telefono = 'Telefono debe tener 10 digitos';
    if (formData.fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(formData.fechaNacimiento)) errors.fechaNacimiento = 'Fecha invalida';
    if (!formData.tipo) errors.tipo = 'Seleccione tipo de socio';
    if (!formData.modalidad) errors.modalidad = 'Seleccione una modalidad';
    if (!editingSocio && !formData.password?.trim()) errors.password = 'La contrasena es obligatoria';

    return errors;
  };

  const fetchSocios = async () => {
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('http://localhost:3000/api/socios', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error al cargar socios');

      const data = await res.json();
      const sociosData = Array.isArray(data) ? data : [];
      setSocios(sociosData);
      setFilteredSocios(sociosData);
    } catch (error) {
      console.error(error);
      alert('No se pudieron cargar los socios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocios();
  }, []);

  useEffect(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = socios.filter((socio) => {
      const edad = calcularEdad(socio.fecha_nacimiento);
      const tipoSocio = (socio.tipo_socio || socio.tipo || '').toLowerCase();
      const estadoSocio = socio.activo ? 'activos' : 'inactivos';
      const esTitular = Boolean(socio.es_titular);

      const matchesSearch = !normalizedSearch || [
        socio.nombres,
        socio.apellido_paterno,
        socio.apellido_materno,
        socio.email,
        socio.curp,
        socio.numero_socio
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));

      const matchesTipo = filters.tipo === 'todos' || tipoSocio === filters.tipo;
      const matchesEstado = filters.estado === 'todos' || estadoSocio === filters.estado;
      const matchesTitularidad =
        filters.titularidad === 'todos' ||
        (filters.titularidad === 'titulares' && esTitular) ||
        (filters.titularidad === 'dependientes' && !esTitular);

      const matchesEdad =
        filters.edad === 'todos' ||
        (filters.edad === 'sin_fecha' && edad === null) ||
        (filters.edad === 'menor' && edad !== null && edad < 18) ||
        (filters.edad === '18_29' && edad !== null && edad >= 18 && edad <= 29) ||
        (filters.edad === '30_44' && edad !== null && edad >= 30 && edad <= 44) ||
        (filters.edad === '45_59' && edad !== null && edad >= 45 && edad <= 59) ||
        (filters.edad === '60_mas' && edad !== null && edad >= 60);

      return matchesSearch && matchesTipo && matchesEstado && matchesTitularidad && matchesEdad;
    });

    setFilteredSocios(filtered);
  }, [searchTerm, socios, filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const token = localStorage.getItem('token');
    const url = editingSocio
      ? `http://localhost:3000/api/socios/${editingSocio.socio_id}`
      : 'http://localhost:3000/api/socios';
    const method = editingSocio ? 'PUT' : 'POST';

    const payload = {
      ...formData,
      nombres: formData.nombres.trim(),
      apellidoPaterno: formData.apellidoPaterno.trim(),
      apellidoMaterno: formData.apellidoMaterno.trim(),
      email: formData.email.trim(),
      telefono: formData.telefono.replace(/\D/g, ''),
      curp: normalizeCurp(formData.curp),
      direccion: formData.direccion.trim(),
      activo: editingSocio ? editingSocio.activo : true
    };

    if (editingSocio && !payload.password?.trim()) {
      delete payload.password;
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
        await fetchSocios();
        setShowModal(false);
        resetForm();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar socio');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexion');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Inactivar este socio?')) return;

    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:3000/api/socios/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) fetchSocios();
    else alert('Error al inactivar socio');
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('Eliminar permanentemente? Esta accion no se puede deshacer.')) return;

    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:3000/api/socios/${id}/permanente`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) fetchSocios();
    else alert('Error al eliminar socio');
  };

  const handleReactivate = async (socio) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:3000/api/socios/${socio.socio_id}/reactivar`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) fetchSocios();
    else alert('Error al reactivar socio');
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
      fechaNacimiento: socio.fecha_nacimiento ? String(socio.fecha_nacimiento).slice(0, 10) : '',
      genero: socio.genero || '',
      direccion: socio.direccion || '',
      tipo: socio.tipo_socio || socio.tipo || 'Rentista',
      modalidad: socio.modalidad || 'Individual',
      es_titular: Boolean(socio.es_titular),
      password: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const renderFilterGroup = (label, key, options) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, [key]: option.value }))}
            style={{
              ...chipBaseStyle,
              ...(filters[key] === option.value ? activeChipStyle : {})
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return <div className="chart-box"><p>Cargando socios...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h4 style={{ marginBottom: '0.35rem' }}>Gestion de Socios ({filteredSocios.length})</h4>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            Busca rapido y filtra por perfil del socio para trabajar mas comodo en recepcion.
          </p>
        </div>

        <div className="flex-gap" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, CURP o numero"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            type="button"
            className="btn-outline"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <SlidersHorizontal size={16} /> {showFilters ? 'Ocultar filtros' : 'Filtrar socios'}
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <UserPlus size={16} /> Nuevo Socio
          </button>
        </div>
      </div>

      {showFilters && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: '18px',
            padding: '1rem 1.1rem',
            marginBottom: '1.4rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.9rem', color: '#0f172a' }}>
            <SlidersHorizontal size={16} />
            <strong style={{ fontSize: '14px' }}>Filtros rapidos</strong>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {renderFilterGroup('Tipo de socio', 'tipo', [
              { value: 'todos', label: 'Todos' },
              { value: 'rentista', label: 'Rentista' },
              { value: 'accionista', label: 'Accionista' }
            ])}

            {renderFilterGroup('Estado', 'estado', [
              { value: 'todos', label: 'Todos' },
              { value: 'activos', label: 'Activos' },
              { value: 'inactivos', label: 'Inactivos' }
            ])}

            {renderFilterGroup('Rango de edad', 'edad', [
              { value: 'todos', label: 'Todas' },
              { value: 'menor', label: 'Menor de edad' },
              { value: '18_29', label: '18-29' },
              { value: '30_44', label: '30-44' },
              { value: '45_59', label: '45-59' },
              { value: '60_mas', label: '60+' },
              { value: 'sin_fecha', label: 'Sin fecha' }
            ])}

            {renderFilterGroup('Titularidad', 'titularidad', [
              { value: 'todos', label: 'Todos' },
              { value: 'titulares', label: 'Titulares' },
              { value: 'dependientes', label: 'Dependientes' }
            ])}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>
              {filteredSocios.length} socio(s) coinciden con los filtros actuales
            </span>
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                setSearchTerm('');
                setFilters(initialFilters);
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Socio</th>
              <th>Contacto</th>
              <th>Perfil</th>
              <th>Edad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSocios.length > 0 ? filteredSocios.map((socio) => {
              const edad = calcularEdad(socio.fecha_nacimiento);
              const tipoSocio = socio.tipo_socio || socio.tipo || 'Rentista';

              return (
                <tr key={socio.socio_id}>
                  <td>
                    <strong>{socio.nombres} {socio.apellido_paterno}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {socio.curp || 'Sin CURP'} {socio.numero_socio ? `• ${socio.numero_socio}` : ''}
                    </span>
                  </td>
                  <td>
                    <div>{socio.email}</div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{socio.telefono || 'Sin telefono'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      <span style={{ background: String(tipoSocio).toLowerCase() === 'accionista' ? '#2563eb' : '#059669', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                        {String(tipoSocio).toLowerCase() === 'accionista' ? 'Accionista' : 'Rentista'}
                      </span>
                      <span style={{ background: socio.es_titular ? '#e0f2fe' : '#fef3c7', color: '#0f172a', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                        {socio.es_titular ? 'Titular' : 'Dependiente'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{edad !== null ? `${edad} anos` : 'Sin fecha'}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{getEdadLabel(edad)}</span>
                  </td>
                  <td>
                    <span className={socio.activo ? 'badge-success' : 'badge-warning'}>
                      {socio.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleEdit(socio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar">
                      <Edit2 size={16} />
                    </button>
                    {socio.activo ? (
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
            }) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  No hay socios que coincidan con la busqueda y los filtros seleccionados.
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
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="close-modal"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombres</label>
                    <input
                      value={formData.nombres}
                      onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                      style={getInputStyles('nombres')}
                    />
                    {formErrors.nombres && <p className="field-error">{formErrors.nombres}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Apellido Paterno</label>
                    <input
                      value={formData.apellidoPaterno}
                      onChange={(e) => setFormData({ ...formData, apellidoPaterno: e.target.value })}
                      style={getInputStyles('apellidoPaterno')}
                    />
                    {formErrors.apellidoPaterno && <p className="field-error">{formErrors.apellidoPaterno}</p>}
                  </div>

                  <div className="form-group">
                    <label>Apellido Materno</label>
                    <input
                      value={formData.apellidoMaterno}
                      onChange={(e) => setFormData({ ...formData, apellidoMaterno: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="required">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={getInputStyles('email')}
                    />
                    {formErrors.email && <p className="field-error">{formErrors.email}</p>}
                  </div>

                  <div className="form-group">
                    <label>Telefono</label>
                    <input
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      style={getInputStyles('telefono')}
                    />
                    {formErrors.telefono && <p className="field-error">{formErrors.telefono}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">CURP</label>
                    <input
                      value={formData.curp}
                      maxLength={18}
                      onChange={(e) => {
                        setFormData({ ...formData, curp: normalizeCurp(e.target.value) });
                        if (formErrors.curp) {
                          setFormErrors((prev) => ({ ...prev, curp: undefined }));
                        }
                      }}
                      style={{ ...getInputStyles('curp'), letterSpacing: '0.08em' }}
                    />
                    <small style={{ color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                      Usa el formato oficial de 18 caracteres sin espacios.
                    </small>
                    {formErrors.curp && <p className="field-error">{formErrors.curp}</p>}
                  </div>

                  <div className="form-group">
                    <label>Fecha nacimiento</label>
                    <input
                      type="date"
                      value={formData.fechaNacimiento}
                      onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                      style={getInputStyles('fechaNacimiento')}
                    />
                    {formErrors.fechaNacimiento && <p className="field-error">{formErrors.fechaNacimiento}</p>}
                  </div>

                  <div className="form-group">
                    <label>Genero</label>
                    <select value={formData.genero} onChange={(e) => setFormData({ ...formData, genero: e.target.value })}>
                      <option value="">Seleccione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="No especificado">No especificado</option>
                    </select>
                  </div>

                  <div className="form-group form-group-full">
                    <label className="required">Direccion</label>
                    <input
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      style={getInputStyles('direccion')}
                    />
                    {formErrors.direccion && <p className="field-error">{formErrors.direccion}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Tipo de socio</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      style={getInputStyles('tipo')}
                    >
                      <option value="Accionista">Accionista</option>
                      <option value="Rentista">Rentista</option>
                    </select>
                    {formErrors.tipo && <p className="field-error">{formErrors.tipo}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Modalidad</label>
                    <select
                      value={formData.modalidad}
                      onChange={(e) => setFormData({ ...formData, modalidad: e.target.value })}
                      style={getInputStyles('modalidad')}
                    >
                      <option value="Individual">Individual</option>
                      <option value="Familiar">Familiar</option>
                    </select>
                    {formErrors.modalidad && <p className="field-error">{formErrors.modalidad}</p>}
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.6rem' }}>
                      <input
                        type="checkbox"
                        checked={formData.es_titular}
                        onChange={(e) => setFormData({ ...formData, es_titular: e.target.checked })}
                      />
                      Es titular
                    </label>
                  </div>

                  <div className="form-group">
                    <label>{editingSocio ? 'Contrasena (dejar en blanco para no cambiar)' : 'Contrasena *'}</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={getInputStyles('password')}
                    />
                    {formErrors.password && <p className="field-error">{formErrors.password}</p>}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-outline"
                >
                  Cancelar
                </button>
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