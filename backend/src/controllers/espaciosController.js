const EspacioModel = require('../models/EspacioModel');

const espaciosController = {

    getEspacios: async (req, res) => {
        try {
            const { fecha, horaInicio, horaFin } = req.query;

            const todosLosEspacios = await EspacioModel.listarTodos();

            // SIN FILTROS → estado base
            if (!fecha || !horaInicio || !horaFin) {
                const respuestaBase = todosLosEspacios.map(esp => ({
                    id: esp.espacio_id,
                    nombre: esp.nombre,
                    tipo: esp.tipo_disciplina,
                    estado: esp.en_mantenimiento ? 'mantenimiento' : 'disponible',
                    motivo: esp.motivo_mantenimiento || "",
                    capacidad: esp.capacidad_maxima
                }));
                return res.json(respuestaBase);
            }

            // CON FILTROS → estado real
            const espaciosConEstadoReal = [];

            for (const espacio of todosLosEspacios) {

                const infoEstado = await EspacioModel.verificarEstadoCompleto(
                    espacio.espacio_id,
                    fecha,
                    horaInicio,
                    horaFin
                );

                espaciosConEstadoReal.push({
                    id: espacio.espacio_id,
                    nombre: espacio.nombre,
                    tipo: espacio.tipo_disciplina,
                    estado: infoEstado.estado,
                    motivo: infoEstado.motivo,
                    capacidad: espacio.capacidad_maxima
                });
            }

            return res.json(espaciosConEstadoReal);

        } catch (error) {
            console.error('Error en getEspacios:', error);
            return res.status(500).json({ error: 'Error interno' });
        }
    }
};

module.exports = espaciosController;