const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

// Solo admin/gerente pueden ver logs
router.use(verifyToken);
router.use(checkRole(['admin', 'gerente']));

router.get('/', logsController.getLogs);
router.get('/estadisticas', logsController.getLogsEstadisticas);
router.get('/tabla/:tabla', logsController.getLogsByTabla);

module.exports = router;