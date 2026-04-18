// Dependencias requeridas para levantar la API
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');  // ← Importa las rutas de auth

const app = express();
const puerto = 3000;

// Configuracion de middlewares de seguridad y parseo
app.use(cors());
app.use(express.json());

// Registro de endpoints de la aplicacion
app.use('/api/auth', authRoutes);  // ← REGISTRA LAS RUTAS DE AUTENTICACIÓN
app.post('/api/socios', crearSocio);  // O usa socioRoutes si existe

app.listen(puerto, () => {
    console.log(`API activa y escuchando en http://localhost:${puerto}`);
});