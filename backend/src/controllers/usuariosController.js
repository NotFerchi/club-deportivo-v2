const pool = require('../config/database');
const { validarCURP } = require('../utils/validacionCurp');

const usuariosController = {

    // ============================================
    // OBTENER TODOS LOS USUARIOS
    // ============================================
    getUsuarios: async (req, res) => {
        try {
            const query = `
                SELECT 
                    u.usuario_id,
                    u.username,
                    u.username AS email,           -- alias para frontend
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
                    r.nombre AS rol,
                    u.rol_id
                FROM usuarios u
                LEFT JOIN roles r ON u.rol_id = r.rol_id
                ORDER BY u.usuario_id
            `;

            const result = await pool.query(query);
            res.json(result.rows);

        } catch (error) {
            console.error('Error en getUsuarios:', error);
            res.status(500).json({ error: 'Error al obtener usuarios' });
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
                    u.username,
                    u.username AS email,
                    u.nombres,
                    u.apellido_paterno,
                    u.apellido_materno,
                    u.curp,
                    u.telefono,
                    u.activo,
                    u.fecha_nacimiento,
                    u.genero,
                    u.direccion,
                    r.nombre AS rol,
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
            console.error('Error en getUsuarioById:', error);
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

        if (!nombres?.trim() || !apellidoPaterno?.trim() || !email?.trim() || !curp?.trim() || !rol_id) {
            return res.status(400).json({ error: 'Nombres, apellido paterno, email, CURP y rol son obligatorios' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Formato de email inválido' });
        }

        const curpValidation = validarCURP(curp);
        if (!curpValidation.valido) {
            return res.status(400).json({ error: curpValidation.mensaje });
        }

        if (telefono && !/^\d{10}$/.test(telefono)) {
            return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos numéricos' });
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Validar email
            const existe = await client.query(
                'SELECT usuario_id FROM usuarios WHERE username = $1',
                [email]
            );

            if (existe.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El email ya está registrado' });
            }

            // Validar CURP
            const existeCurp = await client.query(
                'SELECT usuario_id FROM usuarios WHERE curp = $1',
                [curp]
            );

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
                [
                    email,
                    nombres,
                    apellidoPaterno,
                    apellidoMaterno || '',
                    curp,
                    fechaNacimiento || null,
                    genero || null,
                    telefono || '',
                    direccion || '',
                    passwordFinal,
                    rol_id
                ]
            );

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Usuario creado',
                usuario_id: result.rows[0].usuario_id,
                password: passwordFinal
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en createUsuario:', error);
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

        if (!nombres?.trim() || !apellidoPaterno?.trim() || !email?.trim() || !curp?.trim() || !rol_id) {
            return res.status(400).json({ error: 'Nombres, apellido paterno, email, CURP y rol son obligatorios' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Formato de email inválido' });
        }

        const curpValidation = validarCURP(curp);
        if (!curpValidation.valido) {
            return res.status(400).json({ error: curpValidation.mensaje });
        }

        if (telefono && !/^\d{10}$/.test(telefono)) {
            return res.status(400).json({ error: 'El teléfono debe tener 10 dígitos numéricos' });
        }

        const existeEmail = await pool.query(
            'SELECT usuario_id FROM usuarios WHERE username = $1 AND usuario_id <> $2',
            [email, id]
        );

        if (existeEmail.rows.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado en otro usuario' });
        }

        const existeCurp = await pool.query(
            'SELECT usuario_id FROM usuarios WHERE curp = $1 AND usuario_id <> $2',
            [curp, id]
        );

        if (existeCurp.rows.length > 0) {
            return res.status(400).json({ error: 'El CURP ya está registrado en otro usuario' });
        }

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
                    [
                        nombres,
                        apellidoPaterno,
                        apellidoMaterno || '',
                        email,
                        telefono || '',
                        curp,
                        fechaNacimiento || null,
                        genero || null,
                        direccion || '',
                        rol_id,
                        activo,
                        password,
                        id
                    ]
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
                    [
                        nombres,
                        apellidoPaterno,
                        apellidoMaterno || '',
                        email,
                        telefono || '',
                        curp,
                        fechaNacimiento || null,
                        genero || null,
                        direccion || '',
                        rol_id,
                        activo,
                        id
                    ]
                );
            }

            res.json({ message: 'Usuario actualizado correctamente' });

        } catch (error) {
            console.error('Error en updateUsuario:', error);
            res.status(500).json({ error: 'Error al actualizar usuario' });
        }
    },

    // ============================================
    // ELIMINAR (BAJA LÓGICA)
    // ============================================
    deleteUsuario: async (req, res) => {
        const { id } = req.params;

        try {
            await pool.query(
                'UPDATE usuarios SET activo = false WHERE usuario_id = $1',
                [id]
            );

            res.json({ message: 'Usuario eliminado (inactivo)' });

        } catch (error) {
            console.error('Error en deleteUsuario:', error);
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    },

    // ============================================
    // OBTENER ROLES
    // ============================================
    getRoles: async (req, res) => {
        try {
            const result = await pool.query(
                "SELECT rol_id, nombre FROM roles WHERE nombre != 'socio' ORDER BY rol_id"
            );

            res.json(result.rows);

        } catch (error) {
            console.error('Error en getRoles:', error);
            res.status(500).json({ error: 'Error al obtener roles' });
        }
    },

    desactivarUsuario: async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query(
          'UPDATE usuarios SET activo = false WHERE usuario_id = $1',
          [id]
        );
        res.json({ message: 'Usuario desactivado' });
      } catch (error) {
        console.error('Error en desactivarUsuario:', error);
        res.status(500).json({ error: 'Error al desactivar usuario' });
      }
    },

    reactivarUsuario: async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query(
          'UPDATE usuarios SET activo = true WHERE usuario_id = $1',
          [id]
        );
        res.json({ message: 'Usuario reactivado' });
      } catch (error) {
        console.error('Error en reactivarUsuario:', error);
        res.status(500).json({ error: 'Error al reactivar usuario' });
      }
    },

    deleteUsuarioPermanente: async (req, res) => {
      const { id } = req.params;
      try {
        await pool.query(
          'DELETE FROM usuarios WHERE usuario_id = $1',
          [id]
        );
        res.json({ message: 'Usuario eliminado definitivamente' });
      } catch (error) {
        console.error('Error en deleteUsuarioPermanente:', error);
        res.status(500).json({ error: 'Error al eliminar definitivamente el usuario' });
      }
    },

    getMiPerfil: async (req, res) => {
      try {
        const usuarioId = req.user.usuario_id;
        const result = await pool.query(
          `SELECT u.usuario_id, u.username, u.nombres, u.apellido_paterno,
                  u.apellido_materno, u.telefono, u.fecha_nacimiento,
                  u.genero, u.direccion, u.foto_perfil,
                  r.nombre as rol
           FROM usuarios u
           JOIN roles r ON u.rol_id = r.rol_id
           WHERE u.usuario_id = $1`,
          [usuarioId]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
      } catch (error) {
        console.error('Error en getMiPerfil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    },

    actualizarFotoPerfil: async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'Se requiere una imagen' });

        const usuarioId = req.user.usuario_id;

        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        const result = await pool.query(
          `UPDATE usuarios SET foto_perfil = $1 WHERE usuario_id = $2
           RETURNING usuario_id, foto_perfil`,
          [base64, usuarioId]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.json({
          ok: true,
          message: 'Foto de perfil actualizada correctamente',
          foto_perfil: result.rows[0].foto_perfil
        });
      } catch (error) {
        console.error('Error en actualizarFotoPerfil:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }

};

module.exports = usuariosController;
