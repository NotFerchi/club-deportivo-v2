import React, { useEffect, useState } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

function ReporteSanciones() {
  const [sanciones, setSanciones] = useState([]);
  const [filteredSanciones, setFilteredSanciones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSanciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/sanciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSanciones(data);
      setFilteredSanciones(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSanciones();
  }, []);

  useEffect(() => {
    if (searchTerm === '') {
      setFilteredSanciones(sanciones);
    } else {
      const filtered = sanciones.filter(s =>
        s.socio_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.motivo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSanciones(filtered);
    }
  }, [searchTerm, sanciones]);

  const handlePerdonarSanción = async (id) => {
    if (!confirm('¿Perdonar esta sanción?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:3000/api/sanciones/${id}/perdonar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchSanciones();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getGravedadColor = (gravedad) => {
    if (gravedad === 'Leve') return '#f59e0b';
    if (gravedad === 'Moderada') return '#ef4444';
    if (gravedad === 'Grave') return '#991b1b';
    return '#64748b';
  };

  if (loading) return <div className="chart-box"><p>Cargando sanciones...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>⚠️ Reporte de Sanciones</h4>
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Buscar socio o motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

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
              <tr key={sancion.sancion_id}>
                <td><strong>{sancion.socio_nombre}</strong><br /><span style={{ fontSize: '11px', color: '#64748b' }}>{sancion.numero_socio}</span></td>
                <td>{sancion.tipo_socio}</td>
                <td>{sancion.motivo}</td>
                <td><span style={{ background: getGravedadColor(sancion.gravedad), color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{sancion.gravedad}</span></td>
                <td>{new Date(sancion.fecha_inicio).toLocaleDateString()}</td>
                <td>{sancion.fecha_fin ? new Date(sancion.fecha_fin).toLocaleDateString() : '—'}</td>
                <td>
                  <span className={sancion.activa ? 'badge-warning' : 'badge-success'}>
                    {sancion.activa ? 'Activa' : 'Expirada'}
                  </span>
                </td>
                <td>
                  {sancion.activa && (
                    <button onClick={() => handlePerdonarSanción(sancion.sancion_id)} className="btn-success" style={{ padding: '4px 12px', fontSize: '11px' }}>
                      Perdonar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSanciones.length === 0 && (
        <p className="empty-message">No hay sanciones registradas</p>
      )}
    </div>
  );
}

export default ReporteSanciones;