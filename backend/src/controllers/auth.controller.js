const { logAudit } = require('../utils/auditLogger');
const authService = require('../services/authService');
const ServiceError = require('../services/serviceError');

exports.login = async (req, res) => {
  const { email, contrasena } = req.body;

  try {
    const { usuarioBD, token } = await authService.autenticar(email, contrasena);

    await logAudit(req, {
      usuario_id: usuarioBD.usuario_id,
      accion: 'login',
      tabla_afectada: 'usuarios',
      registro_id: usuarioBD.usuario_id,
      detalles: `Inicio de sesion correcto para rol ${usuarioBD.rol}`
    });

    const extraData = await authService.datosExtraSocio(usuarioBD);
    res.json({ token, usuario: authService.usuarioRespuesta(usuarioBD, extraData) });
  } catch (error) {
    if (error instanceof ServiceError) {
      return res.status(error.status).json(error.body);
    }
    console.error('ERROR EN EL LOGIN:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
