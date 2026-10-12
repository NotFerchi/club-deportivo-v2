import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import TournamentBracket from '../../../components/TournamentBracket'
import {
  Trophy, Calendar, Users,
  Filter, Medal, Star,
  AlertCircle, CheckCircle
} from 'lucide-react'
import { apiRequest } from '../../../services/api'
import { estadoTorneo } from '../../../components/torneos/torneoUtils'
import ErrorReintentar from '../../../components/torneos/ErrorReintentar'
import '../../../../css/socio/Torneos.css'

const DISCIPLINAS_GRADIENT = {
  'Tenis':      'linear-gradient(135deg, #1e40af, #3b82f6)',
  'Natación':   'linear-gradient(135deg, #0369a1, #38bdf8)',
  'Futbol':     'linear-gradient(135deg, #15803d, #4ade80)',
  'Basquetbol': 'linear-gradient(135deg, #c2410c, #fb923c)',
  'Voleibol':   'linear-gradient(135deg, #7c3aed, #a78bfa)',
  'Padel':      'linear-gradient(135deg, #0f766e, #2dd4bf)',
}
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #0f172a, #334155)'

function Torneos() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const socioId = usuario?.socio_id

  const [vista, setVista] = useState('proximos')
  const [torneos, setTorneos] = useState([])
  const [misTorneos, setMisTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingInscripcion, setLoadingInscripcion] = useState(false)
  const [filtros, setFiltros] = useState({ disciplina: '' })
  const [showModalInscripcion, setShowModalInscripcion] = useState(false)
  const [torneoSeleccionado, setTorneoSeleccionado] = useState(null)
  const [inscritosIds, setInscritosIds] = useState(new Set())
  const [feedback, setFeedback] = useState(null)
  // B-25: si la carga falla se muestra un error con Reintentar, no "No hay torneos"
  const [torneosError, setTorneosError] = useState(false)
  const [misTorneosError, setMisTorneosError] = useState(false)

  useEffect(() => {
    fetchTorneos()
    if (socioId) fetchMisParticipaciones()
  }, [socioId])

  const fetchTorneos = async () => {
    setLoading(true)
    setTorneosError(false)
    try {
      const data = await apiRequest('/torneos')
      setTorneos(Array.isArray(data) ? data : [])
    } catch {
      setTorneos([])
      setTorneosError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchMisParticipaciones = async () => {
    setMisTorneosError(false)
    try {
      const data = await apiRequest('/torneos/mis-participaciones')
      const lista = Array.isArray(data) ? data : []
      setMisTorneos(lista)
      setInscritosIds(new Set(lista.map(p => p.torneo_id)))
    } catch {
      setMisTorneos([])
      setMisTorneosError(true)
    }
  }

  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  const handleInscribirse = (torneo) => {
    setTorneoSeleccionado(torneo)
    setFeedback(null)
    setShowModalInscripcion(true)
  }

  const handleConfirmarInscripcion = async () => {
    if (!socioId) {
      setFeedback({ tipo: 'error', mensaje: 'No se encontró tu perfil de socio' })
      return
    }
    setLoadingInscripcion(true)
    setFeedback(null)
    try {
      await apiRequest(`/torneos/${torneoSeleccionado.torneo_id}/inscribir-me`, {
        method: 'POST',
        body: JSON.stringify({})
      })
      setInscritosIds(prev => new Set([...prev, torneoSeleccionado.torneo_id]))
      await fetchMisParticipaciones()
      setShowModalInscripcion(false)
      setFeedback({ tipo: 'exito', mensaje: `¡Inscripción exitosa en ${torneoSeleccionado.nombre}!` })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({ tipo: 'error', mensaje: err.message || 'Error al inscribirse' })
    } finally {
      setLoadingInscripcion(false)
    }
  }

  // B-23: la etiqueta sale del mapa común de estados (torneoUtils); aquí solo el ícono y el estilo
  const BADGE_ESTADO = {
    Abierto: { Icono: Calendar, clase: 'abierto' },
    Inscripciones_cerradas: { Icono: Users, clase: 'lleno' },
    En_curso: { Icono: Trophy, clase: 'proximo' },
    Finalizado: { Icono: Medal, fondo: '#64748b' },
    Cancelado: { Icono: AlertCircle, fondo: '#b91c1c' }
  }

  const getEstadoBadge = (estado) => {
    const badge = BADGE_ESTADO[estado]
    if (!badge) return null
    const { Icono } = badge
    return (
      <span
        className={`badge-estado ${badge.clase || ''}`}
        style={badge.fondo ? { background: badge.fondo, color: 'white' } : undefined}
      >
        <Icono size={14} /> {estadoTorneo(estado).label}
      </span>
    )
  }

  const formatFecha = (fecha) => {
    if (!fecha) return '—'
    const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        .toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return fecha
  }

  const disciplinasUnicas = [...new Set(torneos.map(t => t.nombre_disciplina).filter(Boolean))]

  const torneosFiltrados = torneos.filter(torneo => {
    if (filtros.disciplina && torneo.nombre_disciplina !== filtros.disciplina) return false
    return true
  })

  const torneosAbiertos = torneosFiltrados.filter(t => t.estado === 'Abierto')

  return (
    <SocioLayout activeTab="torneos" title="Club Social | Torneos">

      {/* HEADER */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Torneos y Competencias</h2>
          <p className="rs-subtitle">Participa en los eventos deportivos del club</p>
        </div>
        <div className="rs-status-tags">
          <span className="tag-category">Mis Torneos: {misTorneos.length}</span>
        </div>
      </section>

      {/* BANNER DE FEEDBACK */}
      {feedback && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1rem',
          background: feedback.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
          color: feedback.tipo === 'exito' ? '#166534' : '#991b1b',
          fontWeight: 600
        }}>
          {feedback.tipo === 'exito' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {feedback.mensaje}
        </div>
      )}

      {/* TABS */}
      <div className="clases-tabs-container torneos-tabs-container">
        <button
          className={`clases-tab-btn torneos-tab-btn ${vista === 'proximos' ? 'active' : ''}`}
          onClick={() => setVista('proximos')}
        >
          <Trophy size={18} /> Torneos Disponibles
        </button>
        <button
          className={`clases-tab-btn torneos-tab-btn ${vista === 'mis-torneos' ? 'active' : ''}`}
          onClick={() => setVista('mis-torneos')}
        >
          <Medal size={18} /> Mis Participaciones
        </button>
        <button
          className={`clases-tab-btn torneos-tab-btn ${vista === 'resultados' ? 'active' : ''}`}
          onClick={() => setVista('resultados')}
        >
          <Star size={18} /> Brackets y Resultados
        </button>
      </div>

      {/* VISTA: TORNEOS DISPONIBLES */}
      {vista === 'proximos' && (
        <div className="proximos-view">
          <div className="filtros-container torneos-filtros-container">
            <div className="filtro-group torneos-filtro-group">
              <label><Filter size={16} /> Disciplina</label>
              <select
                value={filtros.disciplina}
                onChange={(e) => handleFiltroChange('disciplina', e.target.value)}
              >
                <option value="">Todas</option>
                {disciplinasUnicas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state torneos-loading-state">Cargando torneos...</div>
          ) : torneosError ? (
            <ErrorReintentar onReintentar={fetchTorneos} />
          ) : torneosAbiertos.length === 0 ? (
            <div className="empty-state torneos-empty-state">
              <Trophy size={48} />
              <h3>No hay torneos abiertos</h3>
              <p>Revisa la pestaña de Brackets para ver torneos en curso</p>
            </div>
          ) : (
            <div className="torneos-grid">
              {torneosAbiertos.map(torneo => {
                const yaInscrito = inscritosIds.has(torneo.torneo_id)
                const gradient = DISCIPLINAS_GRADIENT[torneo.nombre_disciplina] || DEFAULT_GRADIENT
                return (
                  <div key={torneo.torneo_id} className="torneo-card">
                    <div className="torneo-imagen">
                      <div style={{
                        width: '100%', height: '100%', background: gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Trophy size={52} style={{ color: 'rgba(255,255,255,0.55)' }} />
                      </div>
                      {getEstadoBadge(torneo.estado)}
                    </div>

                    <div className="torneo-contenido">
                      <div className="torneo-meta">
                        <span className="disciplina">{torneo.nombre_disciplina}</span>
                      </div>

                      <h3 className="torneo-nombre">{torneo.nombre}</h3>

                      <div className="torneo-info">
                        {torneo.fecha_inicio && (
                          <div className="info-item">
                            <Calendar size={14} />
                            <span>Inicio: {formatFecha(torneo.fecha_inicio)}</span>
                          </div>
                        )}
                        {torneo.fecha_fin && (
                          <div className="info-item">
                            <Calendar size={14} />
                            <span>Fin: {formatFecha(torneo.fecha_fin)}</span>
                          </div>
                        )}
                        {torneo.nombre_categoria && (
                          <div className="info-item">
                            <Medal size={14} />
                            <span>Categoría: {torneo.nombre_categoria}</span>
                          </div>
                        )}
                      </div>

                      <div className="torneo-footer">
                        <span />
                        {yaInscrito ? (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.625rem 1.25rem', background: '#dcfce7',
                            borderRadius: '8px', color: '#166534', fontWeight: 700,
                            fontSize: '0.9rem'
                          }}>
                            <CheckCircle size={16} /> Inscrito
                          </span>
                        ) : torneo.tipo_torneo === 'Equipos' || !torneo.categoria_id ? (
                          // B-15 / B-10: el socio no puede inscribirse por su cuenta
                          <span style={{
                            maxWidth: '60%', textAlign: 'right', color: '#64748b',
                            fontSize: '0.8rem', fontWeight: 600
                          }}>
                            {torneo.tipo_torneo === 'Equipos'
                              ? 'Torneo por equipos: inscríbete con el staff'
                              : 'Inscripción no disponible: el torneo no tiene categoría'}
                          </span>
                        ) : (
                          <button
                            className="btn-inscribirse torneos-btn-inscribirse"
                            onClick={() => handleInscribirse(torneo)}
                          >
                            Inscribirse
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA: MIS PARTICIPACIONES */}
      {vista === 'mis-torneos' && (
        <div className="mis-torneos-view">
          {misTorneosError ? (
            <ErrorReintentar onReintentar={fetchMisParticipaciones} />
          ) : misTorneos.length === 0 ? (
            <div className="empty-state torneos-empty-state">
              <Medal size={48} />
              <h3>No has participado en torneos</h3>
              <p>Explora los torneos disponibles para inscribirte</p>
            </div>
          ) : (
            <div className="mis-torneos-grid">
              {misTorneos.map(torneo => (
                <div key={torneo.participante_id} className="mi-torneo-card">
                  <div className="mi-torneo-header">
                    <span className="disciplina">{torneo.nombre_disciplina}</span>
                    <span className="estado"
                      style={{ background: estadoTorneo(torneo.estado).bg, color: estadoTorneo(torneo.estado).color }}>
                      {estadoTorneo(torneo.estado).label}
                    </span>
                  </div>
                  <h3>{torneo.nombre}</h3>
                  {torneo.fecha_inicio && (
                    <p className="fecha">{formatFecha(torneo.fecha_inicio)}</p>
                  )}
                  {torneo.categoria && (
                    <div className="resultado">
                      <Users size={16} />
                      <span>{torneo.categoria}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA: BRACKETS Y RESULTADOS */}
      {vista === 'resultados' && (
        <TournamentBracket
          title="Brackets y Resultados"
          subtitle="Consulta los cruces y resultados de los torneos del club."
          readOnly={true}
        />
      )}

      {/* MODAL INSCRIPCIÓN */}
      {showModalInscripcion && torneoSeleccionado && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-torneo">
            <header className="modal-header">
              <h3>Inscribirse al Torneo</h3>
              <button className="close-btn" onClick={() => setShowModalInscripcion(false)}>&times;</button>
            </header>
            <div className="modal-body">
              <div className="torneo-ficha">
                <div style={{
                  width: '100%', height: 160, borderRadius: '12px', marginBottom: '1.5rem',
                  background: DISCIPLINAS_GRADIENT[torneoSeleccionado.nombre_disciplina] || DEFAULT_GRADIENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Trophy size={56} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </div>

                <h2>{torneoSeleccionado.nombre}</h2>

                <div className="ficha-meta">
                  <span>{torneoSeleccionado.nombre_disciplina}</span>
                  {torneoSeleccionado.fecha_inicio && (
                    <span>{formatFecha(torneoSeleccionado.fecha_inicio)}</span>
                  )}
                </div>

                <div style={{ margin: '1.5rem 0', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a', fontSize: '0.875rem' }}>
                    Categoría del torneo
                  </label>
                  {torneoSeleccionado.nombre_categoria ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 1rem', borderRadius: '20px',
                      background: '#dbeafe', color: '#1d4ed8',
                      fontWeight: 700, fontSize: '0.95rem'
                    }}>
                      <Medal size={15} /> {torneoSeleccionado.nombre_categoria}
                    </div>
                  ) : (
                    <div style={{
                      padding: '0.5rem 1rem', borderRadius: '10px',
                      background: '#fef3c7', color: '#b45309',
                      fontWeight: 600, fontSize: '0.85rem'
                    }}>
                      ⚠ Sin categoría asignada. Contacta al administrador.
                    </div>
                  )}
                </div>

                {feedback?.tipo === 'error' && showModalInscripcion && (
                  <div style={{
                    padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: '10px',
                    color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <AlertCircle size={18} /> {feedback.mensaje}
                  </div>
                )}
              </div>
            </div>
            <footer className="modal-footer">
              <button
                className="modal-btn confirm"
                onClick={handleConfirmarInscripcion}
                disabled={loadingInscripcion || !torneoSeleccionado?.nombre_categoria}
              >
                {loadingInscripcion ? 'Procesando...' : 'Confirmar Inscripción'}
              </button>
              <button className="modal-btn cancel" onClick={() => setShowModalInscripcion(false)}>
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

    </SocioLayout>
  )
}

export default Torneos
