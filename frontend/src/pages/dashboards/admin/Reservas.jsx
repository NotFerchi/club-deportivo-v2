import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CheckCircle, ChevronLeft, ChevronRight,
  Clock, Edit2, Plus, RefreshCw, Trash2, Users, X, XCircle
} from 'lucide-react';
import { adminApi } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import {
  addMinutesToTime, getFullName, getSocioNumero,
  minutesBetween, normalizeEstadoReserva, normalizeText,
  timesOverlap, todayISO, toDateInputValue, toTimeInputValue
} from '../../../utils/adminData';
import { LoadingState, ErrorState } from '../../../components/admin/AdminUI';

// ─── Config ───────────────────────────────────────────────────────────────────
// Horario: Mar–Sáb 06:00–22:00 | Dom 07:00–19:00 | Lun Cerrado
const GRID_START = 6;   // 06:00  (primera columna visible)
const GRID_END   = 22;  // 22:00  (última columna = 21:00–22:00)
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);

// getDiaSemana: Lun=1, Mar=2 … Sáb=6, Dom=7
function getScheduleForDay(diaSemana) {
  if (diaSemana === 1) return { cerrado: true,  apertura: null, cierre: null  };
  if (diaSemana === 7) return { cerrado: false, apertura: 7,    cierre: 19    };
  return                      { cerrado: false, apertura: 6,    cierre: 22    };
}

const ESTADO_META = {
  confirmada:    { label: 'Confirmada',    color: '#1e3a5f', bg: '#1e3a5f', text: '#fff'    },
  pendiente:     { label: 'Pendiente',     color: '#f59e0b', bg: '#fef3c7', text: '#92400e' },
  'no-show':     { label: 'No Show',       color: '#ef4444', bg: '#fee2e2', text: '#7f1d1d' },
  sancionada:    { label: 'Sancionada',    color: '#ef4444', bg: '#fee2e2', text: '#7f1d1d' },
  cancelada:     { label: 'Cancelada',     color: '#94a3b8', bg: '#f1f5f9', text: '#475569' },
  mantenimiento: { label: 'Mantenimiento', color: '#6b7280', bg: '#f3f4f6', text: '#374151' },
};

const INACTIVE_ESTADOS = ['cancelada', 'no-show', 'sancionada'];

const DURACION_MIN = 60;
const RESERVA_CONFIG = { sameDayOnly: true, durationMinutes: DURACION_MIN, maxPerSocio: 1 };

const initialForm = {
  espacio_id: '', socio_id: '', fecha: todayISO(),
  hora_inicio: '', hora_fin: '', estado: 'confirmada', duracion: 60
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseHHMM(t) {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) ? h + (m || 0) / 60 : null;
}
function getDiaSemana(fecha) {
  const [y, mo, d] = String(fecha || '').split('-').map(Number);
  if (!y) return null;
  const js = new Date(y, mo - 1, d).getDay();
  return js === 0 ? 7 : js;
}

// ─── Modal de formulario ──────────────────────────────────────────────────────
function ReservaModal({ editing, form, errors, espacios, socios, sancionados, onClose, onSubmit, onUpdate, onUpdateHora, onUpdateDuracion }) {
  const err = (f) => errors[f] ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {};
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h3>{editing ? 'Editar Reserva' : 'Nueva Reserva'}</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>La hora fin se calcula automáticamente según la duración elegida</p>
          </div>
          <button onClick={onClose} className="close-modal"><X size={22} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="required">Espacio</label>
                <select value={form.espacio_id} onChange={e => onUpdate('espacio_id', e.target.value)} style={err('espacio_id')}>
                  <option value="">Seleccionar espacio</option>
                  {espacios.map(e => (
                    <option key={e.espacio_id} value={e.espacio_id}>
                      {e.nombre} (Cap. {e.capacidad_maxima || 'N/D'})
                    </option>
                  ))}
                </select>
                {errors.espacio_id && <p className="field-error">{errors.espacio_id}</p>}
              </div>
              <div className="form-group">
                <label className="required">Socio</label>
                <select value={form.socio_id} onChange={e => onUpdate('socio_id', e.target.value)} style={err('socio_id')}>
                  <option value="">Seleccionar socio</option>
                  {socios.map(s => (
                    <option key={s.socio_id} value={s.socio_id} disabled={sancionados.has(String(s.socio_id))}>
                      {getFullName(s)} — {getSocioNumero(s) || 'Sin número'}{sancionados.has(String(s.socio_id)) ? ' (sancionado)' : ''}
                    </option>
                  ))}
                </select>
                {errors.socio_id && <p className="field-error">{errors.socio_id}</p>}
              </div>
              <div className="form-group">
                <label className="required">Fecha</label>
                <input type="date" value={form.fecha}
                  min={todayISO()} max={RESERVA_CONFIG.sameDayOnly ? todayISO() : undefined}
                  onChange={e => onUpdate('fecha', e.target.value)} style={err('fecha')} />
                {errors.fecha && <p className="field-error">{errors.fecha}</p>}
              </div>
              <div className="form-group form-group-full">
                <label>Duración</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[60, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onUpdateDuracion(mins)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 8,
                        border: `2px solid ${form.duracion === mins ? '#3b82f6' : '#e2e8f0'}`,
                        background: form.duracion === mins ? '#eff6ff' : '#fff',
                        color: form.duracion === mins ? '#1d4ed8' : '#475569',
                        fontWeight: form.duracion === mins ? 700 : 400,
                        cursor: 'pointer', fontSize: 14
                      }}
                    >
                      {mins === 60 ? '1 hora' : '2 horas'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="required">Hora inicio</label>
                <input type="time" value={form.hora_inicio} onChange={e => onUpdateHora(e.target.value)} style={err('hora_inicio')} />
                {errors.hora_inicio && <p className="field-error">{errors.hora_inicio}</p>}
              </div>
              <div className="form-group">
                <label>Hora fin</label>
                <input type="time" value={form.hora_fin} readOnly style={{ background: '#f8fafc' }} />
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select value={form.estado} onChange={e => onUpdate('estado', e.target.value)}>
                  <option value="confirmada">Confirmada</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="no-show">No-show</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? 'Actualizar' : 'Crear'} Reserva</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tooltip de reserva ───────────────────────────────────────────────────────
function ReservaTooltip({ reserva, onEdit, onCancel, onDelete, readOnly }) {
  const estado = normalizeEstadoReserva(reserva.estado);
  const meta = ESTADO_META[estado] || ESTADO_META.confirmada;
  return (
    <div className="reserva-tooltip">
      <p className="tooltip-espacio">{reserva.espacio_nombre}</p>
      <p className="tooltip-socio">{reserva.socio_nombre}</p>
      <p className="tooltip-horario">
        <Clock size={12} /> {toTimeInputValue(reserva.hora_inicio)} — {toTimeInputValue(reserva.hora_fin)}
      </p>
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
        background: meta.bg, color: meta.text, fontSize: 11, fontWeight: 600, marginBottom: 8
      }}>
        {meta.label}
      </span>
      {!readOnly && (
        <div className="tooltip-actions">
          <button onClick={() => onEdit(reserva)} title="Editar"><Edit2 size={13} /></button>
          {estado !== 'cancelada' && (
            <button onClick={() => onCancel(reserva.reserva_id)} title="Cancelar" style={{ color: '#f59e0b' }}>
              <XCircle size={13} />
            </button>
          )}
          <button onClick={() => onDelete(reserva.reserva_id)} title="Eliminar" style={{ color: '#ef4444' }}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tooltip de sesión ───────────────────────────────────────────────────────
function SesionTooltip({ sesion }) {
  return (
    <div className="reserva-tooltip">
      <p className="tooltip-espacio">{sesion.espacio || 'Espacio'}</p>
      <p className="tooltip-socio" style={{ color: '#0d9488' }}>
        {sesion.disciplina || 'Sesión programada'}
      </p>
      <p className="tooltip-horario">
        <Clock size={12} /> {toTimeInputValue(sesion.hora_inicio)} — {toTimeInputValue(sesion.hora_fin)}
      </p>
      <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Users size={11} /> {sesion.instructor || 'Por asignar'}
      </p>
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
        background: '#f0fdfa', color: '#0d9488', fontSize: 11, fontWeight: 600
      }}>
        {sesion.inscritos_actuales ?? 0}/{sesion.cupo_maximo ?? '?'} inscritos
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Reservas({ readOnly = false }) {
  const {toast, showConfirm } = useNotification();
  const [reservas, setReservas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [socios, setSocios] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [filterEspacio, setFilterEspacio] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingReserva, setEditingReserva] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState({});
  const [activeTooltip, setActiveTooltip] = useState(null); // reserva_id
  const [activeSesionKey, setActiveSesionKey] = useState(null); // `${espacio_id}-${sesion_id}-${hora}`
  const [successToast, setSuccessToast] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, eRes, sRes, sesRes, sanRes] = await Promise.all([
        adminApi.getReservas(),
        adminApi.getEspacios(),
        adminApi.getSocios(),
        adminApi.getSesiones(),
        adminApi.getSanciones()
      ]);
      setReservas(rRes);
      setEspacios(eRes.filter(e => e.estado === 'Activo' || e.estado === 'Mantenimiento'));
      setSocios(sRes.filter(s => s.activo === true || s.activo === 'true'));
      setSesiones(sesRes);
      setSanciones(sanRes);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Reservas del día seleccionado y espacio filtrado
  const reservasDelDia = useMemo(() =>
    reservas.filter(r => {
      const fecha = toDateInputValue(r.fecha);
      if (fecha !== selectedDate) return false;
      if (filterEspacio && String(r.espacio_id) !== filterEspacio) return false;
      return normalizeEstadoReserva(r.estado) !== 'cancelada';
    }),
    [reservas, selectedDate, filterEspacio]
  );

  const espaciosFiltrados = useMemo(() =>
    filterEspacio
      ? espacios.filter(e => String(e.espacio_id) === filterEspacio)
      : espacios,
    [espacios, filterEspacio]
  );

  const sancionados = useMemo(() => {
    const ids = new Set();
    sanciones.forEach(s => {
      const st = String(s.estado || '').toLowerCase();
      if (s.activa === true || st === 'activa' || st === 'activo') ids.add(String(s.socio_id));
    });
    return ids;
  }, [sanciones]);

  const espaciosActivos = useMemo(() =>
    espacios.filter(e => e.estado !== 'Mantenimiento'),
    [espacios]
  );

  // O(1) lookup: espacio_id → hour → reserva
  const slotMap = useMemo(() => {
    const map = new Map();
    reservasDelDia.forEach(r => {
      const inicio = parseHHMM(toTimeInputValue(r.hora_inicio));
      const fin    = parseHHMM(toTimeInputValue(r.hora_fin));
      if (inicio === null || fin === null) return;
      const eid = String(r.espacio_id);
      if (!map.has(eid)) map.set(eid, {});
      const byHour = map.get(eid);
      HOURS.forEach(h => { if (h >= inicio && h < fin) byHour[h] = r; });
    });
    return map;
  }, [reservasDelDia]);

  // O(1) lookup: espacio_id → hour → sesion (for selected day-of-week)
  const sessionMap = useMemo(() => {
    const dia = getDiaSemana(selectedDate);
    if (!dia) return new Map();
    const map = new Map();
    sesiones.forEach(s => {
      if (Number(s.dia_semana) !== dia) return;
      const eid = String(s.espacio_id || '');
      if (!eid) return;
      const inicio = parseHHMM(toTimeInputValue(s.hora_inicio));
      const fin    = parseHHMM(toTimeInputValue(s.hora_fin));
      if (inicio === null || fin === null) return;
      if (!map.has(eid)) map.set(eid, {});
      const byHour = map.get(eid);
      HOURS.forEach(h => { if (h >= inicio && h < fin) byHour[h] = s; });
    });
    return map;
  }, [sesiones, selectedDate]);

  // Horario del día seleccionado
  const scheduleHoy = useMemo(() => getScheduleForDay(getDiaSemana(selectedDate)), [selectedDate]);

  // Navegación de fecha
  const changeDate = (delta) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Form helpers
  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };
  const updateHoraInicio = (value) => {
    setForm(prev => ({
      ...prev,
      hora_inicio: value,
      hora_fin: value ? addMinutesToTime(value, prev.duracion || DURACION_MIN) : ''
    }));
    setFormErrors(prev => ({ ...prev, hora_inicio: undefined, hora_fin: undefined }));
  };

  const updateDuracion = (mins) => {
    setForm(prev => ({
      ...prev,
      duracion: mins,
      hora_fin: prev.hora_inicio ? addMinutesToTime(prev.hora_inicio, mins) : ''
    }));
  };

  const resetForm = () => {
    setEditingReserva(null);
    setForm({ ...initialForm, fecha: selectedDate });
    setFormErrors({});
  };

  const openCreate = (espacioId = '', hora = '') => {
    resetForm();
    setForm(prev => ({
      ...prev,
      espacio_id: espacioId ? String(espacioId) : '',
      hora_inicio: hora,
      hora_fin: hora ? addMinutesToTime(hora, prev.duracion || DURACION_MIN) : '',
      fecha: selectedDate
    }));
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditingReserva(r);
    const duracionExistente = minutesBetween(toTimeInputValue(r.hora_inicio), toTimeInputValue(r.hora_fin));
    const duracion = (duracionExistente === 60 || duracionExistente === 120) ? duracionExistente : 60;
    setForm({
      espacio_id: String(r.espacio_id || ''),
      socio_id: String(r.socio_id || ''),
      fecha: toDateInputValue(r.fecha),
      hora_inicio: toTimeInputValue(r.hora_inicio),
      hora_fin: toTimeInputValue(r.hora_fin),
      estado: normalizeEstadoReserva(r.estado),
      duracion
    });
    setFormErrors({});
    setShowModal(true);
    setActiveTooltip(null);
    setActiveSesionKey(null);
  };

  const hasConflict = () => reservas.some(r => {
    if (r.reserva_id === editingReserva?.reserva_id) return false;
    if (String(r.espacio_id) !== form.espacio_id) return false;
    if (toDateInputValue(r.fecha) !== form.fecha) return false;
    if (normalizeEstadoReserva(r.estado) === 'cancelada') return false;
    return timesOverlap(form.hora_inicio, form.hora_fin, r.hora_inicio, r.hora_fin);
  });

  const hasSocioConflict = () => {
    const activas = reservas.filter(r => {
      if (r.reserva_id === editingReserva?.reserva_id) return false;
      if (String(r.socio_id) !== form.socio_id) return false;
      if (toDateInputValue(r.fecha) !== form.fecha) return false;
      return normalizeEstadoReserva(r.estado) !== 'cancelada';
    });
    return activas.length >= RESERVA_CONFIG.maxPerSocio; // máx. 2 reservas por día
  };

  // Verifica solapamiento de horario para el mismo socio (sin importar el espacio)
  const hasSocioTimeConflict = () => {
    if (!form.socio_id || !form.fecha || !form.hora_inicio || !form.hora_fin) return false;
    return reservas.some(r => {
      if (r.reserva_id === editingReserva?.reserva_id) return false;
      if (String(r.socio_id) !== form.socio_id) return false;
      if (toDateInputValue(r.fecha) !== form.fecha) return false;
      if (normalizeEstadoReserva(r.estado) === 'cancelada') return false;
      return timesOverlap(form.hora_inicio, form.hora_fin, r.hora_inicio, r.hora_fin);
    });
  };

  const hasSessionConflict = () => {
    const esp = espacios.find(e => String(e.espacio_id) === form.espacio_id);
    const dia = getDiaSemana(form.fecha);
    return sesiones.some(s => {
      const byId = s.espacio_id && String(s.espacio_id) === form.espacio_id;
      const byName = esp?.nombre && normalizeText(s.espacio) === normalizeText(esp.nombre);
      return (byId || byName) &&
        Number(s.dia_semana) === Number(dia) &&
        timesOverlap(form.hora_inicio, form.hora_fin, s.hora_inicio, s.hora_fin);
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!form.espacio_id) errors.espacio_id = 'Selecciona un espacio';
    if (!form.socio_id) errors.socio_id = 'Selecciona un socio';
    if (!form.fecha) errors.fecha = 'Selecciona una fecha';
    if (!form.hora_inicio) errors.hora_inicio = 'Selecciona la hora de inicio';
    if (!form.hora_fin) errors.hora_fin = 'Hora fin requerida';
    if (form.hora_inicio && form.hora_fin) {
      const dur = minutesBetween(form.hora_inicio, form.hora_fin);
      const duracionEsperada = form.duracion || DURACION_MIN;
      if (dur !== duracionEsperada) errors.hora_fin = `La reserva debe durar ${duracionEsperada} minutos`;
    }
    const activa = !INACTIVE_ESTADOS.includes(form.estado);
    if (activa) {
      if (sancionados.has(form.socio_id)) errors.socio_id = 'El socio tiene sanción activa';
      if (!errors.socio_id && hasSocioTimeConflict())
        errors.socio_id = 'El socio ya tiene una reserva activa en ese horario';
      if (!errors.socio_id && form.socio_id && hasSocioConflict())
        errors.socio_id = `El socio ya tiene ${RESERVA_CONFIG.maxPerSocio} reservas activas para ese día`;
      if (form.espacio_id && form.fecha && form.hora_inicio && hasConflict())
        errors.hora_inicio = 'El espacio ya está reservado en ese horario';
      if (form.espacio_id && form.fecha && form.hora_inicio && hasSessionConflict())
        errors.hora_inicio = 'Conflicto con una sesión programada';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    try {
      await adminApi.saveReserva(form, editingReserva?.reserva_id);
      await fetchData();
      setShowModal(false);
      resetForm();
      showToast(editingReserva ? 'Reserva actualizada' : 'Reserva creada exitosamente');
    } catch (err) {
      toast(err.message || 'Error al guardar reserva', 'error');
    }
  };

  const handleCancel = async (id) => {
    if (!await showConfirm('¿Cancelar esta reserva?')) return;
    try {
      await adminApi.cancelarReserva(id);
      await fetchData();
      setActiveTooltip(null);
      setActiveSesionKey(null);
      showToast('Reserva cancelada');
    } catch (err) {
      toast(err.message || 'Error al cancelar reserva', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!await showConfirm('¿Eliminar esta reserva permanentemente?', { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await adminApi.deleteReserva(id);
      await fetchData();
      setActiveTooltip(null);
      showToast('Reserva eliminada');
    } catch (err) {
      toast(err.message || 'Error al eliminar reserva', 'error');
    }
  };

  if (loading) return <LoadingState message="Cargando reservas..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={fetchData} />;

  const fechaLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="reservas-root">
      {/* Toast */}
      {successToast && (
        <div className="success-toast">
          <CheckCircle size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="reservas-header">
        <div className="reservas-header-left">
          <h3>Sistema de Reservas</h3>
          <p>Vista en tiempo real de canchas, albercas y gimnasios</p>
        </div>
        <div className="reservas-header-right">
          <div className="reservas-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: '#1e3a5f' }} /> Confirmada</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#f59e0b' }} /> Pendiente</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }} /> No Show</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#0d9488' }} /> Sesión</span>
          </div>
          <label className="admin-filter">
            <span>Espacio</span>
            <select
              value={filterEspacio}
              onChange={e => setFilterEspacio(e.target.value)}
            >
              <option value="">Todos los espacios</option>
              {espacios.map(e => (
                <option key={e.espacio_id} value={e.espacio_id}>
                  {e.nombre}{e.estado === 'Mantenimiento' ? ' — Mant.' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="reservas-toolbar">
        {!readOnly && (
          <button className="btn-primary" onClick={() => openCreate()}>
            <Plus size={16} /> Nueva Reserva
          </button>
        )}
        <div className="reservas-date-nav">
          <button className="btn-icon-nav" onClick={() => changeDate(-1)}><ChevronLeft size={18} /></button>
          <div className="reservas-date-label">
            <strong>Rejilla de Reservas &mdash; {selectedDate}</strong>
            <span>
              {scheduleHoy.cerrado
                ? '🚫 Lunes — Club Cerrado'
                : scheduleHoy.apertura === 7
                  ? '🕐 Domingo: 7:00 – 19:00'
                  : '🕐 Mar–Sáb: 6:00 – 22:00 · Dom: 7:00 – 19:00 · Lun Cerrado'}
            </span>
          </div>
          <button className="btn-icon-nav" onClick={() => changeDate(1)}><ChevronRight size={18} /></button>
        </div>
        <button className="btn-outline-sm" onClick={() => setSelectedDate(todayISO())}>
          <Calendar size={14} /> Hoy
        </button>
        <button className="btn-icon" onClick={fetchData} title="Actualizar"><RefreshCw size={16} /></button>
      </div>

      {/* Banner Lunes cerrado */}
      {scheduleHoy.cerrado && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.25rem', borderRadius: '10px', marginBottom: '1rem',
          background: '#f1f5f9', color: '#475569', fontWeight: 600, fontSize: '0.9rem',
          border: '1px solid #e2e8f0'
        }}>
          🚫 <span><strong>Lunes — Club Cerrado.</strong> No se pueden crear reservas este día.</span>
        </div>
      )}

      {/* Rejilla */}
      <div className="reservas-grid-wrapper">
        <div className="reservas-grid" onClick={() => { setActiveTooltip(null); setActiveSesionKey(null); }}>
          {/* Encabezado de horas */}
          <div className="grid-header">
            <div className="grid-space-col">Espacio</div>
            {HOURS.map(h => (
              <div key={h} className="grid-hour-label"
                style={scheduleHoy.cerrado || h < scheduleHoy.apertura || h >= scheduleHoy.cierre
                  ? { opacity: 0.35 } : {}}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Filas de espacios */}
          {espaciosFiltrados.map(espacio => (
            <div key={espacio.espacio_id} className="grid-row">
              {/* Info espacio */}
              <div className="grid-space-info">
                <span
                  className="grid-space-dot"
                  style={{ background: espacio.estado === 'Mantenimiento' ? '#f97316' : (espacio.activo ? '#10b981' : '#94a3b8') }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <strong>{espacio.nombre}</strong>
                    {espacio.estado === 'Mantenimiento' && (
                      <span style={{ fontSize: 10, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 3, padding: '1px 5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Mantenimiento
                      </span>
                    )}
                  </div>
                  <span>{espacio.disciplina || 'General'} &mdash; Cap. {espacio.capacidad_maxima || 'N/D'}</span>
                </div>
              </div>

              {/* Celdas de horas */}
              {HOURS.map(h => {
                const hora = h;
                const reserva = slotMap.get(String(espacio.espacio_id))?.[hora] ?? null;
                const sesion  = !reserva ? (sessionMap.get(String(espacio.espacio_id))?.[hora] ?? null) : null;
                const estado = reserva ? normalizeEstadoReserva(reserva.estado) : null;
                const meta = estado ? (ESTADO_META[estado] || ESTADO_META.confirmada) : null;
                const isTooltipActive = reserva && activeTooltip === reserva.reserva_id;
                const isStart = reserva && parseHHMM(toTimeInputValue(reserva.hora_inicio)) === hora;
                const isSesionStart = sesion && parseHHMM(toTimeInputValue(sesion.hora_inicio)) === hora;

                const enMantenimiento = espacio.estado === 'Mantenimiento';
                const fueraDeHorario  = scheduleHoy.cerrado
                  || h < scheduleHoy.apertura
                  || h >= scheduleHoy.cierre;

                return (
                  <div
                    key={h}
                    className={`grid-cell ${enMantenimiento ? 'mantenimiento' : (reserva ? 'has-reserva' : 'disponible')}`}
                    style={
                      enMantenimiento   ? { background: '#fff7ed', cursor: 'not-allowed' }
                      : fueraDeHorario  ? { background: '#f8fafc', cursor: 'not-allowed', opacity: 0.45 }
                      : sesion && !reserva ? { background: '#f0fdfa' }
                      : {}
                    }
                    onClick={e => {
                      e.stopPropagation();
                      if (enMantenimiento || fueraDeHorario) return;
                      if (reserva) {
                        setActiveSesionKey(null);
                        setActiveTooltip(isTooltipActive ? null : reserva.reserva_id);
                      } else if (sesion) {
                        setActiveTooltip(null);
                        const key = `${espacio.espacio_id}-${sesion.sesion_id}-${hora}`;
                        setActiveSesionKey(activeSesionKey === key ? null : key);
                      } else if (!readOnly) {
                        setActiveSesionKey(null);
                        openCreate(espacio.espacio_id, `${String(hora).padStart(2, '0')}:00`);
                      }
                    }}
                  >
                    {enMantenimiento && h === GRID_START && (
                      <div
                        className="grid-block"
                        style={{ background: '#f97316', cursor: 'not-allowed', minWidth: 80, whiteSpace: 'nowrap' }}
                        title="Espacio en mantenimiento — no disponible para reservas"
                      >
                        <span style={{ fontSize: 9, fontWeight: 600 }}>En mantenimiento</span>
                      </div>
                    )}

                    {!enMantenimiento && isStart && reserva && meta && (
                      <div
                        className="grid-block"
                        style={{ background: meta.color }}
                        title={`${reserva.socio_nombre} — ${toTimeInputValue(reserva.hora_inicio)} a ${toTimeInputValue(reserva.hora_fin)}`}
                      >
                        <Clock size={11} color="#fff" />
                      </div>
                    )}

                    {!enMantenimiento && sesion && (
                      <div
                        className="grid-block"
                        style={{ background: '#0d9488', cursor: 'pointer', gap: 3 }}
                      >
                        <Users size={10} color="#fff" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9 }}>
                          {sesion.disciplina || 'Sesión'}
                        </span>
                      </div>
                    )}

                    {!enMantenimiento && sesion && activeSesionKey === `${espacio.espacio_id}-${sesion.sesion_id}-${hora}` && (
                      <SesionTooltip sesion={sesion} />
                    )}

                    {!enMantenimiento && isTooltipActive && isStart && (
                      <ReservaTooltip
                        reserva={reserva}
                        onEdit={openEdit}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        readOnly={readOnly}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {espaciosFiltrados.length === 0 && (
            <div className="grid-empty">No hay espacios disponibles</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && !readOnly && (
        <ReservaModal
          editing={editingReserva}
          form={form}
          errors={formErrors}
          espacios={espaciosActivos}
          socios={socios}
          sancionados={sancionados}
          onClose={() => { setShowModal(false); resetForm(); }}
          onSubmit={handleSubmit}
          onUpdate={updateForm}
          onUpdateHora={updateHoraInicio}
          onUpdateDuracion={updateDuracion}
        />
      )}
    </div>
  );
}
