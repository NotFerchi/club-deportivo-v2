export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const getAuthToken = () => {
  const direct = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('accessToken');
  if (direct) return direct;
  try {
    const u = JSON.parse(localStorage.getItem('usuario') || '{}');
    return u.token || u.accessToken || '';
  } catch {
    return '';
  }
};

export const unwrapList = (payload, keys = ['data']) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

function handleUnauthorized() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/login';
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (response.status === 401) {
    handleUnauthorized();
    const error = new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function downloadApiFile(path, { filename, ...options } = {}) {
  const token = getAuthToken();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    handleUnauthorized();
    const error = new Error('Sesion expirada. Por favor inicia sesion nuevamente.');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    const message = data?.error || data?.message || `Error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || 'archivo.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
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
  getSancionesPage: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, v);
    });
    const q = search.toString();
    return apiRequest(`/sanciones${q ? `?${q}` : ''}`);
  },
  getVisitasActivas: async () => unwrapList(await apiRequest('/recepcion/visitas/activas'), ['data']),
  getHistorialVisitas: async (dias = 7) =>
    unwrapList(await apiRequest(`/recepcion/visitas/historial?dias=${dias}`), ['data']),
  getSociosVisitas: async () => unwrapList(await apiRequest('/recepcion/socios-lista'), ['data', 'socios']),
  getRecepcionDashboard: () => apiRequest('/recepcion/dashboard'),
  getLudotecaActivos: async () => unwrapList(await apiRequest('/ludoteca/activos'), ['data']),
  descargarReporte: (path, filename) =>
    downloadApiFile(path, { filename }),
  exportarSocios: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, v);
    });
    const q = search.toString();
    const _fd = new Date();
    const fecha = `${_fd.getFullYear()}-${String(_fd.getMonth() + 1).padStart(2, '0')}-${String(_fd.getDate()).padStart(2, '0')}`;
    return downloadApiFile(`/reportes/socios/exportar${q ? `?${q}` : ''}`, {
      filename: `socios_${fecha}.xlsx`
    });
  },
  descargarTemplateSocios: () =>
    downloadApiFile('/importacion/template?tipo=socios', { filename: 'template_socios.xlsx' }),
  importarSocios: (file) => {
    const body = new FormData();
    body.append('archivo', file);
    return apiRequest('/importacion/socios', { method: 'POST', body });
  },

  saveSocio: (payload, id) =>
    apiRequest(id ? `/socios/${id}` : '/socios', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveUsuario: (payload, id) =>
    apiRequest(id ? `/usuarios/${id}` : '/usuarios', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveReserva: (payload, id) =>
    apiRequest(id ? `/reservas/${id}` : '/reservas', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveDisciplina: (payload, id) =>
    apiRequest(id ? `/disciplinas/${id}` : '/disciplinas', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  saveEspacio: (payload, id) =>
    apiRequest(id ? `/espacios/${id}` : '/espacios', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  toggleEspacioEstado: (id, estado, motivo, fecha_fin) =>
    apiRequest(`/espacios/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, motivo, fecha_fin })
    }),
  getMantenimientoHistorial: (id) =>
    apiRequest(`/espacios/${id}/mantenimiento`),
  saveSancion: (payload, id) =>
    apiRequest(id ? `/sanciones/${id}` : '/sanciones', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),

  registrarVisita: (payload) =>
    apiRequest('/recepcion/visitas', { method: 'POST', body: JSON.stringify(payload) }),
  registrarSalidaVisita: (id) =>
    apiRequest(`/recepcion/visitas/${id}/salida`, { method: 'PUT' }),
  actualizarVisita: (id, payload) =>
    apiRequest(`/recepcion/visitas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  obtenerQrVisita: (id) =>
    apiRequest(`/recepcion/visitas/${id}/qr`),
  cerrarVisitasVencidas: () =>
    apiRequest('/recepcion/visitas/cerrar-vencidas', { method: 'POST' }),
  cancelarReserva: (id) =>
    apiRequest(`/reservas/${id}/cancelar`, { method: 'PUT' }),
  deleteReserva: (id) =>
    apiRequest(`/reservas/${id}`, { method: 'DELETE' }),
  levantarSancion: (id) =>
    apiRequest(`/sanciones/${id}/levantar`, { method: 'PUT' }),
  resolverSancion: (id) =>
    apiRequest(`/sanciones/${id}`, { method: 'PATCH' }),
  deleteSancion: (id) =>
    apiRequest(`/sanciones/${id}`, { method: 'DELETE' }),
  sincronizarNoShows: () =>
    apiRequest('/sanciones/no-shows/sincronizar', { method: 'POST' }),
  logAudit: (payload) =>
    apiRequest('/logs', { method: 'POST', body: JSON.stringify(payload) }),

  getTorneos: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) search.set(k, v); });
    const q = search.toString();
    return apiRequest(`/torneos${q ? `?${q}` : ''}`);
  },
  saveTorneo: (payload, id) =>
    apiRequest(id ? `/torneos/${id}` : '/torneos', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    }),
  getCategoriasTorneo: () => apiRequest('/torneos/categorias'),
  getTorneoParticipantes: (torneoId) =>
    apiRequest(`/torneos/${torneoId}/participantes`),
  inscribirParticipante: (torneoId, payload) =>
    apiRequest(`/torneos/${torneoId}/inscribir`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  desinscribirParticipante: (torneoId, participanteId) =>
    apiRequest(`/torneos/${torneoId}/participantes/${participanteId}`, { method: 'DELETE' }),
  cerrarInscripcionesTorneo: (torneoId) =>
    apiRequest(`/torneos/${torneoId}/cerrar-inscripciones`, { method: 'PATCH' }),
  finalizarTorneo: (torneoId) =>
    apiRequest(`/torneos/${torneoId}/finalizar`, { method: 'PATCH' }),
  cancelarTorneo: (torneoId) =>
    apiRequest(`/torneos/${torneoId}/cancelar`, { method: 'PATCH' }),
  getTorneoReporte: (torneoId) =>
    apiRequest(`/torneos/${torneoId}/reporte`),
  confirmarBracketTorneo: (torneoId) =>
    apiRequest(`/torneos/${torneoId}/confirmar-bracket`, { method: 'PATCH' }),
  registrarResultadoEncuentro: (encuentroId, payload) =>
    apiRequest(`/encuentros/${encuentroId}/resultado`, { method: 'PATCH', body: JSON.stringify(payload) }),
  enviarQrVisita: (visitaId, payload) =>
    apiRequest(`/recepcion/visitas/${visitaId}/enviar-qr`, { method: 'POST', body: JSON.stringify(payload) })
};

