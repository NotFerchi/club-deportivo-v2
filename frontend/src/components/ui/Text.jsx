import React from 'react';
import './Text.css';

// variante → etiqueta HTML por defecto
const VARIANTS = {
  title: 'h1',
  heading: 'h2',
  subheading: 'h3',
  body: 'p',
  small: 'p',
  caption: 'span',
  overline: 'span',
};

/**
 * Text - texto con la tipografía del kit (títulos, cuerpo, apoyo).
 *
 *   <Text variant="title">Torneos</Text>
 *   <Text variant="body" muted>Participa en los eventos deportivos del club.</Text>
 *   <Text variant="caption" as="span">Inicio</Text>
 *
 * Props:
 *   variant   - 'body' (default) | 'title' | 'heading' | 'subheading' | 'small' | 'caption' | 'overline'
 *   muted     - usa el color de texto secundario
 *   as        - etiqueta HTML; por defecto la que corresponde a la variante
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo (id, role, aria-*, etc.)
 */
export function Text({ variant = 'body', muted = false, as, className, children, ...rest }) {
  const safeVariant = Object.hasOwn(VARIANTS, variant) ? variant : 'body';
  const Tag = as || VARIANTS[safeVariant];
  const classes = [
    'ui-text',
    `ui-text--${safeVariant}`,
    muted && 'ui-text--muted',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

export default Text;
