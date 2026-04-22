import React, { useEffect, useState } from 'react';
import { Edit2, Trash2, X, Search } from 'lucide-react';

function GestionSocios() {
  const [socios, setSocios] = useState([]);
  const [filteredSocios, setFilteredSocios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState(null);
  const [formData, setFormData] = useState({
    nombres: '', apellidoPaterno: '', apellidoMaterno: '',
    email: '', telefono: '', curp: '', tipo: 'Rentista', modalidad: 'Individual'
  });

  const fetchSocios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/socios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSocios(data);
      setFilteredSocios(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocios();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredSocios(socios);
    } else {
      const filtered = socios.filter(s => 
        s.nombres?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.apellido_paterno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.numero_socio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSocios(filtered);
    }
  }, [searchTerm, socios]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingSocio 
        ? `http://localhost:3000/api/recepcion/socios/${editingSocio.socio_id}`
        : 'http://localhost:3000/api/recepcion/socios';
      const method = editingSocio ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        fetchSocios();
        setShowModal(false);
        setEditingSocio(null);
        setFormData({ nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '', telefono: '', curp: '', tipo: 'Rentista', modalidad: 'Individual' });
        alert('Socio guardado correctamente');
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este socio?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/recepcion/socios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchSocios();
    } catch (error) {
      console.error('Error:', error);
    }
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
      tipo: socio.tipo || 'Rentista',
      modalidad: socio.modalidad || 'Individual'
    });
    setShowModal(true);
  };

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando socios...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>Directorio de Socios ({filteredSocios.length})</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre o No. socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => { setEditingSocio(null); setFormData({ nombres: '', apellidoPaterno: '', apellidoMaterno: '', email: '', telefono: '', curp: '', tipo: 'Rentista', modalidad: 'Individual' }); setShowModal(true); }} className="btn-primary">
            + Nuevo Socio
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>No. Socio</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSocios.map(socio => (
              <tr key={socio.socio_id}>
                <td>
                  <strong>{socio.numero_socio}</strong><br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{socio.email}</span>
                </td>
                <td>{socio.nombres} {socio.apellido_paterno}</td>
                <td><span className="badge-success">{socio.tipo}</span></td>
                <td><span className={socio.socio_activo ? 'badge-success' : 'badge-warning'}>{socio.socio_activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>{socio.telefono || '—'}</td>
                <td>
                  <button onClick={() => handleEdit(socio)} className="btn-icon" style={{ color: '#3b82f6' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(socio.socio_id)} className="btn-icon" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Nuevo/Editar Socio */}
{showModal && (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '600px' }}>
      <div className="modal-header">
        <h3>{editingSocio ? 'Editar Socio' : 'Nuevo Socio'}</h3>
        <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {/* IDENTIDAD */}
          <div className="form-section-title">IDENTIDAD</div>
          <div className="form-row">
            <div className="form-group">
              <label className="required">Nombre(s)</label>
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
              <label className="required">CURP (18 caracteres)</label>
              <input type="text" value={formData.curp} onChange={(e) => setFormData({...formData, curp: e.target.value})} required maxLength="18" />
            </div>
          </div>

          {/* MEMBRESÍA Y CONTACTO */}
          <div className="form-section-title">MEMBRESÍA Y CONTACTO</div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <select value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value})}>
                <option value="Accionista">Accionista</option>
                <option value="Rentista">Rentista</option>
              </select>
            </div>
            <div className="form-group">
              <label>Modalidad</label>
              <select value={formData.modalidad} onChange={(e) => setFormData({...formData, modalidad: e.target.value})}>
                <option value="Individual">Individual</option>
                <option value="Familiar">Familiar</option>
              </select>
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="required">Email de contacto</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
            </div>
            <div className="form-group form-group-full">
              <label>Dirección completa</label>
              <textarea rows="2" placeholder="Calle, número, colonia, ciudad"></textarea>
            </div>
          </div>

          {/* CUENTA DEL SOCIO */}
          <div className="form-section-title">CUENTA DEL SOCIO</div>
          <div className="form-row">
            <div className="form-group">
              <label className="required">Contraseña temporal</label>
              <input type="text" defaultValue="socio123" disabled />
              <small style={{ fontSize: '10px', color: '#64748b' }}>Se asignará automáticamente: socio123</small>
            </div>
          </div>

          {/* EMERGENCIA */}
          <div className="form-section-title">EMERGENCIA</div>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre de contacto</label>
              <input type="text" />
            </div>
            <div className="form-group">
              <label>Teléfono de contacto</label>
              <input type="tel" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
          <button type="submit" className="btn-primary">{editingSocio ? 'Actualizar Socio' : 'Registrar Socio'}</button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
  );
}

export default GestionSocios;