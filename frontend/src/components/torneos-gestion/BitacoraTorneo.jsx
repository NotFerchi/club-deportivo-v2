import React, { useEffect, useState } from 'react';
import { Ban, History, PencilLine, PlusCircle, Trash2 } from 'lucide-react';
import { Card, EmptyState, ErrorState, LoadingState, Timeline } from '../ui';
import { apiRequest, unwrapList } from '../../services/api';
import { mensajeDeError } from '../torneos/torneoUtils';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const ACCIONES = {
  crear_torneo: { title: 'Creó el torneo', icon: <PlusCircle size={16} />, tone: 'info' },
  actualizar_torneo: { title: 'Editó el torneo', icon: <PencilLine size={16} />, tone: 'info' },
  cancelar_torneo: { title: 'Canceló el torneo', icon: <Ban size={16} />, tone: 'danger' },
  eliminar_torneo: { title: 'Eliminó el torneo', icon: <Trash2 size={16} />, tone: 'danger' }
};

const CAMPOS = {
  nombre: 'Nombre',
  disciplina_id: 'Disciplina',
  fecha_inicio: 'Inicio',
  fecha_fin: 'Término',
  categoria_id: 'Categoría',
  tipo_torneo: 'Modalidad',
  cupo_maximo: 'Cupo',
  fecha_inicio_inscripcion: 'Apertura de inscripciones',
  fecha_fin_inscripcion: 'Cierre de inscripciones'
};

/** "2026-11-10T14:20:00" (hora del club, como la manda la API) → "10 Nov 2026 · 14:20". */
function cuando(fechaLocal) {
  const m = String(fechaLocal || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return fechaLocal || '';
  return `${m[3]} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]} · ${m[4]}:${m[5]}`;
}

/** Detalle del log: el de una edición es JSON { campo: { antes, despues } }; el resto, texto. */
function detallesDe(detalles, nombres) {
  if (!detalles) return [];
  let datos;
  try {
    datos = JSON.parse(detalles);
  } catch {
    return [String(detalles)];
  }
  if (!datos || typeof datos !== 'object') return [String(detalles)];
  const valor = (campo, v) => {
    if (v === null || v === undefined || v === '') return 'sin valor';
    const fecha = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (fecha) return `${fecha[3]} ${MESES_CORTOS[Number(fecha[2]) - 1]} ${fecha[1]}`;
    return nombres[campo]?.get(String(v)) || String(v);
  };
  return Object.entries(datos).map(([campo, c]) =>
    c && typeof c === 'object' && 'antes' in c
      ? `${CAMPOS[campo] || campo}: ${valor(campo, c.antes)} → ${valor(campo, c.despues)}`
      : `${CAMPOS[campo] || campo}: ${valor(campo, c)}`
  );
}

/**
 * Pestaña "Bitácora" (U4-03, Paso 2): GET /torneos/:id/bitacora (solo admin, gerente y
 * coordinador; al instructor no se le muestra la pestaña). Línea de tiempo con quién, qué y cuándo.
 * El backend registra crear, editar, cancelar y eliminar el torneo.
 */
function BitacoraTorneo({ torneo, disciplinas, categorias }) {
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const torneoId = torneo.torneo_id;
  // la versión del torneo cambia al editarlo: se vuelve a pedir la bitácora
  const version = `${torneo.nombre}|${torneo.estado}|${torneo.fecha_inicio}|${torneo.fecha_fin}|${torneo.cupo_maximo}|${torneo.categoria_id}`;

  useEffect(() => {
    const controller = new AbortController();
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const data = await apiRequest(`/torneos/${torneoId}/bitacora`, { signal: controller.signal });
        setRegistros(unwrapList(data, ['data', 'logs']));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setRegistros([]);
        setError(mensajeDeError(err, 'No se pudo cargar la bitácora.'));
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    cargar();
    return () => controller.abort();
  }, [torneoId, version, intento]);

  const nombres = {
    disciplina_id: new Map(disciplinas.map((d) => [String(d.disciplina_id), d.nombre])),
    categoria_id: new Map(categorias.map((c) => [String(c.categoria_id), c.nombre]))
  };

  const items = registros.map((r) => {
    const accion = ACCIONES[r.accion] || {
      title: String(r.accion || 'Acción').replace(/_/g, ' ').replace(/^./, (l) => l.toUpperCase()),
      icon: <History size={16} />,
      tone: 'neutral'
    };
    return {
      id: r.log_id,
      title: accion.title,
      icon: accion.icon,
      tone: accion.tone,
      who: r.usuario_nombre ? `por ${r.usuario_nombre}` : 'por el sistema',
      when: cuando(r.fecha_local),
      details: detallesDe(r.detalles, nombres)
    };
  });

  return (
    <Card title="Bitácora" icon={<History size={18} />}>
      {cargando && <LoadingState rows={3} label="Cargando bitácora…" />}
      {!cargando && error && <ErrorState message={error} onRetry={() => setIntento((n) => n + 1)} />}
      {!cargando && !error && items.length === 0 && (
        <EmptyState icon={<History size={24} />} title="Sin movimientos" message="Aún no hay cambios registrados en este torneo." />
      )}
      {!cargando && !error && items.length > 0 && <Timeline items={items} ariaLabel={`Bitácora de ${torneo.nombre || 'torneo'}`} />}
    </Card>
  );
}

export default BitacoraTorneo;
