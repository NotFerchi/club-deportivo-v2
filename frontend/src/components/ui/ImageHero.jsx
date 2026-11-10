import React from 'react';
import './ImageHero.css';

/**
 * ImageHero - encabezado con foto, velo navy y texto blanco (Stitch: socio/reservar).
 *
 *   <ImageHero image={fotoPadel} eyebrow="Reservar · Hoy, mar 10 nov" title="Pádel">
 *     <Clock size={14} /> 6:00 – 22:30 · Máx. 2 h por socio
 *   </ImageHero>
 *   <ImageHero size="sm" image={fotoPadel} eyebrow="Cancha seleccionada" title="Pádel · Cancha 2" />
 *
 * Sin `image` se usa el fondo navy de la marca. La foto es decorativa (alt="").
 *
 * Props:
 *   image     - URL de la foto (importada con Vite); opcional
 *   eyebrow   - texto corto en mayúsculas sobre el título; opcional
 *   title     - título grande
 *   size      - 'lg' (default, encabezado de pantalla) | 'sm' (tarjeta dentro de un modal)
 *   as        - etiqueta del título (default 'h1' en lg, 'p' en sm)
 *   children  - línea de datos dentro de una pastilla de vidrio oscuro; opcional
 *   className - clase extra; opcional
 */
export function ImageHero({ image, eyebrow, title, size = 'lg', as, children, className }) {
  const Title = as || (size === 'sm' ? 'p' : 'h1');
  const classes = ['ui-hero', `ui-hero--${size === 'sm' ? 'sm' : 'lg'}`, className].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {image && <img className="ui-hero__photo" src={image} alt="" />}
      <div className="ui-hero__content">
        {eyebrow && (
          <span className="ui-hero__eyebrow">
            <span className="ui-hero__dot" aria-hidden="true" />
            {eyebrow}
          </span>
        )}
        <Title className="ui-hero__title">{title}</Title>
        {children && <span className="ui-hero__meta">{children}</span>}
      </div>
    </section>
  );
}

export default ImageHero;
