import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Calendar, BarChart2 } from 'lucide-react';

function BarraVertical({ valor, maxValor, color, label, sublabel }) {
  const alturaMax = 160;
  const altura = maxValor > 0 ? Math.max(Math.round((valor / maxValor) * alturaMax), 8) : 8;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155' }}>{sublabel}</span>
      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: alturaMax }}>
        <div style={{
          width: '45%', height: altura,
          background: color,
          borderRadius: '8px 8px 0 0',
          transition: 'height 0.6s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>{label}</span>
    </div>
  );
}

function KpiCard({ valor, label, color, icono }) {
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '1.5rem',
      border: '1px solid #e2e8f0', textAlign: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: `${color}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 0.75rem'
      }}>
        {icono}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function MetricasInstructor() {
  const [metricas, setMetricas] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetricas = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3000/api/instructor/metricas', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setMetricas(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetricas();
  }, []);

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
      Cargando métricas...
    </div>
  );

  if (!metricas) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
      No se pudieron cargar las métricas.
    </div>
  );

  const asistenciaDatos = metricas.asistenciaMensual || [];
  const convocatoriaDatos = metricas.convocatoriaMensualData || [];
  const maxAsistencia = 100;
  const maxConvocatoria = Math.max(...convocatoriaDatos.map(d => parseInt(d.total) || 0), 1);

  return (
    <div>
      <h4 style={{ margin: '0 0 1.25rem', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
        Métricas de Rendimiento
      </h4>

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1rem', marginBottom: '1.5rem'
      }}>
        <KpiCard
          valor={`${metricas.asistenciaPromedio || 0}%`}
          label="Promedio de Asistencia"
          color="#10b981"
          icono={<TrendingUp size={22} color="#10b981" />}
        />
        <KpiCard
          valor={metricas.convocatoriaMensual || 0}
          label="Convocatoria Mensual"
          color="#3b82f6"
          icono={<Users size={22} color="#3b82f6" />}
        />
        <KpiCard
          valor={metricas.sesionesHoy || 0}
          label="Sesiones Hoy"
          color="#f59e0b"
          icono={<Calendar size={22} color="#f59e0b" />}
        />
        <KpiCard
          valor={metricas.totalAlumnos || 0}
          label="Total Alumnos"
          color="#8b5cf6"
          icono={<BarChart2 size={22} color="#8b5cf6" />}
        />
      </div>

      {/* Gráfica Asistencia Mensual */}
      <div className="chart-box" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <BarChart2 size={16} color="#3b82f6" />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
            Asistencia Mensual
          </h4>
        </div>
        {asistenciaDatos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            Sin datos de asistencia aún
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', padding: '0 0.5rem 1rem' }}>
            {asistenciaDatos.map((d, i) => (
              <BarraVertical
                key={i}
                valor={parseFloat(d.porcentaje) || 0}
                maxValor={maxAsistencia}
                color="#1e3a5f"
                label={d.mes}
                sublabel={`${parseFloat(d.porcentaje) || 0}%`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Gráfica Convocatoria Mensual */}
      <div className="chart-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Users size={16} color="#10b981" />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
            Convocatoria Mensual
          </h4>
        </div>
        {convocatoriaDatos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            Sin datos de convocatoria aún
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', padding: '0 0.5rem 1rem' }}>
            {convocatoriaDatos.map((d, i) => (
              <BarraVertical
                key={i}
                valor={parseInt(d.total) || 0}
                maxValor={maxConvocatoria}
                color="#10b981"
                label={d.mes}
                sublabel={String(d.total)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricasInstructor;