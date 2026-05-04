const express = require('express');
const router = express.Router();
const encuentrosController = require('../controllers/encuentrosController');

router.put('/:encuentro_id', encuentrosController.updateEncuentro);

module.exports = router;
