// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// AHORITA NO SIRVE ESTOOOOOOOO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//librerias para encriptar
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const {validarCURP} = require('../utils/validacionCurp');

// ruta donde tengo guardado del json
const rutaJSON = path.join(__dirname, '../../data/usuariosInternos.json');

const procesarNuevoEmpleado = (req, res) => {
    const datosFormulario = req.body;
    let errores = [];

    // datos obligatorios para registrar un nuevo empleado
    const camposRequeridos = [
        'nombreCompleto', 'curp', 'rolDentroDeLaEmpresa', 'fechaNacimiento', 
        'sexo', 'direccion', 'telefono', 'correo', 'fechaAlta', 'contrasena'
    ];
    
    camposRequeridos.forEach(campo => {
        if (!datosFormulario[campo] || datosFormulario[campo].toString().trim() === "") {
            errores.push(`falta llenar el canpo: ${campo}`);
        }
    });

    if (errores.length > 0) return res.status(400).json({ exito: false, mensajes: errores });

    // validacion de la curp
    const resultadoCURP = validarCURP(datosFormulario.curp);
    if (!resultadoCURP.valido) {
        errores.push(resultadoCURP.mensaje);
    }

    // definicion de roles validos dentro de la empresa
    const rolesValidos = ['instructor', 'recepcionista', 'coordinador', 'administrador', 'otro'];
    if (!rolesValidos.includes(datosFormulario.rolDentroDeLaEmpresa)) {
        errores.push("ese rol no exsiste en la empresa");
    }

    // verificacion de que el correo tenga un formato valido
    const patronCorreo = /^[\w\.-]+@[\w\.-]+\.\w+$/;
    if (!patronCorreo.test(datosFormulario.correo)) {
        errores.push("el coreo esta mal escrito o no tiene formato");
    }

    // verificacion del numero de tel
    const esSoloNumeros = /^\d+$/.test(datosFormulario.telefono);
    if (!esSoloNumeros || datosFormulario.telefono.length !== 10) {
        errores.push("el telefono deven ser 10 numeros sin espacios");
    }

    if (errores.length > 0) return res.status(400).json({ exito: false, mensajes: errores });

    // prepara el objeto para guardar
    let nuevoUsuario = { ...datosFormulario };
    
    // estado activo default
    nuevoUsuario.estado = 'Activo';

    // encriptacion de contraseña
    const salt = bcrypt.genSaltSync(10);
    nuevoUsuario.contrasena = bcrypt.hashSync(datosFormulario.contrasena, salt);

    // guardar el nuevo usuario en el json
    try {
        const data = fs.readFileSync(rutaJSON, 'utf8');
        let usuarios = JSON.parse(data);
        
        // NUEVO  
        // le genero un numero de socio usando la longitud del arreglo para que sea secuencial
        const totalUsuarios = usuarios.length + 1;
        // padStart rellena con ceros a la izquierda pa que se vea chido tipo SOC-0001
        const numeroGenerado = "SOC-" + totalUsuarios.toString().padStart(4, '0');
        
        // se lo asigno al wey nuevo antes de meterlo al json
        nuevoUsuario.numero_socio = numeroGenerado;
        
        usuarios.push(nuevoUsuario);
        fs.writeFileSync(rutaJSON, JSON.stringify(usuarios, null, 2));
        
        // aqui es la clave, en el return ya le mando el numero_socio al frontend para que lo muestre
        return res.status(201).json({ 
            exito: true, 
            mensaje: "Usuario registrado con exito",
            numero_socio: numeroGenerado 
        });
        // NUEVO TERMINA

    } catch (error) {
        return res.status(500).json({ exito: false, mensaje: "error al guardar en la base de datos" });
    }
};

module.exports = { procesarNuevoEmpleado };
