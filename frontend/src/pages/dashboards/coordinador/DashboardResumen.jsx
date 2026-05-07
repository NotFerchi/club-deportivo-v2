import React, { useEffect, useState } from 'react';
import { Users, Calendar, ShieldAlert, UserCheck, ArrowRight, TrendingUp } from 'lucide-react';

function KpiCard({ valor, label, color, icono, sub, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'white', borderRadius: '16px', padding: '1.5rem',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s',
      borderTop: `4px solid ${color}`
    }}
    onMouseEnter={e => { if(onClick) { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
    onMouseLeave={e => { if(onClick) { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ width: 44, height: 44, borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icono}
        </div>
        {onClick && <ArrowRight size={16} color="#94a3b8" />}
      </div>
      <div style={{ fontSize: '2.25rem', fontWeight: 800, color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '6px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
      {onClick && (
        <div style={{ marginTop: '1rem', fontSize: '11px', color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
          Ver detalle <ArrowRight size={11} />
        </div>
      )}
    </div>
  );
}

function PreviewCard({ titulo, color, icono, items, emptyMsg, onClick }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: '8px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icono}
          </div>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{titulo}</span>
        </div>
        {onClick && (
          <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            Ver todo <ArrowRight size={11} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📭</div>
          {emptyMsg}
        </div>
      ) : (
        <div>
          {items.slice(0, 4).map((item, i) => (
            <div key={i} style={{
              padding: '0.75rem 1.25rem',
              borderBottom: i < Math.min(items.length, 4) - 1 ? '1px solid #f8fafc' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: `hsl(${(i * 60 + 200) % 360}, 60%, 92%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700,
                  color: `hsl(${(i * 60 + 200) % 360}, 60%, 40%)`
                }}>
                  {item.avatar || item.principal?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{item.principal}</span>
              </div>
              <span style={{
                fontSize: '11px', color: item.badgeColor || '#94a3b8',
                background: item.badgeBg || 'transparent',
                padding: item.badgeBg ? '2px 8px' : '0',
                borderRadius: '20px', fontWeight: item.badgeBg ? 700 : 400
              }}>{item.secundario}</span>
            </div>
          ))}
          {items.length > 4 && (
            <div style={{ padding: '0.6rem 1.25rem', background: '#f8fafc', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              +{items.length - 4} más
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardResumen({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [socios, setSocios] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [sRes, vRes, rRes, sanRes] = await Promise.all([
          fetch('http://localhost:3000/api/recepcion/socios',   { headers }),
          fetch('http://localhost:3000/api/recepcion/visitas',  { headers }),
          fetch('http://localhost:3000/api/recepcion/reservas', { headers }),
          fetch('http://localhost:3000/api/sanciones',          { headers }),
        ]);
        const sa   = await sRes.json().then(d => Array.isArray(d) ? d : []);
        const va   = await vRes.json().then(d => Array.isArray(d) ? d : []);
        const ra   = await rRes.json().then(d => Array.isArray(d) ? d : []);
        const sana = await sanRes.json().then(d => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []));
        setSocios(sa); setVisitas(va); setReservas(ra); setSanciones(sana);
        setStats({
          totalSocios:      sa.length,
          sociosActivos:    sa.filter(x => x.activo).length,
          visitasHoy:       va.filter(x => x.vigente).length,
          reservasHoy:      ra.length,
          sancionesActivas: sana.filter(x => x.estado === 'Activa').length,
        });
      } catch (err) {
        console.error(err);
        setStats({ totalSocios: 0, sociosActivos: 0, visitasHoy: 0, reservasHoy: 0, sancionesActivas: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando resumen...
    </div>
  );

  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Saludo */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
        borderRadius: '16px', padding: '1.5rem 2rem', marginBottom: '1.5rem',
        color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>👋 Bienvenido al Panel de Coordinación</h3>
          <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '13px', textTransform: 'capitalize' }}>{hoy}</p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.sociosActivos}</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Socios activos</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.visitasHoy}</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>Visitas hoy</div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard valor={stats.totalSocios} label="Total Socios" color="#3b82f6"
          sub={`${stats.sociosActivos} activos`}
          icono={<Users size={20} color="#3b82f6" />}
          onClick={() => onNavigate('socios')} />
        <KpiCard valor={stats.visitasHoy} label="Visitas Activas" color="#10b981"
          sub="En instalaciones ahora"
          icono={<UserCheck size={20} color="#10b981" />}
          onClick={() => onNavigate('recepcion')} />
        <KpiCard valor={stats.reservasHoy} label="Reservas Hoy" color="#f59e0b"
          sub="Espacios reservados"
          icono={<Calendar size={20} color="#f59e0b" />}
          onClick={() => onNavigate('reservas')} />
        <KpiCard valor={stats.sancionesActivas} label="Sanciones Activas" color="#ef4444"
          sub="Requieren atención"
          icono={<ShieldAlert size={20} color="#ef4444" />}
          onClick={() => onNavigate('sanciones')} />
      </div>

      {/* Previews */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <PreviewCard
          titulo="Socios Recientes"
          color="#3b82f6"
          icono={<Users size={14} color="#3b82f6" />}
          emptyMsg="No hay socios registrados"
          onClick={() => onNavigate('socios')}
          items={socios.slice(0, 4).map(s => ({
            principal: s.nombre_completo || s.email?.split('@')[0] || '—',
            secundario: s.numero_socio,
            badgeBg: s.activo ? '#dcfce7' : '#fee2e2',
            badgeColor: s.activo ? '#15803d' : '#b91c1c'
          }))}
        />
        <PreviewCard
          titulo="Visitas Activas"
          color="#10b981"
          icono={<UserCheck size={14} color="#10b981" />}
          emptyMsg="No hay visitas activas ahora"
          onClick={() => onNavigate('recepcion')}
          items={visitas.filter(v => v.vigente).map(v => ({
            principal: v.nombre_completo,
            secundario: '🟢 En instalaciones',
            badgeBg: '#f0fdf4',
            badgeColor: '#15803d'
          }))}
        />
        <PreviewCard
          titulo="Reservas del Día"
          color="#f59e0b"
          icono={<Calendar size={14} color="#f59e0b" />}
          emptyMsg="No hay reservas hoy"
          onClick={() => onNavigate('reservas')}
          items={reservas.slice(0, 4).map(r => ({
            principal: r.espacio_nombre || '—',
            secundario: `${r.hora_inicio?.slice(0,5)} - ${r.hora_fin?.slice(0,5)}`
          }))}
        />
        <PreviewCard
          titulo="Sanciones Activas"
          color="#ef4444"
          icono={<ShieldAlert size={14} color="#ef4444" />}
          emptyMsg="Sin sanciones activas 🎉"
          onClick={() => onNavigate('sanciones')}
          items={sanciones.filter(s => s.estado === 'Activa').map(s => ({
            principal: s.socio_nombre || '—',
            secundario: s.origen || '—',
            badgeBg: '#fee2e2',
            badgeColor: '#b91c1c'
          }))}
        />
      </div>
    </div>
  );
}

export default DashboardResumen;
