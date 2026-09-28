'use strict';

/**
 * Tests de caracterización de /api/importacion (importacionController).
 * Vía router real (multer incluido) + errorHandler. Los .xlsx se generan con
 * ExcelJS; la BD se simula enrutando por texto SQL y parámetros.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
// Autenticación simulada: estos tests caracterizan la lógica, no el control de acceso.
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => next(),
  checkRole: () => (req, res, next) => next()
}));

const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const express = require('express');
const request = require('supertest');
const pool = require('../config/database');
const importacionRoutes = require('../routes/importacion.routes');

const app = express();
app.use(express.json());
app.use('/api/importacion', importacionRoutes);
app.use(require('../middleware/errorHandler'));

const rows = (list) => ({ rows: list, rowCount: list.length });
const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();
const ANIO = new Date().getFullYear();

const HEADERS = [
  'Numero_Accion',
  'Tipo_Accion',
  'Estatus_Accion',
  'Rol',
  'Nombre_Completo',
  'Genero',
  'Fecha_Nacimiento',
  'Parentesco',
  'Domicilio',
  'Email',
  'Telefono_Celular',
  'Telefono_Particular'
];

async function xlsx(filas, headers = HEADERS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Datos');
  ws.addRow(headers);
  filas.forEach((f) => ws.addRow(headers.map((h) => (f[h] === undefined ? null : f[h]))));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

let db;
let client;
let consoleSpies;
let nextUsuarioId;

function routeQuery(sql, params = []) {
  const q = norm(sql);
  if (
    [
      'BEGIN',
      'COMMIT',
      'ROLLBACK',
      'SAVEPOINT sp_fila',
      'RELEASE SAVEPOINT sp_fila',
      'ROLLBACK TO SAVEPOINT sp_fila'
    ].includes(q)
  ) {
    return rows([]);
  }
  if (q.includes("FROM roles WHERE nombre = 'socio' LIMIT 1")) return rows(db.rol);
  if (q === 'SELECT accion_id FROM acciones_familiares WHERE codigo_accion = $1') {
    const id = db.acciones[params[0]];
    return rows(id ? [{ accion_id: id }] : []);
  }
  if (q === 'SELECT accion_id FROM acciones_familiares WHERE codigo_accion=$1') {
    return rows([{ accion_id: db.accionesPorConflicto[params[0]] }]);
  }
  if (q.startsWith('INSERT INTO acciones_familiares')) {
    return db.accionesPorConflicto[params[0]] ? rows([]) : rows([{ accion_id: 900 }]);
  }
  if (q.includes('FROM usuarios u JOIN socios s ON s.usuario_id = u.usuario_id WHERE u.username = $1')) {
    const id = db.usuariosEnAccion[`${params[0]}|${params[1]}`];
    return rows(id ? [{ usuario_id: id }] : []);
  }
  if (q.startsWith('UPDATE usuarios SET nombres=$1')) return rows([]);
  if (q.startsWith('UPDATE socios SET tipo=$1')) return rows([]);
  if (q.startsWith('INSERT INTO usuarios')) {
    if (db.usernamesQueFallan.includes(params[0])) throw new Error('duplicate key value violates unique constraint');
    return rows([{ usuario_id: nextUsuarioId++ }]);
  }
  if (q.includes('SELECT COUNT(*) FROM socios s WHERE s.accion_id = $1')) return rows([{ count: db.miembrosEnAccion }]);
  if (q.includes('SELECT COUNT(*) FROM socios s JOIN acciones_familiares af')) return rows([{ count: '0' }]);
  if (q.startsWith('INSERT INTO socios')) return rows([]);
  throw new Error(`Query no esperada en test: ${q}`);
}

const calls = (fragment) => client.query.mock.calls.filter(([sql]) => norm(sql).includes(fragment));

beforeEach(() => {
  nextUsuarioId = 100;
  db = {
    rol: [{ rol_id: 5 }],
    acciones: { 1013: 11 },
    accionesPorConflicto: {},
    usuariosEnAccion: { 'ana@club.mx|11': 21 },
    usernamesQueFallan: [],
    miembrosEnAccion: '2'
  };
  client = { query: jest.fn(async (sql, params) => routeQuery(sql, params)), release: jest.fn() };
  pool.connect.mockResolvedValue(client);
  pool.query.mockImplementation(async (sql) => {
    throw new Error(`pool.query no esperado: ${norm(sql)}`);
  });
  consoleSpies = ['log', 'error', 'warn'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});

afterEach(() => consoleSpies.forEach((spy) => spy.mockRestore()));

const importar = (buffer, filename = 'socios.xlsx') =>
  request(app).post('/api/importacion/socios').attach('archivo', buffer, { filename });

// ── Template ─────────────────────────────────────────────────────────────────

describe('GET /template', () => {
  it('tipo distinto de socios → 400', async () => {
    const res = await request(app).get('/api/importacion/template?tipo=pagos');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Tipo 'pagos' no válido. Usa ?tipo=socios" });
  });

  it('devuelve el xlsx con hoja Datos (headers con estilo + 3 ejemplos) e Instrucciones', async () => {
    const res = await request(app)
      .get('/api/importacion/template?tipo=socios')
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toBe('attachment; filename="template_socios.xlsx"');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Datos', 'Instrucciones']);

    const datos = wb.getWorksheet('Datos');
    const valores = [];
    datos.eachRow((row) => valores.push(row.values.slice(1)));
    expect(valores[0]).toEqual(HEADERS);
    expect(valores.slice(1)).toEqual([
      [
        '1013',
        'Familiar',
        'Propia',
        'Titular',
        'Carlos Mendoza Ruiz',
        'Masculino',
        '1975-04-12',
        '',
        'Av. Acueducto 123, Morelia',
        'carlos.mendoza@gmail.com',
        '4431234567',
        '4439876543'
      ],
      [
        '1013',
        'Familiar',
        'Propia',
        'Miembro',
        'Ana López de Mendoza',
        'Femenino',
        '1978-09-25',
        'Esposa',
        'Av. Acueducto 123, Morelia',
        'ana.lopez@gmail.com',
        '4437654321',
        ''
      ],
      [
        '2047',
        'Individual',
        'Rentada',
        'Titular',
        'Sandra Torres Sánchez',
        'Femenino',
        '1990-11-03',
        '',
        'Calle Hidalgo 88, Morelia',
        'sandra.torres@outlook.com',
        '4439998877',
        ''
      ]
    ]);
    const header = datos.getRow(1).getCell(1);
    expect(header.font).toMatchObject({ bold: true, color: { argb: 'FF1e3a5f' } });
    expect(header.fill).toMatchObject({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFbfdbfe' } });
    expect(header.alignment).toEqual({ horizontal: 'center', vertical: 'middle' });
    expect(datos.columns.map((c) => c.width)).toEqual([15, 15, 16, 12, 30, 12, 18, 15, 35, 30, 18, 18]);

    const instr = wb.getWorksheet('Instrucciones');
    const guia = [];
    instr.eachRow((row) => guia.push(row.values.slice(1)));
    expect(guia).toHaveLength(12);
    expect(guia[0]).toEqual(['Campo', 'Descripción']);
    expect(guia[1]).toEqual([
      'Numero_Accion',
      'Número de la acción familiar. Socios de la misma familia comparten este número.'
    ]);
    expect(guia[11]).toEqual(['Telefono_Particular', 'Se usa como teléfono de emergencia']);
    expect(instr.getRow(1).font).toMatchObject({ bold: true });
  });
});

// ── Importación: validaciones previas ────────────────────────────────────────

describe('POST /socios — validaciones', () => {
  it('sin archivo → 400', async () => {
    const res = await request(app).post('/api/importacion/socios');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Se requiere un archivo .xlsx (field: archivo)' });
  });

  it('archivo que no es Excel → 400', async () => {
    const res = await importar(Buffer.from('no soy un excel'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No se pudo leer el archivo Excel' });
  });

  it('solo encabezados → 400 sin filas', async () => {
    const res = await importar(await xlsx([]));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El archivo no tiene filas de datos' });
  });

  it('faltan columnas mínimas → 400 con la lista', async () => {
    const res = await importar(
      await xlsx([{ Numero_Accion: '1', Nombre_Completo: 'X' }], ['Numero_Accion', 'Nombre_Completo'])
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Faltan columnas requeridas: Rol, Email' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('sin rol socio → 500 con mensaje de transacción y ROLLBACK', async () => {
    db.rol = [];
    const res = await importar(
      await xlsx([{ Numero_Accion: '1', Rol: 'Titular', Nombre_Completo: 'X', Email: 'x@y.mx' }])
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error en la transacción: Rol socio no encontrado en la BD' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('falla la conexión → responde el errorHandler global', async () => {
    pool.connect.mockRejectedValueOnce(new Error('connection refused'));
    const res = await importar(
      await xlsx([{ Numero_Accion: '1', Rol: 'Titular', Nombre_Completo: 'X', Email: 'x@y.mx' }])
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'Error interno del servidor' });
  });
});

// ── Importación: sincronización ──────────────────────────────────────────────

describe('POST /socios — sincronización', () => {
  it('email duplicado con espacio interno: el original no omite esas filas (regex del mensaje)', async () => {
    const filas = [
      { Numero_Accion: '7', Rol: 'Titular', Nombre_Completo: 'Uno', Email: 'a b@club.mx' },
      { Numero_Accion: '7', Rol: 'Miembro', Nombre_Completo: 'Dos', Email: 'A B@club.mx' }
    ];
    const res = await importar(await xlsx(filas));

    expect(res.body.errores).toEqual([
      { fila: 3, motivo: 'Email duplicado en el archivo: a b@club.mx (ya aparece en fila 2)' }
    ]);
    expect(res.body.nuevos).toBe(2);
  });

  it('procesa cada tipo de fila y reporta nuevos, actualizados y errores', async () => {
    db.accionesPorConflicto = { 3030: 33 };
    db.usernamesQueFallan = ['falla@club.mx'];
    const filas = [
      // fila 2: acción nueva, titular, fecha ISO, 3+ palabras en el nombre
      {
        Numero_Accion: '2047',
        Tipo_Accion: 'Individual',
        Estatus_Accion: 'Rentada',
        Rol: 'Titular',
        Nombre_Completo: 'Sandra Luz Torres Sánchez',
        Genero: 'Femenino',
        Fecha_Nacimiento: '1990-11-03',
        Domicilio: ' Calle Hidalgo 88 ',
        Email: ' Sandra@Mail.MX ',
        Telefono_Celular: '4439998877'
      },
      // fila 3: acción existente, usuario existente → actualización; 2 palabras
      {
        Numero_Accion: 1013,
        Tipo_Accion: 'Familiar',
        Estatus_Accion: 'Propia',
        Rol: 'Miembro',
        Nombre_Completo: 'Ana López',
        Fecha_Nacimiento: new Date(Date.UTC(1978, 8, 25)),
        Parentesco: 'Esposa',
        Email: 'ana@club.mx',
        Telefono_Particular: '4430000000'
      },
      // fila 4: acción existente, miembro nuevo → numero M{count+1}; 1 palabra; fecha serial de Excel
      {
        Numero_Accion: '1013',
        Rol: 'miembro',
        Nombre_Completo: 'Beto',
        Fecha_Nacimiento: 36526,
        Email: 'beto@club.mx'
      },
      // fila 5: sin Numero_Accion
      { Rol: 'Titular', Nombre_Completo: 'Sin Accion', Email: 'sin@club.mx' },
      // fila 6: sin Email
      { Numero_Accion: '5', Rol: 'Titular', Nombre_Completo: 'Sin Email' },
      // fila 7 y 8: email duplicado en el archivo (se omiten ambas)
      { Numero_Accion: '6', Rol: 'Titular', Nombre_Completo: 'Dup Uno', Email: 'dup@club.mx' },
      { Numero_Accion: '6', Rol: 'Miembro', Nombre_Completo: 'Dup Dos', Email: 'DUP@club.mx' },
      // fila 9: acción nueva que ya existe por conflicto; fecha inválida → null
      {
        Numero_Accion: '3030',
        Rol: 'Titular',
        Nombre_Completo: 'Carla Ruiz',
        Fecha_Nacimiento: '03/11/1990',
        Email: 'carla@club.mx'
      },
      // fila 10: error de BD al insertar el usuario → rollback al savepoint
      { Numero_Accion: '4040', Rol: 'Titular', Nombre_Completo: 'Falla Aqui', Email: 'falla@club.mx' }
    ];

    const res = await importar(await xlsx(filas));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total_procesados: 9,
      nuevos: 3,
      actualizados: 1,
      errores: [
        { fila: 8, motivo: 'Email duplicado en el archivo: dup@club.mx (ya aparece en fila 7)' },
        { fila: 5, motivo: 'Numero_Accion vacío' },
        { fila: 6, motivo: 'Email vacío' },
        { fila: 10, motivo: 'duplicate key value violates unique constraint' }
      ]
    });

    // Usuarios insertados: sandra, beto, carla (falla@ lanzó error)
    const insertUsuarios = calls('INSERT INTO usuarios').map(([, p]) => p);
    expect(insertUsuarios.map((p) => [p[0], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9]])).toEqual([
      [
        'sandra@mail.mx',
        5,
        'Sandra Luz',
        'Torres',
        'Sánchez',
        'Femenino',
        '1990-11-03',
        '4439998877',
        'Calle Hidalgo 88'
      ],
      ['beto@club.mx', 5, 'Beto', '', '', null, '2000-01-01', null, null],
      ['carla@club.mx', 5, 'Carla', 'Ruiz', '', null, null, null, null],
      ['falla@club.mx', 5, 'Falla', 'Aqui', '', null, null, null, null]
    ]);
    expect(bcrypt.compareSync(`Club2047${ANIO}`, insertUsuarios[0][1])).toBe(true);
    expect(bcrypt.compareSync(`Club1013${ANIO}`, insertUsuarios[1][1])).toBe(true);

    // Socios insertados
    expect(calls('INSERT INTO socios').map(([, p]) => p)).toEqual([
      [100, 900, 'Rentista', 'Individual', true, 'SOC-2047-T', null, null],
      [101, 11, 'Rentista', 'Individual', false, 'SOC-1013-M3', null, null],
      [102, 33, 'Rentista', 'Individual', true, 'SOC-3030-T', null, null]
    ]);

    // Actualización del usuario existente
    expect(calls('UPDATE usuarios SET nombres=$1')[0][1]).toEqual([
      'Ana',
      'López',
      '',
      null,
      '1978-09-25',
      null,
      null,
      21
    ]);
    expect(calls('UPDATE socios SET tipo=$1')[0][1]).toEqual([
      'Accionista',
      'Familiar',
      false,
      '4430000000',
      'Esposa',
      21
    ]);

    // Savepoints: uno por fila procesada; rollback al savepoint solo en la fila que falló
    expect(calls('SAVEPOINT sp_fila').filter(([sql]) => sql === 'SAVEPOINT sp_fila')).toHaveLength(5);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT sp_fila');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });
});
