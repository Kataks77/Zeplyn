const express = require('express');
const router = express.Router();
const WallboardController = require('../controllers/WallboardController');
const { authenticateRequest, requireScreenAccess } = require('../middlewares/authMiddleware');

// Obter snapshot em tempo real da Torre de Controle
router.get('/', authenticateRequest, requireScreenAccess('wallboard'), WallboardController.getLiveSnapshot);

module.exports = router;
