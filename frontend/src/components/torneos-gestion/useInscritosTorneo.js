import { useCallback, useEffect, useState } from 'react';
import { apiRequest, unwrapList } from '../../services/api';
import { mensajeDeError } from '../torneos/torneoUtils';

/**
 * Inscritos del torneo seleccionado para el panel derecho: GET /torneos/:id/participantes (el mismo
 * endpoint del modal de inscritos). La API no da fecha de inscripción, así que "los últimos" son los
 * de participante_id más alto (orden de alta) y no se muestra fecha.
 * `version` cambia cuando el torneo se actualiza (alta/baja de inscritos) para volver a pedirlos.
 */
export function useInscritosTorneo(torneoId, version) {
  const [inscritos, setInscritos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!torneoId) return undefined;
    const controller = new AbortController();
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const data = await apiRequest(`/torneos/${torneoId}/participantes`, { signal: controller.signal });
        setInscritos(unwrapList(data, ['participantes', 'data']));
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setInscritos([]);
        setError(mensajeDeError(err, 'No se pudieron cargar los inscritos.'));
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    cargar();
    return () => controller.abort();
  }, [torneoId, version, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  const ultimos = [...inscritos].sort((a, b) => Number(b.participante_id) - Number(a.participante_id)).slice(0, 4);

  return { inscritos, ultimos, cargando, error, reintentar };
}

export default useInscritosTorneo;
