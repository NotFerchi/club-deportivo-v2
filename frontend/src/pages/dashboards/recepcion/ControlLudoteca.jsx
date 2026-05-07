import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Search, Baby, Clock, Printer, AlertCircle, CheckCircle, LogOut } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcularEdadAnios(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;
  return (new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);
}

function formatHora(ts) {
  if (!ts) return '';
  const fecha = new Date(ts);
  return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function horaLimite(horaEntrada) {
  if (!horaEntrada) return '';
  const d = new Date(horaEntrada);
  d.setHours(d.getHours() + 2);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function getMinutosTranscurridos(nino) {
  const minutosServidor = Number(nino.minutos_transcurridos);
  if (Number.isFinite(minutosServidor)) return Math.max(0, Math.floor(minutosServidor));

  const entrada = new Date(nino.hora_entrada);
  if (Number.isNaN(entrada.getTime())) return 0;
  return Math.max(0, Math.round((new Date() - entrada) / (1000 * 60)));
}

const estiloImpresion = `
  @media print {
    body * { visibility: hidden; }
    #ticket-imprimible, #ticket-imprimible * { visibility: visible; }
    #ticket-imprimible {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 360px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: none;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
  }
`;

// ── Buscador de socios ────────────────────────────────────────────────────────
function BuscadorSocio({ onSelect }) {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const timerRef = useRef(null);

  const buscar = useCallback(async (termino) => {
    if (!termino || termino.length < 2) { setResultados([]); return; }
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/api/recepcion/socios?q=${encodeURIComponent(termino)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setResultados(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch { setResultados([]); }
    finally { setCargando(false); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setMostrar(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(val), 300);
  };

  const handleSelect = (socio) => {
    setQuery(`${socio.numero_socio} — ${socio.nombre_completo}`);
    setResultados([]);
    setMostrar(false);
    onSelect(socio);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input type="text" value={query} onChange={handleChange} onFocus={() => setMostrar(true)}
          placeholder="Buscar padre/tutor por nombre o número de socio..."
          style={{ width: '100%', padding: '10px 10px 10px 34px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
        />
        {cargando && <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8' }}>Buscando...</span>}
      </div>
      {mostrar && resultados.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: '4px', overflow: 'hidden' }}>
          {resultados.map(s => (
            <button key={s.socio_id} onClick={() => handleSelect(s)}
              style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{s.nombre_completo}</span>
              <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '20px' }}>{s.numero_socio}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ticket Modal ──────────────────────────────────────────────────────────────
function TicketModal({ ticket, onClose }) {
  if (!ticket) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <style>{estiloImpresion}</style>
      <div id="ticket-imprimible" style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 60%, #2563eb 100%)', padding: '1.75rem', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>👶</div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.5px' }}>Ticket de Ludoteca</h3>
          <p style={{ margin: '6px 0 0', fontSize: '11px', opacity: 0.6, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Club Social y Deportivo</p>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[{ icon: '👦', label: 'Niño', value: ticket.nombre_hijo }, { icon: '👨', label: 'Padre/Tutor', value: ticket.nombre_padre }].map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{icon} {label}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> Hora de entrada</span>
              <span style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>{formatHora(ticket.hora_entrada)}</span>
            </div>
            <div style={{ height: '1px', background: '#bfdbfe', marginBottom: '10px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> Hora límite</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb', background: 'white', padding: '4px 16px', borderRadius: '20px', boxShadow: '0 2px 8px rgba(37,99,235,0.2)' }}>
                {horaLimite(ticket.hora_entrada)}
              </span>
            </div>
          </div>
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.25rem', fontSize: '11px', color: '#92400e', textAlign: 'center', fontWeight: 600, lineHeight: 1.6 }}>
            ⚠️ Tiempo máximo de estancia: <strong>2 horas</strong><br />Pasado este tiempo se aplicará una sanción.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => window.print()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={15} /> Imprimir
            </button>
            <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Registro Entrada ────────────────────────────────────────────────────
function ModalRegistroEntrada({ onClose, onExito }) {
  const [socioPadre, setSocioPadre] = useState(null);
  const [nombreHijo, setNombreHijo] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [edadInfo, setEdadInfo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const handleFechaCambio = (e) => {
    const val = e.target.value;
    setFechaNac(val);
    const edad = calcularEdadAnios(val);
    if (edad === null) { setEdadInfo(null); return; }
    const anios = Math.floor(edad);
    if (edad < 3 || edad > 7) {
      setEdadInfo({ valida: false, texto: `No cumple la edad permitida (3-7 años). Tiene ${anios} años.` });
    } else {
      setEdadInfo({ valida: true, texto: `Edad válida: ${anios} años` });
    }
  };

  const puedeEnviar = socioPadre && nombreHijo.trim() && fechaNac && edadInfo?.valida;

  const handleSubmit = async () => {
    if (!puedeEnviar) return;
    setError(null);
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/ludoteca/entrada', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_padre_id: socioPadre.socio_id, nombre_hijo: nombreHijo.trim(), fecha_nacimiento: fechaNac })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al registrar entrada'); return; }
      onExito({
        nombre_hijo: data.registro.nombre_hijo,
        nombre_padre: socioPadre.nombre_completo,
        hora_entrada: data.registro.hora_entrada_local || data.registro.hora_entrada
      });
    } catch { setError('Error de conexión con el servidor'); }
    finally { setCargando(false); }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>Registrar Entrada</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Completa los datos del niño</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '8px', padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Padre / Tutor *</label>
            <BuscadorSocio onSelect={setSocioPadre} />
            {socioPadre && (
              <div style={{ marginTop: '6px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', fontSize: '12px', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={13} /> {socioPadre.nombre_completo} — {socioPadre.numero_socio}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Nombre del niño *</label>
            <input type="text" value={nombreHijo} onChange={e => setNombreHijo(e.target.value)} placeholder="Nombre completo del niño" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Fecha de nacimiento *</label>
            <input type="date" value={fechaNac} onChange={handleFechaCambio} style={inputStyle} />
            {edadInfo && (
              <div style={{ marginTop: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: edadInfo.valida ? '#f0fdf4' : '#fef2f2', border: `1px solid ${edadInfo.valida ? '#86efac' : '#fca5a5'}`, color: edadInfo.valida ? '#15803d' : '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {edadInfo.valida ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {edadInfo.texto}
              </div>
            )}
          </div>
          {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>⚠ {error}</div>}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!puedeEnviar || cargando} style={{ flex: 2, background: puedeEnviar && !cargando ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : '#cbd5e1', color: puedeEnviar ? 'white' : '#94a3b8', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: puedeEnviar && !cargando ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {cargando ? '⏳ Registrando...' : '✓ Registrar Entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de niño ───────────────────────────────────────────────────────────
function NinoCard({ nino, onSalida }) {
  const horaEntrada = nino.hora_entrada_local || nino.hora_entrada;
  const minutosTranscurridos = getMinutosTranscurridos(nino);
  const porcentaje = Math.min((minutosTranscurridos / 120) * 100, 100);
  const casiLimite = minutosTranscurridos > 100 && minutosTranscurridos <= 120;
  const excedido = minutosTranscurridos > 120;

  const color = excedido
    ? { bar: 'linear-gradient(90deg,#ef4444,#f87171)', bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', badgeBg: '#fee2e2', btn: 'linear-gradient(135deg,#dc2626,#ef4444)' }
    : casiLimite
    ? { bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)', bg: '#fefce8', border: '#fde68a', badge: '#b45309', badgeBg: '#fef3c7', btn: 'linear-gradient(135deg,#0f172a,#1e293b)' }
    : { bar: 'linear-gradient(90deg,#2563eb,#38bdf8)', bg: 'white', border: '#e2e8f0', badge: '#2563eb', badgeBg: '#dbeafe', btn: 'linear-gradient(135deg,#0f172a,#1e293b)' };

  const inicial = (nino.nombre_hijo || nino.nombre_nino || '?')[0].toUpperCase();

  return (
    <div style={{ background: color.bg, border: `1.5px solid ${color.border}`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
      {/* Barra de progreso superior */}
      <div style={{ height: '5px', background: '#f1f5f9' }}>
        <div style={{ height: '100%', width: `${porcentaje}%`, background: color.bar, borderRadius: '99px', transition: 'width 0.4s' }} />
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Avatar + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: color.bar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 900, color: 'white', flexShrink: 0 }}>
            {inicial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nino.nombre_hijo || nino.nombre_nino}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              👨 {nino.tutor_nombre || `${nino.nombres || ''} ${nino.apellido_paterno || ''}`.trim() || 'Sin tutor'}
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: color.badge, background: color.badgeBg, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {excedido ? '⚠ Excedido' : casiLimite ? '⏰ Por vencer' : '✓ Activo'}
          </span>
        </div>

        {/* Info tiempo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
          <span>🕐 Entrada: <strong>{formatHora(horaEntrada)}</strong></span>
          <span style={{ fontWeight: excedido ? 800 : 600, color: excedido ? '#dc2626' : '#475569' }}>
            {minutosTranscurridos} / 120 min
          </span>
        </div>

        {/* Barra secundaria visual */}
        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.85rem' }}>
          <div style={{ height: '100%', width: `${porcentaje}%`, background: color.bar, borderRadius: '99px' }} />
        </div>

        {/* Botón salida */}
        <button onClick={() => onSalida(nino.registro_id)} style={{ width: '100%', padding: '8px', background: color.btn, color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          {excedido ? '⚠ Registrar Salida (excedido)' : '→ Registrar Salida'}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function ControlLudoteca() {
  const [ninos, setNinos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEntrada, setShowEntrada] = useState(false);
  const [ticket, setTicket] = useState(null);

  const fetchNinos = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/ludoteca/activos', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setNinos(Array.isArray(data) ? data : []);
    } catch { setNinos([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNinos(); }, []);

  const handleSalida = async (registroId) => {
    if (!window.confirm('¿Registrar salida de este niño?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/ludoteca/salida/${registroId}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Error al registrar salida'); return; }
      if (data.sancion_generada) alert(`⚠️ Salida registrada. Se generó una sanción al padre por exceso de tiempo (${data.duracion_minutos} min).`);
      fetchNinos();
    } catch { alert('Error de conexión'); }
  };

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      ⏳ Cargando ludoteca...
    </div>
  );

  const excedidos  = ninos.filter(n => getMinutosTranscurridos(n) > 120).length;
  const porVencer  = ninos.filter(n => { const m = getMinutosTranscurridos(n); return m >= 90 && m <= 120; }).length;

  return (
    <div className="chart-box">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>Control de Ludoteca</h4>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Rango de edad: 3–7 años · Límite: 2 horas</p>
        </div>
        <button onClick={() => setShowEntrada(true)} style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}>
          <Baby size={15} /> + Registrar Entrada
        </button>
      </div>

      {/* KPIs rápidos */}
      {ninos.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'En ludoteca', value: ninos.length, color: '#2563eb', bg: '#dbeafe' },
            { label: 'Por vencer',  value: porVencer,    color: '#b45309', bg: '#fef3c7' },
            { label: 'Excedidos',   value: excedidos,    color: '#dc2626', bg: '#fee2e2' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 900, color }}>{value}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista */}
      {ninos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#f8fafc', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '40px', marginBottom: '0.75rem' }}>👶</div>
          <p style={{ color: '#475569', margin: 0, fontWeight: 700, fontSize: '14px' }}>No hay niños en ludoteca</p>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '12px' }}>Registra una entrada para comenzar</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
          {ninos.map(nino => (
            <NinoCard key={nino.registro_id} nino={nino} onSalida={handleSalida} />
          ))}
        </div>
      )}

      {showEntrada && <ModalRegistroEntrada onClose={() => setShowEntrada(false)} onExito={(t) => { setShowEntrada(false); setTicket(t); fetchNinos(); }} />}
      {ticket && <TicketModal ticket={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

export default ControlLudoteca;
