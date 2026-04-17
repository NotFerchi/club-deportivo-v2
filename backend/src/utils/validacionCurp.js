function validarCURP(curp) {
    const regexCURP = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/;

    if (!curp) {
        return { valido: false, mensaje: "La CURP es obligatoria." };
    }

    if (curp.length !== 18) {
        return { 
            valido: false, 
            mensaje: "La CURP debe tener 18 caracteres."
        };
    }

    if (!regexCURP.test(curp)) {
        return { 
            valido: false, 
            mensaje: "Formato de CURP inválido."
        };
    }

    return { valido: true };
}
module.exports = { validarCURP };
