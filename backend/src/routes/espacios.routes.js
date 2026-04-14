const express = require('express');
const router = express.Router();
const EspacioModel = require('../models/espacio.model');
const { verifyToken } = require('../middlewares/auth'); // ajusta ruta

router.get('/espacios', verifyToken, async (req, res) => {
  try {
    const { fecha, horaInicio, horaFin } = req.query;

    // Si no hay filtro de fecha/horas → devolver todos
    if (!fecha || !horaInicio || !horaFin) {
      const espacios = await EspacioModel.listarTodos();
      return res.json(espacios);
    }

    // Con filtros → devolver solo disponibles
    const todos = await EspacioModel.listarTodos();

    const disponibles = [];
    for (const espacio of todos) {
      const disponible = await EspacioModel.verificarDisponibilidad(
        espacio.espacio_id,
        fecha,
        horaInicio,
        horaFin
      );
      if (disponible) {
        disponibles.push(espacio);
      }
    }

    return res.json(disponibles);
  } catch (error) {
    console.error('Error GET /api/espacios', error);
    return res.status(500).json({ message: 'Error al consultar espacios' });
  }
});

module.exports = router;