import React, { useEffect, useRef } from 'react';
import './FocusList.css';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * FocusList - carrusel horizontal con enfoque: la tarjeta que queda en el centro se ve grande y
 * las de los lados se achican y se atenúan mientras deslizas con el dedo. Al soltar, la tarjeta
 * más cercana se acomoda sola en el centro (scroll-snap).
 *
 *   <FocusList ariaLabel="Torneos">
 *     {torneos.map((t) => <EventCard key={t.torneo_id} ... />)}
 *   </FocusList>
 *
 * Cómo funciona: en cada scroll del carrusel (un solo requestAnimationFrame por cuadro) mide
 * qué tan lejos está cada tarjeta del centro y le pone `transform: scale()` y `opacity`.
 * No mueve nada más de la página. Sin librerías. Con "reducir movimiento" activado en el
 * sistema, las tarjetas no cambian de tamaño (el carrusel se sigue deslizando).
 *
 * Props:
 *   ariaLabel - nombre accesible del carrusel
 *   centered  - true centra el carrusel a la mitad del alto de la pantalla (útil con pocas tarjetas)
 *   className - clase extra; opcional
 *   children  - los elementos; cada uno se envuelve en un <li>
 */
export function FocusList({ ariaLabel, className, centered = false, children }) {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const pintar = () => {
      const lis = Array.from(list.children);
      const caja = list.getBoundingClientRect();
      const centro = caja.left + caja.width / 2;
      lis.forEach((li) => {
        if (reduce?.matches) { li.style.transform = ''; li.style.opacity = ''; return; }
        const r = li.getBoundingClientRect();
        const f = clamp(1 - Math.abs(r.left + r.width / 2 - centro) / r.width, 0, 1); // 1 = centrada
        li.style.transform = `scale(${(0.86 + 0.14 * f).toFixed(3)})`;
        li.style.opacity = (0.55 + 0.45 * f).toFixed(3);
      });
    };

    const pedir = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; pintar(); });
    };

    list.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    reduce?.addEventListener?.('change', pedir);
    const obs = new MutationObserver(pedir);
    obs.observe(list, { childList: true });
    list.scrollLeft = 0;
    pintar();

    return () => {
      list.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      reduce?.removeEventListener?.('change', pedir);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const classes = ['ui-focus-list', centered && 'ui-focus-list--centered', className].filter(Boolean).join(' ');
  return (
    <ul ref={listRef} className={classes} aria-label={ariaLabel} tabIndex={0}>
      {React.Children.toArray(children).map((child) => (
        <li key={child.key} className="ui-focus-list__item">{child}</li>
      ))}
    </ul>
  );
}

export default FocusList;
