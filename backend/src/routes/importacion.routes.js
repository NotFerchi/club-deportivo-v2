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

const MAX_MB = 5;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  // Otro tipo de archivo se descarta → req.file vacío → archivoRequerido responde 400.
  fileFilter: (req, file, cb) => cb(null, /\.xlsx$/i.test(file.originalname))
});

// Errores de multer (tamaño, campo inesperado) → 400 en vez de llegar al errorHandler (500).
const subirExcel = (req, res, next) =>
  upload.single('archivo')(req, res, (err) => {
    if (!err) return next();
    if (!(err instanceof multer.MulterError)) return next(err);
    const error =
      err.code === 'LIMIT_FILE_SIZE'
        ? `El archivo excede el tamaño máximo de ${MAX_MB} MB`
        : 'Se requiere un único archivo .xlsx (field: archivo)';
    return res.status(400).json({ error });
  });

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
  subirExcel,
  archivoRequerido,
  importacionController.importarSocios
);

module.exports = router;
