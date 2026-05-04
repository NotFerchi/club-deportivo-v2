require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

require('./src/config/database');

// --- IMPORTAR RUTAS ---
const ludotecaRoutes    = require('./src/routes/ludoteca.routes');
const authRoutes        = require('./src/routes/auth.routes');
const socioRoutes       = require('./src/routes/socio.routes');
const usuariosRoutes    = require('./src/routes/usuarios.routes');
const sesionesRoutes    = require('./src/routes/sesiones.routes');
const inscripcionesRoutes = require('./src/routes/inscripciones.routes');
const rolesRoutes       = require('./src/routes/roles.routes');
const espaciosRoutes    = require('./src/routes/espacios.routes');
const recepcionRoutes   = require('./src/routes/recepcion.routes');
const disciplinasRoutes = require('./src/routes/disciplinas.routes');
const instructorRoutes  = require('./src/routes/instructor.routes');
const reservasRoutes    = require('./src/routes/reservas.routes');
const instructoresRoutes= require('./src/routes/instructores.routes');
const sancionesRoutes   = require('./src/routes/sanciones.routes');
const logsRoutes        = require('./src/routes/logs.routes');
const torneosRoutes     = require('./src/routes/torneos.routes');
const encuentrosRoutes  = require('./src/routes/encuentros.routes');
const errorHandler      = require('./src/middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Servidor funcionando' });
});

// --- REGISTRAR RUTAS ---
app.use('/api/auth',              authRoutes);
app.use('/api/socios',            socioRoutes);
app.use('/api/usuarios',          usuariosRoutes);
app.use('/api/usuarios-internos', usuariosRoutes);
app.use('/api/roles',             rolesRoutes);
app.use('/api/espacios',          espaciosRoutes);
app.use('/api/recepcion',         recepcionRoutes);
app.use('/api/instructor',        instructorRoutes);
app.use('/api/instructores',      instructoresRoutes);
app.use('/api/sanciones',         sancionesRoutes);
app.use('/api/sesiones',          sesionesRoutes);
app.use('/api/logs',              logsRoutes);
app.use('/api/ludoteca',          ludotecaRoutes);
app.use('/api/inscripciones',     inscripcionesRoutes);
app.use('/api/disciplinas',       disciplinasRoutes);
app.use('/api/reservas',          reservasRoutes);
app.use('/api/torneos',           torneosRoutes);
app.use('/api/encuentros',        encuentrosRoutes);

// Comentadas temporalmente
// app.use('/api/reportes', reportesRoutes);

// Middleware de errores
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.url });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log('\nEndpoints activos:');
  console.log('  - GET  /api/health');
  console.log('  - ALL  /api/auth');
  console.log('  - ALL  /api/usuarios');
  console.log('  - ALL  /api/roles');
  console.log('  - ALL  /api/espacios');
  console.log('  - ALL  /api/recepcion');
  console.log('  - ALL  /api/disciplinas');
  console.log('  - ALL  /api/socios');
  console.log('  - ALL  /api/instructor');
  console.log('  - ALL  /api/instructores');
  console.log('  - ALL  /api/reservas');
  console.log('  - ALL  /api/torneos');
  console.log('  - ALL  /api/encuentros');
  console.log('  - ALL  /api/ludoteca');
  console.log('\nOtros endpoints estan comentados temporalmente');
});
