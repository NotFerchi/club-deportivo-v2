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

obtenerLogs: async (req, res) => {
  const result = await pool.query('SELECT * FROM logs ORDER BY fecha DESC LIMIT 200');
  res.json(result.rows);
}
module.exports = router;