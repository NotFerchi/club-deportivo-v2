// Semilla de la base de la simulación (U5-07). Solo escribe en SIMULACION_DATABASE_URL:
//
//   node scripts/semillaSimulacion.js --simulacion --inicio=YYYY-MM-DD --ensayo   → corre todo y hace ROLLBACK
//   node scripts/semillaSimulacion.js --simulacion --inicio=YYYY-MM-DD            → guarda (COMMIT)
//
// Variables (backend/.env.simulacion, ignorado por git; o del entorno):
//   SIMULACION_DATABASE_URL  la base de la simulación (branch "solo esquema" simulacion-u5)
//   SIM_PASS_ADMIN, SIM_PASS_GERENTE, SIM_PASS_COORDINADOR, SIM_PASS_RECEPCION, SIM_PASS_INSTRUCTOR,
//   SIM_PASS_SOCIO           contraseñas de las cuentas de acceso (U5-08); las que falten quedan pendientes
//
// Protecciones (scripts/simulacion/guardas.js): exige --simulacion y --inicio; se niega si el host de la
// simulación es el de production (DATABASE_URL de backend/.env) o si no puede compararlo; y se niega si la
// base tiene datos que no son de la simulación. Todo en UNA transacción; la semilla corre dos veces dentro
// de ella y, si la segunda pasada cambia algo (no es idempotente), se revierte todo. Nunca imprime la
// cadena de conexión ni contraseñas.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const { leerArgumentos, validarDestino, validarContenido, hostDe } = require('./simulacion/guardas');
const { sembrar, totalCambios } = require('./simulacion/sembrar');
const { sociosDia1 } = require('./simulacion/sociosSimulacion');
const { crearLibro } = require('./generarExcelSocios');
const { CUENTAS_ACCESO, TORNEOS } = require('./simulacion/datosSemilla');

const BACKEND = path.join(__dirname, '..');
const leerEnv = (archivo) => {
  const ruta = path.join(BACKEND, archivo);
  return fs.existsSync(ruta) ? dotenv.parse(fs.readFileSync(ruta)) : {};
};

// Los servicios de la app (importador, lectura de torneos) usan src/config/database. Se reemplaza, antes de
// cargarlos, por un pool que manda todo a la transacción de esta semilla; su BEGIN/COMMIT/ROLLBACK se
// vuelven SAVEPOINT, así el --ensayo también revierte lo que hagan ellos.
const enlace = { client: null };
const traducir = (sql) => {
  const s = typeof sql === 'string' ? sql.trim().toUpperCase() : '';
  if (s === 'BEGIN') return 'SAVEPOINT servicio';
  if (s === 'COMMIT') return 'RELEASE SAVEPOINT servicio';
  if (s === 'ROLLBACK') return 'ROLLBACK TO SAVEPOINT servicio';
  return sql;
};
const consultar = (sql, params) => enlace.client.query(traducir(sql), params);
const poolDeLaSemilla = { query: consultar, connect: async () => ({ query: consultar, release: () => {} }), on: () => {} };
const rutaPool = require.resolve('../src/config/database');
require.cache[rutaPool] = { id: rutaPool, filename: rutaPool, loaded: true, exports: poolDeLaSemilla };

function salir(mensaje) {
  console.error(`✘ ${mensaje}`);
  process.exit(1);
}

async function main() {
  const args = leerArgumentos(process.argv.slice(2));
  if (args.error) salir(args.error);

  const envSimulacion = leerEnv('.env.simulacion');
  const urlSimulacion = process.env.SIMULACION_DATABASE_URL || envSimulacion.SIMULACION_DATABASE_URL;
  const urlProduccion = leerEnv('.env').DATABASE_URL;
  const errorDestino = validarDestino({ urlSimulacion, urlProduccion });
  if (errorDestino) salir(errorDestino);

  // Quita de cualquier mensaje el host y la URL de la simulación
  const sanear = (texto) =>
    String(texto).split(urlSimulacion).join('<url>').split(hostDe(urlSimulacion)).join('<host-simulacion>');

  const contrasenas = {};
  for (const { env } of CUENTAS_ACCESO) {
    const valor = process.env[env] || envSimulacion[env];
    if (valor) contrasenas[env] = valor;
  }

  // Servicios reales, ya conectados al pool de la semilla
  const { importarSocios } = require('../src/services/importacionService');
  const participanteService = require('../src/services/participanteService');
  const bracketService = require('../src/services/bracketService');
  const torneoService = require('../src/services/torneoService');
  const { hoyEnClub } = require('../src/services/torneoFechas');

  const client = new Client({ connectionString: urlSimulacion, ssl: { rejectUnauthorized: false } });
  enlace.client = client;
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL timezone = 'America/Mexico_City'"); // como src/config/database.js
    console.log(`Destino: simulación (host distinto del de production ✔) · ${args.ensayo ? 'ENSAYO: se revierte al final' : 'se guarda al final'}`);

    // ── Contenido de la base antes de escribir ──
    const tablas = (await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
    )).rows.map((r) => r.table_name);
    let filas = 0;
    for (const t of tablas) filas += Number((await client.query(`SELECT COUNT(*) FROM "${t}"`)).rows[0].count);
    const usuarios = Number((await client.query('SELECT COUNT(*) FROM usuarios')).rows[0].count);
    const accionSim01 = (await client.query("SELECT 1 FROM acciones_familiares WHERE codigo_accion = 'SIM01'")).rowCount > 0;
    const torneoSim = (await client.query('SELECT 1 FROM torneos WHERE nombre = $1', [TORNEOS[0].nombre])).rowCount > 0;
    console.log(`Antes: ${tablas.length} tablas, ${filas} filas en total, ${usuarios} usuarios${accionSim01 && torneoSim ? ' (ya sembrada)' : ''}`);
    const errorContenido = validarContenido({ usuarios, accionSim01, torneoSim });
    if (errorContenido) throw new Error(errorContenido);

    // ── Dos pasadas: la segunda no debe cambiar nada ──
    const opciones = {
      inicio: args.inicio,
      hoy: hoyEnClub(),
      contrasenas,
      importarSocios,
      bufferDia1: await crearLibro(sociosDia1())
    };
    const primera = await sembrar(client, opciones);
    const segunda = await sembrar(client, opciones);
    const cambiosSegunda = totalCambios(segunda.resumen);
    if (cambiosSegunda > 0) {
      throw new Error(`La segunda pasada hizo ${cambiosSegunda} cambios: la semilla no es idempotente (se revierte todo)`);
    }

    console.log(`\nSocios de socios-dia1.xlsx (importador): ${primera.importacion.nuevos} nuevos, ${primera.importacion.actualizados} actualizados`);
    console.log('\nTabla                       creados  ya existían  actualizados');
    for (const [tabla, r] of Object.entries(primera.resumen)) {
      console.log(`${tabla.padEnd(28)}${String(r.creados).padStart(7)}${String(r.existentes).padStart(13)}${String(r.actualizados).padStart(14)}`);
    }
    console.log(`Segunda pasada: 0 cambios ✔ (idempotente)`);

    // ── Verificación con los servicios de lectura de la app ──
    const [copa, padel] = TORNEOS.map((t) => primera.ids.torneos[t.nombre]);
    const participantes = await participanteService.listarParticipantes(copa);
    const tipos = participantes.data.reduce((m, p) => ({ ...m, [p.tipo_participante]: (m[p.tipo_participante] || 0) + 1 }), {});
    const bracket = await bracketService.obtenerBracket(padel);
    const reporte = await torneoService.obtenerReporte(padel);
    console.log(`\nVerificación con los servicios de la app:`);
    console.log(`  ${TORNEOS[0].nombre}: ${participantes.total} inscritos ${JSON.stringify(tipos)}`);
    console.log(`  ${TORNEOS[1].nombre}: bracket de ${bracket.length} rondas, reporte con ${reporte.encuentros.length} encuentros`);

    const definidas = CUENTAS_ACCESO.filter((c) => contrasenas[c.env]).map((c) => c.rol);
    console.log(`\nContraseñas definidas (U5-08): ${definidas.length ? definidas.join(', ') : 'ninguna'} (los valores no se muestran)`);
    if (primera.pendientes.length) {
      console.log('Pendiente:');
      primera.pendientes.forEach((p) => console.log(`  · ${p}`));
    }

    await client.query(args.ensayo ? 'ROLLBACK' : 'COMMIT');
    console.log(args.ensayo ? '\nENSAYO: ROLLBACK, no se guardó nada.' : '\nCOMMIT: datos guardados.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    salir(`${sanear(error.message)} (ROLLBACK, no se guardó nada)`);
  } finally {
    await client.end().catch(() => null);
  }
}

main();
