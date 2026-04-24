const express = require('express');
const router = express.Router();
const sesionesController = require('../controllers/sesionesController');
const { verifyToken, checkRole } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', sesionesController.getSesiones);
router.get('/dia/:dia', sesionesController.getSesionesPorDia);
router.post('/', checkRole(['admin', 'gerente', 'coordinador']), sesionesController.createSesion);
router.put('/:id', checkRole(['admin', 'gerente', 'coordinador']), sesionesController.updateSesion);
router.delete('/:id', checkRole(['admin', 'gerente', 'coordinador']), sesionesController.deleteSesion);

module.exports = router;