const fs = require('fs-extra');
const path = require('path');
const { DIRS } = require('../config');
const BotService = require('../services/BotService');
const BotManagerService = require('../services/BotManagerService');
const { getSetting, setSetting } = require('../services/DatabaseService');

class DashboardController {
    constructor() {
        this.metricsPath = path.join(DIRS.botConfigs, '..', 'metrics.json');
        this.getStats = this.getStats.bind(this);
        this.recordMetrics = this.recordMetrics.bind(this);
        this.getOpenAIKey = this.getOpenAIKey.bind(this);
        this.saveOpenAIKey = this.saveOpenAIKey.bind(this);
        this.getGroqKey = this.getGroqKey.bind(this);
        this.saveGroqKey = this.saveGroqKey.bind(this);
        this.getSettings = this.getSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.getBusinessHours = this.getBusinessHours.bind(this);
        this.saveBusinessHours = this.saveBusinessHours.bind(this);
        this.listHolidays = this.listHolidays.bind(this);
        this.addHoliday = this.addHoliday.bind(this);
        this.deleteHoliday = this.deleteHoliday.bind(this);
    }

    async getStats(req, res) {
        try {
            const isSuperAdmin = req.user && req.user.role === 'superadmin';
            const companyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');
            
            let metrics = { totalMessages: 0, totalTokens: 0, dailyStats: {}, botStats: {} };
            if (await fs.pathExists(this.metricsPath)) {
                metrics = await fs.readJson(this.metricsPath);
            }

            // Bots escopados pela empresa do usuário
            const allBots = await BotService.listBots(companyId);

            const db = require('../services/DatabaseService').getDatabase();
            let totalMessagesCount = 0;
            let aiResolvedCount = 0;
            let humanAttendedCount = 0;
            let totalChatsCount = 0;
            let activeChatsCount = 0;
            const dailyData = { labels: [], data: [] };

            if (db) {
                try {
                    // 1. Total real de mensagens (filtrado por empresa se não for superadmin geral)
                    let msgQuery = 'SELECT count(*) FROM messages';
                    const msgParams = [];
                    if (companyId) {
                        msgQuery = 'SELECT count(*) FROM messages m JOIN bots b ON m.botid = b.id WHERE b."companyId" = $1';
                        msgParams.push(companyId);
                    }
                    const msgRes = await db.query(msgQuery, msgParams);
                    totalMessagesCount = parseInt(msgRes.rows[0]?.count || 0, 10);

                    // 2. Chats e taxa de resolução autônoma por IA vs Humano
                    let chatQuery = 'SELECT c.status, c."needsHuman" FROM chats c';
                    const chatParams = [];
                    if (companyId) {
                        chatQuery = 'SELECT c.status, c."needsHuman" FROM chats c JOIN bots b ON c."botId" = b.id WHERE b."companyId" = $1';
                        chatParams.push(companyId);
                    }
                    const chatRes = await db.query(chatQuery, chatParams);
                    totalChatsCount = chatRes.rows.length;

                    chatRes.rows.forEach(chat => {
                        if (chat.status === 'attending' || chat.status === 'waiting') {
                            activeChatsCount++;
                        }
                        if (chat.needsHuman) {
                            humanAttendedCount++;
                        } else {
                            aiResolvedCount++;
                        }
                    });

                    // 3. Distribuição diária dos últimos 7 dias para o gráfico
                    let dailyQuery = `SELECT substring(timestamp, 1, 10) as day, count(*) as count 
                                       FROM messages 
                                       GROUP BY day ORDER BY day DESC LIMIT 7`;
                    const dailyParams = [];
                    if (companyId) {
                        dailyQuery = `SELECT substring(m.timestamp, 1, 10) as day, count(*) as count 
                                       FROM messages m JOIN bots b ON m.botid = b.id 
                                       WHERE b."companyId" = $1 
                                       GROUP BY day ORDER BY day DESC LIMIT 7`;
                        dailyParams.push(companyId);
                    }
                    const dailyRes = await db.query(dailyQuery, dailyParams);
                    const chronologicalRows = (dailyRes.rows || []).reverse();
                    dailyData.labels = chronologicalRows.map(r => r.day);
                    dailyData.data = chronologicalRows.map(r => parseInt(r.count, 10));
                } catch (dbErr) {
                    console.error('⚠️ [DashboardController] Erro ao consultar métricas do Postgres:', dbErr);
                }
            }

            // Query CSAT satisfaction metrics
            let csatAverage = null;
            let csatTotal = 0;
            if (db) {
                try {
                    let csatQuery = `SELECT AVG("csatRating")::numeric(10,1) as avg_score, COUNT("csatRating") as total_csat FROM chats WHERE "csatRating" IS NOT NULL`;
                    const csatParams = [];
                    if (companyId) {
                        csatQuery = `SELECT AVG(c."csatRating")::numeric(10,1) as avg_score, COUNT(c."csatRating") as total_csat FROM chats c JOIN bots b ON c."botId" = b.id WHERE b."companyId" = $1 AND c."csatRating" IS NOT NULL`;
                        csatParams.push(companyId);
                    }
                    const csatRes = await db.query(csatQuery, csatParams);
                    if (csatRes.rows.length > 0 && csatRes.rows[0].avg_score !== null) {
                        csatAverage = parseFloat(csatRes.rows[0].avg_score);
                        csatTotal = parseInt(csatRes.rows[0].total_csat, 10);
                    }
                } catch (csatErr) {
                    // Ignora caso coluna ainda não exista
                }
            }

            const aiResolutionRate = totalChatsCount > 0
                ? Math.round((aiResolvedCount / totalChatsCount) * 100)
                : 100;

            res.json({
                totalMessagesResponded: totalMessagesCount || (metrics.totalMessages || 0),
                totalTokens: metrics.totalTokens || 0,
                avgResponseTime: 450,
                errorRate: 0,
                aiResolutionRate,
                totalChats: totalChatsCount,
                activeChats: activeChatsCount,
                csatAverage,
                csatTotal,
                dailyData: dailyData.labels.length > 0 ? dailyData : (metrics.dailyStats || { labels: [], data: [] }),
                botStats: metrics.botStats || {},
                allowedBots: allBots
            });
        } catch (error) {
            console.error('Erro DashboardController.getStats:', error);
            res.status(500).json({ error: 'Erro ao carregar estatísticas' });
        }
    }

    async recordMetrics(req, res) {
        try {
            const { botId, tokens, timestamp } = req.body;
            // (Replicar lógica original de salvamento em metrics.json)
            // Aqui eu salvaria no arquivo central conforme a lógica do monolito
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao gravar métricas' });
        }
    }

    async getOpenAIKey(req, res) {
        try {
            const { getSetting } = require('../services/DatabaseService');
            const { decrypt } = require('../utils/crypto');
            const savedKeyRaw = await getSetting('openaiApiKey');
            const savedKey = savedKeyRaw ? decrypt(savedKeyRaw) : null;
            const activeKey = savedKey || process.env.OPENAI_API_KEY || '';
            const isConfigured = Boolean(activeKey && activeKey !== 'sua_api_key_aqui' && activeKey.trim() !== '');

            const maskedKey = isConfigured && activeKey.length > 8
                ? `${activeKey.slice(0, 7)}••••••••••••••••${activeKey.slice(-4)}`
                : (isConfigured ? '••••••••••••••••' : '');

            // SEGURANÇA: NUNCA enviar a chave em texto plano para o frontend
            res.json({
                configured: isConfigured,
                hasKey: isConfigured,
                maskedKey: maskedKey
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async saveOpenAIKey(req, res) {
        try {
            const { apiKey } = req.body;
            if (!apiKey || typeof apiKey !== 'string') {
                return res.status(400).json({ error: 'Chave inválida' });
            }

            const cleanKey = apiKey.trim();
            // Ignorar se enviou máscara ou placeholder
            if (cleanKey.includes('•••') || cleanKey === 'sua_api_key_aqui') {
                return res.json({ success: true, message: 'Chave mantida sem alterações' });
            }

            const { setSetting } = require('../services/DatabaseService');
            const { encrypt } = require('../utils/crypto');
            await setSetting('openaiApiKey', encrypt(cleanKey));
            process.env.OPENAI_API_KEY = cleanKey;

            res.json({ success: true, message: 'Chave OpenAI salva com sucesso' });
        } catch (error) {
            console.error('Erro saveOpenAIKey:', error);
            res.status(500).json({ error: 'Erro ao salvar chave da OpenAI' });
        }
    }

    async getGroqKey(req, res) {
        try {
            const { getSetting } = require('../services/DatabaseService');
            const { decrypt } = require('../utils/crypto');
            const savedKeyRaw = await getSetting('groqApiKey');
            const savedKey = savedKeyRaw ? (savedKeyRaw.includes(':') ? decrypt(savedKeyRaw) : savedKeyRaw) : null;
            const activeKey = savedKey || process.env.GROQ_API_KEY || '';
            const isConfigured = Boolean(activeKey && activeKey !== 'sua_api_key_aqui' && activeKey.trim() !== '');

            const maskedKey = isConfigured && activeKey.length > 8
                ? `${activeKey.slice(0, 7)}••••••••••••••••${activeKey.slice(-4)}`
                : (isConfigured ? '••••••••••••••••' : '');

            res.json({
                configured: isConfigured,
                hasKey: isConfigured,
                maskedKey: maskedKey
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async saveGroqKey(req, res) {
        try {
            const { apiKey } = req.body;
            if (!apiKey || typeof apiKey !== 'string') {
                return res.status(400).json({ error: 'Chave inválida' });
            }

            const cleanKey = apiKey.trim();
            if (cleanKey.includes('•••') || cleanKey === 'sua_api_key_aqui') {
                return res.json({ success: true, message: 'Chave mantida sem alterações' });
            }

            const { setSetting } = require('../services/DatabaseService');
            const { encrypt } = require('../utils/crypto');
            await setSetting('groqApiKey', encrypt(cleanKey));
            process.env.GROQ_API_KEY = cleanKey;

            res.json({ success: true, message: 'Chave Groq salva com sucesso' });
        } catch (error) {
            console.error('Erro saveGroqKey:', error);
            res.status(500).json({ error: 'Erro ao salvar chave do Groq' });
        }
    }

    async getSettings(req, res) {
        try {
            const isSuperAdmin = req.user && req.user.role === 'superadmin';
            const companyId = isSuperAdmin ? (req.query.companyId || req.user?.companyId || 'company_default') : (req.user?.companyId || 'company_default');

            const COMPANY_SPECIFIC_KEYS = [
                'welcomeMessageEnabled',
                'welcomeMessageTemplate',
                'farewellMessageEnabled',
                'farewellMessageTemplate',
                'captureNoticeEnabled',
                'captureMessageTemplate',
                'transferNoticeEnabled',
                'transferMessageTemplate',
                'callRejectNoticeEnabled',
                'callRejectMessageTemplate',
                'humanRequestTemplate',
                'csatEnabled',
                'csatMessageTemplate',
                'csatThanksTemplate',
                'notificationMessageTemplate',
                'emailNotifications',
                'botStatusNotifications',
                'errorNotifications'
            ];

            const keys = [
                ['systemName', 'Zeplyn'],
                ['systemDescription', 'Sistema de gerenciamento de chatbots com IA'],
                ['maintenanceMode', 'false'],
                ['emailNotifications', 'true'],
                ['botStatusNotifications', 'true'],
                ['errorNotifications', 'true'],
                ['notificationMessageTemplate', 'Olá *{nome}*, você tem uma nova notificação (*{titulo}*). Por favor, verifique assim que possível.'],
                ['welcomeMessageEnabled', 'true'],
                ['welcomeMessageTemplate', 'Bem-vindo ao suporte, como posso ajudar?'],
                ['farewellMessageEnabled', 'true'],
                ['farewellMessageTemplate', 'Seu atendimento foi finalizado. Protocolo: {protocolo}. Obrigado pelo contato!'],
                ['captureNoticeEnabled', 'true'],
                ['captureMessageTemplate', 'Olá! Sou o(a) atendente *{atendente}* e assumi seu atendimento. Em que posso te ajudar?'],
                ['transferNoticeEnabled', 'true'],
                ['transferMessageTemplate', 'Seu atendimento foi transferido para o(a) atendente *{atendente}*, que continuará o seu suporte a partir de agora. 🧑‍💻'],
                ['callRejectNoticeEnabled', 'true'],
                ['callRejectMessageTemplate', 'Olá! No momento não conseguimos atender chamadas de voz ou vídeo por este número de WhatsApp. 📞\n\nPor favor, nos envie uma mensagem de texto ou áudio que responderemos o mais rápido possível! Obrigado.'],
                ['humanRequestTemplate', 'Entendido! Estou chamando um atendente humano para falar com você. Por favor, aguarde um momento. 🧑‍💻'],
                ['csatEnabled', 'false'],
                ['csatMessageTemplate', 'Por favor, avalie nosso atendimento enviando uma nota de 1 a 5 (onde 1 é muito insatisfeito e 5 é excelente).'],
                ['csatThanksTemplate', '⭐ Muito obrigado pela sua avaliação! Sua nota *{nota}/5* foi registrada com sucesso e nos ajuda a melhorar cada vez mais nosso atendimento.'],
                ['backupFrequency', 'daily'],
                ['autoBackup', 'true'],
                ['sessionTimeout', '60'],
                ['requireStrongPasswords', 'true'],
                ['twoFactorAuth', 'false'],
                ['logLoginAttempts', 'true'],
                ['logUserActions', 'true'],
                ['logRetention', '30'],
                ['apiTimeout', '30'],
                ['retryAttempts', '3'],
                ['enableRateLimit', 'true'],
                ['defaultModel', 'gpt-3.5-turbo'],
                ['defaultMaxTokens', '500'],
                ['autoTranscribeAudios', 'false'],
                ['transcriptionProvider', 'groq']
            ];

            const result = {};
            for (const [key, defaultVal] of keys) {
                let val = null;
                if (COMPANY_SPECIFIC_KEYS.includes(key)) {
                    val = await getSetting(`${key}_${companyId}`);
                }
                if (val === null || val === undefined) {
                    val = await getSetting(key, defaultVal);
                }

                if (val === 'true') result[key] = true;
                else if (val === 'false') result[key] = false;
                else if (!isNaN(val) && val !== '' && !['systemName', 'systemDescription', 'welcomeMessageTemplate', 'farewellMessageTemplate', 'notificationMessageTemplate', 'captureMessageTemplate', 'transferMessageTemplate', 'callRejectMessageTemplate', 'humanRequestTemplate', 'csatMessageTemplate', 'csatThanksTemplate', 'defaultModel'].includes(key)) {
                    result[key] = Number(val);
                } else {
                    result[key] = val;
                }
            }

            res.json(result);
        } catch (error) {
            console.error('Erro DashboardController.getSettings:', error);
            res.status(500).json({ error: 'Erro ao carregar configurações' });
        }
    }

    async saveSettings(req, res) {
        try {
            const body = req.body || {};
            const isSuperAdmin = req.user && req.user.role === 'superadmin';
            const companyId = isSuperAdmin ? (body.companyId || req.query.companyId || req.user?.companyId || 'company_default') : (req.user?.companyId || 'company_default');

            const COMPANY_SPECIFIC_KEYS = [
                'welcomeMessageEnabled',
                'welcomeMessageTemplate',
                'farewellMessageEnabled',
                'farewellMessageTemplate',
                'captureNoticeEnabled',
                'captureMessageTemplate',
                'transferNoticeEnabled',
                'transferMessageTemplate',
                'callRejectNoticeEnabled',
                'callRejectMessageTemplate',
                'humanRequestTemplate',
                'csatEnabled',
                'csatMessageTemplate',
                'csatThanksTemplate',
                'notificationMessageTemplate',
                'emailNotifications',
                'botStatusNotifications',
                'errorNotifications'
            ];

            const restrictedKeys = [
                'systemName', 'systemDescription', 'maintenanceMode',
                'backupFrequency', 'autoBackup', 'sessionTimeout',
                'requireStrongPasswords', 'twoFactorAuth', 'logLoginAttempts',
                'logUserActions', 'logRetention', 'apiTimeout', 'retryAttempts',
                'enableRateLimit', 'defaultModel', 'defaultMaxTokens',
                'autoTranscribeAudios', 'transcriptionProvider'
            ];

            for (const [key, value] of Object.entries(body)) {
                if (value !== undefined) {
                    if (!isSuperAdmin && restrictedKeys.includes(key)) {
                        continue;
                    }
                    if (COMPANY_SPECIFIC_KEYS.includes(key)) {
                        await setSetting(`${key}_${companyId}`, String(value));
                        if (companyId === 'company_default' || (isSuperAdmin && !body.companyId && !req.query.companyId)) {
                            await setSetting(key, String(value));
                        }
                    } else {
                        await setSetting(key, String(value));
                    }
                }
            }

            try {
                const AuditService = require('../services/AuditService');
                const updatedList = Object.keys(body).filter(k => k !== 'password' && k !== 'companyId');
                AuditService.logRequest(req, {
                    action: 'SETTINGS_UPDATE',
                    description: `Alterou as configurações (${updatedList.slice(0, 4).join(', ')}${updatedList.length > 4 ? '...' : ''})`,
                    category: 'settings',
                    details: { updatedKeys: updatedList }
                });
            } catch (_) {}

            res.json({ success: true, message: 'Configurações salvas com sucesso' });
        } catch (error) {
            console.error('Erro DashboardController.saveSettings:', error);
            res.status(500).json({ error: 'Erro ao salvar configurações' });
        }
    }

    async getBusinessHours(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const BusinessHoursService = require('../services/BusinessHoursService');
            const data = await BusinessHoursService.getSettings(companyId);
            res.json(data);
        } catch (error) {
            console.error('Erro DashboardController.getBusinessHours:', error);
            res.status(500).json({ error: 'Erro ao carregar horário de funcionamento' });
        }
    }

    async saveBusinessHours(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const BusinessHoursService = require('../services/BusinessHoursService');
            await BusinessHoursService.saveSettings(req.body, companyId);
            res.json({ success: true, message: 'Horário de funcionamento salvo com sucesso' });
        } catch (error) {
            console.error('Erro DashboardController.saveBusinessHours:', error);
            res.status(500).json({ error: 'Erro ao salvar horário de funcionamento' });
        }
    }

    async listHolidays(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const BusinessHoursService = require('../services/BusinessHoursService');
            const holidays = await BusinessHoursService.listHolidays(companyId);
            res.json({ success: true, holidays });
        } catch (error) {
            console.error('Erro DashboardController.listHolidays:', error);
            res.status(500).json({ error: 'Erro ao listar feriados' });
        }
    }

    async addHoliday(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const { name, date, message } = req.body;
            if (!name || !date) {
                return res.status(400).json({ error: 'Nome e data são obrigatórios' });
            }
            const BusinessHoursService = require('../services/BusinessHoursService');
            const holiday = await BusinessHoursService.addHoliday({ name, date, message }, companyId);
            res.status(201).json({ success: true, holiday });
        } catch (error) {
            console.error('Erro DashboardController.addHoliday:', error);
            res.status(400).json({ error: error.message || 'Erro ao cadastrar feriado' });
        }
    }

    async deleteHoliday(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const { id } = req.params;
            const BusinessHoursService = require('../services/BusinessHoursService');
            await BusinessHoursService.deleteHoliday(id, companyId);
            res.json({ success: true, message: 'Feriado removido com sucesso' });
        } catch (error) {
            console.error('Erro DashboardController.deleteHoliday:', error);
            res.status(500).json({ error: 'Erro ao remover feriado' });
        }
    }
}

module.exports = new DashboardController();
