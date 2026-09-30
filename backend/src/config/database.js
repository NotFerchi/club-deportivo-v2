const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ No se encontró NEON_DATABASE_URL ni DATABASE_URL en tu .env');
}

// Patrón Singleton para reutilizar una sola conexión del pool y evitar agotamiento
const poolSingleton = global.__pgPool || new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: {
    rejectUnauthorized: false,
  },
});

global.__pgPool = poolSingleton;

// Si quieres mantener la zona horaria local del sistema
poolSingleton.on('connect', (client) => {
  client.query("SET timezone = 'America/Mexico_City'").catch(() => {});
});

poolSingleton.on('error', (err) => {
  console.error('Error inesperado en el cliente PostgreSQL inactivo:', err);
});

module.exports = poolSingleton;