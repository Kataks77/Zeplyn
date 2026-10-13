const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticateRequest } = require('../middlewares/authMiddleware');

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/logout', authenticateRequest, AuthController.logout);

module.exports = router;
