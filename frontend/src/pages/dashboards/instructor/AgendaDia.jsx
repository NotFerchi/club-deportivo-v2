import React, { useEffect, useState } from 'react';
import { Clock, Users, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

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
  return `${d}/${m}/${y}`;
}

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
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

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.7rem 1rem', borderBottom: '1px solid #f1f5f9',
      background: estado === 'presente' ? '#f0fdf4' : estado === 'ausente' ? '#fff5f5' : 'white',
      transition: 'background 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: esVisita ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0
        }}>
          {iniciales(alumno.nombre_socio)}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{alumno.nombre_socio}</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{esVisita ? 'Visita' : 'Socio'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={() => registrar(true)} disabled={cargando} title="Presente" style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: estado === 'presente' ? '#10b981' : '#e2e8f0',
          color: estado === 'presente' ? 'white' : '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
        }}>
          <Check size={13} strokeWidth={3} />
        </button>
        <button onClick={() => registrar(false)} disabled={cargando} title="No-Show" style={{
          width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: estado === 'ausente' ? '#ef4444' : '#e2e8f0',
          color: estado === 'ausente' ? 'white' : '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
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

  const presentes = Object.values(estados).filter(e => e === 'presente').length;
  const ausentes = Object.values(estados).filter(e => e === 'ausente').length;
  const sinRegistrar = Object.values(estados).filter(e => e === null).length;

  return (
    <div style={{
      background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
      overflow: 'hidden', marginBottom: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div onClick={handleToggle} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 1.25rem', cursor: 'pointer',
        background: expandida ? '#f8fafc' : 'white', transition: 'background 0.2s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: '#e0f2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Clock size={16} color="#0369a1" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{clase.disciplina}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.75rem', marginTop: '2px', flexWrap: 'wrap' }}>
              <span>⏰ {formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}</span>
              <span>📍 {clase.espacio}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '0.82rem' }}>
            <Users size={14} />
            <span style={{ fontWeight: 600 }}>{clase.cupo_actual || 0}/{clase.cupo_maximo}</span>
          </div>
          {expandida ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>

      {expandida && (
        <div style={{ borderTop: '1px solid #f1f5f9' }}>
          <div style={{ padding: '0.6rem 1.25rem', background: '#f8fafc' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
              Pase de Lista Digital
            </span>
          </div>

          {loadingAlumnos ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              Cargando alumnos...
            </div>
          ) : alumnos.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No hay alumnos registrados para esta clase hoy.
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
              padding: '0.65rem 1.25rem', display: 'flex', gap: '1.25rem',
              background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem'
            }}>
              <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {presentes} Presentes</span>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ {ausentes} No-Shows</span>
              <span style={{ color: '#94a3b8' }}>{sinRegistrar} Sin registrar</span>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>Agenda del Día</h4>
        <input
          type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem', color: '#334155', cursor: 'pointer', outline: 'none' }}
        />
      </div>
      <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem', marginTop: '0.25rem' }}>{formatFecha(fecha)}</p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando agenda...</div>
      )}

      {!loading && clases.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
          <p style={{ color: '#64748b', margin: 0 }}>No hay clases programadas para el {formatFecha(fecha)}</p>
        </div>
      )}

      {!loading && clases.map((clase) => (
        <ClaseCard key={clase.sesion_id} clase={clase} fecha={fecha} />
      ))}
    </div>
  );
}

export default AgendaDia;