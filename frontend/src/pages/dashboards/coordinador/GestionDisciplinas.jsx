import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Search, X, Plus } from 'lucide-react';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const COLORES_DISCIPLINA = {
  'Natación':               { bg: '#e0f2fe', text: '#0369a1', borde: '#38bdf8' },
  'Tenis':                  { bg: '#dcfce7', text: '#15803d', borde: '#4ade80' },
  'Pádel':                  { bg: '#fef3c7', text: '#b45309', borde: '#fbbf24' },
  'Yoga':                   { bg: '#ede9fe', text: '#6d28d9', borde: '#a78bfa' },
  'Pilates':                { bg: '#fce7f3', text: '#9d174d', borde: '#f472b6' },
  'Spinning':               { bg: '#fee2e2', text: '#b91c1c', borde: '#f87171' },
  'Zumba':                  { bg: '#fef9c3', text: '#854d0e', borde: '#fde047' },
  'Baile':                  { bg: '#f0fdf4', text: '#166534', borde: '#86efac' },
  'Aerobics':               { bg: '#fff7ed', text: '#c2410c', borde: '#fb923c' },
  'Entrenamiento Funcional':{ bg: '#f1f5f9', text: '#334155', borde: '#94a3b8' },
};

function getColor(disciplina) {
  return COLORES_DISCIPLINA[disciplina] || { bg: '#f1f5f9', text: '#475569', borde: '#94a3b8' };
}

function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function getBadge(pct) {
  if (pct >= 100) return { label: 'Lleno',      color: '#b91c1c', bg: '#fee2e2' };
  if (pct >= 80)  return { label: 'Casi lleno', color: '#b45309', bg: '#fef3c7' };
  if (pct >= 50)  return { label: 'Medio',      color: '#0369a1', bg: '#e0f2fe' };
  return                  { label: 'Disponible', color: '#15803d', bg: '#dcfce7' };
}

function getLunes() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diff = dia === 0 ? 1 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff);
  return lunes.toISOString().split('T')[0];
}

// ── Modal Nueva Sesión ────────────────────────────────────────────────────────
function ModalNuevaSesion({ onClose, onCreada }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const [espacios, setEspacios]       = useState([]);
  const [instructores, setInstructores] = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [error, setError]             = useState(null);

  const [form, setForm] = useState({
    disciplina_id: '',
    espacio_id:    '',
    instructor_id: '',
    dia_semana:    '1',
    hora_inicio:   '',
    hora_fin:      '',
    cupo_maximo:   '15',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('http://localhost:3000/api/disciplinas',    { headers }).then(r => r.json()),
      fetch('http://localhost:3000/api/espacios/todos', { headers }).then(r => r.json()),
      fetch('http://localhost:3000/api/instructores',   { headers }).then(r => r.json()),
    ]).then(([d, e, i]) => {
      setDisciplinas(Array.isArray(d) ? d : d.data || []);
      setEspacios(Array.isArray(e) ? e : e.data || []);
      setInstructores(Array.isArray(i) ? i : i.data || []);
    }).catch(console.error);
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    setError(null);
    const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = form;

    if (!disciplina_id || !espacio_id || !instructor_id || !hora_inicio || !hora_fin) {
      setError('Todos los campos son requeridos');
      return;
    }
    if (hora_inicio >= hora_fin) {
      setError('La hora de fin debe ser mayor a la hora de inicio');
      return;
    }

    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/sesiones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disciplina_id:  parseInt(disciplina_id),
          espacio_id:     parseInt(espacio_id),
          instructor_id:  parseInt(instructor_id),
          dia_semana:     parseInt(dia_semana),
          hora_inicio,
          hora_fin,
          cupo_maximo:    parseInt(cupo_maximo),
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al crear sesión'); return; }
      onCreada();
      onClose();
    } catch {
      setError('Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const selectStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
    borderRadius: '8px', fontSize: '13px', outline: 'none',
    background: 'white', boxSizing: 'border-box'
  };

  const labelStyle = {
    fontSize: '12px', fontWeight: 700, color: '#475569',
    display: 'block', marginBottom: '5px'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Nueva Sesión</h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>Programa una nueva clase</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Disciplina */}
          <div>
            <label style={labelStyle}>Disciplina *</label>
            <select name="disciplina_id" value={form.disciplina_id} onChange={handleChange} style={selectStyle}>
              <option value="">Selecciona una disciplina</option>
              {disciplinas.map(d => (
                <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          {/* Instructor */}
          <div>
            <label style={labelStyle}>Instructor *</label>
            <select name="instructor_id" value={form.instructor_id} onChange={handleChange} style={selectStyle}>
              <option value="">Selecciona un instructor</option>
              {instructores.map(i => (
                <option key={i.instructor_id} value={i.instructor_id}>
                  {i.nombre || `${i.nombres || ''} ${i.apellido_paterno || ''}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Espacio */}
          <div>
            <label style={labelStyle}>Espacio *</label>
            <select name="espacio_id" value={form.espacio_id} onChange={handleChange} style={selectStyle}>
              <option value="">Selecciona un espacio</option>
              {espacios.map(e => (
                <option key={e.espacio_id} value={e.espacio_id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {/* Fecha */}
        <div>
        <label style={labelStyle}>Fecha *</label>
        <input
      type="date"
          name="fecha"
          value={form.fecha || ''}
          onChange={e => {
            const fecha = e.target.value;
            const diaSemana = new Date(fecha + 'T12:00:00').getDay() + 1;
            setForm(prev => ({ ...prev, fecha, dia_semana: diaSemana }));
          }}
          style={selectStyle}
          min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
        />
        {form.fecha && (
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
            📅 {DIAS[new Date(form.fecha + 'T12:00:00').getDay()]}
          </span>
        )}
        </div>

          {/* Horas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Hora inicio *</label>
              <input type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange}
                style={selectStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hora fin *</label>
              <input type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange}
                style={selectStyle} />
            </div>
          </div>

          {/* Cupo */}
          <div>
            <label style={labelStyle}>Cupo máximo *</label>
            <input type="number" name="cupo_maximo" value={form.cupo_maximo} onChange={handleChange}
              min="1" max="100" style={selectStyle} />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={cargando} style={{
            flex: 2, background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
            color: 'white', border: 'none', borderRadius: '10px', padding: '11px',
            fontSize: '13px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer'
          }}>
            {cargando ? '⏳ Creando...' : '+ Crear Sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function GestionDisciplinas() {
  const [sesiones, setSesiones]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [filtroCupo, setFiltroCupo] = useState('todas');
  const [showModal, setShowModal]   = useState(false);
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    if (hoy.getDay() === 0) return getLunes();
    return hoy.toISOString().split('T')[0];
  });

  const fetchSesiones = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/instructor/clases-general?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setSesiones(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSesiones(); }, [fecha]);

  const formatFecha = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const filtradas = sesiones
    .filter(s => {
      const pct = Math.min(100, Math.round((parseInt(s.cupo_actual) || 0) / (parseInt(s.cupo_maximo) || 1) * 100));
      if (filtroCupo === 'disponible') return pct < 80;
      if (filtroCupo === 'lleno') return pct >= 100;
      return true;
    })
    .filter(s =>
      s.disciplina?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.instructor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.espacio?.toLowerCase().includes(busqueda.toLowerCase())
    );

  const llenas     = sesiones.filter(s => parseInt(s.cupo_actual) >= parseInt(s.cupo_maximo)).length;
  const disponibles = sesiones.filter(s => parseInt(s.cupo_actual) < parseInt(s.cupo_maximo)).length;

  return (
    <div>
      {/* Header con botón Nueva Sesión */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowModal(true)} style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          color: 'white', border: 'none', borderRadius: '10px',
          padding: '9px 18px', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <Plus size={15} /> Nueva Sesión
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total sesiones', valor: sesiones.length, color: '#3b82f6', key: 'todas' },
          { label: 'Disponibles',    valor: disponibles,     color: '#10b981', key: 'disponible' },
          { label: 'Llenas',         valor: llenas,          color: '#ef4444', key: 'lleno' },
        ].map(k => (
          <div key={k.key} onClick={() => setFiltroCupo(k.key)} style={{
            background: filtroCupo === k.key ? k.color : 'white',
            borderRadius: '12px', padding: '1rem 1.25rem',
            border: `1px solid ${filtroCupo === k.key ? k.color : '#e2e8f0'}`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filtroCupo === k.key ? `0 4px 12px ${k.color}40` : '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: filtroCupo === k.key ? 'white' : k.color }}>{k.valor}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: filtroCupo === k.key ? 'rgba(255,255,255,0.8)' : '#64748b' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Búsqueda y fecha */}
      <div className="admin-filter-row" style={{ marginBottom: '0.5rem' }}>
        <div className="search-wrapper" style={{ flex: 1 }}>
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar disciplina, instructor o espacio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <label className="admin-filter">
          <span>Fecha</span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </label>
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 1.25rem' }}>
        {loading ? 'Cargando...' : `${filtradas.length} sesiones para el ${formatFecha(fecha)}`}
      </p>

      {/* Tarjetas */}
      {!loading && filtradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No hay clases para el {formatFecha(fecha)}</p>
          <button onClick={() => setShowModal(true)} style={{
            marginTop: '1rem', background: '#0f172a', color: 'white', border: 'none',
            borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>+ Crear primera sesión</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {filtradas.map(s => {
            const cupoActual = parseInt(s.cupo_actual) || 0;
            const cupoMax    = parseInt(s.cupo_maximo) || 1;
            const pct        = Math.min(100, Math.round((cupoActual / cupoMax) * 100));
            const badge      = getBadge(pct);
            const color      = getColor(s.disciplina);

            return (
              <div key={s.sesion_id} style={{
                background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
                borderTop: `4px solid ${color.borde}`, padding: '1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span style={{ background: color.bg, color: color.text, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
                    {s.disciplina}
                  </span>
                  <span style={{ background: badge.bg, color: badge.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
                    {badge.label}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: color.text, flexShrink: 0 }}>
                    {s.instructor !== 'Sin instructor' ? s.instructor?.charAt(0)?.toUpperCase() : '—'}
                  </div>
                  <span style={{ fontWeight: 500 }}>{s.instructor || 'Sin instructor'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <Clock size={12} color="#94a3b8" />
                    <span>{formatHora(s.hora_inicio)} – {formatHora(s.hora_fin)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <MapPin size={12} color="#94a3b8" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.espacio}</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={11} /> Cupo
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>{cupoActual}/{cupoMax}</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '6px', background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color.borde, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>{pct}% ocupado</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalNuevaSesion
          onClose={() => setShowModal(false)}
          onCreada={fetchSesiones}
        />
      )}
    </div>
  );
}

export default GestionDisciplinas;