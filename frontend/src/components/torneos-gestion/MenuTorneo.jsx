import React from 'react';
import { Ban, Network, Pencil, Users } from 'lucide-react';
import { Menu } from '../ui';
import { ACCION_CANCELAR, admiteAcciones, useAccionesTorneo } from '../torneos/useAccionesTorneo';
import { useAvisoAccion } from './useAvisoAccion';

/**
 * Menú ⋯ de un torneo. Quien edita: Editar torneo, Ver inscritos, Ver cuadro y Cancelar torneo
 * (Cancelar solo si el torneo no está Finalizado ni Cancelado, como en AccionesTorneo).
 * Solo lectura: únicamente Ver cuadro.
 * Montarlo con key={torneo_id} para que el aviso de una acción no pase a otro torneo (B-24).
 */
function MenuTorneo({ torneo, puedeEditar, onActualizar, onEditar, onVerInscritos, onVerCuadro, triggerVariant }) {
  const { cargando, mensaje, ejecutar } = useAccionesTorneo(torneo, onActualizar);
  useAvisoAccion(mensaje);

  const nombre = torneo.nombre || `Torneo #${torneo.torneo_id}`;
  const verCuadro = { id: 'cuadro', label: 'Ver cuadro', icon: <Network size={16} />, onSelect: () => onVerCuadro(torneo) };

  const items = puedeEditar
    ? [
        { id: 'editar', label: 'Editar torneo', icon: <Pencil size={16} />, onSelect: () => onEditar(torneo) },
        { id: 'inscritos', label: 'Ver inscritos', icon: <Users size={16} />, onSelect: () => onVerInscritos(torneo) },
        verCuadro,
        ...(admiteAcciones(torneo.estado)
          ? [
              {
                id: 'cancelar',
                label: cargando ? ACCION_CANCELAR.cargandoLabel : ACCION_CANCELAR.label,
                icon: <Ban size={16} />,
                danger: true,
                disabled: cargando,
                onSelect: () => ejecutar(ACCION_CANCELAR)
              }
            ]
          : [])
      ]
    : [verCuadro];

  return <Menu label={`Opciones de ${nombre}`} items={items} triggerVariant={triggerVariant} />;
}

export default MenuTorneo;
