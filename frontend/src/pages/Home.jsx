import React from 'react'
import { Link } from 'react-router-dom'
import '../../css/main.css'

function Home() {
  return (
    <>
      <header>
        <div className="container navbar">
          <Link to="/" className="logo">Club Deportivo</Link>
          <div className="header-actions">
            <Link to="/login" className="cta-btn">Ingresar ↗</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-container">
          <section className="hero">
            <div className="hero-content">
              <h1>Descubre tu mejor versión deportiva</h1>
              <p>Un espacio donde el deporte, la comunidad y la excelencia se encuentran para ofrecer experiencias únicas a nuestros socios.</p>
              <Link to="/login" className="hero-button">Comenzar ahora</Link>
            </div>
          </section>
        </section>

        <section className="about">
          <div className="container about-grid">
            <div className="about-text">
              <span className="badge">Sobre nuestro club</span>
              <h2>Pasión por el movimiento</h2>
              <p>El Club Social y Deportivo es un espacio diseñado para promover la actividad física, el bienestar y la convivencia.</p>
            </div>
            <div className="about-card dark-card">
              <h3>Instalaciones profesionales</h3>
              <p>Canchas certificadas e iluminación profesional diseñadas para ofrecer la mejor experiencia.</p>
              <div className="status-pill">Abierto hoy <span>●</span></div>
            </div>
          </div>
        </section>

        <section className="stats">
          <div className="container">
            <p className="stats-title">Datos que nos definen</p>
            <div className="stats-grid">
              <div className="stat"><h3>1200+</h3><p>Socios activos</p></div>
              <div className="stat"><h3>12,000+</h3><p>Horas de juego</p></div>
              <div className="stat"><h3>95%</h3><p>Satisfacción</p></div>
              <div className="stat"><h3>15+</h3><p>Disciplinas</p></div>
            </div>
          </div>
        </section>

        <section className="activities">
          <div className="container">
            <div className="section-header">
              <span className="badge">Disciplinas</span>
              <h2>Programas destacados</h2>
            </div>
            <div className="activity-grid">
              <div className="activity-card">
                <img src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=600" alt="Tenis" />
                <div className="card-body"><h3>Tenis Profesional</h3><p>Canchas de grado de torneo con iluminación profesional.</p></div>
              </div>
              <div className="activity-card">
                <img src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?q=80&w=600" alt="Natación" />
                <div className="card-body"><h3>Natación</h3><p>Alberca semiolímpica climatizada para todos los niveles.</p></div>
              </div>
              <div className="activity-card">
                <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600" alt="Fitness" />
                <div className="card-body"><h3>Fitness & Gym</h3><p>Entrenadores certificados para alcanzar tus metas.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="container cta-box">
            <h2>Comienza tu experiencia deportiva hoy</h2>
            <p>Forma parte de una comunidad apasionada por el deporte y mejora tu rendimiento.</p>
            <Link to="/alta-socio" className="cta-main">Registrarme ahora</Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <p>Club Social y Deportivo © 2026 — Morelia, Michoacán</p>
        </div>
      </footer>
    </>
  )
}

export default Home