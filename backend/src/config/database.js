const { Pool } = require('pg');
require('dotenv').config();

console.log('📡 Conectando a Neon...');

// Configuración para Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,  // ← Importante para Neon
    },
    connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
    console.log('✅ Conectado a la base de datos Neon');
});

pool.on('error', (err) => {
    console.error('❌ Error en la base de datos:', err.message);
});

module.exports = pool;