function normalizarCURP(curp = '') {
  return String(curp).trim().toUpperCase();
}

function validarCURP(curp) {
  const regexCURP = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[0-9A-Z]{2}$/;
  const curpNormalizada = normalizarCURP(curp);

  if (!curpNormalizada) {
    return { valido: false, mensaje: 'La CURP es obligatoria.' };
  }

  if (curpNormalizada.length !== 18) {
    return {
      valido: false,
      mensaje: 'La CURP debe tener 18 caracteres.'
    };
  }

  if (!regexCURP.test(curpNormalizada)) {
    return {
      valido: false,
      mensaje: 'Formato de CURP invalido.'
    };
  }

  return { valido: true };
}

module.exports = { validarCURP, normalizarCURP };