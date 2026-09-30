'use strict';

const accesoService = require('../services/accesoService');
const ServiceError = require('../services/serviceError');

const accesoMetricasController = {
  getMetricas: async (req, res) => {
    try {
      const { desde, hasta, tipo } = req.query;
      return res.status(200).json(await accesoService.obtenerMetricas({ desde, hasta, tipo }));
    } catch (error) {
      if (error instanceof ServiceError) return res.status(error.status).json(error.body);
      console.error('Error en getMetricas:', error);
      return res.status(500).json({ error: 'Error al obtener métricas de acceso' });
    }
  }
};

module.exports = accesoMetricasController;
