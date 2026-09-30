const { listarRolesInternos } = require('../services/rolService');

const obtenerRoles = async (req, res) => {
  try {
    res.json(await listarRolesInternos());
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { obtenerRoles };
