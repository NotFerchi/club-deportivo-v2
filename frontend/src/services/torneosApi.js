// Llamadas al backend del módulo de torneos que usa la interfaz del socio (E3.3).
// Contrato: docs/api-torneos.md. Los errores son los de apiRequest: `err.message` trae el
// texto que manda el backend (data.error) y `err.status` el código HTTP, para mostrarlos tal cual.
import { apiRequest, unwrapList } from './api';

/** GET /api/torneos (§3.2). Filtros opcionales: disciplina_id, estado. */
export function listarTorneos({ disciplina_id, estado } = {}) {
  const params = new URLSearchParams();
  if (disciplina_id) params.set('disciplina_id', disciplina_id);
  if (estado) params.set('estado', estado);
  const query = params.toString();
  return apiRequest(`/torneos${query ? `?${query}` : ''}`);
}

/** GET /api/disciplinas → [{ disciplina_id, nombre, ... }] */
export async function listarDisciplinas() {
  return unwrapList(await apiRequest('/disciplinas'), ['data', 'disciplinas']);
}

/** GET /api/torneos/mis-participaciones → participaciones del socio del token. */
export function listarMisParticipaciones() {
  return apiRequest('/torneos/mis-participaciones');
}

/** POST /api/torneos/:id/inscribir-me (§3.6). El socio sale del token; no lleva body. */
export function inscribirme(torneoId) {
  return apiRequest(`/torneos/${torneoId}/inscribir-me`, { method: 'POST' });
}

/** GET /api/torneos/:id/reporte (§5.1) → { torneo, encuentros }. */
export function obtenerReporte(torneoId) {
  return apiRequest(`/torneos/${torneoId}/reporte`);
}
