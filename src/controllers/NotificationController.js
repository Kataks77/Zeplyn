const NotificationService = require('../services/NotificationService');
const BotManagerService = require('../services/BotManagerService');
const UserService = require('../services/UserService');
const OpenAIService = require('../services/OpenAIService');
const { getSetting, setSetting } = require('../services/DatabaseService');

class NotificationController {
    async list(req, res) {
        try {
            const userId = req.user.id;
            const notifications = await NotificationService.listNotifications(userId);
            res.json(notifications);
        } catch (error) {
            console.error('Erro NotificationController.list:', error);
            res.status(500).json({ error: 'Erro ao listar notificações' });
        }
    }

    async create(req, res) {
        try {
            const { userId, title, message, type, botId } = req.body;
            if (!userId || !title || !message) return res.status(400).json({ error: 'Dados incompletos' });

            const targetUser = await UserService.findUserById(userId);
            if (!targetUser) return res.status(404).json({ error: 'Usuário destinatário não encontrado' });

            // Validação Multi-Tenant: apenas superadmin pode enviar notificações para outras empresas
            if (req.user?.role !== 'superadmin') {
                const userCompanyId = req.user?.companyId || 'company_default';
                const targetCompanyId = targetUser.companyId || 'company_default';
                if (userCompanyId !== targetCompanyId) {
                    return res.status(403).json({ error: 'Acesso negado: Este usuário pertence a outra empresa.' });
                }
            }

            const notification = await NotificationService.createNotification({
                userId, title, message, type: type || 'Informativo', sentBy: req.user.name
            });

            // Tentar enviar via WhatsApp (se bot estiver conectado)
            try {
                if (targetUser && targetUser.phoneNumber) {
                    const companyId = targetUser.companyId || req.user?.companyId || 'company_default';
                    let botInstance = null;
                    if (botId) {
                        const candidate = BotManagerService.activeBots.get(botId);
                        if (candidate && (candidate.config?.companyId || 'company_default') === companyId) {
                            botInstance = candidate;
                        }
                    }
                    if (!botInstance) {
                        botInstance = [...BotManagerService.activeBots.values()].find(b => b.isConnected && (b.config?.companyId || 'company_default') === companyId);
                    }

                    if (botInstance && botInstance.isConnected) {
                        const template = (await getSetting(`notificationMessageTemplate_${companyId}`)) || (await getSetting('notificationMessageTemplate', 'Olá *{nome}*, você tem uma nova notificação: *{titulo}*'));
                        const text = template.replace(/{nome}/g, targetUser.name).replace(/{titulo}/g, title);
                        await botInstance.sendMessage(`${targetUser.phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`, text);
                    }
                }
            } catch (err) {
                console.warn('⚠️ Erro ao enviar aviso WhatsApp:', err.message);
            }

            res.status(201).json(notification);
        } catch (error) {
            console.error('Erro NotificationController.create:', error);
            res.status(500).json({ error: 'Erro ao criar notificação' });
        }
    }

    async generateIA(req, res) {
        try {
            const { instructions, recipientInfo, previousContent } = req.body;
            
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) return res.status(400).json({ error: 'OpenAI key não configurada' });
            
            const openai = new OpenAIService(openaiKey);
            const prompt = `Gere uma notificação formal e profissional com base em: ${instructions}. Destinatário: ${recipientInfo || ''}. Anterior: ${previousContent || ''}`;
            
            const result = await openai.askAssistant(null, null, prompt); // Simplificado para o exemplo
            res.json({ content: result.answer });
        } catch (error) {
            console.error('Erro NotificationController.generateIA:', error);
            res.status(500).json({ error: 'Erro ao gerar texto via IA' });
        }
    }

    async listAll(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const companyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');
            const notifications = await NotificationService.listAllNotifications(companyId);
            res.json(notifications);
        } catch (error) {
            console.error('Erro NotificationController.listAll:', error);
            res.status(500).json({ error: 'Erro ao listar todas as notificações' });
        }
    }

    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.role === 'superadmin' ? null : req.user.id;
            const ok = await NotificationService.markNotificationAsRead(id, userId);
            if (!ok) return res.status(404).json({ error: 'Notificação não encontrada ou acesso negado' });
            res.json({ success: true });
        } catch (error) {
            console.error('Erro NotificationController.markAsRead:', error);
            res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
        }
    }

    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.role === 'superadmin' ? null : req.user.id;
            const ok = await NotificationService.deleteNotification(id, userId);
            if (!ok) return res.status(404).json({ error: 'Notificação não encontrada ou acesso negado' });
            res.json({ success: true });
        } catch (error) {
            console.error('Erro NotificationController.delete:', error);
            res.status(500).json({ error: 'Erro ao excluir notificação' });
        }
    }
}

module.exports = new NotificationController();
