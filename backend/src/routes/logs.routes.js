const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

router.use(verifyToken);
router.use(checkRole(['admin']));

router.get('/', logsController.getLogs);
router.post('/', logsController.createLog);
router.get('/estadisticas', logsController.getLogsEstadisticas);
router.get('/tabla/:tabla', logsController.getLogsByTabla);

module.exports = router;
