/**
 * DOCUMENTACIÓN PARA AARON Y FER:
 * Este middleware verifica si el usuario tiene el nivel/rol necesario para ejecutar la acción.
 * * Roles existentes en el sistema: 
 * - 'admin': Acceso total a todas las rutas del sistema.
 * - 'gerente': Acceso a reportes, gestión de empleados, etc.
 * - 'coordinador': Acceso a gestionar clases, horarios, etc.
 * - 'instructor': Acceso a gestionar sus propias clases, ver asistencias, etc.
 * - 'recepcion': Acceso a crear/editar socios, registrar pagos, etc.
 * - 'socio': Acceso exclusivo a su propia información (ver su perfil, clases, reservas).
 * * REGLA: Siempre debe ir DESPUÉS de verifyToken.
 * * Ejemplos de uso: 
 * router.delete('/borrar-socio', verifyToken, checkRole(['admin']), controlador);
 * router.get('/mis-datos', verifyToken, checkRole(['socio', 'admin']), controlador);
 */
const checkRole = (rolesPermitidos) => {
    return (req, res, next) => {
        // Verificamos si el rol del usuario actual está dentro del arreglo de roles permitidos
        if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
            return res.status(403).json({ error: "No tienes permisos para esta acción" });
        }
        
        // Si el rol coincide, lo dejamos pasar al controlador
        next();
    };
};

module.exports = checkRole;
