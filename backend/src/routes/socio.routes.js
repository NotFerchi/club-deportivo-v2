const express = require('express');
const router = express.Router();
const { crearSocio, editarSocio } = require('../controllers/socioController');
const { verifyToken } = require('../middleware/auth.middleware');

router.post('/', verifyToken, crearSocio);
router.put('/:id', verifyToken, editarSocio);

module.exports = router;
