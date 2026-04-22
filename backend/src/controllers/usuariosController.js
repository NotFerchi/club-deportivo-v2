const pool = require('../config/database');

const usuariosController = {
    // ============================================
    // OBTENER TODOS LOS USUARIOS
    // ============================================
    getUsuarios: async (req, res) => {
        try {
            const query = `
                SELECT 
                    u.usuario_id,
                    u.username as email,
                    u.nombres,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.curp,
                    u.telefono,
                    u.activo,
                    u.fecha_creacion,
                    u.fecha_nacimiento,
                    u.genero,
                    u.direccion,
                    r.nombre as rol,
                    u.rol_id
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.rol_id
                ORDER BY u.usuario_id
            `;
            const result = await pool.query(query);
            console.log(`✅ Usuarios encontrados: ${result.rows.length}`);
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error en getUsuarios:', error);
            res.status(500).json({ error: 'Error al obtener usuarios', detalle: error.message });
        }
    },

    // ============================================
    // OBTENER USUARIO POR ID
    // ============================================
    getUsuarioById: async (req, res) => {
        const { id } = req.params;
        try {
            const query = `
                SELECT 
                    u.usuario_id,
                    u.username as email,
                    u.nombres,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.curp,
                    u.telefono,
                    u.activo,
                    u.fecha_nacimiento,
                    u.genero,
                    u.direccion,
                    r.nombre as rol,
                    u.rol_id
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.rol_id
                WHERE u.usuario_id = $1
            `;
            const result = await pool.query(query, [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error('❌ Error en getUsuarioById:', error);
            res.status(500).json({ error: 'Error al obtener usuario' });
        }
    },

    // ============================================
    // CREAR USUARIO
    // ============================================
    createUsuario: async (req, res) => {
        const { 
            nombres, 
            apellidoPaterno, 
            apellidoMaterno, 
            email, 
            telefono, 
            curp, 
            fechaNacimiento,
            genero,
            direccion,
            rol_id, 
            password 
        } = req.body;
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Verificar si el email ya existe
            const existe = await client.query('SELECT usuario_id FROM usuarios WHERE username = $1', [email]);
            if (existe.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El email ya está registrado' });
            }
            
            // Verificar si el CURP ya existe
            const existeCurp = await client.query('SELECT usuario_id FROM usuarios WHERE curp = $1', [curp]);
            if (existeCurp.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El CURP ya está registrado' });
            }
            
            const passwordFinal = password || 'empleado123';
            
            const result = await client.query(
                `INSERT INTO usuarios 
                 (username, nombres, apellido_paterno, apellido_materno, curp, 
                  fecha_nacimiento, genero, telefono, direccion, password_hash, rol_id, activo)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, crypt($10, gen_salt('bf')), $11, true)
                 RETURNING usuario_id`,
                [email, nombres, apellidoPaterno, apellidoMaterno || '', curp, 
                 fechaNacimiento || null, genero || null, telefono || '', direccion || '', 
                 passwordFinal, rol_id]
            );
            
            await client.query('COMMIT');
            res.status(201).json({ 
                message: 'Usuario creado exitosamente', 
                usuario_id: result.rows[0].usuario_id,
                password: passwordFinal
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Error en createUsuario:', error);
            res.status(500).json({ error: 'Error al crear usuario' });
        } finally {
            client.release();
        }
    },

    // ============================================
    // ACTUALIZAR USUARIO
    // ============================================
    updateUsuario: async (req, res) => {
        const { id } = req.params;
        const { 
            nombres, 
            apellidoPaterno, 
            apellidoMaterno, 
            email, 
            telefono, 
            curp, 
            fechaNacimiento,
            genero,
            direccion,
            rol_id, 
            activo, 
            password 
        } = req.body;
        
        try {
            if (password && password.trim() !== '') {
                await pool.query(
                    `UPDATE usuarios 
                     SET nombres = $1, 
                         apellido_paterno = $2, 
                         apellido_materno = $3, 
                         username = $4, 
                         telefono = $5, 
                         curp = $6,
                         fecha_nacimiento = $7,
                         genero = $8,
                         direccion = $9,
                         rol_id = $10, 
                         activo = $11,
                         password_hash = crypt($12, gen_salt('bf'))
                     WHERE usuario_id = $13`,
                    [nombres, apellidoPaterno, apellidoMaterno || '', email, telefono || '', curp, 
                     fechaNacimiento || null, genero || null, direccion || '', rol_id, activo, password, id]
                );
            } else {
                await pool.query(
                    `UPDATE usuarios 
                     SET nombres = $1, 
                         apellido_paterno = $2, 
                         apellido_materno = $3, 
                         username = $4, 
                         telefono = $5, 
                         curp = $6,
                         fecha_nacimiento = $7,
                         genero = $8,
                         direccion = $9,
                         rol_id = $10, 
                         activo = $11
                     WHERE usuario_id = $12`,
                    [nombres, apellidoPaterno, apellidoMaterno || '', email, telefono || '', curp, 
                     fechaNacimiento || null, genero || null, direccion || '', rol_id, activo, id]
                );
            }
            
            res.json({ message: 'Usuario actualizado correctamente' });
        } catch (error) {
            console.error('❌ Error en updateUsuario:', error);
            res.status(500).json({ error: 'Error al actualizar usuario' });
        }
    },

    // ============================================
    // ELIMINAR USUARIO (BAJA LÓGICA)
    // ============================================
    deleteUsuario: async (req, res) => {
        const { id } = req.params;
        
        try {
            await pool.query('UPDATE usuarios SET activo = false WHERE usuario_id = $1', [id]);
            res.json({ message: 'Usuario eliminado correctamente' });
        } catch (error) {
            console.error('❌ Error en deleteUsuario:', error);
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    },

    // ============================================
    // OBTENER ROLES DISPONIBLES
    // ============================================
    getRoles: async (req, res) => {
        try {
            const result = await pool.query('SELECT rol_id, nombre FROM roles ORDER BY rol_id');
            res.json(result.rows);
        } catch (error) {
            console.error('❌ Error en getRoles:', error);
            res.status(500).json({ error: 'Error al obtener roles' });
        }
    }
};

module.exports = usuariosController;