const express = require('express');
const router = express.Router();
const BotController = require('../controllers/BotController');
const { requireBotOwnership, requireScreenAccess } = require('../middlewares/authMiddleware');

router.get('/', BotController.list);
router.post('/', requireScreenAccess('bots'), BotController.create);
router.post('/import', requireScreenAccess('bots'), BotController.importBot);
router.get('/:botId', requireBotOwnership, BotController.getById);
router.put('/:botId', requireBotOwnership, requireScreenAccess('bots'), BotController.update);
router.delete('/:botId', requireBotOwnership, requireScreenAccess('bots'), BotController.delete);
router.post('/:botId/toggle', requireBotOwnership, requireScreenAccess('bots'), BotController.toggle);
router.post('/:botId/start', requireBotOwnership, BotController.start);
router.post('/:botId/stop', requireBotOwnership, BotController.stop);
router.post('/:botId/disconnect', requireBotOwnership, BotController.disconnect);
router.post('/:botId/test', requireBotOwnership, BotController.test);
router.get('/:botId/qr', requireBotOwnership, BotController.getQR);

// Rotas para QA
router.get('/:botId/qa', requireBotOwnership, requireScreenAccess('bots'), BotController.listQA);
router.post('/:botId/qa', requireBotOwnership, requireScreenAccess('bots'), BotController.addQA);
router.put('/:botId/qa/:qaId', requireBotOwnership, requireScreenAccess('bots'), BotController.updateQA);
router.delete('/:botId/qa/:qaId', requireBotOwnership, requireScreenAccess('bots'), BotController.deleteQA);

module.exports = router;
