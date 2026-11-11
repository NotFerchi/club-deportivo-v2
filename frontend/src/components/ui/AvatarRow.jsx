import React from 'react';
import './AvatarRow.css';

/**
 * AvatarRow - tarjeta en fila: una persona (avatar) con hasta tres líneas de texto y una acción o
 * estado a la derecha. Patrón de las listas de clases del socio (Evaluar instructores, Mis clases).
 *
 *   <AvatarRow
 *     avatar={<Avatar name="Laura Mendoza" src={foto} size="lg" />}
 *     title="Pilates"
 *     subtitle="Laura Mendoza"
 *     meta="Martes · 18:00 · Salón 2"
 *     action={<Button>Evaluar</Button>}
 *   />
 *
 * En pantallas angostas la acción baja debajo del texto para que nada se corte.
 *
 * Props:
 *   avatar    - nodo a la izquierda (normalmente un Avatar); opcional
 *   title     - texto principal
 *   subtitle  - segunda línea; opcional
 *   meta      - tercera línea de apoyo (día, hora, lugar); opcional
 *   action    - nodo a la derecha (Button, Badge…); opcional
 *   as        - etiqueta HTML (default 'article'; usa 'li' dentro de una lista)
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo (aria-*, etc.)
 */
export function AvatarRow({ avatar, title, subtitle, meta, action, as: Tag = 'article', className, ...rest }) {
  const classes = ['ui-avatar-row', className].filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...rest}>
      {avatar && <span className="ui-avatar-row__avatar">{avatar}</span>}
      <span className="ui-avatar-row__text">
        <span className="ui-avatar-row__title">{title}</span>
        {subtitle && <span className="ui-avatar-row__subtitle">{subtitle}</span>}
        {meta && <span className="ui-avatar-row__meta">{meta}</span>}
      </span>
      {action && <span className="ui-avatar-row__action">{action}</span>}
    </Tag>
  );
}

export default AvatarRow;
