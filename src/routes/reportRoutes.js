const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const { requireScreenAccess } = require('../middlewares/authMiddleware');

// Proteção Zero-Trust: Apenas usuários com permissão à tela 'reports'
router.use(requireScreenAccess('reports'));

router.get('/advanced', ReportController.getAdvancedMetrics);
router.get('/export', ReportController.exportReport);

module.exports = router;
