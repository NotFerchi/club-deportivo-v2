import React, { useMemo, useState } from 'react';
import { SplitLayout, Stack } from '../ui';
import { useGestionTorneos } from '../torneos/useGestionTorneos';
import TorneoFormModal from '../torneos/TorneoFormModal';
import ParticipantesModal from '../torneos/ParticipantesModal';
import TorneoHero from './TorneoHero';
import ListaTorneos from './ListaTorneos';
import PanelInscripciones from './PanelInscripciones';
import VistaCuadro from './VistaCuadro';
import { ordenarPorFecha } from './torneoVista';

const PRIORIDAD_INICIAL = ['En_curso', 'Abierto', 'Inscripciones_cerradas'];

/** Torneo que se muestra si aún no se eligió ninguno: el primero en curso, luego abierto, etc. */
function porDefecto(lista) {
  for (const estado of PRIORIDAD_INICIAL) {
    const t = lista.find((x) => x.estado === estado);
    if (t) return t;
  }
  return lista[0] || null;
}

/**
 * Lista de torneos del personal (U4-03, diseño de Stitch): hero del torneo seleccionado, lista con
 * enfoque al deslizar y panel de inscripciones. La usan admin y gerente (GestionTorneos), el
 * coordinador y el instructor.
 *
 * Toda la lógica (llamadas, validaciones, confirmaciones y mensajes) es la de siempre:
 * torneos/useGestionTorneos y torneos/useAccionesTorneo. Los modales de editar e inscritos y el
 * cuadro se reutilizan tal cual (se rediseñan en el Paso 2).
 *
 * Props:
 *   puedeEditar    - true para admin, gerente y coordinador; false (solo lectura) para el instructor
 *   etiquetaAccion - título del panel de acción del hero (p. ej. "Acción del coordinador")
 */
function GestionTorneosPersonal({ puedeEditar = false, etiquetaAccion = 'Siguiente acción' }) {
  const gestion = useGestionTorneos({ readOnly: !puedeEditar });
  const { torneos, selectedTorneo, setSelectedTorneo, openEditModal, handleVerParticipantes, handleTorneoActualizado } =
    gestion;
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('lista');

  const ordenados = useMemo(() => ordenarPorFecha(torneos), [torneos]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ordenados;
    return ordenados.filter((t) => String(t.nombre || '').toLowerCase().includes(q));
  }, [ordenados, busqueda]);

  // Sin selección todavía: se muestra uno por defecto (sin escribir estado hasta que se use).
  // Si el filtro o la búsqueda dejan 0, no hay hero ni panel: la lista ocupa todo el ancho.
  const seleccionado = visibles.length === 0 ? null : selectedTorneo || porDefecto(visibles);

  const limpiarFiltros = () => {
    setBusqueda('');
    gestion.handleClearFilters();
  };

  const seleccionar = (t) => {
    if (String(t.torneo_id) !== String(selectedTorneo?.torneo_id)) setSelectedTorneo(t);
  };
  const editar = (t) => {
    seleccionar(t);
    openEditModal(t);
  };
  const verInscritos = (t) => {
    seleccionar(t);
    handleVerParticipantes(t);
  };
  const verCuadro = (t) => {
    seleccionar(t);
    setVista('cuadro');
  };

  const acciones = {
    puedeEditar,
    onActualizar: handleTorneoActualizado,
    onEditar: editar,
    onVerInscritos: verInscritos,
    onVerCuadro: verCuadro
  };

  return (
    <>
      {vista === 'cuadro' && seleccionado ? (
        <VistaCuadro
          gestion={gestion}
          torneo={seleccionado}
          puedeEditar={puedeEditar}
          onVolver={() => setVista('lista')}
          onEditar={editar}
          onVerInscritos={verInscritos}
        />
      ) : (
        <Stack gap={32}>
          {seleccionado && <TorneoHero key={seleccionado.torneo_id} torneo={seleccionado} etiquetaAccion={etiquetaAccion} {...acciones} />}
          <SplitLayout
            aside={
              seleccionado && (
                <PanelInscripciones
                  key={seleccionado.torneo_id}
                  torneo={seleccionado}
                  puedeEditar={puedeEditar}
                  onVerInscritos={verInscritos}
                />
              )
            }
          >
            <ListaTorneos
              gestion={gestion}
              torneos={visibles}
              busqueda={busqueda}
              onBuscar={setBusqueda}
              onLimpiarFiltros={limpiarFiltros}
              seleccionadoId={seleccionado?.torneo_id}
              onSeleccionar={seleccionar}
              {...acciones}
            />
          </SplitLayout>
        </Stack>
      )}

      {/* Modales de siempre (se rediseñan en el Paso 2) */}
      <TorneoFormModal gestion={gestion} />
      <ParticipantesModal gestion={gestion} />
    </>
  );
}

export default GestionTorneosPersonal;
