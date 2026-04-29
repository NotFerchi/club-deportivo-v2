require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') }); // <-- ESTA DEBE SER LA LÍNEA 1
const express = require('express');
const cors = require('cors');
//require('dotenv').config({ path: '../.env' });

require('./src/config/database');

// COMENTA TEMPORALMENTE LAS QUE NO TIENEN CONTROLADOR
const ludotecaRoutes = require('./src/routes/ludoteca.routes');

// --- IMPORTAR RUTAS ---
const authRoutes = require('./src/routes/auth.routes');
const socioRoutes = require('./src/routes/socio.routes'); // Verifica si es socio o socios
const usuariosRoutes = require('./src/routes/usuarios.routes');
const sesionesRoutes = require('./src/routes/sesiones.routes');
const inscripcionesRoutes = require('./src/routes/inscripciones.routes');
const rolesRoutes = require('./src/routes/roles.routes');
const espaciosRoutes = require('./src/routes/espacios.routes');
const recepcionRoutes = require('./src/routes/recepcion.routes');
const disciplinasRoutes = require('./src/routes/disciplinas.routes');
const instructorRoutes = require('./src/routes/instructor.routes');
const instructoresRoutes = require('./src/routes/instructores.routes');
const reservasRoutes = require('./src/routes/reservas.routes');
const sancionesRoutes = require('./src/routes/sanciones.routes');
const logsRoutes = require('./src/routes/logs.routes');

const errorHandler = require('./src/middleware/errorHandler');


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Logging para debugging (Muy útil en desarrollo)
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '🚀 Servidor funcionando' });
});

<<<<<<< Updated upstream
// 2. Conectamos la ruta exacta que pide tu frontend
app.use('/api/usuarios-internos', usuariosRoutes); 
// Rutas para el módulo de clases
app.use('/api/sesiones', sesionesRoutes);
=======
// --- REGISTRAR RUTAS ---

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
app.use('/api/ludoteca',          ludotecaRoutes);

>>>>>>> Stashed changes
app.use('/api/inscripciones', inscripcionesRoutes);
// --- REGISTRAR RUTAS ---
app.use('/api/auth', authRoutes);
app.use('/api/socios', socioRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/espacios', espaciosRoutes);
app.use('/api/recepcion', recepcionRoutes);
app.use('/api/disciplinas', disciplinasRoutes);

// Rutas de Instructores (Activadas de la rama de funcionalidades)
app.use('/api/instructor', instructorRoutes);
app.use('/api/instructores', instructoresRoutes);

// Otras rutas del sistema
app.use('/api/reservas', reservasRoutes);
app.use('/api/sanciones', sancionesRoutes);
app.use('/api/logs', logsRoutes);

// Comentadas temporalmente
// app.use('/api/reportes', reportesRoutes);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.url });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log('\n📋 Endpoints activos:');
  console.log('  - GET  /api/health');
  console.log('  - ALL  /api/auth');
  console.log('  - ALL  /api/usuarios');
  console.log('  - ALL  /api/roles');
  console.log('  - ALL  /api/espacios/todos');
  console.log('  - ALL  /api/recepcion/visitas/activas');
  console.log('  - ALL  /api/disciplinas');
  console.log('  - ALL  /api/socios');
  console.log('  - ALL  /api/instructor');
  console.log('  - ALL  /api/instructores');
  console.log('  - ALL  /api/reservas');
  console.log('  - ALL  /api/ludoteca');
  console.log('\n⚡ Otros endpoints están comentados temporalmente');
});
