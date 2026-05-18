require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido. Revisa tu archivo .env');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida. Revisa tu archivo .env');
}

const express = require('express');
const cors = require('cors');

require('./src/config/database');

const ludotecaRoutes      = require('./src/routes/ludoteca.routes');
const authRoutes          = require('./src/routes/auth.routes');
const qrRoutes            = require('./src/routes/qr.routes');
const accesoRoutes        = require('./src/routes/acceso.routes');
const socioRoutes         = require('./src/routes/socio.routes');
const usuariosRoutes      = require('./src/routes/usuarios.routes');
const sesionesRoutes      = require('./src/routes/sesiones.routes');
const inscripcionesRoutes = require('./src/routes/inscripciones.routes');
const rolesRoutes         = require('./src/routes/roles.routes');
const espaciosRoutes      = require('./src/routes/espacios.routes');
const recepcionRoutes     = require('./src/routes/recepcion.routes');
const disciplinasRoutes   = require('./src/routes/disciplinas.routes');
const instructorRoutes    = require('./src/routes/instructor.routes');
const reservasRoutes      = require('./src/routes/reservas.routes');
const instructoresRoutes  = require('./src/routes/instructores.routes');
const sancionesRoutes     = require('./src/routes/sanciones.routes');
const logsRoutes          = require('./src/routes/logs.routes');
const torneosRoutes       = require('./src/routes/torneos.routes');
const encuentrosRoutes    = require('./src/routes/encuentros.routes');
const reportesRoutes      = require('./src/routes/reportes.routes');
const importacionRoutes   = require('./src/routes/importacion.routes');
const errorHandler        = require('./src/middleware/errorHandler');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Servidor funcionando' });
});

app.use('/api/auth',          authRoutes);
app.use('/api/qr',            qrRoutes);
app.use('/api/acceso',        accesoRoutes);
app.use('/api/socios',        socioRoutes);
app.use('/api/usuarios',      usuariosRoutes);
app.use('/api/roles',         rolesRoutes);
app.use('/api/espacios',      espaciosRoutes);
app.use('/api/recepcion',     recepcionRoutes);
app.use('/api/instructor',    instructorRoutes);
app.use('/api/instructores',  instructoresRoutes);
app.use('/api/sanciones',     sancionesRoutes);
app.use('/api/sesiones',      sesionesRoutes);
app.use('/api/logs',          logsRoutes);
app.use('/api/ludoteca',      ludotecaRoutes);
app.use('/api/inscripciones', inscripcionesRoutes);
app.use('/api/disciplinas',   disciplinasRoutes);
app.use('/api/reservas',      reservasRoutes);
app.use('/api/torneos',       torneosRoutes);
app.use('/api/encuentros',    encuentrosRoutes);
app.use('/api/reportes',      reportesRoutes);
app.use('/api/importacion',   importacionRoutes);

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', path: req.url });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
