const CampaignService = require('../services/CampaignService');

class CampaignController {
    constructor() {
        this.listCampaigns = this.listCampaigns.bind(this);
        this.getCampaign = this.getCampaign.bind(this);
        this.createCampaign = this.createCampaign.bind(this);
        this.startCampaign = this.startCampaign.bind(this);
        this.pauseCampaign = this.pauseCampaign.bind(this);
        this.cancelCampaign = this.cancelCampaign.bind(this);
        this.deleteCampaign = this.deleteCampaign.bind(this);
        this.getLogs = this.getLogs.bind(this);
    }

    async checkTenantCampaign(req, campaignId) {
        if (!campaignId) return false;
        if (req.user?.role === 'superadmin') return true;
        const campaign = await CampaignService.getCampaign(campaignId);
        if (!campaign) return false;
        const userCompanyId = req.user?.companyId || 'company_default';
        const campaignCompanyId = campaign.companyId || 'company_default';
        return campaignCompanyId === userCompanyId;
    }

    async listCampaigns(req, res) {
        try {
            const { botId } = req.query;
            let companyId = null;
            if (req.user && req.user.role === 'superadmin') {
                companyId = req.query.companyId || null;
            } else if (req.user) {
                companyId = req.user.companyId || 'company_default';
            }

            const campaigns = await CampaignService.listCampaigns(companyId, botId);
            res.json({ success: true, campaigns });
        } catch (error) {
            console.error('Erro CampaignController.listCampaigns:', error);
            res.status(500).json({ error: 'Erro ao listar campanhas' });
        }
    }

    async getCampaign(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantCampaign(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Esta campanha pertence a outra empresa.' });
            }

            const campaign = await CampaignService.getCampaign(id);
            if (!campaign) {
                return res.status(404).json({ error: 'Campanha não encontrada' });
            }
            res.json({ success: true, campaign });
        } catch (error) {
            console.error('Erro CampaignController.getCampaign:', error);
            res.status(500).json({ error: 'Erro ao obter dados da campanha' });
        }
    }

    async createCampaign(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const { botId } = req.body || {};

            // Validar que o bot escolhido pertence à empresa do usuário
            if (botId && req.user?.role !== 'superadmin') {
                const BotService = require('../services/BotService');
                const bot = await BotService.getBot(botId);
                if (!bot || (bot.companyId || 'company_default') !== companyId) {
                    return res.status(403).json({ error: 'Acesso negado: O robô selecionado pertence a outra empresa.' });
                }
            }

            const campaign = await CampaignService.createCampaign(req.body, companyId);

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CAMPAIGN_CREATE',
                    description: `Criou a campanha de disparos "${campaign.name}"`,
                    category: 'campaigns',
                    details: { campaignId: campaign.id, name: campaign.name, botId: campaign.botId }
                });
            } catch (_) {}

            res.status(201).json({ success: true, campaign });
        } catch (error) {
            console.error('Erro CampaignController.createCampaign:', error);
            res.status(400).json({ error: error.message || 'Erro ao criar campanha' });
        }
    }

    async startCampaign(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantCampaign(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Esta campanha pertence a outra empresa.' });
            }

            const result = await CampaignService.startCampaign(id);

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CAMPAIGN_START',
                    description: `Iniciou os disparos da campanha (ID: ${id})`,
                    category: 'campaigns',
                    details: { campaignId: id }
                });
            } catch (_) {}

            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Erro CampaignController.startCampaign:', error);
            res.status(400).json({ error: error.message || 'Erro ao iniciar campanha' });
        }
    }

    async pauseCampaign(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantCampaign(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Esta campanha pertence a outra empresa.' });
            }

            await CampaignService.pauseCampaign(id);

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CAMPAIGN_PAUSE',
                    description: `Pausou a campanha (ID: ${id})`,
                    category: 'campaigns',
                    details: { campaignId: id }
                });
            } catch (_) {}

            res.json({ success: true, message: 'Campanha pausada com sucesso' });
        } catch (error) {
            console.error('Erro CampaignController.pauseCampaign:', error);
            res.status(500).json({ error: 'Erro ao pausar campanha' });
        }
    }

    async cancelCampaign(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantCampaign(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Esta campanha pertence a outra empresa.' });
            }

            await CampaignService.cancelCampaign(id);

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CAMPAIGN_CANCEL',
                    description: `Cancelou a campanha (ID: ${id})`,
                    category: 'campaigns',
                    details: { campaignId: id }
                });
            } catch (_) {}

            res.json({ success: true, message: 'Campanha cancelada' });
        } catch (error) {
            console.error('Erro CampaignController.cancelCampaign:', error);
            res.status(500).json({ error: 'Erro ao cancelar campanha' });
        }
    }

    async deleteCampaign(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantCampaign(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Esta campanha pertence a outra empresa.' });
            }

            await CampaignService.deleteCampaign(id);

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CAMPAIGN_DELETE',
                    description: `Excluiu a campanha (ID: ${id})`,
                    category: 'campaigns',
                    details: { campaignId: id }
                });
            } catch (_) {}

            res.json({ success: true, message: 'Campanha excluída com sucesso' });
        } catch (error) {
            console.error('Erro CampaignController.deleteCampaign:', error);
            res.status(500).json({ error: 'Erro ao excluir campanha' });
        }
    }

    async getLogs(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantCampaign(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Esta campanha pertence a outra empresa.' });
            }

            const logs = await CampaignService.getCampaignLogs(id);
            res.json({ success: true, logs });
        } catch (error) {
            console.error('Erro CampaignController.getLogs:', error);
            res.status(500).json({ error: 'Erro ao carregar relatório da campanha' });
        }
    }
}

module.exports = new CampaignController();
