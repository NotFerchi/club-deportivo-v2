import React, { useEffect, useRef } from 'react';
import './FocusList.css';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Rótulo dentro de una FocusList vertical (p. ej. "NOVIEMBRE 2026"); no se selecciona. */
export function FocusListLabel({ children }) {
  return children;
}

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
 * Vertical (lista de torneos del personal, U4-03): `orientation="vertical"`. Lista con scroll propio
 * en la que el elemento enfocado se ve al 100 % y los demás se achican y atenúan poco a poco. Aquí el
 * JS solo escribe la variable `--focus` (0 a 1) en cada <li> y el CSS calcula escala y opacidad. El
 * punto de enfoque acompaña al scroll (arriba del todo en el primer elemento, a la mitad en el
 * centro, al final en el último), sin espacios vacíos. Admite rótulos (FocusListLabel), una
 * selección (`activeKey`, marcada con aria-current y centrada al cambiar) y `onActivate` al hacer
 * clic o enfocar un elemento. Si todo cabe, no hay escalado.
 *
 * Props:
 *   ariaLabel   - nombre accesible del carrusel
 *   centered    - true centra el carrusel a la mitad del alto de la pantalla (útil con pocas tarjetas)
 *   orientation - 'horizontal' (default, carrusel del socio) | 'vertical'
 *   activeKey   - vertical: key del elemento seleccionado
 *   onActivate  - vertical: (key) => void al hacer clic o enfocar un elemento; opcional
 *   className   - clase extra; opcional
 *   children    - los elementos; cada uno se envuelve en un <li>
 */
export function FocusList({ ariaLabel, className, centered = false, orientation = 'horizontal', activeKey, onActivate, children }) {
  if (orientation === 'vertical') {
    return (
      <FocusListVertical ariaLabel={ariaLabel} className={className} activeKey={activeKey} onActivate={onActivate}>
        {children}
      </FocusListVertical>
    );
  }
  return (
    <FocusListHorizontal ariaLabel={ariaLabel} className={className} centered={centered}>
      {children}
    </FocusListHorizontal>
  );
}

/* ── Horizontal: el carrusel del socio (PR #39), sin cambios ─────────────────────────────── */
function FocusListHorizontal({ ariaLabel, className, centered = false, children }) {
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

/* ── Vertical: lista de torneos del personal (U4-03) ────────────────────────────────────── */
function FocusListVertical({ ariaLabel, className, activeKey, onActivate, children }) {
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const pintar = () => {
      const lis = Array.from(list.children);
      if (reduce?.matches || !list.hasAttribute('data-scroll')) {
        // Sin movimiento o todo cabe: no hay nada que enfocar
        lis.forEach((li) => li.style.setProperty('--focus', '1'));
        return;
      }
      // Punto de enfoque: baja con el scroll, del centro del primer elemento (arriba del todo) al del
      // último (al final), pasando por el centro a la mitad. El más cercano queda en 1 y los demás bajan
      // según su distancia (a media altura del contenedor ya están en 0). Los rótulos no cuentan.
      const caja = list.getBoundingClientRect();
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

    // Marca si el contenido no cabe (entonces hay scroll y enfoque). Solo al montar, al cambiar los
    // hijos o el tamaño; nunca en cada scroll.
    const medir = () => {
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
    medir();
    pintar();

    return () => {
      list.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', alCambiar);
      reduce?.removeEventListener?.('change', pedir);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Centra un elemento moviendo solo el scroll de la lista (scrollIntoView movería también la página)
  const centrar = (li, suave) => {
    const list = listRef.current;
    if (!list || !li) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ top: li.offsetTop - (list.clientHeight - li.offsetHeight) / 2, behavior: suave && !reduce ? 'smooth' : 'auto' });
  };

  // Cuando cambia la selección desde fuera (p. ej. la inicial), la lista la centra
  useEffect(() => {
    if (activeKey == null || !listRef.current) return;
    const li = listRef.current.querySelector(`:scope > [data-focus-key="${CSS.escape(String(activeKey))}"]`);
    if (li && !li.contains(document.activeElement)) centrar(li, false);
    // centrar solo depende de refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  const classes = ['ui-focus-list', 'ui-focus-list--vertical', className].filter(Boolean).join(' ');

  return (
    <ul ref={listRef} className={classes} aria-label={ariaLabel}>
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((child) => {
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
