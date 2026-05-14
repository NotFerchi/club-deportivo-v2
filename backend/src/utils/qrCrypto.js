const crypto = require('crypto');

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

module.exports = {
  generarHmacSha256
};
