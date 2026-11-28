import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { ImageHero } from '../ImageHero';
import { HeroCard } from '../HeroCard';

/**
 * COORD-03 (U5-05): ImageHero y HeroCard compartían las clases .ui-hero*; como ImageHero.css se carga
 * después, su `display: flex` le ganaba a la rejilla de HeroCard y el título del torneo quedaba vertical
 * en celular. Cada componente debe usar su propio prefijo.
 */

// Vitest corre desde frontend/ (en jsdom, import.meta.url no siempre es file:)
const css = (archivo) => readFileSync(resolve(process.cwd(), 'src/components/ui', archivo), 'utf8');
// Selectores de clase de una hoja de estilo, sin contar los comentarios
const clasesDe = (texto) =>
  new Set(texto.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.ui-[a-z-]+(?:__[a-z-]+)?(?:--[a-z-]+)?/g));

describe('clases de ImageHero y HeroCard', () => {
  it('ImageHero solo usa clases ui-image-hero*', () => {
    const { container } = render(
      <ImageHero eyebrow="Reservar" title="Pádel">
        6:00 – 22:30
      </ImageHero>
    );
    const clases = [...container.querySelectorAll('[class]')].flatMap((el) => [...el.classList]);
    expect(clases.length).toBeGreaterThan(0);
    expect(clases.every((c) => c.startsWith('ui-image-hero'))).toBe(true);
  });

  it('HeroCard usa ui-hero* y ninguna clase de ImageHero', () => {
    const { container } = render(<HeroCard eyebrow="Temporada 2026" title="Copa" subtitle="Tenis" />);
    const clases = [...container.querySelectorAll('[class]')].flatMap((el) => [...el.classList]);
    expect(clases).toContain('ui-hero');
    expect(clases.some((c) => c.startsWith('ui-image-hero'))).toBe(false);
  });

  it('las hojas de estilo no comparten selectores', () => {
    const imageHero = clasesDe(css('ImageHero.css'));
    const heroCard = clasesDe(css('HeroCard.css'));
    expect([...imageHero].filter((c) => heroCard.has(c))).toEqual([]);
  });
});
