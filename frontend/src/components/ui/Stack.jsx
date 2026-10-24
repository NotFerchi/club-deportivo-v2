import React from 'react';
import './Stack.css';

const GAPS = [0, 4, 8, 12, 16, 24, 32];
const PADDINGS = [0, 8, 16, 24, 32];
const ALIGN = ['start', 'center', 'end', 'stretch'];
const JUSTIFY = ['start', 'center', 'end', 'between'];

/**
 * Stack - acomoda sus hijos en columna o en fila con separación del kit.
 * Reemplaza los `display: flex` y `gap` sueltos en las pantallas.
 *
 *   <Stack gap={16}>
 *     <Input label="Nombre" />
 *     <Stack direction="row" gap={8} wrap justify="end">
 *       <Button variant="secondary">Cancelar</Button>
 *       <Button>Guardar</Button>
 *     </Stack>
 *   </Stack>
 *
 * En fila con `wrap`, los hijos bajan a la siguiente línea en pantallas pequeñas.
 * Con `grow` cada hijo ocupa al menos `minChild` px y se reparte el ancho sobrante
 * (útil para filtros y campos de formulario que deben apilarse en el móvil).
 *
 * Props:
 *   direction - 'column' (default) | 'row'
 *   gap       - 0 | 4 | 8 | 12 | 16 (default) | 24 | 32  (tokens --space-*)
 *   wrap      - permite que los hijos pasen a otra línea (solo en fila)
 *   align     - 'stretch' (default) | 'start' | 'center' | 'end'
 *   justify   - 'start' (default) | 'center' | 'end' | 'between'
 *   padding   - 0 (default) | 8 | 16 | 24 | 32: margen interior en todos los lados (tokens --space-*)
 *   grow      - en fila, cada hijo crece para llenar la línea
 *   minChild  - ancho mínimo en px de cada hijo cuando se usa `grow` (default 200)
 *   as        - etiqueta HTML (default 'div')
 *   className - clase extra; opcional
 *   ...rest   - cualquier otro atributo (role, aria-*, etc.)
 */
export function Stack({
  direction = 'column',
  gap = 16,
  wrap = false,
  align = 'stretch',
  justify = 'start',
  padding = 0,
  grow = false,
  minChild = 200,
  as: Tag = 'div',
  className,
  children,
  ...rest
}) {
  const safeGap = GAPS.includes(gap) ? gap : 16;
  const safeAlign = ALIGN.includes(align) ? align : 'stretch';
  const safePadding = PADDINGS.includes(padding) ? padding : 0;
  const safeJustify = JUSTIFY.includes(justify) ? justify : 'start';

  const classes = [
    'ui-stack',
    direction === 'row' ? 'ui-stack--row' : 'ui-stack--column',
    `ui-stack--gap-${safeGap}`,
    `ui-stack--align-${safeAlign}`,
    `ui-stack--justify-${safeJustify}`,
    safePadding > 0 && `ui-stack--pad-${safePadding}`,
    wrap && 'ui-stack--wrap',
    grow && 'ui-stack--grow',
    className,
  ].filter(Boolean).join(' ');

  // minChild es la única medida dinámica; viaja como variable CSS, no como estilo suelto.
  const inlineStyle = grow ? { '--ui-stack-min-child': `${Number(minChild) || 200}px` } : undefined;

  return (
    <Tag {...rest} className={classes} style={inlineStyle}>
      {children}
    </Tag>
  );
}

export default Stack;
