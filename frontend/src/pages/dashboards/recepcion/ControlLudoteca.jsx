import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

function ControlLudoteca() {
  const [ninos, setNinos] = useState([]);
  const [socios, setSocios] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ socioId: '', nombreHijo: '', fechaNacimiento: '' });
  const [loading, setLoading] = useState(true);

  const fetchNinos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/ludoteca/activos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setNinos(data);
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
    fetchNinos();
    fetchSocios();
  }, []);

  const handleRegistrarEntrada = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/api/recepcion/ludoteca/entrada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      setShowModal(false);
      setFormData({ socioId: '', nombreHijo: '', fechaNacimiento: '' });
      fetchNinos();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleRegistrarSalida = async (registroId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/recepcion/ludoteca/salida/${registroId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchNinos();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>Control de Ludoteca</h4>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ Registrar Ingreso</button>
      </div>

      <p className="empty-message" style={{ textAlign: 'left', padding: '0 0 1rem 0' }}>
        Rango de edad: 3 a 6 años | Límite: 2 horas
      </p>

      {ninos.length === 0 ? (
        <p className="empty-message">No hay niños en ludoteca</p>
      ) : (
        <div className="grid-auto">
          {ninos.map(nino => (
            <div key={nino.registro_id} className="espacio-card">
              <div className="espacio-nombre">{nino.nombre_hijo}</div>
              <div className="espacio-detalle">Tutor: {nino.tutor_nombre}</div>
              <div className="espacio-detalle">Entrada: {new Date(nino.hora_entrada).toLocaleTimeString()}</div>
              {nino.hora_salida && <div className="espacio-detalle">Salida: {new Date(nino.hora_salida).toLocaleTimeString()}</div>}
              {nino.minutos_transcurridos > 110 && !nino.hora_salida && (
                <div className="badge-warning" style={{ marginTop: '0.5rem', display: 'inline-block' }}>⚠️ Próximo al límite (2h)</div>
              )}
              {!nino.hora_salida && (
                <button onClick={() => handleRegistrarSalida(nino.registro_id)} className="btn-danger" style={{ marginTop: '0.5rem' }}>
                  Registrar Salida
                </button>
              )}
              {nino.hora_salida && <span className="badge-success" style={{ marginTop: '0.5rem', display: 'inline-block' }}>Finalizado</span>}
            </div>
          ))}
        </div>
      )}

      {/* Modal de entrada */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Ingreso a Ludoteca</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleRegistrarEntrada}>
              <div className="modal-body">
                <div className="form-grid">
                  <input type="text" placeholder="Nombre del niño *" value={formData.nombreHijo} onChange={(e) => setFormData({...formData, nombreHijo: e.target.value})} required />
                  <input type="date" placeholder="Fecha de nacimiento *" value={formData.fechaNacimiento} onChange={(e) => setFormData({...formData, fechaNacimiento: e.target.value})} required />
                  <select value={formData.socioId} onChange={(e) => setFormData({...formData, socioId: e.target.value})} required>
                    <option value="">Socio Tutor *</option>
                    {socios.map(s => <option key={s.socio_id} value={s.socio_id}>{s.nombres} {s.apellido_paterno} ({s.numero_socio})</option>)}
                  </select>
                  <small style={{ color: '#64748b' }}>El sistema validará que el tutor se encuentre activo en el club.</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">Registrar Ingreso</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ControlLudoteca;