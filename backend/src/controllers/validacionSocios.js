// La validación de CURP ya se hace en el controlador, 
// pero dejamos esto por si lo ocupan en otros lados del proyecto
const { validarCURP } = require('../utils/validacionCurp');

function validarSocio(data) {
    const errores = [];

    if (!data.nombre || data.nombre.trim() === "") {
        errores.push("El nombre es obligatorio.");
    }

    if (!data.apellido || data.apellido.trim() === "") {
        errores.push("El apellido es obligatorio.");
    }

    if (!data.curp || data.curp.trim() === "") {
        errores.push("La CURP es obligatoria.");
    }

    // Se pasa a minúsculas por si el frontend manda "Accionista" en lugar de "accionista"
    const tiposValidos = ["accionista", "rentista"];
    if (!data.tipo_socio || !tiposValidos.includes(data.tipo_socio.toLowerCase())) {
        errores.push("Tipo de socio inválido. Debe ser Accionista o Rentista.");
    }

    const modalidadesValidas = ["individual", "familiar"];
    if (!data.modalidad || !modalidadesValidas.includes(data.modalidad.toLowerCase())) {
        errores.push("Modalidad inválida. Debe ser Individual o Familiar.");
    }

    return {
        valido: errores.length === 0,
        errores
    };
}

module.exports = { validarSocio };
