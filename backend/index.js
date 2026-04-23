const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

// Importar conexión DB
require('./src/config/database');

// Importar rutas (comenta las que no están listas)
const authRoutes = require('./src/routes/auth.routes');
const sociosRoutes = require('./src/routes/socio.routes');
const usuariosRoutes = require('./src/routes/usuarios.routes');
const rolesRoutes = require('./src/routes/roles.routes');
const espaciosRoutes = require('./src/routes/espacios.routes');
const recepcionRoutes = require('./src/routes/recepcion.routes');
const disciplinasRoutes = require('./src/routes/disciplinas.routes');

// COMENTA TEMPORALMENTE LAS QUE NO TIENEN CONTROLADOR
// const instructorRoutes = require('./src/routes/instructor.routes');
// const instructoresRoutes = require('./src/routes/instructores.routes');
// const sesionesRoutes = require('./src/routes/sesiones.routes');
const reservasRoutes = require('./src/routes/reservas.routes');
// const ludotecaRoutes = require('./src/routes/ludoteca.routes');
const sancionesRoutes = require('./src/routes/sanciones.routes');
const logsRoutes = require('./src/routes/logs.routes');

const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '🚀 Servidor funcionando' });
});

// Registrar rutas (solo las que están disponibles)
app.use('/api/auth', authRoutes);
app.use('/api/socios', sociosRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/espacios', espaciosRoutes);
app.use('/api/recepcion', recepcionRoutes);
app.use('/api/disciplinas', disciplinasRoutes);

// Comentadas temporalmente
// app.use('/api/instructor', instructorRoutes);
// app.use('/api/instructores', instructoresRoutes);
// app.use('/api/sesiones', sesionesRoutes);
app.use('/api/reservas', reservasRoutes);
// app.use('/api/ludoteca', ludotecaRoutes);
app.use('/api/sanciones', sancionesRoutes);
app.use('/api/logs', logsRoutes);
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
  console.log('  - GET  /api/socios');
  console.log('  - GET  /api/usuarios');
  console.log('  - GET  /api/roles');
  console.log('  - GET  /api/espacios/todos');
  console.log('  - GET  /api/recepcion/visitas/activas');
  console.log('  - GET  /api/disciplinas');
  console.log('\n⚡ Otros endpoints están comentados temporalmente');
});