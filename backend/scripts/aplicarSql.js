// Aplica un archivo .sql (script de datos o migración) en UNA transacción y muestra el resultado
// de cada sentencia. Hay que elegir el destino de forma explícita:
//
//   node scripts/aplicarSql.js <archivo.sql> --branch      → NEON_BRANCH_URL de backend/.env.paso7
//   node scripts/aplicarSql.js <archivo.sql> --principal   → DATABASE_URL de backend/.env
//   ... --ensayo   → corre todo y hace ROLLBACK (no guarda nada)
//
// Si el archivo trae su propio BEGIN/COMMIT, se quitan: la transacción la controla este script.
// Con --branch, se detiene si el host del branch es el mismo que el de la BD principal.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

const BACKEND = path.join(__dirname, '..');
const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const usarBranch = args.includes('--branch');
const usarPrincipal = args.includes('--principal');
const ensayo = args.includes('--ensayo');

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

function imprimir(resultado) {
  if (resultado.command !== 'SELECT') {
    console.log(`${resultado.command}${resultado.rowCount !== null ? ` ${resultado.rowCount}` : ''}`);
    return;
  }
  if (!resultado.rows.length) {
    console.log('(0 filas)');
    return;
  }
  const cols = resultado.fields.map((f) => f.name);
  const valor = (v) => (v === null ? 'NULL' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  console.log(cols.join(' | '));
  for (const fila of resultado.rows) console.log(cols.map((c) => valor(fila[c])).join(' | '));
}

(async () => {
  if (!archivo) salir('Uso: node scripts/aplicarSql.js <archivo.sql> --branch|--principal [--ensayo]');
  const ruta = path.resolve(process.cwd(), archivo);
  if (!fs.existsSync(ruta)) salir(`No existe ${ruta}`);
  // La transacción la controla este script: se quitan BEGIN; y COMMIT; sueltos del archivo
  const sql = fs
    .readFileSync(ruta, 'utf8')
    .replace(/^\s*BEGIN\s*;\s*$/gim, '')
    .replace(/^\s*COMMIT\s*;\s*$/gim, '');

  const { nombre, url } = destino();
  console.log(`Archivo: ${path.basename(ruta)}`);
  console.log(`Destino: ${nombre}${ensayo ? ' (ENSAYO: se hace ROLLBACK)' : ''}\n`);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');
    const resultados = await client.query(sql);
    for (const r of [].concat(resultados)) imprimir(r);
    await client.query(ensayo ? 'ROLLBACK' : 'COMMIT');
    console.log(`\n${ensayo ? 'ROLLBACK: no se guardó nada.' : 'COMMIT: cambios guardados.'}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\nError (${err.code || 'sin código'}): ${err.message}\nROLLBACK: no se guardó nada.`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
