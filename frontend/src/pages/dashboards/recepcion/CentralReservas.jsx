import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

function CentralReservas() {
  const [reservas, setReservas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [showReservaModal, setShowReservaModal] = useState(false);
  const [formData, setFormData] = useState({
    espacioId: '', socioId: '', fechaReserva: fecha, horaInicio: '', horaFin: ''
  });

  const fetchReservas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/recepcion/reservas?fecha=${fecha}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setReservas(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEspacios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/espacios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEspacios(data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  useEffect(() => {
    fetchReservas();
    fetchEspacios();
  }, [fecha]);

  const handleSubmitReserva = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      setShowReservaModal(false);
      fetchReservas();
      setFormData({ espacioId: '', socioId: '', fechaReserva: fecha, horaInicio: '', horaFin: '' });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>Sistema de Reservas - {fecha}</h4>
        <div className="flex-gap">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="date-picker" />
          <button onClick={() => setShowReservaModal(true)} className="btn-primary">+ Nueva Reserva</button>
        </div>
      </div>

      {loading ? (
        <p className="empty-message">Cargando...</p>
      ) : (
        <>
          <div style={{ marginBottom: '2rem' }}>
            <h5>Espacios Disponibles</h5>
            <div className="grid-auto">
              {espacios.map(esp => (
                <div key={esp.espacio_id} className="espacio-card">
                  <div className="espacio-nombre">{esp.nombre}</div>
                  <div className="espacio-detalle">{esp.disciplina}</div>
                  <div className="espacio-detalle">Capacidad: {esp.capacidad_maxima}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h5>Reservas del Día ({reservas.length})</h5>
            {reservas.length === 0 ? (
              <p className="empty-message">No hay reservas para esta fecha</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Socio</th>
                      <th>Espacio</th>
                      <th>Horario</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map(res => (
                      <tr key={res.reserva_id}>
                        <td>{res.socio_nombre}</td>
                        <td>{res.espacio_nombre}</td>
                        <td>{res.hora_inicio} - {res.hora_fin}</td>
                        <td><span className="badge-success">{res.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Nueva Reserva */}
{showReservaModal && (
  <div className="modal-overlay">
    <div className="modal-content" style={{ maxWidth: '600px' }}>
      <div className="modal-header">
        <h3>Nueva Reserva</h3>
        <button onClick={() => setShowReservaModal(false)} className="close-modal"><X size={24} /></button>
      </div>
      <form onSubmit={handleSubmitReserva}>
        <div className="modal-body">
          {/* Información del Visitante (si aplica) */}
          <div className="form-section-title">Información del Visitante</div>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre Completo</label>
              <input type="text" placeholder="Nombre del visitante" />
            </div>
            <div className="form-group">
              <label>Tipo de Visitante</label>
              <select>
                <option>Invitado</option>
                <option>Pase de un Día</option>
              </select>
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input type="tel" placeholder="55-1234-5678" />
            </div>
            <div className="form-group">
              <label>Correo Electrónico</label>
              <input type="email" placeholder="correo@ejemplo.com" />
            </div>
          </div>

          {/* Socio Responsable */}
          <div className="form-section-title">Socio Responsable</div>
          <div className="form-row">
            <div className="form-group form-group-full">
              <label className="required">Nombre del socio que invita</label>
              <select required>
                <option value="">Seleccione un socio</option>
                {socios.map(s => <option key={s.socio_id} value={s.socio_id}>{s.nombres} {s.apellido_paterno}</option>)}
              </select>
            </div>
          </div>

          {/* RESTRICCIÓN IMPORTANTE */}
          <div className="form-alert">
            <strong>⚠️ IMPORTANTE:</strong> Solo el socio responsable puede realizar esta reserva. El visitante no puede reservar por sí mismo.
          </div>

          {/* Detalles de la Reserva */}
          <div className="form-section-title">Detalles de la Reserva</div>
          <div className="form-row">
            <div className="form-group">
              <label className="required">Tipo de Instalación</label>
              <select value={formData.espacioId} onChange={(e) => setFormData({...formData, espacioId: e.target.value})} required>
                <option value="">Seleccione un espacio</option>
                {espacios.map(e => <option key={e.espacio_id} value={e.espacio_id}>{e.nombre} - {e.disciplina}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Número/Nombre de Instalación</label>
              <input type="text" placeholder="1" />
            </div>
            <div className="form-group">
              <label className="required">Fecha de Reserva</label>
              <input type="date" value={formData.fechaReserva} onChange={(e) => setFormData({...formData, fechaReserva: e.target.value})} required />
            </div>
            <div className="form-group">
              <label className="required">Hora de Inicio</label>
              <input type="time" value={formData.horaInicio} onChange={(e) => setFormData({...formData, horaInicio: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Duración (min)</label>
              <select>
                <option>30 min</option>
                <option>1 hora</option>
                <option>1.5 horas</option>
                <option>2 horas</option>
              </select>
            </div>
            <div className="form-group">
              <label className="required">Hora de Fin</label>
              <input type="time" value={formData.horaFin} onChange={(e) => setFormData({...formData, horaFin: e.target.value})} required />
            </div>
          </div>

          {/* Notas Adicionales */}
          <div className="form-section-title">Notas Adicionales</div>
          <div className="form-row">
            <div className="form-group form-group-full">
              <label>Observaciones</label>
              <textarea rows="3" placeholder="Cualquier información adicional sobre la reserva..."></textarea>
            </div>
          </div>

          <small style={{ display: 'block', marginTop: '1rem', color: '#64748b' }}>
            El código de reserva se generará automáticamente al confirmar. Los campos marcados con (*) son obligatorios.
          </small>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={() => setShowReservaModal(false)} className="btn-outline">Cancelar</button>
          <button type="submit" className="btn-primary">Confirmar Reserva</button>
        </div>
      </form>
    </div>
  </div>
)}
    </div>
  );
}

export default CentralReservas;