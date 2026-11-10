import { useEffect, useRef, useState } from 'react';
import { listarEvaluacionesDeInstructor, listarInstructores } from '../../services/evaluacionesResultadosApi';
import { mensajeDeError } from '../evaluaciones-ui/resultadosUtils';
import { periodoAnterior } from './evaluacionesVista';

export const CONCURRENCIA = 4;

/** Ejecuta `fn` sobre cada elemento con a lo más `limite` llamadas a la vez. */
async function enParalelo(items, limite, fn) {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const item = items[siguiente];
      siguiente += 1;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
}

/**
 * Datos de la vista de evaluaciones del coordinador (U4-20). Mismas llamadas que ResultadosInstructor
 * (services/evaluacionesResultadosApi):
 *   1 × GET /instructores
 *   + por cada instructor, GET /evaluaciones/instructor/:id?periodo del mes elegido y del anterior
 * Con N instructores son 1 + 2N la primera vez, con CONCURRENCIA llamadas a la vez. Cada lista queda
 * en caché por mes e instructor: al cambiar de mes solo se piden los meses que faltan, y Reintentar
 * solo repite las que fallaron.
 *
 * Devuelve { estado: 'cargando' | 'error' | 'listo', error, instructores, listasMes, listasPrevio,
 * reintentar }. listasMes / listasPrevio: Map(instructor_id → lista).
 */
export function useEvaluacionesCoordinador(periodo) {
  const cache = useRef(new Map()); // `${periodo}|${id}` → lista
  const [instructores, setInstructores] = useState(null);
  const [resultado, setResultado] = useState({ clave: null, estado: 'cargando', error: null });
  const [intento, setIntento] = useState(0);
  const previo = periodoAnterior(periodo);
  const clave = `${periodo}|${intento}`;

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        let lista = instructores;
        if (!lista) {
          lista = await listarInstructores();
          if (cancelado) return;
          setInstructores(lista);
        }
        const faltan = [];
        for (const p of [periodo, previo]) {
          for (const i of lista) {
            if (!cache.current.has(`${p}|${i.instructor_id}`)) faltan.push([p, i.instructor_id]);
          }
        }
        let primerError = null;
        await enParalelo(faltan, CONCURRENCIA, async ([p, id]) => {
          if (cancelado || primerError) return;
          try {
            cache.current.set(`${p}|${id}`, await listarEvaluacionesDeInstructor(id, p));
          } catch (err) {
            primerError = primerError || err;
          }
        });
        if (cancelado) return;
        if (primerError) {
          setResultado({ clave, estado: 'error', error: mensajeDeError(primerError) });
          return;
        }
        const listasDe = (p) => new Map(lista.map((i) => [String(i.instructor_id), cache.current.get(`${p}|${i.instructor_id}`) || []]));
        setResultado({ clave, estado: 'listo', error: null, listasMes: listasDe(periodo), listasPrevio: listasDe(previo) });
      } catch (err) {
        if (!cancelado) setResultado({ clave, estado: 'error', error: mensajeDeError(err) });
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
    // instructores solo se pide la primera vez (o al reintentar si falló)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const estado = resultado.clave === clave ? resultado.estado : 'cargando';
  const vacio = new Map();

  return {
    estado,
    error: estado === 'error' ? resultado.error : null,
    instructores: instructores || [],
    listasMes: estado === 'listo' ? resultado.listasMes : vacio,
    listasPrevio: estado === 'listo' ? resultado.listasPrevio : vacio,
    reintentar: () => setIntento((n) => n + 1)
  };
}

export default useEvaluacionesCoordinador;
