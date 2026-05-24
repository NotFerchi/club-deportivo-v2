import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Users, Award } from 'lucide-react'
import '../../css/main.css'
import '../../css/home.css'

function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [semiDark, setSemiDark] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const vh = window.innerHeight
      setSemiDark(y > vh * 0.25)
      setScrolled(y > vh * 0.8)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="navbar-inner">
          <Link to="/" className="logo">Club Deportivo</Link>
          <nav className="nav-links">
            <a href="#about" className="nav-pill">Nosotros</a>
            <a href="#disciplines" className="nav-pill">Disciplinas</a>
            <a href="#membership" className="nav-pill">Membresía</a>
          </nav>
          <Link to="/login" className="nav-cta">Ingresar →</Link>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="hero-section">
          {/* Decorative blobs */}
          <div className="hero-blob hero-blob-1" />
          <div className="hero-blob hero-blob-2" />

          <div className="hero-content">
            <span className="hero-eyebrow">
              <span className="dot" />
              Club Social y Deportivo · Morelia
            </span>
            <h1>Tu mejor<br /><em>versión</em><br />empieza aquí</h1>
            <p className="hero-subtitle">
              Deporte, comunidad y excelencia en un solo espacio diseñado para todos los niveles.
            </p>
            <div className="hero-buttons">
              <Link to="/alta-socio" className="btn-hero-primary">Hazte Socio</Link>
              <Link to="/login" className="btn-hero-secondary">Explorar instalaciones</Link>
            </div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="snum">1,200+</span>
              <span className="slabel">Socios activos</span>
            </div>
            <div className="hero-stat">
              <span className="snum">15+</span>
              <span className="slabel">Disciplinas</span>
            </div>
            <div className="hero-stat">
              <span className="snum">95%</span>
              <span className="slabel">Satisfacción</span>
            </div>
            <div className="hero-stat">
              <span className="snum">12,000+</span>
              <span className="slabel">Horas de juego</span>
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section className="about-section" id="about">
          <div className="container">
            <div className="about-text-col">
              <span className="section-label">Sobre nuestro club</span>
              <h2>Pasión por el movimiento y el deporte</h2>
              <p className="body-text">
                El Club Social y Deportivo es un espacio diseñado para promover la actividad física,
                el bienestar y la convivencia en comunidad. Instalaciones de primer nivel para todos.
              </p>
              <div className="about-features">
                <div className="about-feature">
                  <div className="feature-icon"><Building2 size={19} strokeWidth={1.8} /></div>
                  Instalaciones profesionales certificadas
                </div>
                <div className="about-feature">
                  <div className="feature-icon"><Users size={19} strokeWidth={1.8} /></div>
                  Comunidad de más de 1,200 socios activos
                </div>
                <div className="about-feature">
                  <div className="feature-icon"><Award size={19} strokeWidth={1.8} /></div>
                  Entrenadores certificados en cada disciplina
                </div>
              </div>
            </div>

            <div className="about-image-stack">
              <img
                className="about-img-main"
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800"
                alt="Gym"
              />
              <img
                className="about-img-secondary"
                src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?q=80&w=600"
                alt="Natación"
              />
              <div className="about-badge">
                Abierto hoy
                <span>● Instalaciones disponibles</span>
              </div>
              <div className="about-stat-card">
                <span className="asc-num">95%</span>
                <span className="asc-label">Satisfacción de socios</span>
                <div className="asc-bar"><div className="asc-fill" /></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ── */}
        <div className="trust-strip">
          <div className="container">
            <span className="trust-dot" />
            <p>Más de <strong>1,200 socios</strong> ya disfrutan de nuestras instalaciones en Morelia</p>
            <span className="trust-dot" />
          </div>
        </div>

        {/* ── DISCIPLINES ── */}
        <section className="disciplines-section" id="disciplines">
          <div className="container">
            <div className="section-header-row">
              <div>
                <span className="section-label">Nuestras disciplinas</span>
                <h2>Programas destacados</h2>
              </div>
              <p className="section-desc">
                Explora nuestros programas deportivos diseñados para todos los niveles y edades.
              </p>
            </div>

            <div className="disciplines-grid">
              <div className="disc-card">
                <img
                  src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800"
                  alt="Tenis"
                />
                <div className="disc-overlay" />
                <div className="disc-content">
                  <span className="disc-tag">Canchas certificadas</span>
                  <h3>Tenis Profesional</h3>
                  <div className="disc-rating">★ 4.9 · Canchas disponibles</div>
                </div>
              </div>

              <div className="disc-card">
                <img
                  src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?q=80&w=800"
                  alt="Natación"
                />
                <div className="disc-overlay" />
                <div className="disc-content">
                  <span className="disc-tag">Todos los niveles</span>
                  <h3>Natación</h3>
                  <div className="disc-rating">★ 4.8 · Alberca climatizada</div>
                </div>
              </div>

              <div className="disc-card">
                <img
                  src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800"
                  alt="Fitness"
                />
                <div className="disc-overlay" />
                <div className="disc-content">
                  <span className="disc-tag">Entrenadores certificados</span>
                  <h3>Fitness & Gym</h3>
                  <div className="disc-rating">★ 4.9 · Equipo de última gen.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="how-section" id="membership">
          <div className="container">
            <div className="how-inner">
              <div className="how-image">
                <img
                  src="https://images.unsplash.com/photo-1599586120429-48281b6f0ece?q=80&w=900"
                  alt="Club Deportivo"
                />
                <div className="how-img-overlay" />
                <div className="how-img-badge">
                  <span className="hib-num">+15</span>
                  <span className="hib-text">Disciplinas disponibles</span>
                </div>
              </div>
              <div className="how-content">
                <span className="section-label">Cómo funciona</span>
                <h2>Un clic para empezar tu aventura deportiva</h2>
                <div className="how-steps">
                  <div className="how-step">
                    <div className="step-num">01</div>
                    <div className="step-body">
                      <h4>Regístrate como socio</h4>
                      <p>Crea tu perfil y elige el plan que mejor se adapte a tus metas deportivas.</p>
                    </div>
                  </div>
                  <div className="how-step">
                    <div className="step-num">02</div>
                    <div className="step-body">
                      <h4>Reserva tus actividades</h4>
                      <p>Agenda clases, canchas y espacios directamente desde la plataforma.</p>
                    </div>
                  </div>
                  <div className="how-step">
                    <div className="step-num">03</div>
                    <div className="step-body">
                      <h4>Disfruta y evoluciona</h4>
                      <p>Entrena, conecta con la comunidad y alcanza tus metas deportivas.</p>
                    </div>
                  </div>
                  <div className="how-step">
                    <div className="step-num">04</div>
                    <div className="step-body">
                      <h4>Mide tu progreso</h4>
                      <p>Accede a estadísticas personalizadas y descubre nuevas disciplinas.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ACTIVITIES ── */}
        <section className="activities-section">
          <div className="container">
            <div className="section-header-row">
              <div>
                <span className="section-label">Programas</span>
                <h2>Elige tu disciplina</h2>
              </div>
              <Link to="/login" className="view-all-link">Ver todos →</Link>
            </div>

            <div className="activities-grid">
              <div className="act-card">
                <div className="act-card-img">
                  <img
                    src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=600"
                    alt="Tenis"
                  />
                  <span className="act-badge">Tenis</span>
                  <span className="act-popular">Más popular</span>
                </div>
                <div className="act-card-body">
                  <h3>Tenis Profesional</h3>
                  <p>Canchas de grado de torneo con iluminación profesional para jugar de día o de noche.</p>
                  <div className="act-card-footer">
                    <span className="act-level">Todos los niveles</span>
                    <Link to="/login" className="act-arrow">→</Link>
                  </div>
                </div>
              </div>

              <div className="act-card">
                <div className="act-card-img">
                  <img
                    src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?q=80&w=600"
                    alt="Natación"
                  />
                  <span className="act-badge">Natación</span>
                </div>
                <div className="act-card-body">
                  <h3>Natación</h3>
                  <p>Alberca semiolímpica climatizada con clases para principiantes y nivel competitivo.</p>
                  <div className="act-card-footer">
                    <span className="act-level">Principiante – Avanzado</span>
                    <Link to="/login" className="act-arrow">→</Link>
                  </div>
                </div>
              </div>

              <div className="act-card">
                <div className="act-card-img">
                  <img
                    src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600"
                    alt="Fitness"
                  />
                  <span className="act-badge">Fitness</span>
                  <span className="act-nuevo">Nuevo</span>
                </div>
                <div className="act-card-body">
                  <h3>Fitness & Gym</h3>
                  <p>Entrenadores certificados y equipo de última generación para alcanzar tus metas.</p>
                  <div className="act-card-footer">
                    <span className="act-level">Personalizado</span>
                    <Link to="/login" className="act-arrow">→</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── QUOTE / SOCIAL PROOF ── */}
        <section className="quote-section">
          <div className="container">
            <div className="quote-inner">
              <div className="quote-mark">"</div>
              <blockquote>
                Un lugar donde el deporte se convierte en estilo de vida. Las instalaciones son de primer nivel y la comunidad te impulsa a dar lo mejor.
              </blockquote>
              <div className="quote-author">
                <div className="quote-avatar">CM</div>
                <div>
                  <strong>Carlos M.</strong>
                  <span>Socio desde 2021 · Tenis & Natación</span>
                </div>
              </div>
              <div className="quote-stars">★★★★★ 4.9/5 · basado en 840 reseñas</div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-inner">
              <div className="cta-deco-circle cta-c1" />
              <div className="cta-deco-circle cta-c2" />
              <div className="cta-text">
                <span className="cta-pill">Sin costo de inscripción este mes</span>
                <h2>Comienza tu experiencia deportiva hoy</h2>
                <p>Forma parte de una comunidad apasionada por el deporte y mejora tu rendimiento.</p>
              </div>
              <div className="cta-actions">
                <Link to="/alta-socio" className="btn-cta">Registrarme ahora</Link>
                <Link to="/login" className="btn-cta-sec">Ya soy socio →</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <Link to="/" className="footer-logo">Club Deportivo</Link>
          <p className="footer-text">Club Social y Deportivo © 2026 — Morelia, Michoacán</p>
        </div>
      </footer>
    </>
  )
}

export default Home
