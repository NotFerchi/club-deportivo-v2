// Llamadas al backend de evaluaciones que usa la vista de resultados por instructor (E5.2).
// Contrato: docs/api-evaluaciones.md (§3.2 lista, §3.3 promedio). Los errores son los de apiRequest:
// `err.message` trae el texto del backend ({ error }) y `err.status` el código HTTP.
import { apiRequest, unwrapList } from './api';

const query = (periodo) => (periodo ? `?periodo=${encodeURIComponent(periodo)}` : '');

/** GET /api/instructores → [{ instructor_id, nombre, especialidad, activo, ... }] */
export async function listarInstructores() {
  return unwrapList(await apiRequest('/instructores'), ['data']);
}

/** GET /api/evaluaciones/instructor/:id/promedio (§3.3): { instructor_id, total, promedio, distribucion }. */
export function obtenerPromedio(instructorId, periodo) {
  return apiRequest(`/evaluaciones/instructor/${encodeURIComponent(instructorId)}/promedio${query(periodo)}`);
}

/** GET /api/evaluaciones/instructor/:id (§3.2): lista anónima, de la más reciente a la más antigua. */
export async function listarEvaluacionesDeInstructor(instructorId, periodo) {
  return unwrapList(
    await apiRequest(`/evaluaciones/instructor/${encodeURIComponent(instructorId)}${query(periodo)}`),
    ['data'],
  );
}
