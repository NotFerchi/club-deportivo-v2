import React from 'react';
import './PageHeader.css';

/**
 * PageHeader - encabezado de sección: etiqueta, título, subtítulo y acciones a la derecha
 * (patrón "Cabecera de página" del tablero M0).
 *
 *   <PageHeader
 *     overline="Módulo oficial del club"
 *     title="Torneos y competencias"
 *     subtitle="Gestión oficial de cuadros, inscripciones y sedes."
 *     actions={<Button>Nuevo torneo</Button>}
 *   />
 *
 * Props:
 *   title     - título de la sección (h1 por defecto)
 *   subtitle  - texto de apoyo; opcional
 *   overline  - etiqueta corta sobre el título (se dibuja como Badge azul hielo); opcional
 *   actions   - nodo(s) a la derecha (Input de búsqueda, Buttons); opcional
 *   as        - etiqueta del título ('h1' por defecto; usa 'h2' dentro de otra sección)
 *   glass     - true pone el encabezado sobre una tarjeta de vidrio
 *   className - clase extra; opcional
 */
export function PageHeader({ title, subtitle, overline, actions, as: Tag = 'h1', glass = false, className }) {
  const classes = ['ui-page-header', glass && 'ui-page-header--glass', className].filter(Boolean).join(' ');
  return (
    <header className={classes}>
      <div className="ui-page-header__text">
        {overline && <span className="ui-page-header__overline">{overline}</span>}
        <Tag className="ui-page-header__title">{title}</Tag>
        {subtitle && <p className="ui-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
