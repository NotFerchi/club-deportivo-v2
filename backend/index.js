const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

require('./src/config/database');

const authRoutes       = require('./src/routes/auth.routes'); 
const socioRoutes      = require('./src/routes/socio.routes');  
const usuariosRoutes   = require('./src/routes/usuarios.routes');
const rolesRoutes      = require('./src/routes/roles.routes');
const instructorRoutes    = require('./src/routes/instructor.routes');
const instructoresRoutes  = require('./src/routes/instructores.routes');
const errorHandler     = require('./src/middleware/errorHandler'); 

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: '🚀 Servidor funcionando' });
});

app.use('/api/auth',              authRoutes); 
app.use('/api/socios',            socioRoutes);     
app.use('/api/usuarios-internos', usuariosRoutes); 
app.use('/api/roles',             rolesRoutes);
app.use('/api/instructor',        instructorRoutes);
app.use('/api/instructores',      instructoresRoutes);

app.use(errorHandler);                     

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`El Servidor esta corriendo en http://localhost:${PORT}`);
});