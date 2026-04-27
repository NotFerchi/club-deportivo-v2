import React, { useEffect, useState } from 'react';
import { Search, UserPlus, LogOut, Clock, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';

function RecepcionVisitas() {
  const [visitasActivas, setVisitasActivas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    identificacion: '',
    socio_anfitrion_id: '',
    motivo: '',
  });
  const [filtro, setFiltro] = useState('');
  const [limitesPases, setLimitesPases] = useState({});

  const token = localStorage.getItem('token');

  // Cargar visitas activas y socios - CORREGIDO
  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [activasRes, sociosRes] = await Promise.all([
        fetch('http://localhost:3000/api/recepcion/visitas/activas', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3000/api/recepcion/socios-lista', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      console.log('Status visitas activas:', activasRes.status);
      console.log('Status socios lista:', sociosRes.status);

      // Manejo de error 401
      if (activasRes.status === 401 || sociosRes.status === 401) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }

      let visitasData = [];
      if (activasRes.ok) {
        const data = await activasRes.json();
        visitasData = Array.isArray(data) ? data : (data.data || []);
        setVisitasActivas(visitasData);
      }

      let sociosData = [];
      if (sociosRes.ok) {
        const data = await sociosRes.json();
        sociosData = Array.isArray(data) ? data : (data.data || data.socios || []);
        setSocios(sociosData);
        
        // Calcular pases usados hoy por socio
        const usos = {};
        sociosData.forEach(s => { usos[s.socio_id] = 0; });
        visitasData.forEach(v => {
          if (v.socio_anfitrion_id) usos[v.socio_anfitrion_id] = (usos[v.socio_anfitrion_id] || 0) + 1;
        });
        
        // Límites máximos por tipo de socio
        const limites = {};
        sociosData.forEach(s => {
          const max = s.tipo_socio === 'Accionista' || s.tipo_socio === 'accionista' ? 5 : 3;
          limites[s.socio_id] = { usados: usos[s.socio_id] || 0, maximo: max };
        });
        setLimitesPases(limites);
      }
    } catch (error) {
      console.error('Error en fetchData:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial - CORREGIDO
  const fetchHistorial = async () => {
    if (!token) return;

    try {
      const res = await fetch('http://localhost:3000/api/recepcion/visitas/historial?dias=7', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const historialData = Array.isArray(data) ? data : (data.data || []);
        setHistorial(historialData);
      }
    } catch (error) {
      console.error('Error en fetchHistorial:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistorial();
  }, []);

  // Registrar visita - CORREGIDO (comillas fijadas)
  const registrarVisita = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.apellidos) {
      alert('Nombre y apellidos son obligatorios');
      return;
    }
    
    if (!token) {
      alert('No hay sesión activa');
      return;
    }
    
    // Validar pases disponibles si hay anfitrión
    if (formData.socio_anfitrion_id) {
      const limites = limitesPases[formData.socio_anfitrion_id];
      if (limites && limites.usados >= limites.maximo) {
        alert(`El socio ha alcanzado su límite de ${limites.maximo} pases diarios`);
        return;
      }
    }
    
    try {
      const res = await fetch('http://localhost:3000/api/recepcion/visitas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellido: formData.apellidos,
          identificacion: formData.identificacion,
          socio_anfitrion_id: formData.socio_anfitrion_id || null,
          motivo: formData.motivo
        })
      });

      if (res.ok) {
        setShowModal(false);
        setFormData({ nombre: '', apellidos: '', identificacion: '', socio_anfitrion_id: '', motivo: '' });
        await fetchData();
        await fetchHistorial();
        setSuccessMessage('Visita registrada correctamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar visita');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  // Registrar salida - CORREGIDO
  const registrarSalida = async (visitaId) => {
    if (!confirm('¿Registrar salida del visitante?')) return;
    
    if (!token) {
      alert('No hay sesión activa');
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:3000/api/recepcion/visitas/${visitaId}/salida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        await fetchData();
        await fetchHistorial();
        setSuccessMessage('Salida registrada correctamente');
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        alert('Error al registrar salida');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  const visitasFiltradas = visitasActivas.filter(v =>
    v.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    v.apellidos?.toLowerCase().includes(filtro.toLowerCase()) ||
    (v.socio_anfitrion_nombre && v.socio_anfitrion_nombre.toLowerCase().includes(filtro.toLowerCase()))
  );

  if (loading) return <div className="chart-box"><p>Cargando recepción...</p></div>;

  return (
    <div className="chart-box">

      {/* Mensaje de éxito */}
      {showSuccess && (
        <div className="success-toast">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h4>🚪 Recepción y Control de Visitas</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Activas: {visitasActivas.length} | Total visitas (7d): {historial.length}
          </p>
        </div>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar visitante o anfitrión"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="search-input"
            />
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <UserPlus size={16} /> Nueva Visita
          </button>
        </div>
      </div>

      {/* Tarjetas de visitas activas */}
      <div style={{ marginBottom: '2rem' }}>
        <h5>🟢 Visitas Activas ({visitasFiltradas.length})</h5>
        <div className="grid-auto">
          {visitasFiltradas.length === 0 && (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No hay visitas activas en este momento.
            </p>
          )}
          {visitasFiltradas.map(visita => (
            <div key={visita.visita_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{visita.nombre} {visita.apellidos}</h3>
                  <p className="espacio-sub">
                    {visita.identificacion ? `ID: ${visita.identificacion}` : 'Sin identificación'}
                  </p>
                </div>
                <span className="badge-success">
                  🕐 {new Date(visita.hora_entrada).toLocaleTimeString()}
                </span>
              </div>
              <div className="espacio-body">
                <div className="espacio-stat">
                  <span className="stat-label">Anfitrión</span>
                  <span className="stat-value">{visita.socio_anfitrion_nombre || 'Ninguno'}</span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Motivo</span>
                  <span className="stat-value">{visita.motivo || 'No especificado'}</span>
                </div>
              </div>
              <div className="espacio-footer">
                <button onClick={() => registrarSalida(visita.visita_id)} className="btn-icon-success">
                  <LogOut size={14} /> Registrar Salida
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historial reciente */}
      <div>
        <h5>📜 Historial de visitas (últimos 7 días)</h5>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Visitante</th><th>Identificación</th><th>Anfitrión</th><th>Entrada</th><th>Salida</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {historial.map(h => (
                <tr key={h.visita_id}>
                  <td><strong>{h.nombre} {h.apellidos}</strong></td>
                  <td>{h.identificacion || '—'}</td>
                  <td>{h.socio_anfitrion_nombre || '—'}</td>
                  <td>{new Date(h.hora_entrada).toLocaleString()}</td>
                  <td>{h.hora_salida ? new Date(h.hora_salida).toLocaleString() : '—'}</td>
                  <td><span className={h.hora_salida ? 'badge-warning' : 'badge-success'}>{h.hora_salida ? 'Finalizada' : 'Activa'}</span></td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay registros en el historial</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de nueva visita */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>📝 Registrar nueva visita</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><XCircle size={24} /></button>
            </div>
            <form onSubmit={registrarVisita}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombre *</label>
                    <input required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="required">Apellidos *</label>
                    <input required value={formData.apellidos} onChange={e => setFormData({...formData, apellidos: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Identificación (INE/Pasaporte)</label>
                    <input value={formData.identificacion} onChange={e => setFormData({...formData, identificacion: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Socio anfitrión (opcional)</label>
                    <select value={formData.socio_anfitrion_id} onChange={e => setFormData({...formData, socio_anfitrion_id: e.target.value})}>
                      <option value="">--- Ninguno ---</option>
                      {socios.map(s => (
                        <option key={s.socio_id} value={s.socio_id}>
                          {s.nombres} {s.apellido_paterno} ({s.tipo_socio}) - Pases: {limitesPases[s.socio_id]?.usados || 0}/{limitesPases[s.socio_id]?.maximo || 0}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group form-group-full">
                    <label>Motivo</label>
                    <textarea rows="2" value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">Registrar entrada</button>
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
        .grid-auto {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .espacio-card-modern {
          background: white;
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .espacio-card-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .espacio-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .espacio-title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }
        .espacio-sub {
          margin: 0.25rem 0 0;
          font-size: 0.75rem;
          color: #6b7280;
        }
        .espacio-body {
          margin-bottom: 1rem;
        }
        .espacio-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .stat-label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .stat-value {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f2937;
        }
        .espacio-footer {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }
        .btn-icon-success {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          background: #10b981;
          color: white;
        }
        .btn-icon-success:hover {
          background: #059669;
        }
        .badge-success {
          background: #d1fae5;
          color: #065f46;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .badge-warning {
          background: #fed7aa;
          color: #92400e;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .flex-gap {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  );
}

export default RecepcionVisitas;