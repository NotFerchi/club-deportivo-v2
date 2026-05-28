import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, Calendar, ChevronRight, Edit2, Plus,
  RefreshCw, Shield, Trash2, Trophy, UserPlus, Users, X
} from 'lucide-react';
import { adminApi } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { formatDate, normalizeText } from '../../../utils/adminData';
import TournamentBracket from '../../../components/TournamentBracket';

const ESTADO_COLORS = {
  Abierto:               { bg: '#dcfce7', color: '#15803d' },
  Inscripciones_cerradas:{ bg: '#fef3c7', color: '#92400e' },
  En_curso:              { bg: '#dbeafe', color: '#1d4ed8' },
  Finalizado:            { bg: '#f1f5f9', color: '#475569' },
  Cancelado:             { bg: '#fee2e2', color: '#b91c1c' },
};

const ESTADO_LABELS = {
  Abierto: 'Abierto',
  Inscripciones_cerradas: 'Inscr. cerradas',
  En_curso: 'En curso',
  Finalizado: 'Finalizado',
  Cancelado: 'Cancelado',
};

const initialTorneoForm = {
  nombre: '', disciplina_id: '', fecha_inicio: '', fecha_fin: '',
  estado: 'Abierto', categoria_id: '', tipo_torneo: 'Individual'
};

const initialInscForm = { tipo: 'socio', socio_id: '', nombre_externo: '', categoria_id: '' };

function EstadoBadge({ estado }) {
  const cfg = ESTADO_COLORS[estado] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap'
    }}>
      {ESTADO_LABELS[estado] || estado}
    </span>
  );
}

function TorneoModal({ editing, form, disciplinas, categorias, onChange, onSubmit, onClose }) {
  const isNew = !editing;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{isNew ? 'Nuevo Torneo' : 'Editar Torneo'}</h3>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group form-group-full">
                <label className="required">Nombre del torneo</label>
                <input
                  type="text" value={form.nombre} required
                  onChange={e => onChange('nombre', e.target.value)}
                  placeholder="Ej. Copa Verano 2026"
                />
              </div>
              <div className="form-group">
                <label className="required">Disciplina</label>
                <select value={form.disciplina_id} required onChange={e => onChange('disciplina_id', e.target.value)}>
                  <option value="">Seleccionar disciplina</option>
                  {disciplinas.map(d => (
                    <option key={d.disciplina_id} value={d.disciplina_id}>{d.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={form.categoria_id} onChange={e => onChange('categoria_id', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => (
                    <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Modalidad</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ value: 'Individual', label: 'Individual' }, { value: 'Equipos', label: 'Equipos' }].map(opt => (
                    <button key={opt.value} type="button" onClick={() => onChange('tipo_torneo', opt.value)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 13,
                        border: `2px solid ${form.tipo_torneo === opt.value ? '#3b82f6' : '#e2e8f0'}`,
                        background: form.tipo_torneo === opt.value ? '#eff6ff' : '#fff',
                        color: form.tipo_torneo === opt.value ? '#1d4ed8' : '#475569',
                        fontWeight: form.tipo_torneo === opt.value ? 700 : 400, cursor: 'pointer'
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Fecha inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => onChange('fecha_inicio', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Fecha fin</label>
                <input type="date" value={form.fecha_fin} onChange={e => onChange('fecha_fin', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.estado} onChange={e => onChange('estado', e.target.value)}>
                  <option value="Abierto">Abierto</option>
                  <option value="Inscripciones_cerradas">Inscripciones cerradas</option>
                  <option value="En_curso">En curso</option>
                  <option value="Finalizado">Finalizado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary">
              {isNew ? 'Crear torneo' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InscribirModal({ torneo, socios, categorias, onClose, onSubmit }) {
  const { toast: toastInscribir } = useNotification();
  const [form, setForm] = useState(initialInscForm);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { categoria_id: form.categoria_id || undefined };
    if (form.tipo === 'socio') {
      if (!form.socio_id) { toastInscribir('Selecciona un socio', 'warning'); return; }
      payload.socio_id = form.socio_id;
    } else {
      const nombre = form.nombre_externo.trim();
      if (!nombre) { toastInscribir('Ingresa el nombre del equipo o participante externo', 'warning'); return; }
      payload.nombre_externo = nombre;
    }
    if (!payload.categoria_id) { toastInscribir('Selecciona una categoría', 'warning'); return; }
    onSubmit(payload);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h3>Inscribir participante</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{torneo.nombre}</p>
          </div>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group form-group-full">
                <label>Tipo de participante</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'socio', label: 'Socio del club' },
                    { value: 'equipo', label: 'Equipo / Externo' }
                  ].map(opt => (
                    <button
                      key={opt.value} type="button"
                      onClick={() => update('tipo', opt.value)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8,
                        border: `2px solid ${form.tipo === opt.value ? '#3b82f6' : '#e2e8f0'}`,
                        background: form.tipo === opt.value ? '#eff6ff' : '#fff',
                        color: form.tipo === opt.value ? '#1d4ed8' : '#475569',
                        fontWeight: form.tipo === opt.value ? 700 : 400,
                        cursor: 'pointer', fontSize: 13
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipo === 'socio' ? (
                <div className="form-group form-group-full">
                  <label className="required">Socio</label>
                  <select value={form.socio_id} onChange={e => update('socio_id', e.target.value)} required>
                    <option value="">Seleccionar socio</option>
                    {socios.map(s => (
                      <option key={s.socio_id} value={s.socio_id}>
                        {[s.nombres, s.apellido_paterno, s.apellido_materno].filter(Boolean).join(' ')}
                        {s.numero_socio ? ` — ${s.numero_socio}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group form-group-full">
                  <label className="required">Nombre del equipo o participante externo</label>
                  <input
                    type="text" value={form.nombre_externo}
                    onChange={e => update('nombre_externo', e.target.value)}
                    placeholder="Ej. Águilas FC, Juan Pérez..."
                  />
                </div>
              )}

              <div className="form-group form-group-full">
                <label className="required">Categoría</label>
                <select value={form.categoria_id} onChange={e => update('categoria_id', e.target.value)} required>
                  <option value="">Seleccionar categoría</option>
                  {categorias.map(c => (
                    <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary"><UserPlus size={15} /> Inscribir</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ParticipantesPanel({ torneo, categorias, socios, onClose, onCerrarInscripciones }) {
  const { toast, showConfirm } = useNotification();
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInscribir, setShowInscribir] = useState(false);

  const fetchParticipantes = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getTorneoParticipantes(torneo.torneo_id);
      const list = Array.isArray(data) ? data : (data?.participantes || data?.data || []);
      setParticipantes(list);
    } catch (e) {
      toast(e.message || 'Error al cargar participantes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchParticipantes(); }, [torneo.torneo_id]);

  const handleInscribir = async (payload) => {
    try {
      await adminApi.inscribirParticipante(torneo.torneo_id, payload);
      setShowInscribir(false);
      fetchParticipantes();
    } catch (e) {
      toast(e.message || 'Error al inscribir participante', 'error');
    }
  };

  const handleDesinscribir = async (participanteId) => {
    if (!await showConfirm('¿Quitar este participante del torneo?')) return;
    try {
      await adminApi.desinscribirParticipante(torneo.torneo_id, participanteId);
      fetchParticipantes();
    } catch (e) {
      toast(e.message || 'Error al desinscribir participante', 'error');
    }
  };

  const puedeInscribir = torneo.estado === 'Abierto';
  const puedeCerrar = torneo.estado === 'Abierto' && participantes.length >= 4;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} /> Participantes — {torneo.nombre}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              {participantes.length} inscrito{participantes.length !== 1 ? 's' : ''} · <EstadoBadge estado={torneo.estado} />
            </p>
          </div>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando...</p>
          ) : participantes.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
              No hay participantes inscritos.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Participante</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  {puedeInscribir && <th />}
                </tr>
              </thead>
              <tbody>
                {participantes.map((p, i) => (
                  <tr key={p.participante_id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td><strong>{p.nombre_participante}</strong></td>
                    <td><span className="badge-neutral">{p.tipo_participante}</span></td>
                    <td>{p.categoria || '—'}</td>
                    {puedeInscribir && (
                      <td>
                        <button
                          className="btn-outline btn-compact"
                          onClick={() => handleDesinscribir(p.participante_id)}
                          title="Quitar participante"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {puedeInscribir && (
              <button className="btn-primary" onClick={() => setShowInscribir(true)}>
                <UserPlus size={15} /> Inscribir
              </button>
            )}
            {puedeCerrar && (
              <button className="btn-outline" onClick={onCerrarInscripciones} style={{ color: '#b45309', borderColor: '#f59e0b' }}>
                <Shield size={15} /> Cerrar inscripciones
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn-outline">Cerrar</button>
        </div>

        {showInscribir && (
          <InscribirModal
            torneo={torneo}
            socios={socios}
            categorias={categorias}
            onClose={() => setShowInscribir(false)}
            onSubmit={handleInscribir}
          />
        )}
      </div>
    </div>
  );
}

const RONDA_LABELS = { 1: 'Octavos', 2: 'Cuartos', 3: 'Semis', 4: 'Final' };
function rondaLabel(n, totalRondas) {
  if (n === totalRondas) return 'Final';
  if (n === totalRondas - 1) return 'Semifinal';
  if (n === totalRondas - 2) return 'Cuartos de Final';
  return RONDA_LABELS[n] || `Ronda ${n}`;
}

function ResultadosTorneo({ torneo, onClose }) {
  const { toast: toastResultados } = useNotification();
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getTorneoReporte(torneo.torneo_id)
      .then(data => setReporte(data))
      .catch(e => toastResultados(e.message || 'Error al cargar reporte', 'error'))
      .finally(() => setLoading(false));
  }, [torneo.torneo_id]);

  const { ganador, encuentrosFin, rutaCampeon, totalRondas } = useMemo(() => {
    if (!reporte?.encuentros?.length) return { ganador: null, encuentrosFin: [], rutaCampeon: [], totalRondas: 1 };
    const enc = reporte.encuentros.filter(e => e.estado === 'finalizado');
    const maxRonda = Math.max(...reporte.encuentros.map(e => e.ronda));
    const final = enc.filter(e => e.ronda === maxRonda).at(-1);
    const ganadorObj = final?.ganador || null;
    const ruta = ganadorObj
      ? enc.filter(e => e.ganador?.id === ganadorObj.id).sort((a, b) => a.ronda - b.ronda)
      : [];
    return { ganador: ganadorObj, encuentrosFin: enc, rutaCampeon: ruta, totalRondas: maxRonda };
  }, [reporte]);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 780, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={20} style={{ color: '#d97706' }} />
            <div>
              <h3 style={{ margin: 0 }}>Resultados — {torneo.nombre}</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{torneo.nombre_disciplina} · <EstadoBadge estado={torneo.estado} /></p>
            </div>
          </div>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>

        <div className="modal-body">
          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando resultados...</p>
          ) : !reporte?.encuentros?.length ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Aún no hay encuentros registrados.</p>
          ) : (
            <>
              {/* Tarjeta del campeón */}
              {ganador && (
                <div style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  border: '2px solid #f59e0b', borderRadius: 12, padding: '1.25rem',
                  display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem'
                }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Award size={28} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#92400e' }}>Campeón</p>
                    <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#1e3a5f' }}>{ganador.nombre}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#78716c' }}>
                      {torneo.nombre_disciplina}
                      {torneo.fecha_fin ? ` · Finalizado: ${formatDate(torneo.fecha_fin)}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#f59e0b', color: '#fff' }}>
                    🏆 Campeón
                  </span>
                </div>
              )}

              {/* Ruta del campeón */}
              {rutaCampeon.length > 1 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h5 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={15} style={{ color: '#f59e0b' }} /> Ruta del campeón
                  </h5>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {rutaCampeon.map(e => {
                      const rival = e.participante_1?.id === ganador.id ? e.participante_2 : e.participante_1;
                      const m1 = e.participante_1?.id === ganador.id ? e.marcador_1 : e.marcador_2;
                      const m2 = e.participante_1?.id === ganador.id ? e.marcador_2 : e.marcador_1;
                      return (
                        <div key={e.encuentro_id} style={{
                          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
                          padding: '8px 12px', fontSize: 12
                        }}>
                          <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#15803d', fontSize: 11 }}>{rondaLabel(e.ronda, totalRondas)}</p>
                          <p style={{ margin: 0, color: '#1e293b' }}>vs <strong>{rival?.nombre || 'Por definir'}</strong></p>
                          <p style={{ margin: '2px 0 0', color: '#16a34a', fontWeight: 700 }}>{m1} — {m2}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historial de encuentros */}
              <h5 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                Historial de encuentros ({encuentrosFin.length})
              </h5>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ronda</th>
                      <th>Participante A</th>
                      <th>Marcador</th>
                      <th>Participante B</th>
                      <th>Ganador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encuentrosFin.map(e => {
                      const esDelCampeon = ganador && e.ganador?.id === ganador.id;
                      return (
                        <tr key={e.encuentro_id} style={esDelCampeon ? { background: '#fffbeb' } : {}}>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12 }}>{rondaLabel(e.ronda, totalRondas)}</td>
                          <td style={{ fontWeight: e.ganador?.id === e.participante_1?.id ? 700 : 400 }}>
                            {e.participante_1?.nombre || '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
                            {e.marcador_1 ?? '—'} : {e.marcador_2 ?? '—'}
                          </td>
                          <td style={{ fontWeight: e.ganador?.id === e.participante_2?.id ? 700 : 400 }}>
                            {e.participante_2?.nombre || '—'}
                          </td>
                          <td>
                            {e.ganador ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: e.ganador.id === ganador?.id ? '#15803d' : '#475569' }}>
                                {esDelCampeon ? '🏆 ' : ''}{e.ganador.nombre}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {encuentrosFin.length === 0 && (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Sin encuentros finalizados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-outline">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function GestionTorneos({ readOnly = false }) {
  const { toast: toastGestion, showConfirm: showConfirmGestion } = useNotification();
  const [torneos, setTorneos] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterDisciplina, setFilterDisciplina] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTorneo, setEditingTorneo] = useState(null);
  const [torneoForm, setTorneoForm] = useState(initialTorneoForm);
  const [viewParticipantes, setViewParticipantes] = useState(null);
  const [viewResultados, setViewResultados] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, d, c, s] = await Promise.all([
        adminApi.getTorneos(),
        adminApi.getDisciplinas(),
        adminApi.getCategoriasTorneo(),
        adminApi.getSocios()
      ]);
      setTorneos(Array.isArray(t) ? t : []);
      setDisciplinas(Array.isArray(d) ? d : []);
      setCategorias(Array.isArray(c) ? c : (c?.categorias || []));
      setSocios(Array.isArray(s) ? s.filter(x => x.activo !== false && x.activo !== 'false') : []);
    } catch (e) {
      toastGestion(e.message || 'Error al cargar torneos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const q = normalizeText(searchTerm);
    return torneos.filter(t => {
      if (filterEstado && t.estado !== filterEstado) return false;
      if (filterDisciplina && String(t.disciplina_id) !== filterDisciplina) return false;
      if (!q) return true;
      return normalizeText(`${t.nombre} ${t.nombre_disciplina} ${t.nombre_categoria || ''}`).includes(q);
    });
  }, [torneos, searchTerm, filterEstado, filterDisciplina]);

  const openCreate = () => {
    setEditingTorneo(null);
    setTorneoForm(initialTorneoForm);
    setShowModal(true);
  };

  const openEdit = (torneo) => {
    setEditingTorneo(torneo);
    setTorneoForm({
      nombre: torneo.nombre || '',
      disciplina_id: String(torneo.disciplina_id || ''),
      fecha_inicio: torneo.fecha_inicio ? String(torneo.fecha_inicio).split('T')[0] : '',
      fecha_fin: torneo.fecha_fin ? String(torneo.fecha_fin).split('T')[0] : '',
      estado: torneo.estado || 'Abierto',
      categoria_id: torneo.categoria_id ? String(torneo.categoria_id) : '',
      tipo_torneo: torneo.tipo_torneo || 'Individual'
    });
    setShowModal(true);
  };

  const handleFormChange = (key, value) => setTorneoForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: torneoForm.nombre.trim(),
      disciplina_id: Number(torneoForm.disciplina_id),
      fecha_inicio: torneoForm.fecha_inicio || undefined,
      fecha_fin: torneoForm.fecha_fin || undefined,
      estado: torneoForm.estado,
      categoria_id: torneoForm.categoria_id ? Number(torneoForm.categoria_id) : undefined,
      tipo_torneo: torneoForm.tipo_torneo || 'Individual'
    };
    try {
      await adminApi.saveTorneo(payload, editingTorneo?.torneo_id);
      setShowModal(false);
      fetchAll();
    } catch (e) {
      toastGestion(e.message || 'Error al guardar torneo', 'error');
    }
  };

  const handleCancelTorneo = async (torneo) => {
    if (!await showConfirmGestion(`¿Cancelar el torneo "${torneo.nombre}"? Esta acción cambia su estado a Cancelado.`, { danger: true, confirmLabel: 'Cancelar torneo' })) return;
    try {
      await adminApi.cancelarTorneo(torneo.torneo_id);
      fetchAll();
    } catch (e) {
      toastGestion(e.message || 'Error al cancelar torneo', 'error');
    }
  };

  const handleCerrarInscripciones = async (torneo) => {
    if (!await showConfirmGestion(`¿Cerrar inscripciones y generar el bracket para "${torneo.nombre}"?`)) return;
    try {
      await adminApi.cerrarInscripcionesTorneo(torneo.torneo_id);
      setViewParticipantes(null);
      fetchAll();
    } catch (e) {
      toastGestion(e.message || 'Error al cerrar inscripciones', 'error');
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando torneos...</p></div>;

  const estadosUnicos = [...new Set(torneos.map(t => t.estado).filter(Boolean))];

  return (
    <TournamentBracket
      title="Gestión de Torneos"
      subtitle="Administra torneos, participantes, brackets y resultados del club."
      readOnly={readOnly}
    />
  );
}