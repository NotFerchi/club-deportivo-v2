import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './DetailHeader.css';

/**
 * DetailHeader - encabezado de una página de detalle (tablero U4-03, "detalle del torneo"):
 * ícono en mosaico navy, enlace para volver, pastillas, título, una línea de datos y, a la
 * derecha, un panel opcional (p. ej. la siguiente acción).
 *
 *   <DetailHeader
 *     icon={<Trophy size={28} />}
 *     backLabel="Torneos"
 *     onBack={volver}
 *     badges={<><Badge variant="sky">Temporada 2026</Badge><Badge>En curso</Badge></>}
 *     title="Copa del Rey 2026"
 *     meta={<><CalendarDays size={14} /> 15 al 22 Nov 2026</>}
 *     aside={<Card>…</Card>}
 *   />
 *
 * A 1024 px o menos el panel `aside` pasa debajo del título.
 *
 * Props:
 *   icon      - nodo del ícono; opcional
 *   backLabel - texto del enlace para volver (con flecha); requiere onBack
 *   onBack    - () => void
 *   badges    - nodos (Badge) junto al enlace; opcional
 *   title     - título (h2)
 *   meta      - línea de datos bajo el título; opcional
 *   aside     - nodo a la derecha; opcional
 *   className - clase extra; opcional
 */
export function DetailHeader({ icon, backLabel, onBack, badges, title, meta, aside, className }) {
  return (
    <header className={['ui-detail-header', aside && 'ui-detail-header--aside', className].filter(Boolean).join(' ')}>
      {icon && (
        <span className="ui-detail-header__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="ui-detail-header__main">
        {(onBack || badges) && (
          <div className="ui-detail-header__top">
            {onBack && (
              <button type="button" className="ui-detail-header__back" onClick={onBack}>
                <ArrowLeft size={16} aria-hidden="true" />
                {backLabel}
              </button>
            )}
            {badges}
          </div>
        )}
        <h2 className="ui-detail-header__title">{title}</h2>
        {meta && <p className="ui-detail-header__meta">{meta}</p>}
      </div>
      {aside && <div className="ui-detail-header__aside">{aside}</div>}
    </header>
  );
}

export default DetailHeader;
