import React from 'react';
import { Check } from 'lucide-react';
import './SelectTile.css';

/**
 * SelectTile - tarjeta seleccionable, con foto o sin ella (Stitch: socio/reservar).
 *
 *   <SelectTile image={fotoPadel} title="Pádel" meta="4 canchas" selected onClick={…} />
 *   <SelectTile title="Cancha 2" badge={<Badge variant="ice">Cap. 4</Badge>} onClick={…} />
 *   <SelectTile title="Cancha 4" meta="No disponible" disabled />
 *
 * Es un <button aria-pressed>: el estado seleccionado lo leen los lectores de pantalla.
 * Con foto lleva texto blanco sobre un velo navy; sin foto es una tarjeta blanca que se vuelve
 * navy al seleccionarse. Deshabilitada se atenúa y tacha el título.
 *
 * Props:
 *   title     - texto principal
 *   meta      - texto secundario bajo el título; opcional
 *   badge     - nodo sobre el título (normalmente un Badge); opcional
 *   image     - URL de la foto; opcional
 *   icon      - ícono grande cuando no hay foto en una tarjeta con `media`; opcional
 *   media     - true pinta la tarjeta alta de foto aunque no haya `image` (usa `icon` sobre navy)
 *   selected  - marca la tarjeta como elegida
 *   disabled  - deshabilita la tarjeta
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo de <button> (onClick, aria-*, etc.)
 */
export function SelectTile({
  title,
  meta,
  badge,
  image,
  icon,
  media = false,
  selected = false,
  disabled = false,
  className,
  ...rest
}) {
  const isMedia = media || Boolean(image);
  const classes = [
    'ui-tile',
    isMedia ? 'ui-tile--media' : 'ui-tile--plain',
    selected && 'ui-tile--selected',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type="button" className={classes} aria-pressed={selected} disabled={disabled} {...rest}>
      {image && <img className="ui-tile__photo" src={image} alt="" />}
      {isMedia && !image && icon && <span className="ui-tile__icon" aria-hidden="true">{icon}</span>}
      {selected && (
        <span className="ui-tile__check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
      )}
      <span className="ui-tile__body">
        {badge && <span className="ui-tile__badge">{badge}</span>}
        <span className="ui-tile__title">{title}</span>
        {meta && <span className="ui-tile__meta">{meta}</span>}
      </span>
    </button>
  );
}

export default SelectTile;
