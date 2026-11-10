import { useEffect, useState } from 'react';
import { apiRequest, unwrapList } from '../../services/api';

/**
 * Instructores activos para elegir árbitro: GET /instructores (público; lo pueden usar admin,
 * gerente y coordinador). Solo se pide si `activo` es true (quien edita). Si falla, la lista queda
 * vacía y el panel lo dice; el backend vuelve a validar el instructor al asignar.
 */
export function useInstructores(activo) {
  const [instructores, setInstructores] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activo) return undefined;
    const controller = new AbortController();
    async function cargar() {
      try {
        const data = await apiRequest('/instructores', { signal: controller.signal });
        const lista = unwrapList(data, ['data', 'instructores']);
        setInstructores(lista.filter((i) => i.activo !== false && i.activo !== 'false'));
        setError(false);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        setInstructores([]);
        setError(true);
      }
    }
    cargar();
    return () => controller.abort();
  }, [activo]);

  return { instructores, error };
}

export default useInstructores;
