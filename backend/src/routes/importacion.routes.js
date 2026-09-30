const express = require('express');
const router = express.Router();
const multer = require('multer');
const importacionController = require('../controllers/importacionController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { validateInput } = require('../middleware/validators');

// GET /template: ?tipo opcional, solo 'socios'.
const tipoTemplate = validateInput((req) => {
  const { tipo } = req.query;
  return tipo && tipo !== 'socios' ? [400, { error: `Tipo '${tipo}' no válido. Usa ?tipo=socios` }] : null;
});

// POST /socios: archivo requerido (después de multer).
const archivoRequerido = validateInput((req) =>
  req.file ? null : [400, { error: 'Se requiere un archivo .xlsx (field: archivo)' }]
);

const upload = multer({ storage: multer.memoryStorage() });

// SCRUM-134 — Template descargable
router.get(
  '/template',
  verifyToken,
  checkRole(['admin', 'gerente']),
  tipoTemplate,
  importacionController.descargarTemplate
);

// SCRUM-135 — Importación de socios desde Excel
router.post(
  '/socios',
  verifyToken,
  checkRole(['admin', 'gerente']),
  upload.single('archivo'),
  archivoRequerido,
  importacionController.importarSocios
);

module.exports = router;
