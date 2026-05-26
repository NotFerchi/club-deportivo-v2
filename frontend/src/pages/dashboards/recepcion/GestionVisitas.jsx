import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Download, LogOut, Mail, Printer, QrCode, Search, UserPlus, Users, X } from 'lucide-react';

const initialFormData = {
  tipo_pase: 'visita',
  socio_id: '',
  nombre_completo: '',
  correo: '',
  telefono: '',
  mayor_16: true,
  observaciones: '',
  confirmacion_tutor: false
};

function GestionVisitas() {
  const [visitas, setVisitas] = useState([]);
  const [filteredVisitas, setFilteredVisitas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [socios, setSocios] = useState([]);
  const [socioSelectorTerm, setSocioSelectorTerm] = useState('');
  const [kpis, setKpis] = useState({ activos: 0, finalizados: 0, visitas: 0, pasesDia: 0 });
  const [qrModal, setQrModal] = useState({ open: false, qrImage: null, nombre: '', expiraEn: null, correo: '' });
  const [viewingPase, setViewingPase] = useState(null);
  const [savingExit, setSavingExit] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetModalState = () => {
    setShowModal(false);
    setFormData(initialFormData);
    setSocioSelectorTerm('');
  };

  const filteredSocios = socios.filter((socio) => {
    const term = socioSelectorTerm.trim().toLowerCase();
    if (!term) return true;
    return [socio.nombres, socio.apellido_paterno, socio.email, socio.numero_socio, socio.tipo_socio]
      .some((value) => String(value || '').toLowerCase().includes(term));
  });

  const fetchVisitas = async () => {
    try {
      const token = localStorage.getItem('token');
      const [activasRes, historialRes] = await Promise.all([
        fetch('http://localhost:3000/api/recepcion/visitas/activas', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:3000/api/recepcion/visitas/historial?dias=1', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (!activasRes.ok || !historialRes.ok) throw new Error('No se pudieron cargar los pases');

      const activas = await activasRes.json();
      const historial = await historialRes.json();
      const historialArray = Array.isArray(historial) ? historial : [];
      const activasArray = Array.isArray(activas) ? activas : [];

      setVisitas(historialArray);
      setFilteredVisitas(historialArray);
      setKpis({
        activos: activasArray.length,
        finalizados: historialArray.filter((item) => item.estado === 'finalizado').length,
        visitas: historialArray.filter((item) => item.tipo_pase === 'visita').length,
        pasesDia: historialArray.filter((item) => item.tipo_pase === 'dia').length
      });
    } catch (error) {
      console.error('Error cargando pases:', error);
      setVisitas([]);
      setFilteredVisitas([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocios = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/socios-lista', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo cargar la lista de socios');
      const data = await res.json();
      setSocios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando socios:', error);
      setSocios([]);
    }
  };

  useEffect(() => { fetchVisitas(); fetchSocios(); }, []);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) { setFilteredVisitas(visitas); return; }
    setFilteredVisitas(visitas.filter((pase) =>
      pase.nombre_completo?.toLowerCase().includes(term) ||
      pase.correo?.toLowerCase().includes(term) ||
      pase.telefono?.toLowerCase().includes(term) ||
      pase.socio_anfitrion_nombre?.toLowerCase().includes(term) ||
      pase.numero_socio?.toLowerCase().includes(term) ||
      pase.tipo_pase?.toLowerCase().includes(term)
    ));
  }, [searchTerm, visitas]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre_completo.trim()) { alert('El nombre completo es obligatorio'); return; }
    if (!formData.telefono.trim()) { alert('El telefono es obligatorio'); return; }
    if (!formData.mayor_16 && !formData.confirmacion_tutor) {
      alert('Para menores de 16 años debes confirmar que ingresará con un tutor.');
      return;
    }
    if (formData.tipo_pase === 'visita' && !formData.socio_id) {
      alert('Debes seleccionar un socio activo para una visita');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo_pase: formData.tipo_pase,
          socio_id: formData.tipo_pase === 'visita' ? formData.socio_id : null,
          nombre_completo: formData.nombre_completo.trim(),
          correo: formData.correo.trim(),
          telefono: formData.telefono.trim(),
          mayor_16: formData.mayor_16,
          observaciones: formData.observaciones.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al registrar pase');
      }

      const data = await res.json();
      const nombreGuardado = formData.nombre_completo.trim();
      const correoGuardado = formData.correo.trim();

      resetModalState();
      fetchVisitas();

      if (data?.qr_image) {
        setQrModal({ open: true, qrImage: data.qr_image, nombre: nombreGuardado, expiraEn: data.expira_en, correo: correoGuardado });
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegistrarSalida = async (id) => {
    setSavingExit(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/recepcion/visitas/${id}/salida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'No se pudo registrar la salida'); }
      fetchVisitas();
      if (viewingPase?.pase_id === id) setViewingPase(null);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setSavingExit(null);
    }
  };

  const handlePrintQr = () => {
    const win = window.open('', '_blank', 'width=400,height=520');
    win.document.write(`
      <html><head><title>QR Acceso</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fff;}
      img{width:260px;height:260px;border:2px solid #e2e8f0;border-radius:12px;padding:8px;}
      .title{font-weight:700;font-size:18px;color:#1e3a5f;margin-bottom:8px;}
      .sub{font-size:13px;color:#64748b;margin:4px 0;}</style></head>
      <body>
        <div class="title">${qrModal.nombre}</div>
        <img src="${qrModal.qrImage}" alt="QR" />
        <div class="sub">Válido hasta: ${qrModal.expiraEn ? new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : '24 horas'}</div>
        <div class="sub">Club Deportivo — Pase de Acceso</div>
        <script>window.onload=()=>{ window.print(); window.close(); }</script>
      </body></html>
    `);
    win.document.close();
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrModal.qrImage;
    link.download = `qr_${qrModal.nombre.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const handleEmailQr = () => {
    const asunto = encodeURIComponent(`Código QR de acceso - ${qrModal.nombre}`);
    const cuerpo = encodeURIComponent(
      `Hola ${qrModal.nombre},\n\nTu código QR de acceso ha sido generado.\n` +
      `Válido hasta: ${qrModal.expiraEn ? new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : '24 horas'}\n\n` +
      `Presenta este correo en recepción para que escaneen tu QR.\n\nClub Deportivo`
    );
    window.open(`mailto:${qrModal.correo ? encodeURIComponent(qrModal.correo) : ''}?subject=${asunto}&body=${cuerpo}`, '_blank');
  };

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }) : '—';

  const kpiCards = [
    { label: 'Pases Activos', value: kpis.activos, Icon: Users, color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Finalizados Hoy', value: kpis.finalizados, Icon: CheckCircle, color: '#22c55e', bg: '#f0fdf4' },
    { label: 'Visitas', value: kpis.visitas, Icon: UserPlus, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Pases de un Día', value: kpis.pasesDia, Icon: Calendar, color: '#f59e0b', bg: '#fffbeb' }
  ];

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando...</p></div>;

  return (
    <div className="chart-box">
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpiCards.map(({ label, value, Icon, color, bg }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Header de tabla */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={18} style={{ color: '#3b82f6' }} /> Control de Pases del Día
        </h4>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, teléfono o socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <UserPlus size={15} style={{ display: 'inline', marginRight: 6 }} /> Nuevo Pase
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tipo</th>
              <th>Socio Anfitrión</th>
              <th>Contacto</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredVisitas.length > 0 ? filteredVisitas.map((pase) => (
              <tr key={pase.pase_id} style={{ cursor: 'pointer' }} onClick={() => setViewingPase(pase)}>
                <td>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{pase.nombre_completo}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {pase.mayor_16 ? 'Mayor de 16' : '⚠ Menor de 16'}
                  </div>
                </td>
                <td>
                  <span className={pase.tipo_pase === 'visita' ? 'badge-success' : 'badge-warning'}>
                    {pase.tipo_pase === 'visita' ? 'Visita' : 'Pase de un día'}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: '#334155' }}>
                    {pase.socio_anfitrion_nombre
                      ? `${pase.socio_anfitrion_nombre} ${pase.socio_anfitrion_apellido || ''}`.trim()
                      : <span style={{ color: '#94a3b8' }}>Sin socio</span>}
                  </div>
                  {pase.numero_socio && <div style={{ fontSize: 11, color: '#94a3b8' }}>{pase.numero_socio}</div>}
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{pase.correo || <span style={{ color: '#94a3b8' }}>Sin correo</span>}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{pase.telefono || '—'}</div>
                </td>
                <td style={{ fontWeight: 600 }}>{formatTime(pase.hora_entrada)}</td>
                <td style={{ fontWeight: 600 }}>{formatTime(pase.hora_salida)}</td>
                <td>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: pase.estado === 'activo' ? '#dcfce7' : '#f1f5f9',
                    color: pase.estado === 'activo' ? '#166534' : '#475569',
                    border: `1px solid ${pase.estado === 'activo' ? '#bbf7d0' : '#e2e8f0'}`
                  }}>
                    {pase.estado === 'activo' ? 'Activo' : 'Finalizado'}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {pase.estado === 'activo' && (
                    <button
                      onClick={() => handleRegistrarSalida(pase.pase_id)}
                      disabled={savingExit === pase.pase_id}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: 11, borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <LogOut size={13} /> {savingExit === pase.pase_id ? 'Guardando...' : 'Salida'}
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  No hay pases para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle de visita */}
      {viewingPase && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>{viewingPase.nombre_completo}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                  <span className={viewingPase.tipo_pase === 'visita' ? 'badge-success' : 'badge-warning'} style={{ fontSize: 11 }}>
                    {viewingPase.tipo_pase === 'visita' ? 'Visita' : 'Pase de un día'}
                  </span>
                </p>
              </div>
              <button className="close-modal" onClick={() => setViewingPase(null)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                  { label: 'Edad', value: viewingPase.mayor_16 ? 'Mayor de 16 años' : 'Menor de 16 años' },
                  { label: 'Teléfono', value: viewingPase.telefono || '—' },
                  { label: 'Correo', value: viewingPase.correo || '—' },
                  { label: 'Socio anfitrión', value: viewingPase.socio_anfitrion_nombre ? `${viewingPase.socio_anfitrion_nombre} ${viewingPase.socio_anfitrion_apellido || ''}`.trim() : 'Sin socio' },
                  { label: 'Entrada', value: formatTime(viewingPase.hora_entrada) },
                  { label: 'Salida', value: formatTime(viewingPase.hora_salida) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                    <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, marginTop: 3 }}>{value}</div>
                  </div>
                ))}
              </div>
              {viewingPase.observaciones && (
                <div style={{ marginTop: '0.75rem', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Observaciones</div>
                  <div style={{ fontSize: 13, color: '#1e293b', marginTop: 3 }}>{viewingPase.observaciones}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setViewingPase(null)}>Cerrar</button>
              {viewingPase.estado === 'activo' && (
                <button
                  className="btn-primary"
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  onClick={() => handleRegistrarSalida(viewingPase.pase_id)}
                  disabled={savingExit === viewingPase.pase_id}
                >
                  <LogOut size={15} style={{ display: 'inline', marginRight: 6 }} />
                  {savingExit === viewingPase.pase_id ? 'Guardando...' : 'Registrar Salida'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal QR */}
      {qrModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Código QR generado</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{qrModal.nombre}</p>
                </div>
              </div>
              <button className="close-modal" onClick={() => setQrModal({ open: false })}><X size={22} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 16, padding: '1rem', display: 'inline-block' }}>
                <img src={qrModal.qrImage} alt="QR de acceso" style={{ width: 220, height: 220, display: 'block', borderRadius: 8 }} />
              </div>

              {qrModal.expiraEn && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '0.6rem 1rem', fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                  Válido hasta: {new Date(qrModal.expiraEn).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn-outline" onClick={handlePrintQr} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Printer size={15} /> Imprimir
                </button>
                <button className="btn-outline" onClick={handleDownloadQr} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={15} /> Descargar
                </button>
                {qrModal.correo && (
                  <button className="btn-outline" onClick={handleEmailQr} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={15} /> Enviar por correo
                  </button>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => setQrModal({ open: false })}>Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de crear pase */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px', borderRadius: '22px', overflow: 'hidden' }}>
            <div className="modal-header">
              <div>
                <h3>Registrar Pase</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Completa los datos del visitante o pase de día</p>
              </div>
              <button onClick={resetModalState} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%)', border: '1px solid #dbeafe', borderRadius: '18px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="required">Tipo de Pase</label>
                      <select
                        value={formData.tipo_pase}
                        onChange={(e) => {
                          const nuevoTipo = e.target.value;
                          setFormData({ ...formData, tipo_pase: nuevoTipo, socio_id: nuevoTipo === 'visita' ? formData.socio_id : '' });
                          if (nuevoTipo !== 'visita') setSocioSelectorTerm('');
                        }}
                      >
                        <option value="visita">Visita (con socio)</option>
                        <option value="dia">Pase de un día</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Edad</label>
                      <select
                        value={formData.mayor_16 ? 'si' : 'no'}
                        onChange={(e) => setFormData({ ...formData, mayor_16: e.target.value === 'si', confirmacion_tutor: e.target.value === 'si' ? false : formData.confirmacion_tutor })}
                      >
                        <option value="si">Mayor de 16 años</option>
                        <option value="no">Menor de 16 años</option>
                      </select>
                    </div>
                  </div>
                </div>

                {!formData.mayor_16 && (
                  <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '16px', padding: '0.95rem 1rem', marginBottom: '1rem', color: '#9a3412' }}>
                    <strong>Importante para menores de 16 años:</strong> Debe entrar con un tutor. El menor debe permanecer con el tutor en todo momento y no puede hacer uso de las instalaciones.
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.9rem', color: '#7c2d12', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.confirmacion_tutor}
                        onChange={(e) => setFormData({ ...formData, confirmacion_tutor: e.target.checked })}
                        style={{ marginTop: '0.15rem' }}
                      />
                      Confirmo que el menor ingresará con su tutor y se respetarán estas restricciones.
                    </label>
                  </div>
                )}

                <div className="form-row" style={{ alignItems: 'start' }}>
                  <div className="form-group">
                    <label className="required">Nombre Completo</label>
                    <input type="text" value={formData.nombre_completo} onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })} required />
                  </div>

                  <div className="form-group">
                    <label>Correo electrónico</label>
                    <input type="email" value={formData.correo} onChange={(e) => setFormData({ ...formData, correo: e.target.value })} placeholder="opcional" />
                  </div>

                  <div className="form-group">
                    <label className="required">Teléfono</label>
                    <input type="text" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} required />
                  </div>

                  {formData.tipo_pase === 'visita' && (
                    <div className="form-group form-group-full">
                      <label className="required">Socio Asociado</label>
                      <input
                        type="text"
                        value={socioSelectorTerm}
                        onChange={(e) => { setSocioSelectorTerm(e.target.value); if (formData.socio_id) setFormData({ ...formData, socio_id: '' }); }}
                        placeholder="Busca por nombre, correo o número de socio"
                      />
                      <div style={{ marginTop: '0.6rem', border: '1px solid #dbe2ea', borderRadius: '16px', background: '#fff', maxHeight: '200px', overflowY: 'auto' }}>
                        {filteredSocios.length > 0 ? filteredSocios.slice(0, 8).map((socio) => {
                          const isSelected = String(formData.socio_id) === String(socio.socio_id);
                          return (
                            <button
                              key={socio.socio_id}
                              type="button"
                              onClick={() => { setFormData({ ...formData, socio_id: socio.socio_id }); setSocioSelectorTerm(`${socio.nombres} ${socio.apellido_paterno}`); }}
                              style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #eef2f7', background: isSelected ? '#eff6ff' : '#fff', padding: '0.75rem 0.9rem', cursor: 'pointer' }}
                            >
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{socio.nombres} {socio.apellido_paterno}</div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '0.15rem' }}>{socio.numero_socio || 'Sin número'} • {socio.email || 'Sin correo'} • {socio.tipo_socio}</div>
                            </button>
                          );
                        }) : (
                          <div style={{ padding: '0.9rem', color: '#64748b', fontSize: '13px' }}>No hay socios que coincidan.</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="form-group form-group-full" style={{ gridColumn: '1 / -1' }}>
                    <label>Motivo / Observaciones</label>
                    <textarea
                      rows="3"
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      placeholder="Opcional"
                      style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div className="form-alert">
                  <strong>Nota:</strong> Si el pase es de tipo visita debes asociarlo a un socio activo. Si es pase de un día, no requiere socio. Se generará un QR de acceso al guardar.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={resetModalState} className="btn-outline">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Registrando...'
                    : <><QrCode size={15} style={{ display: 'inline', marginRight: 6 }} /> Registrar y generar QR</>}
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
