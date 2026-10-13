const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/AuditController');
const { requireRole } = require('../middlewares/authMiddleware');

// Qualquer usuário autenticado registra seu rastro de navegação (entrada/saída de tela)
router.post('/track', (req, res) => AuditController.trackNavigation(req, res));

// Apenas administradores e superadmin podem consultar a lista de logs de auditoria
router.get('/', requireRole(['admin', 'superadmin']), (req, res) => AuditController.getLogs(req, res));

module.exports = router;
