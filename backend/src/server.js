//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js


// Dependencias requeridas para levantar la API
const express = require('express');
const cors = require('cors');
const app = express();
const puerto = 3000;

// Configuracion de middlewares
app.use(cors());
app.use(express.json());

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const sociosRoutes = require('./routes/socios.routes');
const recepcionRoutes = require('./src/routes/recepcion.routes');
const instructorRoutes = require('./src/routes/instructor.routes');
const usuariosRoutes = require('./src/routes/usuarios.routes');
const espaciosRoutes = require('./src/routes/espacios.routes');
const logsRoutes = require('./src/routes/logs.routes');
const sancionesRoutes = require('./src/routes/sanciones.routes');
const instructoresRoutes = require('./src/routes/instructores.routes');
const sesionesRoutes = require('./src/routes/sesiones.routes');
const disciplinasRoutes = require('./src/routes/disciplinas.routes');
const reportesRoutes = require('./src/routes/reportes.routes');

// Registrar rutas
app.use('/api/auth', authRoutes);
app.use('/api/socios', sociosRoutes);
app.use('/api/recepcion', recepcionRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/espacios', espaciosRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/sanciones', sancionesRoutes);
app.use('/api/instructores', instructoresRoutes);
app.use('/api/sesiones', sesionesRoutes);
app.use('/api/disciplinas', disciplinasRoutes);
app.use('/api/reportes', reportesRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: "ok" });
});

// Iniciar servidor
app.listen(puerto, () => {
    console.log(`API activa y escuchando en http://localhost:${puerto}`);
});

//ESTE ARCHIVO NO SE ESTA USANDO, USA index.js
