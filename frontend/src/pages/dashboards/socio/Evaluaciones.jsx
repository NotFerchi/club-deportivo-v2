import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SocioLayout from '../../../components/SocioLayout';
import { Alert, Avatar, AvatarRow, Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Stack } from '../../../components/ui';
import EvaluarClaseModal from '../../../components/evaluaciones-ui/EvaluarClaseModal';
import {
  horaCorta,
  nombreDia,
  nombreMes,
  periodoActual,
  sinInstructor,
} from '../../../components/evaluaciones-ui/evaluacionUtils';
import { crearEvaluacion, listarMisClases, listarMisEvaluaciones } from '../../../services/evaluacionesApi';

/**
 * Evaluaciones (socio) - ruta /evaluaciones. Lista las clases en las que el socio tiene inscripción
 * confirmada y le deja calificar al instructor (1 a 5 + comentario opcional). Una evaluación por clase
 * y por mes: las ya evaluadas este mes salen marcadas. Contrato: docs/api-evaluaciones.md.
 */
export default function Evaluaciones() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const socioId = usuario?.socio_id; // siempre socio_id, nunca usuario_id
  const periodo = periodoActual();

  const [clases, setClases] = useState([]);
  const [evaluadas, setEvaluadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [evaluando, setEvaluando] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Cada cambio de `version` (Reintentar, tras evaluar) vuelve a pedir las clases y lo ya calificado este mes.
  useEffect(() => {
    if (!socioId) return undefined;
    let cancelado = false;
    Promise.all([listarMisClases(socioId), listarMisEvaluaciones(periodo)])
      .then(([listaClases, listaEvaluadas]) => {
        if (cancelado) return;
        setClases(listaClases);
        setEvaluadas(listaEvaluadas);
        setError(null);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => { cancelado = true; };
  }, [socioId, periodo, version]);

  const recargar = () => {
    setCargando(true);
    setVersion((v) => v + 1);
  };

  // Si el backend rechaza, EvaluarClaseModal muestra el mensaje y sigue abierto. Con un 409 ("Ya evaluaste
  // esta clase este mes") la lista se refresca para que la clase salga marcada como evaluada.
  const confirmarEvaluacion = async (datos) => {
    try {
      await crearEvaluacion(datos);
    } catch (err) {
      if (err.status === 409) recargar();
      throw err;
    }
    const clase = evaluando;
    setEvaluando(null);
    setAviso(`Tu evaluación de ${clase.disciplina} se registró. Tu opinión ayuda a mantener la excelencia y mejorar las clases del club.`);
    recargar();
  };

  const evaluacionDe = (clase) => evaluadas.find((e) => Number(e.sesion_id) === Number(clase.sesion_id));

  // Lo que va a la derecha de cada clase: ya evaluada este mes, sin instructor (no se puede) o el botón.
  const accionDe = (c) => {
    if (evaluacionDe(c)) return <Badge variant="success">Ya evaluada este mes</Badge>;
    if (sinInstructor(c)) return <Button variant="secondary" disabled>Por asignar</Button>;
    return <Button onClick={() => { setAviso(null); setEvaluando(c); }}>Evaluar</Button>;
  };

  return (
    <SocioLayout activeTab="evaluar" title="Club Social | Evaluaciones">
      <Stack gap={24}>
        <PageHeader
          title="Evaluar instructores"
          overline="Tu opinión cuenta"
          subtitle={`Califica las clases en las que estás inscrito. Evaluaciones de ${nombreMes(periodo)}.`}
        />

        <Alert variant="info">
          Tu evaluación es anónima: el instructor ve la calificación, pero no quién la hizo.
          Puedes evaluar cada clase una vez al mes.
        </Alert>

        {aviso && <Alert variant="success" title="¡Gracias por tu evaluación!">{aviso}</Alert>}

        {!socioId && (
          <Alert variant="warning">No encontramos tu registro de socio. Cierra sesión e inicia de nuevo.</Alert>
        )}

        {socioId && error && <ErrorState message={error} onRetry={recargar} />}

        {socioId && cargando && !error && <LoadingState rows={3} label="Cargando tus clases…" />}

        {socioId && !cargando && !error && clases.length === 0 && (
          <EmptyState
            title="Aún no tienes clases confirmadas"
            message="Inscríbete a una clase para poder evaluar a su instructor."
            action={<Button variant="secondary" onClick={() => navigate('/clases')}>Ver clases</Button>}
          />
        )}

        {socioId && !cargando && !error && clases.length > 0 && (
          <Stack gap={12}>
            {clases.map((c) => (
              <AvatarRow
                key={c.sesion_id}
                avatar={<Avatar name={sinInstructor(c) ? '' : c.instructor} src={c.instructor_foto} size="lg" />}
                title={c.disciplina}
                subtitle={sinInstructor(c) ? 'Por asignar' : c.instructor}
                meta={`${nombreDia(c.dia_semana)} · ${horaCorta(c.hora_inicio)} - ${horaCorta(c.hora_fin)} · ${c.espacio}`}
                action={accionDe(c)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {/* key: cada clase abre el formulario limpio (sin calificación, comentario ni "Enviando…" de la anterior) */}
      <EvaluarClaseModal key={evaluando?.sesion_id ?? 'cerrado'} clase={evaluando} onConfirmar={confirmarEvaluacion} onClose={() => setEvaluando(null)} />
    </SocioLayout>
  );
}
