import React from 'react';
import { ProgressBar } from './ProgressBar';
import './EventCard.css';

const GRADIENTES = ['torneos', 'reservas', 'clases', 'ludoteca', 'sanciones'];

/**
 * EventCard - tarjeta grande de un evento (torneo): fondo de color del módulo con un ícono grande
 * de fondo, píldora de disciplina, bloque de fecha, título, datos, cupo y un llamado a la acción.
 * Por defecto es un <button>: toda la tarjeta se toca. Con `as="div"` es solo una portada.
 * (Estructura inspirada en "tilt-stack-scroll" de 21st.dev y en el diseño de Stitch.)
 *
 *   <EventCard
 *     kicker="Tenis"
 *     icon={<Volleyball size={160} />}
 *     day="15" month="nov"
 *     title="Copa del Rey"
 *     description="Categoría Adulto · Libre"
 *     chips={['Individual']}
 *     progress={{ value: 12, max: 16, label: 'Cupo' }}
 *     status={<Badge variant="success">Abierto</Badge>}
 *     cta="Ver detalle"
 *     onClick={() => abrir(torneo)}
 *   />
 *
 * Props:
 *   title       - nombre del evento
 *   kicker      - píldora arriba a la izquierda (disciplina); opcional
 *   icon        - nodo (ícono grande) que se dibuja tenue de fondo; opcional
 *   photo       - URL de una foto de fondo; opcional. Si no carga, queda el degradado
 *   day, month  - bloque de fecha arriba a la derecha; opcional
 *   description - línea de apoyo bajo el título; opcional
 *   chips       - arreglo de textos cortos; opcional
 *   progress    - { value, max, label } barra de cupo con su texto; o { label } solo texto; opcional
 *   status      - nodo (Badge) junto al llamado a la acción; opcional
 *   cta         - texto del botón visual de abajo; opcional
 *   gradient    - 'torneos' (default) | 'reservas' | 'clases' | 'ludoteca' | 'sanciones'
 *   as          - 'button' (default) | 'div'
 *   className   - clase extra; opcional
 *   ...rest     - atributos de la etiqueta (onClick, aria-*, etc.)
 */
export function EventCard({
  title, kicker, icon, photo, day, month, description, chips, progress, status, cta,
  gradient = 'torneos', as: Tag = 'button', className, ...rest
}) {
  const g = GRADIENTES.includes(gradient) ? gradient : 'torneos';
  const [fotoRota, setFotoRota] = React.useState(false);
  const conFoto = Boolean(photo) && !fotoRota;
  const classes = ['ui-event-card', `ui-event-card--${g}`, Tag !== 'button' && 'ui-event-card--static', conFoto && 'ui-event-card--photo', className]
    .filter(Boolean).join(' ');
  const extra = Tag === 'button' ? { type: 'button' } : {};
  return (
    <Tag className={classes} {...extra} {...rest}>
      {conFoto && <img className="ui-event-card__photo" src={photo} alt="" loading="lazy" draggable={false} onError={() => setFotoRota(true)} />}
      {icon && !conFoto && <span className="ui-event-card__icon" aria-hidden="true">{icon}</span>}
      <span className="ui-event-card__top">
        {kicker ? <span className="ui-event-card__pill">{kicker}</span> : <span />}
        {day && (
          <span className="ui-event-card__date" aria-hidden="true">
            <strong>{day}</strong>
            <span>{month}</span>
          </span>
        )}
      </span>
      <span className="ui-event-card__body">
        <span className="ui-event-card__title">{title}</span>
        {description && <span className="ui-event-card__detail">{description}</span>}
        {chips && chips.length > 0 && (
          <span className="ui-event-card__chips">
            {chips.map((c) => <span key={c} className="ui-event-card__chip">{c}</span>)}
          </span>
        )}
        {progress && (
          <span className="ui-event-card__progress">
            {progress.max
              ? <ProgressBar value={progress.value} max={progress.max} label={progress.label} />
              : <span className="ui-event-card__progress-label">{progress.label}</span>}
          </span>
        )}
        {(status || cta) && (
          <span className="ui-event-card__foot">
            {status}
            {cta && <span className="ui-event-card__cta">{cta} <span aria-hidden="true">→</span></span>}
          </span>
        )}
      </span>
    </Tag>
  );
}

export default EventCard;
