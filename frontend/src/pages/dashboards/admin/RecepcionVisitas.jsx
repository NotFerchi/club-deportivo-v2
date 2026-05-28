import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Calendar, CheckCircle, Clock, DoorOpen, Download,
  Eye, LogOut, Mail, Pencil, Printer, QrCode, RefreshCw, UserPlus, Users, X
} from 'lucide-react';
import { adminApi } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { ErrorState, FilterSelect, LoadingState, ModuleHeader, SearchInput, StatCard } from '../../../components/admin/AdminUI';
import { formatDateTime, normalizeText } from '../../../utils/adminData';

const MX_TIMEZONE = 'America/Mexico_City';

const initialFormData = {
  tipo_pase: 'visita',
  socio_id: '',
  nombre_completo: '',
  identificacion: '',
  correo: '',
  telefono: '',
  mayor_16: true,
  observaciones: '',
  confirmacion_tutor: false
};

const initialEditData = {
  nombre_completo: '',
  telefono: '',
  correo: '',
  identificacion: '',
  observaciones: '',
  tipo_pase: 'visita',
  socio_id: ''
};

function getVisitanteNombre(visita) {
  return visita.nombre_completo || [visita.nombre, visita.apellidos].filter(Boolean).join(' ').trim();
}

function getAnfitrionNombre(visita) {
  const nombreCompleto = [
    visita?.socio_anfitrion_nombre,
    visita?.socio_anfitrion_apellido,
    visita?.socio_anfitrion_apellido_materno
  ].filter(Boolean).join(' ').trim();

  if (nombreCompleto) return nombreCompleto;
  if (visita?.socio_nombre) return visita.socio_nombre;

  const socioId = visita?.socio_anfitrion_id || visita?.socio_id;
  return socioId ? `Socio #${socioId}` : '';
}

function formatHour(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('es-MX', { timeZone: MX_TIMEZONE, hour: '2-digit', minute: '2-digit' });
}

function RecepcionVisitas() {
  const { toast, showConfirm } = useNotification();
  const [visitasActivas, setVisitasActivas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [socioSelectorTerm, setSocioSelectorTerm] = useState('');
  const [filtro, setFiltro] = useState('');
  const [filterHistorial, setFilterHistorial] = useState('');
  const [loadError, setLoadError] = useState('');
  const [closingVisits, setClosingVisits] = useState(false);
  const [savingExit, setSavingExit] = useState(null);
  const [qrModal, setQrModal] = useState({ open: false, qrImage: null, nombre: '', expiraEn: null, correo: '' });
  const [viewingVisita, setViewingVisita] = useState(null);
  const [editingVisita, setEditingVisita] = useState(null);
  const [editData, setEditData] = useState(initialEditData);
  const [editSocioTerm, setEditSocioTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const qrPrintRef = useRef(null);

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
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Error al cargar recepcion');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!showSuccess) return undefined;
    const t = setTimeout(() => setShowSuccess(false), 3200);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const showToast = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
  };

  const resetModalState = () => {
    setShowModal(false);
    setFormData(initialFormData);
    setSocioSelectorTerm('');
  };

  const filteredSocios = useMemo(() => {
    const term = normalizeText(socioSelectorTerm);
    if (!term) return socios;
    return socios.filter(s =>
      [s.nombres, s.apellido_paterno, s.apellido_materno, s.email, s.numero_socio, s.tipo_socio, s.tipo]
        .some(v => normalizeText(v).includes(term))
    );
  }, [socios, socioSelectorTerm]);

  const filteredSociosEdit = useMemo(() => {
    const term = normalizeText(editSocioTerm);
    if (!term) return socios;
    return socios.filter(s =>
      [s.nombres, s.apellido_paterno, s.apellido_materno, s.email, s.numero_socio, s.tipo_socio, s.tipo]
        .some(v => normalizeText(v).includes(term))
    );
  }, [socios, editSocioTerm]);

  const registrarVisita = async (event) => {
    event.preventDefault();

    if (!formData.nombre_completo.trim()) {
      toast('El nombre completo es obligatorio.', 'warning');
      return;
    }
    if (!formData.telefono.trim()) {
      toast('El teléfono es obligatorio.', 'warning');
      return;
    }
    if (!formData.mayor_16 && !formData.confirmacion_tutor) {
      toast('Para menores de 16 años debes confirmar que ingresará con un tutor.', 'warning');
      return;
    }
    if (formData.tipo_pase === 'visita' && !formData.socio_id) {
      toast('Debes seleccionar un socio activo para una visita.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await adminApi.registrarVisita({
        tipo_pase: formData.tipo_pase,
        socio_id: formData.tipo_pase === 'visita' ? Number(formData.socio_id) : null,
        socio_anfitrion_id: formData.tipo_pase === 'visita' ? Number(formData.socio_id) : null,
        nombre_completo: formData.nombre_completo.trim(),
        identificacion: formData.identificacion.trim(),
        correo: formData.correo.trim(),
        telefono: formData.telefono.trim(),
        mayor_16: formData.mayor_16,
        observaciones: formData.observaciones.trim()
      });

      const nombreGuardado = formData.nombre_completo.trim();
      const correoGuardado = formData.correo.trim();

      resetModalState();
      await fetchData();

      if (response?.qr_image) {
        setQrModal({ open: true, qrImage: response.qr_image, nombre: nombreGuardado, expiraEn: response.expira_en, correo: correoGuardado });
      } else {
        showToast('Visita registrada correctamente');
      }
    } catch (error) {
      toast(error.message || 'Error al registrar visita', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintQr = () => {
    const imgSrc = qrModal.qrImage;
    const nombre = qrModal.nombre;
    const expiraTexto = qrModal.expiraEn
      ? new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: MX_TIMEZONE })
      : '24 horas';

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'display:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>QR Visita</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;background:#fff;}img{width:260px;height:260px;border:2px solid #dbeafe;border-radius:16px;padding:10px;}h2{font-size:18px;font-weight:700;margin-bottom:12px;}p{font-size:12px;color:#64748b;margin-top:8px;}</style></head><body><h2>${nombre}</h2><img src="${imgSrc}" alt="QR"/><p>Válido hasta: ${expiraTexto}</p></body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow.print(); document.body.removeChild(iframe); }, 500);
  };

  const handleEmailQr = () => {
    const subject = encodeURIComponent(`QR de acceso - ${qrModal.nombre}`);
    const body = encodeURIComponent(
      `Hola ${qrModal.nombre},\n\nTu código QR de acceso ya está listo.\n` +
      `Válido hasta: ${qrModal.expiraEn ? new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: MX_TIMEZONE }) : '24 horas'}\n\nClub Deportivo`
    );
    window.open(`mailto:${qrModal.correo ? encodeURIComponent(qrModal.correo) : ''}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrModal.qrImage;
    link.download = `qr_visita_${qrModal.nombre.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const registrarSalida = async (visitaId) => {
    if (!await showConfirm('¿Registrar salida del visitante?')) return;
    setSavingExit(visitaId);
    try {
      await adminApi.registrarSalidaVisita(visitaId);
      if (viewingVisita?.visita_id === visitaId || viewingVisita?.pase_id === visitaId) setViewingVisita(null);
      await fetchData();
      showToast('Salida registrada correctamente');
    } catch (error) {
      toast(error.message || 'Error al registrar salida', 'error');
    } finally {
      setSavingExit(null);
    }
  };

  const cerrarVencidas = async () => {
    setClosingVisits(true);
    try {
      const result = await adminApi.cerrarVisitasVencidas();
      await fetchData();
      const cerradas = Number(result?.cerradas || 0);
      showToast(cerradas > 0 ? `Se cerraron ${cerradas} visita(s) vencida(s).` : 'No había visitas vencidas por cerrar.');
    } catch (error) {
      toast(error.message || 'Error al cerrar visitas vencidas', 'error');
    } finally {
      setClosingVisits(false);
    }
  };

  const openEdit = (visita) => {
    setEditingVisita(visita);
    const socioId = visita.socio_anfitrion_id || visita.socio_id || '';
    const socioObj = socios.find(s => String(s.socio_id) === String(socioId));
    const socioNombre = socioObj
      ? [socioObj.nombres, socioObj.apellido_paterno, socioObj.apellido_materno].filter(Boolean).join(' ')
      : '';
    setEditData({
      nombre_completo: getVisitanteNombre(visita),
      telefono: visita.telefono || '',
      correo: visita.correo || '',
      identificacion: visita.identificacion || '',
      observaciones: visita.observaciones || visita.motivo || '',
      tipo_pase: visita.tipo_pase || 'visita',
      socio_id: String(socioId)
    });
    setEditSocioTerm(socioNombre);
    setViewingVisita(null);
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editData.nombre_completo.trim()) {
      toast('El nombre es requerido.', 'warning');
      return;
    }
    setIsEditing(true);
    try {
      const id = editingVisita.pase_id || editingVisita.visita_id;
      await adminApi.actualizarVisita(id, {
        nombre_completo: editData.nombre_completo.trim(),
        telefono: editData.telefono.trim(),
        correo: editData.correo.trim(),
        identificacion: editData.identificacion.trim(),
        observaciones: editData.observaciones.trim(),
        tipo_pase: editData.tipo_pase,
        socio_id: editData.tipo_pase === 'visita' && editData.socio_id ? Number(editData.socio_id) : null
      });
      setEditingVisita(null);
      await fetchData();
      showToast('Visita actualizada correctamente');
    } catch (error) {
      toast(error.message || 'Error al actualizar visita', 'error');
    } finally {
      setIsEditing(false);
    }
  };

  const verQr = async (visita) => {
    const id = visita.pase_id || visita.visita_id;
    setLoadingQr(true);
    try {
      const response = await adminApi.obtenerQrVisita(id);
      setViewingVisita(null);
      setQrModal({
        open: true,
        qrImage: response.qr_image,
        nombre: getVisitanteNombre(visita),
        expiraEn: response.expira_en,
        correo: visita.correo || ''
      });
    } catch (error) {
      toast(error.message || 'No se pudo obtener el QR', 'error');
    } finally {
      setLoadingQr(false);
    }
  };

  const kpis = useMemo(() => {
    const visitas = historial.filter(r => r.tipo_pase === 'visita').length;
    const pasesDia = historial.filter(r => r.tipo_pase === 'dia').length;
    const finalizadas = historial.filter(r => Boolean(r.hora_salida)).length;
    return { activos: visitasActivas.length, finalizadas, visitas, pasesDia };
  }, [historial, visitasActivas]);

  const visitasFiltradas = useMemo(() => {
    const query = normalizeText(filtro);
    return visitasActivas.filter(v => {
      const text = normalizeText([getVisitanteNombre(v), v.identificacion, getAnfitrionNombre(v), v.numero_socio, v.motivo, v.observaciones].filter(Boolean).join(' '));
      return !query || text.includes(query);
    });
  }, [visitasActivas, filtro]);

  const historialFiltrado = useMemo(() => {
    const query = normalizeText(filtro);
    return historial.filter(r => {
      const finalizada = Boolean(r.hora_salida);
      const text = normalizeText([getVisitanteNombre(r), r.identificacion, getAnfitrionNombre(r), r.numero_socio, r.motivo, r.observaciones].filter(Boolean).join(' '));
      if (query && !text.includes(query)) return false;
      if (filterHistorial === 'activas' && finalizada) return false;
      if (filterHistorial === 'finalizadas' && !finalizada) return false;
      return true;
    });
  }, [historial, filtro, filterHistorial]);

  const kpiCards = [
    { label: 'Pases Activos', value: kpis.activos, Icon: Users, tone: 'blue' },
    { label: 'Finalizados', value: kpis.finalizadas, Icon: CheckCircle, tone: 'green' },
    { label: 'Visitas', value: kpis.visitas, Icon: UserPlus, tone: 'purple' },
    { label: 'Pases de un Día', value: kpis.pasesDia, Icon: Calendar, tone: 'amber' }
  ];

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
              <RefreshCw size={16} className={closingVisits ? 'icon-spin' : ''} /> {closingVisits ? 'Cerrando...' : 'Cerrar vencidas'}
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <UserPlus size={16} /> Nueva Visita
            </button>
          </>
        )}
      />

      <div className="recepcion-kpi-row">
        {kpiCards.map(({ label, value, Icon, tone }) => (
          <article key={label} className={`recepcion-kpi-card tone-${tone}`}>
            <div className="recepcion-kpi-icon"><Icon size={20} /></div>
            <div><strong>{value}</strong><p>{label}</p></div>
          </article>
        ))}
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
            <div className="recepcion-empty-state"><p>No hay visitas activas en este momento.</p></div>
          )}
          {visitasFiltradas.map(visita => (
            <article key={visita.visita_id || visita.pase_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{getVisitanteNombre(visita)}</h3>
                  <p className="espacio-sub">
                    {visita.tipo_pase === 'dia' ? 'Pase de un día' : 'Visita'}
                    {visita.identificacion ? ` • ID: ${visita.identificacion}` : ''}
                  </p>
                </div>
                <span className="badge-success"><Clock size={13} /> {formatHour(visita.hora_entrada)}</span>
              </div>
              <div className="espacio-body">
                <div className="espacio-stat">
                  <span className="stat-label">Anfitrión</span>
                  <span className="stat-value">{getAnfitrionNombre(visita) || 'Sin socio asociado'}</span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Contacto</span>
                  <span className="stat-value">{visita.correo || visita.telefono || '-'}</span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Observaciones</span>
                  <span className="stat-value">{visita.observaciones || visita.motivo || 'Sin observaciones'}</span>
                </div>
              </div>
              <div className="espacio-footer">
                <button onClick={() => setViewingVisita(visita)} className="btn-secondary" title="Ver detalle">
                  <Eye size={14} /> Detalle
                </button>
                <button
                  onClick={() => registrarSalida(visita.visita_id || visita.pase_id)}
                  className="btn-primary"
                  disabled={savingExit === (visita.visita_id || visita.pase_id)}
                >
                  <LogOut size={14} /> {savingExit === (visita.visita_id || visita.pase_id) ? 'Guardando...' : 'Registrar salida'}
                </button>
              </div>
            </article>
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
                <th>Tipo</th>
                <th>Anfitrión</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historialFiltrado.map(registro => (
                <tr key={registro.visita_id || registro.pase_id}>
                  <td><strong>{getVisitanteNombre(registro)}</strong></td>
                  <td>
                    <span className={registro.tipo_pase === 'dia' ? 'badge-warning' : 'badge-success'}>
                      {registro.tipo_pase === 'dia' ? 'Pase de un día' : 'Visita'}
                    </span>
                  </td>
                  <td>{getAnfitrionNombre(registro) || '-'}</td>
                  <td>{formatDateTime(registro.hora_entrada)}</td>
                  <td>{registro.hora_salida ? formatDateTime(registro.hora_salida) : '-'}</td>
                  <td><span className={registro.hora_salida ? 'badge-warning' : 'badge-success'}>{registro.hora_salida ? 'Finalizada' : 'Activa'}</span></td>
                  <td>
                    <button onClick={() => setViewingVisita(registro)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }} title="Ver detalle">
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {historialFiltrado.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>No hay registros para mostrar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Modal */}
      {qrModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="modal-header">
              <h3>QR de Acceso Generado</h3>
              <button onClick={() => setQrModal(prev => ({ ...prev, open: false }))} className="close-modal"><X size={24} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#1e3a5f' }}>{qrModal.nombre}</p>
              <img ref={qrPrintRef} src={qrModal.qrImage} alt="QR de acceso" style={{ width: 220, height: 220, border: '4px solid #dbeafe', borderRadius: 12 }} />
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                Válido hasta: {qrModal.expiraEn ? new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: MX_TIMEZONE }) : '24 horas'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={handlePrintQr} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Printer size={15} /> Imprimir
                </button>
                <button onClick={handleDownloadQr} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={15} /> Descargar
                </button>
                <button onClick={handleEmailQr} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} disabled={!qrModal.correo}>
                  <Mail size={15} /> Enviar por correo
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => { setQrModal(prev => ({ ...prev, open: false })); showToast('Visita registrada correctamente'); }} className="btn-primary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewingVisita && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Detalle de Visita</h3>
              <button onClick={() => setViewingVisita(null)} className="close-modal"><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Visitante</label>
                  <p style={{ margin: 0, fontWeight: 600 }}>{getVisitanteNombre(viewingVisita)}</p>
                </div>
                <div className="form-group">
                  <label>Tipo de pase</label>
                  <span className={viewingVisita.tipo_pase === 'dia' ? 'badge-warning' : 'badge-success'}>
                    {viewingVisita.tipo_pase === 'dia' ? 'Pase de un día' : 'Visita'}
                  </span>
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <p style={{ margin: 0 }}>{viewingVisita.telefono || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <p style={{ margin: 0 }}>{viewingVisita.correo || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Identificación</label>
                  <p style={{ margin: 0 }}>{viewingVisita.identificacion || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Mayor de 16 años</label>
                  <p style={{ margin: 0 }}>{viewingVisita.mayor_16 === false ? 'No' : 'Sí'}</p>
                </div>
                <div className="form-group">
                  <label>Socio anfitrión</label>
                  <p style={{ margin: 0 }}>{getAnfitrionNombre(viewingVisita) || 'Sin socio asociado'}</p>
                </div>
                <div className="form-group">
                  <label>Número de socio</label>
                  <p style={{ margin: 0 }}>{viewingVisita.numero_socio || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Entrada</label>
                  <p style={{ margin: 0 }}>{viewingVisita.hora_entrada ? formatDateTime(viewingVisita.hora_entrada) : '-'}</p>
                </div>
                <div className="form-group">
                  <label>Salida</label>
                  <p style={{ margin: 0 }}>{viewingVisita.hora_salida ? formatDateTime(viewingVisita.hora_salida) : 'Aún dentro del club'}</p>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <span className={viewingVisita.hora_salida ? 'badge-warning' : 'badge-success'}>
                    {viewingVisita.hora_salida ? 'Finalizada' : 'Activa'}
                  </span>
                </div>
                <div className="form-group form-group-full">
                  <label>Observaciones</label>
                  <p style={{ margin: 0 }}>{viewingVisita.observaciones || viewingVisita.motivo || 'Sin observaciones'}</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setViewingVisita(null)} className="btn-outline">Cerrar</button>
              <button onClick={() => openEdit(viewingVisita)} className="btn-secondary">
                <Pencil size={14} /> Editar
              </button>
              {!viewingVisita.hora_salida && (
                <>
                  <button
                    onClick={() => verQr(viewingVisita)}
                    className="btn-secondary"
                    disabled={loadingQr}
                  >
                    <QrCode size={14} /> {loadingQr ? 'Cargando...' : 'Ver QR'}
                  </button>
                  <button
                    onClick={() => { registrarSalida(viewingVisita.visita_id || viewingVisita.pase_id); setViewingVisita(null); }}
                    className="btn-primary"
                    disabled={savingExit === (viewingVisita.visita_id || viewingVisita.pase_id)}
                  >
                    <LogOut size={14} /> Registrar salida
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingVisita && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <h3>Editar Visita</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Corrige los datos del pase si hubo un error al registrar.</p>
              </div>
              <button onClick={() => setEditingVisita(null)} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group form-group-full">
                    <label className="required">Nombre completo</label>
                    <input
                      type="text"
                      value={editData.nombre_completo}
                      onChange={e => setEditData(prev => ({ ...prev, nombre_completo: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Teléfono</label>
                    <input
                      type="text"
                      value={editData.telefono}
                      onChange={e => setEditData(prev => ({ ...prev, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Correo electrónico</label>
                    <input
                      type="email"
                      value={editData.correo}
                      onChange={e => setEditData(prev => ({ ...prev, correo: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Identificación</label>
                    <input
                      type="text"
                      value={editData.identificacion}
                      onChange={e => setEditData(prev => ({ ...prev, identificacion: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipo de pase</label>
                    <select
                      value={editData.tipo_pase}
                      onChange={e => {
                        const next = e.target.value;
                        setEditData(prev => ({ ...prev, tipo_pase: next, socio_id: next === 'visita' ? prev.socio_id : '' }));
                        if (next !== 'visita') setEditSocioTerm('');
                      }}
                    >
                      <option value="visita">Visita (con socio)</option>
                      <option value="dia">Pase de un día</option>
                    </select>
                  </div>

                  {editData.tipo_pase === 'visita' && (
                    <div className="form-group form-group-full">
                      <label>Socio anfitrión</label>
                      <input
                        type="text"
                        value={editSocioTerm}
                        onChange={e => {
                          setEditSocioTerm(e.target.value);
                          if (editData.socio_id) setEditData(prev => ({ ...prev, socio_id: '' }));
                        }}
                        placeholder="Buscar por nombre, correo o número de socio"
                      />
                      <div className="recepcion-socio-results">
                        {filteredSociosEdit.length > 0 ? filteredSociosEdit.slice(0, 8).map(socio => {
                          const isSelected = String(editData.socio_id) === String(socio.socio_id);
                          const socioNombre = [socio.nombres, socio.apellido_paterno, socio.apellido_materno].filter(Boolean).join(' ');
                          return (
                            <button
                              key={socio.socio_id}
                              type="button"
                              className={`recepcion-socio-option${isSelected ? ' selected' : ''}`}
                              onClick={() => {
                                setEditData(prev => ({ ...prev, socio_id: socio.socio_id }));
                                setEditSocioTerm(socioNombre);
                              }}
                            >
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{socioNombre}</div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {socio.numero_socio || 'Sin número'} • {socio.email || 'Sin correo'} • {socio.tipo_socio || socio.tipo || 'Socio'}
                              </div>
                            </button>
                          );
                        }) : (
                          <div className="recepcion-socio-empty">No hay socios que coincidan.</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="form-group form-group-full">
                    <label>Observaciones</label>
                    <textarea
                      rows="3"
                      value={editData.observaciones}
                      onChange={e => setEditData(prev => ({ ...prev, observaciones: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingVisita(null)} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isEditing}>
                  {isEditing ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Visit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content recepcion-pass-modal">
            <div className="modal-header">
              <div>
                <h3>Registrar Nuevo Pase</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Registra visitas con socio anfitrión o pases de un día sin anfitrión.
                </p>
              </div>
              <button onClick={resetModalState} className="close-modal"><X size={24} /></button>
            </div>

            <form onSubmit={registrarVisita}>
              <div className="modal-body">
                <div className="recepcion-modal-highlight">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="required">Tipo de Pase</label>
                      <select
                        value={formData.tipo_pase}
                        onChange={e => {
                          const next = e.target.value;
                          setFormData(prev => ({ ...prev, tipo_pase: next, socio_id: next === 'visita' ? prev.socio_id : '' }));
                          if (next !== 'visita') setSocioSelectorTerm('');
                        }}
                      >
                        <option value="visita">Visita (con socio)</option>
                        <option value="dia">Pase de un día</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Edad</label>
                      <select
                        value={formData.mayor_16 ? 'si' : 'no'}
                        onChange={e => {
                          const isAdult = e.target.value === 'si';
                          setFormData(prev => ({ ...prev, mayor_16: isAdult, confirmacion_tutor: isAdult ? false : prev.confirmacion_tutor }));
                        }}
                      >
                        <option value="si">Mayor de 16 años</option>
                        <option value="no">Menor de 16 años</option>
                      </select>
                    </div>
                  </div>
                </div>

                {!formData.mayor_16 && (
                  <div className="form-alert form-alert-warning">
                    <strong>Importante para menores de 16 años:</strong> debe ingresar con tutor y permanecer con él en todo momento.
                    <label className="recepcion-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.confirmacion_tutor}
                        onChange={e => setFormData(prev => ({ ...prev, confirmacion_tutor: e.target.checked }))}
                      />
                      <span>Confirmo que se respetará esta restricción.</span>
                    </label>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group form-group-full">
                    <label className="required">Nombre completo</label>
                    <input
                      type="text"
                      value={formData.nombre_completo}
                      onChange={e => setFormData(prev => ({ ...prev, nombre_completo: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Identificación</label>
                    <input
                      type="text"
                      value={formData.identificacion}
                      onChange={e => setFormData(prev => ({ ...prev, identificacion: e.target.value }))}
                      placeholder="INE, pasaporte, licencia, etc."
                    />
                  </div>
                  <div className="form-group">
                    <label>Correo electrónico</label>
                    <input
                      type="email"
                      value={formData.correo}
                      onChange={e => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="form-group">
                    <label className="required">Teléfono</label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={e => setFormData(prev => ({ ...prev, telefono: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      required
                    />
                  </div>

                  {formData.tipo_pase === 'visita' && (
                    <div className="form-group form-group-full">
                      <label className="required">Socio asociado</label>
                      <input
                        type="text"
                        value={socioSelectorTerm}
                        onChange={e => {
                          setSocioSelectorTerm(e.target.value);
                          if (formData.socio_id) setFormData(prev => ({ ...prev, socio_id: '' }));
                        }}
                        placeholder="Buscar por nombre, correo o número de socio"
                      />
                      <div className="recepcion-socio-results">
                        {filteredSocios.length > 0 ? filteredSocios.slice(0, 8).map(socio => {
                          const isSelected = String(formData.socio_id) === String(socio.socio_id);
                          const socioNombre = [socio.nombres, socio.apellido_paterno, socio.apellido_materno].filter(Boolean).join(' ').trim();
                          return (
                            <button
                              key={socio.socio_id}
                              type="button"
                              className={`recepcion-socio-option${isSelected ? ' selected' : ''}`}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, socio_id: socio.socio_id }));
                                setSocioSelectorTerm(socioNombre);
                              }}
                            >
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{socioNombre}</div>
                              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                {socio.numero_socio || 'Sin número'} • {socio.email || 'Sin correo'} • {socio.tipo_socio || socio.tipo || 'Socio'}
                              </div>
                            </button>
                          );
                        }) : (
                          <div className="recepcion-socio-empty">No hay socios que coincidan.</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="form-group form-group-full">
                    <label>Motivo / Observaciones</label>
                    <textarea
                      rows="3"
                      value={formData.observaciones}
                      onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="form-alert">
                  <strong>Nota:</strong> si es visita debes asociarla a un socio activo; si es pase de un día no requiere anfitrión. Al guardar se genera el QR de acceso.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={resetModalState} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registrando...' : (
                    <><QrCode size={15} style={{ display: 'inline', marginRight: 6 }} />Registrar y generar QR</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecepcionVisitas;
