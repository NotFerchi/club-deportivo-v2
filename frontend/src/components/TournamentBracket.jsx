import React from 'react';
import { Edit2, Filter, Plus, RotateCcw, Trophy, Users } from 'lucide-react';
import { DEFAULT_ESTADO_OPTIONS } from './torneos/torneoUtils';
import ErrorReintentar from './torneos/ErrorReintentar';
import EmptyState from './torneos/EmptyState';
import TournamentRow from './torneos/TournamentRow';
import AccionesTorneo from './torneos/AccionesTorneo';
import DetalleTorneo from './torneos/DetalleTorneo';
import CuadroTorneo from './torneos/CuadroTorneo';
import TorneoFormModal from './torneos/TorneoFormModal';
import ParticipantesModal from './torneos/ParticipantesModal';
import { useGestionTorneos } from './torneos/useGestionTorneos';
import '../../css/TournamentBracket.css';

// Hoy lo usan la vista del socio (solo lectura) y, hasta el Paso 2 de U4-03, el detalle con el cuadro.
// La lógica vive en torneos/useGestionTorneos.js; la lista del personal está en torneos-gestion/.
function TournamentBracket({
  title = 'Torneos y brackets',
  subtitle = 'Consulta los torneos activos y sus encuentros por ronda.',
  initialDisciplinaId = '',
  initialEstado = '',
  showFilters = true,
  readOnly = false,
  estadoOptions = DEFAULT_ESTADO_OPTIONS
}) {
  const gestion = useGestionTorneos({ initialDisciplinaId, initialEstado, readOnly });
  const {
    filters,
    setFilters,
    torneos,
    selectedTorneo,
    setSelectedTorneo,
    disciplinas,
    loadingTorneos,
    torneosError,
    cargarTorneos,
    openCreateModal,
    openEditModal,
    handleVerParticipantes,
    handleFilterSubmit,
    handleClearFilters,
    handleTorneoActualizado
  } = gestion;

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
                onChange={(e) => setFilters((c) => ({ ...c, disciplina_id: e.target.value }))}
              >
                <option value="">Todas</option>
                {disciplinas.map((d) => (
                  <option key={d.disciplina_id} value={d.disciplina_id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                value={filters.disciplina_id}
                onChange={(e) => setFilters((c) => ({ ...c, disciplina_id: e.target.value }))}
                placeholder="ID de disciplina"
              />
            )}
          </label>
          <label>
            <span>Estado</span>
            <select value={filters.estado} onChange={(e) => setFilters((c) => ({ ...c, estado: e.target.value }))}>
              <option value="">Todos</option>
              {estadoOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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

      {/* Layout: lista izquierda + detalle/bracket derecha */}
      <div className="tb-split-layout">
        {/* Panel izquierdo — lista de torneos */}
        <aside className="tb-side-list">
          <div className="tb-panel-title">
            <strong>Torneos</strong>
            <span>{torneos.length}</span>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                width: '100%',
                marginBottom: 10,
                background: 'linear-gradient(135deg,#2563eb,#3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Plus size={15} /> Nuevo Torneo
            </button>
          )}
          {loadingTorneos && <div className="tb-loading">Cargando...</div>}
          {torneosError && <ErrorReintentar mensaje={torneosError} onReintentar={() => cargarTorneos()} />}
          {!loadingTorneos && !torneosError && torneos.length === 0 && (
            <EmptyState title="No hay torneos" message="Cuando existan torneos aparecerán aquí." />
          )}
          {!loadingTorneos && !torneosError && torneos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {torneos.map((t) => (
                <TournamentRow
                  key={t.torneo_id}
                  torneo={t}
                  selected={selectedTorneo?.torneo_id === t.torneo_id}
                  onSelect={setSelectedTorneo}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Panel derecho — detalles + bracket */}
        <div className="tb-detail-side">
          {!selectedTorneo ? (
            <div className="tb-detail-placeholder">
              <EmptyState title="Selecciona un torneo" message="Los detalles y bracket aparecerán aquí." />
            </div>
          ) : (
            <>
              {/* Detalle del torneo */}
              <DetalleTorneo torneo={selectedTorneo} />

              {/* Botones de gestión */}
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedTorneo)}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: '#1e3a5f'
                    }}
                  >
                    <Edit2 size={13} /> Editar torneo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerParticipantes(selectedTorneo)}
                    style={{
                      background: '#eff6ff',
                      border: '1px solid #93c5fd',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: '#1d4ed8'
                    }}
                  >
                    <Users size={13} /> Inscritos ({selectedTorneo.total_participantes ?? 0})
                  </button>
                </div>
              )}

              {/* Acciones */}
              {/* key por torneo: el mensaje de una acción no pasa al siguiente torneo (B-24) */}
              <AccionesTorneo
                key={selectedTorneo.torneo_id}
                torneo={selectedTorneo}
                onActualizar={handleTorneoActualizado}
                readOnly={readOnly}
              />

              {/* Bracket */}
              <CuadroTorneo gestion={gestion} />
            </>
          )}
        </div>
      </div>
      {/* Modal crear/editar torneo */}
      <TorneoFormModal gestion={gestion} />

      {/* Modal ver participantes + inscribir */}
      <ParticipantesModal gestion={gestion} />
    </section>
  );
}

export default TournamentBracket;
