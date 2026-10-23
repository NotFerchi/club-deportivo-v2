const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
// Migraciones de torneos en su orden real (ver migracionesTorneos.js)
const MIGRACIONES_TORNEOS = require('./migracionesTorneos');
// Dependen de schema.sql y van al final con --todas (ver migracionesPosteriores.js)
const MIGRACIONES_POSTERIORES = require('./migracionesPosteriores');

const OPCION_TODAS = '--todas';

// Sin argumento no se ejecuta nada: antes corría todas las migraciones contra la base de .env (Neon).
const USO = `Uso (desde backend/):
  npm run migrate -- <archivo.sql>   Ejecuta solo ese archivo de backend/migrations
  npm run migrate -- torneos         Ejecuta solo las migraciones de torneos, en su orden
  npm run migrate -- ${OPCION_TODAS}         Ejecuta TODAS (orden alfabético y, al final, las de torneos y las posteriores a schema.sql)

Sin argumento no se ejecuta nada. Ojo: sin el "--", npm se queda con ${OPCION_TODAS} y el script no lo recibe.`;

/**
 * Archivos a ejecutar, en orden, según el argumento; null si no hay argumento (solo se muestra el uso).
 * Lanza un error si el archivo pedido no existe.
 */
function planMigraciones(objetivo, dir = MIGRATIONS_DIR) {
  if (!objetivo) return null;

  if (objetivo === 'torneos') return [...MIGRACIONES_TORNEOS];

  if (objetivo === OPCION_TODAS) {
    // El resto sigue en orden alfabético (su orden real queda pendiente: GEN-B05).
    // Las de torneos van al final, después de schema.sql, en su orden real; luego las posteriores.
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql') && !MIGRACIONES_TORNEOS.includes(f) && !MIGRACIONES_POSTERIORES.includes(f))
      .sort();
    return [...files, ...MIGRACIONES_TORNEOS, ...MIGRACIONES_POSTERIORES];
  }

  if (!fs.existsSync(path.join(dir, objetivo))) {
    throw new Error(`Archivo no encontrado: ${path.join(dir, objetivo)}`);
  }
  return [objetivo];
}

async function runMigration(pool, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const name = path.basename(filePath);
  console.log(`Ejecutando migración: ${name}`);
  try {
    await pool.query(sql);
    console.log(`  ✓ ${name} completada`);
  } catch (err) {
    console.error(`  ✗ Error en ${name}: ${err.message}`);
    throw err;
  }
}

async function main(objetivo) {
  let archivos;
  try {
    archivos = planMigraciones(objetivo);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  if (archivos === null) {
    console.error(USO);
    process.exitCode = 1;
    return;
  }

  // La conexión se crea solo cuando hay algo que ejecutar
  require('dotenv').config();
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    for (const file of archivos) {
      await runMigration(pool, path.join(MIGRATIONS_DIR, file));
    }
    console.log('\nMigración(es) completadas.');
  } catch (err) {
    console.error('\nFalló la migración:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main(process.argv[2]);
}

module.exports = { planMigraciones, OPCION_TODAS, USO };
