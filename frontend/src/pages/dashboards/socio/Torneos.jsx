import React, { useState, useEffect } from 'react'
import SocioLayout from '../../../components/SocioLayout'
import { 
  Trophy, Calendar, Clock, Users, MapPin, 
  Search, Filter, Medal, Star, ChevronRight,
  User, AlertCircle
} from 'lucide-react'
import '../../../../css/socio/Torneos.css'

function Torneos() {
  // ==================== ESTADOS ====================
  const [vista, setVista] = useState('proximos') // 'proximos' | 'mis-torneos' | 'resultados'
  const [torneos, setTorneos] = useState([])
  const [misTorneos, setMisTorneos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ disciplina: '', nivel: '' })
  const [showModalInscripcion, setShowModalInscripcion] = useState(false)
  const [torneoSeleccionado, setTorneoSeleccionado] = useState(null)

  // ==================== DATOS HARDCODEADOS ====================
  const disciplinas = ['Tenis', 'Natación', 'Futbol', 'Basquetbol', 'Voleibol', 'Padel']
  const niveles = ['Principiante', 'Intermedio', 'Avanzado', 'Open']

  const torneosData = [
    {
      id: 1,
      nombre: 'Copa Primavera 2026',
      disciplina: 'Tenis',
      nivel: 'Intermedio',
      categoria: 'Varones 30-40',
      fecha: '2026-05-10',
      hora: '09:00',
      ubicacion: 'Canchas 1-4',
      modalidad: 'Singles',
      participantes: { actual: 16, max: 24 },
      costo: 350,
      premio: '$15,000 en premios',
      imagen: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400',
      descripcion: 'Torneo de tenis abierto a todos los niveles intermedios. Sistema de eliminación directa.',
      requisitos: 'Ser socio activo, traer raqueta propia',
      estado: 'abierto'
    },
    {
      id: 2,
      nombre: 'Gran Prix Natación',
      disciplina: 'Natación',
      nivel: 'Open',
      categoria: 'Libre',
      fecha: '2026-05-15',
      hora: '08:00',
      ubicacion: 'Alberca Olímpica',
      modalidad: 'Relevos y individual',
      participantes: { actual: 32, max: 40 },
      costo: 200,
      premio: 'Medallas y trofeos',
      imagen: 'https://images.unsplash.com/photo-1519315901367-f34f9150d310?w=400',
      descripcion: 'Competencia de natación con pruebas de estilo libre, espalda y braza.',
      requisitos: 'Saber nadar los 4 estilos básicos',
      estado: 'abierto'
    },
    {
      id: 3,
      nombre: 'Torneo relámpago de Fútbol',
      disciplina: 'Futbol',
      nivel: 'Intermedio',
      categoria: 'Varones',
      fecha: '2026-04-25',
      hora: '16:00',
      ubicacion: 'Campo Principal',
      modalidad: '5 vs 5',
      participantes: { actual: 20, max: 20 },
      costo: 150,
      premio: 'Copa y reconocimientos',
      imagen: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
      descripcion: 'Torneo rápido de una tarde. Equipos de 5 jugadores.',
      requisitos: 'Traer uniforme del club',
      estado: 'lleno'
    },
    {
      id: 4,
      nombre: 'Copa Club de Padel',
      disciplina: 'Padel',
      nivel: 'Avanzado',
      categoria: 'Mixto',
      fecha: '2026-05-20',
      hora: '10:00',
      ubicacion: 'Canchas de Padel',
      modalidad: 'Parejas',
      participantes: { actual: 12, max: 16 },
      costo: 400,
      premio: '$10,000 en premios',
      imagen: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400',
      descripcion: 'Torneo de padel nivel avanzado en modalidad parejas.',
      requisitos: 'Nivel avanzado verificado',
      estado: 'abierto'
    }
  ]

  const misTorneosData = [
    {
      id: 101,
      nombre: 'Copa Invierno Tenis',
      disciplina: 'Tenis',
      nivel: 'Intermedio',
      fecha: '2026-03-15',
      resultado: '3er Lugar',
      puntos: 150,
      estado: 'completado'
    },
    {
      id: 102,
      nombre: 'Torneo de Natación',
      disciplina: 'Natación',
      nivel: 'Open',
      fecha: '2026-04-01',
      resultado: '1er Lugar',
      puntos: 300,
      estado: 'completado'
    }
  ]

  // ==================== EFECTOS ====================
  useEffect(() => {
    setLoading(true)
    setTimeout(() => {
      setTorneos(torneosData)
      setMisTorneos(misTorneosData)
      setLoading(false)
    }, 500)
  }, [])

  // ==================== HANDLERS ====================
  const handleFiltroChange = (campo, valor) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
  }

  const handleInscribirse = (torneo) => {
    setTorneoSeleccionado(torneo)
    setShowModalInscripcion(true)
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'abierto':
        return <span className="badge-estado abierto"><Calendar size={14} /> Abierto</span>
      case 'lleno':
        return <span className="badge-estado lleno"><Users size={14} /> Lleno</span>
      case 'proximo':
        return <span className="badge-estado proximo"><Clock size={14} /> Próximo</span>
      default:
        return null
    }
  }

  const getNivelColor = (nivel) => {
    switch (nivel) {
      case 'Principiante': return 'verde'
      case 'Intermedio': return 'azul'
      case 'Avanzado': return 'naranja'
      case 'Open': return 'morado'
      default: return 'verde'
    }
  }

  // Filtrar torneos
  const torneosFiltrados = torneos.filter(torneo => {
    if (filtros.disciplina && torneo.disciplina !== filtros.disciplina) return false
    if (filtros.nivel && torneo.nivel !== filtros.nivel) return false
    return true
  })

  return (
    <SocioLayout activeTab="torneos" title="Club Social | Torneos">
      
      {/* ==================== HEADER ==================== */}
      <section className="rs-welcome-card">
        <div className="rs-welcome-info">
          <h2 className="rs-title-serif">Torneos y Competencias</h2>
          <p className="rs-subtitle">Participa en los eventos deportivos del club</p>
        </div>
        <div className="rs-status-tags">
          <span className="tag-category">Mis Torneos: {misTorneos.length}</span>
        </div>
      </section>

      {/* ==================== TABS ==================== */}
      <div className="clases-tabs-container">
        <button 
          className={`clases-tab-btn ${vista === 'proximos' ? 'active' : ''}`}
          onClick={() => setVista('proximos')}
        >
          <Trophy size={18} /> Próximos Torneos
        </button>
        <button 
          className={`clases-tab-btn ${vista === 'mis-torneos' ? 'active' : ''}`}
          onClick={() => setVista('mis-torneos')}
        >
          <Medal size={18} /> Mis Participaciones
        </button>
        <button 
          className={`clases-tab-btn ${vista === 'resultados' ? 'active' : ''}`}
          onClick={() => setVista('resultados')}
        >
          <Star size={18} /> Resultados
        </button>
      </div>

      {/* ==================== VISTA: PRÓXIMOS TORNEOS ==================== */}
      {vista === 'proximos' && (
        <div className="proximos-view">
          {/* Filtros */}
          <div className="filtros-container">
            <div className="filtro-group">
              <label><Filter size={16} /> Disciplina</label>
              <select 
                value={filtros.disciplina}
                onChange={(e) => handleFiltroChange('disciplina', e.target.value)}
              >
                <option value="">Todas</option>
                {disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="filtro-group">
              <label><Users size={16} /> Nivel</label>
              <select 
                value={filtros.nivel}
                onChange={(e) => handleFiltroChange('nivel', e.target.value)}
              >
                <option value="">Todos</option>
                {niveles.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Grid de torneos */}
          {loading ? (
            <div className="loading-state">Cargando...</div>
          ) : (
            <div className="torneos-grid">
              {torneosFiltrados.map(torneo => (
                <div key={torneo.id} className="torneo-card">
                  <div className="torneo-imagen">
                    <img src={torneo.imagen} alt={torneo.nombre} />
                    {getEstadoBadge(torneo.estado)}
                  </div>
                  
                  <div className="torneo-contenido">
                    <div className="torneo-meta">
                      <span className={`nivel-badge ${getNivelColor(torneo.nivel)}`}>
                        {torneo.nivel}
                      </span>
                      <span className="disciplina">{torneo.disciplina}</span>
                    </div>

                    <h3 className="torneo-nombre">{torneo.nombre}</h3>
                    <p className="torneo-desc">{torneo.descripcion}</p>

                    <div className="torneo-info">
                      <div className="info-item">
                        <Calendar size={14} />
                        <span>{torneo.fecha}</span>
                      </div>
                      <div className="info-item">
                        <Clock size={14} />
                        <span>{torneo.hora}</span>
                      </div>
                      <div className="info-item">
                        <MapPin size={14} />
                        <span>{torneo.ubicacion}</span>
                      </div>
                    </div>

                    <div className="torneo-participantes">
                      <Users size={14} />
                      <span>{torneo.participantes.actual}/{torneo.participantes.max} participantes</span>
                      <div className="participantes-barra">
                        <div 
                          className="participantes-fill" 
                          style={{ width: `${(torneo.participantes.actual / torneo.participantes.max) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="torneo-premio">
                      <Trophy size={14} />
                      <span>{torneo.premio}</span>
                    </div>

                    <div className="torneo-footer">
                      <span className="torneo-costo">${torneo.costo}</span>
                      <button 
                        className={`btn-inscribirse ${torneo.estado === 'lleno' ? 'disabled' : ''}`}
                        onClick={() => handleInscribirse(torneo)}
                        disabled={torneo.estado === 'lleno'}
                      >
                        {torneo.estado === 'lleno' ? 'Lleno' : 'Inscribirse'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {torneosFiltrados.length === 0 && (
            <div className="empty-state">
              <Search size={48} />
              <h3>No se encontraron torneos</h3>
              <p>Intenta con otros filtros</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== VISTA: MIS PARTICIPACIONES ==================== */}
      {vista === 'mis-torneos' && (
        <div className="mis-torneos-view">
          {loading ? (
            <div className="loading-state">Cargando...</div>
          ) : misTorneos.length === 0 ? (
            <div className="empty-state">
              <Medal size={48} />
              <h3>No has participado en torneos</h3>
              <p>Explora los próximos torneos para participar</p>
            </div>
          ) : (
            <div className="mis-torneos-grid">
              {misTorneos.map(torneo => (
                <div key={torneo.id} className="mi-torneo-card">
                  <div className="mi-torneo-header">
                    <span className="disciplina">{torneo.disciplina}</span>
                    <span className={`estado ${torneo.estado}`}>
                      {torneo.estado === 'completado' ? 'Completado' : 'Activo'}
                    </span>
                  </div>
                  <h3>{torneo.nombre}</h3>
                  <p className="fecha">{torneo.fecha}</p>
                  <div className="resultado">
                    <Medal size={20} />
                    <span>{torneo.resultado}</span>
                  </div>
                  <div className="puntos">
                    +{torneo.puntos} puntos
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== VISTA: RESULTADOS ==================== */}
      {vista === 'resultados' && (
        <div className="resultados-view">
          <div className="resultados-info">
            <Trophy size={24} />
            <div>
              <h4>Próximamente</h4>
              <p>Los resultados de los torneos activos aparecerán aquí una vez finalizados.</p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: INSCRIPCIÓN ==================== */}
      {showModalInscripcion && torneoSeleccionado && (
        <div className="rs-modal-overlay">
          <div className="rs-modal modal-torneo">
            <header className="modal-header">
              <h3>Inscribirse al Torneo</h3>
              <button className="close-btn" onClick={() => setShowModalInscripcion(false)}>&times;</button>
            </header>
            <div className="modal-body">
              <div className="torneo-ficha">
                <img src={torneoSeleccionado.imagen} alt={torneoSeleccionado.nombre} className="ficha-imagen" />
                
                <h2>{torneoSeleccionado.nombre}</h2>
                
                <div className="ficha-meta">
                  <span className={`nivel-badge ${getNivelColor(torneoSeleccionado.nivel)}`}>
                    {torneoSeleccionado.nivel}
                  </span>
                  <span>{torneoSeleccionado.disciplina}</span>
                  <span>{torneoSeleccionado.categoria}</span>
                </div>

                <div className="ficha-detalles">
                  <div className="ficha-detalle">
                    <Calendar size={18} />
                    <div>
                      <strong>Fecha</strong>
                      <span>{torneoSeleccionado.fecha}</span>
                    </div>
                  </div>
                  <div className="ficha-detalle">
                    <Clock size={18} />
                    <div>
                      <strong>Hora</strong>
                      <span>{torneoSeleccionado.hora}</span>
                    </div>
                  </div>
                  <div className="ficha-detalle">
                    <MapPin size={18} />
                    <div>
                      <strong>Ubicación</strong>
                      <span>{torneoSeleccionado.ubicacion}</span>
                    </div>
                  </div>
                  <div className="ficha-detalle">
                    <Users size={18} />
                    <div>
                      <strong>Modalidad</strong>
                      <span>{torneoSeleccionado.modalidad}</span>
                    </div>
                  </div>
                </div>

                <div className="ficha-requisitos">
                  <h4><AlertCircle size={16} /> Requisitos</h4>
                  <p>{torneoSeleccionado.requisitos}</p>
                </div>

                <div className="ficha-costo">
                  <span>Costo de Inscripción:</span>
                  <strong>${torneoSeleccionado.costo}</strong>
                </div>
              </div>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={() => setShowModalInscripcion(false)}>
                Confirmar Inscripción
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