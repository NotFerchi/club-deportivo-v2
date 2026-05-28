import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  X, Search, Baby, Clock, Printer, AlertCircle, CheckCircle,
  LogOut, User, Users, History, ChevronDown, ChevronUp, Loader2, AlertTriangle, Eye, Plus
} from 'lucide-react';
import { adminApi, apiRequest, unwrapList } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { ErrorState, FilterSelect, LoadingState, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { formatDateTime, normalizeText } from '../../../utils/adminData';

const LUDOTECA_MAX_MIN = 120;
const MX_TZ = 'America/Mexico_City';

const initialFormData = {
  socio_padre_id: '',
  nombre_hijo: '',
  fecha_nacimiento: '',
  observaciones: ''
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// Calcula la edad exacta del niño en años
function calcularEdadAnios(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento.getTime())) return null;
  return (new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25);
}

// Extrae "H:MM a. m./p. m." del string ISO local "YYYY-MM-DDTHH:MM:SS" (ya es hora México)
function formatHoraLocal(ts) {
  if (!ts) return '-';
  const match = String(ts).match(/T(\d{2}):(\d{2}):?(\d{2})?/);
  if (!match) return String(ts).slice(0, 5);
  const h = parseInt(match[1], 10);
  const m = match[2];
  const sec = match[3] ? `:${match[3]}` : '';
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m}${sec} ${suffix}`;
}

// Extrae "D/M/YYYY, H:MM a. m./p. m." del string ISO local
function formatFechaHoraLocal(ts) {
  if (!ts) return '-';
  const s = String(ts);
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return s;
  const [, y, mo, d, h, mi] = match;
  const hn = parseInt(h, 10);
  const suffix = hn >= 12 ? 'p. m.' : 'a. m.';
  const h12 = hn === 0 ? 12 : hn > 12 ? hn - 12 : hn;
  return `${parseInt(d, 10)}/${parseInt(mo, 10)}/${y}, ${h12}:${mi} ${suffix}`;
}

function formatHora(ts) {
  if (!ts) return '';
  const fecha = new Date(ts);
  return fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: MX_TZ });
}

function formatFechaHora(ts) {
  if (!ts) return '—';
  const fecha = new Date(ts);
  return fecha.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: MX_TZ });
}

function horaLimite(horaEntrada) {
  if (!horaEntrada) return '';
  const d = new Date(new Date(horaEntrada).getTime() + 2 * 60 * 60 * 1000);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: MX_TZ });
}

function getMinutosTranscurridos(nino) {
  const minutosServidor = Number(nino.minutos_transcurridos);
  if (Number.isFinite(minutosServidor)) return Math.max(0, Math.floor(minutosServidor));
  const entrada = new Date(nino.hora_entrada);
  if (isNaN(entrada.getTime())) return 0;
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
  const [query, setQuery]           = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [mostrar, setMostrar]       = useState(false);
  const timerRef                    = useRef(null);

  const buscar = useCallback(async (termino) => {
    if (!termino || termino.length < 2) { setResultados([]); return; }
    setCargando(true);
    try {
      const data = await apiRequest(`/recepcion/socios?q=${encodeURIComponent(termino)}`);
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
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setMostrar(true)}
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
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '22px', fontWeight: 900, letterSpacing: '-1px' }}>
            {(ticket.nombre_hijo || '?')[0].toUpperCase()}
          </div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.5px' }}>Ticket de Ludoteca</h3>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.85)', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>Club Social y Deportivo</p>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { icono: <Baby size={13} color="#3b82f6" />,  label: 'Niño',        value: ticket.nombre_hijo },
              { icono: <User size={13} color="#3b82f6" />,  label: 'Padre/Tutor', value: ticket.nombre_padre },
            ].map(({ icono, label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>{icono} {label}</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{value}</span>
              </div>
            ))}
            {ticket.observaciones && (
              <div style={{ padding: '10px 14px', background: '#fefce8', borderRadius: '10px', border: '1px solid #fde68a' }}>
                <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Observaciones</span>
                <span style={{ fontSize: '12px', color: '#78350f' }}>{ticket.observaciones}</span>
              </div>
            )}
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

          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.25rem', fontSize: '11px', color: '#92400e', textAlign: 'center', fontWeight: 600, lineHeight: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <AlertTriangle size={13} color="#b45309" />
            Tiempo máximo de estancia: <strong>2 horas</strong>. Pasado este tiempo se aplicará una sanción.
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
  const { toast, showConfirm } = useNotification();
  const [socioPadre, setSocioPadre]         = useState(null);
  const [nombreHijo, setNombreHijo]         = useState('');
  const [fechaNac, setFechaNac]             = useState('');
  const [observaciones, setObservaciones]   = useState('');
  const [edadInfo, setEdadInfo]             = useState(null);
  const [cargando, setCargando]             = useState(false);
  const [error, setError]                   = useState(null);

  const handleFechaCambio = (e) => {
    const val = e.target.value;
    setFechaNac(val);
    const edad = calcularEdadAnios(val);
    if (edad === null) { setEdadInfo(null); return; }
    const anios = Math.floor(edad);
    if (edad < 3 || edad > 7) {
      setEdadInfo({ valida: false, texto: `No cumple la edad permitida (3–7 años). Tiene ${anios} años.` });
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
      const data = await apiRequest('/ludoteca/entrada', {
        method: 'POST',
        body: JSON.stringify({
          socio_padre_id:   socioPadre.socio_id,
          nombre_hijo:      nombreHijo.trim(),
          fecha_nacimiento: fechaNac,
          observaciones:    observaciones.trim() || null,
        })
      });

      if (typeof onExito === 'function') {
        onExito({
          nombre_hijo:   data.registro?.nombre_hijo || nombreHijo.trim(),
          nombre_padre:  socioPadre.nombre_completo,
          hora_entrada:  data.registro?.hora_entrada_local || data.registro?.hora_entrada,
          observaciones: observaciones.trim() || null,
        });
      }

      // Notificación de éxito adaptativa
      toast('Entrada registrada correctamente', 'success');
    } catch (error) {
      setError(error.message || 'Error al registrar entrada');
      toast(error.message || 'Error al registrar entrada', 'error');
    } refinement: {
      setCargando(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
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

          <div>
            <label style={labelStyle}>Observaciones <span style={{ fontWeight: 400, color: '#94a3b8' }}>(opcional)</span></label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Alergias, condiciones especiales, notas relevantes..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
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
          <button
            onClick={handleSubmit}
            disabled={!puedeEnviar || cargando}
            style={{ flex: 2, background: puedeEnviar && !cargando ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : '#cbd5e1', color: puedeEnviar ? 'white' : '#94a3b8', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: puedeEnviar && !cargando ? 'pointer' : 'not-allowed', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {cargando
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Registrando...</>
              : <><CheckCircle size={14} /> Registrar Entrada</>
            }
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de niño ───────────────────────────────────────────────────────────
function NinoCard({ nino, onSalida }) {
  const horaEntrada          = nino.hora_entrada_local || nino.hora_entrada;
  const minutosTranscurridos = getMinutosTranscurridos(nino);
  const porcentaje           = Math.min((minutosTranscurridos / 120) * 100, 100);
  const casiLimite           = minutosTranscurridos > 100 && minutosTranscurridos <= 120;
  const excedido             = minutosTranscurridos > 120;

  const color = excedido
    ? { bar: 'linear-gradient(90deg,#ef4444,#f87171)', bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626', badgeBg: '#fee2e2', btn: 'linear-gradient(135deg,#dc2626,#ef4444)' }
    : casiLimite
    ? { bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)', bg: '#fefce8', border: '#fde68a', badge: '#b45309', badgeBg: '#fef3c7', btn: 'linear-gradient(135deg,#0f172a,#1e293b)' }
    : { bar: 'linear-gradient(90deg,#2563eb,#38bdf8)', bg: 'white', border: '#e2e8f0', badge: '#2563eb', badgeBg: '#dbeafe', btn: 'linear-gradient(135deg,#0f172a,#1e293b)' };

  const inicial = (nino.nombre_hijo || nino.nombre_nino || '?')[0].toUpperCase();

  return (
    <div style={{ background: color.bg, border: `1.5px solid ${color.border}`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
      <div style={{ height: '5px', background: '#f1f5f9' }}>
        <div style={{ height: '100%', width: `${porcentaje}%`, background: color.bar, borderRadius: '99px', transition: 'width 0.4s' }} />
      </div>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: color.bar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 900, color: 'white', flexShrink: 0 }}>
            {inicial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nino.nombre_hijo || nino.nombre_nino}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <User size={10} color="#94a3b8" />
              {nino.tutor_nombre || nino.socio_nombre || `${nino.nombres || ''} ${nino.apellido_paterno || ''}`.trim() || 'Sin tutor'}
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: color.badge, background: color.badgeBg, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {excedido ? 'Excedido' : casiLimite ? 'Por vencer' : 'Activo'}
          </span>
        </div>

        {nino.observaciones && (
          <div style={{ marginBottom: '0.6rem', padding: '6px 10px', background: '#fefce8', borderRadius: '8px', fontSize: '11px', color: '#92400e', border: '1px solid #fde68a' }}>
            <strong>Obs:</strong> {nino.observaciones}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={10} /> Entrada: <strong>{formatHora(horaEntrada)}</strong></span>
          <span style={{ fontWeight: excedido ? 800 : 600, color: excedido ? '#dc2626' : '#475569' }}>
            {minutosTranscurridos} / 120 min
          </span>
        </div>

        <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.85rem' }}>
          <div style={{ height: '100%', width: `${porcentaje}%`, background: color.bar, borderRadius: '99px' }} />
        </div>

        <button onClick={() => onSalida(nino.registro_id)} style={{ width: '100%', padding: '8px', background: color.btn, color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <LogOut size={13} /> {excedido ? 'Registrar Salida (excedido)' : 'Registrar Salida'}
        </button>
      </div>
    </div>
  );
}

// ── Sección Historial ─────────────────────────────────────────────────────────
function SeccionHistorial() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [abierto, setAbierto]     = useState(false);
  const [busqueda, setBusqueda]   = useState('');
  const [detalle, setDetalle]     = useState(null);

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/ludoteca/historial?dias=7');
      const lista = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setHistorial(lista);
    } catch { setHistorial([]); }
    finally { setLoading(false); }
  };

  const toggleAbierto = () => {
    if (!abierto && historial.length === 0) fetchHistorial();
    setAbierto(v => !v);
  };

  const filtrados = historial.filter(r => {
    const texto = `${r.nombre_hijo || ''} ${r.nombre_nino || ''} ${r.tutor_nombre || ''} ${r.socio_nombre || ''} ${r.nombres || ''} ${r.apellido_paterno || ''}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
      <button onClick={toggleAbierto} style={{ width: '100%', padding: '0.9rem 1.25rem', background: abierto ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <History size={15} color="#6d28d9" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>Historial de los últimos 7 días</span>
          {historial.length > 0 && (
            <span style={{ background: '#6d28d9', color: 'white', fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px' }}>{historial.length}</span>
          )}
        </div>
        {abierto ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </button>

      {abierto && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar por nombre de niño o tutor..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 28px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Loader2 size={18} color="#cbd5e1" style={{ animation: 'spin 1s linear infinite' }} />
              Cargando historial...
            </div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
              {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin registros en los últimos 7 días'}
            </div>
          ) : (
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {filtrados.map((r, i) => {
                const nombre    = r.nombre_hijo || r.nombre_nino || '—';
                const tutor     = r.tutor_nombre || r.socio_nombre || `${r.nombres || ''} ${r.apellido_paterno || ''}`.trim() || '—';
                const finalizado = r.hora_salida || r.finalizado;
                return (
                  <div key={r.registro_id || i}
                    onClick={() => setDetalle(detalle?.registro_id === r.registro_id ? null : r)}
                    style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: finalizado ? '#f1f5f9' : '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: finalizado ? '#64748b' : '#2563eb', flexShrink: 0 }}>
                        {nombre[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{nombre}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <User size={9} /> {tutor}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ width: '85px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ↪ {formatHora(r.hora_entrada_local || r.hora_entrada)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Entrada</div>
                      </div>
                      <div style={{ width: '85px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {(r.hora_salida || r.hora_salida_local) ? `↩ ${formatHora(r.hora_salida_local || r.hora_salida)}` : '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Salida</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: finalizado ? '#dcfce7' : '#dbeafe', color: finalizado ? '#15803d' : '#1d4ed8', flexShrink: 0 }}>
                        {finalizado ? 'Finalizado' : 'Activo'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {detalle && (
                <div style={{ margin: '0.5rem 1.25rem 0.75rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: detalle.observaciones ? '0.5rem' : 0 }}>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Entrada</span>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatFechaHora(detalle.hora_entrada_local || detalle.hora_entrada)}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Salida</span>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{detalle.hora_salida ? formatFechaHora(detalle.hora_salida_local || detalle.hora_salida) : '—'}</div>
                    </div>
                  </div>
                  {detalle.observaciones && (
                    <div style={{ padding: '6px 10px', background: '#fefce8', borderRadius: '8px', border: '1px solid #fde68a', color: '#92400e', fontSize: '11px' }}>
                      <strong>Observaciones:</strong> {detalle.observaciones}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function Ludoteca() {
  const { toast } = useNotification();
  const [ninos, setNinos]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showEntrada, setShowEntrada] = useState(false);
  const [ticket, setTicket]           = useState(null);

  const fetchNinos = async () => {
    try {
      const data = await apiRequest('/ludoteca/activos');
      const lista = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      setNinos(lista);
    } catch { setNinos([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNinos(); }, []);

  const handleSalida = async (registroId) => {
    if (!window.confirm('¿Registrar salida de este niño?')) return;
    try {
      const data = await apiRequest(`/ludoteca/salida/${registroId}`, { method: 'PATCH' });
      if (data?.sancion_generada) {
        toast(`Salida registrada. Se generó una sanción por exceso de tiempo (${data.duracion_minutos} min).`, 'warning');
      } else {
        toast('Salida registrada correctamente', 'success');
      }
      fetchNinos();
    } catch (err) {
      toast(err.message || 'Error al registrar salida', 'error');
    }
  };

  if (loading) return (
    <div className="chart-box" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <Loader2 size={28} color="#cbd5e1" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '13px' }}>Cargando ludoteca...</span>
    </div>
  );

  const excedidos = ninos.filter(n => getMinutosTranscurridos(n) > 120).length;
  const porVencer = ninos.filter(n => { const m = getMinutosTranscurridos(n); return m >= 90 && m <= 120; }).length;

  return (
    <div className="chart-box">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>Control de Ludoteca</h4>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Rango de edad: 3–7 años · Límite: 2 horas</p>
        </div>
        <button
          onClick={() => setShowEntrada(true)}
          style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: 'white', border: 'none', borderRadius: '10px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
        >
          <Baby size={15} /> + Registrar Entrada
        </button>
      </div>

      {/* KPIs */}
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

      {/* Lista activos */}
      {ninos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: '#f8fafc', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <Users size={24} color="#94a3b8" />
          </div>
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

      {/* Historial */}
      <SeccionHistorial />

      {showEntrada && (
        <ModalRegistroEntrada
          onClose={() => setShowEntrada(false)}
          onExito={(t) => { setShowEntrada(false); setTicket(t); fetchNinos(); }}
        />
      )}
      {ticket && <TicketModal ticket={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

export default Ludoteca;