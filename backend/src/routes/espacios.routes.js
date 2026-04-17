const express = require('express');
const router = express.Router();
const espaciosController = require('../controllers/espaciosController');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/espacios', verifyToken, espaciosController.getEspacios);

module.exports = router;
