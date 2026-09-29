const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');
const { validateInput } = require('../middleware/validators');

// POST /: accion requerida (sin body se trata como vacío → 400, como antes).
const accionRequerida = validateInput((req) =>
  (req.body || {}).accion ? null : [400, { error: 'accion es requerida' }]
);

router.use(verifyToken);
router.use(checkRole(['admin']));

router.get('/', logsController.getLogs);
router.post('/', accionRequerida, logsController.createLog);
router.get('/estadisticas', logsController.getLogsEstadisticas);
router.get('/tabla/:tabla', logsController.getLogsByTabla);

module.exports = router;
