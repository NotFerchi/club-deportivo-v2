import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SocioLayout from '../../../components/SocioLayout'
import { MapPin, Zap, Clock } from 'lucide-react'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import '../../../../css/socio/Reservas.css'

  // Icono auxiliar
const CalendarIcon = ({size}) => 
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>


function Reservas() {
  const navigate = useNavigate()
  // Obtener datos del usuario desde localStorage
  const usuarioSesion = localStorage.getItem('usuario')
  const usuario = usuarioSesion ? JSON.parse(usuarioSesion) : null
  const userName = usuario?.nombre || "Socio"
  const socioId = usuario?.socio_id

  // ESTADOS PARA LA LÓGICA DE RESERVA
  const [selectedEspacio, setSelectedEspacio] = useState(null)
  const [bookingDate, setBookingDate] = useState(new Date())
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null)
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false)

  // --- DATOS HARDCODEADOS (En un futuro vendran de la API) ---
  const allEspacios = [
    { id: 1, nombre: 'Cancha Tenis 1', tipo: 'Tenis', imagen: 'https://i.pinimg.com/1200x/69/19/a2/6919a2fcd9ebac0b561e62480644e1cf.jpg' },
    { id: 2, nombre: 'Cancha Tenis 2', tipo: 'Tenis', imagen: 'https://clubcampestrecoatzacoalcos.com.mx/wp-content/uploads/2025/01/club_campestre_coatzacoalcos_golf_tenis_futbol_natacion_gym_salon_eventos_veracruz_mexico_FullSizeRender-1.jpg' },
    { id: 3, nombre: 'Cancha Padel A', tipo: 'Padel', imagen: 'https://i.pinimg.com/1200x/69/19/a2/6919a2fcd9ebac0b561e62480644e1cf.jpg' },
    { id: 4, nombre: 'Cancha Futbol', tipo: 'Futbol', imagen: 'https://i.pinimg.com/1200x/69/19/a2/6919a2fcd9ebac0b561e62480644e1cf.jpg' },
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
    setSelectedTimeSlot(null);
  }

  const handleDateChange = (date) => {
    setBookingDate(date);
    setSelectedTimeSlot(null);
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
    const reservationData = {
      espacio_id: selectedEspacio.id,
      socio_id: socioId,
      fecha_reserva: bookingDate.toISOString().split('T')[0],
      hora_inicio: selectedTimeSlot.hora_inicio,
      hora_fin: selectedTimeSlot.hora_fin,
    };
    console.log("Datos de reserva a enviar:", reservationData);
    alert(`Reserva confirmada con éxito para ${selectedEspacio.nombre} el dia ${reservationData.fecha_reserva} a las ${reservationData.hora_inicio}`);
    setIsConfirmationModalOpen(false);
    setSelectedEspacio(null);
  }

  return (

    <SocioLayout activeTab="reservas" title="Club Social | Reserva de Canchas">
      
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

      {/* PASO 2: CALENDARIO Y HORARIOS */}
      {selectedEspacio && (
        <section className="rs-booking-section">
          <header className="section-header">
            <CalendarIcon size={18} /> <h3>Paso 2: Fecha y Horario - {selectedEspacio.nombre}</h3>
          </header>
          
          <div className="rs-booking-container">
            <div className="rs-calendar-wrapper">
              <h4>Selecciona un dia</h4>
              <Calendar 
                onChange={handleDateChange} 
                value={bookingDate} 
                minDate={new Date()} 
              />
            </div>

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

          {selectedTimeSlot && (
            <div className="rs-final-action">
              <button className="rs-book-btn" onClick={handleCrearReserva}>
                <Zap size={20} fill="currentColor" /> 
                <span>Crear Reserva</span>
              </button>
            </div>
          )}

        {/* --- MODAL DE CONFIRMACIÓN --- */}
        {isConfirmationModalOpen && (
          <div className="rs-modal-overlay">
            <div className="rs-modal">
              <button className="close-btn" onClick={() => setIsConfirmationModalOpen(false)}>
                &times;
              </button>
              
              <div className="modal-header">
                <h3>Confirmar Reserva</h3>
              </div>
              
              <div className="modal-body">
                <p>Cancha: <strong>{selectedEspacio?.nombre}</strong></p>
                <p>Fecha: <strong>{bookingDate.toLocaleDateString()}</strong></p>
                <p>Horario: <strong>{selectedTimeSlot?.hora_inicio.slice(0, 5)} a {selectedTimeSlot?.hora_fin.slice(0, 5)}</strong></p>
                <p>Socio: <strong>{userName}</strong></p>
              </div>
              
              <footer className="modal-footer">
                <button className="modal-btn confirm" onClick={handleConfirmBooking}>
                  Confirmar Booking
                </button>
                <button className="modal-btn cancel" onClick={() => setIsConfirmationModalOpen(false)}>
                  Cancelar
                </button>
              </footer>
            </div>
          </div>
        )}

   
          </section>)}

   </SocioLayout>
  )}
export default Reservas