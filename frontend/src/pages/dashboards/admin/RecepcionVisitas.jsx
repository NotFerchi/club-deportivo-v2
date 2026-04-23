import React, { useEffect, useState } from 'react';
import { Search, UserPlus, LogOut, Clock, Users, Calendar, CheckCircle, XCircle } from 'lucide-react';

function RecepcionVisitas() {
  const [visitasActivas, setVisitasActivas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    identificacion: '',
    socio_anfitrion_id: '',
    motivo: '',
  });
  const [filtro, setFiltro] = useState('');
  const [limitesPases, setLimitesPases] = useState({}); // socio_id -> {usados, maximo}

  const token = localStorage.getItem('token');

  // Cargar visitas activas y socios
  const fetchData = async () => {
    try {
      const [activasRes, sociosRes] = await Promise.all([
        fetch('http://localhost:3000/api/recepcion/visitas/activas', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3000/api/recepcion/socios-lista', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (activasRes.ok) {
        const data = await activasRes.json();
        setVisitasActivas(data);
      }
      if (sociosRes.ok) {
        const sociosData = await sociosRes.json();
        setSocios(sociosData);
        // Calcular pases usados hoy por socio
        const usos = {};
        sociosData.forEach(s => { usos[s.socio_id] = 0; });
        if (activasRes.ok) {
          data.forEach(v => {
            if (v.socio_anfitrion_id) usos[v.socio_anfitrion_id] = (usos[v.socio_anfitrion_id] || 0) + 1;
          });
        }
        // Obtener límites máximos desde configuración o por tipo de socio
        const limites = {};
        sociosData.forEach(s => {
          const max = s.tipo_socio === 'accionista' ? 5 : 3; // ejemplo: accionista 5 pases/día, rentista 3
          limites[s.socio_id] = { usados: usos[s.socio_id] || 0, maximo: max };
        });
        setLimitesPases(limites);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/recepcion/visitas/historial?dias=7', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistorial(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistorial();
  }, []);

  const registrarVisita = async (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.apellidos) {
      alert('Nombre y apellidos son obligatorios');
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
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({ nombre: '', apellidos: '', identificacion: '', socio_anfitrion_id: '', motivo: '' });
        fetchData();
        fetchHistorial();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar visita');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión');
    }
  };

  const registrarSalida = async (visitaId) => {
    if (!confirm('Registrar salida del visitante?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/recepcion/visitas/${visitaId}/salida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
        fetchHistorial();
      } else {
        alert('Error al registrar salida');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const visitasFiltradas = visitasActivas.filter(v =>
    v.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    v.apellidos.toLowerCase().includes(filtro.toLowerCase()) ||
    (v.socio_anfitrion_nombre && v.socio_anfitrion_nombre.toLowerCase().includes(filtro.toLowerCase()))
  );

  if (loading) return <div className="chart-box"><p>Cargando...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h4>🚪 Recepción y Control de Visitas</h4>
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
        <h5>🟢 Visitas Activas (sin salida)</h5>
        <div className="grid-auto">
          {visitasFiltradas.length === 0 && <p>No hay visitas activas en este momento.</p>}
          {visitasFiltradas.map(visita => (
            <div key={visita.visita_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{visita.nombre} {visita.apellidos}</h3>
                  <p className="espacio-sub">
                    {visita.identificacion ? `ID: ${visita.identificacion}` : 'Sin identificación'}
                  </p>
                </div>
                <span className="badge-success">Entrada: {new Date(visita.hora_entrada).toLocaleTimeString()}</span>
              </div>
              <div className="espacio-body">
                <p><strong>Anfitrión:</strong> {visita.socio_anfitrion_nombre || 'Ninguno'}</p>
                <p><strong>Motivo:</strong> {visita.motivo || 'No especificado'}</p>
              </div>
              <div className="espacio-footer">
                <button onClick={() => registrarSalida(visita.visita_id)} className="btn-icon-success">
                  <LogOut size={16} /> Salida
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
                  <td>{h.nombre} {h.apellidos}</td>
                  <td>{h.identificacion || '—'}</td>
                  <td>{h.socio_anfitrion_nombre || '—'}</td>
                  <td>{new Date(h.hora_entrada).toLocaleString()}</td>
                  <td>{h.hora_salida ? new Date(h.hora_salida).toLocaleString() : '—'}</td>
                  <td><span className={h.hora_salida ? 'badge-warning' : 'badge-success'}>{h.hora_salida ? 'Finalizada' : 'Activa'}</span></td>
                </tr>
              ))}
              {historial.length === 0 && <tr><td colSpan="6">Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de nueva visita */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Registrar nueva visita</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><XCircle size={24} /></button>
            </div>
            <form onSubmit={registrarVisita}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Nombre *</label><input required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} /></div>
                  <div className="form-group"><label>Apellidos *</label><input required value={formData.apellidos} onChange={e => setFormData({...formData, apellidos: e.target.value})} /></div>
                  <div className="form-group"><label>Identificación (INE/Pasaporte)</label><input value={formData.identificacion} onChange={e => setFormData({...formData, identificacion: e.target.value})} /></div>
                  <div className="form-group"><label>Socio anfitrión (opcional)</label>
                    <select value={formData.socio_anfitrion_id} onChange={e => setFormData({...formData, socio_anfitrion_id: e.target.value})}>
                      <option value="">--- Ninguno ---</option>
                      {socios.map(s => (
                        <option key={s.socio_id} value={s.socio_id}>
                          {s.nombres} {s.apellido_paterno} ({s.tipo_socio}) - Pases hoy: {limitesPases[s.socio_id]?.usados || 0}/{limitesPases[s.socio_id]?.maximo || 0}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group form-group-full"><label>Motivo</label><textarea rows="2" value={formData.motivo} onChange={e => setFormData({...formData, motivo: e.target.value})} /></div>
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
    </div>
  );
}

export default RecepcionVisitas;