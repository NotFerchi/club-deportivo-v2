import React, { useEffect, useMemo, useState } from 'react';
import { Baby, CheckCircle, Clock, LogOut, Plus, X } from 'lucide-react';
import { adminApi, apiRequest, unwrapList } from '../../../services/api';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { formatDateTime, normalizeText } from '../../../utils/adminData';

const initialFormData = {
  nombre_nino: '',
  edad: '',
  socio_id: '',
  observaciones: ''
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function getSocioNombre(registro) {
  return registro.socio_nombre || [registro.nombres, registro.apellido_paterno].filter(Boolean).join(' ').trim();
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
    } catch (error) {
      alert(error.message || 'Error al cargar ludoteca');
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
    const edad = Number(formData.edad);

    if (formData.nombre_nino.trim().length < 2) errors.nombre_nino = 'Nombre obligatorio';
    if (!Number.isFinite(edad) || edad < 1 || edad > 12) errors.edad = 'Edad válida entre 1 y 12 años';
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
      await apiRequest('/ludoteca', {
        method: 'POST',
        body: JSON.stringify({
          nombre_nino: formData.nombre_nino.trim(),
          edad: Number(formData.edad),
          socio_id: formData.socio_id,
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
      await apiRequest(`/ludoteca/${id}/salida`, { method: 'PUT' });
      await fetchData();
      showToast('Salida registrada correctamente');
    } catch (error) {
      alert(error.message || 'Error al registrar salida');
    }
  };

  const activosFiltrados = useMemo(() => {
    const query = normalizeText(filtro);
    return registrosActivos.filter(registro => {
      const text = normalizeText([registro.nombre_nino, getSocioNombre(registro), registro.observaciones].filter(Boolean).join(' '));
      return !query || text.includes(query);
    });
  }, [registrosActivos, filtro]);

  const historialFiltrado = useMemo(() => {
    const query = normalizeText(filtro);
    return historial.filter(registro => {
      const finalizado = Boolean(registro.hora_salida);
      const text = normalizeText([registro.nombre_nino, getSocioNombre(registro), registro.observaciones].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterHistorial === 'activos' && finalizado) return false;
      if (filterHistorial === 'finalizados' && !finalizado) return false;
      return true;
    });
  }, [historial, filtro, filterHistorial]);

  if (loading) return <div className="chart-box"><p>Cargando ludoteca...</p></div>;

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
                  <h3 className="espacio-title">{registro.nombre_nino} ({registro.edad} años)</h3>
                  <p className="espacio-sub">{getSocioNombre(registro)}</p>
                </div>
                <span className="badge-success">
                  <Clock size={13} /> {new Date(registro.hora_entrada).toLocaleTimeString()}
                </span>
              </div>
              {registro.observaciones && <div className="espacio-body"><p>{registro.observaciones}</p></div>}
              <div className="espacio-footer">
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
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map(registro => (
                <tr key={registro.registro_id}>
                  <td>{registro.nombre_nino} ({registro.edad})</td>
                  <td>{getSocioNombre(registro)}</td>
                  <td>{formatDateTime(registro.hora_entrada)}</td>
                  <td>{registro.hora_salida ? formatDateTime(registro.hora_salida) : '-'}</td>
                  <td><span className={registro.hora_salida ? 'badge-warning' : 'badge-success'}>{registro.hora_salida ? 'Finalizado' : 'Activo'}</span></td>
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
                    <label className="required">Edad</label>
                    <input type="number" min="1" max="12" value={formData.edad} onChange={event => updateForm('edad', event.target.value)} style={formErrors.edad ? inputErrorStyle : {}} />
                    {formErrors.edad && <p className="field-error">{formErrors.edad}</p>}
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
