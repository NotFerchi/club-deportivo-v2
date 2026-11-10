import React, { useMemo } from 'react';
import { Network } from 'lucide-react';
import { Bracket, Card, EmptyState, ErrorState, LoadingState, Stack, Text } from '../ui';
import { cuadroParaKit, rondaDeEncuentro } from './cuadroVista';
import { useInstructores } from './useInstructores';
import EditarEncuentroPanel from './EditarEncuentroPanel';

/**
 * Pestaña "Cuadro" del detalle (U4-03, Paso 2): llave simétrica que converge a la final (o
 * columnas por ronda si no cabe), tarjeta del campeón y el panel "Editar encuentro".
 * Usa el bracket, la carga y el encuentro elegido de useGestionTorneos (los de siempre).
 */
function CuadroPersonal({ gestion, torneo, puedeEditar }) {
  const {
    bracket,
    hasBracket,
    loadingBracket,
    bracketError,
    recargarBracket,
    selectedEncuentroId,
    setSelectedEncuentroId,
    selectedEncuentro,
    selectedRonda,
    espacios
  } = gestion;
  const { instructores, error: instructoresError } = useInstructores(puedeEditar);
  const { rounds, champion } = useMemo(() => cuadroParaKit(bracket), [bracket]);

  const alternar = (id) => setSelectedEncuentroId(String(id) === String(selectedEncuentroId) ? null : id);

  return (
    <Card title="Cuadro" icon={<Network size={18} />}>
      <Stack gap={24}>
        {puedeEditar && hasBracket && (
          <Text variant="small" muted>
            Haz clic en un encuentro para editarlo
          </Text>
        )}
        {loadingBracket && !hasBracket && <LoadingState rows={3} label="Cargando cuadro…" />}
        {!loadingBracket && bracketError && <ErrorState message={bracketError} onRetry={recargarBracket} />}
        {!loadingBracket && !bracketError && !hasBracket && (
          <EmptyState icon={<Network size={24} />} title="Sin cuadro" message="El cuadro se genera al cerrar las inscripciones" />
        )}
        {!bracketError && hasBracket && (
          <Bracket
            rounds={rounds}
            champion={champion}
            selectedId={selectedEncuentroId}
            onMatchClick={alternar}
            ariaLabel={`Cuadro de ${torneo.nombre || 'torneo'}`}
          />
        )}
      </Stack>

      {/* Fuera de la carga: al guardar se recarga el bracket y el panel no se desmonta */}
      {selectedEncuentro && (
        <EditarEncuentroPanel
          key={selectedEncuentro.encuentro_id}
          torneo={torneo}
          encuentro={selectedEncuentro}
          ronda={selectedRonda}
          rondaLabel={rondaDeEncuentro(bracket, selectedEncuentro.encuentro_id)}
          puedeEditar={puedeEditar}
          espacios={espacios}
          instructores={instructores}
          instructoresError={instructoresError}
          onClose={() => setSelectedEncuentroId(null)}
          onSaved={recargarBracket}
        />
      )}
    </Card>
  );
}

export default CuadroPersonal;
