const { Pool, types } = require('pg');
require('dotenv').config();

// TIMESTAMP WITHOUT TIME ZONE (OID 1114) se almacena como UTC en Neon.
// postgres-date construye el Date con new Date(y,m,d,h,m,s) = hora LOCAL del proceso
// Node.js, lo que es incorrecto cuando el servidor corre en México (CDT = UTC-5).
// Forzamos interpretación UTC para que JSON.stringify emita la "Z" correcta.
types.setTypeParser(1114, (val) => (val ? new Date(val + '+00') : null));

console.log('Conectando a Neon...');
console.log('DATABASE_URL actual:', process.env.DATABASE_URL ? 'Cargada correctamente' : 'ESTA VACIA');
console.log('DATABASE_URL detectada:', process.env.DATABASE_URL ? 'SI' : 'NO');
console.log('Puerto detectado:', process.env.PORT || 'No detectado');
// Configuración para Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,  // ← Importante para Neon
    },
    connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
    console.log('Conectado a la base de datos Neon');
});

pool.on('error', (err) => {
    console.error('Error en la base de datos:', err.message);
});

module.exports = pool;
