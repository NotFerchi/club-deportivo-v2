import React from 'react';
import { CalendarDays, FilterX, Pencil, Plus, SearchX, Trophy, Users } from 'lucide-react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  EventRow,
  FocusList,
  FocusListLabel,
  IconButton,
  Input,
  LoadingState,
  Select,
  Stack,
  Text
} from '../ui';
import { DEFAULT_ESTADO_OPTIONS } from '../torneos/torneoUtils';
import MenuTorneo from './MenuTorneo';
import { IconoDisciplina, agruparPorMes, bloqueFecha, cupoDe, pastillaDe, rangoFechas } from './torneoVista';

/** Contador de inscritos de la fila: "12 / 16" o "12" con ícono (la API no da avatares en la lista). */
function textoInscritos(torneo) {
  const { inscritos, maximo } = cupoDe(torneo);
  return maximo ? `${inscritos} / ${maximo}` : String(inscritos);
}

function Inscritos({ torneo }) {
  return (
    <>
      <Users size={14} aria-hidden="true" />
      {textoInscritos(torneo)}
    </>
  );
}

/** Título del vacío con filtros: la búsqueda manda; si no, la disciplina; si no, el estado. */
function tituloSinResultados({ busqueda, appliedFilters, disciplinas }) {
  if (busqueda.trim()) return 'No hay torneos con esa búsqueda';
  if (appliedFilters.disciplina_id) {
    const d = disciplinas.find((x) => String(x.disciplina_id) === String(appliedFilters.disciplina_id));
    return d ? `No hay torneos de ${d.nombre}` : 'No hay torneos de esa disciplina';
  }
  const estado = DEFAULT_ESTADO_OPTIONS.find((o) => o.value === appliedFilters.estado);
  return estado ? `No hay torneos en estado ${estado.label}` : 'No hay torneos con ese filtro';
}

/**
 * Columna izquierda: título con total, "Nuevo torneo" (solo quien edita), búsqueda, filtros de
 * disciplina y estado (los mismos de antes; se aplican al elegir) y la lista agrupada por mes con
 * el efecto de enfoque (FocusList).
 */
function ListaTorneos({
  gestion,
  torneos,
  busqueda,
  onBuscar,
  onLimpiarFiltros,
  seleccionadoId,
  onSeleccionar,
  puedeEditar,
  onActualizar,
  onEditar,
  onVerInscritos,
  onVerCuadro
}) {
  const {
    filters,
    setFilters,
    appliedFilters,
    setAppliedFilters,
    disciplinas,
    loadingTorneos,
    torneosError,
    cargarTorneos,
    openCreateModal
  } = gestion;
  const hayFiltros = Boolean(busqueda.trim() || appliedFilters.disciplina_id || appliedFilters.estado);
  const sinTorneos = !loadingTorneos && !torneosError && torneos.length === 0;

  const cambiarFiltro = (campo) => (e) => {
    const siguiente = { ...filters, [campo]: e.target.value };
    setFilters(siguiente);
    setAppliedFilters({ disciplina_id: String(siguiente.disciplina_id || '').trim(), estado: siguiente.estado });
  };

  const grupos = agruparPorMes(torneos);
  const porId = new Map(torneos.map((t) => [String(t.torneo_id), t]));

  return (
    <Stack gap={16}>
      <Stack direction="row" gap={12} align="center" justify="between" wrap>
        <Stack direction="row" gap={12} align="center">
          <Text variant="heading" as="h3">
            Torneos
          </Text>
          <Badge variant="neutral" aria-label={`${torneos.length} torneos`}>
            {torneos.length}
          </Badge>
        </Stack>
        {puedeEditar && !(sinTorneos && !hayFiltros) && (
          <Button onClick={openCreateModal}>
            <Plus size={16} aria-hidden="true" />
            Nuevo torneo
          </Button>
        )}
      </Stack>

      <Stack direction="row" gap={12} wrap grow minChild={180}>
        <Input
          type="search"
          aria-label="Buscar torneo"
          placeholder="Buscar torneo"
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
        />
        <Select
          aria-label="Disciplina"
          placeholder="Disciplina: Todas"
          value={filters.disciplina_id}
          onChange={cambiarFiltro('disciplina_id')}
          options={disciplinas.map((d) => ({ value: String(d.disciplina_id), label: d.nombre }))}
        />
        <Select
          aria-label="Estado"
          placeholder="Estado: Todos"
          value={filters.estado}
          onChange={cambiarFiltro('estado')}
          options={DEFAULT_ESTADO_OPTIONS}
        />
      </Stack>

      {loadingTorneos && torneos.length === 0 && <LoadingState rows={4} label="Cargando torneos…" />}
      {!loadingTorneos && torneosError && <ErrorState message={torneosError} onRetry={() => cargarTorneos()} />}
      {sinTorneos && hayFiltros && (
        <EmptyState
          compact
          icon={<SearchX size={20} />}
          title={tituloSinResultados({ busqueda, appliedFilters, disciplinas })}
          message="Prueba con otro filtro o limpia la búsqueda."
          action={
            <Button variant="secondary" onClick={onLimpiarFiltros}>
              <FilterX size={16} aria-hidden="true" />
              Limpiar filtros
            </Button>
          }
        />
      )}
      {sinTorneos && !hayFiltros && (
        <EmptyState
          compact
          icon={<Trophy size={20} />}
          title="Aún no hay torneos"
          message={puedeEditar ? 'Crea el primero para abrir inscripciones.' : 'Cuando existan torneos aparecerán aquí.'}
          action={
            puedeEditar && (
              <Button onClick={openCreateModal}>
                <Plus size={16} aria-hidden="true" />
                Nuevo torneo
              </Button>
            )
          }
        />
      )}
      {!torneosError && torneos.length > 0 && (
        <FocusList
          orientation="vertical"
          ariaLabel="Torneos"
          activeKey={seleccionadoId}
          onActivate={(key) => porId.has(key) && onSeleccionar(porId.get(key))}
        >
          {grupos.flatMap((g) => [
            <FocusListLabel key={`mes-${g.clave}`}>{g.rotulo}</FocusListLabel>,
            ...g.torneos.map((t) => {
              const fecha = bloqueFecha(t);
              const pastilla = pastillaDe(t);
              return (
                <EventRow
                  key={String(t.torneo_id)}
                  weekday={fecha.weekday}
                  day={fecha.day}
                  icon={<IconoDisciplina nombre={t.nombre_disciplina} />}
                  title={t.nombre || `Torneo #${t.torneo_id}`}
                  meta={
                    <>
                      <CalendarDays size={14} aria-hidden="true" />
                      {rangoFechas(t)}
                    </>
                  }
                  extra={<Inscritos torneo={t} />}
                  extraLabel={`inscritos: ${textoInscritos(t)}`}
                  badge={<Badge variant={pastilla.variant}>{pastilla.label}</Badge>}
                  selected={String(t.torneo_id) === String(seleccionadoId)}
                  onClick={() => onSeleccionar(t)}
                  actions={
                    <>
                      {puedeEditar && (
                        <IconButton label={`Editar ${t.nombre || 'torneo'}`} onClick={() => onEditar(t)}>
                          <Pencil size={16} aria-hidden="true" />
                        </IconButton>
                      )}
                      <MenuTorneo
                        key={t.torneo_id}
                        torneo={t}
                        puedeEditar={puedeEditar}
                        onActualizar={onActualizar}
                        onEditar={onEditar}
                        onVerInscritos={onVerInscritos}
                        onVerCuadro={onVerCuadro}
                      />
                    </>
                  }
                />
              );
            })
          ])}
        </FocusList>
      )}
    </Stack>
  );
}

export default ListaTorneos;
