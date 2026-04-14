const express = require('express');
const cors = require('cors'); // INTEGRACIÓN DE CORS
const app = express();

app.use(cors()); // <-- 2. Lo activas
app.use(express.json());

// rutas
const authRoutes = require('./routes/auth.routes');
const sociosRoutes = require('./routes/socios.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const espaciosRoutes = require('./routes/espacios.routes');

app.use('/api/auth', authRoutes);
app.use('/api/socios', sociosRoutes);
app.use('/api/usuarios-internos', usuariosRoutes);
app.use('/api/espacios', espaciosRoutes);

// health
app.get('/api/health', (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;