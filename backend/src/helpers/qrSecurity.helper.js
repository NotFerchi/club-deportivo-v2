const crypto = require('crypto');

const QR_HASH_LENGTH = 64;

const getQrSecret = () => {
  const secret = process.env.QR_SECRET;

  if (!secret || !secret.trim()) {
    const error = new Error('QR_SECRET no esta configurado');
    error.statusCode = 500;
    throw error;
  }

  return secret;
};

const generarHmacSha256 = (payload) => {
  return crypto
    .createHmac('sha256', getQrSecret())
    .update(JSON.stringify(payload))
    .digest('hex');
};

const isValidSha256Hex = (value) => {
  return typeof value === 'string'
    && value.length === QR_HASH_LENGTH
    && /^[a-f0-9]+$/i.test(value);
};

const hashesCoinciden = (hashRecibido, hashCalculado) => {
  if (!isValidSha256Hex(hashRecibido) || !isValidSha256Hex(hashCalculado)) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(hashRecibido, 'hex'),
    Buffer.from(hashCalculado, 'hex')
  );
};

const parsearQrJson = (codigoQr) => {
  try {
    return JSON.parse(codigoQr);
  } catch (error) {
    const parseError = new Error('codigo_qr debe ser un JSON valido');
    parseError.statusCode = 400;
    throw parseError;
  }
};

const validarQrFirmado = (codigoQr) => {
  const qrData = parsearQrJson(codigoQr);

  if (!qrData || typeof qrData !== 'object' || Array.isArray(qrData)) {
    const error = new Error('codigo_qr debe ser un JSON valido');
    error.statusCode = 400;
    throw error;
  }

  const { hash, ...payload } = qrData;
  const hashCalculado = generarHmacSha256(payload);

  if (!hashesCoinciden(hash, hashCalculado)) {
    const error = new Error('QR inválido o manipulado');
    error.statusCode = 401;
    throw error;
  }

  return payload;
};

module.exports = {
  generarHmacSha256,
  hashesCoinciden,
  validarQrFirmado
};
