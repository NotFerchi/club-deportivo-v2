'use strict';

/**
 * Tests de caracterización de /api/reportes (reportesController + exportacionController).
 *
 * Cada reporte se descarga en xlsx y pdf. El xlsx se vuelve a abrir con ExcelJS y se
 * compara con un snapshot su contenido completo (hojas, columnas, celdas, formatos y
 * estilos) además del hash de los bytes; el pdf se compara por hash (fecha fija con
 * fake timers → salida determinista). También se fija la secuencia de consultas.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../utils/mexicoDate', () => ({
  ...jest.requireActual('../utils/mexicoDate'),
  getMexicoDateISO: () => '2026-09-30'
}));
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = { usuario_id: 1, rol: 'admin' };
    next();
  },
  checkRole: () => (req, res, next) => next()
}));

const crypto = require('crypto');
const ExcelJS = require('exceljs');
const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const { recordQueries } = require('./helpers/queryLog');

const app = express();
app.use(express.json());
app.use('/api/reportes', require('../routes/reportes.routes'));
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const d = (iso) => new Date(`${iso}T06:00:00Z`);

let db;
let log;
let consoleSpies;

// ── Datos de prueba ──────────────────────────────────────────────────────────

function fixtures() {
  const detalle = Array.from({ length: 14 }, (_, i) => ({
    sancion_id: 100 + i,
    fecha: d(`2026-09-${String(i + 1).padStart(2, '0')}`),
    origen: i % 2 ? 'Ludoteca' : 'Instalaciones',
    motivo: `Motivo largo de la sancion numero ${i} `.repeat(3),
    nombre_socio: `Socio ${i}`,
    estado: i % 3 ? 'Activa' : 'Resuelta',
    resuelto_por: i % 3 ? null : 'Admin Uno',
    fecha_resolucion: i % 3 ? null : d('2026-09-20')
  }));
  return {
    falla: null,
    asistencia: [{ instructor_id: 1, instructor_nombre: 'Ana', total_clases: '3' }],
    demografico: [
      { rango: '0-12', genero: 'Hombre', total: 3 },
      { rango: '0-12', genero: 'Mujer', total: '2' },
      { rango: '18-30', genero: 'MUJER ', total: 5 },
      { rango: '61+', genero: null, total: 1 },
      { rango: 'otro', genero: 'Hombre', total: 9 }
    ],
    membresias: [
      { tipo: 'Accionista', modalidad: 'Familiar', total: 4, titulares: 1, miembros: 3 },
      { tipo: 'Rentista', modalidad: 'Individual', total: '2', titulares: '2', miembros: '0' },
      { tipo: 'Sin tipo', modalidad: 'Sin modalidad', total: 1, titulares: 0, miembros: 1 }
    ],
    familias: [
      { numero_accion: 'A-1', nombre_titular: 'Familia Uno', total_miembros: '4' },
      { numero_accion: 'SOC-9', nombre_titular: 'Sin titular asignado', total_miembros: 1 }
    ],
    nuevos: [
      { anio_mes: '2026-07', nuevos_en_mes: 2 },
      { anio_mes: '2026-08', nuevos_en_mes: '3' },
      { anio_mes: '2026-09', nuevos_en_mes: null }
    ],
    ocupacion: [
      { espacio: 'Cancha 1', total_reservas: 10, confirmadas: 7, canceladas: 2, no_show: 1 },
      { espacio: 'Alberca', total_reservas: 0, confirmadas: 0, canceladas: 0, no_show: 0 }
    ],
    disciplinas: [
      { disciplina: 'Tenis', total_sesiones: 3, total_asistentes: 10 },
      { disciplina: 'Yoga', total_sesiones: 0, total_asistentes: 0 }
    ],
    instructores: [{ instructor: 'Ana Pérez', disciplina: 'Tenis', total_sesiones: '4', total_asistentes: '9' }],
    espacios: [
      { espacio_id: 1, nombre: 'Cancha 1' },
      { espacio_id: 2, nombre: 'Alberca' }
    ],
    reservas: [
      { espacio_id: 1, fecha_reserva: '2026-09-28', hora_inicio: '06:00:00', hora_fin: '21:00:00', estado: 'Confirmada' },
      { espacio_id: 2, fecha_reserva: d('2026-09-29'), hora_inicio: '07:30', hora_fin: '09:00', estado: 'Confirmada' }
    ],
    sesionesProg: [{ espacio_id: 2, dia_semana: 3, hora_inicio: '06:00:00', hora_fin: '20:00:00' }],
    aflResumen: [
      {
        total_movimientos: 30,
        total_entradas: 20,
        total_salidas: 10,
        entradas_socios: 15,
        entradas_visitas: 5,
        socios_unicos: 8,
        visitas_unicas: 4
      }
    ],
    aflDiaria: [
      { fecha: d('2026-09-28'), dia_numero: 1, total_entradas: 5, entradas_socios: 4, entradas_visitas: 1 },
      { fecha: '2026-09-29', dia_numero: 2, total_entradas: 9, entradas_socios: 6, entradas_visitas: 3 },
      { fecha: d('2026-09-30'), dia_numero: 3, total_entradas: 9, entradas_socios: 9, entradas_visitas: 0 }
    ],
    aflSemana: [
      { dia_numero: 2, total_entradas: 9, entradas_socios: 6, entradas_visitas: 3, dias_considerados: 1, promedio_diario: '9.00' },
      { dia_numero: 7, total_entradas: 0, entradas_socios: 0, entradas_visitas: 0, dias_considerados: 1, promedio_diario: null }
    ],
    aflHoras: Array.from({ length: 12 }, (_, h) => ({
      hora: h + 6,
      total_entradas: 12 - h,
      entradas_socios: 1,
      entradas_visitas: 0
    })),
    aflTop: [{ socio_id: 10, nombre_socio: 'Beto', total_entradas: 7 }],
    sanResumen: [
      {
        total_sanciones: 14,
        activas: 9,
        resueltas: 5,
        ludoteca: 7,
        instalaciones: 7,
        otros: 0,
        promedio_resolucion_dias: '3.456'
      }
    ],
    sanMes: [{ anio_mes: '2026-09', total: 14, de_ludoteca: 7, de_instalaciones: 7, resueltas_en_mes: 5 }],
    sanTop: [
      { numero_socio: 'S-1', nombre_completo: 'Socio 1', total_historico: 3, activas: 1, ultima_sancion: d('2026-09-10') },
      { numero_socio: null, nombre_completo: 'Socio 2', total_historico: 1, activas: 0, ultima_sancion: null }
    ],
    sanDetalle: detalle,
    socios: [
      {
        codigo_accion: 'A-1',
        modalidad: 'Familiar',
        tipo: 'Accionista',
        es_titular: true,
        nombres: 'Ana',
        apellido_paterno: 'Pérez',
        apellido_materno: null,
        genero: 'Mujer',
        fecha_nacimiento: d('1990-05-01'),
        direccion: 'Calle 1',
        username: 'ana@x.com',
        telefono: '555',
        tel_emergencia: null,
        edad: 36
      },
      {
        codigo_accion: 'A-1',
        modalidad: 'Familiar',
        tipo: 'Rentista',
        es_titular: false,
        nombres: 'Beto',
        apellido_paterno: null,
        apellido_materno: 'Ruiz',
        genero: null,
        fecha_nacimiento: '2015-02-03',
        direccion: null,
        username: null,
        telefono: null,
        tel_emergencia: '777',
        edad: 0
      }
    ]
  };
}

function route(q) {
  if (db.falla && q.includes(db.falla)) throw new Error(`boom en ${db.falla}`);
  if (q.includes('as asistencia_promedio')) return rows(db.asistencia);
  if (q.includes('END AS rango')) return rows(db.demografico);
  if (q.includes('AS titulares')) return rows(db.membresias);
  if (q.includes('AS nombre_titular')) return rows(db.familias);
  if (q.includes('AS nuevos_en_mes')) return rows(db.nuevos);
  if (q.includes('AS total_reservas')) return rows(db.ocupacion);
  if (q.includes('d.nombre AS disciplina, COUNT(ser.sesion_id)')) return rows(db.disciplinas);
  if (q.includes('AS instructor,')) return rows(db.instructores);
  if (q.startsWith('SELECT espacio_id, nombre FROM espacios')) return rows(db.espacios);
  if (q.startsWith('SELECT espacio_id, fecha_reserva')) return rows(db.reservas);
  if (q.startsWith('SELECT espacio_id, dia_semana')) return rows(db.sesionesProg);
  if (q.includes('AS total_movimientos')) return rows(db.aflResumen);
  if (q.includes('AS visitas_unicas FROM fechas f')) return rows(db.aflDiaria);
  if (q.includes('AS dias_considerados')) return rows(db.aflSemana);
  if (q.includes('generate_series(0, 23)')) return rows(db.aflHoras);
  if (q.includes('FROM registro_acceso ra JOIN socios')) return rows(db.aflTop);
  if (q.includes('AS promedio_resolucion_dias')) return rows(db.sanResumen);
  if (q.includes('AS resueltas_en_mes')) return rows(db.sanMes);
  if (q.includes('AS ultima_sancion')) return rows(db.sanTop);
  if (q.includes('AS resuelto_por')) return rows(db.sanDetalle);
  if (q.includes('FROM socios s JOIN usuarios u ON s.usuario_id')) return rows(db.socios);
  throw new Error(`Query no esperada en test: ${q}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function binary(res, cb) {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

const download = (path, query = {}) => request(app).get(path).query(query).buffer(true).parse(binary);
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function styleOf(cell) {
  const { font, fill, border, alignment, numFmt } = cell.style || {};
  return JSON.parse(JSON.stringify({ font, fill, border, alignment, numFmt }));
}

/** Vuelca un xlsx a un objeto comparable: hojas, columnas, vistas, filtros, filas y celdas. */
async function dumpWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return {
    creator: workbook.creator,
    created: workbook.created,
    sheets: workbook.worksheets.map((sheet) => {
      const filas = [];
      sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const celdas = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          celdas.push([cell.address, JSON.parse(JSON.stringify(cell.value ?? null)), styleOf(cell)]);
        });
        filas.push({ fila: rowNumber, alto: row.height, celdas });
      });
      return {
        nombre: sheet.name,
        columnas: (sheet.columns || []).map((c) => [c.key, c.width]),
        vistas: sheet.views,
        autoFilter: sheet.autoFilter,
        filas
      };
    })
  };
}

beforeAll(() => {
  jest.useFakeTimers({
    now: new Date('2026-09-30T18:00:00Z'),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'queueMicrotask',
      'hrtime',
      'performance'
    ]
  });
});

afterAll(() => jest.useRealTimers());

beforeEach(() => {
  db = fixtures();
  ({ log } = recordQueries(pool, route));
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

// ── GET /asistencia (JSON) ───────────────────────────────────────────────────

describe('GET /api/reportes/asistencia', () => {
  it('con y sin instructorId', async () => {
    let res = await request(app).get('/api/reportes/asistencia').query({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(db.asistencia);

    res = await request(app)
      .get('/api/reportes/asistencia')
      .query({ fechaInicio: '2026-09-01', fechaFin: '2026-09-30', instructorId: '5' });
    expect(res.status).toBe(200);

    res = await request(app).get('/api/reportes/asistencia');
    expect(res.status).toBe(200);
    expect(log).toMatchSnapshot();
  });

  it('error de BD → 500', async () => {
    db.falla = 'asistencia_promedio';
    const res = await request(app).get('/api/reportes/asistencia');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al obtener reporte de asistencia' });
  });
});

// ── Reportes descargables ────────────────────────────────────────────────────

const REPORTES = [
  ['demografico', 'reporte-demografico-socios', 'END AS rango'],
  ['ocupacion', 'reporte-ocupacion-espacios', 'AS total_reservas'],
  ['afluencia', 'reporte-afluencia-dias-frecuentados', 'AS total_movimientos'],
  ['sanciones', 'reporte-sanciones-periodo', 'AS promedio_resolucion_dias']
];

describe.each(REPORTES)('GET /api/reportes/%s', (nombre, archivo, sqlFalla) => {
  const url = `/api/reportes/${nombre}`;

  it('xlsx (por defecto) → contenido, estilos y bytes', async () => {
    const res = await download(url, { desde: '2026-09-28', hasta: '2026-09-30' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${archivo}.xlsx"`);
    expect(await dumpWorkbook(res.body)).toMatchSnapshot();
    expect(sha(res.body)).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('pdf → bytes idénticos', async () => {
    const res = await download(url, { formato: 'PDF', desde: '2026-09-28', hasta: '2026-09-30' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${archivo}.pdf"`);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(sha(res.body)).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('pdf con datos vacíos', async () => {
    for (const key of Object.keys(db)) if (Array.isArray(db[key])) db[key] = [];
    const res = await download(url, { formato: 'pdf', fecha: '2026-09-30' });
    expect(res.status).toBe(200);
    expect(sha(res.body)).toMatchSnapshot();
  });

  it('rango por defecto y alias de fechas', async () => {
    await download(url);
    await download(url, { fechaInicio: '2026-09-01', fechaFin: '2026-09-02' });
    await download(url, { desde: '2026-09-05' });
    await download(url, { fecha: '2026-09-07' });
    expect(log.map(([, , params]) => params).filter((p) => p.length)).toMatchSnapshot();
  });

  it('validaciones → 400; error de BD → 500 con el mensaje del error', async () => {
    let res = await request(app).get(url).query({ formato: 'csv' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El parametro formato debe ser xlsx o pdf' });

    if (nombre !== 'demografico') {
      res = await request(app).get(url).query({ desde: '2026-02-30' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Las fechas deben tener formato YYYY-MM-DD' });

      res = await request(app).get(url).query({ desde: '2026-09-10', hasta: '2026-09-01' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'La fecha desde no puede ser mayor que la fecha hasta' });
    }
    expect(log).toEqual([]);

    db.falla = sqlFalla;
    res = await request(app).get(url);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: `boom en ${sqlFalla}` });

    res = await request(app).get(url).query({ formato: 'pdf' });
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ error: `boom en ${sqlFalla}` });
  });
});

// ── GET /socios/exportar (exportacionController) ─────────────────────────────

describe('GET /api/reportes/socios/exportar', () => {
  const url = '/api/reportes/socios/exportar';

  it('xlsx con filtros por defecto → contenido, estilos y bytes', async () => {
    const res = await download(url);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toBe('attachment; filename="socios_2026-09-30.xlsx"');
    expect(await dumpWorkbook(res.body)).toMatchSnapshot();
    expect(sha(res.body)).toMatchSnapshot();
    expect(log).toMatchSnapshot();
  });

  it('variantes de filtros → SQL', async () => {
    await download(url, { activo: 'false', tipo: 'Accionista' });
    await download(url, { activo: 'TODOS', modalidad: 'Familiar' });
    await download(url, { activo: 'all', tipo: 'Rentista', modalidad: 'Individual' });
    await download(url, { activo: 'cualquiera' });
    expect(log).toMatchSnapshot();
  });

  it('error de BD → 500 con mensaje', async () => {
    db.falla = 'FROM socios s JOIN usuarios u';
    const res = await request(app).get(url);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error al consultar socios: boom en FROM socios s JOIN usuarios u' });
  });
});
