import React, { useEffect, useRef } from 'react';
import './FocusList.css';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Rótulo dentro de una FocusList (p. ej. "NOVIEMBRE 2026"); no se selecciona. */
export function FocusListLabel({ children }) {
  return children;
}

/**
 * FocusList - lista con scroll y "enfoque": el elemento que queda en el centro se ve al 100 % y los
 * de los lados se achican y se atenúan poco a poco mientras se desliza.
 *
 *   // Vertical (lista del personal), con selección
 *   <FocusList orientation="vertical" ariaLabel="Torneos" activeKey={id} onActivate={setId}>
 *     <FocusListLabel key="m-2026-11">Noviembre 2026</FocusListLabel>
 *     {torneos.map((t) => <EventRow key={t.torneo_id} ... />)}
 *   </FocusList>
 *
 *   // Horizontal (carrusel), misma API que el FocusList del PR #39
 *   <FocusList ariaLabel="Torneos">{tarjetas}</FocusList>
 *
 * Cómo funciona: un listener de scroll `passive` pide un solo requestAnimationFrame por cuadro; en
 * él se mide la distancia de cada elemento al punto de enfoque y solo se escribe la variable CSS
 * `--focus` (0 a 1). El CSS calcula `transform: scale()` y `opacity`: no se anima ancho ni alto y
 * no hay relayout. Con "reducir movimiento" no hay escalado.
 *
 * Vertical: sin espacios vacíos arriba ni abajo. El punto de enfoque acompaña al scroll: arriba del
 * todo está en el primer elemento, a la mitad del recorrido en el centro y al final en el último.
 * Si todo cabe, no hay escalado.
 * Al hacer clic o enfocar con el teclado un elemento, la lista lo centra (solo la lista, no la
 * página) y llama a `onActivate(key)`.
 *
 * Props:
 *   orientation - 'horizontal' (default, carrusel con scroll-snap) | 'vertical'
 *   ariaLabel   - nombre accesible de la lista
 *   activeKey   - key del elemento seleccionado (se marca con aria-current y se centra al cambiar)
 *   onActivate  - (key) => void al hacer clic o enfocar un elemento; opcional
 *   centered    - horizontal: centra el carrusel a la mitad del alto de la pantalla
 *   className   - clase extra; opcional
 *   children    - los elementos (con key); cada uno se envuelve en un <li>
 */
export function FocusList({
  orientation = 'horizontal',
  ariaLabel,
  activeKey,
  onActivate,
  centered = false,
  className,
  children
}) {
  const listRef = useRef(null);
  const vertical = orientation === 'vertical';

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const pintar = () => {
      const lis = Array.from(list.children);
      if (reduce?.matches) {
        lis.forEach((li) => li.style.setProperty('--focus', '1'));
        return;
      }
      const caja = list.getBoundingClientRect();
      if (!vertical) {
        const centro = caja.left + caja.width / 2;
        lis.forEach((li) => {
          const r = li.getBoundingClientRect();
          const f = clamp(1 - Math.abs(r.left + r.width / 2 - centro) / r.width, 0, 1);
          li.style.setProperty('--focus', f.toFixed(3));
        });
        return;
      }
      if (!list.hasAttribute('data-scroll')) {
        // Todo cabe: no hay nada que enfocar
        lis.forEach((li) => li.style.setProperty('--focus', '1'));
        return;
      }
      // Punto de enfoque: baja con el scroll, del centro del primer elemento (arriba del todo) al del
      // último (al final), pasando por el centro a la mitad. El más cercano queda en 1 y los demás bajan
      // según su distancia (a media altura del contenedor ya están en 0). Los rótulos no cuentan.
      const mitad = caja.height / 2;
      const recorrido = list.scrollHeight - list.clientHeight;
      const avance = recorrido > 0 ? clamp(list.scrollTop / recorrido, 0, 1) : 0.5;
      const items = lis.filter((li) => li.classList.contains('ui-focus-list__item'));
      const alto = items.length ? items[0].offsetHeight : 0;
      const centro = caja.top + alto / 2 + avance * (caja.height - alto);
      const distancias = lis.map((li) => {
        const r = li.getBoundingClientRect();
        return Math.abs(r.top + r.height / 2 - centro);
      });
      const deItems = distancias.filter((_, i) => lis[i].classList.contains('ui-focus-list__item'));
      const minima = Math.min(...(deItems.length ? deItems : distancias));
      lis.forEach((li, i) => {
        const f = clamp(1 - (distancias[i] - minima) / mitad, 0, 1);
        li.style.setProperty('--focus', f.toFixed(3));
      });
    };

    // Vertical: marca si el contenido no cabe (entonces hay scroll y enfoque).
    // Solo se mide al montar, al cambiar los hijos o el tamaño; nunca en cada scroll.
    const medir = () => {
      if (!vertical) return;
      const lis = list.children;
      if (!lis.length) return;
      const primero = lis[0];
      const ultimo = lis[lis.length - 1];
      const contenido = ultimo.offsetTop + ultimo.offsetHeight - primero.offsetTop;
      const conScroll = list.hasAttribute('data-scroll');
      const limite = conScroll ? list.clientHeight : parseFloat(getComputedStyle(list).maxHeight) || Infinity;
      // Atributo (no clase): React no lo toca al volver a dibujar la lista
      list.toggleAttribute('data-scroll', contenido > limite - 16);
    };

    const pedir = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        pintar();
      });
    };

    list.addEventListener('scroll', pedir, { passive: true });
    const alCambiar = () => {
      medir();
      pedir();
    };
    window.addEventListener('resize', alCambiar);
    reduce?.addEventListener?.('change', pedir);
    const obs = new MutationObserver(alCambiar);
    obs.observe(list, { childList: true });
    if (!vertical) list.scrollLeft = 0;
    medir();
    pintar();

    return () => {
      list.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', alCambiar);
      reduce?.removeEventListener?.('change', pedir);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [vertical]);

  // Centra un elemento moviendo solo el scroll de la lista (scrollIntoView movería también la página)
  const centrar = (li, suave) => {
    const list = listRef.current;
    if (!list || !li) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior = suave && !reduce ? 'smooth' : 'auto';
    if (vertical) list.scrollTo({ top: li.offsetTop - (list.clientHeight - li.offsetHeight) / 2, behavior });
    else list.scrollTo({ left: li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2, behavior });
  };

  // Cuando cambia la selección desde fuera (p. ej. la inicial), la lista la centra
  useEffect(() => {
    if (activeKey == null || !listRef.current) return;
    const li = listRef.current.querySelector(`:scope > [data-focus-key="${CSS.escape(String(activeKey))}"]`);
    if (li && !li.contains(document.activeElement)) centrar(li, false);
    // centrar solo depende de refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const items = React.Children.toArray(children).filter(Boolean);
  const classes = [
    'ui-focus-list',
    vertical ? 'ui-focus-list--vertical' : 'ui-focus-list--horizontal',
    centered && !vertical && 'ui-focus-list--centered',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ul ref={listRef} className={classes} aria-label={ariaLabel} tabIndex={vertical ? undefined : 0}>
      {items.map((child) => {
        if (child.type === FocusListLabel) {
          return (
            <li key={child.key} className="ui-focus-list__label">
              {child.props.children}
            </li>
          );
        }
        // Children.toArray antepone ".$" a las keys: se recupera la original para onActivate
        const key = String(child.key).replace(/^\.\$/, '');
        const activo = activeKey != null && String(activeKey) === key;
        return (
          <li
            key={child.key}
            data-focus-key={key}
            className={['ui-focus-list__item', activo && 'is-active'].filter(Boolean).join(' ')}
            aria-current={activo ? 'true' : undefined}
            onFocus={(e) => {
              centrar(e.currentTarget, true);
              if (onActivate && !activo) onActivate(key);
            }}
          >
            {child}
          </li>
        );
      })}
    </ul>
  );
}

export default FocusList;
