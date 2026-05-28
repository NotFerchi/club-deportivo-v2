import React, { useEffect, useState } from 'react';
import { Search, Users, UserCheck, UserX, Mail, Phone, Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import { useNotification } from '../../../context/NotificationContext';
import { API_BASE_URL } from '../../../services/api';

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.trim().split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const COLORES_AVATAR = [
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #ef4444, #b91c1c)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #ec4899, #be185d)',
  'linear-gradient(135deg, #14b8a6, #0f766e)',
];

const COLORES_BADGE = [
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#fee2e2', text: '#b91c1c' },
  { bg: '#f0fdf4', text: '#166534' },
];

// ── Selector de especialidades desde disciplinas BD ───────────────────────────
function EspecialidadesSelector({ value, onChange }) {
  const [disciplinas, setDisciplinas] = useState([]);
  const seleccionadas = value ? value.split(',').map(e => e.trim()).filter(Boolean) : [];

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE_URL}/disciplinas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setDisciplinas(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const toggle = (nombre) => {
    const nuevas = seleccionadas.includes(nombre)
      ? seleccionadas.filter(e => e !== nombre)
      : [...seleccionadas, nombre];
    onChange(nuevas.join(', '));
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {disciplinas.map(d => {
          const activa = seleccionadas.includes(d.nombre);
          return (
            <button key={d.disciplina_id} type="button" onClick={() => toggle(d.nombre)} style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
              border: `1.5px solid ${activa ? '#2563eb' : '#e2e8f0'}`,
              background: activa ? '#dbeafe' : 'white',
              color: activa ? '#1d4ed8' : '#64748b',
              cursor: 'pointer', transition: 'all 0.15s'
            }}>
              {activa ? '✓ ' : ''}{d.nombre}
            </button>
          );
        })}
      </div>
      {seleccionadas.length > 0 && (
        <p style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 0' }}>
          Seleccionadas: {seleccionadas.join(', ')}
        </p>
      )}
    </div>
  );
}

// ── Modal Crear/Editar Instructor ─────────────────────────────────────────────
function ModalInstructor({ instructor, onClose, onGuardado }) {
  const esEdicion = !!instructor;
  const [form, setForm] = useState({
    nombre:       instructor?.nombre       || '',
    especialidad: instructor?.especialidad || '',
    email:        instructor?.email        || '',
    telefono:     instructor?.telefono     || '',
    activo:       instructor?.activo ?? true,
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }

    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const url = esEdicion
        ? `${API_BASE_URL}/instructores/${instructor.instructor_id}`
        : `${API_BASE_URL}/instructores`;
      const method = esEdicion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      onGuardado();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
    borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
  };
  const labelStyle = {
    fontSize: '12px', fontWeight: 700, color: '#475569',
    display: 'block', marginBottom: '5px'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              {esEdicion ? 'Editar Instructor' : 'Nuevo Instructor'}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
              {esEdicion ? 'Modifica los datos del instructor' : 'Agrega un nuevo instructor al club'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}>
            <X size={18} color="#64748b" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Nombre completo *</label>
            <input name="nombre" value={form.nombre} onChange={handleChange}
              placeholder="Ej: Carlos López" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Especialidades</label>
            <EspecialidadesSelector
              value={form.especialidad}
              onChange={val => setForm(prev => ({ ...prev, especialidad: val }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="instructor@club.com" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Teléfono</label>
            <input name="telefono" value={form.telefono} onChange={handleChange}
              placeholder="55-1234-5678" style={inputStyle} />
          </div>

          {esEdicion && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange}
                id="activo" style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="activo" style={{ fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                Instructor activo
              </label>
            </div>
          )}

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
            flex: 2, background: cargando ? '#94a3b8' : 'linear-gradient(135deg, #0f172a, #1e293b)',
            color: 'white', border: 'none', borderRadius: '10px', padding: '11px',
            fontSize: '13px', fontWeight: 700, cursor: cargando ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}>
            {cargando
              ? <><Loader2 size={14} className="icon-spin" /> Guardando...</>
              : esEdicion ? '✓ Actualizar' : '+ Crear Instructor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function GestionInstructores() {
  const { showConfirm } = useNotification();
  const [instructores, setInstructores] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState('');
  const [filtro, setFiltro]             = useState('todos');
  const [showModal, setShowModal]       = useState(false);
  const [editando, setEditando]         = useState(null);

  const fetchInstructores = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/instructores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setInstructores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstructores(); }, []);

  const handleEliminar = async (inst) => {
    if (!await showConfirm(`¿Eliminar a ${inst.nombre}? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/instructores/${inst.instructor_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInstructores();
    } catch (err) { console.error(err); }
  };

  const activos    = instructores.filter(i => i.activo);
  const inactivos  = instructores.filter(i => !i.activo);
  const filtrados  = instructores
    .filter(i => filtro === 'todos' ? true : filtro === 'activos' ? i.activo : !i.activo)
    .filter(i =>
      i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      i.especialidad?.toLowerCase().includes(busqueda.toLowerCase())
    );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
      <Loader2 size={36} className="icon-spin" style={{ marginBottom: '0.5rem', color: '#94a3b8' }} />
      <div>Cargando instructores...</div>
    </div>
  );

  return (
    <div>
      {/* Botón nuevo */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={() => { setEditando(null); setShowModal(true); }} style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          color: 'white', border: 'none', borderRadius: '10px',
          padding: '9px 18px', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <Plus size={15} /> Nuevo Instructor
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total',     valor: instructores.length, color: '#3b82f6', icono: <Users size={18} />,     key: 'todos' },
          { label: 'Activos',   valor: activos.length,      color: '#10b981', icono: <UserCheck size={18} />, key: 'activos' },
          { label: 'Inactivos', valor: inactivos.length,    color: '#ef4444', icono: <UserX size={18} />,     key: 'inactivos' },
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
      <div className="admin-filter-row" style={{ marginBottom: '1.25rem' }}>
        <div className="search-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre o especialidad..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '14px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 600 }}>No se encontraron instructores</p>
          <button onClick={() => { setEditando(null); setShowModal(true); }} style={{
            marginTop: '1rem', background: '#0f172a', color: 'white', border: 'none',
            borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}>+ Agregar instructor</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {filtrados.map((inst, idx) => {
            const avatarColor    = COLORES_AVATAR[idx % COLORES_AVATAR.length];
            const especialidades = inst.especialidad
              ? inst.especialidad.split(',').map(e => e.trim()).filter(Boolean)
              : [];

            return (
              <div key={inst.instructor_id} style={{
                background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
                overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ background: avatarColor, padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', position: 'relative' }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '16px', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0, overflow: 'hidden' }}>
                    {inst.foto_perfil
                      ? <img src={inst.foto_perfil} alt={inst.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : iniciales(inst.nombre)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'white' }}>{inst.nombre}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>Instructor</div>
                  </div>
                  <span style={{
                    position: 'absolute', top: '0.75rem', right: '0.75rem',
                    background: inst.activo ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                    color: 'white', fontSize: '10px', fontWeight: 700,
                    padding: '3px 8px', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: inst.activo ? '#4ade80' : '#94a3b8' }} />
                    {inst.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div style={{ padding: '1rem' }}>
                  {especialidades.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Especialidades
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {especialidades.map((esp, i) => {
                          const c = COLORES_BADGE[i % COLORES_BADGE.length];
                          return (
                            <span key={i} style={{ background: c.bg, color: c.text, fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
                              {esp}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem' }}>
                    {inst.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                        <Mail size={12} color="#94a3b8" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.email}</span>
                      </div>
                    )}
                    {inst.telefono && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                        <Phone size={12} color="#94a3b8" />
                        <span>{inst.telefono}</span>
                      </div>
                    )}
                    {!inst.email && !inst.telefono && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sin información de contacto</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setEditando(inst); setShowModal(true); }} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px',
                      padding: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}>
                      <Edit2 size={13} /> Editar
                    </button>
                    <button onClick={() => handleEliminar(inst)} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '8px',
                      padding: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalInstructor
          instructor={editando}
          onClose={() => { setShowModal(false); setEditando(null); }}
          onGuardado={fetchInstructores}
        />
      )}
    </div>
  );
}

export default GestionInstructores;