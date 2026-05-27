const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAudit } = require('../utils/auditLogger');

exports.login = async (req, res) => {
    const { email, contrasena } = req.body;
    
    console.log(`\n--- INTENTO DE LOGIN ---`);
    console.log(`Buscando el correo: '${email}'`);

    try {
        const result = await pool.query(
            `SELECT u.usuario_id, u.username, u.password_hash, u.activo,
                    u.nombres, u.apellido_paterno, u.foto_perfil,
                    r.nombre AS rol
             FROM usuarios u
             JOIN roles r ON u.rol_id = r.rol_id
             WHERE u.username = $1`,
            [email]
        );

        console.log(`Usuarios encontrados en la BD: ${result.rows.length}`);

        if (result.rows.length === 0) {
            console.log("Falla: No se encontró el correo (o el rol_id está nulo y el JOIN lo ocultó)");
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const usuarioBD = result.rows[0];
        console.log(`Usuario extraído:`, { id: usuarioBD.usuario_id, email: usuarioBD.username, rol: usuarioBD.rol });

        const passwordValida = await bcrypt.compare(contrasena, usuarioBD.password_hash);
        console.log(`¿La contraseña coincide?: ${passwordValida}`);

        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!usuarioBD.activo) {
            console.log("Falla: El usuario está inactivo");
            return res.status(403).json({ error: 'La cuenta está desactivada' });
        }

        const token = jwt.sign(
            { usuario_id: usuarioBD.usuario_id, email: usuarioBD.username, rol: usuarioBD.rol },
            process.env.JWT_SECRET || 'secreto_super_seguro', 
            { expiresIn: '8h' }
        );

        console.log("¡Login Exitoso!");
        await logAudit(req, {
            usuario_id: usuarioBD.usuario_id,
            accion: 'login',
            tabla_afectada: 'usuarios',
            registro_id: usuarioBD.usuario_id,
            detalles: `Inicio de sesion correcto para rol ${usuarioBD.rol}`
        });

        let extraData = {};
        if (usuarioBD.rol === 'socio') {
            const socioResult = await pool.query(
                'SELECT socio_id, numero_socio FROM socios WHERE usuario_id = $1',
                [usuarioBD.usuario_id]
            );
            if (socioResult.rows.length > 0) {
                extraData = {
                    socio_id: socioResult.rows[0].socio_id,
                    numero_socio: socioResult.rows[0].numero_socio
                };
            }
        }

        res.json({
            token,
            usuario: {
                id: usuarioBD.usuario_id,
                email: usuarioBD.username,
                rol: usuarioBD.rol,
                nombres: usuarioBD.nombres,
                apellido_paterno: usuarioBD.apellido_paterno,
                foto_perfil: usuarioBD.foto_perfil || null,
                ...extraData
            }
        });

    } catch (error) {
        console.error("ERROR EN EL LOGIN:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
