import React, { useMemo, useState } from 'react';
import { SplitLayout, Stack } from '../ui';
import { useGestionTorneos } from '../torneos/useGestionTorneos';
import TorneoFormModal from '../torneos/TorneoFormModal';
import TorneoHero from './TorneoHero';
import ListaTorneos from './ListaTorneos';
import PanelInscripciones from './PanelInscripciones';
import DetalleTorneoPersonal from './DetalleTorneoPersonal';
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
 * Torneos del personal (U4-03, diseño de Stitch). Lista: hero del torneo seleccionado, lista con
 * enfoque al deslizar y panel de inscripciones. Detalle (Paso 2): encabezado y pestañas Cuadro
 * (con "Editar encuentro"), Inscritos y Bitácora. La usan admin y gerente (GestionTorneos), el
 * coordinador y el instructor.
 *
 * Toda la lógica (llamadas, validaciones, confirmaciones y mensajes) es la de siempre:
 * torneos/useGestionTorneos y torneos/useAccionesTorneo.
 *
 * Props:
 *   puedeEditar    - true para admin, gerente y coordinador; false (solo lectura) para el instructor
 *   etiquetaAccion - título del panel de acción del hero (p. ej. "Acción del coordinador")
 */
function GestionTorneosPersonal({ puedeEditar = false, etiquetaAccion = 'Siguiente acción' }) {
  const gestion = useGestionTorneos({ readOnly: !puedeEditar });
  const {
    torneos,
    selectedTorneo,
    setSelectedTorneo,
    setSelectedEncuentroId,
    openEditModal,
    handleTorneoActualizado
  } = gestion;
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('lista');
  const [pestana, setPestana] = useState('cuadro');

  const ordenados = useMemo(() => ordenarPorFecha(torneos), [torneos]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ordenados;
    return ordenados.filter((t) => String(t.nombre || '').toLowerCase().includes(q));
  }, [ordenados, busqueda]);

  // Sin selección todavía: se muestra uno por defecto (sin escribir estado hasta que se use).
  // Si el filtro o la búsqueda dejan 0, no hay hero ni panel: la lista ocupa todo el ancho.
  // El elegido se toma de la lista recién cargada (cupo, estado) y, si ya no está, el guardado.
  const elegido = selectedTorneo
    ? torneos.find((t) => String(t.torneo_id) === String(selectedTorneo.torneo_id)) || selectedTorneo
    : null;
  const seleccionado = visibles.length === 0 ? null : elegido || porDefecto(visibles);

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
  const abrirDetalle = (t, enPestana) => {
    seleccionar(t);
    setSelectedEncuentroId(null);
    setPestana(enPestana);
    setVista('detalle');
  };
  const verCuadro = (t) => abrirDetalle(t, 'cuadro');
  const verInscritos = (t) => abrirDetalle(t, 'inscritos');
  const volverALista = () => {
    setSelectedEncuentroId(null);
    setVista('lista');
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
      {vista === 'detalle' && elegido ? (
        <DetalleTorneoPersonal
          gestion={gestion}
          torneo={elegido}
          puedeEditar={puedeEditar}
          etiquetaAccion={etiquetaAccion}
          pestana={pestana}
          onPestana={setPestana}
          onVolver={volverALista}
          onEditar={editar}
          onActualizar={handleTorneoActualizado}
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

      {/* Modal de siempre (se rediseña en el siguiente commit) */}
      <TorneoFormModal gestion={gestion} />
    </>
  );
}

export default GestionTorneosPersonal;
