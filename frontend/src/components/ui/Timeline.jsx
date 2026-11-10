import React from 'react';
import './Timeline.css';

/**
 * Timeline - línea de tiempo vertical (bitácora): quién, qué y cuándo.
 *
 *   <Timeline
 *     ariaLabel="Bitácora del torneo"
 *     items={[{ id: 1, title: 'Editó el torneo', who: 'Mariana López', when: '10 Nov 2026 · 14:20',
 *               details: ['Nombre: Copa → Copa 2026'], tone: 'info' }]}
 *   />
 *
 * Props:
 *   items     - [{ id, title, who?, when?, details?: string[] | string, tone?: 'neutral'|'info'|'danger', icon? }]
 *   ariaLabel - nombre accesible de la lista
 *   className - clase extra; opcional
 */
export function Timeline({ items, ariaLabel, className }) {
  return (
    <ol className={['ui-timeline', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {items.map((item) => {
        const detalles = Array.isArray(item.details) ? item.details : item.details ? [item.details] : [];
        return (
          <li key={item.id} className="ui-timeline__item">
            <span className={`ui-timeline__dot ui-timeline__dot--${item.tone || 'neutral'}`} aria-hidden="true">
              {item.icon}
            </span>
            <div className="ui-timeline__content">
              <div className="ui-timeline__head">
                <span className="ui-timeline__title">{item.title}</span>
                {item.when && <span className="ui-timeline__when">{item.when}</span>}
              </div>
              {item.who && <span className="ui-timeline__who">{item.who}</span>}
              {detalles.length > 0 && (
                <ul className="ui-timeline__details">
                  {detalles.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default Timeline;
