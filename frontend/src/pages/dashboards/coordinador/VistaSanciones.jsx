import React, { useEffect, useState, useRef } from 'react';
import { Search, ShieldCheck, ShieldX, Shield, Plus, X, AlertTriangle, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { API_BASE_URL } from '../../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const getGravedadConfig = (gravedad) => {
  if (gravedad === 'Grave')    return { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', label: 'Grave' };
  if (gravedad === 'Moderada') return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d', label: 'Moderada' };
  return                              { bg: '#f0fdf4', color: '#15803d', border: '#86efac', label: 'Leve' };
};

const getOrigenColor = (origen) => {
  if (origen === 'Reservaciones') return { bg: '#ede9fe', color: '#6d28d9' };
  if (origen === 'Administración') return { bg: '#fee2e2', color: '#b91c1c' };
  if (origen === 'Ludoteca')      return { bg: '#fef3c7', color: '#b45309' };
  if (origen === 'Torneos')       return { bg: '#dcfce7', color: '#15803d' };
  return { bg: '#f1f5f9', color: '#64748b' };
};

const formatFecha = (f) => {
  if (!f) return '—';
  const str = String(f);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T00:00:00`) : new Date(str);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Buscador de socios con búsqueda en servidor ───────────────────────────────
function SocioBuscador({ value, onChange }) {
  const [query, setQuery]         = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando]   = useState(false);
  const [abierto, setAbierto]     = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const ref                       = useRef(null);
  const timerRef                  = useRef(null);

  // Nombre visible del socio seleccionado
  const nombreVisible = seleccionado
    ? `${seleccionado.nombre_completo || `${seleccionado.nombres || ''} ${seleccionado.apellido_paterno || ''}`.trim()} — ${seleccionado.numero_socio}`
    : '';

  // Búsqueda en servidor con debounce 300 ms
  const buscarEnServidor = (texto) => {
    clearTimeout(timerRef.current);
    if (!texto.trim()) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    timerRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${API_BASE_URL}/recepcion/socios?q=${encodeURIComponent(texto)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setResultados(Array.isArray(data) ? data : []);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 300);
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); clearTimeout(timerRef.current); };
  }, []);

  const handleFocus = () => { setAbierto(true); setQuery(''); setResultados([]); };
  const handleChange = (e) => { setQuery(e.target.value); buscarEnServidor(e.target.value); };
  const handleSelect = (socio) => {
    setSeleccionado(socio);
    onChange(String(socio.socio_id));
    setAbierto(false);
    setQuery('');
    setResultados([]);
  };
  const handleClear = () => { setSeleccionado(null); onChange(''); setQuery(''); setResultados([]); };

  const inputStyle = {
    width: '100%', padding: '9px 12px 9px 32px', border: '1px solid #cbd5e1',
    borderRadius: '8px', fontSize: '13px', outline: 'none',
    boxSizing: 'border-box', background: 'white'
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Input de búsqueda */}
      <div style={{ position: 'relative' }}>
        {buscando
          ? <Loader2 size={13} className="icon-spin" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          : <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        }
        <input
          style={inputStyle}
          placeholder="Escribe el nombre o número del socio..."
          value={abierto ? query : nombreVisible}
          onFocus={handleFocus}
          onChange={handleChange}
          autoComplete="off"
        />
        {value && !abierto && (
          <button onMouseDown={handleClear} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={13} color="#94a3b8" />
          </button>
        )}
      </div>

      {/* Desplegable */}
      {abierto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2
        }}>
          {!query.trim() ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
              Empieza a escribir para buscar...
            </div>
          ) : buscando ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '12px', color: '#94a3b8', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Loader2 size={13} className="icon-spin" /> Buscando...
            </div>
          ) : resultados.length === 0 ? (
            <div style={{ padding: '0.75rem 1rem', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
              Sin resultados para "{query}"
            </div>
          ) : resultados.map(s => {
            const nombre = s.nombre_completo || `${s.nombres || ''} ${s.apellido_paterno || ''}`.trim();
            return (
              <div key={s.socio_id}
                onMouseDown={() => handleSelect(s)}
                style={{
                  padding: '0.6rem 1rem', fontSize: '13px', cursor: 'pointer',
                  borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>{nombre}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{s.tipo} · {s.modalidad}</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>
                  {s.numero_socio}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal Editar Sanción ──────────────────────────────────────────────────────
function ModalEditarSancion({ sancion, onClose, onActualizada }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);
  const [form, setForm] = useState({
    motivo:   sancion.motivo   || '',
    origen:   sancion.origen   || 'Administración',
    gravedad: sancion.gravedad || 'Leve',
  });

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.motivo.trim()) { setError('El motivo es requerido'); return; }
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/sanciones/${sancion.sancion_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivo:   form.motivo.trim(),
          origen:   form.origen,
          gravedad: form.gravedad,
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al actualizar'); return; }
      onActualizada();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' };
  const gcfg       = getGravedadConfig(form.gravedad);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Editar Sanción</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
              Socio: <strong>{sancion.socio_nombre}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Origen */}
          <div>
            <label style={labelStyle}>Origen</label>
            <select name="origen" value={form.origen} onChange={handleChange} style={inputStyle}>
              <option value="Administración">Administración</option>
              <option value="Reservaciones">Reservaciones</option>
              <option value="Ludoteca">Ludoteca</option>
              <option value="Torneos">Torneos</option>
            </select>
          </div>

          {/* Nivel de gravedad */}
          <div>
            <label style={labelStyle}>Nivel de gravedad</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {['Leve', 'Moderada', 'Grave'].map(nivel => {
                const cfg    = getGravedadConfig(nivel);
                const activo = form.gravedad === nivel;
                return (
                  <button key={nivel} type="button"
                    onClick={() => setForm(prev => ({ ...prev, gravedad: nivel }))}
                    style={{
                      padding: '8px 4px', border: `2px solid ${activo ? cfg.border : '#e2e8f0'}`,
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px',
                      background: activo ? cfg.bg : 'white',
                      color: activo ? cfg.color : '#94a3b8',
                      transition: 'all 0.15s'
                    }}>
                    {nivel}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: '6px', padding: '6px 10px', background: gcfg.bg, borderRadius: '6px', fontSize: '11px', color: gcfg.color, fontWeight: 600 }}>
              {form.gravedad === 'Leve'     && 'Leve: advertencia, sin restricción de reservas.'}
              {form.gravedad === 'Moderada' && 'Moderada: restricción de reservas por 7 días.'}
              {form.gravedad === 'Grave'    && 'Grave: restricción de reservas por 30 días.'}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label style={labelStyle}>Motivo *</label>
            <textarea name="motivo" value={form.motivo} onChange={handleChange}
              placeholder="Describe el motivo de la sanción..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={cargando} style={{
            flex: 2, background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white', border: 'none', borderRadius: '10px', padding: '11px',
            fontSize: '13px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}>
            {cargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
              : 'Guardar cambios'
            }
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ── Modal Nueva Sanción ───────────────────────────────────────────────────────
function ModalNuevaSancion({ onClose, onCreada }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);
  const [form, setForm] = useState({
    socio_id: '',
    motivo:   '',
    origen:   'Administración',
    gravedad: 'Leve',
  });

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.socio_id) { setError('Selecciona un socio'); return; }
    if (!form.motivo.trim()) { setError('El motivo es requerido'); return; }

    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/sanciones`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: parseInt(form.socio_id),
          motivo:   form.motivo.trim(),
          origen:   form.origen,
          gravedad: form.gravedad,
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al crear sanción'); return; }
      onCreada();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const inputStyle  = { width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle  = { fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' };
  const gcfg        = getGravedadConfig(form.gravedad);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
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

          {/* Socio con búsqueda en servidor */}
          <div>
            <label style={labelStyle}>Socio *</label>
            <SocioBuscador
              value={form.socio_id}
              onChange={(val) => setForm(prev => ({ ...prev, socio_id: val }))}
            />
          </div>

          {/* Origen */}
          <div>
            <label style={labelStyle}>Origen *</label>
            <select name="origen" value={form.origen} onChange={handleChange} style={inputStyle}>
              <option value="Administración">Administración</option>
              <option value="Reservaciones">Reservaciones</option>
              <option value="Ludoteca">Ludoteca</option>
              <option value="Torneos">Torneos</option>
            </select>
          </div>

          {/* Nivel de gravedad */}
          <div>
            <label style={labelStyle}>Nivel de gravedad *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              {['Leve', 'Moderada', 'Grave'].map(nivel => {
                const cfg = getGravedadConfig(nivel);
                const activo = form.gravedad === nivel;
                return (
                  <button key={nivel} type="button"
                    onClick={() => setForm(prev => ({ ...prev, gravedad: nivel }))}
                    style={{
                      padding: '8px 4px', border: `2px solid ${activo ? cfg.border : '#e2e8f0'}`,
                      borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px',
                      background: activo ? cfg.bg : 'white',
                      color: activo ? cfg.color : '#94a3b8',
                      transition: 'all 0.15s'
                    }}>
                    {nivel}
                  </button>
                );
              })}
            </div>
            {/* Descripción de la gravedad seleccionada */}
            <div style={{ marginTop: '6px', padding: '6px 10px', background: gcfg.bg, borderRadius: '6px', fontSize: '11px', color: gcfg.color, fontWeight: 600 }}>
              {form.gravedad === 'Leve'     && 'Leve: advertencia, sin restricción de reservas.'}
              {form.gravedad === 'Moderada' && 'Moderada: restricción de reservas por 7 días.'}
              {form.gravedad === 'Grave'    && 'Grave: restricción de reservas por 30 días.'}
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label style={labelStyle}>Motivo *</label>
            <textarea name="motivo" value={form.motivo} onChange={handleChange}
              placeholder="Describe el motivo de la sanción..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} /> {error}
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
            fontSize: '13px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}>
            {cargando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creando...</> : <><Plus size={14} /> Crear Sanción</>}
          </button>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function VistaSanciones() {
  const { showConfirm } = useNotification();
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busqueda, setBusqueda]   = useState('');
  const [filtro, setFiltro]       = useState('todas');
  const [filtroGravedad, setFiltroGravedad] = useState('todas');
  const [showModal, setShowModal]         = useState(false);
  const [sancionEditar, setSancionEditar] = useState(null);

  const fetchSanciones = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/sanciones`, {
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
    if (!await showConfirm('¿Levantar esta sanción? El socio podrá hacer reservas nuevamente.', { confirmLabel: 'Levantar' })) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/sanciones/${id}/levantar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchSanciones();
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchSanciones(); }, []);

  const esActiva   = (s) => s.estado === 'Activa' || s.estado === 'Activo';
  const esResuelta = (s) => s.estado === 'Resuelta' || s.estado === 'Resuelto';

  const activas   = sanciones.filter(esActiva);
  const resueltas = sanciones.filter(esResuelta);
  const graves    = sanciones.filter(s => s.gravedad === 'Grave');

  const filtradas = sanciones
    .filter(s => {
      if (filtro === 'Activa')   return esActiva(s);
      if (filtro === 'Resuelta') return esResuelta(s);
      return true;
    })
    .filter(s => {
      if (filtroGravedad === 'todas') return true;
      return (s.gravedad || 'Leve') === filtroGravedad;
    })
    .filter(s =>
      s.socio_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.motivo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.origen?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.gravedad?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <Loader2 size={32} color="#cbd5e1" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '13px' }}>Cargando sanciones...</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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

      {/* KPIs — Estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {[
          { label: 'Total',     valor: sanciones.length, color: '#3b82f6', icono: <Shield size={16} />,      key: 'todas' },
          { label: 'Activas',   valor: activas.length,   color: '#ef4444', icono: <ShieldX size={16} />,     key: 'Activa' },
          { label: 'Resueltas', valor: resueltas.length, color: '#10b981', icono: <ShieldCheck size={16} />, key: 'Resuelta' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltro(k.key)} style={{
            background: filtro === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '0.9rem 1.1rem',
            border: `1px solid ${filtro === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtro === k.key ? `0 4px 12px ${k.color}40` : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: filtro === k.key ? 'white' : k.color }}>{k.valor}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: filtro === k.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{k.label}</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: filtro === k.key ? 'rgba(255,255,255,0.2)' : `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.cloneElement(k.icono, { color: filtro === k.key ? 'white' : k.color })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* KPIs — Gravedad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Todas gravedades', valor: sanciones.length, key: 'todas',    color: '#64748b' },
          { label: 'Leve',             valor: sanciones.filter(s => (s.gravedad || 'Leve') === 'Leve').length,     key: 'Leve',     color: '#15803d' },
          { label: 'Moderada',         valor: sanciones.filter(s => s.gravedad === 'Moderada').length,  key: 'Moderada', color: '#b45309' },
          { label: 'Grave',            valor: graves.length,    key: 'Grave',    color: '#b91c1c' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltroGravedad(k.key)} style={{
            background: filtroGravedad === k.key ? k.color : 'white',
            borderRadius: '10px', padding: '0.6rem 1rem',
            border: `1px solid ${filtroGravedad === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtroGravedad === k.key ? `0 4px 12px ${k.color}40` : 'none'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: filtroGravedad === k.key ? 'white' : k.color }}>
              {k.label}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: filtroGravedad === k.key ? 'white' : '#1e293b', display: 'block' }}>
              {k.valor}
            </span>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div className="admin-filter-row" style={{ marginBottom: '1.25rem' }}>
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por socio, motivo, origen o gravedad..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <ShieldCheck size={48} color="#94a3b8" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>
            {busqueda ? 'No se encontraron resultados' : filtro === 'Activa' ? 'No hay sanciones activas' : 'Sin sanciones registradas'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtradas.map(s => {
            const activa      = esActiva(s);
            const origenColor = getOrigenColor(s.origen);
            const gcfg        = getGravedadConfig(s.gravedad || 'Leve');

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Badge gravedad */}
                    <span style={{
                      background: gcfg.bg, color: gcfg.color,
                      border: `1px solid ${gcfg.border}`,
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <AlertTriangle size={11} />
                      {gcfg.label}
                    </span>
                    {/* Badge estado */}
                    <span style={{
                      background: activa ? '#fee2e2' : '#dcfce7',
                      color: activa ? '#b91c1c' : '#15803d',
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      {activa ? <ShieldX size={11} /> : <ShieldCheck size={11} />}
                      {s.estado}
                    </span>
                  </div>
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
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} /> {formatFecha(s.fecha)}
                    </span>
                    {s.fecha_resolucion && (
                      <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={11} /> Resuelta: {formatFecha(s.fecha_resolucion)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setSancionEditar(s)} style={{
                      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                      borderRadius: '8px', padding: '5px 14px', fontSize: '12px', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      Editar
                    </button>
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
      {sancionEditar && (
        <ModalEditarSancion
          sancion={sancionEditar}
          onClose={() => setSancionEditar(null)}
          onActualizada={fetchSanciones}
        />
      )}
    </div>
  );
}

export default VistaSanciones;