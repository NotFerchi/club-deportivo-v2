import { useNotification } from '../../../context/NotificationContext';
import React, { useEffect, useRef, useState } from 'react';
import { Clock, Users, ChevronDown, ChevronUp, Check, X, MapPin, Calendar, CalendarX, ClipboardList, UserPlus, UserMinus, QrCode, CheckCircle } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, Input, Modal, ProgressBar, Stack, StatCard, Text } from '../../../components/ui';
import { API_BASE_URL } from '../../../services/api';
function formatHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  const hora = parseInt(hh);
  const ampm = hora >= 12 ? 'PM' : 'AM';
  const h12 = hora % 12 || 12;
  return `${h12}:${mm} ${ampm}`;
}

function formatFecha(iso) {
  const [y, m, d] = iso.split('-');
  const fecha = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Ícono + texto secundario en una línea (horario, espacio…)
function Dato({ icon, children }) {
  return (
    <Stack direction="row" gap={4} align="center">
      {icon}
      <Text variant="small" muted as="span">{children}</Text>
    </Stack>
  );
}

// ── Modal QR ──────────────────────────────────────────────────────────────────
function ModalQR({ sesion, onClose, onRegistrado }) {
  const [resultado, setResultado] = useState(null);
  const [error, setError]         = useState(null);
  const [cargando, setCargando]   = useState(false);
  const scannerRef                = useRef(null);

  useEffect(() => {
    let scanner;
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner('qr-reader', {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      }, false);

      scanner.render(async (decodedText) => {
        if (cargando || resultado) return;
        scanner.clear();
        setCargando(true);
        setError(null);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}/sesiones/${sesion.sesion_id}/asistencia-qr`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_qr: decodedText, fecha: sesion.fecha })
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error || 'Error al registrar'); return; }
          setResultado(data);
          onRegistrado && onRegistrado();
        } catch { setError('Error de conexión'); }
        finally { setCargando(false); }
      }, () => { /* ignorar errores de escaneo continuos */ });

      scannerRef.current = scanner;
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Escanear QR"
      subtitle={`${sesion.disciplina} · ${formatHora(sesion.hora_inicio)}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {resultado ? 'Cerrar' : 'Cancelar'}
        </Button>
      }
    >
      {resultado ? (
        <Alert variant="success" title={resultado.nombre}>
          {resultado.inscrito_ahora
            ? 'Inscrito y asistencia registrada'
            : 'Asistencia registrada correctamente'}
        </Alert>
      ) : (
        <>
          {cargando ? (
            <Text muted>Registrando asistencia...</Text>
          ) : (
            <div id="qr-reader" style={{ width: '100%' }} />
          )}
          {error && <Alert variant="error">{error}</Alert>}
        </>
      )}
    </Modal>
  );
}

// ── Modal Agregar ─────────────────────────────────────────────────────────────
function ModalAgregarSocio({ sesion, fecha, onClose, onAgregado }) {
  const [tab, setTab]               = useState('socio');
  const [query, setQuery]           = useState('');
  const [resultados, setResultados] = useState([]);
  const [visitas, setVisitas]       = useState([]);
  const [buscando, setBuscando]     = useState(false);
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState(null);
  const timerRef                    = useRef(null);

  useEffect(() => {
    if (tab !== 'visita') return;
    const fetchVisitas = async () => {
      setBuscando(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/recepcion/visitas?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setVisitas(Array.isArray(data) ? data.filter(v => v.vigente) : []);
      } catch { setVisitas([]); }
      finally { setBuscando(false); }
    };
    fetchVisitas();
  }, [tab, fecha]);

  const buscar = async (termino) => {
    if (!termino || termino.length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/recepcion/socios?q=${encodeURIComponent(termino)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setResultados(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch { setResultados([]); }
    finally { setBuscando(false); }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(val), 300);
  };

  const handleAgregar = async (socio_id, visita_id = null) => {
    setError(null);
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      const body = visita_id
        ? { sesion_id: sesion.sesion_id, visita_id, fecha }
        : { sesion_id: sesion.sesion_id, socio_id, fecha };
      const res = await fetch(`${API_BASE_URL}/instructor/clases/inscribir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al registrar'); return; }
      onAgregado();
      onClose();
    } catch { setError('Error de conexión'); }
    finally { setCargando(false); }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Agregar al pase de lista"
      subtitle={`${sesion.disciplina} · ${formatHora(sesion.hora_inicio)}`}
      footer={<Button variant="secondary" onClick={onClose}>Cancelar</Button>}
    >
      {/* Tabs */}
      <Stack direction="row" gap={8} role="tablist">
        <Button
          role="tab"
          aria-selected={tab === 'socio'}
          variant={tab === 'socio' ? 'primary' : 'secondary'}
          onClick={() => { setTab('socio'); setError(null); }}
        >
          Socios
        </Button>
        <Button
          role="tab"
          aria-selected={tab === 'visita'}
          variant={tab === 'visita' ? 'primary' : 'secondary'}
          onClick={() => { setTab('visita'); setError(null); }}
        >
          Visitas del día
        </Button>
      </Stack>

      {/* Buscador socios */}
      {tab === 'socio' && (
        <Input
          type="text"
          label="Buscar socio"
          value={query}
          onChange={handleChange}
          autoFocus
          placeholder="Buscar socio por nombre o número..."
          helperText={buscando ? 'Buscando...' : undefined}
        />
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <Stack gap={12}>
        {tab === 'socio' && (
          <>
            {resultados.length === 0 && query.length >= 2 && !buscando && (
              <Text variant="small" muted>Sin resultados para "{query}"</Text>
            )}
            {resultados.length === 0 && query.length < 2 && (
              <Text variant="small" muted>Escribe al menos 2 caracteres para buscar</Text>
            )}
            {resultados.map(s => (
              <Stack key={s.socio_id} direction="row" gap={12} align="center" justify="between">
                <Stack direction="row" gap={12} align="center">
                  <Avatar name={s.nombre_completo} size="sm" />
                  <Stack gap={0}>
                    <Text variant="small">{s.nombre_completo}</Text>
                    <Text variant="caption" muted>{s.numero_socio}</Text>
                  </Stack>
                </Stack>
                <Button onClick={() => handleAgregar(s.socio_id)} disabled={cargando}>
                  {cargando ? '...' : '+ Agregar'}
                </Button>
              </Stack>
            ))}
          </>
        )}

        {tab === 'visita' && (
          <>
            {buscando && <Text variant="small" muted>Cargando visitas...</Text>}
            {!buscando && visitas.length === 0 && (
              <Stack gap={8} align="center">
                <Users size={28} />
                <Text variant="small" muted>No hay visitas activas hoy</Text>
              </Stack>
            )}
            {visitas.map(v => (
              <Stack key={v.visita_id || v.pase_id} direction="row" gap={12} align="center" justify="between">
                <Stack direction="row" gap={12} align="center">
                  <Avatar name={v.nombre_completo || v.nombre_visitante} size="sm" />
                  <Stack gap={4} align="start">
                    <Text variant="small">{v.nombre_completo || v.nombre_visitante}</Text>
                    <Badge variant="warning">Visita del día</Badge>
                  </Stack>
                </Stack>
                <Button onClick={() => handleAgregar(null, v.visita_id || v.pase_id)} disabled={cargando}>
                  {cargando ? '...' : '+ Agregar'}
                </Button>
              </Stack>
            ))}
          </>
        )}
      </Stack>
    </Modal>
  );
}

// ── Fila de alumno ────────────────────────────────────────────────────────────
function AlumnoRow({ alumno, fecha, sesionId, onEstadoChange }) {
  const { showConfirm } = useNotification();
  const [estado, setEstado]   = useState(alumno.asistio === true ? 'presente' : alumno.asistio === false ? 'ausente' : null);
  const [cargando, setCargando] = useState(false);

  const registrar = async (presente) => {
    if (cargando) return;
    const nuevoEstado = presente ? 'presente' : 'ausente';
    const estadoFinal = estado === nuevoEstado ? null : nuevoEstado;
    setCargando(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/instructor/asistencia`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesionId, socioId: alumno.socio_id, fecha, presente: estadoFinal === 'presente' })
      });
      setEstado(estadoFinal);
      onEstadoChange && onEstadoChange(alumno.socio_id, estadoFinal);
    } catch (err) { console.error(err); }
    finally { setCargando(false); }
  };

  const esVisita = alumno.tipo === 'Visita';

  return (
    <Stack direction="row" gap={12} align="center" justify="between" wrap>
      <Stack direction="row" gap={12} align="center">
        <Avatar name={alumno.nombre_socio} size="sm" />
        <Stack gap={4} align="start">
          <Text variant="small">{alumno.nombre_socio}</Text>
          {esVisita
            ? <Badge variant="warning">Visita</Badge>
            : <Text variant="caption" muted>Socio</Text>}
        </Stack>
      </Stack>

      <Stack direction="row" gap={8} align="center">
        {estado && (
          <Badge variant={estado === 'presente' ? 'success' : 'danger'}>
            {estado === 'presente' ? '✓ Presente' : '✗ No-Show'}
          </Badge>
        )}
        {/* Quitar */}
        <Button variant="secondary" onClick={async () => {
          if (!await showConfirm(`¿Quitar a ${alumno.nombre_socio} de esta clase?`)) return;
          try {
            const token = localStorage.getItem('token');
            if (alumno.inscripcion_id) {
              await fetch(`${API_BASE_URL}/inscripciones/cancelar`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sesionId, socioId: alumno.socio_id })
              });
            } else {
              await fetch(`${API_BASE_URL}/reservas/${alumno.reserva_id}/cancelar`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo: 'Cancelado por instructor' })
              });
            }
            onEstadoChange && onEstadoChange(alumno.socio_id, 'quitado');
          } catch (err) { console.error(err); }
        }} title="Quitar de la clase" aria-label={`Quitar a ${alumno.nombre_socio} de la clase`}>
          <UserMinus size={14} />
        </Button>
        {/* Presente */}
        <Button
          variant={estado === 'presente' ? 'primary' : 'secondary'}
          onClick={() => registrar(true)}
          disabled={cargando}
          aria-label="Marcar presente"
          aria-pressed={estado === 'presente'}
        >
          <Check size={14} strokeWidth={3} />
        </Button>
        {/* Ausente */}
        <Button
          variant={estado === 'ausente' ? 'error' : 'secondary'}
          onClick={() => registrar(false)}
          disabled={cargando}
          aria-label="Marcar no-show"
          aria-pressed={estado === 'ausente'}
        >
          <X size={14} strokeWidth={3} />
        </Button>
      </Stack>
    </Stack>
  );
}

// ── Card de clase ─────────────────────────────────────────────────────────────
function ClaseCard({ clase, fecha }) {
  const [expandida, setExpandida]       = useState(false);
  const [alumnos, setAlumnos]           = useState([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [yaCargo, setYaCargo]           = useState(false);
  const [estados, setEstados]           = useState({});
  const [showAgregar, setShowAgregar] = useState(false);
  const [showQR, setShowQR]           = useState(false);

  const cargarAlumnos = async (force = false) => {
    if (!force && yaCargo) return;
    setLoadingAlumnos(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/instructor/clases/${clase.sesion_id}/alumnos?fecha=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error');
      const data = await res.json();
      setAlumnos(data);
      const estadosIniciales = {};
      data.forEach(a => { estadosIniciales[a.socio_id] = a.asistio === true ? 'presente' : a.asistio === false ? 'ausente' : null; });
      setEstados(estadosIniciales);
      setYaCargo(true);
    } catch (err) { console.error(err); }
    finally { setLoadingAlumnos(false); }
  };

  const handleToggle = () => {
    const nuevo = !expandida;
    setExpandida(nuevo);
    if (nuevo) cargarAlumnos();
  };

  const presentes    = Object.values(estados).filter(e => e === 'presente').length;
  const ausentes     = Object.values(estados).filter(e => e === 'ausente').length;
  const sinRegistrar = Object.values(estados).filter(e => e === null).length;
  const cupoActual   = parseInt(clase.cupo_actual) || 0;
  const cupoMax      = parseInt(clase.cupo_maximo) || 1;
  const _hoy = new Date();
  const _hoyLocal = `${_hoy.getFullYear()}-${String(_hoy.getMonth()+1).padStart(2,'0')}-${String(_hoy.getDate()).padStart(2,'0')}`;
  const esHoy        = fecha === _hoyLocal;

  return (
    <Card
      title={clase.disciplina}
      icon={<Clock size={16} />}
      action={
        <Button variant="secondary" onClick={handleToggle} aria-expanded={expandida}>
          {expandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expandida ? 'Ocultar pase de lista' : 'Pase de lista'}
        </Button>
      }
    >
      <Stack gap={16}>
        <Stack direction="row" gap={16} wrap>
          <Dato icon={<Clock size={14} />}>{formatHora(clase.hora_inicio)} – {formatHora(clase.hora_fin)}</Dato>
          <Dato icon={<MapPin size={14} />}>{clase.espacio}</Dato>
        </Stack>
        <ProgressBar value={cupoActual} max={cupoMax} label="Cupo" />

        {/* Pase de lista */}
        {expandida && (
          <Stack gap={12}>

            {/* Barra de acciones */}
            <Stack direction="row" gap={8} align="center" justify="between" wrap>
              <Text variant="overline" muted>Pase de Lista Digital</Text>
              <Stack direction="row" gap={8} align="center" wrap>
                {alumnos.length > 0 && (
                  <>
                    <Badge variant="success">✓ {presentes}</Badge>
                    <Badge variant="danger">✗ {ausentes}</Badge>
                    {sinRegistrar > 0 && <Badge>— {sinRegistrar}</Badge>}
                  </>
                )}
                {esHoy && (
                  <>
                    <Button variant="secondary" onClick={() => setShowQR(true)}>
                      <QrCode size={14} /> QR
                    </Button>
                    <Button onClick={() => setShowAgregar(true)}>
                      <UserPlus size={14} /> Agregar
                    </Button>
                  </>
                )}
              </Stack>
            </Stack>

            {/* Lista */}
            {loadingAlumnos ? (
              <Text variant="small" muted>Cargando alumnos...</Text>
            ) : alumnos.length === 0 ? (
              <Stack gap={4} align="center" padding={24}>
                <ClipboardList size={22} />
                <Text variant="small">Sin alumnos inscritos</Text>
                <Text variant="caption" muted>
                  {esHoy ? 'Usa el botón Agregar para inscribir alumnos' : 'No hay registros para esta fecha'}
                </Text>
              </Stack>
            ) : (
              alumnos.map((alumno) => (
                <AlumnoRow
                  key={alumno.inscripcion_id ? `ic-${alumno.inscripcion_id}` : alumno.reserva_id || alumno.socio_id}
                  alumno={alumno}
                  fecha={fecha}
                  sesionId={clase.sesion_id}
                  onEstadoChange={(socioId, estado) => {
                    if (estado === 'quitado') {
                      setAlumnos(prev => prev.filter(a => a.socio_id !== socioId));
                      setEstados(prev => { const n = { ...prev }; delete n[socioId]; return n; });
                    } else {
                      setEstados(prev => ({ ...prev, [socioId]: estado }));
                    }
                  }}
                />
              ))
            )}

            {/* Footer resumen */}
            {alumnos.length > 0 && (
              <Stack direction="row" gap={12} wrap>
                <Text variant="caption">✓ {presentes} presentes</Text>
                <Text variant="caption">✗ {ausentes} no-shows</Text>
                {sinRegistrar > 0 && <Text variant="caption" muted>{sinRegistrar} sin registrar</Text>}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      {showQR && (
        <ModalQR
          sesion={{ ...clase, fecha }}
          onClose={() => setShowQR(false)}
          onRegistrado={() => { setYaCargo(false); cargarAlumnos(true); }}
        />
      )}

      {showAgregar && (
        <ModalAgregarSocio
          sesion={clase} fecha={fecha}
          onClose={() => setShowAgregar(false)}
          onAgregado={() => { setYaCargo(false); cargarAlumnos(true); }}
        />
      )}
    </Card>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
function AgendaDia() {
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const _hoyD = new Date();
  const esHoy = fecha === `${_hoyD.getFullYear()}-${String(_hoyD.getMonth()+1).padStart(2,'0')}-${String(_hoyD.getDate()).padStart(2,'0')}`;

  useEffect(() => {
    const fetchClases = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/instructor/clases?fecha=${fecha}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Error');
        const data = await res.json();
        setClases(data);
      } catch (err) { console.error('Error:', err); }
      finally { setLoading(false); }
    };
    fetchClases();
  }, [fecha]);

  const totalInscritos = clases.reduce((acc, c) => acc + (parseInt(c.cupo_actual) || 0), 0);

  return (
    <Stack gap={24}>
      {/* ── Encabezado ── */}
      <Stack direction="row" gap={16} align="end" justify="between" wrap>
        <Stack gap={4}>
          <Text variant="heading">Agenda del Día</Text>
          <Text variant="small" muted>{formatFecha(fecha)}</Text>
        </Stack>
        <Input type="date" label="Fecha" value={fecha} onChange={e => setFecha(e.target.value)} />
      </Stack>

      {!loading && (
        <Stack direction="row" gap={16} grow minChild={150}>
          <StatCard label="Clases" value={clases.length} icon={<Calendar size={20} />} />
          <StatCard label="Inscritos" value={totalInscritos} tone="success" icon={<Users size={20} />} />
        </Stack>
      )}

      {/* Contenido */}
      {loading ? (
        <Text muted>Cargando agenda...</Text>
      ) : clases.length === 0 ? (
        <Stack gap={4} align="center" padding={32}>
          <CalendarX size={26} />
          <Text variant="subheading">Sin clases para este día</Text>
          <Text variant="small" muted>Prueba seleccionando otra fecha</Text>
        </Stack>
      ) : (
        <Stack gap={16}>
          {esHoy && (
            <Stack direction="row" gap={8} wrap>
              <Badge>
                {clases.length} clase{clases.length !== 1 ? 's' : ''} programadas
              </Badge>
              <Badge variant="info">
                <CheckCircle size={12} /> {totalInscritos} alumnos inscritos
              </Badge>
            </Stack>
          )}
          {clases.map(clase => (
            <ClaseCard key={clase.sesion_id} clase={clase} fecha={fecha} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export default AgendaDia;
