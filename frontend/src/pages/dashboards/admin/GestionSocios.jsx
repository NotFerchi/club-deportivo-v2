import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Download, Edit2, RotateCcw, Trash2, Upload, UserPlus, Users, X } from 'lucide-react';
import { adminApi, apiRequest } from '../../../services/api';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
import { getFullName, getSocioNumero, getSocioTipo, isActiveValue, normalizeText, toDateInputValue } from '../../../utils/adminData';

const initialFormData = {
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  email: '',
  telefono: '',
  curp: '',
  fechaNacimiento: '',
  genero: '',
  direccion: '',
  tipo_socio: 'rentista',
  password: ''
};

const inputErrorStyle = { borderColor: '#ef4444', backgroundColor: '#fff1f0' };

function csvEscape(value) {
  const stringValue = String(value ?? '');
  return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
}

function parseCsvRows(text) {
  const rows = [];
  let current = '';
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function getImportValue(row, headers, options) {
  const optionList = Array.isArray(options) ? options : [options];
  const index = headers.findIndex(header => optionList.includes(header));
  return index >= 0 ? row[index] || '' : '';
}

function buildImportPayload(row, headers) {
  return {
    nombres: getImportValue(row, headers, ['nombres', 'nombre']),
    apellidoPaterno: getImportValue(row, headers, ['apellido_paterno', 'apellidoPaterno', 'apellidopaterno']),
    apellidoMaterno: getImportValue(row, headers, ['apellido_materno', 'apellidoMaterno', 'apellidomaterno']),
    email: getImportValue(row, headers, ['email', 'correo']),
    telefono: getImportValue(row, headers, ['telefono', 'tel']),
    curp: getImportValue(row, headers, 'curp').toUpperCase(),
    fechaNacimiento: getImportValue(row, headers, ['fecha_nacimiento', 'fechaNacimiento', 'nacimiento']) || null,
    genero: getImportValue(row, headers, 'genero') || null,
    direccion: getImportValue(row, headers, 'direccion'),
    tipo: getImportValue(row, headers, ['tipo', 'tipo_socio']) || 'Rentista',
    tipo_socio: normalizeText(getImportValue(row, headers, ['tipo_socio', 'tipo'])) === 'accionista' ? 'accionista' : 'rentista',
    modalidad: getImportValue(row, headers, 'modalidad') || 'Individual',
    password: getImportValue(row, headers, ['password', 'contrasena'])
  };
}

function GestionSocios({ readOnly = false }) {
  const [socios, setSocios] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('activos');
  const [sortBy, setSortBy] = useState('nombre-asc');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSocio, setEditingSocio] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState({});
  const [fileState, setFileState] = useState({ status: 'idle', message: '' });
  const fileInputRef = useRef(null);

  const fetchSocios = async () => {
    try {
      setSocios(await adminApi.getSocios());
    } catch (error) {
      if (error.status === 401) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        window.location.href = '/login';
        return;
      }
      alert(`Error al cargar socios: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocios();
  }, []);

  const filteredSocios = useMemo(() => {
    const query = normalizeText(searchTerm);
    const filtered = socios.filter(socio => {
      const tipo = getSocioTipo(socio);
      const activo = isActiveValue(socio.activo);
      const text = normalizeText([
        getFullName(socio),
        socio.email,
        socio.curp,
        getSocioNumero(socio)
      ].filter(Boolean).join(' '));

      if (query && !text.includes(query)) return false;
      if (filterTipo && tipo !== filterTipo) return false;
      if (filterEstado === 'activos' && !activo) return false;
      if (filterEstado === 'inactivos' && activo) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'numero-asc') return String(getSocioNumero(a)).localeCompare(String(getSocioNumero(b)), 'es', { numeric: true });
      if (sortBy === 'nombre-desc') return getFullName(b).localeCompare(getFullName(a), 'es');
      return getFullName(a).localeCompare(getFullName(b), 'es');
    });
  }, [socios, searchTerm, filterTipo, filterEstado, sortBy]);

  const getInputStyles = (field) => (formErrors[field] ? inputErrorStyle : {});

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const errors = {};
    const email = formData.email.trim().toLowerCase();
    const curp = formData.curp.trim().toUpperCase();
    const duplicate = (field, value) => socios.some(socio =>
      String(socio[field] || '').toLowerCase() === value.toLowerCase() &&
      socio.socio_id !== editingSocio?.socio_id
    );

    if (formData.nombres.trim().length < 2) errors.nombres = 'Ingresa al menos 2 caracteres';
    if (formData.apellidoPaterno.trim().length < 2) errors.apellidoPaterno = 'Ingresa al menos 2 caracteres';
    if (!email) errors.email = 'Email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Formato de email inválido';
    else if (duplicate('email', email)) errors.email = 'Este email ya pertenece a otro socio';
    if (!curp) errors.curp = 'CURP es obligatoria';
    else if (!/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/.test(curp)) errors.curp = 'Formato de CURP inválido';
    else if (duplicate('curp', curp)) errors.curp = 'Esta CURP ya pertenece a otro socio';
    if (!formData.direccion.trim()) errors.direccion = 'Dirección es obligatoria';
    if (formData.telefono.trim() && !/^\d{10}$/.test(formData.telefono.trim())) errors.telefono = 'Teléfono debe tener 10 dígitos';
    if (formData.fechaNacimiento) {
      const selected = new Date(`${formData.fechaNacimiento}T00:00:00`);
      if (Number.isNaN(selected.getTime()) || selected > new Date()) errors.fechaNacimiento = 'Fecha de nacimiento inválida';
    }
    if (!['accionista', 'rentista'].includes(formData.tipo_socio)) errors.tipo_socio = 'Seleccione tipo de socio';
    if (!editingSocio && formData.password.trim().length < 6) errors.password = 'Contraseña mínima de 6 caracteres';
    if (editingSocio && formData.password.trim() && formData.password.trim().length < 6) errors.password = 'Contraseña mínima de 6 caracteres';

    return errors;
  };

  const resetForm = () => {
    setEditingSocio(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (socio) => {
    setEditingSocio(socio);
    setFormData({
      nombres: socio.nombres || '',
      apellidoPaterno: socio.apellido_paterno || '',
      apellidoMaterno: socio.apellido_materno || '',
      email: socio.email || '',
      telefono: socio.telefono || '',
      curp: socio.curp || '',
      fechaNacimiento: toDateInputValue(socio.fecha_nacimiento),
      genero: socio.genero || '',
      direccion: socio.direccion || '',
      tipo_socio: getSocioTipo(socio),
      password: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const buildPayload = () => {
    const tipo = formData.tipo_socio === 'accionista' ? 'Accionista' : 'Rentista';
    const payload = {
      nombres: formData.nombres.trim(),
      apellidoPaterno: formData.apellidoPaterno.trim(),
      apellidoMaterno: formData.apellidoMaterno.trim(),
      email: formData.email.trim().toLowerCase(),
      telefono: formData.telefono.trim(),
      curp: formData.curp.trim().toUpperCase(),
      fechaNacimiento: formData.fechaNacimiento || null,
      genero: formData.genero || null,
      direccion: formData.direccion.trim(),
      tipo,
      tipo_socio: formData.tipo_socio,
      modalidad: editingSocio?.modalidad || 'Individual',
      activo: editingSocio ? editingSocio.activo : true
    };

    if (formData.password.trim()) payload.password = formData.password.trim();
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await adminApi.saveSocio(buildPayload(), editingSocio?.socio_id);
      await fetchSocios();
      setShowModal(false);
      resetForm();
      alert(editingSocio ? 'Socio actualizado correctamente' : 'Socio creado correctamente');
    } catch (error) {
      alert(error.message || 'Error al guardar socio');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Inactivar este socio?')) return;
    try {
      await apiRequest(`/socios/${id}`, { method: 'DELETE' });
      await fetchSocios();
      alert('Socio inactivado correctamente');
    } catch (error) {
      alert(error.message || 'Error al inactivar socio');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!confirm('¿Eliminar permanentemente este socio? Esta acción no se puede deshacer.')) return;
    try {
      await apiRequest(`/socios/${id}/permanente`, { method: 'DELETE' });
      await fetchSocios();
      alert('Socio eliminado permanentemente');
    } catch (error) {
      alert(error.message || 'Error al eliminar socio');
    }
  };

  const handleReactivate = async (socio) => {
    try {
      await apiRequest(`/socios/${socio.socio_id}/reactivar`, { method: 'PUT' });
      await fetchSocios();
      alert('Socio reactivado correctamente');
    } catch (error) {
      alert(error.message || 'Error al reactivar socio');
    }
  };

  const exportSocios = async () => {
    const headers = [
      'numero_socio',
      'nombres',
      'apellido_paterno',
      'apellido_materno',
      'email',
      'telefono',
      'curp',
      'tipo_socio',
      'activo'
    ];
    const rows = filteredSocios.map(socio => [
      getSocioNumero(socio),
      socio.nombres,
      socio.apellido_paterno,
      socio.apellido_materno,
      socio.email,
      socio.telefono,
      socio.curp,
      getSocioTipo(socio),
      isActiveValue(socio.activo) ? 'activo' : 'inactivo'
    ]);

    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `socios-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setFileState({ status: 'success', message: `Exportados ${rows.length} socios en CSV.` });
    try {
      await adminApi.logAudit({
        accion: 'exportar_socios',
        tabla_afectada: 'socios',
        detalles: `Exportacion CSV de ${rows.length} socios`
      });
    } catch {
      // La exportacion no debe fallar si el log no esta disponible.
    }
  };

  const importSocios = async (file) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['csv', 'xls', 'xlsx'];

    if (!allowed.includes(extension)) {
      setFileState({ status: 'error', message: 'Formato no valido. Usa CSV, XLS o XLSX.' });
      return;
    }

    if (extension !== 'csv') {
      setFileState({ status: 'error', message: 'Excel detectado. En esta version la importacion masiva procesa CSV para evitar datos mal leidos.' });
      return;
    }

    setFileState({ status: 'loading', message: 'Importando socios...' });

    try {
      const text = await file.text();
      const [headerRow, ...dataRows] = parseCsvRows(text);
      const headers = (headerRow || []).map(header => normalizeText(header).replace(/\s+/g, '_'));
      const required = ['nombres', 'email', 'curp', 'direccion'];
      const missing = required.filter(header => !headers.includes(header));

      if (missing.length > 0) {
        setFileState({ status: 'error', message: `Faltan columnas obligatorias: ${missing.join(', ')}` });
        return;
      }

      let created = 0;
      const errors = [];

      for (const [index, row] of dataRows.entries()) {
        const payload = buildImportPayload(row, headers);
        if (!payload.password) {
          errors.push(`Fila ${index + 2}: falta password`);
          continue;
        }

        try {
          await adminApi.saveSocio(payload);
          created += 1;
        } catch (error) {
          errors.push(`Fila ${index + 2}: ${error.message}`);
        }
      }

      await fetchSocios();
      const message = errors.length
        ? `Importados ${created}. Con errores: ${errors.slice(0, 3).join(' | ')}`
        : `Importados ${created} socios correctamente.`;
      setFileState({ status: errors.length ? 'error' : 'success', message });

      try {
        await adminApi.logAudit({
          accion: 'importar_socios',
          tabla_afectada: 'socios',
          detalles: `Importacion CSV: ${created} creados, ${errors.length} errores`
        });
      } catch {
        // El log no debe bloquear la carga masiva.
      }
    } catch (error) {
      setFileState({ status: 'error', message: error.message || 'No se pudo importar el archivo.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="chart-box"><p>Cargando socios...</p></div>;

  return (
    <div className="chart-box">
      <ModuleHeader
        icon={Users}
        title="Gestión de Socios"
        count={filteredSocios.length}
        subtitle="Filtros por número, orden alfabético, tipo y estado."
        actions={(
          <>
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar nombre, número, email o CURP" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={event => importSocios(event.target.files?.[0])}
              style={{ display: 'none' }}
            />
            {!readOnly && (
              <button className="btn-outline" onClick={() => fileInputRef.current?.click()} disabled={fileState.status === 'loading'}>
                <Upload size={16} /> Importar
              </button>
            )}
            <button className="btn-outline" onClick={exportSocios}>
              <Download size={16} /> Exportar
            </button>
            {!readOnly && (
              <button className="btn-primary" onClick={openCreateModal}>
                <UserPlus size={16} /> Nuevo Socio
              </button>
            )}
          </>
        )}
      />

      {fileState.message && (
        <div className={`admin-file-message status-${fileState.status}`}>
          {fileState.status === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{fileState.message}</span>
        </div>
      )}

      <div className="admin-filter-row">
        <FilterSelect label="Tipo" value={filterTipo} onChange={setFilterTipo}>
          <option value="">Todos</option>
          <option value="rentista">Rentistas</option>
          <option value="accionista">Accionistas</option>
        </FilterSelect>
        <FilterSelect label="Estado" value={filterEstado} onChange={setFilterEstado}>
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </FilterSelect>
        <FilterSelect label="Orden" value={sortBy} onChange={setSortBy}>
          <option value="nombre-asc">A-Z</option>
          <option value="nombre-desc">Z-A</option>
          <option value="numero-asc">Número</option>
        </FilterSelect>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Teléfono</th>
              <th>Estado</th>
              {!readOnly && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filteredSocios.map(socio => {
              const tipo = getSocioTipo(socio);
              const activo = isActiveValue(socio.activo);
              return (
                <tr key={socio.socio_id}>
                  <td>{getSocioNumero(socio) || '-'}</td>
                  <td>
                    <strong>{getFullName(socio)}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{socio.curp}</span>
                  </td>
                  <td>{socio.email}</td>
                  <td>
                    <span className={tipo === 'accionista' ? 'badge-info' : 'badge-success'}>
                      {tipo === 'accionista' ? 'Accionista' : 'Rentista'}
                    </span>
                  </td>
                  <td>{socio.telefono || '-'}</td>
                  <td><span className={activo ? 'badge-success' : 'badge-warning'}>{activo ? 'Activo' : 'Inactivo'}</span></td>
                  {!readOnly && (
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleEdit(socio)} className="btn-icon" style={{ color: '#3b82f6' }} title="Editar">
                        <Edit2 size={16} />
                      </button>
                      {activo ? (
                        <button onClick={() => handleDelete(socio.socio_id)} className="btn-icon" style={{ color: '#ef4444' }} title="Inactivar">
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleReactivate(socio)} className="btn-icon" style={{ color: '#10b981' }} title="Reactivar">
                            <RotateCcw size={16} />
                          </button>
                          <button onClick={() => handlePermanentDelete(socio.socio_id)} className="btn-icon" style={{ color: '#b91c1c' }} title="Eliminar permanentemente">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {filteredSocios.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No hay socios con los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <h3>{editingSocio ? 'Editar Socio' : 'Nuevo Socio'}</h3>
              <button onClick={() => setShowModal(false)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombres</label>
                    <input value={formData.nombres} onChange={event => updateForm('nombres', event.target.value)} style={getInputStyles('nombres')} />
                    {formErrors.nombres && <p className="field-error">{formErrors.nombres}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Apellido paterno</label>
                    <input value={formData.apellidoPaterno} onChange={event => updateForm('apellidoPaterno', event.target.value)} style={getInputStyles('apellidoPaterno')} />
                    {formErrors.apellidoPaterno && <p className="field-error">{formErrors.apellidoPaterno}</p>}
                  </div>
                  <div className="form-group">
                    <label>Apellido materno</label>
                    <input value={formData.apellidoMaterno} onChange={event => updateForm('apellidoMaterno', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required">Email</label>
                    <input type="email" value={formData.email} onChange={event => updateForm('email', event.target.value)} style={getInputStyles('email')} />
                    {formErrors.email && <p className="field-error">{formErrors.email}</p>}
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input value={formData.telefono} onChange={event => updateForm('telefono', event.target.value.replace(/\D/g, '').slice(0, 10))} style={getInputStyles('telefono')} />
                    {formErrors.telefono && <p className="field-error">{formErrors.telefono}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">CURP</label>
                    <input value={formData.curp} onChange={event => updateForm('curp', event.target.value.toUpperCase().slice(0, 18))} style={getInputStyles('curp')} />
                    {formErrors.curp && <p className="field-error">{formErrors.curp}</p>}
                  </div>
                  <div className="form-group">
                    <label>Fecha nacimiento</label>
                    <input type="date" value={formData.fechaNacimiento} onChange={event => updateForm('fechaNacimiento', event.target.value)} style={getInputStyles('fechaNacimiento')} />
                    {formErrors.fechaNacimiento && <p className="field-error">{formErrors.fechaNacimiento}</p>}
                  </div>
                  <div className="form-group">
                    <label>Género</label>
                    <select value={formData.genero} onChange={event => updateForm('genero', event.target.value)}>
                      <option value="">Seleccione</option>
                      <option>Masculino</option>
                      <option>Femenino</option>
                      <option>No especificado</option>
                    </select>
                  </div>
                  <div className="form-group form-group-full">
                    <label className="required">Dirección</label>
                    <input value={formData.direccion} onChange={event => updateForm('direccion', event.target.value)} style={getInputStyles('direccion')} />
                    {formErrors.direccion && <p className="field-error">{formErrors.direccion}</p>}
                  </div>
                  <div className="form-group">
                    <label className="required">Tipo de socio</label>
                    <select value={formData.tipo_socio} onChange={event => updateForm('tipo_socio', event.target.value)} style={getInputStyles('tipo_socio')}>
                      <option value="rentista">Rentista</option>
                      <option value="accionista">Accionista</option>
                    </select>
                    {formErrors.tipo_socio && <p className="field-error">{formErrors.tipo_socio}</p>}
                  </div>
                  <div className="form-group">
                    <label>{editingSocio ? 'Contraseña (opcional)' : 'Contraseña'}</label>
                    <input type="password" value={formData.password} onChange={event => updateForm('password', event.target.value)} style={getInputStyles('password')} />
                    {formErrors.password && <p className="field-error">{formErrors.password}</p>}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary">Guardar Socio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionSocios;
