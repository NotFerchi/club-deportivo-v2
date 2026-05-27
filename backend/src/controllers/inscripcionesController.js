const pool = require('../config/database');
const { getTableColumns } = require('../utils/adminRules');
const { getMexicoDateISO } = require('../utils/mexicoDate');

const inscripcionesController = {
    // ============================================
    // INSCRIBIR SOCIO A UNA CLASE
    // ============================================
inscribir: async (req, res) => {
        const { sesionId, socioId } = req.body;
        
        if (!sesionId || !socioId) {
            return res.status(400).json({ error: 'Faltan datos requeridos: sesionId y socioId' });
        }
        
        try {
            // 1. Verificar sesión y que el ESPACIO esté activo (JOIN con espacios)
            const espacioCols = await getTableColumns('espacios');
            const estadoCond = espacioCols.has('estado')
              ? "AND LOWER(COALESCE(e.estado, 'activo')) <> 'mantenimiento'"
              : '';
            const mantenimientoCols = await getTableColumns('mantenimiento_espacios');
            const mantenimientoCond = mantenimientoCols.size > 0
              ? `AND NOT EXISTS (
                    SELECT 1
                    FROM mantenimiento_espacios me
                    WHERE me.espacio_id = e.espacio_id
                      ${mantenimientoCols.has('activo') ? "AND COALESCE(me.activo, true) = true" : ''}
                  )`
              : '';
            const sesionQuery = `
                SELECT sp.sesion_id, sp.cupo_maximo, sp.dia_semana, sp.hora_inicio, sp.hora_fin
                FROM sesiones_programadas sp
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                WHERE sp.sesion_id = $1
                  AND e.activo = true
                  ${estadoCond}
                  ${mantenimientoCond}`;

            const sesion = await pool.query(sesionQuery, [sesionId]);
            
            if (sesion.rows.length === 0) {
                return res.status(404).json({ error: 'La clase no existe o el espacio no está disponible' });
            }
            
            const { cupo_maximo, dia_semana, hora_inicio, hora_fin } = sesion.rows[0];

            // 2. Revisar si el socio YA TIENE OTRA CLASE a esa misma hora (OVERLAPS)
            const choqueQuery = `
                SELECT d.nombre as disciplina
                FROM inscripciones_clases ic
                JOIN sesiones_programadas sp ON ic.sesion_id = sp.sesion_id
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                WHERE ic.socio_id = $1 
                  AND sp.dia_semana = $2
                  AND ic.estado = 'Confirmada'
                  AND (sp.hora_inicio, sp.hora_fin) OVERLAPS ($3::time, $4::time)`;
            
            const choque = await pool.query(choqueQuery, [socioId, dia_semana, hora_inicio, hora_fin]);
            
            if (choque.rows.length > 0) {
                return res.status(400).json({
                    error: `Choque de horario: Ya estás inscrito en ${choque.rows[0].disciplina} a esta hora.`
                });
            }

            // 2b. Verificar solapamiento con reservas de cancha del mismo día
            // (solo si la sesión ocurre el día de hoy)
            // sesiones_programadas.dia_semana: Lun=1, Mar=2 … Sáb=6, Dom=7
            // JS getDay(): Dom=0, Lun=1, Mar=2 … Sáb=6
            // Conversión: getDay()===0 → 7 (Dom), else getDay() (Lun=1…Sáb=6)
            try {
                const hoy = getMexicoDateISO();
                const [y, mo, d] = hoy.split('-').map(Number);
                const jsDay = new Date(y, mo - 1, d).getDay(); // 0=Dom, 1=Lun … 6=Sáb
                const diaSemanaHoy = jsDay === 0 ? 7 : jsDay;  // Lun=1 … Sáb=6, Dom=7
                if (Number(dia_semana) === diaSemanaHoy) {
                    const reservaConflicto = await pool.query(
                        `SELECT 1
                         FROM reservaciones
                         WHERE socio_id = $1
                           AND fecha_reserva = $2::date
                           AND LOWER(estado::text) NOT IN ('cancelada', 'cancelado')
                           AND hora_inicio < $4::time
                           AND hora_fin    > $3::time
                         LIMIT 1`,
                        [socioId, hoy, hora_inicio, hora_fin]
                    );
                    if (reservaConflicto.rows.length > 0) {
                        return res.status(400).json({
                            error: 'Tienes una reserva de cancha activa en ese horario.'
                        });
                    }
                }
            } catch (e) {
                console.warn('No se pudo verificar solapamiento con reservas:', e.message);
            }

            // 3. Verificar si ya existe un registro para este socio y sesión
            const existeQuery = `
                SELECT inscripcion_id, estado, fecha_inscripcion 
                FROM inscripciones_clases 
                WHERE sesion_id = $1 AND socio_id = $2`;
            
            const existente = await pool.query(existeQuery, [sesionId, socioId]);
            
            if (existente.rows.length > 0) {
                // Ya existe un registro
                const registro = existente.rows[0];
                
                if (registro.estado === 'Confirmada') {
                    // Caso A: Ya está confirmado → error
                    return res.status(400).json({ error: 'Ya estás inscrito en esta clase' });
                } 
                else if (registro.estado === 'Cancelada') {
                    // Caso B: Está cancelada → reactivar
                    const reactivateQuery = `
                        UPDATE inscripciones_clases 
                        SET estado = 'Confirmada', 
                            fecha_inscripcion = NOW() 
                        WHERE inscripcion_id = $1
                        RETURNING inscripcion_id`;
                    
                    const reactivate = await pool.query(reactivateQuery, [registro.inscripcion_id]);
                    
                    return res.status(201).json({ 
                        message: 'Inscripción reactivada exitosamente',
                        inscripcion_id: reactivate.rows[0].inscripcion_id
                    });
                }
            }

            // 4. Verificar cupos disponibles
            const conteo = await pool.query(
                `SELECT COUNT(*) as total FROM inscripciones_clases 
                 WHERE sesion_id = $1 AND estado = 'Confirmada'`,
                [sesionId]
            );
            
            const inscritos = parseInt(conteo.rows[0].total);
            if (inscritos >= cupo_maximo) {
                return res.status(400).json({ error: 'La clase está llena' });
            }
            
            // 5. Realizar la inscripción (INSERT)
            const result = await pool.query(
                `INSERT INTO inscripciones_clases (sesion_id, socio_id, estado) 
                 VALUES ($1, $2, 'Confirmada') 
                 RETURNING inscripcion_id`,
                [sesionId, socioId]
            );
            
            res.status(201).json({ 
                message: 'Inscripción exitosa',
                inscripcion_id: result.rows[0].inscripcion_id
            });

        } catch (error) {
            if (error.code === '23505') { 
                return res.status(400).json({ error: 'Ya estás inscrito en esta clase' });
            }
            console.error('Error en inscribir:', error);
            res.status(500).json({ error: 'Error al procesar la inscripción' });
        }
    },

    // ============================================
    // CANCELAR INSCRIPCIÓN
    // ============================================
    cancelar: async (req, res) => {
        const { sesionId, socioId } = req.body;
        
        if (!sesionId || !socioId) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        
        try {
            const result = await pool.query(
                `UPDATE inscripciones_clases 
                 SET estado = 'Cancelada' 
                 WHERE sesion_id = $1 AND socio_id = $2 AND estado = 'Confirmada'
                 RETURNING inscripcion_id`,
                [sesionId, socioId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'No se encontró la inscripción' });
            }
            
            res.json({ message: 'Inscripción cancelada correctamente' });
        } catch (error) {
            console.error('Error en cancelar:', error);
            res.status(500).json({ error: 'Error al cancelar la inscripción' });
        }
    },

    // ============================================
    // OBTENER INSCRIPCIONES DEL SOCIO
    // ============================================
    getMisInscripciones: async (req, res) => {
        const socioId = req.query.socioId;
        
        if (!socioId) {
            return res.status(400).json({ error: 'socioId requerido' });
        }
        
        try {
            const query = `
                SELECT 
                    ic.inscripcion_id,
                    ic.sesion_id,
                    sp.dia_semana,
                    sp.hora_inicio,
                    sp.hora_fin,
                    d.nombre as disciplina,
                    e.nombre as espacio,
                    COALESCE(NULLIF(TRIM(CONCAT(u.nombres, ' ', u.apellido_paterno)), ''), 'Por asignar') as instructor,
                    u.foto_perfil as instructor_foto
                FROM inscripciones_clases ic
                JOIN sesiones_programadas sp ON ic.sesion_id = sp.sesion_id
                JOIN disciplinas d ON sp.disciplina_id = d.disciplina_id
                JOIN espacios e ON sp.espacio_id = e.espacio_id
                LEFT JOIN instructores i ON sp.instructor_id = i.instructor_id
                LEFT JOIN usuarios u ON i.usuario_id = u.usuario_id
                WHERE ic.socio_id = $1 AND ic.estado = 'Confirmada' -- CAMBIO AQUÍ
                ORDER BY sp.dia_semana, sp.hora_inicio
            `;
            
            const result = await pool.query(query, [socioId]);
            res.json(result.rows);
        } catch (error) {
            console.error('Error en getMisInscripciones:', error);
            res.status(500).json({ error: 'Error al obtener inscripciones' });
        }
    }
};

module.exports = inscripcionesController;
