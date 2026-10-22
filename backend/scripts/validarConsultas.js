// Valida las consultas reales de los servicios de torneos (y de evaluaciones, E4) contra una base real, SIN ESCRIBIR NADA.
//
//   node scripts/validarConsultas.js --principal   → DATABASE_URL de backend/.env
//   node scripts/validarConsultas.js --branch      → NEON_BRANCH_URL de backend/.env.paso7
//
// Para qué sirve: los tests usan mocks del pool, así que no detectan una columna o un alias que no existe
// en la base (p. ej. "column t.activo does not exist" porque falta una migración). Este script llama a las
// funciones de los servicios con datos reales y pasa cada consulta por EXPLAIN contra el esquema real.
//
// Seguridad (no se negocia):
//  - Todo corre en UNA transacción BEGIN READ ONLY: PostgreSQL rechaza cualquier escritura. Si el servidor no
//    confirma transaction_read_only = on, el script se detiene antes de consultar nada.
//  - INSERT / UPDATE / DELETE y los SELECT ... FOR UPDATE/SHARE solo se pasan por EXPLAIN (sin ANALYZE), que
//    no los ejecuta. Solo se ejecutan los SELECT sin bloqueo, para que el servicio siga su flujo con datos reales.
//  - LOCK TABLE no admite EXPLAIN y no se permite en READ ONLY: se omite y solo se comprueba que la tabla exista.
//  - Al final siempre hay ROLLBACK. No uses este script sin BEGIN READ ONLY ni lo cambies para hacer COMMIT.
//
// Cómo leer el resultado: ✔ la consulta es válida en esa base; ✘ falla (columna, alias o tabla inexistente);
// ⚠ el flujo del servicio se cortó por los datos de muestra (no es un error de SQL); "omitido" = el servicio
// no existe en esta rama o no hay datos para recorrerlo; "(datos simulados)" = el SQL sí se validó contra el
// esquema real, pero las filas de la consulta de estado se reemplazaron en memoria para que el servicio llegue a
// sus demás consultas (p. ej. cuando no hay ningún torneo en curso). Sale con código 1 si alguna consulta falla.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const BACKEND = path.join(__dirname, '..');
const args = process.argv.slice(2);

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

function leerEnv(nombre) {
  const ruta = path.join(BACKEND, nombre);
  if (!fs.existsSync(ruta)) salir(`No existe ${ruta}`);
  return dotenv.parse(fs.readFileSync(ruta));
}

const host = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

function destino() {
  const usarBranch = args.includes('--branch');
  const usarPrincipal = args.includes('--principal');
  if (usarBranch === usarPrincipal) salir('Indica el destino: --branch o --principal (solo uno).');
  const principal = leerEnv('.env').DATABASE_URL;
  if (!principal) salir('backend/.env no tiene DATABASE_URL');
  if (usarPrincipal) return { nombre: 'BD PRINCIPAL', url: principal };
  const branch = leerEnv('.env.paso7').NEON_BRANCH_URL;
  if (!branch) salir('backend/.env.paso7 no tiene NEON_BRANCH_URL');
  if (!host(branch) || host(branch) === host(principal)) {
    salir('El host de NEON_BRANCH_URL es igual al de DATABASE_URL (o no es válido): me detengo.');
  }
  return { nombre: 'branch de prueba', url: branch };
}

const { nombre: nombreDestino, url } = destino();
const real = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

// ── Pool interceptado ────────────────────────────────────────────────────────

const resultados = [];
let etiqueta = '';
// Reglas del paso actual: [{ si: (sql) => boolean, filas: (filasReales) => filas }]. Solo cambian DATOS en memoria,
// después del EXPLAIN y de la lectura real; el SQL que se valida es siempre el del servicio.
let simulacion = [];
const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();
const registrar = (r) => resultados.push({ etiqueta, ...r });

async function consultar(sql, params = []) {
  const q = norm(sql);
  // La transacción READ ONLY la controla este script: se ignoran las de los servicios
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(q)) return { rows: [], rowCount: 0 };

  const lock = /^LOCK TABLE (\w+)/i.exec(q);
  if (lock) {
    const { rows } = await real.query('SELECT to_regclass($1) IS NOT NULL AS existe', [lock[1]]);
    registrar({ estado: rows[0].existe ? 'omitida' : 'falla', sql: q, error: rows[0].existe ? null : `no existe ${lock[1]}` });
    return { rows: [], rowCount: 0 };
  }

  try {
    await real.query(`EXPLAIN ${q}`, params);
  } catch (error) {
    registrar({ estado: 'falla', sql: q, error: `${error.message}${error.hint ? ` (hint: ${error.hint})` : ''}` });
    throw error;
  }
  registrar({ estado: 'ok', sql: q });

  if (!/^SELECT/i.test(q)) {
    // Escritura: solo EXPLAIN. Con RETURNING devuelve una fila vacía para que el servicio no se caiga.
    return /\bRETURNING\b/i.test(q) ? { rows: [{}], rowCount: 0 } : { rows: [], rowCount: 0 };
  }
  const resultado = await real.query(q.replace(/\s+FOR (UPDATE|SHARE)( OF \w+)?$/i, ''), params);
  const regla = simulacion.find((r) => r.si(q));
  if (!regla) return resultado;
  const filas = regla.filas(resultado.rows);
  resultados.at(-1).simulado = true;
  return { rows: filas, rowCount: filas.length };
}

const poolFalso = {
  query: consultar,
  connect: async () => ({ query: consultar, release: () => {} }),
  on: () => {}
};
// Antes de cargar cualquier servicio: ninguno abre conexiones propias
const rutaPool = require.resolve('../src/config/database');
require.cache[rutaPool] = { id: rutaPool, filename: rutaPool, loaded: true, exports: poolFalso };

const cargar = (modulo) => {
  try {
    return require(modulo);
  } catch {
    return {};
  }
};
const torneoService = cargar('../src/services/torneoService');
const participanteService = cargar('../src/services/participanteService');
const bracketService = cargar('../src/services/bracketService');
const encuentroService = cargar('../src/services/encuentroService');
const categoriaService = cargar('../src/services/categoriaService');
const logService = cargar('../src/services/logService');
const evaluacionService = cargar('../src/services/evaluacionService');
const { bloquearTorneo } = cargar('../src/services/torneoComun');
const { logAudit } = cargar('../src/utils/auditLogger');

// ── Pasos ────────────────────────────────────────────────────────────────────

/** Corre un paso en su propio SAVEPOINT: una consulta que falla no aborta los pasos siguientes. */
async function paso(nombre, fn, { omitir, simular = [] } = {}) {
  etiqueta = nombre;
  if (omitir) {
    registrar({ estado: 'omitido', sql: omitir });
    return;
  }
  simulacion = simular;
  await real.query('SAVEPOINT paso');
  try {
    await fn();
    await real.query('RELEASE SAVEPOINT paso');
  } catch (error) {
    await real.query('ROLLBACK TO SAVEPOINT paso');
    if (!resultados.some((r) => r.etiqueta === nombre && r.estado === 'falla')) {
      const motivo = error.status ? `el servicio respondió ${error.status} ${JSON.stringify(error.body)}` : error.message;
      registrar({ estado: 'aviso', sql: motivo });
    }
  } finally {
    simulacion = [];
  }
}

// Filas simuladas para los encuentros cuando la base no tiene uno que pase las reglas de estado
const ESTADO_DEL_ENCUENTRO = (q) => q.startsWith('SELECT t.estado') && q.includes('FROM encuentros_torneo e JOIN torneos t');
const torneoEnCurso = () => [{ estado: 'En_curso', fecha_inicio: null, fecha_fin: null }];

const noExiste = (fn, nombre) => (typeof fn === 'function' ? undefined : `${nombre} no existe en esta rama`);
const sinDatos = (dato, que) => (dato ? undefined : `no hay ${que} en la base`);

/** Primera fila de una consulta de muestra (solo lectura, con columnas que existen en cualquier versión). */
async function muestra(sql, params = []) {
  return (await real.query(sql, params)).rows[0];
}

async function main() {
  await real.connect();
  try {
    await real.query('BEGIN READ ONLY');
    const { rows } = await real.query('SHOW transaction_read_only');
    if (rows[0].transaction_read_only !== 'on') throw new Error('La transacción no es READ ONLY: me detengo.');
    await real.query("SET LOCAL timezone = 'America/Mexico_City'"); // como config/database.js
    console.log(`Destino: ${nombreDestino} (${host(url)}) · transaction_read_only = on\n`);

    // Datos de muestra reales
    const torneo = await muestra(
      `SELECT torneo_id, nombre, disciplina_id, categoria_id, tipo_torneo,
              to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin
         FROM torneos ORDER BY torneo_id DESC LIMIT 1`
    );
    const conBracket = await muestra('SELECT torneo_id FROM encuentros_torneo ORDER BY encuentro_id DESC LIMIT 1');
    const socio = await muestra(
      `SELECT s.usuario_id FROM socios s JOIN participantes_torneo pt ON pt.socio_id = s.socio_id
        WHERE s.usuario_id IS NOT NULL LIMIT 1`
    );
    const categoria = await muestra('SELECT categoria_id FROM categorias_torneo ORDER BY categoria_id DESC LIMIT 1');
    const instructor = await muestra('SELECT instructor_id, usuario_id FROM instructores ORDER BY instructor_id LIMIT 1');
    // Cualquier encuentro real: sus reglas de estado se simulan en memoria (ver ESTADO_DEL_ENCUENTRO)
    const encuentro = await muestra('SELECT encuentro_id FROM encuentros_torneo ORDER BY encuentro_id DESC LIMIT 1');
    const idBracket = conBracket?.torneo_id ?? torneo?.torneo_id;

    // Torneos
    await paso('GET /api/torneos', () => torneoService.listarTorneos({}), { omitir: noExiste(torneoService.listarTorneos, 'listarTorneos') });
    await paso('GET /api/torneos?disciplina_id&estado', () => torneoService.listarTorneos({ disciplina_id: '1', estado: 'Abierto' }), {
      omitir: noExiste(torneoService.listarTorneos, 'listarTorneos')
    });
    await paso('GET /mis-participaciones', () => participanteService.misParticipaciones(socio), {
      omitir: sinDatos(socio, 'socios con participaciones')
    });
    await paso('GET /:id/participantes', () => participanteService.listarParticipantes(torneo.torneo_id), {
      omitir: sinDatos(torneo, 'torneos')
    });
    await paso('GET /:id/bracket', () => bracketService.obtenerBracket(idBracket), { omitir: sinDatos(idBracket, 'torneos') });
    await paso('GET /:id/reporte', () => torneoService.obtenerReporte(idBracket), { omitir: sinDatos(idBracket, 'torneos') });
    await paso('POST /api/torneos (solo EXPLAIN del INSERT)', () =>
      torneoService.crearTorneo({ nombre: '__validador__', disciplina_id: torneo.disciplina_id, categoria_id: torneo.categoria_id }), {
      omitir: sinDatos(torneo?.categoria_id, 'torneos con categoría')
    });
    await paso('PUT /api/torneos/:id (solo EXPLAIN del UPDATE)', () =>
      torneoService.actualizarTorneo(torneo.torneo_id, {
        nombre: torneo.nombre,
        disciplina_id: torneo.disciplina_id,
        categoria_id: torneo.categoria_id,
        tipo_torneo: torneo.tipo_torneo,
        fecha_inicio: torneo.fecha_inicio,
        fecha_fin: torneo.fecha_fin
      }), { omitir: sinDatos(torneo, 'torneos') });
    await paso('bloquearTorneo (inscripciones y cambios de estado)', () => bloquearTorneo(poolFalso, torneo.torneo_id), {
      omitir: sinDatos(torneo, 'torneos')
    });

    // Categorías (E2.6)
    const omitirCategorias = noExiste(categoriaService.listarCategorias, 'categoriaService');
    await paso('E2.6 GET /categorias', () => categoriaService.listarCategorias(), { omitir: omitirCategorias });
    await paso('E2.6 GET /categorias?activas=true', () => categoriaService.listarCategorias({ soloActivas: true }), {
      omitir: omitirCategorias
    });
    await paso('E2.6 POST /categorias (solo EXPLAIN del INSERT)', () => categoriaService.crearCategoria('__validador__'), {
      omitir: omitirCategorias
    });
    await paso('E2.6 PUT /categorias/:id (solo EXPLAIN del UPDATE)', () =>
      categoriaService.renombrarCategoria(categoria.categoria_id, '__validador__'), {
      omitir: omitirCategorias || sinDatos(categoria, 'categorías')
    });
    await paso('E2.6 PATCH /categorias/:id/desactivar (solo EXPLAIN del UPDATE)', () =>
      categoriaService.desactivarCategoria(categoria.categoria_id), { omitir: omitirCategorias || sinDatos(categoria, 'categorías') });

    // Encuentros (E2.7, E2.8). La base puede no tener ningún torneo en curso: el estado del torneo y del
    // encuentro se simulan para que cada servicio llegue a todas sus consultas, que sí se validan contra la base.
    const programado = (filas) => [
      {
        encuentro_id: encuentro.encuentro_id,
        torneo_id: filas[0]?.torneo_id ?? 1,
        ronda: filas[0]?.ronda ?? 1,
        estado: 'programado',
        ganador_id: null,
        participante_1_id: filas[0]?.participante_1_id ?? 1,
        participante_2_id: filas[0]?.participante_2_id ?? 2,
        arbitro_id: -1 // un árbitro que no es el instructor de prueba: obliga a consultar instructores (403 esperado)
      }
    ];
    const omitirEncuentros = (fn, nombre) => noExiste(fn, nombre) || sinDatos(encuentro, 'encuentros');
    await paso('E2.7 PATCH /encuentros/:id/horario (solo EXPLAIN del UPDATE)', () =>
      encuentroService.asignarHorario(encuentro.encuentro_id, { hora_programada: '2026-11-08T10:30' }), {
      omitir: omitirEncuentros(encuentroService.asignarHorario, 'asignarHorario'),
      simular: [
        { si: ESTADO_DEL_ENCUENTRO, filas: torneoEnCurso },
        { si: (q) => q.startsWith('SELECT encuentro_id, estado, ganador_id'), filas: programado }
      ]
    });
    await paso('E2.8 PATCH /encuentros/:id/arbitro (solo EXPLAIN del UPDATE)', () =>
      encuentroService.asignarArbitro(encuentro.encuentro_id, { instructor_id: instructor?.instructor_id ?? 1 }), {
      omitir: omitirEncuentros(encuentroService.asignarArbitro, 'asignarArbitro'),
      simular: [
        { si: ESTADO_DEL_ENCUENTRO, filas: torneoEnCurso },
        { si: (q) => q.startsWith('SELECT estado, ganador_id FROM encuentros_torneo'), filas: programado }
      ]
    });
    await paso('E2.8 PATCH /encuentros/:id/resultado como instructor (403 esperado: no es el árbitro)', () =>
      encuentroService.registrarResultado({ rol: 'instructor', usuario_id: instructor?.usuario_id ?? 0 }, encuentro.encuentro_id, {
        marcador_1: 1,
        marcador_2: 0
      }), {
      omitir: omitirEncuentros(encuentroService.registrarResultado, 'registrarResultado'),
      simular: [
        { si: ESTADO_DEL_ENCUENTRO, filas: torneoEnCurso },
        { si: (q) => q.startsWith('SELECT encuentro_id, torneo_id, ronda, estado'), filas: programado }
      ]
    });

    // Auditoría (E2.10)
    await paso('E2.10 GET /:id/bitacora', () => logService.logsDeRegistro('torneos', torneo.torneo_id), {
      omitir: noExiste(logService.logsDeRegistro, 'logsDeRegistro') || sinDatos(torneo, 'torneos')
    });
    await paso('E2.10 logAudit (solo EXPLAIN del INSERT en logs_sistema)', () =>
      logAudit({ user: { usuario_id: instructor?.usuario_id ?? null }, headers: {} }, {
        accion: 'validador',
        tabla_afectada: 'torneos',
        registro_id: torneo.torneo_id,
        detalles: 'validador de consultas'
      }), { omitir: noExiste(logAudit, 'logAudit') || sinDatos(torneo, 'torneos') });

    // Evaluaciones de instructores (E4). Socio activo con inscripción Confirmada en una sesión con instructor activo.
    const inscrito = await muestra(
      `SELECT s.usuario_id, ic.sesion_id
         FROM inscripciones_clases ic
         JOIN socios s ON s.socio_id = ic.socio_id
         JOIN sesiones_programadas sp ON sp.sesion_id = ic.sesion_id
         JOIN instructores i ON i.instructor_id = sp.instructor_id
        WHERE ic.estado = 'Confirmada' AND s.usuario_id IS NOT NULL AND s.activo IS NOT FALSE AND i.activo IS NOT FALSE
        ORDER BY ic.inscripcion_id LIMIT 1`
    );
    const sinEvaluaciones =
      noExiste(evaluacionService.crearEvaluacion, 'evaluacionService') ||
      (await muestra("SELECT to_regclass('evaluaciones_instructor') IS NULL AS falta")).falta && 'falta la tabla evaluaciones_instructor';
    const staff = { rol: 'admin', usuario_id: 0 };
    await paso('E4 POST /api/evaluaciones (solo EXPLAIN del INSERT)', () =>
      evaluacionService.crearEvaluacion(inscrito.usuario_id, { sesion_id: inscrito.sesion_id, calificacion: 5, comentario: '__validador__' }), {
      omitir: sinEvaluaciones || sinDatos(inscrito, 'socios con inscripción Confirmada en una sesión con instructor activo')
    });
    await paso('E4 GET /api/evaluaciones/mias', () => evaluacionService.misEvaluaciones(inscrito.usuario_id), {
      omitir: sinEvaluaciones || sinDatos(inscrito, 'socios con inscripción Confirmada')
    });
    await paso('E4 GET /api/evaluaciones/mias?periodo', () => evaluacionService.misEvaluaciones(inscrito.usuario_id, '2026-10'), {
      omitir: sinEvaluaciones || sinDatos(inscrito, 'socios con inscripción Confirmada')
    });
    await paso('E4 GET /instructor/:id como staff', () => evaluacionService.listarPorInstructor(staff, instructor.instructor_id), {
      omitir: sinEvaluaciones || sinDatos(instructor, 'instructores')
    });
    await paso('E4 GET /instructor/:id?periodo como instructor (el suyo)', () =>
      evaluacionService.listarPorInstructor({ rol: 'instructor', usuario_id: instructor.usuario_id }, instructor.instructor_id, '2026-10'), {
      omitir: sinEvaluaciones || sinDatos(instructor?.usuario_id, 'instructores con usuario')
    });
    await paso('E4 GET /instructor/:id/promedio como staff', () => evaluacionService.promedioDeInstructor(staff, instructor.instructor_id), {
      omitir: sinEvaluaciones || sinDatos(instructor, 'instructores')
    });
    await paso('E4 GET /instructor/:id/promedio?periodo como staff', () =>
      evaluacionService.promedioDeInstructor(staff, instructor.instructor_id, '2026-10'), {
      omitir: sinEvaluaciones || sinDatos(instructor, 'instructores')
    });
  } finally {
    await real.query('ROLLBACK').catch(() => {});
    await real.end();
  }

  const icono = { ok: '✔', falla: '✘', omitida: '–', omitido: '–', aviso: '⚠' };
  let actual = '';
  for (const r of resultados) {
    if (r.etiqueta !== actual) console.log(`\n${(actual = r.etiqueta)}`);
    const texto = r.estado === 'omitida' ? `(LOCK TABLE: sin EXPLAIN en READ ONLY; la tabla existe) ${r.sql}` : r.sql;
    const marca = r.simulado ? ' (datos simulados)' : '';
    console.log(`  ${icono[r.estado]}${marca} ${texto.slice(0, 160)}${r.error ? `\n      → ${r.error}` : ''}`);
  }
  const fallas = resultados.filter((r) => r.estado === 'falla').length;
  const validas = resultados.filter((r) => r.estado === 'ok').length;
  console.log(`\n${validas} consultas válidas · ${fallas} con error · todo con ROLLBACK, nada escrito.`);
  if (fallas > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
