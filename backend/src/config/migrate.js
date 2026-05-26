const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');
const MIGRATION_TARGET = process.argv[2];

async function runMigration(filePath) {
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

async function main() {
  try {
    if (MIGRATION_TARGET) {
      const filePath = path.join(MIGRATIONS_DIR, MIGRATION_TARGET);
      if (!fs.existsSync(filePath)) {
        console.error(`Archivo no encontrado: ${filePath}`);
        process.exit(1);
      }
      await runMigration(filePath);
    } else {
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
      for (const file of files) {
        await runMigration(path.join(MIGRATIONS_DIR, file));
      }
    }
    console.log('\nMigración(es) completadas.');
  } catch (err) {
    console.error('\nFalló la migración:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
