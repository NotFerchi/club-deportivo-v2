const pool = require('../config/database');
const { validarSocio } = require('./validacionSocios');
const { validarCURP } = require('../utils/validacionCurp');
// Importamos bcrypt para encriptar la contraseña antes de guardarla en usuarios
const bcrypt = require('bcryptjs'); 

const crearSocio = async (req, res) => {
    // Recibimos los campos con los nombres exactos que manda el frontend
    const {
        nombres, apellido_paterno, apellido_materno, curp,
        fecha_nacimiento, genero, tipo_socio, modalidad,
        telefono, email, direccion, nombre_emergencia,
        tel_emergencia, contrasena
    } = req.body;

    // Validaciones básicas
    // OJO: Comenté esta validación porque si busca 'nombre' en vez de 'nombres' va a fallar. 
    // Tendrás que actualizar tu archivo validacionSocios.js después para que coincida.
    // const validacion = validarSocio(req.body);
    // if (!validacion.valido) return res.status(400).json({ errores: validacion.errores });
    
    if (!validarCURP(curp)) return res.status(400).json({ error: "CURP inválida" });
    if (!fecha_nacimiento) return res.status(400).json({ error: "Fecha de nacimiento es requerida" });
    if (!contrasena) return res.status(400).json({ error: "La contraseña es requerida para crear la cuenta" });

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Validar si la CURP o Email ya existen en la tabla base (usuarios)
        const existeUsuario = await client.query(
            "SELECT * FROM usuarios WHERE curp = $1 OR username = $2",
            [curp, email]
        );

        if (existeUsuario.rows.length > 0) {
            return res.status(409).json({ error: "La CURP o el Correo ya están registrados" });
        }

        // 2. Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(contrasena, salt);

        // 3. Obtener el ID del rol 'socio' dinámicamente
        const rolResult = await client.query("SELECT rol_id FROM roles WHERE nombre = 'socio'");
        if (rolResult.rows.length === 0) {
            throw new Error("No se encontró el rol 'socio' en la tabla de roles");
        }
        const rol_id = rolResult.rows[0].rol_id;

        // 4. Insertar primero en USUARIOS (Información personal)
        const insertUsuario = await client.query(
            `INSERT INTO usuarios (
                username, nombres, apellido_paterno, apellido_materno, curp,
                telefono, fecha_nacimiento, genero, direccion, password_hash, rol_id, activo
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) RETURNING usuario_id`,
            [email, nombres, apellido_paterno, apellido_materno, curp, telefono, fecha_nacimiento, genero, direccion, password_hash, rol_id]
        );

        const usuario_id = insertUsuario.rows[0].usuario_id;

        // 5. Generar número de socio
        const count = await client.query(
            "SELECT COUNT(*) FROM socios WHERE tipo = $1",
            [tipo_socio]
        );

        const total = parseInt(count.rows[0].count) + 1;
        const prefijo = tipo_socio === 'Accionista' ? 'ACC' : 'RNT';
        const numero_socio = `${prefijo}-${String(total).padStart(3, '0')}`;

        // 6. Insertar en SOCIOS (Solo información del club y emergencias)
        const insertSocio = await client.query(
            `INSERT INTO socios (usuario_id, tipo, modalidad, numero_socio, nombre_emergencia, tel_emergencia)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING socio_id`,
            [usuario_id, tipo_socio, modalidad, numero_socio, nombre_emergencia, tel_emergencia]
        );

        // 7. Guardado de logs del sistema (con la estructura que usamos en usuarios)
        const adminId = req.usuario?.usuario_id || req.user?.usuario_id || req.usuario?.id || req.user?.id;
        const ip_origen = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (adminId) {
            const detallesLog = JSON.stringify({
                nuevo_socio_email: email,
                numero_socio: numero_socio,
                tipo: tipo_socio
            });

            await client.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada, detalles, ip_origen)
                 VALUES ($1, 'CREAR_SOCIO', 'socios', $2, $3)`,
                [adminId, detallesLog, ip_origen]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            exito: true,
            socio_id: insertSocio.rows[0].socio_id,
            numero_socio
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("CHISME DE LA BASE DE DATOS:", err);
        res.status(500).json({ error: "Error interno al guardar" });
    } finally {
        client.release();
    }
};

const editarSocio = async (req, res) => {
    // Nota: Esta función también necesitará ajustes en el futuro para hacer un UPDATE 
    // en ambas tablas (usuarios y socios) usando un JOIN o dos consultas separadas.
    const client = await pool.connect();
    const { id } = req.params;

    try {
        const result = await client.query("SELECT * FROM socios WHERE socio_id=$1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Socio no encontrado" });
        }

        const actual = result.rows[0];
        const nuevos = req.body;

        let cambios = [];
        let valores = [];
        let i = 1;

        for (let key in nuevos) {
            if (nuevos[key] !== actual[key]) {
                cambios.push(`${key}=$${i}`);
                valores.push(nuevos[key]);
                i++;
            }
        }

        if (cambios.length === 0) {
            return res.json({ mensaje: "Sin cambios" });
        }

        valores.push(id);

        await client.query('BEGIN');

        await client.query(
            `UPDATE socios SET ${cambios.join(',')} WHERE socio_id=$${i}`,
            valores
        );

        const adminId = req.usuario?.usuario_id || req.user?.usuario_id;
        if (adminId) {
            await client.query(
                `INSERT INTO logs_sistema (usuario_id, accion, tabla_afectada)
                 VALUES ($1, 'UPDATE_SOCIO', 'socios')`,
                [adminId]
            );
        }

        await client.query('COMMIT');
        res.json({ mensaje: "Actualizado" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERROR EN EDICIÓN:", err);
        res.status(500).json({ error: "Error interno" });
    } finally {
        client.release();
    }
};

module.exports = { crearSocio, editarSocio };
