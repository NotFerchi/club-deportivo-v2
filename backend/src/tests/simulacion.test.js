'use strict';

/**
 * U5-07: entorno de simulación.
 *  - Protecciones de la semilla (scripts/simulacion/guardas.js) y del CLI (scripts/semillaSimulacion.js).
 *  - Excel de socios (scripts/generarExcelSocios.js) validados con el importador real.
 *  - Semilla (scripts/simulacion/sembrar.js) contra una BD falsa en memoria: conteos, idempotencia,
 *    contraseñas y que nunca borre ni cambie el esquema.
 */

// bcrypt rápido y determinista para las pruebas: hash(p) = 'h:' + p
jest.mock('bcryptjs', () => ({
  hash: async (p) => `h:${p}`,
  compare: async (p, h) => h === `h:${p}`
}));

const path = require('path');
const { spawnSync } = require('child_process');
const { leerArgumentos, validarDestino, validarContenido } = require('../../scripts/simulacion/guardas');
const { sociosDia1, sociosDia3, DOMINIO, USUARIO_SOCIO } = require('../../scripts/simulacion/sociosSimulacion');
const { crearLibro, validarConImportador, clasificarDia3 } = require('../../scripts/generarExcelSocios');
const { sembrar, totalCambios, sumarDias } = require('../../scripts/simulacion/sembrar');
const D = require('../../scripts/simulacion/datosSemilla');

// ── Protecciones ─────────────────────────────────────────────────────────────

describe('guardas: argumentos', () => {
  it.each([
    [[], /Falta --simulacion/],
    [['--inicio=2026-12-01'], /Falta --simulacion/],
    [['--simulacion'], /Falta --inicio/],
    [['--simulacion', '--inicio=01/12/2026'], /formato YYYY-MM-DD/],
    [['--simulacion', '--inicio=2026-02-30'], /no es una fecha que exista/],
    [['--simulacion', '--inicio=2026-12-01', '--principal'], /Argumento no reconocido/]
  ])('%j → error', (argv, mensaje) => {
    expect(leerArgumentos(argv).error).toMatch(mensaje);
  });

  it('válidos, con y sin --ensayo', () => {
    expect(leerArgumentos(['--simulacion', '--inicio=2026-12-01'])).toEqual({ simulacion: true, ensayo: false, inicio: '2026-12-01' });
    expect(leerArgumentos(['--ensayo', '--inicio=2026-12-01', '--simulacion']).ensayo).toBe(true);
  });
});

describe('guardas: destino', () => {
  const sim = 'postgresql://u:clavesimq7@ep-sim-123.ejemplo.invalid/db';
  const prod = 'postgresql://u:claveprodq7@ep-prod-999.ejemplo.invalid/db';

  it.each([
    [{ urlProduccion: prod }, /Falta SIMULACION_DATABASE_URL/],
    [{ urlSimulacion: sim }, /Falta DATABASE_URL/],
    [{ urlSimulacion: 'no es url', urlProduccion: prod }, /no es una URL válida/],
    [{ urlSimulacion: sim, urlProduccion: 'x' }, /no es una URL válida/],
    [{ urlSimulacion: prod.replace('claveprodq7', 'clavedistintaq7'), urlProduccion: prod }, /mismo host que production/],
    [{ urlSimulacion: sim.replace('ep-sim-123', 'EP-PROD-999'), urlProduccion: prod }, /mismo host que production/]
  ])('%#: se niega', (entrada, mensaje) => {
    const error = validarDestino(entrada);
    expect(error).toMatch(mensaje);
    expect(error).not.toMatch(/clavesimq7|claveprodq7|clavedistintaq7/); // nunca muestra la URL ni la contraseña
  });

  it('hosts distintos → null', () => {
    expect(validarDestino({ urlSimulacion: sim, urlProduccion: prod })).toBeNull();
  });
});

describe('guardas: contenido', () => {
  it('base vacía → ok', () => expect(validarContenido({ usuarios: 0, accionSim01: false, torneoSim: false })).toBeNull());
  it('ya sembrada → ok', () => expect(validarContenido({ usuarios: 70, accionSim01: true, torneoSim: true })).toBeNull());
  it.each([
    [{ usuarios: 66, accionSim01: false, torneoSim: false }],
    [{ usuarios: 66, accionSim01: true, torneoSim: false }],
    [{ usuarios: 66, accionSim01: false, torneoSim: true }]
  ])('con datos ajenos (%j) → se niega', (conteos) => {
    expect(validarContenido(conteos)).toMatch(/no es la de la simulación/);
  });
});

describe('CLI semillaSimulacion.js: se niega antes de conectarse', () => {
  const correr = (args, env = {}) =>
    spawnSync(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'semillaSimulacion.js'), ...args], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
      encoding: 'utf8',
      timeout: 20000
    });

  it.each([
    [[], /Falta --simulacion/],
    [['--simulacion'], /Falta --inicio/],
    [['--simulacion', '--inicio=2026-13-01'], /no es una fecha que exista/]
  ])('%j → sale con 1', (args, mensaje) => {
    const r = correr(args);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(mensaje);
  });

  it('con el host de production (o sin .env para comparar) → sale con 1 sin mostrar la URL', () => {
    // backend/.env puede no existir (CI): entonces se niega por no poder comparar. Si existe, se usa su
    // DATABASE_URL como si fuera la simulación: debe negarse por ser el mismo host.
    const fs = require('fs');
    const dotenv = require('dotenv');
    const rutaEnv = path.join(__dirname, '..', '..', '.env');
    const produccion = fs.existsSync(rutaEnv) ? dotenv.parse(fs.readFileSync(rutaEnv)).DATABASE_URL : undefined;
    const r = correr(['--simulacion', '--inicio=2026-12-01', '--ensayo'], {
      SIMULACION_DATABASE_URL: produccion || 'postgresql://u:p@ep-sim-123.ejemplo.invalid/db'
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(produccion ? /mismo host que production/ : /Falta DATABASE_URL/);
    if (produccion) expect(r.stdout + r.stderr).not.toContain(produccion);
  });
});

// ── Excel de socios ──────────────────────────────────────────────────────────

describe('Excel de socios', () => {
  it('día 1: ≥ 50 filas, correos .test únicos, un titular por acción y la cuenta del socio en SIM01', () => {
    const filas = sociosDia1();
    expect(filas.length).toBeGreaterThanOrEqual(50);
    expect(filas.every((f) => f.Email.endsWith(`@${DOMINIO}`) && DOMINIO.endsWith('.test'))).toBe(true);
    expect(new Set(filas.map((f) => f.Email)).size).toBe(filas.length);
    const titulares = filas.filter((f) => f.Rol === 'Titular');
    expect(new Set(titulares.map((f) => f.Numero_Accion)).size).toBe(titulares.length);
    expect(titulares.find((f) => f.Numero_Accion === 'SIM01').Email).toBe(USUARIO_SOCIO);
  });

  it.each([
    ['día 1', sociosDia1],
    ['día 3', sociosDia3]
  ])('%s: el importador real lo acepta sin errores', async (_, filas) => {
    const { registros, errores } = await validarConImportador(await crearLibro(filas()));
    expect(errores).toEqual([]);
    expect(registros).toHaveLength(filas().length);
  });

  it('día 3 después del día 1: 4 actualizaciones y 8 altas, sin choques', () => {
    expect(clasificarDia3(sociosDia1(), sociosDia3())).toEqual({ actualizados: 4, nuevos: 8, errores: [] });
  });

  it('detecta un email en otra acción y un segundo titular', () => {
    const dia1 = sociosDia1();
    const conflictos = [
      { ...dia1[0], Numero_Accion: 'SIM02' },
      { ...dia1[0], Email: `nuevo@${DOMINIO}` }
    ];
    expect(clasificarDia3(dia1, conflictos).errores).toEqual([
      `fila 2: ${USUARIO_SOCIO} ya está en la acción SIM01`,
      'fila 3: la acción SIM01 ya tiene titular'
    ]);
  });
});

// ── Semilla contra una BD falsa ──────────────────────────────────────────────

/** BD en memoria que entiende las tres formas de SQL de crearDb (SELECT/INSERT/UPDATE de una tabla). */
function crearBdFalsa() {
  const tablas = {};
  const log = [];
  let secuencia = 1;
  const tabla = (t) => (tablas[t] = tablas[t] || []);
  const cumple = (fila, { col, op, valor }) =>
    op === 'LIKE' ? String(fila[col] ?? '').startsWith(String(valor).replace(/%$/, '')) : String(fila[col]) === String(valor);

  async function query(sql, params = []) {
    log.push(sql);
    let m = sql.match(/^SELECT (.+) FROM (\w+) WHERE (.+?)( LIMIT 1)?$/);
    if (m) {
      const columnas = m[1].split(', ');
      const condiciones = m[3].split(' AND ').map((c) => {
        const [, col, op, n] = c.match(/^(\w+) (=|LIKE) \$(\d+)$/);
        return { col, op, valor: params[n - 1] };
      });
      let filas = tabla(m[2]).filter((f) => condiciones.every((c) => cumple(f, c)));
      if (m[4]) filas = filas.slice(0, 1);
      return { rows: filas.map((f) => Object.fromEntries(columnas.map((c) => [c, f[c]]))), rowCount: filas.length };
    }
    m = sql.match(/^INSERT INTO (\w+) \((.+)\) VALUES \(.+\) RETURNING (\w+)$/);
    if (m) {
      const fila = Object.fromEntries(m[2].split(', ').map((c, i) => [c, params[i]]));
      if (!(m[3] in fila)) fila[m[3]] = secuencia++;
      tabla(m[1]).push(fila);
      return { rows: [{ [m[3]]: fila[m[3]] }], rowCount: 1 };
    }
    m = sql.match(/^UPDATE (\w+) SET (.+) WHERE (\w+) = \$(\d+)$/);
    if (m) {
      const sets = m[2].split(', ').map((s) => s.match(/^(\w+) = \$(\d+)$/));
      tabla(m[1])
        .filter((f) => String(f[m[3]]) === String(params[m[4] - 1]))
        .forEach((f) => sets.forEach(([, col, n]) => (f[col] = params[n - 1])));
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`SQL no esperado en la BD falsa: ${sql}`);
  }
  return { client: { query }, tablas, log };
}

/** Importador falso: lo mismo que deja sincronizarFila (acción, usuario con contraseña Club<acción><año>, socio). */
function importadorFalso(bd) {
  return async () => {
    let nuevos = 0;
    let actualizados = 0;
    const anio = new Date().getFullYear();
    for (const f of sociosDia1()) {
      const { rows: acc } = await bd.client.query('SELECT accion_id FROM acciones_familiares WHERE codigo_accion = $1 LIMIT 1', [f.Numero_Accion]);
      const accionId = acc[0]?.accion_id ??
        (await bd.client.query('INSERT INTO acciones_familiares (codigo_accion) VALUES ($1) RETURNING accion_id', [f.Numero_Accion])).rows[0].accion_id;
      const { rows: us } = await bd.client.query('SELECT usuario_id FROM usuarios WHERE username = $1 LIMIT 1', [f.Email]);
      if (us[0]) {
        actualizados++;
        continue;
      }
      const usuarioId = (await bd.client.query(
        'INSERT INTO usuarios (username, password_hash) VALUES ($1, $2) RETURNING usuario_id',
        [f.Email, `h:Club${f.Numero_Accion}${anio}`]
      )).rows[0].usuario_id;
      await bd.client.query('INSERT INTO socios (usuario_id, accion_id) VALUES ($1, $2) RETURNING socio_id', [usuarioId, accionId]);
      nuevos++;
    }
    return { nuevos, actualizados };
  };
}

const CONTRASENAS = {
  SIM_PASS_ADMIN: 'clave-admin-1',
  SIM_PASS_GERENTE: 'clave-gerente-2',
  SIM_PASS_COORDINADOR: 'clave-coord-3',
  SIM_PASS_RECEPCION: 'clave-recep-4',
  SIM_PASS_INSTRUCTOR: 'clave-inst-5',
  SIM_PASS_SOCIO: 'clave-socio-6'
};
const INICIO = '2026-12-07';
const HOY = '2026-11-23';

async function sembrarEnBdFalsa(contrasenas) {
  const bd = crearBdFalsa();
  const opciones = { inicio: INICIO, hoy: HOY, contrasenas, importarSocios: importadorFalso(bd), bufferDia1: null };
  const primera = await sembrar(bd.client, opciones);
  const segunda = await sembrar(bd.client, opciones);
  return { bd, primera, segunda };
}

describe('sembrar (BD falsa)', () => {
  const creados = (primera, tabla) => primera.resumen[tabla]?.creados ?? 0;

  it('crea los datos de la simulación y la segunda pasada no cambia nada', async () => {
    const { primera, segunda } = await sembrarEnBdFalsa(CONTRASENAS);
    expect(primera.importacion).toEqual({ nuevos: sociosDia1().length, actualizados: 0 });
    expect(creados(primera, 'roles')).toBe(6);
    expect(creados(primera, 'disciplinas')).toBe(D.DISCIPLINAS.length);
    expect(creados(primera, 'espacios')).toBe(D.ESPACIOS.length);
    expect(creados(primera, 'instructores')).toBe(D.INSTRUCTORES.length);
    expect(creados(primera, 'sesiones_programadas')).toBe(D.SESIONES.length);
    expect(creados(primera, 'inscripciones_clases')).toBe(D.INSCRIPCIONES.length);
    expect(creados(primera, 'visitas')).toBe(D.VISITAS.length);
    expect(creados(primera, 'registro_ludoteca')).toBe(D.LUDOTECA.length);
    expect(creados(primera, 'sanciones')).toBe(D.SANCIONES.length);
    expect(creados(primera, 'torneos')).toBe(2);
    expect(creados(primera, 'participantes_torneo')).toBe(10 + 4);
    expect(creados(primera, 'encuentros_torneo')).toBe(3);
    expect(totalCambios(segunda.resumen)).toBe(0);
    expect(segunda.importacion).toEqual({ nuevos: 0, actualizados: sociosDia1().length });
  });

  it('solo hace SELECT, INSERT y UPDATE: nunca borra ni cambia el esquema', async () => {
    const { bd } = await sembrarEnBdFalsa(CONTRASENAS);
    expect(bd.log.every((sql) => /^(SELECT|INSERT|UPDATE) /.test(sql))).toBe(true);
    expect(bd.log.some((sql) => /\b(DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/i.test(sql))).toBe(false);
  });

  it('con las 6 contraseñas: crea las cuentas del personal y fija la del instructor y la del socio', async () => {
    const { bd, primera } = await sembrarEnBdFalsa(CONTRASENAS);
    const usuario = (username) => bd.tablas.usuarios.find((u) => u.username === username);
    for (const cuenta of D.CUENTAS_ACCESO) {
      expect(usuario(cuenta.username).password_hash).toBe(`h:${CONTRASENAS[cuenta.env]}`);
    }
    expect(primera.pendientes).toEqual([]);
    // Ninguna contraseña aparece en lo que devuelve la semilla
    const salida = JSON.stringify(primera);
    Object.values(CONTRASENAS).forEach((p) => expect(salida).not.toContain(p));
  });

  it('sin contraseñas: no crea las cuentas del personal y el socio y el instructor quedan sin acceso', async () => {
    const { bd, primera } = await sembrarEnBdFalsa({});
    const usernames = bd.tablas.usuarios.map((u) => u.username);
    ['admin', 'gerente', 'coordinador', 'recepcion'].forEach((rol) => expect(usernames).not.toContain(`${rol}@${DOMINIO}`));
    expect(primera.pendientes).toHaveLength(6);
    const anio = new Date().getFullYear();
    for (const u of bd.tablas.usuarios) {
      expect(u.password_hash).not.toMatch(/^h:Club/); // ninguna contraseña predecible del importador
      expect(u.password_hash).toMatch(/^h:[0-9a-f]{64}$/); // la imposible (aleatoria)
    }
    expect(anio).toBeGreaterThan(2000);
  });

  it('contraseñas que llegan después (U5-08): la segunda corrida crea las cuentas y no toca lo demás', async () => {
    const bd = crearBdFalsa();
    const base = { inicio: INICIO, hoy: HOY, importarSocios: importadorFalso(bd), bufferDia1: null };
    await sembrar(bd.client, { ...base, contrasenas: {} });
    const despues = await sembrar(bd.client, { ...base, contrasenas: CONTRASENAS });
    expect(despues.resumen.usuarios).toEqual({ creados: 4, existentes: 0, actualizados: 2 }); // 4 del personal; instructor y socio
    const sinUsuarios = Object.entries(despues.resumen).filter(([t]) => t !== 'usuarios');
    expect(sinUsuarios.every(([, r]) => r.creados === 0 && r.actualizados === 0)).toBe(true);
  });

  it('fechas coherentes con --inicio y con los CHECK de la BD', async () => {
    const { bd } = await sembrarEnBdFalsa(CONTRASENAS);
    for (const t of bd.tablas.torneos) {
      expect(t.fecha_fin >= t.fecha_inicio).toBe(true);
      expect(t.fecha_fin_inscripcion >= t.fecha_inicio_inscripcion).toBe(true);
      expect(t.fecha_fin_inscripcion <= t.fecha_inicio && t.fecha_inicio_inscripcion <= t.fecha_inicio).toBe(true);
      expect(t.cupo_maximo).toBeGreaterThanOrEqual(4);
    }
    const copa = bd.tablas.torneos.find((t) => t.nombre === D.TORNEOS[0].nombre);
    expect(copa).toMatchObject({ estado: 'Abierto', fecha_inicio: sumarDias(INICIO, 5), fecha_fin_inscripcion: sumarDias(INICIO, 3) });
    // Ludoteca: edad entre 3 y 7 años respecto a hoy (CHECK de registro_ludoteca)
    for (const r of bd.tablas.registro_ludoteca) {
      expect(r.fecha_nacimiento <= sumarDias(HOY, -3 * 365)).toBe(true);
      expect(r.fecha_nacimiento >= sumarDias(HOY, -7 * 365)).toBe(true);
      expect(r.hora_salida > r.hora_entrada).toBe(true);
    }
    // Visitas cerradas, del día anterior al inicio las que juegan la copa
    const laura = bd.tablas.visitas.find((v) => v.nombre_completo === 'Laura Méndez Ruiz');
    expect(laura).toMatchObject({ vigente: false, fecha_visita: sumarDias(INICIO, -1) });
  });

  it('copa con socios, visitas y un externo; bracket de pádel con el ganador en la final', async () => {
    const { bd } = await sembrarEnBdFalsa(CONTRASENAS);
    const copa = bd.tablas.torneos.find((t) => t.nombre === D.TORNEOS[0].nombre);
    const inscritos = bd.tablas.participantes_torneo.filter((p) => p.torneo_id === copa.torneo_id);
    expect(inscritos.filter((p) => p.socio_id).length).toBe(6);
    expect(inscritos.filter((p) => p.visita_id).length).toBe(3);
    expect(inscritos.filter((p) => p.nombre_externo).length).toBe(1);
    expect(inscritos.every((p) => p.categoria_id === copa.categoria_id)).toBe(true);

    const padel = bd.tablas.torneos.find((t) => t.nombre === D.TORNEOS[1].nombre);
    const encuentros = bd.tablas.encuentros_torneo.filter((e) => e.torneo_id === padel.torneo_id);
    const [semi1, semi2, final] = encuentros;
    expect(semi1).toMatchObject({ ronda: 1, estado: 'finalizado', marcador_1: 6, marcador_2: 3, ganador_id: semi1.participante_1_id });
    expect(semi2).toMatchObject({ ronda: 1, estado: 'programado', ganador_id: null });
    expect(final).toMatchObject({ ronda: 2, estado: 'pendiente', participante_1_id: semi1.ganador_id, participante_2_id: null });
  });
});
