// Dependencias requeridas para levantar la API
const express = require('express');
const cors = require('cors'); 
const { crearSocio } = require('./controllers/socioController');

const app = express();
const puerto = 3000;

// Configuracion de middlewares de seguridad y parseo
app.use(cors()); 
app.use(express.json());

// Registro de endpoints de la aplicacion
app.post('/api/socios', crearSocio);

app.listen(puerto, () => {
    console.log(`API activa y escuchando en http://localhost:${puerto}`);
});
