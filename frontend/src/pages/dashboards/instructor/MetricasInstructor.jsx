import React, { useEffect, useState } from 'react';

function MetricasInstructor() {
  const [metricas, setMetricas] = useState({
    asistenciaPromedio: 0,
    convocatoriaMensual: 0,
    sesionesHoy: 0,
    totalAlumnos: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchMetricas = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/instructor/metricas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Error al cargar métricas');
      
      const data = await response.json();
      setMetricas(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricas();
  }, []);

  if (loading) return <div className="chart-box"><p>Cargando métricas...</p></div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div><h3>{metricas.asistenciaPromedio}%</h3><p>Asistencia Promedio</p></div>
        </div>
        <div className="kpi-card">
          <div><h3>{metricas.convocatoriaMensual}</h3><p>Convocatoria Mensual</p></div>
        </div>
        <div className="kpi-card">
          <div><h3>{metricas.sesionesHoy}</h3><p>Sesiones Hoy</p></div>
        </div>
        <div className="kpi-card">
          <div><h3>{metricas.totalAlumnos}</h3><p>Total Alumnos</p></div>
        </div>
      </div>
      
      <div className="chart-box">
        <h4>Rendimiento</h4>
        <p>Próximamente: Gráficas detalladas de asistencia y convocatoria</p>
      </div>
    </div>
  );
}

export default MetricasInstructor;