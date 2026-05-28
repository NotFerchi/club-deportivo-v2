import React, { useEffect, useState } from 'react';
import { Clock, MapPin, Users, Search, X, Plus, Calendar, Loader2, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '../../../services/api';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

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
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
}

// ── Helpers de carga de catálogos ─────────────────────────────────────────────
async function fetchCatalogos() {
  const [d, e, i] = await Promise.all([
    apiRequest('/disciplinas'),
    apiRequest('/espacios/todos'),
    apiRequest('/instructores'),
  ]);
  return {
    disciplinas:  Array.isArray(d) ? d : d?.data || [],
    espacios:     Array.isArray(e) ? e : e?.data || [],
    instructores: Array.isArray(i) ? i : i?.data || [],
  };
}

// ── Formulario compartido para crear/editar ───────────────────────────────────
function FormSesion({ form, setForm, disciplinas, espacios, instructores }) {
  const selectStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
    borderRadius: '8px', fontSize: '13px', outline: 'none',
    background: 'white', boxSizing: 'border-box'
  };
  const labelStyle = {
    fontSize: '12px', fontWeight: 700, color: '#475569',
    display: 'block', marginBottom: '5px'
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Disciplina *</label>
        <select name="disciplina_id" value={form.disciplina_id} onChange={handleChange} style={selectStyle}>
          <option value="">Selecciona una disciplina</option>
          {disciplinas.map(d => <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>)}
        </select>
      </div>

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

      <div>
        <label style={labelStyle}>Espacio *</label>
        <select name="espacio_id" value={form.espacio_id} onChange={handleChange} style={selectStyle}>
          <option value="">Selecciona un espacio</option>
          {espacios.map(e => <option key={e.espacio_id} value={e.espacio_id}>{e.nombre}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Día de la semana *</label>
        <select name="dia_semana" value={form.dia_semana} onChange={handleChange} style={selectStyle}>
          <option value="">Selecciona un día</option>
          {DIAS_SEMANA.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={labelStyle}>Hora inicio *</label>
          <input type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange} style={selectStyle} />
        </div>
        <div>
          <label style={labelStyle}>Hora fin *</label>
          <input type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange} style={selectStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Cupo máximo *</label>
        <input type="number" name="cupo_maximo" value={form.cupo_maximo} onChange={handleChange}
          min="1" max="100" style={selectStyle} />
      </div>
    </div>
  );
}

// ── Modal Nueva Sesión ────────────────────────────────────────────────────────
function ModalNuevaSesion({ onClose, onCreada }) {
  const [catalogos, setCatalogos] = useState({ disciplinas: [], espacios: [], instructores: [] });
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [form, setForm] = useState({
    disciplina_id: '', espacio_id: '', instructor_id: '',
    dia_semana: '', hora_inicio: '', hora_fin: '', cupo_maximo: '15',
  });

  useEffect(() => {
    fetchCatalogos().then(setCatalogos).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = form;
    if (!disciplina_id || !espacio_id || !instructor_id || !dia_semana || !hora_inicio || !hora_fin) {
      setError('Todos los campos son requeridos'); return;
    }
    if (hora_inicio >= hora_fin) { setError('La hora de fin debe ser mayor a la hora de inicio'); return; }

    setCargando(true);
    try {
      await apiRequest('/sesiones', {
        method: 'POST',
        body: JSON.stringify({
          disciplina_id: parseInt(disciplina_id),
          espacio_id:    parseInt(espacio_id),
          instructor_id: parseInt(instructor_id),
          dia_semana:    parseInt(dia_semana),
          hora_inicio, hora_fin,
          cupo_maximo:  parseInt(cupo_maximo),
        })
      });
      onCreada();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <ModalBase titulo="Nueva Sesión" subtitulo="Programa una nueva clase" onClose={onClose}>
      <FormSesion form={form} setForm={setForm} {...catalogos} />
      {error && <MensajeError mensaje={error} />}
      <BotonesModal onClose={onClose} onConfirm={handleSubmit} cargando={cargando} textoConfirm="+ Crear Sesión" />
    </ModalBase>
  );
}

// ── Modal Editar Sesión ───────────────────────────────────────────────────────
function ModalEditarSesion({ sesion, onClose, onActualizada }) {
  const [catalogos, setCatalogos] = useState({ disciplinas: [], espacios: [], instructores: [] });
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [form, setForm] = useState({
    disciplina_id: String(sesion.disciplina_id || ''),
    espacio_id:    String(sesion.espacio_id || ''),
    instructor_id: String(sesion.instructor_id || ''),
    dia_semana:    String(sesion.dia_semana || ''),
    hora_inicio:   String(sesion.hora_inicio || '').slice(0, 5),
    hora_fin:      String(sesion.hora_fin || '').slice(0, 5),
    cupo_maximo:   String(sesion.cupo_maximo || '15'),
  });

  useEffect(() => {
    fetchCatalogos().then(setCatalogos).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const { disciplina_id, espacio_id, instructor_id, dia_semana, hora_inicio, hora_fin, cupo_maximo } = form;
    if (!disciplina_id || !espacio_id || !instructor_id || !dia_semana || !hora_inicio || !hora_fin) {
      setError('Todos los campos son requeridos'); return;
    }
    if (hora_inicio >= hora_fin) { setError('La hora de fin debe ser mayor a la hora de inicio'); return; }

    setCargando(true);
    try {
      await apiRequest(`/sesiones/${sesion.sesion_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          disciplina_id: parseInt(disciplina_id),
          espacio_id:    parseInt(espacio_id),
          instructor_id: parseInt(instructor_id),
          dia_semana:    parseInt(dia_semana),
          hora_inicio, hora_fin,
          cupo_maximo:  parseInt(cupo_maximo),
          activo:        true,
        })
      });
      onActualizada();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al actualizar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <ModalBase titulo="Editar Sesión" subtitulo={`Modificando: ${sesion.disciplina}`} onClose={onClose}>
      <FormSesion form={form} setForm={setForm} {...catalogos} />
      {error && <MensajeError mensaje={error} />}
      <BotonesModal onClose={onClose} onConfirm={handleSubmit} cargando={cargando} textoConfirm="Guardar cambios" />
    </ModalBase>
  );
}

// ── Modal Inscritos ───────────────────────────────────────────────────────────
function ModalInscritos({ sesion, fecha, onClose }) {
  const [inscritos, setInscritos] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const color = getColor(sesion.disciplina);

  useEffect(() => {
    const query = fecha ? `?fecha=${fecha}` : '';
    setLoading(true);
    setError('');
    apiRequest(`/instructor/sesiones/${sesion.sesion_id}/inscritos${query}`)
      .then(data => setInscritos(Array.isArray(data) ? data : []))
      .catch(err => {
        setInscritos([]);
        setError(err.message || 'No se pudieron cargar los inscritos');
      })
      .finally(() => setLoading(false));
  }, [sesion.sesion_id, fecha]);

  return (
    <ModalBase
      titulo={`Inscritos — ${sesion.disciplina}`}
      subtitulo={`${formatHora(sesion.hora_inicio)} – ${formatHora(sesion.hora_fin)} · ${sesion.espacio}`}
      onClose={onClose}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          Cargando inscritos...
        </div>
      ) : error ? (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '12px', border: '1px solid #fecaca', fontSize: '13px', fontWeight: 600 }}>
          {error}
        </div>
      ) : inscritos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          <Users size={32} color="#cbd5e1" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600, fontSize: '14px' }}>Sin inscritos aún</p>
          <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '12px' }}>Los socios pueden inscribirse desde su panel</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <span style={{ background: color.bg, color: color.text, fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px' }}>
              {inscritos.length}/{sesion.cupo_maximo} inscritos
            </span>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.round(inscritos.length / (sesion.cupo_maximo || 1) * 100))}%`, height: '100%', borderRadius: '6px', background: color.borde }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
            {inscritos.map((s, i) => (
              <div key={s.inscripcion_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: color.text, flexShrink: 0 }}>
                  {(s.nombre_socio || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.nombre_socio}
                  </div>
                  {s.numero_socio && (
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>#{s.numero_socio}</div>
                  )}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>
                  {s.tipo || 'Confirmado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: '1.25rem' }}>
        <button onClick={onClose} style={{ width: '100%', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          Cerrar
        </button>
      </div>
    </ModalBase>
  );
}

// ── Componentes reutilizables de modal ────────────────────────────────────────
function ModalBase({ titulo, subtitulo, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{titulo}</h3>
            {subtitulo && <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>{subtitulo}</p>}
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MensajeError({ mensaje }) {
  return (
    <div style={{ marginTop: '0.75rem', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
      ⚠ {mensaje}
    </div>
  );
}

function BotonesModal({ onClose, onConfirm, cargando, textoConfirm }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
      <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
        Cancelar
      </button>
      <button onClick={onConfirm} disabled={cargando} style={{
        flex: 2, background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
        color: 'white', border: 'none', borderRadius: '10px', padding: '11px',
        fontSize: '13px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
      }}>
        {cargando ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>Guardando...</> : textoConfirm}
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function GestionDisciplinas() {
  const [sesiones, setSesiones]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState('');
  const [filtroCupo, setFiltroCupo]     = useState('todas');
  const [showModal, setShowModal]       = useState(false);
  const [editingSesion, setEditingSesion] = useState(null);
  const [inscritosSesion, setInscritosSesion] = useState(null);
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    if (hoy.getDay() === 0) return getLunes();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  });

  const fetchSesiones = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/instructor/clases-general?fecha=${fecha}`);
      setSesiones(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSesiones(); }, [fecha]);

  const handleDelete = async (sesion) => {
    if (!confirm(`¿Eliminar la sesión de ${sesion.disciplina} (${formatHora(sesion.hora_inicio)})? Esta acción no se puede deshacer.`)) return;
    try {
      await apiRequest(`/sesiones/${sesion.sesion_id}`, { method: 'DELETE' });
      fetchSesiones();
    } catch (err) {
      alert(err.message || 'Error al eliminar sesión');
    }
  };

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

  const llenas      = sesiones.filter(s => parseInt(s.cupo_actual) >= parseInt(s.cupo_maximo)).length;
  const disponibles = sesiones.filter(s => parseInt(s.cupo_actual) < parseInt(s.cupo_maximo)).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => setShowModal(true)} style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: 'white', border: 'none',
          borderRadius: '10px', padding: '9px 18px', fontSize: '13px', fontWeight: 700,
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
          <input type="text" className="search-input" placeholder="Buscar disciplina, instructor o espacio..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
          <div style={{ marginBottom: '0.75rem' }}><Calendar size={40} color="#cbd5e1" /></div>
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
                {/* Header disciplina + estado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span style={{ background: color.bg, color: color.text, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>
                    {s.disciplina}
                  </span>
                  <span style={{ background: badge.bg, color: badge.color, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px' }}>
                    {badge.label}
                  </span>
                </div>

                {/* Instructor */}
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: color.text, flexShrink: 0 }}>
                    {s.instructor !== 'Sin instructor' ? s.instructor?.charAt(0)?.toUpperCase() : '—'}
                  </div>
                  <span style={{ fontWeight: 500 }}>{s.instructor || 'Sin instructor'}</span>
                </div>

                {/* Datos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <Clock size={12} color="#94a3b8" />
                    <span>{formatHora(s.hora_inicio)} – {formatHora(s.hora_fin)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <MapPin size={12} color="#94a3b8" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.espacio}</span>
                  </div>
                  {s.dia_semana && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9', background: '#ede9fe', padding: '2px 8px', borderRadius: '20px' }}>
                        {DIAS_SEMANA.find(d => d.value === parseInt(s.dia_semana))?.label || `Día ${s.dia_semana}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Barra de cupo + botón inscritos */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <button
                      onClick={() => setInscritosSesion(s)}
                      style={{ fontSize: '11px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      <Users size={11} /> Ver {cupoActual} inscritos
                    </button>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>{cupoActual}/{cupoMax}</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '6px', background: pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color.borde, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>{pct}% ocupado</div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <button
                    onClick={() => setEditingSesion(s)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalNuevaSesion onClose={() => setShowModal(false)} onCreada={fetchSesiones} />
      )}
      {editingSesion && (
        <ModalEditarSesion
          sesion={editingSesion}
          onClose={() => setEditingSesion(null)}
          onActualizada={() => { setEditingSesion(null); fetchSesiones(); }}
        />
      )}
      {inscritosSesion && (
        <ModalInscritos sesion={inscritosSesion} fecha={fecha} onClose={() => setInscritosSesion(null)} />
      )}
    </div>
  );
}

export default GestionDisciplinas;
