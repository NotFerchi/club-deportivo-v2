import React, { useEffect, useState } from 'react';
import { Search, Calendar, Clock, User, MapPin, CheckCircle, XCircle, Edit2, Trash2, Plus, Filter, X } from 'lucide-react';

function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [filteredReservas, setFilteredReservas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReserva, setEditingReserva] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    espacio_id: '',
    socio_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    estado: 'pendiente'
  });

  const [formErrors, setFormErrors] = useState({});
  const token = localStorage.getItem('token');

  const fetchReservas = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/reservas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReservas(data);
        setFilteredReservas(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchEspacios = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/espacios/todos', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEspacios(data.filter(e => e.activo === true || e.activo === 'true'));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSocios = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/socios', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSocios(data.filter(s => s.activo === true || s.activo === 'true'));
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    Promise.all([fetchReservas(), fetchEspacios(), fetchSocios()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let filtered = reservas;
    
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.socio_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.espacio_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.socio_numero?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterEstado) {
      filtered = filtered.filter(r => r.estado === filterEstado);
    }
    
    setFilteredReservas(filtered);
  }, [searchTerm, filterEstado, reservas]);

  const validateForm = () => {
    const errors = {};
    if (!formData.espacio_id) errors.espacio_id = 'Seleccione un espacio';
    if (!formData.socio_id) errors.socio_id = 'Seleccione un socio';
    if (!formData.fecha) errors.fecha = 'Seleccione una fecha';
    if (!formData.hora_inicio) errors.hora_inicio = 'Seleccione hora de inicio';
    if (!formData.hora_fin) errors.hora_fin = 'Seleccione hora de fin';
    
    if (formData.hora_inicio && formData.hora_fin && formData.hora_inicio >= formData.hora_fin) {
      errors.hora_fin = 'La hora de fin debe ser posterior a la hora de inicio';
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    const url = editingReserva
      ? `http://localhost:3000/api/reservas/${editingReserva.reserva_id}`
      : 'http://localhost:3000/api/reservas';
    const method = editingReserva ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchReservas();
        setShowModal(false);
        setEditingReserva(null);
        setFormData({ espacio_id: '', socio_id: '', fecha: '', hora_inicio: '', hora_fin: '', estado: 'pendiente' });
        setFormErrors({});
        setSuccessMessage(editingReserva ? 'Reserva actualizada correctamente' : 'Reserva creada correctamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al guardar reserva');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  const cancelarReserva = async (id) => {
    if (!confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/reservas/${id}/cancelar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchReservas();
        setSuccessMessage('Reserva cancelada correctamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert('Error al cancelar');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const deleteReserva = async (id) => {
    if (!confirm('¿Eliminar esta reserva permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/reservas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchReservas();
        setSuccessMessage('Reserva eliminada permanentemente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert('Error al eliminar');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getEstadoBadge = (estado) => {
    const estilos = {
      confirmada: 'badge-success',
      pendiente: 'badge-warning',
      cancelada: 'badge-danger',
      'no-show': 'badge-danger'
    };
    return estilos[estado?.toLowerCase()] || 'badge-warning';
  };

  const getEstadoIcon = (estado) => {
    if (estado === 'confirmada') return '✅';
    if (estado === 'pendiente') return '⏳';
    if (estado === 'cancelada') return '❌';
    return '📅';
  };

  const estadisticas = {
    total: reservas.length,
    confirmadas: reservas.filter(r => r.estado === 'confirmada').length,
    pendientes: reservas.filter(r => r.estado === 'pendiente').length,
    canceladas: reservas.filter(r => r.estado === 'cancelada').length,
    hoy: reservas.filter(r => r.fecha === new Date().toISOString().split('T')[0]).length
  };

  if (loading) return <div className="chart-box"><p>Cargando reservas...</p></div>;

  return (
    <div className="chart-box">

      {/* Mensaje de éxito */}
      {showSuccess && (
        <div className="success-toast">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4>📅 Gestión de Reservas</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Total: {filteredReservas.length} reservas
          </p>
        </div>

        <div className="flex-gap" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar socio o espacio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            className={`btn-secondary ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} /> Filtros
          </button>

          <button className="btn-primary" onClick={() => {
            setEditingReserva(null);
            setFormData({ espacio_id: '', socio_id: '', fecha: '', hora_inicio: '', hora_fin: '', estado: 'pendiente' });
            setFormErrors({});
            setShowModal(true);
          }}>
            <Plus size={16} /> Nueva Reserva
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.5rem' 
      }}>
        <div className="stats-card" style={{ background: '#eff6ff' }}>
          <Calendar size={20} color="#3b82f6" />
          <div><strong>{estadisticas.total}</strong><p>Total Reservas</p></div>
        </div>
        <div className="stats-card" style={{ background: '#f0fdf4' }}>
          <CheckCircle size={20} color="#10b981" />
          <div><strong>{estadisticas.confirmadas}</strong><p>Confirmadas</p></div>
        </div>
        <div className="stats-card" style={{ background: '#fffbeb' }}>
          <Clock size={20} color="#f59e0b" />
          <div><strong>{estadisticas.pendientes}</strong><p>Pendientes</p></div>
        </div>
        <div className="stats-card" style={{ background: '#fef2f2' }}>
          <XCircle size={20} color="#ef4444" />
          <div><strong>{estadisticas.canceladas}</strong><p>Canceladas</p></div>
        </div>
      </div>

      {/* FILTROS */}
      {showFilters && (
        <div className="filters-panel">
          <div>
            <label>Estado</label>
            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="confirmada">Confirmadas</option>
              <option value="pendiente">Pendientes</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>
          {(filterEstado) && (
            <button onClick={() => { setFilterEstado(''); }} className="btn-outline">
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* TABLA DE RESERVAS */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Espacio</th>
              <th>Socio</th>
              <th>Fecha</th>
              <th>Horario</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredReservas.map(r => (
              <tr key={r.reserva_id} style={r.estado === 'cancelada' ? { opacity: 0.6 } : {}}>
                <td>
                  <strong>{r.espacio_nombre}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {r.espacio_id}</span>
                </td>
                <td>
                  <strong>{r.socio_nombre}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{r.socio_numero || 'Sin número'}</span>
                </td>
                <td>
                  <span style={{ fontWeight: 500 }}>{new Date(r.fecha).toLocaleDateString()}</span>
                </td>
                <td>
                  <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  {r.hora_inicio?.slice(0,5)} - {r.hora_fin?.slice(0,5)}
                </td>
                <td>
                  <span className={getEstadoBadge(r.estado)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>{getEstadoIcon(r.estado)}</span>
                    {r.estado}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setEditingReserva(r);
                      setFormData({
                        espacio_id: r.espacio_id?.toString() || '',
                        socio_id: r.socio_id?.toString() || '',
                        fecha: r.fecha?.split('T')[0] || '',
                        hora_inicio: r.hora_inicio || '',
                        hora_fin: r.hora_fin || '',
                        estado: r.estado || 'pendiente'
                      });
                      setFormErrors({});
                      setShowModal(true);
                    }}
                    className="btn-icon"
                    style={{ color: '#3b82f6' }}
                    title="Editar reserva"
                  >
                    <Edit2 size={16} />
                  </button>
                  
                  {r.estado !== 'cancelada' && (
                    <button
                      onClick={() => cancelarReserva(r.reserva_id)}
                      className="btn-icon"
                      style={{ color: '#f59e0b' }}
                      title="Cancelar reserva"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                  
                  <button
                    onClick={() => deleteReserva(r.reserva_id)}
                    className="btn-icon"
                    style={{ color: '#ef4444' }}
                    title="Eliminar permanentemente"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredReservas.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No hay reservas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>{editingReserva ? '✏️ Editar Reserva' : '➕ Nueva Reserva'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Espacio</label>
                    <select
                      value={formData.espacio_id}
                      onChange={(e) => setFormData({ ...formData, espacio_id: e.target.value })}
                      style={formErrors.espacio_id ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                    >
                      <option value="">Seleccione un espacio</option>
                      {espacios.map(e => (
                        <option key={e.espacio_id} value={e.espacio_id}>
                          {e.nombre} (Cap: {e.capacidad_maxima})
                        </option>
                      ))}
                    </select>
                    {formErrors.espacio_id && <p className="field-error">{formErrors.espacio_id}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Socio</label>
                    <select
                      value={formData.socio_id}
                      onChange={(e) => setFormData({ ...formData, socio_id: e.target.value })}
                      style={formErrors.socio_id ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                    >
                      <option value="">Seleccione un socio</option>
                      {socios.map(s => (
                        <option key={s.socio_id} value={s.socio_id}>
                          {s.nombres} {s.apellido_paterno} - {s.numero_socio}
                        </option>
                      ))}
                    </select>
                    {formErrors.socio_id && <p className="field-error">{formErrors.socio_id}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Fecha</label>
                    <input
                      type="date"
                      value={formData.fecha}
                      onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                      style={formErrors.fecha ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                    />
                    {formErrors.fecha && <p className="field-error">{formErrors.fecha}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Hora inicio</label>
                    <input
                      type="time"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                      style={formErrors.hora_inicio ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                    />
                    {formErrors.hora_inicio && <p className="field-error">{formErrors.hora_inicio}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Hora fin</label>
                    <input
                      type="time"
                      value={formData.hora_fin}
                      onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                      style={formErrors.hora_fin ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                    />
                    {formErrors.hora_fin && <p className="field-error">{formErrors.hora_fin}</p>}
                  </div>

                  <div className="form-group">
                    <label>Estado</label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    >
                      <option value="pendiente">⏳ Pendiente</option>
                      <option value="confirmada">✅ Confirmada</option>
                      <option value="cancelada">❌ Cancelada</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingReserva ? 'Actualizar' : 'Crear'} Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .success-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .stats-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: white;
          border: 1px solid #e5e7eb;
        }
        .stats-card strong { font-size: 1.25rem; font-weight: 700; display: block; }
        .stats-card p { margin: 0; font-size: 0.75rem; color: #6b7280; }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn-secondary.active { background: #3b82f6; color: white; border-color: #3b82f6; }
        .filters-panel {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 8px;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .filters-panel select { padding: 0.5rem; border-radius: 8px; border: 1px solid #e5e7eb; min-width: 150px; }
        .filters-panel label { font-size: 0.75rem; color: #6b7280; display: block; margin-bottom: 0.25rem; }
        .btn-icon { background: none; border: none; cursor: pointer; padding: 0.25rem; border-radius: 4px; transition: background 0.2s; }
        .btn-icon:hover { background: #f3f4f6; }
        .field-error { font-size: 0.75rem; color: #ef4444; margin-top: 0.25rem; }
        .badge-success { background: #d1fae5; color: #065f46; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .badge-warning { background: #fed7aa; color: #92400e; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .badge-danger { background: #fee2e2; color: #b91c1c; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
        .flex-gap { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .field-hint { font-size: 0.7rem; color: #6b7280; margin-top: 0.25rem; }
      `}</style>
    </div>
  );
}

export default Reservas;