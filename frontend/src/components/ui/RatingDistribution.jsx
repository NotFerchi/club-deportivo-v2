import React from 'react';
import { Star } from 'lucide-react';
import './RatingDistribution.css';

/**
 * RatingDistribution - cuántas calificaciones hay de cada valor (5★ a 1★) con una barra y
 * "88% (37)". El porcentaje es sobre el total; el texto siempre se muestra, así no depende del color.
 *
 *   <RatingDistribution distribucion={{ 5: 37, 4: 4, 3: 1, 2: 0, 1: 0 }} />
 *
 * Props:
 *   distribucion - { 1..5: cantidad } (claves número o texto; las que falten cuentan 0)
 *   ariaLabel    - nombre accesible de la lista (default "Distribución de calificaciones")
 *   className    - clase extra; opcional
 */
export function RatingDistribution({ distribucion = {}, ariaLabel = 'Distribución de calificaciones', className }) {
  const filas = [5, 4, 3, 2, 1].map((n) => ({ n, cantidad: Number(distribucion[n] ?? distribucion[String(n)] ?? 0) || 0 }));
  const total = filas.reduce((a, f) => a + f.cantidad, 0);
  return (
    <ul className={['ui-rating-dist', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      {filas.map(({ n, cantidad }) => {
        const pct = total > 0 ? Math.round((cantidad / total) * 100) : 0;
        return (
          <li key={n} className="ui-rating-dist__row">
            <span className="ui-rating-dist__label">
              {n}
              <Star size={12} aria-hidden="true" />
              <span className="ui-visually-hidden">{n === 1 ? ' estrella' : ' estrellas'}</span>
            </span>
            <span className="ui-rating-dist__track" aria-hidden="true">
              <span className="ui-rating-dist__fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="ui-rating-dist__value">
              {pct}% ({cantidad})
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default RatingDistribution;
