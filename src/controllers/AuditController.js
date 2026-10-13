const AuditService = require('../services/AuditService');

class AuditController {
    async getLogs(req, res) {
        try {
            const isSuperAdmin = req.user && req.user.role === 'superadmin';
            const userCompanyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');
            const { page, limit, category, search } = req.query;

            const result = await AuditService.listLogs({
                companyId: userCompanyId,
                page,
                limit,
                category,
                search
            });

            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Erro ao listar logs de auditoria:', error);
            res.status(500).json({ error: 'Erro ao carregar histórico de auditoria' });
        }
    }

    async trackNavigation(req, res) {
        try {
            const { screenId, screenTitle, previousScreen } = req.body || {};
            if (!screenId) {
                return res.status(400).json({ error: 'screenId é obrigatório' });
            }

            const desc = previousScreen 
                ? `Navegou de "${previousScreen}" para "${screenTitle || screenId}"`
                : `Acessou a tela "${screenTitle || screenId}"`;

            await AuditService.logRequest(req, {
                action: 'SCREEN_NAVIGATION',
                description: desc,
                category: 'navigation',
                details: {
                    screenId,
                    screenTitle: screenTitle || screenId,
                    previousScreen: previousScreen || null
                }
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Erro ao rastrear navegação:', error);
            res.status(500).json({ error: 'Erro ao registrar evento de navegação' });
        }
    }
}

module.exports = new AuditController();
