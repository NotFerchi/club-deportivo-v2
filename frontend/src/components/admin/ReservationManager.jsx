import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle, Clock, Edit2, Plus, Trash2, X, XCircle } from 'lucide-react';
import { adminApi } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { ErrorState, FilterSelect, LoadingState, ModuleHeader, SearchInput, StatCard } from './AdminUI';
import {
  addMinutesToTime,
  estadoReservaLabel,
  formatDate,
  getSocioNumero,
  minutesBetween,
  normalizeEstadoReserva,
  normalizeText,
  timesOverlap,
  todayISO,
  toDateInputValue,
  toTimeInputValue
} from '../../utils/adminData';

const RESERVA_CONFIG = {
  sameDayOnly: true,
  durationMinutes: 60,
  maxActiveReservationsPerSocio: 1
};

const estados = ['confirmada', 'cancelada', 'no-show', 'sancionada'];
const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

const initialFormData = {
  espacio_id: '',
  socio_id: '',
  fecha: todayISO(),
  hora_inicio: '',
  hora_fin: '',
  estado: 'confirmada'
};

function getSocioName(socio) {
  return [socio?.nombres, socio?.apellido_paterno].filter(Boolean).join(' ').trim();
}

function getDiaSemana(fecha) {
  const [year, month, day] = String(fecha || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const js = new Date(year, month - 1, day).getDay();
  return js === 0 ? 7 : js;
}

function EstadoIcon({ estado }) {
  const normalized = normalizeEstadoReserva(estado);
  if (normalized === 'confirmada') return <CheckCircle size={13} />;
  if (normalized === 'cancelada') return <XCircle size={13} />;
  if (normalized === 'no-show' || normalized === 'sancionada') return <AlertTriangle size={13} />;
  return <Clock size={13} />;
}

function getEstadoBadge(estado) {
  const normalized = normalizeEstadoReserva(estado);
  if (normalized === 'confirmada') return 'badge-success';
  if (normalized === 'cancelada') return 'badge-danger';
  if (normalized === 'no-show' || normalized === 'sancionada') return 'badge-danger';
  return 'badge-warning';
}

function ReservaFormModal({
  editingReserva,
  formData,
  formErrors,
  espacios,
  socios,
  sociosSancionados,
  onClose,
  onSubmit,
  onUpdateForm,
  onUpdateStartTime
}) {
  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <div>
            <h3>{editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}</h3>
            <p className="form-alert" style={{ margin: 0 }}>
              La hora de fin se calcula automaticamente con la duracion configurada.
            </p>
          </div>
          <button onClick={onClose} className="close-modal"><X size={24} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="required">Espacio</label>
                <select value={formData.espacio_id} onChange={event => onUpdateForm('espacio_id', event.target.value)} style={getInputStyles('espacio_id')}>
                  <option value="">Seleccione un espacio</option>
                  {espacios.map(espacio => (
                    <option key={espacio.espacio_id} value={espacio.espacio_id}>
                      {espacio.nombre} (Cap: {espacio.capacidad_maxima || 'N/D'})
                    </option>
                  ))}
                </select>
                {formErrors.espacio_id && <p className="field-error">{formErrors.espacio_id}</p>}
              </div>

              <div className="form-group">
                <label className="required">Socio</label>
                <select value={formData.socio_id} onChange={event => onUpdateForm('socio_id', event.target.value)} style={getInputStyles('socio_id')}>
                  <option value="">Seleccione un socio</option>
                  {socios.map(socio => (
                    <option key={socio.socio_id} value={socio.socio_id} disabled={sociosSancionados.has(String(socio.socio_id))}>
                      {getSocioName(socio)} - {getSocioNumero(socio) || 'Sin numero'}{sociosSancionados.has(String(socio.socio_id)) ? ' (sancionado)' : ''}
                    </option>
                  ))}
                </select>
                {formErrors.socio_id && <p className="field-error">{formErrors.socio_id}</p>}
              </div>

              <div className="form-group">
                <label className="required">Fecha</label>
                <input
                  type="date"
                  value={formData.fecha}
                  min={todayISO()}
                  max={RESERVA_CONFIG.sameDayOnly ? todayISO() : undefined}
                  onChange={event => onUpdateForm('fecha', event.target.value)}
                  style={getInputStyles('fecha')}
                />
                {formErrors.fecha && <p className="field-error">{formErrors.fecha}</p>}
              </div>

              <div className="form-group">
                <label className="required">Hora inicio</label>
                <input type="time" value={formData.hora_inicio} onChange={event => onUpdateStartTime(event.target.value)} style={getInputStyles('hora_inicio')} />
                {formErrors.hora_inicio && <p className="field-error">{formErrors.hora_inicio}</p>}
              </div>

              <div className="form-group">
                <label className="required">Hora fin</label>
                <input type="time" value={formData.hora_fin} readOnly style={getInputStyles('hora_fin')} />
                {formErrors.hora_fin && <p className="field-error">{formErrors.hora_fin}</p>}
              </div>

              <div className="form-group">
                <label>Estado</label>
                <select value={formData.estado} onChange={event => onUpdateForm('estado', event.target.value)} style={getInputStyles('estado')}>
                  <option value="confirmada">Confirmada</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="no-show">No-show</option>
                  <option value="sancionada">Sancionada</option>
                </select>
                {formErrors.estado && <p className="field-error">{formErrors.estado}</p>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary">
              {editingReserva ? 'Actualizar' : 'Crear'} Reserva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReservationManager({
  title = 'Gestion de Reservas',
  subtitle,
  dailyMode = false,
  readOnly = false
}) {
  const { toast, showConfirm } = useNotification();
  const [reservas, setReservas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [socios, setSocios] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingReserva, setEditingReserva] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFecha, setFilterFecha] = useState(dailyMode ? todayISO() : '');
  const [filterEspacio, setFilterEspacio] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reservasData, espaciosData, sociosData, sesionesData, sancionesData] = await Promise.all([
        adminApi.getReservas(),
        adminApi.getEspacios(),
        adminApi.getSocios(),
        adminApi.getSesiones(),
        adminApi.getSanciones()
      ]);
      setReservas(reservasData);
      setEspacios(espaciosData.filter(espacio => espacio.activo === true || espacio.activo === 'true'));
      setSocios(sociosData.filter(socio => socio.activo === true || socio.activo === 'true'));
      setSesiones(sesionesData);
      setSanciones(sancionesData);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredReservas = useMemo(() => {
    const query = normalizeText(searchTerm);
    return reservas.filter(reserva => {
      const estado = normalizeEstadoReserva(reserva.estado);
      const text = normalizeText([
        reserva.socio_nombre,
        reserva.espacio_nombre,
        reserva.numero_socio,
        reserva.socio_numero
      ].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterEstado && estado !== filterEstado) return false;
      if (filterFecha && toDateInputValue(reserva.fecha) !== filterFecha) return false;
      if (filterEspacio && String(reserva.espacio_id) !== filterEspacio) return false;
      return true;
    });
  }, [reservas, searchTerm, filterEstado, filterFecha, filterEspacio]);

  const estadisticas = useMemo(() => ({
    total: filteredReservas.length,
    confirmadas: filteredReservas.filter(r => normalizeEstadoReserva(r.estado) === 'confirmada').length,
    canceladas: filteredReservas.filter(r => normalizeEstadoReserva(r.estado) === 'cancelada').length,
    noShows: filteredReservas.filter(r => normalizeEstadoReserva(r.estado) === 'no-show' || r.no_show === true).length
  }), [filteredReservas]);

  const reservasPorEspacio = useMemo(() => {
    const counts = new Map();
    filteredReservas.forEach(reserva => {
      counts.set(String(reserva.espacio_id), (counts.get(String(reserva.espacio_id)) || 0) + 1);
    });
    return counts;
  }, [filteredReservas]);

  const sociosSancionados = useMemo(() => {
    const ids = new Set();
    sanciones.forEach(sancion => {
      const estado = String(sancion.estado || '').toLowerCase();
      if (sancion.activa === true || estado === 'activa' || estado === 'activo') {
        ids.add(String(sancion.socio_id));
      }
    });
    return ids;
  }, [sanciones]);

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const updateStartTime = (value) => {
    setFormData(prev => ({
      ...prev,
      hora_inicio: value,
      hora_fin: value ? addMinutesToTime(value, RESERVA_CONFIG.durationMinutes) : ''
    }));
    setFormErrors(prev => ({ ...prev, hora_inicio: undefined, hora_fin: undefined }));
  };

  const resetForm = () => {
    setEditingReserva(null);
    setFormData({ ...initialFormData, fecha: filterFecha || todayISO() });
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (reserva) => {
    setEditingReserva(reserva);
    setFormData({
      espacio_id: reserva.espacio_id?.toString() || '',
      socio_id: reserva.socio_id?.toString() || '',
      fecha: toDateInputValue(reserva.fecha),
      hora_inicio: toTimeInputValue(reserva.hora_inicio),
      hora_fin: toTimeInputValue(reserva.hora_fin),
      estado: normalizeEstadoReserva(reserva.estado)
    });
    setFormErrors({});
    setShowModal(true);
  };

  const hasReservationConflict = () => reservas.some(reserva => {
    if (reserva.reserva_id === editingReserva?.reserva_id) return false;
    if (String(reserva.espacio_id) !== String(formData.espacio_id)) return false;
    if (toDateInputValue(reserva.fecha) !== formData.fecha) return false;
    if (normalizeEstadoReserva(reserva.estado) === 'cancelada') return false;
    return timesOverlap(formData.hora_inicio, formData.hora_fin, reserva.hora_inicio, reserva.hora_fin);
  });

  const hasSocioReservation = () => reservas.some(reserva => {
    if (reserva.reserva_id === editingReserva?.reserva_id) return false;
    if (String(reserva.socio_id) !== String(formData.socio_id)) return false;
    if (toDateInputValue(reserva.fecha) !== formData.fecha) return false;
    return normalizeEstadoReserva(reserva.estado) !== 'cancelada';
  });

  const hasSessionConflict = () => {
    const espacio = espacios.find(item => String(item.espacio_id) === String(formData.espacio_id));
    const diaSemana = getDiaSemana(formData.fecha);

    return sesiones.some(sesion => {
      const sameSpaceById = sesion.espacio_id && String(sesion.espacio_id) === String(formData.espacio_id);
      const sameSpaceByName = espacio?.nombre && normalizeText(sesion.espacio) === normalizeText(espacio.nombre);

      return (sameSpaceById || sameSpaceByName) &&
        Number(sesion.dia_semana) === Number(diaSemana) &&
        timesOverlap(formData.hora_inicio, formData.hora_fin, sesion.hora_inicio, sesion.hora_fin);
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.espacio_id) errors.espacio_id = 'Seleccione un espacio';
    if (!formData.socio_id) errors.socio_id = 'Seleccione un socio';
    if (!formData.fecha) errors.fecha = 'Seleccione una fecha';
    if (!formData.hora_inicio) errors.hora_inicio = 'Seleccione hora de inicio';
    if (!formData.hora_fin) errors.hora_fin = 'Hora fin requerida';

    if (formData.fecha && RESERVA_CONFIG.sameDayOnly && formData.fecha !== todayISO()) {
      errors.fecha = 'Solo se permiten reservas para el mismo dia';
    }

    if (formData.hora_inicio && formData.hora_fin) {
      const duration = minutesBetween(formData.hora_inicio, formData.hora_fin);
      if (duration !== RESERVA_CONFIG.durationMinutes) {
        errors.hora_fin = `La reserva debe durar ${RESERVA_CONFIG.durationMinutes} minutos`;
      }
    }

    if (!estados.includes(formData.estado)) errors.estado = 'Estado de reserva invalido';
    const reservaActiva = !['cancelada', 'no-show', 'sancionada'].includes(formData.estado);
    if (reservaActiva) {
      if (sociosSancionados.has(String(formData.socio_id))) errors.socio_id = 'El socio tiene una sancion activa';
      if (formData.socio_id && hasSocioReservation()) errors.socio_id = 'El socio ya tiene una reserva activa para ese dia';
      if (formData.espacio_id && formData.fecha && formData.hora_inicio && formData.hora_fin && hasReservationConflict()) {
        errors.hora_inicio = 'El espacio ya esta reservado en ese horario';
      }
      if (formData.espacio_id && formData.fecha && formData.hora_inicio && formData.hora_fin && hasSessionConflict()) {
        errors.hora_inicio = 'El horario entra en conflicto con una sesion programada';
      }
    }

    return errors;
  };

  const showToast = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await adminApi.saveReserva(formData, editingReserva?.reserva_id);
      await fetchData();
      setShowModal(false);
      resetForm();
      showToast(editingReserva ? 'Reserva actualizada correctamente' : 'Reserva creada correctamente');
    } catch (error) {
      toast(error.message || 'Error al guardar reserva', 'error');
    }
  };

  const cancelarReserva = async (id) => {
    if (!await showConfirm('¿Cancelar esta reserva? Esta accion no se puede deshacer.')) return;
    try {
      await adminApi.cancelarReserva(id);
      await fetchData();
      showToast('Reserva cancelada correctamente');
    } catch (error) {
      toast(error.message || 'Error al cancelar reserva', 'error');
    }
  };

  const deleteReserva = async (id) => {
    if (!await showConfirm('¿Eliminar esta reserva permanentemente? Esta accion no se puede deshacer.', { danger: true, confirmLabel: 'Eliminar' })) return;
    try {
      await adminApi.deleteReserva(id);
      await fetchData();
      showToast('Reserva eliminada permanentemente');
    } catch (error) {
      toast(error.message || 'Error al eliminar reserva', 'error');
    }
  };

  if (loading) return <LoadingState message="Cargando reservas..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={fetchData} />;

  return (
    <div className="chart-box">
      {showSuccess && (
        <div className="success-toast">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <ModuleHeader
        icon={CalendarDays}
        title={title}
        count={filteredReservas.length}
        subtitle={subtitle || `Reglas activas: mismo dia, ${RESERVA_CONFIG.durationMinutes} minutos, ${RESERVA_CONFIG.maxActiveReservationsPerSocio} reserva por socio.`}
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar socio, numero o espacio" />
            {!readOnly && (
              <button className="btn-primary" onClick={openCreateModal}>
                <Plus size={16} /> Nueva Reserva
              </button>
            )}
          </>
        )}
      />

      <div className="reservation-stats-row">
        <StatCard icon={CalendarDays} label="Total filtradas" value={estadisticas.total} tone="info" />
        <StatCard icon={CheckCircle} label="Confirmadas" value={estadisticas.confirmadas} tone="success" />
        <StatCard icon={XCircle} label="Canceladas" value={estadisticas.canceladas} tone="danger" />
        <StatCard icon={AlertTriangle} label="No-shows" value={estadisticas.noShows} tone="warning" />
      </div>

      <div className="admin-filter-row">
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="confirmada">Confirmadas</option>
          <option value="cancelada">Canceladas</option>
          <option value="no-show">No-shows</option>
          <option value="sancionada">Sancionadas</option>
        </FilterSelect>
        <label className="admin-filter">
          <span>Fecha</span>
          <input type="date" value={filterFecha} onChange={event => setFilterFecha(event.target.value)} />
        </label>
        <FilterSelect label="Espacio" value={filterEspacio} onChange={setFilterEspacio}>
          <option value="">Todos</option>
          {espacios.map(espacio => (
            <option key={espacio.espacio_id} value={espacio.espacio_id}>{espacio.nombre}</option>
          ))}
        </FilterSelect>
        {(filterEstado || filterFecha || filterEspacio) && (
          <button onClick={() => { setFilterEstado(''); setFilterFecha(dailyMode ? todayISO() : ''); setFilterEspacio(''); }} className="btn-outline">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="reservation-workspace">
        <aside className="reservation-space-panel">
          <div className="tb-panel-title">
            <strong>Espacios</strong>
            <span>{espacios.length}</span>
          </div>
          <div className="reservation-space-list">
            {espacios.map(espacio => {
              const selected = String(espacio.espacio_id) === String(filterEspacio);
              return (
                <button
                  key={espacio.espacio_id}
                  className={`reservation-space-card ${selected ? 'is-selected' : ''}`}
                  onClick={() => setFilterEspacio(selected ? '' : String(espacio.espacio_id))}
                  type="button"
                >
                  <strong>{espacio.nombre}</strong>
                  <span>{espacio.disciplina || 'Sin disciplina'} - Cap. {espacio.capacidad_maxima || 'N/D'}</span>
                  <em>{reservasPorEspacio.get(String(espacio.espacio_id)) || 0} reservas</em>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="reservation-table-panel">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Espacio</th>
                  <th>Socio</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Estado</th>
                  {!readOnly && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filteredReservas.map(reserva => {
                  const estado = normalizeEstadoReserva(reserva.estado);
                  return (
                    <tr key={reserva.reserva_id} style={estado === 'cancelada' ? { opacity: 0.65 } : {}}>
                      <td>
                        <strong>{reserva.espacio_nombre}</strong>
                        <br />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {reserva.espacio_id}</span>
                      </td>
                      <td>
                        <strong>{reserva.socio_nombre}</strong>
                        <br />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{reserva.numero_socio || reserva.socio_numero || 'Sin numero'}</span>
                      </td>
                      <td><span style={{ fontWeight: 500 }}>{formatDate(reserva.fecha)}</span></td>
                      <td><span className="inline-icon"><Clock size={12} /> {toTimeInputValue(reserva.hora_inicio)} - {toTimeInputValue(reserva.hora_fin)}</span></td>
                      <td>
                        <span className={getEstadoBadge(reserva.estado)}>
                          <EstadoIcon estado={reserva.estado} />
                          {estadoReservaLabel(reserva.estado)}
                        </span>
                      </td>
                      {!readOnly && (
                        <td style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button onClick={() => openEditModal(reserva)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar reserva">
                            <Edit2 size={16} />
                          </button>
                          {estado !== 'cancelada' && (
                            <button onClick={() => cancelarReserva(reserva.reserva_id)} className="btn-icon" style={{ color: '#f59e0b' }} title="Cancelar reserva">
                              <XCircle size={16} />
                            </button>
                          )}
                          <button onClick={() => deleteReserva(reserva.reserva_id)} className="btn-icon" style={{ color: '#ef4444' }} title="Eliminar permanentemente">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredReservas.length === 0 && (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      No hay reservas con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && !readOnly && (
        <ReservaFormModal
          editingReserva={editingReserva}
          formData={formData}
          formErrors={formErrors}
          espacios={espacios}
          socios={socios}
          sociosSancionados={sociosSancionados}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          onUpdateForm={updateForm}
          onUpdateStartTime={updateStartTime}
        />
      )}
    </div>
  );
}
