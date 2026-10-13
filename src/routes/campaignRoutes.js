const express = require('express');
const router = express.Router();
const CampaignController = require('../controllers/CampaignController');
const { requireScreenAccess } = require('../middlewares/authMiddleware');

// Proteção Zero-Trust: Apenas usuários com permissão à tela 'campaigns'
router.use(requireScreenAccess('campaigns'));

router.get('/', CampaignController.listCampaigns);
router.post('/', CampaignController.createCampaign);
router.get('/:id', CampaignController.getCampaign);
router.post('/:id/start', CampaignController.startCampaign);
router.post('/:id/pause', CampaignController.pauseCampaign);
router.post('/:id/cancel', CampaignController.cancelCampaign);
router.delete('/:id', CampaignController.deleteCampaign);
router.get('/:id/logs', CampaignController.getLogs);

module.exports = router;
