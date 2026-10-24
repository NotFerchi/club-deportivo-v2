import React, { useState } from 'react';
import './Avatar.css';

const SIZES = ['sm', 'md', 'lg'];

/** "Carlos López Ruiz" → "CL". Sin nombre → "?". */
function iniciales(nombre) {
  const letras = String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]);
  return letras.length ? letras.join('').toUpperCase() : '?';
}

/**
 * Avatar - foto de una persona o, si no hay foto (o no carga), sus iniciales.
 *
 *   <Avatar name="Carlos López" src={inst.foto_perfil} />
 *   <Avatar name="Ana" size="lg" />
 *
 * Props:
 *   name      - nombre de la persona; da las iniciales y el texto alternativo de la foto
 *   src       - URL de la foto; opcional
 *   size      - 'md' (default) | 'sm' | 'lg'
 *   className - clase extra; opcional
 */
export function Avatar({ name, src, size = 'md', className }) {
  const [fallo, setFallo] = useState(false);
  const safeSize = SIZES.includes(size) ? size : 'md';
  const classes = ['ui-avatar', `ui-avatar--${safeSize}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {src && !fallo
        ? <img className="ui-avatar__img" src={src} alt={name ? `Foto de ${name}` : ''} onError={() => setFallo(true)} />
        : <span aria-hidden={name ? 'true' : undefined}>{iniciales(name)}</span>}
    </span>
  );
}

export default Avatar;
