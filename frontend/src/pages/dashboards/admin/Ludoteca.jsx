import React, { useEffect, useState } from 'react';
import { Search, UserPlus, LogOut, Baby, Clock, CheckCircle } from 'lucide-react';

function Ludoteca() {
  const [registrosActivos, setRegistrosActivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [formData, setFormData] = useState({ nombre_nino: '', edad: '', socio_id: '', hora_entrada: '', observaciones: '' });
  const token = localStorage.getItem('token');

  const fetchData = async () => {
    try {
      const [activosRes, historialRes, sociosRes] = await Promise.all([
        fetch('http://localhost:3000/api/ludoteca/activos', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:3000/api/ludoteca/historial?dias=7', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:3000/api/socios', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (activosRes.ok) setRegistrosActivos(await activosRes.json());
      if (historialRes.ok) setHistorial(await historialRes.json());
      if (sociosRes.ok) setSocios((await sociosRes.json()).filter(s => s.activo));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const registrarEntrada = async (e) => {
    e.preventDefault();
    if (!formData.nombre_nino || !formData.edad || !formData.socio_id || !formData.hora_entrada) {
      alert('Complete todos los campos obligatorios');
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/ludoteca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchData();
        setShowModal(false);
        setFormData({ nombre_nino: '', edad: '', socio_id: '', hora_entrada: '', observaciones: '' });
      } else {
        const err = await res.json();
        alert(err.error || 'Error al registrar');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const registrarSalida = async (id) => {
    if (!confirm('Registrar salida del niño?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/ludoteca/${id}/salida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
      else alert('Error');
    } catch (error) {
      console.error(error);
    }
  };

  const activosFiltrados = registrosActivos.filter(r => r.nombre_nino.toLowerCase().includes(filtro.toLowerCase()) || r.socio_nombre?.toLowerCase().includes(filtro.toLowerCase()));

  if (loading) return <div className="chart-box"><p>Cargando...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h4>🧸 Control de Ludoteca</h4>
        <div className="flex-gap">
          <div className="search-wrapper"><Search className="search-icon" /><input placeholder="Buscar niño o socio" value={filtro} onChange={e => setFiltro(e.target.value)} className="search-input" /></div>
          <button className="btn-primary" onClick={() => setShowModal(true)}><UserPlus size={16} /> Registrar Entrada</button>
        </div>
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <h5>🟢 Niños en Ludoteca</h5>
        <div className="grid-auto">
          {activosFiltrados.map(r => (
            <div key={r.registro_id} className="espacio-card-modern">
              <div className="espacio-header"><div><h3 className="espacio-title">{r.nombre_nino} ({r.edad} años)</h3><p className="espacio-sub">👨‍👩 {r.socio_nombre}</p></div><span className="badge-success">Entrada: {new Date(r.hora_entrada).toLocaleTimeString()}</span></div>
              <div className="espacio-body"><p>{r.observaciones}</p></div>
              <div className="espacio-footer"><button onClick={() => registrarSalida(r.registro_id)} className="btn-icon-success"><LogOut size={16} /> Salida</button></div>
            </div>
          ))}
          {activosFiltrados.length === 0 && <p>No hay niños en ludoteca.</p>}
        </div>
      </div>
      <div><h5>📜 Historial reciente</h5>
        <div className="table-wrapper"><table className="data-table"><thead><tr><th>Niño</th><th>Socio</th><th>Entrada</th><th>Salida</th><th>Estado</th></tr></thead><tbody>{historial.map(h => (<tr key={h.registro_id}><td>{h.nombre_nino} ({h.edad})</td><td>{h.socio_nombre}</td><td>{new Date(h.hora_entrada).toLocaleString()}</td><td>{h.hora_salida ? new Date(h.hora_salida).toLocaleString() : '—'}</td><td><span className={h.hora_salida ? 'badge-warning' : 'badge-success'}>{h.hora_salida ? 'Finalizado' : 'Activo'}</span></td></tr>))}</tbody></table></div>
      </div>
      {showModal && (<div className="modal-overlay"><div className="modal-content"><div className="modal-header"><h3>Registrar entrada a ludoteca</h3><button onClick={() => setShowModal(false)} className="close-modal"><XCircle size={24} /></button></div><form onSubmit={registrarEntrada}><div className="modal-body"><div className="form-row"><div className="form-group"><label>Nombre del niño *</label><input required value={formData.nombre_nino} onChange={e => setFormData({...formData, nombre_nino: e.target.value})} /></div><div className="form-group"><label>Edad *</label><input type="number" required value={formData.edad} onChange={e => setFormData({...formData, edad: e.target.value})} /></div><div className="form-group"><label>Socio responsable *</label><select required value={formData.socio_id} onChange={e => setFormData({...formData, socio_id: e.target.value})}><option value="">Seleccione</option>{socios.map(s => <option key={s.socio_id} value={s.socio_id}>{s.nombres} {s.apellido_paterno}</option>)}</select></div><div className="form-group"><label>Hora de entrada *</label><input type="time" required value={formData.hora_entrada} onChange={e => setFormData({...formData, hora_entrada: e.target.value})} /></div><div className="form-group form-group-full"><label>Observaciones</label><textarea rows="2" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} /></div></div></div><div className="modal-footer"><button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button><button type="submit" className="btn-primary">Registrar entrada</button></div></form></div></div>)}
    </div>
  );
}

export default Ludoteca;