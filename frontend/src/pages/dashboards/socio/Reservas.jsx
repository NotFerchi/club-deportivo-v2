import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  LayoutDashboard, Calendar as CalendarIcon, GraduationCap, Baby, 
  AlertCircle, LogOut, CheckCircle, ChevronDown, BellDot, 
  MapPin, Clock, Zap
} from 'lucide-react'
import Calendar from 'react-calendar' // Importa la biblioteca del calendario
import 'react-calendar/dist/Calendar.css' // Importa los estilos base de la biblioteca
import '../../../../css/Reservas.css'

function Reservas() {
  const navigate = useNavigate()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [userName, setUserName] = useState("Socio")
  const [socioId, setSocioId] = useState(null)

  // ESTADOS PARA LA LÓGICA DE RESERVA
  const [selectedEspacio, setSelectedEspacio] = useState(null)
  const [bookingDate, setBookingDate] = useState(new Date())
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false)

  useEffect(() => {
    // Validacion de sesion
    const usuarioSesion = localStorage.getItem('usuario')
    if (usuarioSesion) {
      const usuario = JSON.parse(usuarioSesion)
      setUserName(usuario.nombre || "Socio")
      setSocioId(usuario.socio_id) // Guardamos el socio_id para la reserva posterior
    }
    document.title = 'Club Social | Reserva de Canchas'
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/')
  }

  // --- DATOS HARDCODEADOS (En un futuro vendran de la API) ---
  const allEspacios = [
    { id: 1, nombre: 'Cancha Tenis 1', tipo: 'Tenis', imagen: 'https://cdn.pixabay.com/photo/2013/07/12/18/38/tennis-ball-153629_1280.png' },
    { id: 2, nombre: 'Cancha Tenis 2', tipo: 'Tenis', imagen: 'https://cdn.pixabay.com/photo/2013/07/12/18/38/tennis-ball-153629_1280.png' },
    { id: 3, nombre: 'Cancha Padel A', tipo: 'Padel', imagen: 'https://cdn.pixabay.com/photo/2020/09/20/19/31/padel-5588078_1280.png' },
    { id: 4, nombre: 'Cancha Futbol', tipo: 'Futbol', imagen: 'https://cdn.pixabay.com/photo/2014/10/22/16/38/soccer-498199_1280.jpg' },
  ];

  const availableTimeSlots = [
    { id: '16:00:00', hora_inicio: '16:00:00', hora_fin: '17:00:00', estado: 'Libre' },
    { id: '17:00:00', hora_inicio: '17:00:00', hora_fin: '18:00:00', estado: 'Libre' },
    { id: '18:00:00', hora_inicio: '18:00:00', hora_fin: '19:00:00', estado: 'Libre' },
    { id: '19:00:00', hora_inicio: '19:00:00', hora_fin: '20:00:00', estado: 'Libre' },
    { id: '20:00:00', hora_inicio: '20:00:00', hora_fin: '21:00:00', estado: 'Libre' },
    { id: '21:00:00', hora_inicio: '21:00:00', hora_fin: '22:00:00', estado: 'Libre' },
  ];

  // --- MANEJADORES DE EVENTOS ---
  const handleEspacioSelect = (espacio) => {
    setSelectedEspacio(espacio);
    setSelectedTimeSlot(null); // Reseteamos el horario si cambia la cancha
  }

  const handleDateChange = (date) => {
    setBookingDate(date);
    setSelectedTimeSlot(null); // Reseteamos el horario si cambia la fecha
  }

  const handleTimeSlotSelect = (slot) => {
    if (slot.estado === 'Libre') {
      setSelectedTimeSlot(slot);
    }
  }

  const handleCrearReserva = () => {
    if (selectedEspacio && bookingDate && selectedTimeSlot) {
      setIsConfirmationModalOpen(true);
    }
  }

  const handleConfirmBooking = () => {
    // Aqui se hara el POST a /api/reservaciones
    const reservationData = {
      espacio_id: selectedEspacio.id,
      socio_id: socioId,
      fecha_reserva: bookingDate.toISOString().split('T')[0],
      hora_inicio: selectedTimeSlot.hora_inicio,
      hora_fin: selectedTimeSlot.hora_fin,
    };
    console.log("Datos de reserva a enviar:", reservationData);
    // Simulación de éxito
    alert(`Reserva confirmada con éxito para ${selectedEspacio.nombre} el dia ${reservationData.fecha_reserva} a las ${reservationData.hora_inicio}`);
    setIsConfirmationModalOpen(false);
    setSelectedEspacio(null);
  }

  return (
    <div className="rs-wrapper">
      {/* --- TOP BAR --- */}
      <header className="rs-top-bar">
        <div className="rs-container-fluid">
          <h1 className="rs-brand-logo">Club Social y Deportivo</h1>
          <div className="rs-user-actions">
            <button className="rs-notif-badge-btn"><BellDot size={20} strokeWidth={2.5} /><span className="notification-ping"></span></button>
            <div className="rs-profile-dropdown-container">
              <div className="rs-profile-trigger" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                <div className="rs-avatar-circle">CM</div>
                <div className="rs-user-text"><span className="rs-name">{userName.split(' ')[0]}</span></div>
                <ChevronDown size={14} className={`rs-arrow ${isProfileOpen ? 'up' : ''}`} />
              </div>
              {isProfileOpen && (
                <div className="rs-dropdown-menu">
                  <div className="rs-dropdown-header"><p className="rs-drop-name">{userName}</p><p className="rs-drop-role">Socio Familiar</p></div>
                  <button onClick={handleLogout} className="rs-logout-item"><LogOut size={16} /> Cerrar Sesión</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* --- NAV TABS (Reservas activa) --- */}
      <nav className="rs-nav-tabs">
        <div className="rs-tabs-container">
          <Link to="/dashboard-socio" className="rs-tab-item"><LayoutDashboard size={20} /> <span>Inicio</span></Link>
          <Link to="#" className="rs-tab-item active"><CalendarIcon size={20} /> <span>Reservas</span></Link>
          <Link to="#" className="rs-tab-item"><GraduationCap size={20} /> <span>Clases</span></Link>
          <Link to="#" className="rs-tab-item"><Baby size={20} /> <span>Ludoteca</span></Link>
          <Link to="#" className="rs-tab-item"><AlertCircle size={20} /> <span>Historial</span></Link>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="rs-body">
        <div className="rs-content-wrapper">
          
          {/* Hero Card */}
          <section className="rs-welcome-card">
            <div className="rs-welcome-info">
              <h2 className="rs-title-serif">Reserva de Canchas</h2>
              <p className="rs-subtitle">Selecciona tu espacio y horario preferido</p>
            </div>
            <div className="rs-status-tags"><span className="tag-category">Socio: {userName}</span></div>
          </section>

          {/* PASO 1: SELECCIONAR ESPACIO */}
          <section className="rs-section">
            <header className="section-header">
              <MapPin size={18} /> <h3>Paso 1: Selecciona una cancha</h3>
            </header>
            <div className="rs-espacios-grid">
              {allEspacios.map((espacio) => (
                <div key={espacio.id} className={`rs-espacio-card ${selectedEspacio?.id === espacio.id ? 'active' : ''}`} onClick={() => handleEspacioSelect(espacio)}>
                  <div className="espacio-img"><img src={espacio.imagen} alt={espacio.nombre} /></div>
                  <div className="espacio-info"><h4>{espacio.nombre}</h4><p>{espacio.tipo}</p></div>
                </div>
              ))}
            </div>
          </section>

          {/* PASO 2: CALENDARIO Y HORARIOS (Visible solo si se selecciona un espacio) */}
          {selectedEspacio && (
            <section className="rs-booking-section">
              <header className="section-header">
                <CalendarIcon size={18} /> <h3>Paso 2: Fecha y Horario - {selectedEspacio.nombre}</h3>
              </header>
              
              <div className="rs-booking-container">
                {/* CALENDARIO INTERACTIVO */}
                <div className="rs-calendar-wrapper">
                  <h4>Selecciona un dia</h4>
                  <Calendar 
                    onChange={handleDateChange} 
                    value={bookingDate} 
                    minDate={new Date()} // No permite fechas pasadas
                  />
                </div>

                {/* HORARIOS DISPONIBLES (Grilla) */}
                <div className="rs-time-slots-wrapper">
                  <h4>Horarios para el {bookingDate.toLocaleDateString()}</h4>
                  <div className="rs-slots-grid">
                    {availableTimeSlots.map((slot) => (
                      <button 
                        key={slot.id} 
                        className={`rs-slot-btn ${slot.estado === 'Ocupado' ? 'occupied' : ''} ${selectedTimeSlot?.id === slot.id ? 'active' : ''}`} 
                        onClick={() => handleTimeSlotSelect(slot)} 
                        disabled={slot.estado === 'Ocupado'}
                      >
                        {slot.hora_inicio.slice(0, 5)} a {slot.hora_fin.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* BOTON FINAL (Solo si todo esta seleccionado) */}
              {selectedTimeSlot && (
                <div className="rs-final-action">
                  <button className="rs-book-btn" onClick={handleCrearReserva}><Zap size={18} /> Crear Reserva</button>
                </div>
              )}
            </section>
          )}

        </div>
      </main>

      {/* --- MODAL DE CONFIRMACIÓN --- */}
      {isConfirmationModalOpen && (
        <div className="rs-modal-overlay">
          <div className="rs-modal">
            <header className="modal-header"><h3>Confirmar Reserva</h3><button className="close-btn" onClick={() => setIsConfirmationModalOpen(false)}>&times;</button></header>
            <div className="modal-body">
              <p>Vas a reservar la <strong>{selectedEspacio.nombre}</strong></p>
              <p>El dia <strong>{bookingDate.toLocaleDateString()}</strong></p>
              <p>En el horario <strong>{selectedTimeSlot.hora_inicio.slice(0, 5)} a {selectedTimeSlot.hora_fin.slice(0, 5)}</strong></p>
              <p>La reserva es para el socio: <strong>{userName}</strong></p>
            </div>
            <footer className="modal-footer">
              <button className="modal-btn confirm" onClick={handleConfirmBooking}>Confirmar Booking</button>
              <button className="modal-btn cancel" onClick={() => setIsConfirmationModalOpen(false)}>Cancelar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reservas