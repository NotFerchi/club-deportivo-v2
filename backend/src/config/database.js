const { Pool, types } = require('pg');
require('dotenv').config();

console.log('Conectando a Neon...');
console.log('DATABASE_URL actual:', process.env.DATABASE_URL ? 'Cargada correctamente' : 'ESTA VACIA');
console.log('DATABASE_URL detectada:', process.env.DATABASE_URL ? 'SI' : 'NO');
console.log('Puerto detectado:', process.env.PORT || 'No detectado');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 10000,
});

pool.on('connect', (client) => {
    console.log('Conectado a la base de datos Neon');
    client.query("SET timezone = 'America/Mexico_City'").catch(() => {});
});

pool.on('error', (err) => {
    console.error('Error en la base de datos:', err.message);
});

module.exports = pool;
