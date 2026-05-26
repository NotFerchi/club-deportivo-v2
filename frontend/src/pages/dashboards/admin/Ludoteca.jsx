import React, { useEffect, useMemo, useState } from 'react';
import { Baby, CheckCircle, Clock, Eye, LogOut, Plus, X } from 'lucide-react';
import { adminApi, apiRequest, unwrapList } from '../../../services/api';
import { ErrorState, FilterSelect, LoadingState, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { formatDateTime, normalizeText } from '../../../utils/adminData';

const LUDOTECA_MAX_MIN = 120;

function LudotecaTimeBar({ horaEntrada }) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(horaEntrada)) / 60000));
  const pct = Math.min(Math.round((minutos / LUDOTECA_MAX_MIN) * 100), 100);
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  const label = horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;
  const barColor = pct >= 85 ? '#ef4444' : pct >= 65 ? '#f59e0b' : '#10b981';

  return (
    <div style={{ padding: '4px 0 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#64748b', fontWeight: 600 }}>
        <span>{label} en ludoteca</span>
        <span style={{ color: barColor }}>{pct}% de {LUDOTECA_MAX_MIN / 60}h máx.</span>
      </div>
      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const initialFormData = {
  nombre_nino: '',
  fecha_nacimiento: '',
  socio_id: '',
  observaciones: ''
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function getSocioNombre(registro) {
  return registro.socio_nombre || registro.nombre_padre || registro.tutor_nombre || [registro.nombres, registro.apellido_paterno].filter(Boolean).join(' ').trim();
}

function getEdad(registro) {
  if (Number.isFinite(Number(registro.edad))) return Number(registro.edad);
  if (!registro.fecha_nacimiento) return null;
  const nacimiento = new Date(registro.fecha_nacimiento);
  if (Number.isNaN(nacimiento.getTime())) return null;
  return Math.floor((new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25));
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return null;
  return Math.floor((new Date() - nacimiento) / (1000 * 60 * 60 * 24 * 365.25));
}

function Ludoteca() {
  const [registrosActivos, setRegistrosActivos] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [filterHistorial, setFilterHistorial] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [viewingRegistro, setViewingRegistro] = useState(null);

  const fetchData = async () => {
    try {
      const [activos, historialData, sociosData] = await Promise.all([
        apiRequest('/ludoteca/activos').then(data => unwrapList(data, ['data'])),
        apiRequest('/ludoteca/historial?dias=7').then(data => unwrapList(data, ['data'])),
        adminApi.getSocios()
      ]);
      setRegistrosActivos(activos);
      setHistorial(historialData);
      setSocios(sociosData.filter(socio => socio.activo === true || socio.activo === 'true'));
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Error al cargar ludoteca');
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
    const edad = calcularEdad(formData.fecha_nacimiento);

    if (formData.nombre_nino.trim().length < 2) errors.nombre_nino = 'Nombre obligatorio';
    if (!formData.fecha_nacimiento) errors.fecha_nacimiento = 'Fecha de nacimiento obligatoria';
    else if (!Number.isFinite(edad) || edad < 3 || edad > 7) errors.fecha_nacimiento = 'Edad valida entre 3 y 7 años';
    if (!formData.socio_id) errors.socio_id = 'Seleccione socio responsable';
    return errors;
  };

  const registrarEntrada = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await apiRequest('/ludoteca/entrada', {
        method: 'POST',
        body: JSON.stringify({
          nombre_hijo: formData.nombre_nino.trim(),
          fecha_nacimiento: formData.fecha_nacimiento,
          socio_padre_id: Number(formData.socio_id),
          observaciones: formData.observaciones.trim()
        })
      });
      await fetchData();
      setShowModal(false);
      setFormData(initialFormData);
      setFormErrors({});
      showToast('Entrada registrada correctamente');
    } catch (error) {
      alert(error.message || 'Error al registrar entrada');
    }
  };

  const registrarSalida = async (id) => {
    if (!confirm('¿Registrar salida?')) return;
    try {
      await apiRequest(`/ludoteca/salida/${id}`, { method: 'PATCH' });
      await fetchData();
      showToast('Salida registrada correctamente');
    } catch (error) {
      alert(error.message || 'Error al registrar salida');
    }
  };

  const activosFiltrados = useMemo(() => {
    const query = normalizeText(filtro);
    return registrosActivos.filter(registro => {
      const text = normalizeText([registro.nombre_nino, registro.nombre_hijo, getSocioNombre(registro), registro.observaciones].filter(Boolean).join(' '));
      return !query || text.includes(query);
    });
  }, [registrosActivos, filtro]);

  const historialFiltrado = useMemo(() => {
    const query = normalizeText(filtro);
    return historial.filter(registro => {
      const finalizado = Boolean(registro.hora_salida);
      const text = normalizeText([registro.nombre_nino, registro.nombre_hijo, getSocioNombre(registro), registro.observaciones].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterHistorial === 'activos' && finalizado) return false;
      if (filterHistorial === 'finalizados' && !finalizado) return false;
      return true;
    });
  }, [historial, filtro, filterHistorial]);

  if (loading) return <LoadingState message="Cargando ludoteca..." />;
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
        icon={Baby}
        title="Control de Ludoteca"
        subtitle={`Activos: ${registrosActivos.length} | Historial 7 días: ${historial.length}`}
        actions={(
          <>
            <SearchInput value={filtro} onChange={setFiltro} placeholder="Buscar niño o socio" />
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Registrar Entrada
            </button>
          </>
        )}
      />

      <div className="admin-filter-row">
        <FilterSelect label="Historial" value={filterHistorial} onChange={setFilterHistorial}>
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="finalizados">Finalizados</option>
        </FilterSelect>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h5 className="chart-title-row"><Baby size={18} /> Niños en Ludoteca ({activosFiltrados.length})</h5>
        <div className="grid-auto">
          {activosFiltrados.map(registro => (
            <div key={registro.registro_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{registro.nombre_nino || registro.nombre_hijo} ({getEdad(registro) ?? '-'} años)</h3>
                  <p className="espacio-sub">{getSocioNombre(registro)}</p>
                </div>
                <span className="badge-success">
                  <Clock size={13} /> {new Date(registro.hora_entrada).toLocaleTimeString()}
                </span>
              </div>
              <div className="espacio-body">
                <LudotecaTimeBar horaEntrada={registro.hora_entrada} />
                {registro.observaciones && <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>{registro.observaciones}</p>}
              </div>
              <div className="espacio-footer">
                <button onClick={() => setViewingRegistro(registro)} className="btn-secondary" title="Ver detalle">
                  <Eye size={14} /> Detalle
                </button>
                <button onClick={() => registrarSalida(registro.registro_id)} className="btn-primary">
                  <LogOut size={16} /> Salida
                </button>
              </div>
            </div>
          ))}
          {activosFiltrados.length === 0 && <p style={{ color: '#64748b' }}>No hay niños en ludoteca.</p>}
        </div>
      </div>

      <div>
        <h5 className="chart-title-row"><Clock size={18} /> Historial reciente</h5>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Niño</th>
                <th>Socio</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map(registro => (
                <tr key={registro.registro_id}>
                  <td>{registro.nombre_nino || registro.nombre_hijo} ({getEdad(registro) ?? '-'} años)</td>
                  <td>{getSocioNombre(registro)}</td>
                  <td>{formatDateTime(registro.hora_entrada)}</td>
                  <td>{registro.hora_salida ? formatDateTime(registro.hora_salida) : '-'}</td>
                  <td><span className={registro.hora_salida ? 'badge-warning' : 'badge-success'}>{registro.hora_salida ? 'Finalizado' : 'Activo'}</span></td>
                  <td>
                    <button onClick={() => setViewingRegistro(registro)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }} title="Ver detalle">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {historialFiltrado.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No hay registros en historial.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingRegistro && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Detalle — {viewingRegistro.nombre_nino || viewingRegistro.nombre_hijo}</h3>
              <button onClick={() => setViewingRegistro(null)} className="close-modal"><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre del niño</label>
                  <p style={{ margin: 0, fontWeight: 600 }}>{viewingRegistro.nombre_nino || viewingRegistro.nombre_hijo}</p>
                </div>
                <div className="form-group">
                  <label>Edad</label>
                  <p style={{ margin: 0 }}>{getEdad(viewingRegistro) ?? '-'} años</p>
                </div>
                <div className="form-group">
                  <label>Fecha de nacimiento</label>
                  <p style={{ margin: 0 }}>{viewingRegistro.fecha_nacimiento ? String(viewingRegistro.fecha_nacimiento).split('T')[0] : '-'}</p>
                </div>
                <div className="form-group">
                  <label>Socio responsable</label>
                  <p style={{ margin: 0 }}>{getSocioNombre(viewingRegistro)}</p>
                </div>
                <div className="form-group">
                  <label>Hora de entrada</label>
                  <p style={{ margin: 0 }}>{viewingRegistro.hora_entrada ? formatDateTime(viewingRegistro.hora_entrada) : '-'}</p>
                </div>
                <div className="form-group">
                  <label>Hora de salida</label>
                  <p style={{ margin: 0 }}>{viewingRegistro.hora_salida ? formatDateTime(viewingRegistro.hora_salida) : 'Aún en ludoteca'}</p>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <span className={viewingRegistro.hora_salida ? 'badge-warning' : 'badge-success'}>
                    {viewingRegistro.hora_salida ? 'Finalizado' : 'Activo'}
                  </span>
                </div>
                {!viewingRegistro.hora_salida && (
                  <div className="form-group">
                    <label>Tiempo en ludoteca</label>
                    <LudotecaTimeBar horaEntrada={viewingRegistro.hora_entrada} />
                  </div>
                )}
                {viewingRegistro.observaciones && (
                  <div className="form-group form-group-full">
                    <label>Observaciones</label>
                    <p style={{ margin: 0 }}>{viewingRegistro.observaciones}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setViewingRegistro(null)} className="btn-outline">Cerrar</button>
              {!viewingRegistro.hora_salida && (
                <button onClick={() => { registrarSalida(viewingRegistro.registro_id); setViewingRegistro(null); }} className="btn-primary">
                  <LogOut size={14} /> Registrar salida
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Registrar entrada a ludoteca</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={registrarEntrada}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombre del niño</label>
                    <input value={formData.nombre_nino} onChange={event => updateForm('nombre_nino', event.target.value)} style={formErrors.nombre_nino ? inputErrorStyle : {}} />
                    {formErrors.nombre_nino && <p className="field-error">{formErrors.nombre_nino}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Fecha de nacimiento</label>
                    <input type="date" value={formData.fecha_nacimiento} onChange={event => updateForm('fecha_nacimiento', event.target.value)} style={formErrors.fecha_nacimiento ? inputErrorStyle : {}} />
                    {formErrors.fecha_nacimiento && <p className="field-error">{formErrors.fecha_nacimiento}</p>}
                  </div>
                  <div className="form-group form-group-full">
                    <label className="required">Socio responsable</label>
                    <select value={formData.socio_id} onChange={event => updateForm('socio_id', event.target.value)} style={formErrors.socio_id ? inputErrorStyle : {}}>
                      <option value="">Seleccione</option>
                      {socios.map(socio => (
                        <option key={socio.socio_id} value={socio.socio_id}>{socio.nombres} {socio.apellido_paterno}</option>
                      ))}
                    </select>
                    {formErrors.socio_id && <p className="field-error">{formErrors.socio_id}</p>}
                  </div>
                  <div className="form-group form-group-full">
                    <label>Observaciones</label>
                    <textarea rows="2" value={formData.observaciones} onChange={event => updateForm('observaciones', event.target.value)} />
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

export default Ludoteca;
