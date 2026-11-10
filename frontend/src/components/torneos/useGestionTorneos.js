import { useEffect, useMemo, useState } from 'react';
import { apiRequest, unwrapList } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { buildTorneosPath, mensajeDeError } from './torneoUtils';

const FORM_VACIO = {
  nombre: '',
  disciplina_id: '',
  fecha_inicio: '',
  fecha_fin: '',
  categoria_id: '',
  tipo_torneo: 'Individual',
  // Periodo de inscripción y cupo (E2.4 / E2.12): opcionales; sin fechas, sin límite
  fecha_inicio_inscripcion: '',
  fecha_fin_inscripcion: '',
  limite_cupo: 'sin',
  cupo_maximo: ''
};

// Mismos límites que el backend (torneoComun: CUPO_MINIMO / CUPO_MAXIMO)
const CUPO_MINIMO = 4;
const CUPO_MAXIMO = 256;
const soloFecha = (v) => (v ? String(v).split('T')[0] : '');

/**
 * Estado, cargas y handlers del gestor de torneos. Salió de TournamentBracket tal cual (U4-03) para
 * que lo usen TournamentBracket (socio en solo lectura y detalle) y la lista nueva del personal
 * (components/torneos-gestion) sin duplicar lógica. Mismas llamadas, validaciones y mensajes.
 */
export function useGestionTorneos({ initialDisciplinaId = '', initialEstado = '', readOnly = false } = {}) {
  const { toast, showConfirm } = useNotification();
  const [filters, setFilters] = useState({ disciplina_id: initialDisciplinaId, estado: initialEstado });
  const [appliedFilters, setAppliedFilters] = useState({ disciplina_id: initialDisciplinaId, estado: initialEstado });
  const [torneos, setTorneos] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState(null);
  const [bracket, setBracket] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [loadingTorneos, setLoadingTorneos] = useState(false);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [torneosError, setTorneosError] = useState('');
  const [bracketError, setBracketError] = useState('');
  const [showTorneoModal, setShowTorneoModal] = useState(false);
  const [editingTorneo, setEditingTorneo] = useState(null);
  const [formTorneo, setFormTorneo] = useState(FORM_VACIO);
  const [socios, setSocios] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [showInscribirModal, setShowInscribirModal] = useState(false);
  const [torneoFormErrors, setTorneoFormErrors] = useState({});
  const [savingTorneo, setSavingTorneo] = useState(false);
  const [showParticipantes, setShowParticipantes] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);
  const [participantesError, setParticipantesError] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [desinscribiendoId, setDesinscribiendoId] = useState(null);
  const [torneoParticipantesActual, setTorneoParticipantesActual] = useState(null);
  const [selectedEncuentroId, setSelectedEncuentroId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDisciplinas() {
      try {
        const payload = await apiRequest('/disciplinas', { signal: controller.signal });
        setDisciplinas(unwrapList(payload, ['data', 'disciplinas']));
      } catch (error) {
        if (error?.name !== 'AbortError') setDisciplinas([]);
      }
    }
    loadDisciplinas();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    async function loadCategorias() {
      try {
        const payload = await apiRequest('/torneos/categorias');
        setCategorias(Array.isArray(payload) ? payload : []);
      } catch {
        setCategorias([]);
      }
    }
    loadCategorias();
  }, []);

  useEffect(() => {
    if (readOnly) return;
    async function loadSocios() {
      try {
        const payload = await apiRequest('/socios');
        const list = unwrapList(payload, ['data', 'socios']);
        setSocios(list.filter((s) => s.activo !== false && s.activo !== 'false'));
      } catch {
        setSocios([]);
      }
    }
    loadSocios();
  }, [readOnly]);

  useEffect(() => {
    async function loadEspacios() {
      try {
        const payload = await apiRequest('/espacios/todos');
        const list = unwrapList(payload, ['data', 'espacios']);
        setEspacios(list.filter((e) => e.estado === 'Activo'));
      } catch {
        setEspacios([]);
      }
    }
    loadEspacios();
  }, []);

  const cargarTorneos = async (signal) => {
    setLoadingTorneos(true);
    setTorneosError('');
    try {
      const payload = await apiRequest(buildTorneosPath(appliedFilters), { signal });
      const nextTorneos = unwrapList(payload, ['data', 'torneos']);
      setTorneos(nextTorneos);
      setSelectedTorneo((current) => {
        if (!current) return null;
        return nextTorneos.find((t) => String(t.torneo_id) === String(current.torneo_id)) || null;
      });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setTorneos([]);
      setSelectedTorneo(null);
      setTorneosError(mensajeDeError(error, 'No se pudieron cargar los datos.'));
    } finally {
      setLoadingTorneos(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    cargarTorneos(controller.signal);
    return () => controller.abort();
  }, [appliedFilters]);

  useEffect(() => {
    if (!selectedTorneo?.torneo_id) {
      setBracket([]);
      setBracketError('');
      return;
    }
    const controller = new AbortController();
    async function loadBracket() {
      setLoadingBracket(true);
      setBracketError('');
      try {
        const payload = await apiRequest(`/torneos/${selectedTorneo.torneo_id}/bracket`, { signal: controller.signal });
        setBracket(unwrapList(payload, ['data', 'bracket']));
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setBracket([]);
        setBracketError(mensajeDeError(error, 'No se pudieron cargar los datos.'));
      } finally {
        setLoadingBracket(false);
      }
    }
    loadBracket();
    return () => controller.abort();
  }, [selectedTorneo]);

  const openCreateModal = () => {
    setEditingTorneo(null);
    setFormTorneo(FORM_VACIO);
    setTorneoFormErrors({});
    setShowTorneoModal(true);
  };

  const openEditModal = (torneo) => {
    setEditingTorneo(torneo);
    setFormTorneo({
      nombre: torneo.nombre || '',
      disciplina_id: String(torneo.disciplina_id || ''),
      fecha_inicio: torneo.fecha_inicio ? String(torneo.fecha_inicio).split('T')[0] : '',
      fecha_fin: torneo.fecha_fin ? String(torneo.fecha_fin).split('T')[0] : '',
      categoria_id: torneo.categoria_id ? String(torneo.categoria_id) : '',
      tipo_torneo: torneo.tipo_torneo || 'Individual',
      fecha_inicio_inscripcion: soloFecha(torneo.fecha_inicio_inscripcion),
      fecha_fin_inscripcion: soloFecha(torneo.fecha_fin_inscripcion),
      limite_cupo: Number(torneo.cupo_maximo) > 0 ? 'con' : 'sin',
      cupo_maximo: Number(torneo.cupo_maximo) > 0 ? String(torneo.cupo_maximo) : ''
    });
    setTorneoFormErrors({});
    setShowTorneoModal(true);
  };

  // La categoría es obligatoria mientras se puede inscribir gente: torneo nuevo o Abierto (B-10)
  const categoriaRequerida = !editingTorneo || editingTorneo.estado === 'Abierto';
  // Con las inscripciones cerradas el backend solo deja cambiar nombre y fechas (PR #9)
  const estructuraBloqueada = Boolean(editingTorneo) && editingTorneo.estado !== 'Abierto';

  const validateTorneoForm = () => {
    const errors = {};
    if (!formTorneo.nombre.trim()) errors.nombre = 'El nombre es requerido';
    if (!formTorneo.disciplina_id) errors.disciplina_id = 'La disciplina es requerida';
    if (categoriaRequerida && !formTorneo.categoria_id) errors.categoria_id = 'La categoría es requerida';
    if (formTorneo.fecha_inicio && formTorneo.fecha_fin && formTorneo.fecha_fin < formTorneo.fecha_inicio) {
      errors.fecha_fin = 'La fecha fin no puede ser anterior a la fecha inicio';
    }
    // Solo formato: el orden de las fechas y si el cupo se puede cambiar lo decide el backend
    const apertura = formTorneo.fecha_inicio_inscripcion || '';
    const cierre = formTorneo.fecha_fin_inscripcion || '';
    if (apertura && !cierre) errors.fecha_fin_inscripcion = 'Indica también el cierre de inscripciones';
    if (cierre && !apertura) errors.fecha_inicio_inscripcion = 'Indica también la apertura de inscripciones';
    if (formTorneo.limite_cupo === 'con') {
      const texto = String(formTorneo.cupo_maximo ?? '').trim();
      const cupo = Number(texto);
      if (!/^\d+$/.test(texto) || cupo < CUPO_MINIMO || cupo > CUPO_MAXIMO) {
        errors.cupo_maximo = `El cupo debe ser un número entero entre ${CUPO_MINIMO} y ${CUPO_MAXIMO}`;
      }
    }
    return errors;
  };

  const handleSaveTorneo = async (e) => {
    e.preventDefault();
    const errors = validateTorneoForm();
    if (Object.keys(errors).length > 0) {
      setTorneoFormErrors(errors);
      return;
    }
    setSavingTorneo(true);
    try {
      const payload = {
        nombre: formTorneo.nombre.trim(),
        disciplina_id: Number(formTorneo.disciplina_id),
        fecha_inicio: formTorneo.fecha_inicio || null,
        fecha_fin: formTorneo.fecha_fin || null,
        categoria_id: formTorneo.categoria_id ? Number(formTorneo.categoria_id) : null,
        tipo_torneo: formTorneo.tipo_torneo || 'Individual',
        fecha_inicio_inscripcion: formTorneo.fecha_inicio_inscripcion || null,
        fecha_fin_inscripcion: formTorneo.fecha_fin_inscripcion || null,
        cupo_maximo: formTorneo.limite_cupo === 'con' ? Number(String(formTorneo.cupo_maximo).trim()) : null
      };
      // apiRequest revisa res.ok y, con la sesión vencida, redirige al login (B-25)
      await apiRequest(editingTorneo ? `/torneos/${editingTorneo.torneo_id}` : '/torneos', {
        method: editingTorneo ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      setShowTorneoModal(false);
      await cargarTorneos();
    } catch (err) {
      setTorneoFormErrors({ general: mensajeDeError(err) });
    } finally {
      setSavingTorneo(false);
    }
  };

  const cargarParticipantes = async (torneo) => {
    setLoadingParticipantes(true);
    setParticipantesError(false);
    setParticipantes([]);
    try {
      const data = await apiRequest(`/torneos/${torneo.torneo_id}/participantes`);
      setParticipantes(unwrapList(data, ['participantes', 'data']));
    } catch {
      // Sin datos no se puede afirmar que no hay inscritos: se muestra el error (B-25)
      setParticipantesError(true);
    } finally {
      setLoadingParticipantes(false);
    }
  };

  const handleVerParticipantes = async (torneo) => {
    setTorneoParticipantesActual(torneo);
    setShowParticipantes(true);
    await cargarParticipantes(torneo);
  };

  const handleDesinscribir = async (participante) => {
    if (!torneoParticipantesActual) return;
    if (
      !(await showConfirm(`¿Desinscribir a "${participante.nombre_participante}" del torneo?`, {
        danger: true,
        confirmLabel: 'Desinscribir'
      }))
    )
      return;
    setDesinscribiendoId(participante.participante_id);
    try {
      await apiRequest(
        `/torneos/${torneoParticipantesActual.torneo_id}/participantes/${participante.participante_id}`,
        { method: 'DELETE' }
      );
      await cargarParticipantes(torneoParticipantesActual);
      await cargarTorneos();
    } catch (err) {
      toast(mensajeDeError(err), 'error');
    } finally {
      setDesinscribiendoId(null);
    }
  };

  const handleInscrito = async () => {
    setShowInscribirModal(false);
    await cargarParticipantes(torneoParticipantesActual);
    await cargarTorneos();
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setAppliedFilters({ disciplina_id: filters.disciplina_id.trim(), estado: filters.estado });
  };

  const handleClearFilters = () => {
    const empty = { disciplina_id: '', estado: '' };
    setFilters(empty);
    setAppliedFilters(empty);
  };

  const handleTorneoActualizado = () => {
    cargarTorneos();
    setSelectedTorneo((prev) => (prev ? { ...prev } : null));
  };

  // Vuelve a pedir el bracket del torneo seleccionado (mismo truco de siempre: nueva referencia)
  const recargarBracket = () => setSelectedTorneo((prev) => (prev ? { ...prev } : null));

  const hasBracket = bracket.some((r) => Array.isArray(r.encuentros) && r.encuentros.length > 0);

  const selectedEncuentro = useMemo(() => {
    if (!selectedEncuentroId) return null;
    for (const ronda of bracket) {
      const found = (ronda.encuentros || []).find((e) => e.encuentro_id === selectedEncuentroId);
      if (found) return found;
    }
    return null;
  }, [bracket, selectedEncuentroId]);

  // Ronda del encuentro seleccionado: MatchEditPanel la usa para reconocer los byes
  const selectedRonda = useMemo(
    () => bracket.find((r) => (r.encuentros || []).some((e) => e.encuentro_id === selectedEncuentroId))?.ronda ?? null,
    [bracket, selectedEncuentroId]
  );

  return {
    readOnly,
    filters,
    setFilters,
    appliedFilters,
    setAppliedFilters,
    torneos,
    selectedTorneo,
    setSelectedTorneo,
    bracket,
    disciplinas,
    categorias,
    socios,
    espacios,
    loadingTorneos,
    torneosError,
    cargarTorneos,
    loadingBracket,
    bracketError,
    hasBracket,
    recargarBracket,
    selectedEncuentroId,
    setSelectedEncuentroId,
    selectedEncuentro,
    selectedRonda,
    // Modal crear/editar
    showTorneoModal,
    setShowTorneoModal,
    editingTorneo,
    formTorneo,
    setFormTorneo,
    torneoFormErrors,
    savingTorneo,
    categoriaRequerida,
    estructuraBloqueada,
    openCreateModal,
    openEditModal,
    handleSaveTorneo,
    // Modal de inscritos
    showParticipantes,
    setShowParticipantes,
    participantes,
    loadingParticipantes,
    participantesError,
    cargarParticipantes,
    torneoParticipantesActual,
    desinscribiendoId,
    handleVerParticipantes,
    handleDesinscribir,
    showInscribirModal,
    setShowInscribirModal,
    handleInscrito,
    // Filtros y acciones
    handleFilterSubmit,
    handleClearFilters,
    handleTorneoActualizado
  };
}

export default useGestionTorneos;
