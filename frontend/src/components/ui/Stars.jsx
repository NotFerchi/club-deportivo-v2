import React from 'react';
import { Star, StarHalf } from 'lucide-react';
import './Stars.css';

/**
 * Stars - muestra una calificación de 0 a 5 con estrellas (solo lectura; para elegir una
 * calificación está StarRating). Redondea a media estrella. Un lector de pantalla lee
 * "4.8 de 5 estrellas".
 *
 *   <Stars value={4.8} />
 *   <Stars value={4} size="sm" />
 *
 * Props:
 *   value     - número de 0 a 5 (null o sin valor: estrellas vacías y "Sin calificación")
 *   size      - 'sm' | 'md' (default) | 'lg'
 *   className - clase extra; opcional
 */
export function Stars({ value, size = 'md', className }) {
  const numero = Number(value);
  const valido = value !== null && value !== undefined && Number.isFinite(numero);
  const medias = valido ? Math.round(Math.min(5, Math.max(0, numero)) * 2) : 0;
  const px = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const etiqueta = valido ? `${numero.toFixed(1)} de 5 estrellas` : 'Sin calificación';
  return (
    <span className={['ui-rating-stars', `ui-rating-stars--${size}`, className].filter(Boolean).join(' ')} role="img" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((n) => {
        const llenas = medias - (n - 1) * 2; // 2 = llena, 1 = media, ≤0 = vacía
        if (llenas >= 2) return <Star key={n} size={px} className="ui-rating-stars__star ui-rating-stars__star--full" aria-hidden="true" />;
        if (llenas === 1) {
          return (
            <span key={n} className="ui-rating-stars__half" aria-hidden="true">
              <Star size={px} className="ui-rating-stars__star" />
              <StarHalf size={px} className="ui-rating-stars__star ui-rating-stars__star--full ui-rating-stars__half-fill" />
            </span>
          );
        }
        return <Star key={n} size={px} className="ui-rating-stars__star" aria-hidden="true" />;
      })}
    </span>
  );
}

export default Stars;
