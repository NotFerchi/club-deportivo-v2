import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle, Clock, Edit2, Plus, Trash2, X, XCircle } from 'lucide-react';
import { adminApi } from '../../../services/api';
import { FilterSelect, ModuleHeader, SearchInput, StatCard } from '../../../components/admin/AdminUI';
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
} from '../../../utils/adminData';

const RESERVA_CONFIG = {
  sameDayOnly: true,
  durationMinutes: 60,
  maxActiveReservationsPerSocio: 1
};

const initialFormData = {
  espacio_id: '',
  socio_id: '',
  fecha: todayISO(),
  hora_inicio: '',
  hora_fin: '',
  estado: 'confirmada'
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };
const estados = ['confirmada', 'cancelada', 'no-show', 'sancionada'];

function getSocioName(socio) {
  return [socio?.nombres, socio?.apellido_paterno].filter(Boolean).join(' ').trim();
}

function getDiaSemana(fecha) {
  const [year, month, day] = String(fecha || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getDay() + 1;
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

function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [socios, setSocios] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReserva, setEditingReserva] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [filterEspacio, setFilterEspacio] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});

  const fetchData = async () => {
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
    } catch (error) {
      alert(error.message || 'Error al cargar reservas');
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
    total: reservas.length,
    confirmadas: reservas.filter(r => normalizeEstadoReserva(r.estado) === 'confirmada').length,
    canceladas: reservas.filter(r => normalizeEstadoReserva(r.estado) === 'cancelada').length,
    noShows: reservas.filter(r => normalizeEstadoReserva(r.estado) === 'no-show' || r.no_show === true).length,
    hoy: reservas.filter(r => toDateInputValue(r.fecha) === todayISO()).length
  }), [reservas]);

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

  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

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
    setFormData({ ...initialFormData, fecha: todayISO() });
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
      errors.fecha = 'Solo se permiten reservas para el mismo día';
    }

    if (formData.hora_inicio && formData.hora_fin) {
      const duration = minutesBetween(formData.hora_inicio, formData.hora_fin);
      if (duration !== RESERVA_CONFIG.durationMinutes) {
        errors.hora_fin = `La reserva debe durar ${RESERVA_CONFIG.durationMinutes} minutos`;
      }
    }

    if (!estados.includes(formData.estado)) errors.estado = 'Estado de reserva inválido';
    const reservaActiva = !['cancelada', 'no-show', 'sancionada'].includes(formData.estado);
    if (reservaActiva) {
      if (sociosSancionados.has(String(formData.socio_id))) errors.socio_id = 'El socio tiene una sanción activa';
      if (formData.socio_id && hasSocioReservation()) errors.socio_id = 'El socio ya tiene una reserva activa para ese día';
      if (formData.espacio_id && formData.fecha && formData.hora_inicio && formData.hora_fin && hasReservationConflict()) {
        errors.hora_inicio = 'El espacio ya está reservado en ese horario';
      }
      if (formData.espacio_id && formData.fecha && formData.hora_inicio && formData.hora_fin && hasSessionConflict()) {
        errors.hora_inicio = 'El horario entra en conflicto con una sesión programada';
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
      alert(error.message || 'Error al guardar reserva');
    }
  };

  const cancelarReserva = async (id) => {
    if (!confirm('¿Cancelar esta reserva? Esta acción no se puede deshacer.')) return;
    try {
      await adminApi.cancelarReserva(id);
      await fetchData();
      showToast('Reserva cancelada correctamente');
    } catch (error) {
      alert(error.message || 'Error al cancelar reserva');
    }
  };

  const deleteReserva = async (id) => {
    if (!confirm('¿Eliminar esta reserva permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      await adminApi.deleteReserva(id);
      await fetchData();
      showToast('Reserva eliminada permanentemente');
    } catch (error) {
      alert(error.message || 'Error al eliminar reserva');
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando reservas...</p></div>;

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
        title="Gestión de Reservas"
        count={filteredReservas.length}
        subtitle={`Reglas activas: mismo día, ${RESERVA_CONFIG.durationMinutes} minutos, ${RESERVA_CONFIG.maxActiveReservationsPerSocio} reserva por socio.`}
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar socio, número o espacio" />
            <button className="btn-primary" onClick={openCreateModal}>
              <Plus size={16} /> Nueva Reserva
            </button>
          </>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={CalendarDays} label="Total" value={estadisticas.total} tone="info" />
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
          <button onClick={() => { setFilterEstado(''); setFilterFecha(''); setFilterEspacio(''); }} className="btn-outline">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Espacio</th>
              <th>Socio</th>
              <th>Fecha</th>
              <th>Horario</th>
              <th>Estado</th>
              <th>Acciones</th>
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
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{reserva.numero_socio || reserva.socio_numero || 'Sin número'}</span>
                  </td>
                  <td><span style={{ fontWeight: 500 }}>{formatDate(reserva.fecha)}</span></td>
                  <td><span className="inline-icon"><Clock size={12} /> {toTimeInputValue(reserva.hora_inicio)} - {toTimeInputValue(reserva.hora_fin)}</span></td>
                  <td>
                    <span className={getEstadoBadge(reserva.estado)}>
                      <EstadoIcon estado={reserva.estado} />
                      {estadoReservaLabel(reserva.estado)}
                    </span>
                  </td>
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
                </tr>
              );
            })}
            {filteredReservas.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No hay reservas con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div>
                <h3>{editingReserva ? 'Editar Reserva' : 'Nueva Reserva'}</h3>
                <p className="form-alert" style={{ margin: 0 }}>
                  La hora de fin se calcula automáticamente con la duración configurada.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Espacio</label>
                    <select value={formData.espacio_id} onChange={event => updateForm('espacio_id', event.target.value)} style={getInputStyles('espacio_id')}>
                      <option value="">Seleccione un espacio</option>
                      {espacios.map(espacio => (
                        <option key={espacio.espacio_id} value={espacio.espacio_id}>
                          {espacio.nombre} (Cap: {espacio.capacidad_maxima})
                        </option>
                      ))}
                    </select>
                    {formErrors.espacio_id && <p className="field-error">{formErrors.espacio_id}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Socio</label>
                    <select value={formData.socio_id} onChange={event => updateForm('socio_id', event.target.value)} style={getInputStyles('socio_id')}>
                      <option value="">Seleccione un socio</option>
                      {socios.map(socio => (
                        <option key={socio.socio_id} value={socio.socio_id} disabled={sociosSancionados.has(String(socio.socio_id))}>
                          {getSocioName(socio)} - {getSocioNumero(socio) || 'Sin número'}{sociosSancionados.has(String(socio.socio_id)) ? ' (sancionado)' : ''}
                        </option>
                      ))}
                    </select>
                    {formErrors.socio_id && <p className="field-error">{formErrors.socio_id}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Fecha</label>
                    <input type="date" value={formData.fecha} min={todayISO()} max={RESERVA_CONFIG.sameDayOnly ? todayISO() : undefined} onChange={event => updateForm('fecha', event.target.value)} style={getInputStyles('fecha')} />
                    {formErrors.fecha && <p className="field-error">{formErrors.fecha}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Hora inicio</label>
                    <input type="time" value={formData.hora_inicio} onChange={event => updateStartTime(event.target.value)} style={getInputStyles('hora_inicio')} />
                    {formErrors.hora_inicio && <p className="field-error">{formErrors.hora_inicio}</p>}
                  </div>

                  <div className="form-group">
                    <label className="required">Hora fin</label>
                    <input type="time" value={formData.hora_fin} readOnly style={getInputStyles('hora_fin')} />
                    {formErrors.hora_fin && <p className="field-error">{formErrors.hora_fin}</p>}
                  </div>

                  <div className="form-group">
                    <label>Estado</label>
                    <select value={formData.estado} onChange={event => updateForm('estado', event.target.value)} style={getInputStyles('estado')}>
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
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingReserva ? 'Actualizar' : 'Crear'} Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reservas;
