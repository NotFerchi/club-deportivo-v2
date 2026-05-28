import { useNotification } from '../../../context/NotificationContext';
import React, { useEffect, useRef, useState } from 'react';
import { Clock, Users, ChevronDown, ChevronUp, Check, X, MapPin, Calendar, Loader2, CalendarX, ClipboardList, Search, UserPlus, UserMinus, QrCode, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../../../services/api';
function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function formatFecha(iso) {
  const [y, m, d] = iso.split('-');
  const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const COLORES_DISCIPLINA = {
  'Natación':   '#0369a1',
  'Tenis':      '#15803d',
  'Pádel':      '#b45309',
  'Yoga':       '#6d28d9',
  'Pilates':    '#9d174d',
  'Spinning':   '#b91c1c',
  'Zumba':      '#854d0e',
  'Baile':      '#166534',
  'Aerobics':   '#c2410c',
};

const GRAD_DISCIPLINA = {
  'Natación':   'linear-gradient(135deg,#0369a1,#0ea5e9)',
  'Tenis':      'linear-gradient(135deg,#15803d,#22c55e)',
  'Pádel':      'linear-gradient(135deg,#b45309,#f59e0b)',
  'Yoga':       'linear-gradient(135deg,#6d28d9,#8b5cf6)',
  'Pilates':    'linear-gradient(135deg,#9d174d,#ec4899)',
  'Spinning':   'linear-gradient(135deg,#b91c1c,#ef4444)',
  'Zumba':      'linear-gradient(135deg,#854d0e,#eab308)',
  'Baile':      'linear-gradient(135deg,#166534,#4ade80)',
  'Aerobics':   'linear-gradient(135deg,#c2410c,#f97316)',
};

function getColorDisciplina(nombre) {
  return COLORES_DISCIPLINA[nombre] || '#475569';
}
function getGradDisciplina(nombre) {
  return GRAD_DISCIPLINA[nombre] || 'linear-gradient(135deg,#475569,#94a3b8)';
}

// ── Modal QR ──────────────────────────────────────────────────────────────────
function ModalQR({ sesion, onClose, onRegistrado }) {
  const [resultado, setResultado] = useState(null);
  const [error, setError]         = useState(null);
  const [cargando, setCargando]   = useState(false);
  const scannerRef                = useRef(null);

  useEffect(() => {
    let scanner;
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      }, false);

      scanner.render(async (decodedText) => {
        if (cargando || resultado) return;
        scanner.clear();
        setCargando(true);
        setError(null);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/sesiones/${sesion.sesion_id}/asistencia-qr`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_qr: decodedText, fecha: sesion.fecha })
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error || 'Error al registrar'); return; }
          setResultado(data);
          onRegistrado && onRegistrado();
        } catch { setError('Error de conexión'); }
        finally { setCargando(false); }
      }, () => { /* ignorar errores de escaneo continuos */ });

      scannerRef.current = scanner;
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Escanear QR</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>{sesion.disciplina} · {formatHora(sesion.hora_inicio)}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '7px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        {resultado ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <CheckCircle size={28} color="#16a34a" />
            </div>
            <p style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', margin: 0 }}>{resultado.nombre}</p>
            <p style={{ fontSize: '12px', color: '#15803d', margin: '4px 0 1rem', fontWeight: 600 }}>
              {resultado.inscrito_ahora
                ? '✅ Inscrito y asistencia registrada'
                : '✅ Asistencia registrada correctamente'}
            </p>
            <button onClick={onClose} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {cargando ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Loader2 size={32} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                <p style={{ color: '#64748b', marginTop: '0.75rem', fontSize: '13px' }}>Registrando asistencia...</p>
              </div>
            ) : (
              <div id="qr-reader" style={{ width: '100%' }} />
            )}
            {error && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600, margin: '0.75rem 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}
            <button onClick={onClose} style={{ marginTop: '0.75rem', width: '100%', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal Agregar ─────────────────────────────────────────────────────────────
function ModalAgregarSocio({ sesion, fecha, onClose, onAgregado }) {
  const [tab, setTab]               = useState('socio');
  const [query, setQuery]           = useState('');
  const [resultados, setResultados] = useState([]);
  const [visitas, setVisitas]       = useState([]);
  const [buscando, setBuscando]     = useState(false);
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState(null);
  const timerRef                    = useRef(null);

  useEffect(() => {
    if (tab !== 'visita') return;
    const fetchVisitas = async () => {
      setBuscando(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/recepcion/visitas?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setVisitas(Array.isArray(data) ? data.filter(v => v.vigente) : []);
      } catch { setVisitas([]); }
      finally { setBuscando(false); }
    };
    fetchVisitas();
  }, [tab, fecha]);

  const buscar = async (termino) => {
    if (!termino || termino.length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/recepcion/socios?q=${encodeURIComponent(termino)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResultados(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch { setResultados([]); }
    finally { setBuscando(false); }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(val), 300);
  };

  const handleAgregar = async (socio_id, visita_id = null) => {
    setError(null);
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const body = visita_id
        ? { sesion_id: sesion.sesion_id, visita_id, fecha }
        : { sesion_id: sesion.sesion_id, socio_id, fecha };
      const res = await fetch(`${API_BASE_URL}/instructor/clases/inscribir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al registrar'); return; }
      onAgregado();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const tabStyle = (t) => ({
    flex: 1, padding: '8px', border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '12px', borderRadius: '7px',
    background: tab === t ? 'white' : 'transparent',
    color: tab === t ? '#1e293b' : '#64748b',
    boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', width: '100%', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

        {/* Header modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Agregar al pase de lista</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>{sesion.disciplina} · {formatHora(sesion.hora_inicio)}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', padding: '7px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', marginBottom: '0.75rem' }}>
          <button style={tabStyle('socio')}  onClick={() => { setTab('socio');  setError(null); }}>Socios</button>
          <button style={tabStyle('visita')} onClick={() => { setTab('visita'); setError(null); }}>Visitas del día</button>
        </div>

        {/* Buscador socios */}
        {tab === 'socio' && (
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input type="text" value={query} onChange={handleChange} autoFocus
              placeholder="Buscar socio por nombre o número..."
              style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border 0.2s' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
            {buscando && <Loader2 size={13} color="#94a3b8" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />}
            <style>{`@keyframes spin{from{transform:translateY(-50%) rotate(0deg)}to{transform:translateY(-50%) rotate(360deg)}}`}</style>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', fontSize: '12px', color: '#dc2626', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {tab === 'socio' && (
            <>
              {resultados.length === 0 && query.length >= 2 && !buscando && (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '1.5rem 0' }}>Sin resultados para "{query}"</p>
              )}
              {resultados.length === 0 && query.length < 2 && (
                <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '12px', padding: '1.5rem 0' }}>Escribe al menos 2 caracteres para buscar</p>
              )}
              {resultados.map(s => (
                <div key={s.socio_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                      {iniciales(s.nombre_completo)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{s.nombre_completo}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.numero_socio}</div>
                    </div>
                  </div>
                  <button onClick={() => handleAgregar(s.socio_id)} disabled={cargando}
                    style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 14px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer' }}>
                    {cargando ? '...' : '+ Agregar'}
                  </button>
                </div>
              ))}
            </>
          )}

          {tab === 'visita' && (
            <>
              {buscando && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Loader2 size={16} style={{ animation: 'spin2 1s linear infinite' }} />
                  <style>{`@keyframes spin2{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                  Cargando visitas...
                </div>
              )}
              {!buscando && visitas.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                  <Users size={28} color="#e2e8f0" style={{ marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>No hay visitas activas hoy</p>
                </div>
              )}
              {visitas.map(v => (
                <div key={v.visita_id || v.pase_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                      {iniciales(v.nombre_completo || v.nombre_visitante)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{v.nombre_completo || v.nombre_visitante}</div>
                      <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>Visita del día</div>
                    </div>
                  </div>
                  <button onClick={() => handleAgregar(null, v.visita_id || v.pase_id)} disabled={cargando}
                    style={{ background: cargando ? '#94a3b8' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 14px', fontSize: '12px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer' }}>
                    {cargando ? '...' : '+ Agregar'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <button onClick={onClose} style={{ marginTop: '1rem', width: '100%', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Fila de alumno ────────────────────────────────────────────────────────────
function AlumnoRow({ alumno, fecha, sesionId, onEstadoChange }) {
  const { showConfirm } = useNotification();
  const [estado, setEstado]   = useState(alumno.asistio === true ? 'presente' : alumno.asistio === false ? 'ausente' : null);
  const [cargando, setCargando] = useState(false);

  const registrar = async (presente) => {
    if (cargando) return;
    const nuevoEstado = presente ? 'presente' : 'ausente';
    const estadoFinal = estado === nuevoEstado ? null : nuevoEstado;
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/instructor/asistencia`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesionId, socioId: alumno.socio_id, fecha, presente: estadoFinal === 'presente' })
      });
      setEstado(estadoFinal);
      onEstadoChange && onEstadoChange(alumno.socio_id, estadoFinal);
    } catch (err) { console.error(err); }
    finally { setCargando(false); }
  };

  const esVisita = alumno.tipo === 'Visita';
  const bgRow    = estado === 'presente' ? '#f0fdf4' : estado === 'ausente' ? '#fef2f2' : 'white';
  const gradAvatar = esVisita
    ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : estado === 'presente'
      ? 'linear-gradient(135deg,#10b981,#059669)'
      : estado === 'ausente'
        ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
        : 'linear-gradient(135deg,#3b82f6,#1d4ed8)';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1.25rem', borderBottom: '1px solid #f1f5f9', background: bgRow, transition: 'background 0.2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: gradAvatar, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '11px', transition: 'background 0.3s' }}>
          {iniciales(alumno.nombre_socio)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{alumno.nombre_socio}</div>
          <div style={{ fontSize: '11px', color: esVisita ? '#f59e0b' : '#94a3b8', fontWeight: esVisita ? 700 : 400 }}>{esVisita ? 'Visita' : 'Socio'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {estado && (
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: estado === 'presente' ? '#dcfce7' : '#fee2e2', color: estado === 'presente' ? '#15803d' : '#dc2626' }}>
            {estado === 'presente' ? '✓ Presente' : '✗ No-Show'}
          </span>
        )}
        {/* Quitar */}
        <button onClick={async () => {
          if (!await showConfirm(`¿Quitar a ${alumno.nombre_socio} de esta clase?`)) return;
          try {
            const token = localStorage.getItem('token');
            if (alumno.inscripcion_id) {
              await fetch(`${API_BASE_URL}/inscripciones/cancelar`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sesionId, socioId: alumno.socio_id })
              });
            } else {
              await fetch(`${API_BASE_URL}/reservas/${alumno.reserva_id}/cancelar`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo: 'Cancelado por instructor' })
              });
            }
            onEstadoChange && onEstadoChange(alumno.socio_id, 'quitado');
          } catch (err) { console.error(err); }
        }} title="Quitar de la clase" style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserMinus size={13} />
        </button>
        {/* Presente */}
        <button onClick={() => registrar(true)} disabled={cargando} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: estado === 'presente' ? '#10b981' : '#e2e8f0', color: estado === 'presente' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: estado === 'presente' ? '0 2px 8px rgba(16,185,129,0.4)' : 'none' }}>
          <Check size={13} strokeWidth={3} />
        </button>
        {/* Ausente */}
        <button onClick={() => registrar(false)} disabled={cargando} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: estado === 'ausente' ? '#ef4444' : '#e2e8f0', color: estado === 'ausente' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: estado === 'ausente' ? '0 2px 8px rgba(239,68,68,0.4)' : 'none' }}>
          <X size={13} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

// ── Card de clase ─────────────────────────────────────────────────────────────
function ClaseCard({ clase, fecha }) {
  const [expandida, setExpandida]       = useState(false);
  const [alumnos, setAlumnos]           = useState([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [yaCargo, setYaCargo]           = useState(false);
  const [estados, setEstados]           = useState({});
  const [showAgregar, setShowAgregar] = useState(false);
  const [showQR, setShowQR]           = useState(false);

  const cargarAlumnos = async (force = false) => {
    if (!force && yaCargo) return;
    setLoadingAlumnos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/instructor/clases/${clase.sesion_id}/alumnos?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setAlumnos(data);
      const estadosIniciales = {};
      data.forEach(a => { estadosIniciales[a.socio_id] = a.asistio === true ? 'presente' : a.asistio === false ? 'ausente' : null; });
      setEstados(estadosIniciales);
      setYaCargo(true);
    } catch (err) { console.error(err); }
    finally { setLoadingAlumnos(false); }
  };

  const handleToggle = () => {
    const nuevo = !expandida;
    setExpandida(nuevo);
    if (nuevo) cargarAlumnos();
  };

  const presentes    = Object.values(estados).filter(e => e === 'presente').length;
  const ausentes     = Object.values(estados).filter(e => e === 'ausente').length;
  const sinRegistrar = Object.values(estados).filter(e => e === null).length;
  const cupoActual   = parseInt(clase.cupo_actual) || 0;
  const cupoMax      = parseInt(clase.cupo_maximo) || 1;
  const pct          = Math.min(100, Math.round((cupoActual / cupoMax) * 100));
  const colorDisc    = getColorDisciplina(clase.disciplina);
  const gradDisc     = getGradDisciplina(clase.disciplina);
  const _hoy = new Date();
  const _hoyLocal = `${_hoy.getFullYear()}-${String(_hoy.getMonth()+1).padStart(2,'0')}-${String(_hoy.getDate()).padStart(2,'0')}`;
  const esHoy        = fecha === _hoyLocal;

  return (
    <div style={{ background: 'white', borderRadius: '18px', border: '1.5px solid #e2e8f0', overflow: 'hidden', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
    >
      {/* Header con gradiente */}
      <div onClick={handleToggle} style={{ background: gradDisc, padding: '1rem 1.25rem', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
        {/* Decoración */}
        <div style={{ position: 'absolute', top: -15, right: -15, width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -10, right: 40, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Clock size={20} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '15px', color: 'white', letterSpacing: '-0.3px' }}>{clase.disciplina}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><MapPin size={10} /> {clase.espacio}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{cupoActual}/{cupoMax}</div>
              <div style={{ width: 50, background: 'rgba(255,255,255,0.2)', borderRadius: '4px', height: '4px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'white', borderRadius: '4px', opacity: 0.9 }} />
              </div>
            </div>
            {expandida ? <ChevronUp size={16} color="rgba(255,255,255,0.8)" /> : <ChevronDown size={16} color="rgba(255,255,255,0.8)" />}
          </div>
        </div>
      </div>

      {/* Pase de lista */}
      {expandida && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>

          {/* Barra de acciones */}
          <div style={{ padding: '0.6rem 1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
              Pase de Lista Digital
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {alumnos.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '11px' }}>
                  <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>✓ {presentes}</span>
                  <span style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>✗ {ausentes}</span>
                  {sinRegistrar > 0 && <span style={{ background: '#f1f5f9', color: '#94a3b8', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>— {sinRegistrar}</span>}
                </div>
              )}
              {esHoy && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setShowQR(true)} style={{ background: 'linear-gradient(135deg,#6d28d9,#8b5cf6)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <QrCode size={12} /> QR
                  </button>
                  <button onClick={() => setShowAgregar(true)} style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}>
                    <UserPlus size={12} /> Agregar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Lista */}
          {loadingAlumnos ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '13px' }}>
              <Loader2 size={16} style={{ animation: 'spin3 1s linear infinite' }} />
              <style>{`@keyframes spin3{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              Cargando alumnos...
            </div>
          ) : alumnos.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                <ClipboardList size={22} color="#94a3b8" />
              </div>
              <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '13px' }}>Sin alumnos inscritos</p>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>
                {esHoy ? 'Usa el botón Agregar para inscribir alumnos' : 'No hay registros para esta fecha'}
              </p>
            </div>
          ) : (
            alumnos.map((alumno) => (
              <AlumnoRow
                key={alumno.inscripcion_id ? `ic-${alumno.inscripcion_id}` : alumno.reserva_id || alumno.socio_id}
                alumno={alumno}
                fecha={fecha}
                sesionId={clase.sesion_id}
                onEstadoChange={(socioId, estado) => {
                  if (estado === 'quitado') {
                    setAlumnos(prev => prev.filter(a => a.socio_id !== socioId));
                    setEstados(prev => { const n = { ...prev }; delete n[socioId]; return n; });
                  } else {
                    setEstados(prev => ({ ...prev, [socioId]: estado }));
                  }
                }}
              />
            ))
          )}

          {/* Footer resumen */}
          {alumnos.length > 0 && (
            <div style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '0.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '3px', marginRight: '0.5rem' }}>
                {alumnos.map((a, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: estados[a.socio_id] === 'presente' ? '#10b981' : estados[a.socio_id] === 'ausente' ? '#ef4444' : '#e2e8f0' }} />
                ))}
              </div>
              <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 700 }}>✓ {presentes} presentes</span>
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>✗ {ausentes} no-shows</span>
              {sinRegistrar > 0 && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{sinRegistrar} sin registrar</span>}
            </div>
          )}
        </div>
      )}

      {showQR && (
        <ModalQR
          sesion={{ ...clase, fecha }}
          onClose={() => setShowQR(false)}
          onRegistrado={() => { setYaCargo(false); cargarAlumnos(true); }}
        />
      )}

      {showAgregar && (
        <ModalAgregarSocio
          sesion={clase} fecha={fecha}
          onClose={() => setShowAgregar(false)}
          onAgregado={() => { setYaCargo(false); cargarAlumnos(true); }}
        />
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function AgendaDia() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const _hoyD = new Date();
  const esHoy = fecha === `${_hoyD.getFullYear()}-${String(_hoyD.getMonth()+1).padStart(2,'0')}-${String(_hoyD.getDate()).padStart(2,'0')}`;

  useEffect(() => {
    const fetchClases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/instructor/clases?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setClases(data);
      } catch (err) { console.error('Error:', err); }
      finally { setLoading(false); }
    };
    fetchClases();
  }, [fecha]);

  const totalInscritos = clases.reduce((acc, c) => acc + (parseInt(c.cupo_actual) || 0), 0);

  return (
    <div>
      {/* ── Header hero ── */}
      <div style={{ background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)', borderRadius: '18px', padding: '1.25rem 1.75rem', marginBottom: '1.25rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={22} color="white" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Agenda del Día</h4>
            <p style={{ margin: '3px 0 0', opacity: 0.7, fontSize: '12px', textTransform: 'capitalize' }}>{formatFecha(fecha)}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {!loading && (
            <>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{clases.length}</div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>Clases</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{totalInscritos}</div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>Inscritos</div>
              </div>
            </>
          )}
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.3)', fontSize: '13px', color: 'white', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', outline: 'none', backdropFilter: 'blur(4px)' }}
          />
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <Loader2 size={28} color="#cbd5e1" style={{ animation: 'spin4 1s linear infinite' }} />
          <style>{`@keyframes spin4{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <span style={{ fontSize: '13px' }}>Cargando agenda...</span>
        </div>
      ) : clases.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <CalendarX size={26} color="#94a3b8" />
          </div>
          <p style={{ color: '#475569', margin: 0, fontWeight: 700, fontSize: '14px' }}>Sin clases para este día</p>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>Prueba seleccionando otra fecha</p>
        </div>
      ) : (
        <>
          {esHoy && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px' }}>
                {clases.length} clase{clases.length !== 1 ? 's' : ''} programadas
              </span>
              <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={11} /> {totalInscritos} alumnos inscritos
              </span>
            </div>
          )}
          {clases.map(clase => (
            <ClaseCard key={clase.sesion_id} clase={clase} fecha={fecha} />
          ))}
        </>
      )}
    </div>
  );
}

export default AgendaDia;