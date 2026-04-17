const pool = require('../config/database');
const bcrypt = require('bcryptjs');

const crearUsuario = async (req, res) => {
        const { 
            email, nombres, apellido_paterno, apellido_materno, curp, 
            telefono, fecha_nacimiento, genero, direccion, 
            contrasena, rol_id, especialidad 
        } = req.body;
    
    const client = await pool.connect(); 

    try {
        await client.query('BEGIN'); 

        const rolResult = await client.query('SELECT nombre FROM roles WHERE rol_id = $1', [rol_id]);
        const nombreRol = rolResult.rows[0]?.nombre;

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(contrasena, salt);

        const userResult = await client.query(
            `INSERT INTO usuarios (
                username, nombres, apellido_paterno, apellido_materno, curp, 
                telefono, fecha_nacimiento, genero, direccion, password_hash, rol_id, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING usuario_id`,
            [email, nombres, apellido_paterno, apellido_materno, curp, telefono, fecha_nacimiento, genero, direccion, password_hash, rol_id]
        );

        const nuevoUsuarioId = userResult.rows[0].usuario_id;

        // segundo cambio: insertamos la especialidad si biene si no la dejamos nula
        if (nombreRol === 'instructor') {
            // iserto solo id y espsialidad por q el nomre ya qdo en la tabla d ariva
            await client.query(
                `INSERT INTO instructores (usuario_id, especialidad) VALUES ($1, $2)`,
                [nuevoUsuarioId, especialidad || null]
            );
        
        }
        // --- INICIO DE REGISTRO EN BITÁCORA (LOGS) ---
        
        // 1. Capturamos la IP desde donde se hace la petición
        const ip_origen = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 2. Armamos el JSON con los detalles de lo que se hizo
        const detallesLog = JSON.stringify({
            nuevo_usuario_email: email,
            rol_asignado: rol_id,
            curp_registrada: curp
        });
        const adminId = req.usuario?.usuario_id || req.user?.usuario_id || req.usuario?.id || req.user?.id;
        // 3. Insertamos el movimiento en la tabla de logs_sistema
        // Nota: req.usuario.usuario_id viene de tu auth.middleware.js gracias al token
        await client.query(
            `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
             VALUES ($1, $2, $3, $4, $5)`,
            [adminId, 'CREAR_USUARIO_INTERNO', 'usuarios', detallesLog, ip_origen]
        );
        
        // --- FIN DE REGISTRO EN BITÁCORA ---

        await client.query('COMMIT'); // Aquí ya guardas todo: el usuario, el instructor (si aplica) y el log
        res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });

    } catch (error) {
        await client.query('ROLLBACK'); 
        console.error("Error al crear usuario:", error);
        
        if (error.code === '23505') {
            return res.status(409).json({ error: 'El correo o la CURP ya están registrados' });      
          }
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        client.release(); 
    }
};

// GET /api/usuarios-internos
const listarUsuarios = async (req, res) => {
    try {
        const { rol, activo } = req.query;
        // Ya incluimos u.nombre y mandamos username como email
        let query = `
            SELECT u.usuario_id, u.nombre, u.username AS email, r.nombre_rol AS rol, u.activo
            FROM usuarios u
            JOIN roles r ON u.rol_id = r.rol_id
            WHERE 1=1
        `;
        const params = [];

        if (rol) {
            params.push(rol);
            query += ` AND u.rol_id = $${params.length}`;
        }

        if (activo !== undefined) {
            // Conversión a booleano para el campo de Postgres
            const isActivo = activo == 1 || activo === 'true'; 
            params.push(isActivo); 
            query += ` AND u.activo = $${params.length}`;
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Error al listar usuarios:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// PUT /api/usuarios-internos/:id
const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, rol_id, nueva_contrasena } = req.body;
    const adminId = req.user.usuario_id; 

    try {
        const emailCheck = await pool.query(
            'SELECT usuario_id FROM usuarios WHERE username = $1 AND usuario_id != $2', 
            [email, id]
        );
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const rolCheck = await pool.query('SELECT rol_id FROM roles WHERE rol_id = $1', [rol_id]);
        if (rolCheck.rows.length === 0) {
            return res.status(400).json({ error: 'El rol no existe' });
        }

        await pool.query('BEGIN');

        // Ya procesamos el nombre directamente
        let updateSql = 'UPDATE usuarios SET nombre = $1, username = $2, rol_id = $3';
        const updateParams = [nombre, email, rol_id];

        if (nueva_contrasena) {
            if (nueva_contrasena.length < 8) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
            }
            const hash = await bcrypt.hash(nueva_contrasena, 10);
            updateSql += ', password_hash = $4'; 
            updateParams.push(hash);
            
            updateSql += ` WHERE usuario_id = $5`;
            updateParams.push(id);
        } else {
            updateSql += ` WHERE usuario_id = $4`;
            updateParams.push(id);
        }

        await pool.query(updateSql, updateParams);

        await pool.query(`
            INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada)
            VALUES ($1, $2, $3)
        `, [adminId, `USUARIO_ACTUALIZADO - Entidad ID: ${id}`, 'usuarios']);

        await pool.query('COMMIT');
        res.json({ mensaje: 'Usuario actualizado correctamente' });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// PATCH /api/usuarios-internos/:id/estado
const cambiarEstadoUsuario = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    const adminId = req.user.usuario_id;

    if (parseInt(adminId) === parseInt(id)) {
        return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    try {
        const isActivo = activo == 1 || activo === true;

        await pool.query('BEGIN');

        await pool.query(
            'UPDATE usuarios SET activo = $1 WHERE usuario_id = $2', 
            [isActivo, id]
        );

        await pool.query(`
            INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada)
            VALUES ($1, $2, $3)
        `, [adminId, `USUARIO_CAMBIO_ESTADO - Entidad ID: ${id} - Nuevo estado: ${isActivo}`, 'usuarios']);

        await pool.query('COMMIT');
        res.json({ mensaje: 'Estado del usuario actualizado correctamente' });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Error al cambiar estado:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    crearUsuario,
    listarUsuarios,
    actualizarUsuario,
    cambiarEstadoUsuario
};
