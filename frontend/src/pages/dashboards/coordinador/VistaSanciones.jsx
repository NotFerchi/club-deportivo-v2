import React, { useEffect, useState } from 'react';
import { Search, ShieldCheck, ShieldX, Shield, Plus, X } from 'lucide-react';

// ── Modal Nueva Sanción ───────────────────────────────────────────────────────
function ModalNuevaSancion({ onClose, onCreada }) {
  const [socios, setSocios]     = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);
  const [form, setForm] = useState({
    socio_id: '',
    motivo:   '',
    origen:   'Administración',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('http://localhost:3000/api/recepcion/socios', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setSocios(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.socio_id) { setError('Selecciona un socio'); return; }
    if (!form.motivo.trim()) { setError('El motivo es requerido'); return; }

    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/sanciones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_id: parseInt(form.socio_id), motivo: form.motivo.trim(), origen: form.origen })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al crear sanción'); return; }
      onCreada();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Nueva Sanción</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Registra una sanción a un socio</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Socio *</label>
            <select name="socio_id" value={form.socio_id} onChange={handleChange} style={inputStyle}>
              <option value="">Selecciona un socio</option>
              {socios.map(s => (
                <option key={s.socio_id} value={s.socio_id}>
                  {s.nombre_completo || `${s.nombres || ''} ${s.apellido_paterno || ''}`.trim()} — {s.numero_socio}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Origen *</label>
            <select name="origen" value={form.origen} onChange={handleChange} style={inputStyle}>
              <option value="Administración">Administración</option>
              <option value="Reservaciones">Reservaciones</option>
              <option value="Ludoteca">Ludoteca</option>
              <option value="Torneos">Torneos</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Motivo *</label>
            <textarea name="motivo" value={form.motivo} onChange={handleChange}
              placeholder="Describe el motivo de la sanción..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={cargando} style={{
            flex: 2, background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #ef4444, #b91c1c)',
            color: 'white', border: 'none', borderRadius: '10px', padding: '11px',
            fontSize: '13px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer'
          }}>
            {cargando ? '⏳ Creando...' : '+ Crear Sanción'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function VistaSanciones() {
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [filtro, setFiltro]       = useState('todas');
  const [showModal, setShowModal] = useState(false);

  const fetchSanciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/sanciones', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSanciones(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLevantar = async (id) => {
    if (!window.confirm('¿Levantar esta sanción? El socio podrá hacer reservas nuevamente.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/sanciones/${id}/levantar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchSanciones();
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchSanciones(); }, []);

  const formatFecha = (f) => {
    if (!f) return '—';
    return new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const esActiva   = (s) => s.estado === 'Activa' || s.estado === 'Activo';
  const esResuelta = (s) => s.estado === 'Resuelta' || s.estado === 'Resuelto';

  const activas   = sanciones.filter(esActiva);
  const resueltas = sanciones.filter(esResuelta);

  const filtradas = sanciones
    .filter(s => {
      if (filtro === 'todas') return true;
      if (filtro === 'Activa') return esActiva(s);
      if (filtro === 'Resuelta') return esResuelta(s);
      return true;
    })
    .filter(s =>
      s.socio_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.motivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.origen?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const getOrigenColor = (origen) => {
    if (origen === 'Reservaciones') return { bg: '#ede9fe', color: '#6d28d9' };
    if (origen === 'Administración') return { bg: '#fee2e2', color: '#b91c1c' };
    if (origen === 'Ludoteca') return { bg: '#fef3c7', color: '#b45309' };
    if (origen === 'Torneos') return { bg: '#dcfce7', color: '#15803d' };
    return { bg: '#f1f5f9', color: '#64748b' };
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      Cargando sanciones...
    </div>
  );

  return (
    <div>
      {/* Botón nueva sanción */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowModal(true)} style={{
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          color: 'white', border: 'none', borderRadius: '10px',
          padding: '9px 18px', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
        }}>
          <Plus size={15} /> Nueva Sanción
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total',     valor: sanciones.length, color: '#3b82f6', icono: <Shield size={18} />,      key: 'todas' },
          { label: 'Activas',   valor: activas.length,   color: '#ef4444', icono: <ShieldX size={18} />,     key: 'Activa' },
          { label: 'Resueltas', valor: resueltas.length, color: '#10b981', icono: <ShieldCheck size={18} />, key: 'Resuelta' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltro(k.key)} style={{
            background: filtro === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '1rem 1.25rem',
            border: `1px solid ${filtro === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtro === k.key ? `0 4px 12px ${k.color}40` : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: filtro === k.key ? 'white' : k.color }}>{k.valor}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: filtro === k.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{k.label}</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: filtro === k.key ? 'rgba(255,255,255,0.2)' : `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(k.icono, { color: filtro === k.key ? 'white' : k.color })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input type="text" placeholder="Buscar por socio, motivo u origen..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ width: '100%', paddingLeft: 40, paddingRight: 16, paddingTop: 10, paddingBottom: 10, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
        />
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <ShieldCheck size={48} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>
            {busqueda ? 'No se encontraron resultados' : filtro === 'Activa' ? 'No hay sanciones activas 🎉' : '¡Sin sanciones registradas!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtradas.map(s => {
            const activa      = esActiva(s);
            const origenColor = getOrigenColor(s.origen);

            return (
              <div key={s.sancion_id} style={{
                background: 'white', borderRadius: '14px',
                border: `1px solid ${activa ? '#fecaca' : '#e2e8f0'}`,
                borderLeft: `4px solid ${activa ? '#ef4444' : '#10b981'}`,
                padding: '1rem 1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                      background: activa ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 800, fontSize: '14px'
                    }}>
                      {s.socio_nombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{s.socio_nombre}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.numero_socio}</div>
                    </div>
                  </div>
                  <span style={{
                    background: activa ? '#fee2e2' : '#dcfce7',
                    color: activa ? '#b91c1c' : '#15803d',
                    fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0
                  }}>
                    {activa ? <ShieldX size={12} /> : <ShieldCheck size={12} />}
                    {s.estado}
                  </span>
                </div>

                {/* Motivo */}
                <div style={{ margin: '0.85rem 0 0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo: </span>
                    {s.motivo}
                  </p>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: origenColor.bg, color: origenColor.color, fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px' }}>
                      {s.origen || 'Sin origen'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      📅 {formatFecha(s.fecha)}
                    </span>
                    {s.fecha_resolucion && (
                      <span style={{ fontSize: '11px', color: '#10b981' }}>
                        ✅ Resuelta: {formatFecha(s.fecha_resolucion)}
                      </span>
                    )}
                  </div>

                  {activa && (
                    <button onClick={() => handleLevantar(s.sancion_id)} style={{
                      background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac',
                      borderRadius: '8px', padding: '5px 14px', fontSize: '12px', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <ShieldCheck size={13} /> Levantar sanción
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalNuevaSancion
          onClose={() => setShowModal(false)}
          onCreada={fetchSanciones}
        />
      )}
    </div>
  );
}

export default VistaSanciones;