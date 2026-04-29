import React, { useEffect, useState } from 'react';
import { Clock, Users, ChevronDown, ChevronUp, Check, X, MapPin, Calendar } from 'lucide-react';

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

function getColorDisciplina(nombre) {
  return COLORES_DISCIPLINA[nombre] || '#475569';
}

function AlumnoRow({ alumno, fecha, sesionId, onEstadoChange }) {
  const [estado, setEstado] = useState(
    alumno.asistio === true ? 'presente' : alumno.asistio === false ? 'ausente' : null
  );
  const [cargando, setCargando] = useState(false);

  const registrar = async (presente) => {
    if (cargando) return;
    const nuevoEstado = presente ? 'presente' : 'ausente';
    const estadoFinal = estado === nuevoEstado ? null : nuevoEstado;
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/api/instructor/asistencia', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesionId, socioId: alumno.socio_id, fecha, presente: estadoFinal === 'presente' })
      });
      setEstado(estadoFinal);
      onEstadoChange && onEstadoChange(alumno.socio_id, estadoFinal);
    } catch (err) {
      console.error('Error registrando asistencia:', err);
    } finally {
      setCargando(false);
    }
  };

  const esVisita = alumno.tipo === 'Visita';
  const bgRow = estado === 'presente' ? '#f0fdf4' : estado === 'ausente' ? '#fff5f5' : 'white';

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.7rem 1.25rem', borderBottom: '1px solid #f1f5f9',
      background: bgRow, transition: 'background 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: esVisita
            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
            : estado === 'presente'
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : estado === 'ausente'
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '11px',
          transition: 'background 0.3s'
        }}>
          {iniciales(alumno.nombre_socio)}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{alumno.nombre_socio}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{esVisita ? 'Visita' : 'Socio'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        {estado && (
          <span style={{
            fontSize: '10px', fontWeight: 700, marginRight: '4px',
            color: estado === 'presente' ? '#15803d' : '#b91c1c'
          }}>
            {estado === 'presente' ? '✓ Presente' : '✗ No-Show'}
          </span>
        )}
        <button onClick={() => registrar(true)} disabled={cargando} style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: estado === 'presente' ? '#10b981' : '#e2e8f0',
          color: estado === 'presente' ? 'white' : '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          boxShadow: estado === 'presente' ? '0 2px 8px rgba(16,185,129,0.4)' : 'none'
        }}>
          <Check size={13} strokeWidth={3} />
        </button>
        <button onClick={() => registrar(false)} disabled={cargando} style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: estado === 'ausente' ? '#ef4444' : '#e2e8f0',
          color: estado === 'ausente' ? 'white' : '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          boxShadow: estado === 'ausente' ? '0 2px 8px rgba(239,68,68,0.4)' : 'none'
        }}>
          <X size={13} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function ClaseCard({ clase, fecha }) {
  const [expandida, setExpandida] = useState(false);
  const [alumnos, setAlumnos] = useState([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [yaCargo, setYaCargo] = useState(false);
  const [estados, setEstados] = useState({});

  const cargarAlumnos = async () => {
    if (yaCargo) return;
    setLoadingAlumnos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `http://localhost:3000/api/instructor/clases/${clase.sesion_id}/alumnos?fecha=${fecha}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setAlumnos(data);
      const estadosIniciales = {};
      data.forEach(a => {
        estadosIniciales[a.socio_id] = a.asistio === true ? 'presente' : a.asistio === false ? 'ausente' : null;
      });
      setEstados(estadosIniciales);
      setYaCargo(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAlumnos(false);
    }
  };

  const handleToggle = () => {
    const nuevo = !expandida;
    setExpandida(nuevo);
    if (nuevo) cargarAlumnos();
  };

  const handleEstadoChange = (socioId, nuevoEstado) => {
    setEstados(prev => ({ ...prev, [socioId]: nuevoEstado }));
  };

  const presentes     = Object.values(estados).filter(e => e === 'presente').length;
  const ausentes      = Object.values(estados).filter(e => e === 'ausente').length;
  const sinRegistrar  = Object.values(estados).filter(e => e === null).length;
  const cupoActual    = parseInt(clase.cupo_actual) || 0;
  const cupoMax       = parseInt(clase.cupo_maximo) || 1;
  const pct           = Math.min(100, Math.round((cupoActual / cupoMax) * 100));
  const colorDisc     = getColorDisciplina(clase.disciplina);

  return (
    <div style={{
      background: 'white', borderRadius: '16px',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${colorDisc}`,
      overflow: 'hidden', marginBottom: '0.85rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.2s'
    }}>
      {/* Header clickeable */}
      <div onClick={handleToggle} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.25rem', cursor: 'pointer',
        background: expandida ? '#f8fafc' : 'white', transition: 'background 0.2s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '12px',
            background: `${colorDisc}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Clock size={18} color={colorDisc} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{clase.disciplina}</div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={11} color="#94a3b8" /> {formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MapPin size={11} color="#94a3b8" /> {clase.espacio}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Mini barra cupo */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={13} color="#94a3b8" /> {cupoActual}/{cupoMax}
            </div>
            <div style={{ width: 60, background: '#e2e8f0', borderRadius: '4px', height: '4px', marginTop: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: '4px',
                background: pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981'
              }} />
            </div>
          </div>
          {expandida ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>

      {/* Pase de lista */}
      {expandida && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <div style={{ padding: '0.6rem 1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
              Pase de Lista Digital
            </span>
            {alumnos.length > 0 && (
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '11px' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>✓ {presentes}</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>✗ {ausentes}</span>
                <span style={{ color: '#94a3b8' }}>— {sinRegistrar}</span>
              </div>
            )}
          </div>

          {loadingAlumnos ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              Cargando alumnos...
            </div>
          ) : alumnos.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📋</div>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>No hay alumnos registrados para esta clase hoy.</p>
            </div>
          ) : (
            alumnos.map((alumno) => (
              <AlumnoRow
                key={alumno.reserva_id || alumno.socio_id}
                alumno={alumno}
                fecha={fecha}
                sesionId={clase.sesion_id}
                onEstadoChange={handleEstadoChange}
              />
            ))
          )}

          {alumnos.length > 0 && (
            <div style={{
              padding: '0.75rem 1.25rem', display: 'flex', gap: '1.5rem',
              background: '#f8fafc', borderTop: '1px solid #f1f5f9',
              alignItems: 'center', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {alumnos.map((a, i) => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: estados[a.socio_id] === 'presente' ? '#10b981' : estados[a.socio_id] === 'ausente' ? '#ef4444' : '#e2e8f0'
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>✓ {presentes} Presentes</span>
              <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>✗ {ausentes} No-Shows</span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{sinRegistrar} Sin registrar</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgendaDia() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchClases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:3000/api/instructor/clases?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setClases(data);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClases();
  }, [fecha]);

  return (
    <div className="chart-box">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>Agenda del Día</h4>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8', textTransform: 'capitalize' }}>
            <Calendar size={11} style={{ marginRight: '4px' }} />
            {formatFecha(fecha)}
          </p>
        </div>
        <input
          type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', cursor: 'pointer', outline: 'none' }}
        />
      </div>

      <div style={{ height: '1px', background: '#f1f5f9', margin: '1rem 0' }} />

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          Cargando agenda...
        </div>
      )}

      {!loading && clases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No hay clases programadas para este día</p>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0' }}>Prueba seleccionando otro día</p>
        </div>
      )}

      {!loading && clases.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
              {clases.length} clase{clases.length !== 1 ? 's' : ''} hoy
            </span>
            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
              {clases.reduce((acc, c) => acc + (parseInt(c.cupo_actual) || 0), 0)} alumnos inscritos
            </span>
          </div>
          {clases.map((clase) => (
            <ClaseCard key={clase.sesion_id} clase={clase} fecha={fecha} />
          ))}
        </>
      )}
    </div>
  );
}

export default AgendaDia;