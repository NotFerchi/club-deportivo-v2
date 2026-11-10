import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { brand } from '../config/brand';
import { Alert, AuthShell, Badge, Button, Input, Stack, Text } from '../components/ui';
import fondoEscritorio from '../assets/img/login-fondo-escritorio.webp';
import fondoMovil from '../assets/img/login-fondo-movil.webp';

const rutasPorRol = {
  gerente: '/dashboard-gerente',
  admin: '/dashboard-admin',
  coordinador: '/dashboard-coordinador',
  instructor: '/dashboard-instructor',
  recepcion: '/dashboard-recepcion',
  socio: '/dashboard-socio'
};

const ERROR_CREDENCIALES = 'Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.';
const ERROR_SERVIDOR = 'No pudimos conectar con el servidor. Intenta de nuevo en unos minutos.';

function Login() {
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

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
    setEnviando(true);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, contrasena })
      });

      // Un proxy o servidor caído puede responder HTML en vez de JSON
      const data = await respuesta.json().catch(() => null);

      if (respuesta.status >= 500 || !data) {
        setError(ERROR_SERVIDOR);
        return;
      }

      if (!respuesta.ok) {
        // 401 = credenciales; otros 4xx (p. ej. 403 cuenta desactivada) traen su propio mensaje
        setError(respuesta.status === 401 ? ERROR_CREDENCIALES : (data.error || ERROR_CREDENCIALES));
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      redirigirPorRol(data.usuario.rol);
    } catch (err) {
      console.error('Error de conexión:', err);
      setError(ERROR_SERVIDOR);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AuthShell
      imageDesktop={fondoEscritorio}
      imageMobile={fondoMovil}
      logo={brand.logos.atleta.logotipo.blanco}
      logoAlt={brand.nombre}
      title="Todo tu club, en un solo panel."
      subtitle="Reservas, clases, torneos y socios en un mismo lugar."
      mobileTitle="Entrena. Reserva. Compite."
      mobileSubtitle="Tu club, en la palma de tu mano."
      panelIntro={
        <Stack gap={12}>
          <Stack direction="row" gap={8} wrap>
            <Badge>Reservas</Badge>
            <Badge>Clases</Badge>
            <Badge>Torneos</Badge>
          </Stack>
          <Stack gap={4}>
            <Text variant="heading">Bienvenido de vuelta</Text>
            <Text variant="small" muted>Accede al panel de tu club.</Text>
          </Stack>
        </Stack>
      }
      mobilePanelIntro={
        <Stack align="center">
          <Text variant="small" muted>Hola, inicia sesión para entrar a tu club</Text>
        </Stack>
      }
      footer={`© ${new Date().getFullYear()} ${brand.nombre}. Todos los derechos reservados.`}
    >
      <Stack as="form" gap={12} onSubmit={handleSubmit} aria-label="Iniciar sesión">
        <Input
          type="email"
          aria-label="Correo electrónico"
          placeholder="Correo electrónico"
          autoComplete="email"
          icon={<Mail size={16} />}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          aria-label="Contraseña"
          placeholder="Contraseña"
          autoComplete="current-password"
          icon={<Lock size={16} />}
          revealable
          required
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />

        {error && <Alert variant="error">{error}</Alert>}

        <Button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : <>Entrar <ArrowRight size={16} /></>}
        </Button>
      </Stack>

      {/* Solo en `vite dev`: Vite reemplaza import.meta.env.DEV por false y el bloque se elimina del build */}
      {import.meta.env.DEV && (
        <Alert variant="info" title="Credenciales de prueba (solo desarrollo)">
          <Stack gap={4}>
            <span><strong>Socio:</strong> carlos.mendoza@email.com / socio123</span>
            <span><strong>Instructor:</strong> ana.torres@club.com / instructor123</span>
            <span><strong>Administrador:</strong> admin@club.com / admin123</span>
          </Stack>
        </Alert>
      )}
    </AuthShell>
  );
}

export default Login;
