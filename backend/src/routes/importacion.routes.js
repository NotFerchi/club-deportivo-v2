const express = require('express');
const router = express.Router();
const multer = require('multer');
const importacionController = require('../controllers/importacionController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

const upload = multer({ storage: multer.memoryStorage() });

// SCRUM-134 — Template descargable
router.get('/template', verifyToken, checkRole(['admin', 'gerente']), importacionController.descargarTemplate);

// SCRUM-135 — Importación de socios desde Excel
router.post(
  '/socios',
  verifyToken,
  checkRole(['admin', 'gerente']),
  upload.single('archivo'),
  importacionController.importarSocios
);

module.exports = router;
