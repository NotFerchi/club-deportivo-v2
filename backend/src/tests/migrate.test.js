'use strict';

/**
 * migrate.js: sin argumento no ejecuta nada; solo --todas corre todas las migraciones.
 * Ningún test se conecta a una base: los procesos hijos corren fuera de backend/ (sin .env)
 * y con una DATABASE_URL a un puerto cerrado.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { planMigraciones, OPCION_TODAS } = require('../config/migrate');
const MIGRACIONES_TORNEOS = require('../config/migracionesTorneos');

const SCRIPT = path.join(__dirname, '../config/migrate.js');

describe('planMigraciones', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migraciones-'));
    for (const f of ['b.sql', 'a.sql', 'schema.sql', 'notas.txt', MIGRACIONES_TORNEOS[0]]) {
      fs.writeFileSync(path.join(dir, f), '');
    }
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it.each([undefined, ''])('sin argumento (%p) → null: no se ejecuta nada', (objetivo) => {
    expect(planMigraciones(objetivo, dir)).toBeNull();
  });

  it('--todas → .sql en orden alfabético y, al final, las de torneos en su orden', () => {
    expect(planMigraciones(OPCION_TODAS, dir)).toEqual(['a.sql', 'b.sql', 'schema.sql', ...MIGRACIONES_TORNEOS]);
  });

  it('torneos → solo las de torneos', () => {
    expect(planMigraciones('torneos', dir)).toEqual(MIGRACIONES_TORNEOS);
  });

  it('un archivo existente → solo ese', () => {
    expect(planMigraciones('b.sql', dir)).toEqual(['b.sql']);
  });

  it.each(['no-existe.sql', '--todo', 'todas'])('%p no existe → error, nada que ejecutar', (objetivo) => {
    expect(() => planMigraciones(objetivo, dir)).toThrow(`Archivo no encontrado: ${path.join(dir, objetivo)}`);
  });
});

describe('migrate.js como proceso', () => {
  const correr = (...args) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd: os.tmpdir(),
      env: { ...process.env, DATABASE_URL: 'postgres://nadie@127.0.0.1:1/nada', NEON_DATABASE_URL: '' },
      encoding: 'utf8',
      timeout: 15000
    });

  it('sin argumento: muestra el uso, sale con 1 y no ejecuta ninguna migración', () => {
    const r = correr();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Uso (desde backend/):');
    expect(r.stderr).toContain('npm run migrate -- --todas');
    expect(r.stdout + r.stderr).not.toContain('Ejecutando migración');
  });

  it('argumento mal escrito (--todo): archivo no encontrado, sale con 1 sin ejecutar nada', () => {
    const r = correr('--todo');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Archivo no encontrado');
    expect(r.stdout + r.stderr).not.toContain('Ejecutando migración');
  });
});
