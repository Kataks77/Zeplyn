const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authenticateRequest, requireScreenAccess, requireSuperAdmin, requireAdmin } = require('../middlewares/authMiddleware');

// Proteger todas as rotas do painel/dashboard com autenticação obrigatória
router.use(authenticateRequest);

// Métricas de Dashboard Geral
router.get('/metrics', requireScreenAccess('dashboard'), DashboardController.getStats);
router.post('/record-metrics', DashboardController.recordMetrics);

// Chaves de API de IA (EXCLUSIVO SUPERADMIN)
router.get('/openai-key', requireSuperAdmin, DashboardController.getOpenAIKey);
router.post('/openai-key', requireSuperAdmin, DashboardController.saveOpenAIKey);
router.get('/groq-key', requireSuperAdmin, DashboardController.getGroqKey);
router.post('/groq-key', requireSuperAdmin, DashboardController.saveGroqKey);

// Configurações do Sistema e Modelos de Mensagem (Apenas Administrador pode salvar)
router.get('/settings', DashboardController.getSettings);
router.post('/settings', requireAdmin, DashboardController.saveSettings);

// Expediente Comercial e Feriados da Empresa (Apenas Administrador pode modificar)
router.get('/business-hours', DashboardController.getBusinessHours);
router.post('/business-hours', requireAdmin, DashboardController.saveBusinessHours);
router.get('/business-hours/holidays', DashboardController.listHolidays);
router.post('/business-hours/holidays', requireAdmin, DashboardController.addHoliday);
router.delete('/business-hours/holidays/:id', requireAdmin, DashboardController.deleteHoliday);

module.exports = router;
