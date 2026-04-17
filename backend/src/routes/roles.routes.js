const express = require('express');
const router = express.Router();
const { obtenerRoles } = require('../controllers/roles.controller');

router.get('/', obtenerRoles);

module.exports = router;
