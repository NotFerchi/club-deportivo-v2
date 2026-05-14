module.exports = (err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON mal formado' });
  }

  console.error('ERROR', err.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
};
