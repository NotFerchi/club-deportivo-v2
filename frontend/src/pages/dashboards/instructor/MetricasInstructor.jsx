import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Calendar, BarChart2, Award } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';

function BarraVertical({ valor, maxValor, color, label, sublabel }) {
  const alturaMax = 140;
  const altura = maxValor > 0 ? Math.max(Math.round((valor / maxValor) * alturaMax), 6) : 6;
  const pct = maxValor > 0 ? Math.round((valor / maxValor) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1 }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>{sublabel}</span>
      <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: alturaMax, position: 'relative' }}>
        {/* Líneas guía */}
        {[25, 50, 75, 100].map(p => (
          <div key={p} style={{
            position: 'absolute', left: 0, right: 0,
            bottom: `${(p / 100) * alturaMax}px`,
            borderTop: '1px dashed #f1f5f9',
            zIndex: 0
          }} />
        ))}
        <div style={{
          width: '55%', height: altura,
          background: color,
          borderRadius: '8px 8px 0 0',
          transition: 'height 0.6s ease',
          position: 'relative', zIndex: 1,
          boxShadow: `0 4px 12px ${color}40`
        }}>
          {pct >= 15 && (
            <div style={{
              position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)',
              fontSize: '9px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap',
              background: 'white', padding: '1px 4px', borderRadius: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>{pct}%</div>
          )}
        </div>
      </div>
      <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function KpiCard({ valor, label, color, icono, sub }) {
  return (
    <div style={{
      background: 'white', borderRadius: '16px', padding: '1.25rem',
      border: '1px solid #e2e8f0', borderTop: `4px solid ${color}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', textAlign: 'center'
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '12px',
        background: `${color}15`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 0.75rem'
      }}>
        {icono}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '6px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>{sub}</div>}
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
        const res = await fetch(`${API_BASE_URL}/instructor/metricas`, {
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
    <div className="chart-box" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando métricas...
    </div>
  );

  if (!metricas) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
      No se pudieron cargar las métricas.
    </div>
  );

  const asistenciaDatos  = metricas.asistenciaMensual || [];
  const convocatoriaDatos = metricas.convocatoriaMensualData || [];
  const maxAsistencia    = 100;
  const maxConvocatoria  = Math.max(...convocatoriaDatos.map(d => parseInt(d.total) || 0), 1);

  const nivelAsistencia = metricas.asistenciaPromedio >= 80 ? { label: 'Excelente', color: '#10b981' }
    : metricas.asistenciaPromedio >= 60 ? { label: 'Bueno', color: '#f59e0b' }
    : { label: 'Mejorable', color: '#ef4444' };

  return (
    <div>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: '16px', padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Métricas de Rendimiento</h4>
          <p style={{ margin: '3px 0 0', opacity: 0.75, fontSize: '12px' }}>Últimos 5 meses de actividad</p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
          padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <Award size={16} color="white" />
          <span style={{ fontSize: '12px', fontWeight: 700 }}>Nivel: {nivelAsistencia.label}</span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard
          valor={`${metricas.asistenciaPromedio || 0}%`}
          label="Promedio Asistencia"
          sub={nivelAsistencia.label}
          color={nivelAsistencia.color}
          icono={<TrendingUp size={22} color={nivelAsistencia.color} />}
        />
        <KpiCard
          valor={metricas.convocatoriaMensual || 0}
          label="Convocatoria Mensual"
          sub="Este mes"
          color="#3b82f6"
          icono={<Users size={22} color="#3b82f6" />}
        />
        <KpiCard
          valor={metricas.sesionesHoy || 0}
          label="Sesiones Hoy"
          sub="Programadas"
          color="#f59e0b"
          icono={<Calendar size={22} color="#f59e0b" />}
        />
        <KpiCard
          valor={metricas.totalAlumnos || 0}
          label="Total Alumnos"
          sub="Únicos"
          color="#8b5cf6"
          icono={<BarChart2 size={22} color="#8b5cf6" />}
        />
      </div>

      {/* Gráfica Asistencia */}
      <div className="chart-box" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '3px', background: '#1e3a5f' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Asistencia Mensual</h4>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f8fafc', padding: '3px 10px', borderRadius: '20px' }}>% por mes</span>
        </div>
        {asistenciaDatos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '13px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
            Sin datos de asistencia aún
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', padding: '1rem 0.5rem 0.5rem' }}>
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

      {/* Gráfica Convocatoria */}
      <div className="chart-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '3px', background: '#10b981' }} />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>Convocatoria Mensual</h4>
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f8fafc', padding: '3px 10px', borderRadius: '20px' }}>alumnos por mes</span>
        </div>
        {convocatoriaDatos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '13px' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📊</div>
            Sin datos de convocatoria aún
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', padding: '1rem 0.5rem 0.5rem' }}>
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