import React, { useEffect, useState } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, Calendar, User, Filter, Eye, Plus, Edit2, Trash2, X } from 'lucide-react';

function ReporteSanciones() {
  const [sanciones, setSanciones] = useState([]);
  const [filteredSanciones, setFilteredSanciones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGravedad, setFilterGravedad] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSancion, setEditingSancion] = useState(null);
  const [socios, setSocios] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    socio_id: '',
    motivo: '',
    gravedad: 'Leve',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: ''
  });

  const token = localStorage.getItem('token');

  // Fetch sanciones
  const fetchSanciones = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/sanciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSanciones(data);
        setFilteredSanciones(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch socios para el selector
  const fetchSocios = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/socios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSocios(data);
      }
    } catch (error) {
      console.error('Error fetching socios:', error);
    }
  };

  useEffect(() => {
    fetchSanciones();
    fetchSocios();
  }, []);

  useEffect(() => {
    let filtered = sanciones;
    
    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.socio_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.motivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tipo_socio?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterGravedad) {
      filtered = filtered.filter(s => s.gravedad === filterGravedad);
    }
    
    if (filterEstado) {
      filtered = filtered.filter(s => {
        if (filterEstado === 'activa') return s.activa === true;
        if (filterEstado === 'expirada') return s.activa === false;
        return true;
      });
    }
    
    setFilteredSanciones(filtered);
  }, [searchTerm, filterGravedad, filterEstado, sanciones]);

  // Validar formulario
  const validateForm = () => {
    const errors = {};
    if (!formData.socio_id) errors.socio_id = 'Seleccione un socio';
    if (!formData.motivo?.trim()) errors.motivo = 'El motivo es obligatorio';
    if (!formData.gravedad) errors.gravedad = 'Seleccione la gravedad';
    return errors;
  };

  // Crear/Actualizar sanción
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const url = editingSancion
      ? `http://localhost:3000/api/sanciones/${editingSancion.sancion_id}`
      : 'http://localhost:3000/api/sanciones';
    const method = editingSancion ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchSanciones();
        setShowModal(false);
        setEditingSancion(null);
        setFormData({ socio_id: '', motivo: '', gravedad: 'Leve', fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '' });
        setFormErrors({});
      } else {
        const error = await res.json();
        alert(error.error || 'Error al guardar sanción');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Levantar sanción
  const handleLevantarSancion = async (id) => {
    if (!confirm('¿Levantar esta sanción? El socio quedará habilitado nuevamente.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/sanciones/${id}/levantar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSanciones();
      } else {
        alert('Error al levantar la sanción');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Eliminar sanción permanentemente
  const handleDeleteSancion = async (id) => {
    if (!confirm('¿Eliminar esta sanción permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/sanciones/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSanciones();
      } else {
        alert('Error al eliminar sanción');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Editar sanción
  const handleEdit = (sancion) => {
    setEditingSancion(sancion);
    setFormData({
      socio_id: sancion.socio_id?.toString() || '',
      motivo: sancion.motivo || '',
      gravedad: sancion.gravedad || 'Leve',
      fecha_inicio: sancion.fecha_inicio ? new Date(sancion.fecha_inicio).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      fecha_fin: sancion.fecha_fin ? new Date(sancion.fecha_fin).toISOString().split('T')[0] : ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const getGravedadColor = (gravedad) => {
    if (gravedad === 'Leve') return '#f59e0b';
    if (gravedad === 'Moderada') return '#ef4444';
    if (gravedad === 'Grave') return '#991b1b';
    return '#64748b';
  };

  const getGravedadBg = (gravedad) => {
    if (gravedad === 'Leve') return '#fef3c7';
    if (gravedad === 'Moderada') return '#fee2e2';
    if (gravedad === 'Grave') return '#f1f5f9';
    return '#f3f4f6';
  };

  const getGravedadIcon = (gravedad) => {
    if (gravedad === 'Leve') return '⚠️';
    if (gravedad === 'Moderada') return '🔴';
    if (gravedad === 'Grave') return '💀';
    return '📌';
  };

  const estadisticas = {
    total: sanciones.length,
    activas: sanciones.filter(s => s.activa === true).length,
    expiradas: sanciones.filter(s => s.activa === false).length,
    leves: sanciones.filter(s => s.gravedad === 'Leve').length,
    moderadas: sanciones.filter(s => s.gravedad === 'Moderada').length,
    graves: sanciones.filter(s => s.gravedad === 'Grave').length,
  };

  if (loading) return <div className="chart-box"><p>Cargando sanciones...</p></div>;

  return (
    <div className="chart-box">

      {/* HEADER */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4>⚠️ Reporte de Sanciones</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Total: {filteredSanciones.length} sanciones
          </p>
        </div>

        <div className="flex-gap" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar socio, motivo o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <button
            className={`btn-secondary ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Filter size={16} /> Filtros
          </button>

          <button className="btn-primary" onClick={() => { setEditingSancion(null); setFormData({ socio_id: '', motivo: '', gravedad: 'Leve', fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '' }); setFormErrors({}); setShowModal(true); }}>
            <Plus size={16} /> Nueva Sanción
          </button>
        </div>
      </div>

      {/* ESTADÍSTICAS RÁPIDAS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.5rem' 
      }}>
        <div className="stats-card" style={{ background: '#fef2f2' }}>
          <AlertTriangle size={20} color="#ef4444" />
          <div>
            <strong>{estadisticas.activas}</strong>
            <p>Sanciones Activas</p>
          </div>
        </div>
        <div className="stats-card" style={{ background: '#f0fdf4' }}>
          <CheckCircle size={20} color="#10b981" />
          <div>
            <strong>{estadisticas.expiradas}</strong>
            <p>Sanciones Expiradas</p>
          </div>
        </div>
        <div className="stats-card" style={{ background: '#fffbeb' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <strong>{estadisticas.leves}</strong>
            <p>Gravedad Leve</p>
          </div>
        </div>
        <div className="stats-card" style={{ background: '#fef2f2' }}>
          <span style={{ fontSize: '20px' }}>🔴</span>
          <div>
            <strong>{estadisticas.moderadas}</strong>
            <p>Gravedad Moderada</p>
          </div>
        </div>
        <div className="stats-card" style={{ background: '#f3f4f6' }}>
          <span style={{ fontSize: '20px' }}>💀</span>
          <div>
            <strong>{estadisticas.graves}</strong>
            <p>Gravedad Grave</p>
          </div>
        </div>
      </div>

      {/* FILTROS AVANZADOS */}
      {showFilters && (
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: '#f9fafb', 
          borderRadius: '8px',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              <AlertTriangle size={12} /> Gravedad
            </label>
            <select
              value={filterGravedad}
              onChange={(e) => setFilterGravedad(e.target.value)}
              className="filter-select"
              style={{ width: '100%' }}
            >
              <option value="">Todas las gravedades</option>
              <option value="Leve">Leve</option>
              <option value="Moderada">Moderada</option>
              <option value="Grave">Grave</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              <Eye size={12} /> Estado
            </label>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="filter-select"
              style={{ width: '100%' }}
            >
              <option value="">Todos los estados</option>
              <option value="activa">Activa</option>
              <option value="expirada">Expirada</option>
            </select>
          </div>

          {(filterGravedad || filterEstado) && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => {
                  setFilterGravedad('');
                  setFilterEstado('');
                }}
                className="btn-outline"
                style={{ padding: '0.5rem 1rem' }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* TABLA DE SANCIONES */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Socio</th>
              <th>Tipo</th>
              <th>Motivo</th>
              <th>Gravedad</th>
              <th>Fecha Inicio</th>
              <th>Fecha Fin</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSanciones.map(sancion => (
              <tr key={sancion.sancion_id} style={!sancion.activa ? { opacity: 0.7 } : {}}>
                <td>
                  <strong>{sancion.socio_nombre}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {sancion.numero_socio || 'Sin número'}
                  </span>
                </td>
                <td>
                  <span style={{
                    background: sancion.tipo_socio === 'Accionista' ? '#dbeafe' : '#fef3c7',
                    color: sancion.tipo_socio === 'Accionista' ? '#1e40af' : '#92400e',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px'
                  }}>
                    {sancion.tipo_socio || '—'}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '0.875rem' }}>{sancion.motivo}</span>
                </td>
                <td>
                  <span style={{ 
                    background: getGravedadBg(sancion.gravedad), 
                    color: getGravedadColor(sancion.gravedad), 
                    padding: '4px 10px', 
                    borderRadius: '20px', 
                    fontSize: '11px',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{getGravedadIcon(sancion.gravedad)}</span>
                    {sancion.gravedad || 'Sin especificar'}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 500 }}>{new Date(sancion.fecha_inicio).toLocaleDateString()}</span>
                </td>
                <td>
                  {sancion.fecha_fin ? (
                    <span>{new Date(sancion.fecha_fin).toLocaleDateString()}</span>
                  ) : (
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>Indefinida</span>
                  )}
                </td>
                <td>
                  <span className={sancion.activa ? 'badge-warning' : 'badge-success'}>
                    {sancion.activa ? 'Activa' : 'Expirada'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleEdit(sancion)}
                    className="btn-icon"
                    style={{ color: '#3b82f6' }}
                    title="Editar sanción"
                  >
                    <Edit2 size={16} />
                  </button>
                  {sancion.activa && (
                    <button
                      onClick={() => handleLevantarSancion(sancion.sancion_id)}
                      className="btn-icon"
                      style={{ color: '#10b981' }}
                      title="Levantar sanción"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSancion(sancion.sancion_id)}
                    className="btn-icon"
                    style={{ color: '#ef4444' }}
                    title="Eliminar permanentemente"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MENSAJE SIN DATOS */}
      {filteredSanciones.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <CheckCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No hay sanciones registradas</p>
          <button className="btn-primary" onClick={() => { setEditingSancion(null); setFormData({ socio_id: '', motivo: '', gravedad: 'Leve', fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '' }); setFormErrors({}); setShowModal(true); }} style={{ marginTop: '1rem' }}>
            <Plus size={16} /> Crear primera sanción
          </button>
        </div>
      )}

      {/* MODAL PARA CREAR/EDITAR SANCIÓN */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>{editingSancion ? '✏️ Editar Sanción' : '➕ Nueva Sanción'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group form-group-full">
                  <label className="required">Socio *</label>
                  <select
                    value={formData.socio_id}
                    onChange={(e) => setFormData({ ...formData, socio_id: e.target.value })}
                    style={formErrors.socio_id ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                  >
                    <option value="">Seleccione un socio</option>
                    {socios.map(s => (
                      <option key={s.socio_id} value={s.socio_id}>
                        {s.nombres} {s.apellido_paterno} - {s.numero_socio} ({s.tipo})
                      </option>
                    ))}
                  </select>
                  {formErrors.socio_id && <p className="field-error">{formErrors.socio_id}</p>}
                </div>

                <div className="form-group form-group-full">
                  <label className="required">Motivo *</label>
                  <textarea
                    rows="3"
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    placeholder="Describa el motivo de la sanción..."
                    style={formErrors.motivo ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                  />
                  {formErrors.motivo && <p className="field-error">{formErrors.motivo}</p>}
                </div>

                <div className="form-group form-group-full">
                  <label className="required">Gravedad *</label>
                  <select
                    value={formData.gravedad}
                    onChange={(e) => setFormData({ ...formData, gravedad: e.target.value })}
                    style={formErrors.gravedad ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {}}
                  >
                    <option value="Leve">Leve ⚠️</option>
                    <option value="Moderada">Moderada 🔴</option>
                    <option value="Grave">Grave 💀</option>
                  </select>
                  {formErrors.gravedad && <p className="field-error">{formErrors.gravedad}</p>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha inicio</label>
                    <input
                      type="date"
                      value={formData.fecha_inicio}
                      onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Fecha fin (opcional)</label>
                    <input
                      type="date"
                      value={formData.fecha_fin}
                      onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                    />
                    <p className="field-hint">Dejar vacío para sanción indefinida</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingSancion ? 'Actualizar' : 'Crear'} Sanción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .stats-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: white;
          border: 1px solid #e5e7eb;
        }
        .stats-card strong {
          font-size: 1.25rem;
          font-weight: 700;
          display: block;
          line-height: 1.2;
        }
        .stats-card p {
          margin: 0;
          font-size: 0.75rem;
          color: #6b7280;
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          background: #e5e7eb;
        }
        .btn-secondary.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        .filter-select {
          padding: 0.5rem;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          background: white;
          font-size: 0.875rem;
        }
        .flex-gap {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .field-hint {
          font-size: 0.7rem;
          color: #6b7280;
          margin-top: 0.25rem;
        }
        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .btn-icon:hover {
          background: #f3f4f6;
        }
      `}</style>
    </div>
  );
}

export default ReporteSanciones;