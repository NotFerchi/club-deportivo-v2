const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const getAuthToken = () => localStorage.getItem('token');

export const unwrapList = (payload, keys = ['data']) => {
  if (Array.isArray(payload)) return payload;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  return [];
};

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error || data?.message || `Error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const adminApi = {
  getSocios: async () => unwrapList(await apiRequest('/socios'), ['data', 'socios']),
  getUsuarios: async () => unwrapList(await apiRequest('/usuarios'), ['data', 'usuarios']),
  getRoles: async () => unwrapList(await apiRequest('/roles'), ['data', 'roles']),
  getReservas: async () => unwrapList(await apiRequest('/reservas'), ['data', 'reservas']),
  getEspacios: async () => unwrapList(await apiRequest('/espacios/todos'), ['data', 'espacios']),
  getDisciplinas: async () => unwrapList(await apiRequest('/disciplinas'), ['data', 'disciplinas']),
  getSesiones: async () => unwrapList(await apiRequest('/sesiones'), ['data', 'sesiones']),
  getSanciones: async () => unwrapList(await apiRequest('/sanciones'), ['data', 'sanciones']),
  getVisitasActivas: async () => unwrapList(await apiRequest('/recepcion/visitas/activas'), ['data']),
  getHistorialVisitas: async (dias = 7) =>
    unwrapList(await apiRequest(`/recepcion/visitas/historial?dias=${dias}`), ['data']),
  getSociosVisitas: async () => unwrapList(await apiRequest('/recepcion/socios-lista'), ['data', 'socios']),
  getLudotecaActivos: async () => unwrapList(await apiRequest('/ludoteca/activos'), ['data']),

  saveSocio: (payload, socioId) =>
    apiRequest(socioId ? `/socios/${socioId}` : '/socios', {
      method: socioId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveUsuario: (payload, usuarioId) =>
    apiRequest(usuarioId ? `/usuarios/${usuarioId}` : '/usuarios', {
      method: usuarioId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveReserva: (payload, reservaId) =>
    apiRequest(reservaId ? `/reservas/${reservaId}` : '/reservas', {
      method: reservaId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveDisciplina: (payload, disciplinaId) =>
    apiRequest(disciplinaId ? `/disciplinas/${disciplinaId}` : '/disciplinas', {
      method: disciplinaId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveEspacio: (payload, espacioId) =>
    apiRequest(espacioId ? `/espacios/${espacioId}` : '/espacios', {
      method: espacioId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveSancion: (payload, sancionId) =>
    apiRequest(sancionId ? `/sanciones/${sancionId}` : '/sanciones', {
      method: sancionId ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  registrarVisita: (payload) =>
    apiRequest('/recepcion/visitas', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  registrarSalidaVisita: (visitaId) =>
    apiRequest(`/recepcion/visitas/${visitaId}/salida`, { method: 'PUT' }),
  cerrarVisitasVencidas: () =>
    apiRequest('/recepcion/visitas/cerrar-vencidas', { method: 'POST' }),
  cancelarReserva: (reservaId) =>
    apiRequest(`/reservas/${reservaId}/cancelar`, { method: 'PUT' }),
  deleteReserva: (reservaId) =>
    apiRequest(`/reservas/${reservaId}`, { method: 'DELETE' }),
  levantarSancion: (sancionId) =>
    apiRequest(`/sanciones/${sancionId}/levantar`, { method: 'PUT' }),
  deleteSancion: (sancionId) =>
    apiRequest(`/sanciones/${sancionId}`, { method: 'DELETE' }),
  sincronizarNoShows: () =>
    apiRequest('/sanciones/no-shows/sincronizar', { method: 'POST' }),
  logAudit: (payload) =>
    apiRequest('/logs', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
};
