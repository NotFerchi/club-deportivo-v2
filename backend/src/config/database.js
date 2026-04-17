const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
  if (err) console.error('Error conectando a Neon:', err.message);
  else { console.log('Conectado a Neon DB'); release(); }
});

module.exports = pool;
