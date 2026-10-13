const BotService = require('../services/BotService');
const BotManagerService = require('../services/BotManagerService');
const UserService = require('../services/UserService');
const CompanyService = require('../services/CompanyService');

// Helper de segurança: remove chaves sensíveis e envia apenas o status de configuração
function sanitizeBotForResponse(bot) {
    if (!bot) return bot;
    const { openaiApiKey, ...safeBot } = bot;
    const hasOwnKey = Boolean(openaiApiKey && openaiApiKey !== 'sua_api_key_aqui' && openaiApiKey.trim() !== '');
    const hasEnvKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sua_api_key_aqui' && process.env.OPENAI_API_KEY.trim() !== '');
    const isConfigured = hasOwnKey || hasEnvKey;

    return {
        ...safeBot,
        hasOpenaiKey: isConfigured,
        isAiConfigured: isConfigured,
        // Mantém compatibilidade com frontends que verificam a existência de chave sem expor a chave real
        openaiApiKey: isConfigured ? '••••••••' : ''
    };
}

class BotController {
    async list(req, res) {
        try {
            const user = req.user;
            // Se for superadmin, pode listar de todos ou filtrar por query param companyId
            // Se for admin ou operador de empresa, lista EXCLUSIVAMENTE os bots da sua empresa
            let targetCompanyId = null;
            if (user.role === 'superadmin') {
                targetCompanyId = req.query.companyId || null;
            } else {
                targetCompanyId = user.companyId || 'company_default';
            }

            const bots = await BotService.listBots(targetCompanyId);
            
            // Adicionar status em tempo real e sanitizar credenciais
            const enrichedBots = bots.map(bot => {
                const info = BotManagerService.getBotInfo(bot.id);
                return sanitizeBotForResponse({
                    ...bot,
                    status: info.status,
                    phoneNumber: info.phone || null,
                    profileName: info.profileName || null
                });
            });
            
            res.json(enrichedBots);
        } catch (error) {
            console.error('Erro BotController.list:', error);
            res.status(500).json({ error: 'Erro ao listar bots' });
        }
    }

    async getById(req, res) {
        try {
            const { botId } = req.params;
            const bot = await BotService.getBot(botId);
            if (!bot) return res.status(404).json({ error: 'Bot não encontrado' });

            // Validação de isolamento: usuário só acessa bots da própria empresa
            if (req.user.role !== 'superadmin' && bot.companyId !== req.user.companyId) {
                return res.status(403).json({ error: 'Acesso negado a este bot.' });
            }
            
            const info = BotManagerService.getBotInfo(botId);
            bot.status = info.status;
            bot.phoneNumber = info.phone || null;
            bot.profileName = info.profileName || null;
            res.json(sanitizeBotForResponse(bot));
        } catch (error) {
            console.error('Erro BotController.getById:', error);
            res.status(500).json({ error: 'Erro ao obter bot' });
        }
    }

    async create(req, res) {
        try {
            const { 
                name, 
                model, 
                maxTokens, 
                temperature, 
                systemPrompt, 
                userId, 
                openaiApiKey, 
                companyId,
                operationMode,
                ignoreGroups,
                adminPhoneNumber,
                channel,
                telegramToken,
                instagramPageId,
                instagramAccessToken
            } = req.body;
            if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

            // Determinar empresa dona do bot
            let targetCompanyId = req.user.companyId || 'company_default';
            if (req.user.role === 'superadmin' && companyId) {
                targetCompanyId = companyId;
            }

            // Validar status e limite de bots da empresa
            const company = await CompanyService.getCompanyById(targetCompanyId);
            if (company) {
                if (company.isActive === false) {
                    return res.status(403).json({
                        error: `A empresa "${company.name}" está suspensa no sistema. Não é permitido criar novos bots.`
                    });
                }
                if (company.botCount >= company.maxBots) {
                    return res.status(400).json({
                        error: `Limite de bots atingido para esta empresa (Máximo permitido: ${company.maxBots} bots). Solicite um aumento de plano com o administrador.`
                    });
                }
            }

            const targetUserId = userId || req.user.id;
            
            // Apenas grava chave própria se fornecida explicitamente e não for máscara
            const customApiKey = openaiApiKey && typeof openaiApiKey === 'string' && openaiApiKey.trim() !== '' && !openaiApiKey.includes('•••') && openaiApiKey !== 'sua_api_key_aqui'
                ? openaiApiKey.trim()
                : '';

            const botId = `bot_${Date.now()}`;
            const config = {
                id: botId,
                name,
                companyId: targetCompanyId,
                openaiApiKey: customApiKey,
                model: model || 'gpt-3.5-turbo',
                maxTokens: maxTokens || 500,
                temperature: temperature || 0.7,
                systemPrompt: systemPrompt || 'Você é um assistente virtual útil.',
                userId: targetUserId,
                createdAt: new Date().toISOString(),
                operationMode: operationMode || 'standard',
                ignoreGroups: ignoreGroups !== undefined ? !!ignoreGroups : true,
                adminPhoneNumber: adminPhoneNumber || null,
                channel: channel || 'whatsapp',
                telegramToken: telegramToken || null,
                instagramPageId: instagramPageId || null,
                instagramAccessToken: instagramAccessToken || null
            };

            const newBot = await BotService.createBot(config);
            res.status(201).json(sanitizeBotForResponse(newBot));
        } catch (error) {
            console.error('Erro BotController.create:', error);
            res.status(500).json({ error: 'Erro ao criar bot: ' + error.message });
        }
    }

    async update(req, res) {
        try {
            const { botId } = req.params;
            const bot = await BotService.getBot(botId);
            if (!bot) return res.status(404).json({ error: 'Bot não encontrado' });
            if (req.user.role !== 'superadmin' && bot.companyId !== req.user.companyId) {
                return res.status(403).json({ error: 'Acesso negado para editar este bot.' });
            }

            const updates = { ...req.body };
            
            // Proteger: não sobrescrever a chave existente se o frontend enviar máscara ou vazio
            if (updates.openaiApiKey !== undefined) {
                const keyStr = String(updates.openaiApiKey).trim();
                if (!keyStr || keyStr.includes('•••') || keyStr === 'sua_api_key_aqui') {
                    delete updates.openaiApiKey;
                }
            }

            const updatedBot = await BotService.updateBot(botId, updates);
            res.json(sanitizeBotForResponse(updatedBot));
        } catch (error) {
            console.error('Erro BotController.update:', error);
            res.status(500).json({ error: 'Erro ao atualizar bot' });
        }
    }

    async delete(req, res) {
        try {
            const { botId } = req.params;
            const bot = await BotService.getBot(botId);
            if (!bot) return res.status(404).json({ error: 'Bot não encontrado' });
            if (req.user.role !== 'superadmin' && bot.companyId !== req.user.companyId) {
                return res.status(403).json({ error: 'Acesso negado para excluir este bot.' });
            }

            await BotManagerService.stopBot(botId);
            await BotService.deleteBot(botId);

            // Limpar resíduos de arquivos (sessão WhatsApp e QR Code em cache)
            const fs = require('fs-extra');
            const path = require('path');
            const authDir = path.join(__dirname, '..', '..', 'auth_info', botId);
            const qrFile = path.join(__dirname, '..', '..', 'bot-configs', `${botId}_qr.json`);
            await fs.remove(authDir).catch(() => {});
            await fs.remove(qrFile).catch(() => {});

            // Desvincular e remover contatos e figurinhas
            try {
                const ContactService = require('../services/ContactService');
                await ContactService.deleteContactsByBotId(botId);
                const StickerService = require('../services/StickerService');
                await StickerService.deleteStickersByBotId(botId);
            } catch (_) {}

            res.json({ success: true, message: 'Bot deletado' });
        } catch (error) {
            console.error('Erro BotController.delete:', error);
            res.status(500).json({ error: 'Erro ao deletar bot' });
        }
    }

    async toggle(req, res) {
        try {
            const { botId } = req.params;
            const bot = await BotService.getBot(botId);
            if (!bot) return res.status(404).json({ error: 'Bot não encontrado' });
            if (req.user.role !== 'superadmin' && bot.companyId !== req.user.companyId) {
                return res.status(403).json({ error: 'Acesso negado para controlar este bot.' });
            }

            const { action } = req.body; // 'start' ou 'stop'

            if (action === 'start') {
                await BotManagerService.startBot(botId);
                res.json({ success: true, status: 'starting' });
            } else {
                await BotManagerService.stopBot(botId);
                res.json({ success: true, status: 'stopped' });
            }
        } catch (error) {
            console.error('Erro BotController.toggle:', error);
            res.status(500).json({ error: 'Erro ao alterar estado do bot' });
        }
    }

    async start(req, res) {
        try {
            const { botId } = req.params;
            const forceNewAuth = Boolean(req.body?.forceNewAuth || req.query?.forceNewAuth === 'true');
            await BotManagerService.startBot(botId, forceNewAuth);
            res.json({ success: true, status: 'starting' });
        } catch (error) {
            const status = error.message && error.message.includes('suspensa') ? 403 : 500;
            res.status(status).json({ error: error.message });
        }
    }

    async stop(req, res) {
        try {
            const { botId } = req.params;
            await BotManagerService.stopBot(botId);
            res.json({ success: true, status: 'stopped' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async disconnect(req, res) {
        try {
            const { botId } = req.params;
            // Desconectar envolve parar e limpar sessão
            await BotManagerService.stopBot(botId);
            const authDir = require('path').join(__dirname, '..', '..', 'auth_info', botId);
            const fs = require('fs-extra');
            if (await fs.pathExists(authDir)) {
                await fs.remove(authDir);
            }

            // Desvincula e remove os contatos CRM do bot desconectado
            const ContactService = require('../services/ContactService');
            await ContactService.deleteContactsByBotId(botId);

            // Desvincula e remove as figurinhas vinculadas à conexão do WhatsApp
            const StickerService = require('../services/StickerService');
            await StickerService.deleteStickersByBotId(botId);

            res.json({ success: true, status: 'disconnected' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getQR(req, res) {
        try {
            const { botId } = req.params;
            const qrPath = require('path').join(__dirname, '..', '..', 'bot-configs', `${botId}_qr.json`);
            const fs = require('fs-extra');
            
            if (await fs.pathExists(qrPath)) {
                const qrData = await fs.readJson(qrPath);
                // Se o QR tem mais de 2 minutos, pode estar expirado
                if (Date.now() - qrData.timestamp > 120000) {
                    return res.json({ qrCode: null, status: 'expired' });
                }
                res.json(qrData);
            } else {
                res.status(404).json({ qrCode: null, status: 'not_found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async importBot(req, res) {
        try {
            const botData = req.body;
            if (!botData.name) return res.status(400).json({ error: 'Dados do bot inválidos: nome ausente' });

            // Verificar se o userId do JSON existe no banco local
            let targetUserId = req.user.id; // Fallback para o usuário logado
            if (botData.userId) {
                const userExists = await UserService.findUserById(botData.userId);
                if (userExists) {
                    targetUserId = botData.userId;
                }
            }
            
            // Garantir que temos um ID único
            let botId = botData.id || `bot_${Date.now()}`;
            const existing = await BotService.getBot(botId);
            if (existing) {
                botId = `bot_${Date.now()}_imported`;
            }

            const config = {
                ...botData,
                id: botId,
                userId: targetUserId,
                createdAt: botData.createdAt || new Date().toISOString()
            };

            // Remover campos de status em tempo real se existirem no JSON
            delete config.status;

            const newBot = await BotService.createBot(config);
            res.status(201).json(newBot);
        } catch (error) {
            console.error('Erro BotController.importBot:', error);
            res.status(500).json({ error: 'Erro ao importar bot: ' + error.message });
        }
    }

    async listQA(req, res) {
        try {
            const { botId } = req.params;
            const qas = await BotService.listBotQA(botId);
            res.json(qas);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async addQA(req, res) {
        try {
            const { botId } = req.params;
            const { question, answer } = req.body;
            const qa = await BotService.addBotQA(botId, question, answer);
            res.status(201).json(qa);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateQA(req, res) {
        try {
            const { qaId } = req.params;
            const { question, answer } = req.body;
            await BotService.updateBotQA(qaId, question, answer);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteQA(req, res) {
        try {
            const { qaId } = req.params;
            await BotService.deleteBotQA(qaId);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async test(req, res) {
        try {
            const { botId } = req.params;
            const { message } = req.body;
            
            // Tentar obter a instância existente para manter blindagem e IDs corretos
            const botInstance = await BotManagerService.getBotInstance(botId);
            
            // Carregar config atualizada do banco
            await botInstance.loadConfig(true);

            // Garantir que a OpenAI está inicializada para este bot
            if (!botInstance.openaiService) {
                const initialized = await botInstance.initializeOpenAI();
                if (!initialized) {
                    return res.status(400).json({ error: 'OpenAI não pôde ser inicializada. Verifique a chave API.' });
                }
            }
            
            // Usar o método processAI da instância (Q&A Match + OpenAI)
            console.log(`🧪 [Test Endpoint] Mensagem para ${botId}: ${message}`);
            const response = await botInstance.processAI(message, 'test_user');
            
            res.json({ success: true, response });
        } catch (error) {
            console.error('Erro BotController.test:', error);
            res.status(500).json({ error: 'Erro ao processar mensagem de teste: ' + error.message });
        }
    }
}

module.exports = new BotController();
