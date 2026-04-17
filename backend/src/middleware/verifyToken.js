const jwt = require('jsonwebtoken');

/**
 * DOCUMENTACIÓN PARA AARON Y FER:
 * Este middleware verifica que el usuario haya iniciado sesión y tenga un token válido.
 * Uso: Solo impórtenlo y pónganlo en la ruta antes del controlador.
 * Ejemplo: router.get('/ruta-protegida', verifyToken, controlador);
 */
const verifyToken = (req, res, next) => {
    // 1. Extraemos el header Authorization
    const authHeader = req.header('Authorization');

    // Si no existe o no empieza con "Bearer ", lo rebotamos
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Token no proporcionado" });
    }

    // Sacamos solo el token (quitando el texto "Bearer ")
    const token = authHeader.split(' ')[1];

    try {
        // 2. Verificamos que el token sea real y no haya caducado
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Asignamos los datos del usuario (payload) a req.user para que el backend los use
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Token inválido o expirado" });
    }
};

module.exports = verifyToken;
