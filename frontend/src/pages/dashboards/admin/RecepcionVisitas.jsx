import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, DoorOpen, LogOut, RefreshCw, UserPlus, Users, X } from 'lucide-react';
import { adminApi } from '../../../services/api';
import { ErrorState, FilterSelect, LoadingState, ModuleHeader, SearchInput, StatCard } from '../../../components/admin/AdminUI';
import { formatDateTime, normalizeText } from '../../../utils/adminData';

const initialFormData = {
  nombre: '',
  apellidos: '',
  identificacion: '',
  telefono: '',
  correo: '',
  socio_anfitrion_id: '',
  motivo: '',
  mayor_16: true
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function getVisitanteNombre(visita) {
  return visita.nombre_completo || [visita.nombre, visita.apellidos].filter(Boolean).join(' ').trim();
}

function RecepcionVisitas() {
  const [visitasActivas, setVisitasActivas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [filtro, setFiltro] = useState('');
  const [filterHistorial, setFilterHistorial] = useState('');
  const [limitesPases, setLimitesPases] = useState({});
  const [loadError, setLoadError] = useState('');
  const [closingVisits, setClosingVisits] = useState(false);

  const fetchData = async () => {
    try {
      await adminApi.cerrarVisitasVencidas().catch(() => null);
      const [visitasData, sociosData, historialData] = await Promise.all([
        adminApi.getVisitasActivas(),
        adminApi.getSociosVisitas(),
        adminApi.getHistorialVisitas(7)
      ]);

      setVisitasActivas(visitasData);
      setHistorial(historialData);
      setSocios(sociosData);

      const usos = {};
      sociosData.forEach(socio => { usos[socio.socio_id] = 0; });
      visitasData.forEach(visita => {
        const anfitrionId = visita.socio_anfitrion_id || visita.socio_id;
        if (anfitrionId) usos[anfitrionId] = (usos[anfitrionId] || 0) + 1;
      });

      const limites = {};
      sociosData.forEach(socio => {
        const maximo = normalizeText(socio.tipo_socio || socio.tipo) === 'accionista' ? 5 : 3;
        limites[socio.socio_id] = { usados: usos[socio.socio_id] || 0, maximo };
      });
      setLimitesPases(limites);
      setLoadError('');
    } catch (error) {
      if (error.status === 401) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }
      setLoadError(error.message || 'Error al cargar recepcion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    if (formData.nombre.trim().length < 2) errors.nombre = 'Nombre obligatorio';
    if (formData.apellidos.trim().length < 2) errors.apellidos = 'Apellidos obligatorios';
    if (!/^\d{10}$/.test(formData.telefono.trim())) errors.telefono = 'Teléfono de 10 dígitos obligatorio';
    if (formData.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo.trim())) errors.correo = 'Correo inválido';

    if (formData.socio_anfitrion_id) {
      const limites = limitesPases[formData.socio_anfitrion_id];
      if (limites && limites.usados >= limites.maximo) {
        errors.socio_anfitrion_id = `El socio alcanzó su límite diario de ${limites.maximo} pases`;
      }
    }

    return errors;
  };

  const registrarVisita = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const nombreCompleto = `${formData.nombre.trim()} ${formData.apellidos.trim()}`.trim();
    const payload = {
      tipo_pase: formData.socio_anfitrion_id ? 'visita' : 'dia',
      socio_id: formData.socio_anfitrion_id || null,
      socio_anfitrion_id: formData.socio_anfitrion_id || null,
      nombre_completo: nombreCompleto,
      nombre: formData.nombre.trim(),
      apellido: formData.apellidos.trim(),
      identificacion: formData.identificacion.trim(),
      telefono: formData.telefono.trim(),
      correo: formData.correo.trim() || null,
      mayor_16: Boolean(formData.mayor_16),
      motivo: formData.motivo.trim(),
      observaciones: formData.motivo.trim()
    };

    try {
      await adminApi.registrarVisita(payload);
      setShowModal(false);
      setFormData(initialFormData);
      setFormErrors({});
      await fetchData();
      showToast('Visita registrada correctamente');
    } catch (error) {
      alert(error.message || 'Error al registrar visita');
    }
  };

  const registrarSalida = async (visitaId) => {
    if (!confirm('¿Registrar salida del visitante?')) return;

    try {
      await adminApi.registrarSalidaVisita(visitaId);
      await fetchData();
      showToast('Salida registrada correctamente');
    } catch (error) {
      alert(error.message || 'Error al registrar salida');
    }
  };

  const cerrarVencidas = async () => {
    setClosingVisits(true);
    try {
      const result = await adminApi.cerrarVisitasVencidas();
      await fetchData();
      showToast(`Cierre automatico aplicado: ${result?.cerradas || 0} visitas finalizadas`);
    } catch (error) {
      alert(error.message || 'Error al cerrar visitas vencidas');
    } finally {
      setClosingVisits(false);
    }
  };

  const visitasFiltradas = useMemo(() => {
    const query = normalizeText(filtro);
    return visitasActivas.filter(visita => {
      const text = normalizeText([
        getVisitanteNombre(visita),
        visita.identificacion,
        visita.socio_anfitrion_nombre,
        visita.socio_anfitrion_apellido,
        visita.motivo
      ].filter(Boolean).join(' '));
      return !query || text.includes(query);
    });
  }, [visitasActivas, filtro]);

  const historialFiltrado = useMemo(() => {
    const query = normalizeText(filtro);
    return historial.filter(registro => {
      const finalizada = Boolean(registro.hora_salida);
      const text = normalizeText([
        getVisitanteNombre(registro),
        registro.identificacion,
        registro.socio_anfitrion_nombre,
        registro.socio_anfitrion_apellido,
        registro.motivo
      ].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterHistorial === 'activas' && finalizada) return false;
      if (filterHistorial === 'finalizadas' && !finalizada) return false;
      return true;
    });
  }, [historial, filtro, filterHistorial]);

  const visitasFinalizadas = historial.filter(registro => Boolean(registro.hora_salida)).length;
  const visitasPendientes = historial.filter(registro => !registro.hora_salida).length;

  if (loading) return <LoadingState message="Cargando recepcion..." />;
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
        icon={DoorOpen}
        title="Recepción y Control de Visitas"
        subtitle={`Activas: ${visitasActivas.length} | Historial 7 días: ${historial.length}`}
        actions={(
          <>
            <SearchInput value={filtro} onChange={setFiltro} placeholder="Buscar visitante o anfitrión" />
            <button className="btn-outline" onClick={cerrarVencidas} disabled={closingVisits}>
              <RefreshCw size={16} /> {closingVisits ? 'Cerrando...' : 'Cerrar vencidas'}
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <UserPlus size={16} /> Nueva Visita
            </button>
          </>
        )}
      />

      <div className="reservation-stats-row">
        <StatCard icon={Users} label="Activas" value={visitasActivas.length} tone="success" />
        <StatCard icon={CheckCircle} label="Finalizadas" value={visitasFinalizadas} tone="info" />
        <StatCard icon={AlertCircle} label="Pendientes de salida" value={visitasPendientes} tone="warning" />
      </div>

      <div className="admin-filter-row">
        <FilterSelect label="Historial" value={filterHistorial} onChange={setFilterHistorial}>
          <option value="">Todos</option>
          <option value="activas">Activas</option>
          <option value="finalizadas">Finalizadas</option>
        </FilterSelect>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h5 className="chart-title-row"><Users size={18} /> Visitas Activas ({visitasFiltradas.length})</h5>
        <div className="grid-auto">
          {visitasFiltradas.length === 0 && (
            <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              No hay visitas activas en este momento.
            </p>
          )}
          {visitasFiltradas.map(visita => (
            <div key={visita.visita_id || visita.pase_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{getVisitanteNombre(visita)}</h3>
                  <p className="espacio-sub">{visita.identificacion ? `ID: ${visita.identificacion}` : 'Sin identificación'}</p>
                </div>
                <span className="badge-success">
                  <Clock size={13} /> {new Date(visita.hora_entrada).toLocaleTimeString()}
                </span>
              </div>
              <div className="espacio-body">
                <div className="espacio-stat">
                  <span className="stat-label">Anfitrión</span>
                  <span className="stat-value">{visita.socio_anfitrion_nombre || visita.socio_nombre || 'Ninguno'}</span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Motivo</span>
                  <span className="stat-value">{visita.motivo || visita.observaciones || 'No especificado'}</span>
                </div>
              </div>
              <div className="espacio-footer">
                <button onClick={() => registrarSalida(visita.visita_id || visita.pase_id)} className="btn-primary">
                  <LogOut size={14} /> Registrar salida
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className="chart-title-row"><Clock size={18} /> Historial de visitas (últimos 7 días)</h5>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Visitante</th>
                <th>Identificación</th>
                <th>Anfitrión</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map(registro => (
                <tr key={registro.visita_id || registro.pase_id}>
                  <td><strong>{getVisitanteNombre(registro)}</strong></td>
                  <td>{registro.identificacion || '-'}</td>
                  <td>{registro.socio_anfitrion_nombre || registro.socio_nombre || '-'}</td>
                  <td>{formatDateTime(registro.hora_entrada)}</td>
                  <td>{registro.hora_salida ? formatDateTime(registro.hora_salida) : '-'}</td>
                  <td><span className={registro.hora_salida ? 'badge-warning' : 'badge-success'}>{registro.hora_salida ? 'Finalizada' : 'Activa'}</span></td>
                </tr>
              ))}
              {historialFiltrado.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No hay registros en el historial.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>Registrar nueva visita</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={registrarVisita}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombre</label>
                    <input value={formData.nombre} onChange={event => updateForm('nombre', event.target.value)} style={formErrors.nombre ? inputErrorStyle : {}} />
                    {formErrors.nombre && <p className="field-error">{formErrors.nombre}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Apellidos</label>
                    <input value={formData.apellidos} onChange={event => updateForm('apellidos', event.target.value)} style={formErrors.apellidos ? inputErrorStyle : {}} />
                    {formErrors.apellidos && <p className="field-error">{formErrors.apellidos}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Teléfono</label>
                    <input value={formData.telefono} onChange={event => updateForm('telefono', event.target.value.replace(/\D/g, '').slice(0, 10))} style={formErrors.telefono ? inputErrorStyle : {}} />
                    {formErrors.telefono && <p className="field-error">{formErrors.telefono}</p>}
                  </div>
                  <div className="form-group">
                    <label>Correo</label>
                    <input type="email" value={formData.correo} onChange={event => updateForm('correo', event.target.value)} style={formErrors.correo ? inputErrorStyle : {}} />
                    {formErrors.correo && <p className="field-error">{formErrors.correo}</p>}
                  </div>
                  <div className="form-group">
                    <label>Identificación</label>
                    <input value={formData.identificacion} onChange={event => updateForm('identificacion', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Socio anfitrión</label>
                    <select value={formData.socio_anfitrion_id} onChange={event => updateForm('socio_anfitrion_id', event.target.value)} style={formErrors.socio_anfitrion_id ? inputErrorStyle : {}}>
                      <option value="">Pase de día / sin anfitrión</option>
                      {socios.map(socio => (
                        <option key={socio.socio_id} value={socio.socio_id}>
                          {socio.nombres} {socio.apellido_paterno} ({socio.tipo_socio}) - Pases {limitesPases[socio.socio_id]?.usados || 0}/{limitesPases[socio.socio_id]?.maximo || 0}
                        </option>
                      ))}
                    </select>
                    {formErrors.socio_anfitrion_id && <p className="field-error">{formErrors.socio_anfitrion_id}</p>}
                  </div>
                  <label className="form-group form-group-full" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={formData.mayor_16}
                      onChange={event => updateForm('mayor_16', event.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <span>El visitante es mayor de 16 años</span>
                  </label>
                  <div className="form-group form-group-full">
                    <label>Motivo</label>
                    <textarea rows="2" value={formData.motivo} onChange={event => updateForm('motivo', event.target.value)} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">Registrar entrada</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecepcionVisitas;
