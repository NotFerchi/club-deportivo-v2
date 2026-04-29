import React, { useEffect, useState } from 'react';
import { X, Search, UserPlus } from 'lucide-react';

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

  const resetModalState = () => {
    setShowModal(false);
    setFormData(initialFormData);
    setSocioSelectorTerm('');
  };

  const filteredSocios = socios.filter((socio) => {
    const term = socioSelectorTerm.trim().toLowerCase();
    if (!term) return true;

    return [
      socio.nombres,
      socio.apellido_paterno,
      socio.email,
      socio.numero_socio,
      socio.tipo_socio
    ].some((value) => String(value || '').toLowerCase().includes(term));
  });

  const fetchVisitas = async () => {
    try {
      const token = localStorage.getItem('token');
      const [activasRes, historialRes] = await Promise.all([
        fetch('http://localhost:3000/api/recepcion/visitas/activas', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3000/api/recepcion/visitas/historial?dias=1', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!activasRes.ok || !historialRes.ok) {
        throw new Error('No se pudieron cargar los pases');
      }

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
      const res = await fetch('http://localhost:3000/api/recepcion/socios-lista', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('No se pudo cargar la lista de socios');

      const data = await res.json();
      setSocios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando socios:', error);
      setSocios([]);
    }
  };

  useEffect(() => {
    fetchVisitas();
    fetchSocios();
  }, []);

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) {
      setFilteredVisitas(visitas);
      return;
    }

    const filtered = visitas.filter((pase) =>
      pase.nombre_completo?.toLowerCase().includes(term) ||
      pase.correo?.toLowerCase().includes(term) ||
      pase.telefono?.toLowerCase().includes(term) ||
      pase.socio_anfitrion_nombre?.toLowerCase().includes(term) ||
      pase.numero_socio?.toLowerCase().includes(term) ||
      pase.tipo_pase?.toLowerCase().includes(term)
    );

    setFilteredVisitas(filtered);
  }, [searchTerm, visitas]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre_completo.trim()) {
      alert('El nombre completo es obligatorio');
      return;
    }

    if (!formData.telefono.trim()) {
      alert('El telefono es obligatorio');
      return;
    }

    if (!formData.mayor_16 && !formData.confirmacion_tutor) {
      alert('Para menores de 16 anos debes confirmar que ingresara con un tutor y que no hara uso de las instalaciones.');
      return;
    }

    if (formData.tipo_pase === 'visita' && !formData.socio_id) {
      alert('Debes seleccionar un socio activo para una visita');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/recepcion/visitas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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

      resetModalState();
      fetchVisitas();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleRegistrarSalida = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3000/api/recepcion/visitas/${id}/salida`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo registrar la salida');
      }

      fetchVisitas();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div className="chart-box"><p className="empty-message">Cargando...</p></div>;

  return (
    <div className="chart-box">
      <div className="top-kpi-grid">
        <div className="kpi-card"><UserPlus className="kpi-icon" /><div><h3>{kpis.activos}</h3><p>Pases Activos</p></div></div>
        <div className="kpi-card"><UserPlus className="kpi-icon green" /><div><h3>{kpis.finalizados}</h3><p>Finalizados Hoy</p></div></div>
        <div className="kpi-card"><UserPlus className="kpi-icon blue" /><div><h3>{kpis.visitas}</h3><p>Visitas</p></div></div>
        <div className="kpi-card"><UserPlus className="kpi-icon amber" /><div><h3>{kpis.pasesDia}</h3><p>Pases de un Dia</p></div></div>
      </div>

      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h4>Control de Pases del Dia</h4>
        <div className="flex-gap">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, telefono o socio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">+ Nuevo Pase</button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tipo</th>
              <th>Socio</th>
              <th>Contacto</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredVisitas.length > 0 ? filteredVisitas.map((pase) => (
              <tr key={pase.pase_id}>
                <td>
                  <strong>{pase.nombre_completo}</strong>
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {pase.mayor_16 ? 'Mayor de 16' : 'Menor de 16'}
                  </span>
                </td>
                <td>
                  <span className={pase.tipo_pase === 'visita' ? 'badge-success' : 'badge-warning'}>
                    {pase.tipo_pase === 'visita' ? 'Visita' : 'Pase de un dia'}
                  </span>
                </td>
                <td>
                  {pase.socio_anfitrion_nombre
                    ? `${pase.socio_anfitrion_nombre} ${pase.socio_anfitrion_apellido || ''}`.trim()
                    : 'Sin socio asociado'}
                  <br />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{pase.numero_socio || '—'}</span>
                </td>
                <td>
                  <div>{pase.correo || 'Sin correo'}</div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{pase.telefono || 'Sin telefono'}</span>
                </td>
                <td>{pase.hora_entrada ? new Date(pase.hora_entrada).toLocaleTimeString() : '—'}</td>
                <td>{pase.hora_salida ? new Date(pase.hora_salida).toLocaleTimeString() : '—'}</td>
                <td>
                  <span className={pase.estado === 'activo' ? 'badge-success' : 'badge-warning'}>
                    {pase.estado === 'activo' ? 'Activo' : 'Finalizado'}
                  </span>
                </td>
                <td>
                  {pase.estado === 'activo' && (
                    <button onClick={() => handleRegistrarSalida(pase.pase_id)} className="btn-danger" style={{ padding: '4px 12px', fontSize: '11px' }}>
                      Registrar Salida
                    </button>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  No hay pases para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px', borderRadius: '22px', overflow: 'hidden' }}>
            <div className="modal-header">
              <h3>Registrar Pase</h3>
              <button onClick={resetModalState} className="close-modal"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%)',
                    border: '1px solid #dbeafe',
                    borderRadius: '18px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="required">Tipo de Pase</label>
                      <select
                        value={formData.tipo_pase}
                        onChange={(e) => {
                          const nuevoTipo = e.target.value;
                          setFormData({
                            ...formData,
                            tipo_pase: nuevoTipo,
                            socio_id: nuevoTipo === 'visita' ? formData.socio_id : '',
                            confirmacion_tutor: formData.confirmacion_tutor
                          });
                          if (nuevoTipo !== 'visita') {
                            setSocioSelectorTerm('');
                          }
                        }}
                      >
                        <option value="visita">Visita</option>
                        <option value="dia">Pase de un dia</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Edad</label>
                      <select
                        value={formData.mayor_16 ? 'si' : 'no'}
                        onChange={(e) => setFormData({
                          ...formData,
                          mayor_16: e.target.value === 'si',
                          confirmacion_tutor: e.target.value === 'si' ? false : formData.confirmacion_tutor
                        })}
                      >
                        <option value="si">Mayor de 16</option>
                        <option value="no">Menor de 16</option>
                      </select>
                    </div>
                  </div>
                </div>

                {!formData.mayor_16 && (
                  <div
                    className="form-alert"
                    style={{
                      background: '#fff7ed',
                      border: '1px solid #fdba74',
                      borderRadius: '16px',
                      padding: '0.95rem 1rem',
                      marginBottom: '1rem',
                      color: '#9a3412'
                    }}
                  >
                    <strong>Importante para menores de 16 anos:</strong> Debe entrar con un tutor. Si no viene acompanado, no tiene la entrada permitida. El menor debe permanecer con el padre o tutor en todo momento y no tiene permitido hacer uso de las instalaciones.
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.9rem', color: '#7c2d12', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={formData.confirmacion_tutor}
                        onChange={(e) => setFormData({ ...formData, confirmacion_tutor: e.target.checked })}
                        style={{ marginTop: '0.15rem' }}
                      />
                      Confirmo que el menor ingresara con su tutor y que se respetaran estas restricciones.
                    </label>
                  </div>
                )}

                <div className="form-row" style={{ alignItems: 'start' }}>
                  <div className="form-group">
                    <label className="required">Nombre Completo</label>
                    <input
                      type="text"
                      value={formData.nombre_completo}
                      onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Correo</label>
                    <input
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="required">Telefono</label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      required
                    />
                  </div>

                  {formData.tipo_pase === 'visita' && (
                    <>
                      <div className="form-group form-group-full">
                        <label className="required">Socio Asociado</label>
                        <input
                          type="text"
                          value={socioSelectorTerm}
                          onChange={(e) => {
                            setSocioSelectorTerm(e.target.value);
                            if (formData.socio_id) {
                              setFormData({ ...formData, socio_id: '' });
                            }
                          }}
                          placeholder="Escribe nombre, correo o numero de socio para elegir"
                        />
                        <div
                          style={{
                            marginTop: '0.6rem',
                            border: '1px solid #dbe2ea',
                            borderRadius: '16px',
                            background: '#ffffff',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)'
                          }}
                        >
                          {filteredSocios.length > 0 ? filteredSocios.slice(0, 8).map((socio) => {
                            const selected = String(formData.socio_id) === String(socio.socio_id);
                            return (
                              <button
                                key={socio.socio_id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, socio_id: socio.socio_id });
                                  setSocioSelectorTerm(`${socio.nombres} ${socio.apellido_paterno}`);
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  border: 'none',
                                  borderBottom: '1px solid #eef2f7',
                                  background: selected ? '#eff6ff' : '#fff',
                                  padding: '0.8rem 0.9rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                  {socio.nombres} {socio.apellido_paterno}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '0.15rem' }}>
                                  {socio.numero_socio || 'Sin numero'} • {socio.email || 'Sin correo'} • {socio.tipo_socio}
                                </div>
                              </button>
                            );
                          }) : (
                            <div style={{ padding: '0.9rem', color: '#64748b', fontSize: '13px' }}>
                              No hay socios que coincidan con esa busqueda.
                            </div>
                          )}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: '0.45rem' }}>
                          Busca y selecciona al socio en el mismo bloque. Si el pase es visita, este campo es obligatorio.
                        </small>
                      </div>
                    </>
                  )}

                  <div className="form-group form-group-full" style={{ gridColumn: '1 / -1' }}>
                    <label>Motivos</label>
                    <textarea
                      rows="3"
                      value={formData.observaciones}
                      onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      style={{ width: '100%', minHeight: '96px', resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div className="form-alert">
                  <strong>Regla:</strong> Si el pase es de tipo visita debe asociarse a un socio activo. Si es pase de un dia, el socio se guarda como nulo.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={resetModalState}
                  className="btn-outline"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">Registrar Pase</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GestionVisitas;