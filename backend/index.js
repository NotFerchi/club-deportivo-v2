const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

require('./src/config/database');

const authRoutes         = require('./src/routes/auth.routes');
const socioRoutes        = require('./src/routes/socio.routes');
const usuariosRoutes     = require('./src/routes/usuarios.routes');
const rolesRoutes        = require('./src/routes/roles.routes');
const espaciosRoutes     = require('./src/routes/espacios.routes');
const recepcionRoutes    = require('./src/routes/recepcion.routes');
const instructorRoutes   = require('./src/routes/instructor.routes');
const instructoresRoutes = require('./src/routes/instructores.routes');
const sancionesRoutes    = require('./src/routes/sanciones.routes');
const sesionesRoutes     = require('./src/routes/sesiones.routes');
const logsRoutes         = require('./src/routes/logs.routes');
const errorHandler       = require('./src/middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '🚀 Servidor funcionando' });
});

app.use('/api/auth',              authRoutes);
app.use('/api/socios',            socioRoutes);
app.use('/api/usuarios-internos', usuariosRoutes);
app.use('/api/roles',             rolesRoutes);
app.use('/api/espacios',          espaciosRoutes);
app.use('/api/recepcion',         recepcionRoutes);
app.use('/api/instructor',        instructorRoutes);
app.use('/api/instructores',      instructoresRoutes);
app.use('/api/sanciones',         sancionesRoutes);
app.use('/api/sesiones',          sesionesRoutes);
app.use('/api/logs',              logsRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.url });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});