// Llamadas al backend de evaluaciones de instructores que usa la interfaz del socio (E5.1).
// Contrato: docs/api-evaluaciones.md. Los errores son los de apiRequest: `err.message` trae el
// texto que manda el backend ({ error }) y `err.status` el código HTTP, para mostrarlos tal cual.
import { apiRequest, unwrapList } from './api';

/** GET /api/inscripciones/mis-inscripciones → clases con inscripción Confirmada del socio. */
export async function listarMisClases(socioId) {
  return unwrapList(await apiRequest(`/inscripciones/mis-inscripciones?socioId=${encodeURIComponent(socioId)}`), ['data']);
}

/** GET /api/evaluaciones/mias?periodo=YYYY-MM (§3.4): lo que el socio ya calificó ese mes. */
export async function listarMisEvaluaciones(periodo) {
  const query = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
  return unwrapList(await apiRequest(`/evaluaciones/mias${query}`), ['data']);
}

/**
 * POST /api/evaluaciones (§3.1). El socio sale del token: el body solo lleva la clase, la
 * calificación (entero de 1 a 5) y el comentario opcional (null si va vacío).
 */
export function crearEvaluacion({ sesion_id, calificacion, comentario }) {
  return apiRequest('/evaluaciones', {
    method: 'POST',
    body: JSON.stringify({ sesion_id, calificacion, comentario: comentario || null }),
  });
}
