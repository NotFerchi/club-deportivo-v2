import React, { useEffect, useState } from 'react';
import '../../css/login.css';
import { API_BASE_URL } from '../services/api';

const rutasPorRol = {
  gerente: '/dashboard-gerente',
  admin: '/dashboard-admin',
  coordinador: '/dashboard-coordinador',
  instructor: '/dashboard-instructor',
  recepcion: '/dashboard-recepcion',
  socio: '/dashboard-socio'
};

const ShieldIcon = () => (
  <svg className="shield-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 5V11C4 16.55 7.84 21.74 12 22C16.16 21.74 20 16.55 20 11V5L12 2Z" fill="currentColor" />
    <path d="M17 7L10.5 13.5L7 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M17.94 17.94C16.18 19.21 14.18 20 12 20C5 20 1 12 1 12C1 12 2.5 9.59 4.47 7.58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M6.23 6.23C7.56 5.5 9.24 5 12 5C19 5 23 12 23 12C22.2 13.44 21.07 14.72 19.71 15.77" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M1 1L23 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const LoginIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <path d="M15 3H5C4.44772 3 4 3.44772 4 4V20C4 20.5523 4.44772 21 5 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 8L20 12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Login() {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    history.pushState(null, '', location.href);
    window.onpopstate = () => {
      history.go(1);
    };

    const usuarioSesion = localStorage.getItem('usuario');
    if (localStorage.getItem('token') && usuarioSesion) {
      redirigirPorRol(JSON.parse(usuarioSesion).rol);
    }
  }, []);

  const redirigirPorRol = (rol) => {
    const destino = rutasPorRol[rol];
    if (destino) {
      window.location.href = destino;
    } else {
      window.location.href = '/';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const respuesta = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, contrasena })
      });

      const data = await respuesta.json();

      if (!respuesta.ok) {
        setError(data.error || 'Credenciales inválidas');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      redirigirPorRol(data.usuario.rol);
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('Error al conectar con el servidor.');
    }
  };

  return (
    <div>
      <header className="main-navbar">
        <a href="/" className="nav-logo">Club Deportivo</a>
      </header>

      <main className="login-container">
        <div className="login-card">
          <div className="brand-header">
            <a href="/" style={{ textDecoration: 'none' }}>
              <div className="shield-container">
                <ShieldIcon />
              </div>
            </a>
            <h1>Club Social y Deportivo</h1>
            <p className="portal-subtitle">Portal de acceso para socios e instructores</p>
          </div>

          <form id="form-login" className="login-form" onSubmit={handleSubmit}>
            <div className="input-field">
              <label htmlFor="user-email">Correo electrónico</label>
              <input
                type="email"
                id="user-email"
                placeholder="tu@correo.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label htmlFor="password">Contraseña</label>
              <div className="password-control">
                <input
                  type={mostrarPass ? 'text' : 'password'}
                  id="password"
                  placeholder="Tu contraseña"
                  required
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                />
                <button
                  type="button"
                  id="toggle-pass"
                  className="eye-btn"
                  onClick={() => setMostrarPass((prev) => !prev)}
                  aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-msg" style={{ color: '#dc2626', textAlign: 'center', marginBottom: 15, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn-submit">
              <LoginIcon />
              Iniciar Sesión
            </button>
          </form>

          <div className="test-credentials-box">
            <span className="test-tag">CREDENCIALES DE PRUEBA</span>
            <div className="test-item">
              <strong>Socio:</strong>
              <span>carlos.mendoza@email.com / socio123</span>
            </div>
            <div className="test-item">
              <strong>Instructor:</strong>
              <span>ana.torres@club.com / instructor123</span>
            </div>
            <div className="test-item">
              <strong>Administrador:</strong>
              <span>admin@club.com / admin123</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
