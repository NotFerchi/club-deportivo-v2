import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, CheckCircle, ChevronLeft, ChevronRight,
  Clock, Edit2, Plus, RefreshCw, Trash2, X, XCircle
} from 'lucide-react';
import { adminApi } from '../../../services/api';
import {
  addMinutesToTime, getFullName, getSocioNumero,
  minutesBetween, normalizeEstadoReserva, normalizeText,
  timesOverlap, todayISO, toDateInputValue, toTimeInputValue
} from '../../../utils/adminData';
import { LoadingState, ErrorState } from '../../../components/admin/AdminUI';

// ─── Config ───────────────────────────────────────────────────────────────────
const GRID_START = 7;   // 07:00
const GRID_END   = 21;  // 21:00
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);

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
  hora_inicio: '', hora_fin: '', estado: 'confirmada'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseHHMM(t) {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) ? h + (m || 0) / 60 : null;
}
function getDiaSemana(fecha) {
  const [y, mo, d] = String(fecha || '').split('-').map(Number);
  if (!y) return null;
  return new Date(y, mo - 1, d).getDay() + 1;
}

// ─── Modal de formulario ──────────────────────────────────────────────────────
function ReservaModal({ editing, form, errors, espacios, socios, sancionados, onClose, onSubmit, onUpdate, onUpdateHora }) {
  const err = (f) => errors[f] ? { borderColor: '#ef4444', backgroundColor: '#fff1f0' } : {};
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div>
            <h3>{editing ? 'Editar Reserva' : 'Nueva Reserva'}</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>La hora fin se calcula automáticamente ({DURACION_MIN} min)</p>
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

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Reservas({ readOnly = false }) {
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
  const [toast, setToast] = useState('');
  const [activeTooltip, setActiveTooltip] = useState(null); // reserva_id

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
      setEspacios(eRes.filter(e => e.activo === true || e.activo === 'true'));
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
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
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
      hora_fin: value ? addMinutesToTime(value, DURACION_MIN) : ''
    }));
    setFormErrors(prev => ({ ...prev, hora_inicio: undefined, hora_fin: undefined }));
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
      hora_fin: hora ? addMinutesToTime(hora, DURACION_MIN) : '',
      fecha: selectedDate
    }));
    setShowModal(true);
  };

  const openEdit = (r) => {
    setEditingReserva(r);
    setForm({
      espacio_id: String(r.espacio_id || ''),
      socio_id: String(r.socio_id || ''),
      fecha: toDateInputValue(r.fecha),
      hora_inicio: toTimeInputValue(r.hora_inicio),
      hora_fin: toTimeInputValue(r.hora_fin),
      estado: normalizeEstadoReserva(r.estado)
    });
    setFormErrors({});
    setShowModal(true);
    setActiveTooltip(null);
  };

  const hasConflict = () => reservas.some(r => {
    if (r.reserva_id === editingReserva?.reserva_id) return false;
    if (String(r.espacio_id) !== form.espacio_id) return false;
    if (toDateInputValue(r.fecha) !== form.fecha) return false;
    if (normalizeEstadoReserva(r.estado) === 'cancelada') return false;
    return timesOverlap(form.hora_inicio, form.hora_fin, r.hora_inicio, r.hora_fin);
  });

  const hasSocioConflict = () => reservas.some(r => {
    if (r.reserva_id === editingReserva?.reserva_id) return false;
    if (String(r.socio_id) !== form.socio_id) return false;
    if (toDateInputValue(r.fecha) !== form.fecha) return false;
    return normalizeEstadoReserva(r.estado) !== 'cancelada';
  });

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
    if (form.fecha && RESERVA_CONFIG.sameDayOnly && form.fecha !== todayISO())
      errors.fecha = 'Solo se permiten reservas para hoy';
    if (form.hora_inicio && form.hora_fin) {
      const dur = minutesBetween(form.hora_inicio, form.hora_fin);
      if (dur !== DURACION_MIN) errors.hora_fin = `La reserva debe durar ${DURACION_MIN} minutos`;
    }
    const activa = !INACTIVE_ESTADOS.includes(form.estado);
    if (activa) {
      if (sancionados.has(form.socio_id)) errors.socio_id = 'El socio tiene sanción activa';
      if (form.socio_id && hasSocioConflict()) errors.socio_id = 'El socio ya tiene reserva activa para ese día';
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
      alert(err.message || 'Error al guardar reserva');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await adminApi.cancelarReserva(id);
      await fetchData();
      setActiveTooltip(null);
      showToast('Reserva cancelada');
    } catch (err) {
      alert(err.message || 'Error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta reserva permanentemente?')) return;
    try {
      await adminApi.deleteReserva(id);
      await fetchData();
      setActiveTooltip(null);
      showToast('Reserva eliminada');
    } catch (err) {
      alert(err.message || 'Error');
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
      {toast && (
        <div className="success-toast">
          <CheckCircle size={18} />
          <span>{toast}</span>
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
            <span className="legend-item"><span className="legend-dot" style={{ background: '#9ca3af' }} /> Mantenimiento</span>
          </div>
          <select
            className="reservas-filter-select"
            value={filterEspacio}
            onChange={e => setFilterEspacio(e.target.value)}
          >
            <option value="">Todos los espacios</option>
            {espacios.map(e => (
              <option key={e.espacio_id} value={e.espacio_id}>{e.nombre}</option>
            ))}
          </select>
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
            <span>Vista de todas las canchas y espacios disponibles</span>
          </div>
          <button className="btn-icon-nav" onClick={() => changeDate(1)}><ChevronRight size={18} /></button>
        </div>
        <button className="btn-outline-sm" onClick={() => setSelectedDate(todayISO())}>
          <Calendar size={14} /> Hoy
        </button>
        <button className="btn-icon" onClick={fetchData} title="Actualizar"><RefreshCw size={16} /></button>
      </div>

      {/* Rejilla */}
      <div className="reservas-grid-wrapper">
        <div className="reservas-grid" onClick={() => setActiveTooltip(null)}>
          {/* Encabezado de horas */}
          <div className="grid-header">
            <div className="grid-space-col">Espacio</div>
            {HOURS.map(h => (
              <div key={h} className="grid-hour-label">
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
                  style={{ background: espacio.activo ? '#10b981' : '#94a3b8' }}
                />
                <div>
                  <strong>{espacio.nombre}</strong>
                  <span>{espacio.disciplina || 'General'} &mdash; Cap. {espacio.capacidad_maxima || 'N/D'}</span>
                </div>
              </div>

              {/* Celdas de horas */}
              {HOURS.map(h => {
                const hora = h;
                const reserva = slotMap.get(String(espacio.espacio_id))?.[hora] ?? null;
                const estado = reserva ? normalizeEstadoReserva(reserva.estado) : null;
                const meta = estado ? (ESTADO_META[estado] || ESTADO_META.confirmada) : null;
                const isTooltipActive = reserva && activeTooltip === reserva.reserva_id;

                // Si ya hay una reserva que empieza en una hora anterior y cubre este slot, no la repintamos
                const isStart = reserva && parseHHMM(toTimeInputValue(reserva.hora_inicio)) === hora;

                return (
                  <div
                    key={h}
                    className={`grid-cell ${reserva ? 'has-reserva' : 'disponible'}`}
                    onClick={e => {
                      e.stopPropagation();
                      if (!reserva && !readOnly) {
                        openCreate(espacio.espacio_id, `${String(hora).padStart(2, '0')}:00`);
                      } else if (reserva) {
                        setActiveTooltip(isTooltipActive ? null : reserva.reserva_id);
                      }
                    }}
                  >
                    {isStart && reserva && meta && (
                      <div
                        className="grid-block"
                        style={{ background: meta.color }}
                        title={`${reserva.socio_nombre} — ${toTimeInputValue(reserva.hora_inicio)} a ${toTimeInputValue(reserva.hora_fin)}`}
                      >
                        <Clock size={11} color="#fff" />
                      </div>
                    )}

                    {/* Tooltip */}
                    {isTooltipActive && isStart && (
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
          espacios={espacios}
          socios={socios}
          sancionados={sancionados}
          onClose={() => { setShowModal(false); resetForm(); }}
          onSubmit={handleSubmit}
          onUpdate={updateForm}
          onUpdateHora={updateHoraInicio}
        />
      )}
    </div>
  );
}
