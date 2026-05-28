import React, { useEffect, useState } from 'react';
import { Calendar, Users, TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';

function ReportesAsistencia() {
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  // toISOString() retorna UTC — usamos getFullYear/Month/Date para fecha local MX
  const [fechaInicio, setFechaInicio] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [fechaFin, setFechaFin] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });

  const fetchReportes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/reportes/asistencia?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setReportes(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportes();
  }, [fechaInicio, fechaFin]);

  if (loading) return <div className="chart-box"><p>Cargando reportes...</p></div>;

  return (
    <div className="chart-box">
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>📊 Reportes de Asistencia</h4>
        <div className="flex-gap">
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="date-picker" />
          <span>a</span>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="date-picker" />
          <button onClick={fetchReportes} className="btn-primary">Filtrar</button>
        </div>
      </div>

      {reportes.length === 0 ? (
        <p className="empty-message">No hay datos de asistencia en el período seleccionado</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Instructor</th>
                <th>Disciplina</th>
                <th>Total Clases</th>
                <th>Total Asistentes</th>
                <th>Asistencia Promedio</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map(reporte => (
                <tr key={reporte.instructor_id}>
                  <td><strong>{reporte.instructor_nombre}</strong></td>
                  <td>{reporte.disciplina}</td>
                  <td>{reporte.total_clases}</td>
                  <td>{reporte.total_asistentes}</td>
                  <td>
                    <span className="badge-success">
                      {reporte.asistencia_promedio}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ReportesAsistencia;