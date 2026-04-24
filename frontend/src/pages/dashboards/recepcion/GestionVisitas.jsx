import React, { useEffect, useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';

function GestionVisitas() {
  const [visitas, setVisitas] = useState([]);
  const [filteredVisitas, setFilteredVisitas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ nombreCompleto: '', tipoVisita: 'Pase de un Día', socioResponsableId: '' });
  const [socios, setSocios] = useState([]);
  const [kpis, setKpis] = useState({ visitasActivas: 0, finalizadas: 0, pasesDia: 0, invitados: 0 });

  const fetchVisitas = async () => {
    try {
      const token = localStorage.getItem('token');
      const fecha = new Date().toISOString().split('T')[0];
      const res = await fetch(`http://localhost:3000/api/recepcion/visitas?fecha=${fecha}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setVisitas(data);
      setFilteredVisitas(data);
      
      const activas = data.filter(v => v.vigente).length;
      const finalizadas = data.filter(v => !v.vigente).length;
      const pasesDia = data.filter(v => v.tipo_visita === 'Pase de un Día').length;
      const invitados = data.filter(v => v.tipo_visita === 'Invitado').length;
      setKpis({ visitasActivas: activas, finalizadas, pasesDia, invitados });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/socios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSocios(data.filter(s => s.socio_activo));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchVisitas();
    fetchSocios();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredVisitas(visitas);
    } else {
      const filtered = visitas.filter(v => 
        v.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.socio_responsable?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredVisitas(filtered);
    }
  }, [searchTerm, visitas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/api/recepcion/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({ nombreCompleto: '', tipoVisita: 'Pase de un Día', socioResponsableId: '' });
      fetchVisitas();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleRegistrarSalida = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/recepcion/visitas/${id}/salida`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchVisitas();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando...</p></div>;

  return (
    <div className="chart-box">
      <div className="top-kpi-grid">
        <div className="kpi-card"><UserPlus className="kpi-icon" /><div><h3>{kpis.visitasActivas}</h3><p>Visitas Activas</p></div></div>
        <div className="kpi-card"><UserPlus className="kpi-icon green" /><div><h3>{kpis.finalizadas}</h3><p>Finalizadas Hoy</p></div></div>
        <div className="kpi-card"><UserPlus className="kpi-icon blue" /><div><h3>{kpis.pasesDia}</h3><p>Pases de un Día</p></div></div>
        <div className="kpi-card"><UserPlus className="kpi-icon amber" /><div><h3>{kpis.invitados}</h3><p>Invitados</p></div></div>
      </div>

      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>Registro de Visitas del Día</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar visitante o socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo Pase</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Visitante</th>
              <th>Socio Responsable</th>
              <th>Tipo</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredVisitas.map(visita => (
              <tr key={visita.visita_id}>
                <td><strong>{visita.nombre_completo}</strong></td>
                <td>{visita.socio_responsable || '—'}</td>
                <td><span className="badge-success">{visita.tipo_visita}</span></td>
                <td>{new Date(visita.hora_entrada).toLocaleTimeString()}</td>
                <td>{visita.hora_salida ? new Date(visita.hora_salida).toLocaleTimeString() : '—'}</td>
                <td><span className={visita.vigente ? 'badge-success' : 'badge-warning'}>{visita.vigente ? 'Vigente' : 'Finalizada'}</span></td>
                <td>
                  {visita.vigente && (
                    <button onClick={() => handleRegistrarSalida(visita.visita_id)} className="btn-danger" style={{ padding: '4px 12px', fontSize: '11px' }}>
                      Registrar Salida
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Visitante */}
{showModal && (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '500px' }}>
      <div className="modal-header">
        <h3>Registrar Visitante</h3>
        <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group form-group-full">
              <label className="required">Nombre Completo</label>
              <input type="text" value={formData.nombreCompleto} onChange={(e) => setFormData({...formData, nombreCompleto: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Tipo de Visita</label>
              <select value={formData.tipoVisita} onChange={(e) => setFormData({...formData, tipoVisita: e.target.value})}>
                <option value="Pase de un Día">Pase de un Día</option>
                <option value="Invitado">Invitado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="required">Socio Responsable</label>
              <select value={formData.socioResponsableId} onChange={(e) => setFormData({...formData, socioResponsableId: e.target.value})} required>
                <option value="">Seleccione un socio</option>
                {socios.map(s => <option key={s.socio_id} value={s.socio_id}>{s.nombres} {s.apellido_paterno} ({s.numero_socio})</option>)}
              </select>
            </div>
          </div>

          {/* RESTRICCIÓN IMPORTANTE */}
          <div className="form-alert">
            <strong>⚠️ IMPORTANTE:</strong> La visita no puede realizar reservaciones. Solo el socio responsable puede reservar espacios en nombre del visitante.
          </div>

          <div className="form-alert">
            <strong>⚠️ Vigencia automática:</strong> El pase vence al finalizar el día de hoy (23:59 hrs). La hora de entrada se registra automáticamente al confirmar.
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
          <button type="submit" className="btn-primary">Registrar Visita</button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
  );
}

export default GestionVisitas;