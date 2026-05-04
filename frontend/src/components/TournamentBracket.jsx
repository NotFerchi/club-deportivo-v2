import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Filter, MapPin, RotateCcw, Trophy } from 'lucide-react';
import { apiRequest, unwrapList } from '../services/api';
import '../../css/TournamentBracket.css';

const DEFAULT_ESTADO_OPTIONS = [
  { value: 'Abierto', label: 'Abierto' },
  { value: 'Inscripciones_cerradas', label: 'Inscripciones cerradas' },
  { value: 'En_curso', label: 'En curso' },
  { value: 'Finalizado', label: 'Finalizado' }
];

const ESTADOS_ENCUENTRO = {
  pendiente: 'pendiente',
  programado: 'programado',
  finalizado: 'finalizado'
};

function normalizeEstado(estado) {
  return String(estado || '').trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(value) {
  if (!value) return '';

  const stringValue = String(value);
  const timeOnlyMatch = stringValue.match(/^(\d{2}):(\d{2})/);
  if (timeOnlyMatch && !stringValue.includes('T')) {
    return `${timeOnlyMatch[1]}:${timeOnlyMatch[2]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return stringValue;

  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildTorneosPath(filters) {
  const params = new URLSearchParams();

  if (filters.disciplina_id) params.set('disciplina_id', filters.disciplina_id);
  if (filters.estado) params.set('estado', filters.estado);

  const queryString = params.toString();
  return `/torneos${queryString ? `?${queryString}` : ''}`;
}

function getErrorMessage(error, fallback) {
  if (error?.name === 'AbortError') return '';
  return error?.message || fallback;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isWinner(encuentro, participante) {
  if (normalizeEstado(encuentro.estado) !== ESTADOS_ENCUENTRO.finalizado) return false;

  if (encuentro.ganador_id && participante?.participante_id) {
    return String(encuentro.ganador_id) === String(participante.participante_id);
  }

  return Boolean(encuentro.ganador_nombre) &&
    normalizeText(encuentro.ganador_nombre) === normalizeText(getParticipantName(participante));
}

function EstadoBadge({ estado }) {
  const normalized = normalizeEstado(estado);
  const className = ['pendiente', 'programado', 'finalizado'].includes(normalized)
    ? normalized
    : 'default';

  return (
    <span className={`tb-estado-badge tb-estado-${className}`}>
      {estado || 'Sin estado'}
    </span>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="tb-empty-state">
      <Trophy size={34} />
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}

function TournamentRow({ torneo, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`tb-tournament-row ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(torneo)}
    >
      <span className="tb-tournament-main">
        <strong>{torneo.nombre || `Torneo #${torneo.torneo_id}`}</strong>
        <span>{torneo.nombre_disciplina || 'Disciplina sin nombre'}</span>
      </span>

      <span className="tb-tournament-date">
        <Calendar size={15} />
        {formatDate(torneo.fecha_inicio)}
      </span>

      <span className="tb-tournament-date">
        <Calendar size={15} />
        {formatDate(torneo.fecha_fin)}
      </span>

      <span className="tb-tournament-status">{torneo.estado || 'Sin estado'}</span>
    </button>
  );
}

function getParticipantName(participante) {
  if (!participante) return 'Por definir';

  return (
    participante.nombre ||
    participante.nombre_completo ||
    participante.nombre_socio ||
    participante.socio_nombre ||
    participante.usuario_nombre ||
    participante.persona_nombre ||
    participante.socio?.nombre ||
    participante.socio?.nombre_completo ||
    participante.usuario?.nombre ||
    participante.persona?.nombre ||
    participante.miembro?.nombre ||
    'Por definir'
  );
}

function MatchParticipant({ participante, winner }) {
  return (
    <div className={`tb-participant ${winner ? 'is-winner' : ''}`}>
      <span className="tb-participant-name">
        {getParticipantName(participante)}
      </span>
      {winner && <span className="tb-winner-label">Ganador</span>}
    </div>
  );
}

function MatchCard({ encuentro }) {
  const participante1 = encuentro.participante_1 || { participante_id: null, nombre: 'Por definir' };
  const participante2 = encuentro.participante_2 || { participante_id: null, nombre: 'Por definir' };
  const estado = normalizeEstado(encuentro.estado);
  const finalizado = estado === ESTADOS_ENCUENTRO.finalizado;
  const showScore = finalizado && (encuentro.marcador_1 != null || encuentro.marcador_2 != null);

  return (
    <article className={`tb-match-card tb-match-${estado || 'default'}`}>
      <header className="tb-match-header">
        <span>Encuentro #{encuentro.encuentro_id}</span>
        <EstadoBadge estado={encuentro.estado} />
      </header>

      <div className="tb-match-body">
        <MatchParticipant participante={participante1} winner={isWinner(encuentro, participante1)} />

        <div className="tb-versus-row">
          <span>VS</span>
          {showScore && (
            <span className="tb-score-wrap">
              <span className="tb-score-label">Marcador</span>
              <strong className="tb-score-chip">
                {encuentro.marcador_1 ?? '-'} - {encuentro.marcador_2 ?? '-'}
              </strong>
            </span>
          )}
        </div>

        <MatchParticipant participante={participante2} winner={isWinner(encuentro, participante2)} />
      </div>

      <footer className="tb-match-meta">
        <span className="tb-court-chip">
          <MapPin size={14} />
          Cancha: {encuentro.cancha_asignada || 'Por asignar'}
        </span>
        {encuentro.hora_programada && (
          <span>
            <Clock size={14} />
            {formatTime(encuentro.hora_programada)}
          </span>
        )}
      </footer>
    </article>
  );
}

function TournamentBracket({
  title = 'Torneos y brackets',
  subtitle = 'Selecciona un torneo para visualizar sus encuentros por ronda.',
  initialDisciplinaId = '',
  initialEstado = '',
  showFilters = true,
  estadoOptions = DEFAULT_ESTADO_OPTIONS
}) {
  const [filters, setFilters] = useState({
    disciplina_id: initialDisciplinaId,
    estado: initialEstado
  });
  const [appliedFilters, setAppliedFilters] = useState({
    disciplina_id: initialDisciplinaId,
    estado: initialEstado
  });
  const [torneos, setTorneos] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState(null);
  const [bracket, setBracket] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [loadingTorneos, setLoadingTorneos] = useState(false);
  const [loadingBracket, setLoadingBracket] = useState(false);
  const [torneosError, setTorneosError] = useState('');
  const [bracketError, setBracketError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadDisciplinas() {
      try {
        const payload = await apiRequest('/disciplinas', {
          signal: controller.signal
        });

        setDisciplinas(unwrapList(payload, ['data', 'disciplinas']));
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setDisciplinas([]);
        }
      }
    }

    loadDisciplinas();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTorneos() {
      setLoadingTorneos(true);
      setTorneosError('');

      try {
        const payload = await apiRequest(buildTorneosPath(appliedFilters), {
          signal: controller.signal
        });
        const nextTorneos = unwrapList(payload, ['data', 'torneos']);

        setTorneos(nextTorneos);
        setSelectedTorneo((current) => {
          if (!current) return null;
          return nextTorneos.some((torneo) => String(torneo.torneo_id) === String(current.torneo_id)) ? current : null;
        });
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudieron cargar los torneos');
        if (message) {
          setTorneos([]);
          setSelectedTorneo(null);
          setTorneosError(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingTorneos(false);
        }
      }
    }

    loadTorneos();

    return () => controller.abort();
  }, [appliedFilters]);

  useEffect(() => {
    if (!selectedTorneo?.torneo_id) {
      setBracket([]);
      setBracketError('');
      return undefined;
    }

    const controller = new AbortController();

    async function loadBracket() {
      setLoadingBracket(true);
      setBracketError('');

      try {
        const payload = await apiRequest(`/torneos/${selectedTorneo.torneo_id}/bracket`, {
          signal: controller.signal
        });

        setBracket(unwrapList(payload, ['data', 'bracket']));
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudo cargar el bracket');
        if (message) {
          setBracket([]);
          setBracketError(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingBracket(false);
        }
      }
    }

    loadBracket();

    return () => controller.abort();
  }, [selectedTorneo]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    setAppliedFilters({
      disciplina_id: filters.disciplina_id.trim(),
      estado: filters.estado
    });
  };

  const handleClearFilters = () => {
    const emptyFilters = { disciplina_id: '', estado: '' };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const hasBracket = bracket.some((ronda) => Array.isArray(ronda.encuentros) && ronda.encuentros.length > 0);

  return (
    <section className="tb-shell">
      <header className="tb-header">
        <div>
          <span className="tb-eyebrow">
            <Trophy size={16} />
            Dashboard deportivo
          </span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      {showFilters && (
        <form className="tb-filters" onSubmit={handleFilterSubmit}>
          <label>
            <span>Disciplina</span>
            {disciplinas.length > 0 ? (
              <select
                value={filters.disciplina_id}
                onChange={(event) => setFilters((current) => ({ ...current, disciplina_id: event.target.value }))}
              >
                <option value="">Todas</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.disciplina_id} value={disciplina.disciplina_id}>
                    {disciplina.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                value={filters.disciplina_id}
                onChange={(event) => setFilters((current) => ({ ...current, disciplina_id: event.target.value }))}
                placeholder="ID de disciplina"
              />
            )}
          </label>

          <label>
            <span>Estado</span>
            <select
              value={filters.estado}
              onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}
            >
              <option value="">Todos</option>
              {estadoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="tb-filter-actions">
            <button type="submit" className="tb-primary-button">
              <Filter size={16} />
              Aplicar
            </button>
            <button type="button" className="tb-secondary-button" onClick={handleClearFilters}>
              <RotateCcw size={16} />
              Limpiar
            </button>
          </div>
        </form>
      )}

      <div className="tb-layout">
        <aside className="tb-tournament-panel">
          <div className="tb-panel-title">
            <strong>Torneos</strong>
            <span>{torneos.length}</span>
          </div>

          <div className="tb-list-head">
            <span>Torneo</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span>Estado</span>
          </div>

          {loadingTorneos && <div className="tb-loading">Cargando torneos...</div>}
          {torneosError && <div className="tb-error">{torneosError}</div>}

          {!loadingTorneos && !torneosError && torneos.length === 0 && (
            <EmptyState title="No hay torneos" message="Cuando existan torneos aparecerán en esta lista." />
          )}

          {!loadingTorneos && !torneosError && torneos.length > 0 && (
            <div className="tb-tournament-list">
              {torneos.map((torneo) => (
                <TournamentRow
                  key={torneo.torneo_id}
                  torneo={torneo}
                  selected={selectedTorneo?.torneo_id === torneo.torneo_id}
                  onSelect={setSelectedTorneo}
                />
              ))}
            </div>
          )}
        </aside>

        <div className="tb-bracket-panel">
          {!selectedTorneo && (
            <EmptyState title="Selecciona un torneo" message="El bracket se cargará al elegir un torneo de la lista." />
          )}

          {selectedTorneo && (
            <>
              <div className="tb-selected-header">
                <div>
                  <span>{selectedTorneo.nombre_disciplina || 'Disciplina'}</span>
                  <h3>{selectedTorneo.nombre || `Torneo #${selectedTorneo.torneo_id}`}</h3>
                </div>
                <span className="tb-tournament-status">{selectedTorneo.estado || 'Sin estado'}</span>
              </div>

              {loadingBracket && <div className="tb-loading">Cargando bracket...</div>}
              {bracketError && <div className="tb-error">{bracketError}</div>}

              {!loadingBracket && !bracketError && !hasBracket && (
                <EmptyState title="Este torneo no tiene bracket" message="Aún no hay encuentros registrados por ronda." />
              )}

              {!loadingBracket && !bracketError && hasBracket && (
                <div className="tb-rounds">
                  {bracket
                    .slice()
                    .sort((a, b) => Number(a.ronda) - Number(b.ronda))
                    .map((ronda) => (
                      <section key={ronda.ronda} className="tb-round-column">
                        <header className="tb-round-title">
                          <span>Ronda</span>
                          <strong>{ronda.ronda}</strong>
                        </header>

                        <div className="tb-round-matches">
                          {(ronda.encuentros || []).map((encuentro) => (
                            <MatchCard key={encuentro.encuentro_id} encuentro={encuentro} />
                          ))}
                        </div>
                      </section>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default TournamentBracket;
