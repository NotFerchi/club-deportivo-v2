import React from 'react';
import { Star } from 'lucide-react';
import './StarRating.css';

/**
 * StarRating - calificación de 1 a 5 con estrellas grandes (patrón de la hoja "Evaluar clase").
 * Es un grupo de radios: lo lee bien un lector de pantalla y se puede usar con teclado.
 *
 *   <Text as="span" id="calif">Calificación *</Text>
 *   <StarRating value={calificacion} onChange={setCalificacion} labelledBy="calif" />
 *
 * Props:
 *   value      - calificación actual (1 a 5) o null
 *   onChange   - (n) => void
 *   disabled   - deshabilita las estrellas (p. ej. mientras se envía)
 *   labelledBy - id del texto que da nombre al grupo
 *   className  - clase extra; opcional
 */
export function StarRating({ value = null, onChange, disabled = false, labelledBy, className }) {
  const classes = ['ui-stars', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="radiogroup" aria-labelledby={labelledBy}>
      {[1, 2, 3, 4, 5].map((n) => {
        const encendida = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} de 5`}
            disabled={disabled}
            className={encendida ? 'ui-stars__star ui-stars__star--on' : 'ui-stars__star'}
            onClick={() => onChange?.(n)}
          >
            <Star size={26} fill={encendida ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default StarRating;
