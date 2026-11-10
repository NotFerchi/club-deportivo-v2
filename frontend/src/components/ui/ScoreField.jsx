import React, { useId } from 'react';
import { Check } from 'lucide-react';
import './ScoreField.css';

/**
 * ScoreField - un participante de un encuentro con su marcador (tablero U4-03, "Editar
 * encuentro"): nombre, etiqueta ("Participante A"), un número y el indicador de ganador.
 * El ganador solo se muestra (lo calcula quien lo usa); no es un control.
 *
 *   <ScoreField name="Sofía Torres" tag="Participante A" value={m1} onChange={setM1} winner={m1 > m2} />
 *   <ScoreField name="Sofía Torres" tag="Participante A" value={6} readOnly />
 *
 * Props:
 *   name      - nombre del participante
 *   tag       - etiqueta a la derecha del nombre; opcional
 *   value     - marcador (texto o número; '' sin marcador)
 *   onChange  - (texto) => void; sin él (o con readOnly) el marcador solo se muestra
 *   readOnly  - true muestra el marcador sin campo
 *   disabled  - deshabilita el campo
 *   winner    - true marca al participante como ganador
 *   error     - true marca el campo en error
 *   className - clase extra; opcional
 */
export function ScoreField({ name, tag, value, onChange, readOnly = false, disabled = false, winner = false, error = false, className }) {
  const id = useId();
  const editable = Boolean(onChange) && !readOnly;
  const vacio = value === '' || value === null || value === undefined;
  return (
    <div className={['ui-score-field', winner && 'ui-score-field--winner', error && 'ui-score-field--error', className].filter(Boolean).join(' ')}>
      <div className="ui-score-field__top">
        <span className="ui-score-field__name">{name}</span>
        {tag && <span className="ui-score-field__tag">{tag}</span>}
      </div>
      <div className="ui-score-field__bottom">
        <label className="ui-score-field__label" htmlFor={editable ? id : undefined}>
          Marcador:
        </label>
        {editable ? (
          <input
            id={id}
            className="ui-score-field__input"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={value}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-label={`Marcador de ${name}`}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <span className="ui-score-field__value">{vacio ? '—' : value}</span>
        )}
        <span className={['ui-score-field__winner', winner && 'ui-score-field__winner--on'].filter(Boolean).join(' ')}>
          <span className="ui-score-field__check" aria-hidden="true">
            {winner && <Check size={14} />}
          </span>
          Ganador
          {!winner && <span className="ui-visually-hidden"> (no)</span>}
        </span>
      </div>
    </div>
  );
}

export default ScoreField;
