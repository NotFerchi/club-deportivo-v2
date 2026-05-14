// Alias de auth.middleware para compatibilidad con imports existentes
const { verifyToken } = require('./auth.middleware');
module.exports = verifyToken;
