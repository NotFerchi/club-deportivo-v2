import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SocioLayout from '../../../components/SocioLayout';
import { Alert, Badge, Button, Stack, Table, Text } from '../../../components/ui';
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
    setAviso(`¡Gracias! Tu evaluación de ${clase.disciplina} se registró.`);
    recargar();
  };

  const evaluacionDe = (clase) => evaluadas.find((e) => Number(e.sesion_id) === Number(clase.sesion_id));

  const columnas = [
    {
      key: 'clase',
      header: 'Clase',
      render: (c) => (
        <Stack gap={0}>
          <span>{c.disciplina}</span>
          <Text variant="caption" muted as="span">
            {nombreDia(c.dia_semana)} · {horaCorta(c.hora_inicio)} - {horaCorta(c.hora_fin)} · {c.espacio}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'instructor',
      header: 'Instructor',
      render: (c) => (sinInstructor(c) ? <Text variant="caption" muted as="span">Por asignar</Text> : c.instructor),
    },
    {
      key: 'estado',
      header: 'Este mes',
      render: (c) => {
        const hecha = evaluacionDe(c);
        if (hecha) return <Badge variant="success">Evaluada · {hecha.calificacion}/5</Badge>;
        if (sinInstructor(c)) return <Badge>Sin instructor</Badge>;
        return <Badge variant="warning">Pendiente</Badge>;
      },
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (c) => {
        if (evaluacionDe(c)) {
          return <Text variant="caption" muted as="span">Podrás evaluar de nuevo el próximo mes</Text>;
        }
        return (
          <Button variant="secondary" disabled={sinInstructor(c)} onClick={() => { setAviso(null); setEvaluando(c); }}>
            Evaluar
          </Button>
        );
      },
    },
  ];

  return (
    <SocioLayout activeTab="evaluar" title="Club Social | Evaluaciones">
      <Stack gap={24} padding={24}>
        <Stack gap={4}>
          <Text variant="title">Evaluar instructores</Text>
          <Text muted>Califica las clases en las que estás inscrito. Evaluaciones de {nombreMes(periodo)}.</Text>
        </Stack>

        <Alert variant="info">
          Tu evaluación es anónima: el instructor ve la calificación y el comentario, pero no quién la hizo.
          Puedes evaluar cada clase una vez al mes.
        </Alert>

        {aviso && <Alert variant="success">{aviso}</Alert>}

        {!socioId && (
          <Alert variant="warning">No encontramos tu registro de socio. Cierra sesión e inicia de nuevo.</Alert>
        )}

        {socioId && error && (
          <Stack gap={12} align="start">
            <Alert variant="error">{error}</Alert>
            <Button variant="secondary" onClick={recargar}>Reintentar</Button>
          </Stack>
        )}

        {socioId && cargando && !error && <Text role="status" muted>Cargando tus clases…</Text>}

        {socioId && !cargando && !error && (
          <Table
            columns={columnas}
            data={clases}
            getRowKey={(c) => c.sesion_id}
            minWidth={640}
            emptyTitle="Aún no tienes clases confirmadas"
            emptyMessage="Inscríbete a una clase para poder evaluar a su instructor."
            emptyAction={<Button variant="secondary" onClick={() => navigate('/clases')}>Ver clases</Button>}
          />
        )}
      </Stack>

      {/* key: cada clase abre el formulario limpio (sin calificación, comentario ni "Enviando…" de la anterior) */}
      <EvaluarClaseModal key={evaluando?.sesion_id ?? 'cerrado'} clase={evaluando} onConfirmar={confirmarEvaluacion} onClose={() => setEvaluando(null)} />
    </SocioLayout>
  );
}
