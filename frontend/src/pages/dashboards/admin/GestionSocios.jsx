import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search, UserPlus, RotateCcw } from 'lucide-react';

function GestionSocios() {
  const [socios, setSocios] = useState([]);
  const [filteredSocios, setFilteredSocios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState(null);

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
    tipo_socio: 'rentista', // accionista o rentista
    password: ''
  });

  const [formErrors, setFormErrors] = useState({});

  const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validarCurp = (curp) => /^[A-Z0-9]{18}$/i.test(curp);
  const getInputStyles = (field) => formErrors[field] ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {};

  const validateForm = () => {
    const errors = {};
    if (!formData.nombres?.trim()) errors.nombres = 'Nombres es obligatorio';
    if (!formData.apellidoPaterno?.trim()) errors.apellidoPaterno = 'Apellido paterno es obligatorio';
    if (!formData.email?.trim()) errors.email = 'Email es obligatorio';
    else if (!validarEmail(formData.email)) errors.email = 'Formato de email inválido';
    if (!formData.curp?.trim()) errors.curp = 'CURP es obligatorio';
    else if (!validarCurp(formData.curp)) errors.curp = 'CURP debe tener 18 caracteres alfanuméricos';
    if (!formData.direccion?.trim()) errors.direccion = 'Dirección es obligatoria';
    if (formData.telefono?.trim() && !/^\d{10}$/.test(formData.telefono)) errors.telefono = 'Teléfono debe tener 10 dígitos';
    if (formData.fechaNacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(formData.fechaNacimiento)) errors.fechaNacimiento = 'Fecha inválida';
    if (!formData.tipo_socio) errors.tipo_socio = 'Seleccione tipo de socio';
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
      // Asumimos que la API devuelve array de socios
      setSocios(data);
      setFilteredSocios(data);
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
    if (!searchTerm) setFilteredSocios(socios);
    else {
      const filtered = socios.filter(s =>
        s.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.apellido_paterno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.curp?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSocios(filtered);
    }
  }, [searchTerm, socios]);

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
      activo: editingSocio ? editingSocio.activo : true
    };
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
        fetchSocios();
        setShowModal(false);
        setEditingSocio(null);
        setFormErrors({});
        setFormData({
          nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '', telefono: '',
          curp: '', fechaNacimiento: '', genero: '', direccion: '', tipo_socio: 'rentista', password: ''
        });
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar socio');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Inactivar este socio?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:3000/api/socios/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchSocios();
    else alert('Error al inactivar socio');
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('¿Eliminar permanentemente? Esta acción no se puede deshacer.')) return;
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
      nombres: socio.nombres,
      apellidoPaterno: socio.apellido_paterno,
      apellidoMaterno: socio.apellido_materno || '',
      email: socio.email,
      telefono: socio.telefono || '',
      curp: socio.curp || '',
      fechaNacimiento: socio.fecha_nacimiento || '',
      genero: socio.genero || '',
      direccion: socio.direccion || '',
      tipo_socio: socio.tipo_socio || 'rentista',
      password: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  if (loading) return <div className="chart-box"><p>Cargando socios...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h4>👥 Gestión de Socios ({filteredSocios.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o CURP"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button className="btn-primary" onClick={() => {
            setEditingSocio(null);
            setFormData({
              nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '', telefono: '',
              curp: '', fechaNacimiento: '', genero: '', direccion: '', tipo_socio: 'rentista', password: ''
            });
            setFormErrors({});
            setShowModal(true);
          }}>
            <UserPlus size={16} /> Nuevo Socio
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSocios.map(socio => (
              <tr key={socio.socio_id}>
                <td><strong>{socio.nombres} {socio.apellido_paterno}</strong><br /><span style={{ fontSize: '11px', color: '#64748b' }}>{socio.curp}</span></td>
                <td>{socio.email}</td>
                <td><span style={{ background: socio.tipo_socio === 'accionista' ? '#3b82f6' : '#10b981', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{socio.tipo_socio === 'accionista' ? 'Accionista' : 'Rentista'}</span></td>
                <td>{socio.telefono || '—'}</td>
                <td><span className={socio.activo ? 'badge-success' : 'badge-warning'}>{socio.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={() => handleEdit(socio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar"><Edit2 size={16} /></button>
                  {socio.activo ? (
                    <button onClick={() => handleDelete(socio.socio_id)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar"><Trash2 size={16} /></button>
                  ) : (
                    <>
                      <button onClick={() => handleReactivate(socio)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar"><RotateCcw size={16} /></button>
                      <button onClick={() => handlePermanentDelete(socio.socio_id)} className="btn-icon" style={{ color: '#b91c1c' }} title="Eliminar permanentemente"><Trash2 size={16} /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal igual al de GestionUsuarios pero con campos de socio y tipo_socio */}
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
                  <div className="form-group"><label className="required">Nombres</label><input value={formData.nombres} onChange={e => setFormData({...formData, nombres: e.target.value})} style={getInputStyles('nombres')} />{formErrors.nombres && <p className="field-error">{formErrors.nombres}</p>}</div>
                  <div className="form-group"><label className="required">Apellido Paterno</label><input value={formData.apellidoPaterno} onChange={e => setFormData({...formData, apellidoPaterno: e.target.value})} style={getInputStyles('apellidoPaterno')} />{formErrors.apellidoPaterno && <p className="field-error">{formErrors.apellidoPaterno}</p>}</div>
                  <div className="form-group"><label>Apellido Materno</label><input value={formData.apellidoMaterno} onChange={e => setFormData({...formData, apellidoMaterno: e.target.value})} /></div>
                  <div className="form-group"><label className="required">Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={getInputStyles('email')} />{formErrors.email && <p className="field-error">{formErrors.email}</p>}</div>
                  <div className="form-group"><label>Teléfono</label><input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} style={getInputStyles('telefono')} />{formErrors.telefono && <p className="field-error">{formErrors.telefono}</p>}</div>
                  <div className="form-group"><label className="required">CURP</label><input value={formData.curp} onChange={e => setFormData({...formData, curp: e.target.value.toUpperCase()})} style={getInputStyles('curp')} />{formErrors.curp && <p className="field-error">{formErrors.curp}</p>}</div>
                  <div className="form-group"><label>Fecha nacimiento</label><input type="date" value={formData.fechaNacimiento} onChange={e => setFormData({...formData, fechaNacimiento: e.target.value})} style={getInputStyles('fechaNacimiento')} /></div>
                  <div className="form-group"><label>Género</label><select value={formData.genero} onChange={e => setFormData({...formData, genero: e.target.value})}><option value="">Seleccione</option><option>Masculino</option><option>Femenino</option><option>No especificado</option></select></div>
                  <div className="form-group form-group-full"><label className="required">Dirección</label><input value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} style={getInputStyles('direccion')} />{formErrors.direccion && <p className="field-error">{formErrors.direccion}</p>}</div>
                  <div className="form-group"><label className="required">Tipo de socio</label><select value={formData.tipo_socio} onChange={e => setFormData({...formData, tipo_socio: e.target.value})} style={getInputStyles('tipo_socio')}><option value="accionista">Accionista</option><option value="rentista">Rentista</option></select>{formErrors.tipo_socio && <p className="field-error">{formErrors.tipo_socio}</p>}</div>
                  <div className="form-group"><label>{editingSocio ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}</label><input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
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