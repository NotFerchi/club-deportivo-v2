import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Eye,
  LogOut,
  Mail,
  Printer,
  QrCode,
  RefreshCw,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { adminApi } from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { FilterSelect, ModuleHeader, SearchInput } from '../../../components/admin/AdminUI';
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

function getVisitanteNombre(pase) {
  return pase?.nombre_completo || [pase?.nombre, pase?.apellidos].filter(Boolean).join(' ').trim();
}

function getAnfitrionNombre(pase) {
  const nombreCompleto = [
    pase?.socio_anfitrion_nombre,
    pase?.socio_anfitrion_apellido,
    pase?.socio_anfitrion_apellido_materno
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (nombreCompleto) return nombreCompleto;
  if (pase?.socio_nombre) return pase.socio_nombre;

  const socioId = pase?.socio_anfitrion_id || pase?.socio_id;
  return socioId ? `Socio #${socioId}` : '';
}

function isSameMxDay(value, reference = new Date()) {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;

  const targetDay = target.toLocaleDateString('en-CA', { timeZone: MX_TIMEZONE });
  const referenceDay = reference.toLocaleDateString('en-CA', { timeZone: MX_TIMEZONE });

  return targetDay === referenceDay;
}

function formatHour(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('es-MX', {
    timeZone: MX_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  });
}

function GestionVisitas() {
  const { toast } = useNotification();
  const [visitasActivas, setVisitasActivas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState(initialFormData);
  const [filtro, setFiltro] = useState('');
  const [filterHistorial, setFilterHistorial] = useState('');
  const [socioSelectorTerm, setSocioSelectorTerm] = useState('');
  const [closingVisits, setClosingVisits] = useState(false);
  const [savingExit, setSavingExit] = useState(null);
  const [viewingPase, setViewingPase] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrModal, setQrModal] = useState({
    open: false,
    qrImage: null,
    nombre: '',
    expiraEn: null,
    correo: ''
  });
  const qrPrintRef = useRef(null);

  const showToast = (message) => {
    setSuccessMessage(message);
    setShowSuccess(true);
  };

  useEffect(() => {
    if (!showSuccess) return undefined;
    const timeout = window.setTimeout(() => {
      setShowSuccess(false);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [showSuccess]);

  const resetModalState = () => {
    setShowModal(false);
    setFormData(initialFormData);
    setSocioSelectorTerm('');
  };

  const fetchData = async () => {
    try {
      setLoadError('');
      await adminApi.cerrarVisitasVencidas().catch(() => null);

      const [activasData, sociosData, historialData] = await Promise.all([
        adminApi.getVisitasActivas(),
        adminApi.getSociosVisitas(),
        adminApi.getHistorialVisitas(7)
      ]);

      setVisitasActivas(Array.isArray(activasData) ? activasData : []);
      setHistorial(Array.isArray(historialData) ? historialData : []);
      setSocios(Array.isArray(sociosData) ? sociosData : []);
    } catch (error) {
      console.error('Error cargando visitas:', error);
      setLoadError(error.message || 'No se pudo cargar la información de recepción.');
      setVisitasActivas([]);
      setHistorial([]);
      setSocios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSocios = useMemo(() => {
    const term = normalizeText(socioSelectorTerm);
    if (!term) return socios;

    return socios.filter((socio) =>
      [
        socio?.nombres,
        socio?.apellido_paterno,
        socio?.apellido_materno,
        socio?.email,
        socio?.numero_socio,
        socio?.tipo_socio,
        socio?.tipo
      ].some((value) => normalizeText(value).includes(term))
    );
  }, [socios, socioSelectorTerm]);

  const visitasFiltradas = useMemo(() => {
    const term = normalizeText(filtro);
    if (!term) return visitasActivas;

    return visitasActivas.filter((pase) =>
      [
        getVisitanteNombre(pase),
        getAnfitrionNombre(pase),
        pase?.correo,
        pase?.telefono,
        pase?.numero_socio,
        pase?.tipo_pase,
        pase?.identificacion,
        pase?.observaciones
      ].some((value) => normalizeText(value).includes(term))
    );
  }, [filtro, visitasActivas]);

  const historialFiltrado = useMemo(() => {
    const term = normalizeText(filtro);

    return historial.filter((registro) => {
      const matchesSearch = !term || [
        getVisitanteNombre(registro),
        getAnfitrionNombre(registro),
        registro?.correo,
        registro?.telefono,
        registro?.numero_socio,
        registro?.tipo_pase,
        registro?.identificacion,
        registro?.observaciones
      ].some((value) => normalizeText(value).includes(term));

      if (!matchesSearch) return false;

      if (filterHistorial === 'activas') return !registro?.hora_salida;
      if (filterHistorial === 'finalizadas') return Boolean(registro?.hora_salida);
      return true;
    });
  }, [filtro, filterHistorial, historial]);

  const kpis = useMemo(() => {
    const registrosHoy = historial.filter((registro) => isSameMxDay(registro?.hora_entrada || registro?.fecha_pase || registro?.fecha_visita));

    return {
      activos: visitasActivas.length,
      finalizadosHoy: historial.filter((registro) => isSameMxDay(registro?.hora_salida)).length,
      visitas: registrosHoy.filter((registro) => registro?.tipo_pase === 'visita').length,
      pasesDia: registrosHoy.filter((registro) => registro?.tipo_pase === 'dia').length
    };
  }, [historial, visitasActivas]);

  const handleSubmit = async (event) => {
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
        setQrModal({
          open: true,
          qrImage: response.qr_image,
          nombre: nombreGuardado,
          expiraEn: response.expira_en,
          correo: correoGuardado
        });
      } else {
        showToast('Pase registrado correctamente');
      }
    } catch (error) {
      toast(error.message || 'No se pudo registrar el pase.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistrarSalida = async (id) => {
    setSavingExit(id);
    try {
      await adminApi.registrarSalidaVisita(id);
      if (viewingPase?.pase_id === id || viewingPase?.visita_id === id) {
        setViewingPase(null);
      }
      showToast('Salida registrada correctamente');
      await fetchData();
    } catch (error) {
      toast(error.message || 'No se pudo registrar la salida.', 'error');
    } finally {
      setSavingExit(null);
    }
  };

  const verQr = async (pase) => {
    const id = pase.pase_id || pase.visita_id;
    setLoadingQr(true);
    try {
      const response = await adminApi.obtenerQrVisita(id);
      setViewingPase(null);
      setQrModal({
        open: true,
        qrImage: response.qr_image,
        nombre: getVisitanteNombre(pase),
        expiraEn: response.expira_en,
        correo: pase.correo || ''
      });
    } catch (error) {
      toast(error.message || 'No se pudo obtener el QR', 'error');
    } finally {
      setLoadingQr(false);
    }
  };

  const cerrarVencidas = async () => {
    setClosingVisits(true);
    try {
      const result = await adminApi.cerrarVisitasVencidas();
      const cerradas = Number(result?.cerradas || 0);
      showToast(
        cerradas > 0
          ? `Se cerraron ${cerradas} visita(s) vencida(s).`
          : 'No había visitas vencidas por cerrar.'
      );
      await fetchData();
    } catch (error) {
      toast(error.message || 'No se pudieron cerrar las vencidas.', 'error');
    } finally {
      setClosingVisits(false);
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
    doc.write(`<!DOCTYPE html><html><head><title>QR Acceso</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;background:#fff;color:#0f172a;}img{width:260px;height:260px;border:2px solid #dbeafe;border-radius:16px;padding:10px;}h2{font-size:18px;font-weight:700;margin-bottom:12px;}p{font-size:12px;color:#64748b;margin-top:8px;}</style></head><body><h2>${nombre}</h2><img src="${imgSrc}" alt="QR de acceso"/><p>Válido hasta: ${expiraTexto}</p></body></html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrModal.qrImage;
    link.download = `qr_${qrModal.nombre.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const handleEmailQr = () => {
    const subject = encodeURIComponent(`Código QR de acceso - ${qrModal.nombre}`);
    const body = encodeURIComponent(
      `Hola ${qrModal.nombre},\n\nTu código QR de acceso ya está listo.\n` +
      `Válido hasta: ${qrModal.expiraEn ? new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: MX_TIMEZONE }) : '24 horas'}\n\n` +
      'Presenta este correo en recepción.\n\nClub Deportivo'
    );
    window.open(`mailto:${qrModal.correo ? encodeURIComponent(qrModal.correo) : ''}?subject=${subject}&body=${body}`, '_blank');
  };

  const kpiCards = [
    { label: 'Pases Activos', value: kpis.activos, Icon: Users, tone: 'blue' },
    { label: 'Finalizados Hoy', value: kpis.finalizadosHoy, Icon: CheckCircle, tone: 'green' },
    { label: 'Visitas', value: kpis.visitas, Icon: UserPlus, tone: 'purple' },
    { label: 'Pases de un Día', value: kpis.pasesDia, Icon: Calendar, tone: 'amber' }
  ];

  if (loading) {
    return (
      <div className="chart-box">
        <p className="empty-message">Cargando recepción y visitas...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="chart-box">
        <div className="recepcion-empty-state">
          <p>{loadError}</p>
          <button className="btn-primary" onClick={fetchData}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-box recepcion-visitas-module">
      {showSuccess && (
        <div className="success-toast">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <ModuleHeader
        icon={Users}
        title="Recepción y Control de Visitas"
        subtitle={`Activas: ${visitasActivas.length} | Historial 7 días: ${historial.length}`}
        actions={(
          <>
            <SearchInput
              value={filtro}
              onChange={setFiltro}
              placeholder="Buscar visitante o anfitrión"
            />
            <button className="btn-outline" onClick={cerrarVencidas} disabled={closingVisits}>
              <RefreshCw size={16} className={closingVisits ? 'icon-spin' : ''} />
              {closingVisits ? 'Cerrando...' : 'Cerrar vencidas'}
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <UserPlus size={16} /> Nuevo Pase
            </button>
          </>
        )}
      />

      <div className="recepcion-kpi-row">
        {kpiCards.map(({ label, value, Icon, tone }) => (
          <article key={label} className={`recepcion-kpi-card tone-${tone}`}>
            <div className="recepcion-kpi-icon">
              <Icon size={20} />
            </div>
            <div>
              <strong>{value}</strong>
              <p>{label}</p>
            </div>
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

      <section style={{ marginBottom: '2rem' }}>
        <h5 className="chart-title-row">
          <Users size={18} /> Visitas Activas ({visitasFiltradas.length})
        </h5>

        <div className="grid-auto">
          {visitasFiltradas.length === 0 && (
            <div className="recepcion-empty-state">
              <p>No hay visitas activas en este momento.</p>
            </div>
          )}

          {visitasFiltradas.map((pase) => (
            <article key={pase.visita_id || pase.pase_id} className="espacio-card-modern">
              <div className="espacio-header">
                <div>
                  <h3 className="espacio-title">{getVisitanteNombre(pase)}</h3>
                  <p className="espacio-sub">
                    {pase.tipo_pase === 'dia' ? 'Pase de un día' : 'Visita'}
                    {pase.identificacion ? ` • ID: ${pase.identificacion}` : ''}
                  </p>
                </div>
                <span className="badge-success">
                  <Clock size={13} /> {formatHour(pase.hora_entrada)}
                </span>
              </div>

              <div className="espacio-body">
                <div className="espacio-stat">
                  <span className="stat-label">Anfitrión</span>
                  <span className="stat-value">{getAnfitrionNombre(pase) || 'Sin socio asociado'}</span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Contacto</span>
                  <span className="stat-value">{pase.correo || pase.telefono || 'Sin datos de contacto'}</span>
                </div>
                <div className="espacio-stat">
                  <span className="stat-label">Observaciones</span>
                  <span className="stat-value">{pase.observaciones || 'Sin observaciones'}</span>
                </div>
              </div>

              <div className="espacio-footer">
                <button onClick={() => setViewingPase(pase)} className="btn-secondary" title="Ver detalle">
                  <Eye size={14} /> Detalle
                </button>
                <button
                  onClick={() => handleRegistrarSalida(pase.visita_id || pase.pase_id)}
                  className="btn-primary"
                  disabled={savingExit === (pase.visita_id || pase.pase_id)}
                >
                  <LogOut size={14} /> {savingExit === (pase.visita_id || pase.pase_id) ? 'Guardando...' : 'Registrar salida'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h5 className="chart-title-row">
          <Clock size={18} /> Historial de visitas (últimos 7 días)
        </h5>

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
              {historialFiltrado.length > 0 ? historialFiltrado.map((registro) => (
                <tr key={registro.visita_id || registro.pase_id}>
                  <td>
                    <strong>{getVisitanteNombre(registro)}</strong>
                  </td>
                  <td>
                    <span className={registro.tipo_pase === 'dia' ? 'badge-warning' : 'badge-success'}>
                      {registro.tipo_pase === 'dia' ? 'Pase de un día' : 'Visita'}
                    </span>
                  </td>
                  <td>{getAnfitrionNombre(registro) || '-'}</td>
                  <td>{formatDateTime(registro.hora_entrada)}</td>
                  <td>{registro.hora_salida ? formatDateTime(registro.hora_salida) : '-'}</td>
                  <td>
                    <span className={registro.hora_salida ? 'badge-warning' : 'badge-success'}>
                      {registro.hora_salida ? 'Finalizada' : 'Activa'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => setViewingPase(registro)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      title="Ver detalle"
                    >
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                    No hay registros para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {viewingPase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Detalle del Pase</h3>
              <button onClick={() => setViewingPase(null)} className="close-modal">
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Visitante</label>
                  <p style={{ margin: 0, fontWeight: 600 }}>{getVisitanteNombre(viewingPase)}</p>
                </div>
                <div className="form-group">
                  <label>Tipo de pase</label>
                  <span className={viewingPase.tipo_pase === 'dia' ? 'badge-warning' : 'badge-success'}>
                    {viewingPase.tipo_pase === 'dia' ? 'Pase de un día' : 'Visita'}
                  </span>
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <p style={{ margin: 0 }}>{viewingPase.telefono || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <p style={{ margin: 0 }}>{viewingPase.correo || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Identificación</label>
                  <p style={{ margin: 0 }}>{viewingPase.identificacion || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Mayor de 16 años</label>
                  <p style={{ margin: 0 }}>{viewingPase.mayor_16 === false ? 'No' : 'Sí'}</p>
                </div>
                <div className="form-group">
                  <label>Socio anfitrión</label>
                  <p style={{ margin: 0 }}>{getAnfitrionNombre(viewingPase) || 'Sin socio asociado'}</p>
                </div>
                <div className="form-group">
                  <label>Número de socio</label>
                  <p style={{ margin: 0 }}>{viewingPase.numero_socio || '-'}</p>
                </div>
                <div className="form-group">
                  <label>Entrada</label>
                  <p style={{ margin: 0 }}>{viewingPase.hora_entrada ? formatDateTime(viewingPase.hora_entrada) : '-'}</p>
                </div>
                <div className="form-group">
                  <label>Salida</label>
                  <p style={{ margin: 0 }}>{viewingPase.hora_salida ? formatDateTime(viewingPase.hora_salida) : 'Aún dentro del club'}</p>
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <span className={viewingPase.hora_salida ? 'badge-warning' : 'badge-success'}>
                    {viewingPase.hora_salida ? 'Finalizada' : 'Activa'}
                  </span>
                </div>
                <div className="form-group form-group-full">
                  <label>Observaciones</label>
                  <p style={{ margin: 0 }}>{viewingPase.observaciones || 'Sin observaciones'}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setViewingPase(null)} className="btn-outline">Cerrar</button>
              {!viewingPase.hora_salida && (
                <>
                  <button
                    onClick={() => verQr(viewingPase)}
                    className="btn-secondary"
                    disabled={loadingQr}
                  >
                    <QrCode size={14} /> {loadingQr ? 'Cargando...' : 'Ver QR'}
                  </button>
                  <button
                    onClick={() => handleRegistrarSalida(viewingPase.visita_id || viewingPase.pase_id)}
                    className="btn-primary"
                    disabled={savingExit === (viewingPase.visita_id || viewingPase.pase_id)}
                  >
                    <LogOut size={14} /> {savingExit === (viewingPase.visita_id || viewingPase.pase_id) ? 'Guardando...' : 'Registrar salida'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {qrModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="modal-header">
              <h3>QR de Acceso Generado</h3>
              <button
                onClick={() => setQrModal((prev) => ({ ...prev, open: false }))}
                className="close-modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#1e3a5f' }}>{qrModal.nombre}</p>
              <img
                ref={qrPrintRef}
                src={qrModal.qrImage}
                alt="QR de acceso"
                style={{ width: 220, height: 220, border: '4px solid #dbeafe', borderRadius: 12 }}
              />
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
                <button onClick={handleEmailQr} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Mail size={15} /> Enviar por correo
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setQrModal((prev) => ({ ...prev, open: false }));
                  showToast('Pase registrado correctamente');
                }}
                className="btn-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content recepcion-pass-modal">
            <div className="modal-header">
              <div>
                <h3>Registrar Nuevo Pase</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  Usa el mismo flujo visual de recepción para visitas y pases de un día.
                </p>
              </div>
              <button onClick={resetModalState} className="close-modal">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="recepcion-modal-highlight">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="required">Tipo de Pase</label>
                      <select
                        value={formData.tipo_pase}
                        onChange={(event) => {
                          const nextType = event.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            tipo_pase: nextType,
                            socio_id: nextType === 'visita' ? prev.socio_id : '',
                            confirmacion_tutor: nextType === 'visita' ? prev.confirmacion_tutor : prev.confirmacion_tutor
                          }));
                          if (nextType !== 'visita') setSocioSelectorTerm('');
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
                        onChange={(event) => {
                          const isAdult = event.target.value === 'si';
                          setFormData((prev) => ({
                            ...prev,
                            mayor_16: isAdult,
                            confirmacion_tutor: isAdult ? false : prev.confirmacion_tutor
                          }));
                        }}
                      >
                        <option value="si">Mayor de 16 años</option>
                        <option value="no">Menor de 16 años</option>
                      </select>
                    </div>
                  </div>
                </div>

                {!formData.mayor_16 && (
                  <div className="form-alert-warning">
                    <strong>Importante para menores de 16 años:</strong> debe ingresar con tutor y permanecer con él en todo momento.
                    <label className="recepcion-checkbox-row">
                      <input
                        type="checkbox"
                        checked={formData.confirmacion_tutor}
                        onChange={(event) => setFormData((prev) => ({ ...prev, confirmacion_tutor: event.target.checked }))}
                      />
                      <span>Confirmo que se respetará esta restricción.</span>
                    </label>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="required">Nombre completo</label>
                    <input
                      type="text"
                      value={formData.nombre_completo}
                      onChange={(event) => setFormData((prev) => ({ ...prev, nombre_completo: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Identificación</label>
                    <input
                      type="text"
                      value={formData.identificacion}
                      onChange={(event) => setFormData((prev) => ({ ...prev, identificacion: event.target.value }))}
                      placeholder="INE, pasaporte, licencia, etc."
                    />
                  </div>

                  <div className="form-group">
                    <label>Correo electrónico</label>
                    <input
                      type="email"
                      value={formData.correo}
                      onChange={(event) => setFormData((prev) => ({ ...prev, correo: event.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="form-group">
                    <label className="required">Teléfono</label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(event) => setFormData((prev) => ({ ...prev, telefono: event.target.value }))}
                      required
                    />
                  </div>

                  {formData.tipo_pase === 'visita' && (
                    <div className="form-group form-group-full">
                      <label className="required">Socio asociado</label>
                      <input
                        type="text"
                        value={socioSelectorTerm}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSocioSelectorTerm(nextValue);
                          if (formData.socio_id) {
                            setFormData((prev) => ({ ...prev, socio_id: '' }));
                          }
                        }}
                        placeholder="Buscar por nombre, correo o número de socio"
                      />

                      <div className="recepcion-socio-results">
                        {filteredSocios.length > 0 ? filteredSocios.slice(0, 8).map((socio) => {
                          const isSelected = String(formData.socio_id) === String(socio.socio_id);
                          const socioNombre = [socio.nombres, socio.apellido_paterno, socio.apellido_materno]
                            .filter(Boolean)
                            .join(' ')
                            .trim();

                          return (
                            <button
                              key={socio.socio_id}
                              type="button"
                              className={`recepcion-socio-option${isSelected ? ' selected' : ''}`}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, socio_id: socio.socio_id }));
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
                      onChange={(event) => setFormData((prev) => ({ ...prev, observaciones: event.target.value }))}
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
                    <>
                      <QrCode size={15} style={{ display: 'inline', marginRight: 6 }} />
                      Registrar y generar QR
                    </>
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

export default GestionVisitas;
