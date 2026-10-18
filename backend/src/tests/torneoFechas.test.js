'use strict';

/** Reglas del periodo de inscripción (F-07): funciones puras de services/torneoFechas.js. */

const { hoyEnClub, enPeriodoInscripcion, validarFechasInscripcion } = require('../services/torneoFechas');

describe('hoyEnClub: fecha en America/Mexico_City', () => {
  it.each([
    ['2026-10-19T03:00:00Z', '2026-10-18'], // 21:00 del 18 en México, ya 19 en UTC
    ['2026-10-19T05:59:59Z', '2026-10-18'],
    ['2026-10-19T06:00:00Z', '2026-10-19'], // medianoche en México (UTC-6, sin horario de verano)
    ['2026-01-01T05:00:00Z', '2025-12-31']
  ])('%s → %s', (instante, esperado) => {
    expect(hoyEnClub(new Date(instante))).toBe(esperado);
  });
});

describe('enPeriodoInscripcion', () => {
  const HOY = '2026-10-18';
  const en = (torneo) => enPeriodoInscripcion(torneo, HOY);

  it('periodo explícito: inclusivo en los dos extremos', () => {
    const periodo = { fecha_inicio_inscripcion: '2026-10-10', fecha_fin_inscripcion: '2026-10-18' };
    expect(en(periodo)).toBe(true);
    expect(en({ ...periodo, fecha_inicio_inscripcion: '2026-10-18' })).toBe(true);
    expect(en({ ...periodo, fecha_inicio_inscripcion: '2026-10-19' })).toBe(false); // aún no abre
    expect(en({ ...periodo, fecha_fin_inscripcion: '2026-10-17' })).toBe(false); // ya cerró
  });

  it('el fin de inscripción explícito manda sobre fecha_inicio del torneo', () => {
    expect(en({ fecha_inicio: '2026-10-18', fecha_fin_inscripcion: '2026-10-18' })).toBe(true);
  });

  it('sin fin de inscripción: cierra al llegar fecha_inicio (se inscribe hasta el día anterior)', () => {
    expect(en({ fecha_inicio: '2026-10-19' })).toBe(true);
    expect(en({ fecha_inicio: '2026-10-18' })).toBe(false);
    expect(en({ fecha_inicio: '2026-10-01' })).toBe(false);
    expect(en({ fecha_inicio: '2026-10-19', fecha_inicio_inscripcion: '2026-10-19' })).toBe(false);
  });

  it('sin ninguna fecha (o con NULL): sin límite', () => {
    expect(en({})).toBe(true);
    expect(en({ fecha_inicio: null, fecha_inicio_inscripcion: null, fecha_fin_inscripcion: null })).toBe(true);
  });
});

describe('validarFechasInscripcion', () => {
  it('fechas válidas o ausentes → null', () => {
    expect(
      validarFechasInscripcion({
        fecha_inicio: '2026-11-07',
        fecha_inicio_inscripcion: '2026-10-20',
        fecha_fin_inscripcion: '2026-11-06'
      })
    ).toBeNull();
    // Igual a fecha_inicio: permitido (solo "después" del inicio es error)
    expect(validarFechasInscripcion({ fecha_inicio: '2026-11-07', fecha_fin_inscripcion: '2026-11-07' })).toBeNull();
    expect(validarFechasInscripcion({})).toBeNull();
    expect(validarFechasInscripcion({ fecha_inicio_inscripcion: '2026-12-01' })).toBeNull(); // sin fecha_inicio
  });

  it('fin de inscripción antes del inicio de inscripción', () => {
    expect(
      validarFechasInscripcion({ fecha_inicio_inscripcion: '2026-11-05', fecha_fin_inscripcion: '2026-11-01' })
    ).toBe('fecha_fin_inscripcion (2026-11-01) no puede ser anterior a fecha_inicio_inscripcion (2026-11-05)');
  });

  it('fin de inscripción después del inicio del torneo', () => {
    expect(validarFechasInscripcion({ fecha_inicio: '2026-11-07', fecha_fin_inscripcion: '2026-11-08' })).toBe(
      'fecha_fin_inscripcion (2026-11-08) no puede ser posterior a fecha_inicio del torneo (2026-11-07)'
    );
  });

  it('inicio de inscripción después del inicio del torneo', () => {
    expect(validarFechasInscripcion({ fecha_inicio: '2026-11-07', fecha_inicio_inscripcion: '2026-11-08' })).toBe(
      'fecha_inicio_inscripcion (2026-11-08) no puede ser posterior a fecha_inicio del torneo (2026-11-07)'
    );
  });

  it('formatos que no son YYYY-MM-DD no se comparan (los rechaza la ruta o PostgreSQL)', () => {
    expect(validarFechasInscripcion({ fecha_inicio_inscripcion: '05/11/2026', fecha_fin_inscripcion: '2026-01-01' })).toBeNull();
  });
});
