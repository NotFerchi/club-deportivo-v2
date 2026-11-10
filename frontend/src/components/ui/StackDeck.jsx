import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './StackDeck.css';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const UMBRAL_ARRASTRE = 0.25; // fracción del ancho para pasar de tarjeta al soltar
const UMBRAL_VELOCIDAD = 0.5; // px/ms: un movimiento rápido también pasa aunque sea corto
const UMBRAL_INICIO = 6; // px antes de decidir si el gesto es horizontal (mazo) o vertical (página)
const UMBRAL_RUEDA = 30; // deltaX acumulado de rueda/trackpad para dar un paso
const PAUSA_RUEDA = 200; // ms sin eventos de rueda para que el siguiente gesto vuelva a contar

const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * StackDeck - mazo de tarjetas apiladas: la activa al frente y las 2 siguientes se asoman detrás,
 * a la derecha, más chicas y atenuadas. Las anteriores no se ven. Se pasa de una a otra SOLO
 * deslizando: dedo, arrastre con mouse, rueda/trackpad horizontal o flechas ← → del teclado.
 * Es circular: después de la última viene otra vez la primera (y antes de la primera, la última).
 *
 *   <StackDeck ariaLabel="Torneos del club">
 *     {torneos.map((t) => <EventCard key={t.torneo_id} ... />)}
 *   </StackDeck>
 *
 * Cómo funciona: el JS solo escribe dos variables CSS con setProperty:
 *   --pos  en cada <li>: su lugar en el mazo contando desde la activa, dando la vuelta
 *          (0 = activa, 1 y 2 = detrás; con 4 o más, la anterior va en -1, lista para volver)
 *   --drag en el mazo: cuánto se ha arrastrado, en fracción del ancho (-1 a 1)
 * y StackDeck.css calcula con ellas la posición, escala, opacidad y orden. Al cambiar los hijos
 * (p. ej. un filtro) el mazo vuelve a la primera tarjeta. Un arrastre no cuenta como clic, así que
 * tocar la tarjeta sin deslizar sigue haciendo lo mismo que antes (su onClick). Con "reducir
 * movimiento" el cambio es directo, sin animación ni seguimiento del dedo.
 *
 * Accesibilidad: la tarjeta activa es la única enfocable; las de atrás llevan aria-hidden e inert.
 * Una región aria-live anuncia "2 de 5" al cambiar.
 *
 * Props:
 *   ariaLabel - nombre accesible del mazo
 *   className - clase extra; opcional
 *   children  - las tarjetas (con key); cada una se envuelve en un <li>
 */
export function StackDeck({ ariaLabel, className, children }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const total = items.length;
  const firma = items.map((c) => c.key).join('|');

  const [activo, setActivo] = useState(0);
  const [firmaPrevia, setFirmaPrevia] = useState(firma);
  // Cambió la lista (filtro, recarga): vuelve a la primera tarjeta
  if (firma !== firmaPrevia) {
    setFirmaPrevia(firma);
    setActivo(0);
  }
  const actual = clamp(activo, 0, Math.max(total - 1, 0));

  const rootRef = useRef(null);
  const listRef = useRef(null);
  const gesto = useRef(null); // { id, x, y, t, arrastrando, frac }
  const anularClic = useRef(false);
  const enfocar = useRef(false);
  const estado = useRef({ actual, total });

  // Paso de tarjeta (+1 siguiente, -1 anterior), dando la vuelta en los extremos. Si el foco estaba
  // en el mazo, se pasa a la nueva.
  const pasar = (dir) => {
    const { actual: a, total: n } = estado.current;
    if (n < 2) return;
    const destino = (a + dir + n) % n;
    enfocar.current = Boolean(rootRef.current?.contains(document.activeElement));
    setActivo(destino);
  };
  const pasarRef = useRef(pasar);

  // Escribe --pos en cada <li> antes de pintar; mueve el foco a la activa si hace falta
  useLayoutEffect(() => {
    estado.current = { actual, total };
    pasarRef.current = pasar;
    const list = listRef.current;
    if (!list) return;
    const n = list.children.length;
    Array.from(list.children).forEach((li, i) => {
      const lugar = (i - actual + n) % n;
      // Con 4 o más, la anterior espera a la izquierda (-1) para entrar al deslizar hacia atrás;
      // con menos se queda detrás, para que siempre se asomen hasta 2.
      li.style.setProperty('--pos', String(n >= 4 && lugar === n - 1 ? -1 : lugar));
    });
    if (enfocar.current) {
      enfocar.current = false;
      const li = list.children[actual];
      const destino = li?.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || li;
      destino?.focus({ preventScroll: true });
    }
  });

  // Rueda / trackpad horizontal (listener nativo: hay que poder cancelar el "atrás" del navegador)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let acumulado = 0;
    let bloqueado = false;
    let timer = 0;
    const alRodar = (e) => {
      if (estado.current.total < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      clearTimeout(timer);
      // Un gesto (con su inercia) da un solo paso: se desbloquea al dejar de llegar eventos
      timer = setTimeout(() => { bloqueado = false; acumulado = 0; }, PAUSA_RUEDA);
      if (bloqueado) return;
      acumulado += e.deltaX;
      if (Math.abs(acumulado) >= UMBRAL_RUEDA) {
        bloqueado = true;
        pasarRef.current(acumulado > 0 ? 1 : -1);
        acumulado = 0;
      }
    };
    root.addEventListener('wheel', alRodar, { passive: false });
    return () => {
      root.removeEventListener('wheel', alRodar);
      clearTimeout(timer);
    };
  }, []);

  const escribirDrag = (frac) => rootRef.current?.style.setProperty('--drag', frac.toFixed(4));

  const terminar = () => {
    const root = rootRef.current;
    root?.removeAttribute('data-dragging');
    escribirDrag(0);
    gesto.current = null;
  };

  const alBajar = (e) => {
    anularClic.current = false; // cada gesto empieza limpio (por si el clic anterior nunca llegó)
    if (total < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    gesto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), arrastrando: false, frac: 0 };
  };

  const alMover = (e) => {
    const g = gesto.current;
    const root = rootRef.current;
    if (!g || g.id !== e.pointerId || !root) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.arrastrando) {
      if (Math.abs(dx) < UMBRAL_INICIO && Math.abs(dy) < UMBRAL_INICIO) return;
      if (Math.abs(dy) >= Math.abs(dx)) { gesto.current = null; return; } // es scroll vertical
      g.arrastrando = true;
      root.setPointerCapture?.(e.pointerId);
      root.setAttribute('data-dragging', '');
    }
    const ancho = listRef.current?.clientWidth || root.clientWidth || 1; // ancho del mazo, no de la página
    const frac = clamp(dx / ancho, -1, 1);
    g.frac = frac;
    if (!sinMovimiento()) escribirDrag(frac);
  };

  const alSoltar = (e) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.arrastrando) {
      anularClic.current = true; // el clic que llega tras soltar no abre la tarjeta
      const velocidad = (e.clientX - g.x) / Math.max(performance.now() - g.t, 1);
      if (g.frac <= -UMBRAL_ARRASTRE || velocidad <= -UMBRAL_VELOCIDAD) pasar(1);
      else if (g.frac >= UMBRAL_ARRASTRE || velocidad >= UMBRAL_VELOCIDAD) pasar(-1);
    }
    terminar();
  };

  const alCancelar = () => {
    if (gesto.current) terminar();
  };

  // En táctil el navegador captura el dedo en la tarjeta; al pasarle la captura al mazo, la tarjeta
  // emite lostpointercapture y sube hasta aquí. Solo cuenta si la perdió el propio mazo.
  const alPerderCaptura = (e) => {
    if (e.target === e.currentTarget) alCancelar();
  };

  const alClicCaptura = (e) => {
    if (!anularClic.current) return;
    anularClic.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const alTecla = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); pasar(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pasar(-1); }
  };

  const classes = ['ui-stack-deck', total === 1 && 'ui-stack-deck--single', className].filter(Boolean).join(' ');

  return (
    <div
      ref={rootRef}
      className={classes}
      role="region"
      aria-roledescription="carrusel"
      aria-label={ariaLabel}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alCancelar}
      onLostPointerCapture={alPerderCaptura}
      onClickCapture={alClicCaptura}
      onKeyDown={alTecla}
    >
      <ul ref={listRef} className="ui-stack-deck__list">
        {items.map((child, i) => {
          const esActiva = i === actual;
          return (
            <li
              key={child.key}
              className={['ui-stack-deck__item', esActiva && 'is-active'].filter(Boolean).join(' ')}
              aria-hidden={esActiva ? undefined : 'true'}
              inert={esActiva ? undefined : true}
            >
              {child}
            </li>
          );
        })}
      </ul>
      {total > 1 && (
        <p className="ui-visually-hidden" aria-live="polite" aria-atomic="true">
          {actual + 1} de {total}
        </p>
      )}
    </div>
  );
}

export default StackDeck;
