const express = require('express');
const router = express.Router();
const quickMessageController = require('../controllers/quickMessageController');

router.get('/quick-messages', quickMessageController.getQuickMessages);
router.post('/quick-messages', quickMessageController.saveQuickMessage);
router.delete('/quick-messages/:id', quickMessageController.deleteQuickMessage);

module.exports = router;
