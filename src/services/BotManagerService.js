const WhatsAppService = require('./WhatsAppService');
const BotService = require('./BotService');

class BotManagerService {
    constructor() {
        this.activeBots = new Map();
        this.io = null;
    }

    setIo(io) {
        this.io = io;
    }

    async getBotInstance(botId) {
        if (!this.activeBots.has(botId)) {
            const botData = await BotService.getBot(botId);
            const channel = botData?.channel || 'whatsapp';
            let botInstance;

            if (channel === 'telegram') {
                const TelegramService = require('./TelegramService');
                botInstance = new TelegramService(botId, this.io, botData);
            } else if (channel === 'instagram') {
                const InstagramService = require('./InstagramService');
                botInstance = new InstagramService(botId, this.io, botData);
            } else {
                botInstance = new WhatsAppService(botId, this.io);
            }

            this.activeBots.set(botId, botInstance);
        }
        return this.activeBots.get(botId);
    }

    async getBotByInstagramPageId(pageId) {
        const cleanId = pageId ? String(pageId).trim() : null;

        // 1. Procura entre instâncias ativas em memória
        for (const [id, instance] of this.activeBots.entries()) {
            if (instance.channel === 'instagram') {
                if (!cleanId ||
                    instance.config?.instagramPageId === cleanId || 
                    instance.config?.instagramAccountId === cleanId || 
                    instance.pageInfo?.id === cleanId ||
                    instance.pageInfo?.instagram_business_account?.id === cleanId) {
                    return instance;
                }
            }
        }

        // 2. Procura no banco de dados por instagramPageId ou instagramAccountId
        const { getDatabase } = require('./DatabaseService');
        const db = getDatabase();
        if (db) {
            if (cleanId) {
                const res = await db.query(
                    'SELECT id FROM bots WHERE channel = \'instagram\' AND ("instagramPageId" = $1 OR "instagramAccountId" = $1) LIMIT 1',
                    [cleanId]
                );
                if (res.rows.length > 0) {
                    const inst = await this.getBotInstance(res.rows[0].id);
                    if (!inst.isConnected && inst.hasSavedCredentials()) {
                        await inst.start().catch(e => console.warn('[BotManager] Auto-start Instagram:', e.message));
                    }
                    return inst;
                }
            }

            // Fallback: se houver qualquer bot de Instagram cadastrado
            const resFallback = await db.query("SELECT id FROM bots WHERE channel = 'instagram' LIMIT 1");
            if (resFallback.rows.length > 0) {
                const inst = await this.getBotInstance(resFallback.rows[0].id);
                if (!inst.isConnected && inst.hasSavedCredentials()) {
                    await inst.start().catch(e => console.warn('[BotManager] Auto-start Instagram fallback:', e.message));
                }
                return inst;
            }
        }

        // 3. Fallback se houver qualquer instância ativa do canal instagram
        for (const [id, instance] of this.activeBots.entries()) {
            if (instance.channel === 'instagram') {
                return instance;
            }
        }
        return null;
    }

    getConnectedBotInstance(preferredBotId = null, companyId = null, channel = null) {
        if (preferredBotId && this.activeBots.has(preferredBotId)) {
            const preferred = this.activeBots.get(preferredBotId);
            const preferredChannel = preferred.channel || 'whatsapp';
            if (preferred && preferred.isConnected) {
                if (!channel || preferredChannel === channel) {
                    if (!companyId || (preferred.config?.companyId || 'company_default') === companyId) {
                        return preferred;
                    }
                }
            }
        }
        for (const [id, instance] of this.activeBots.entries()) {
            if (instance && instance.isConnected) {
                const instChannel = instance.channel || 'whatsapp';
                if (!channel || instChannel === channel) {
                    if (!companyId || (instance.config?.companyId || 'company_default') === companyId) {
                        return instance;
                    }
                }
            }
        }
        return null;
    }

    async startBot(botId, forceNewAuth = false) {
        // Valida se a empresa dona deste bot está suspensa
        const botData = await BotService.getBot(botId);
        if (botData && botData.companyId) {
            const CompanyService = require('./CompanyService');
            const company = await CompanyService.getCompanyById(botData.companyId);
            if (company && company.isActive === false) {
                throw new Error(`A empresa "${company.name}" está suspensa. Os bots não podem ser iniciados até que a empresa seja reativada.`);
            }
        }

        const instance = await this.getBotInstance(botId);
        if (!instance.isConnected || forceNewAuth) {
            await instance.start(forceNewAuth);
            console.log(`🚀 Bot ${botId} iniciado via ManagerService`);
        }
        return instance;
    }

    emitToCompany(companyId, event, ...args) {
        if (!this.io) return;
        const target = companyId || 'company_default';
        this.io.to(`company_${target}`).emit(event, ...args);
        this.io.to('company_superadmin').emit(event, ...args);
    }

    disconnectUserSockets(userId) {
        if (!this.io || !userId) return;
        try {
            this.io.in(`user_${userId}`).disconnectSockets(true);
            console.log(`🔌 [Socket.IO] Sockets forçadamente desconectados para o usuário: ${userId}`);
        } catch (err) {
            console.warn(`[Socket.IO] Erro ao desconectar sockets do usuário ${userId}:`, err.message);
        }
    }

    disconnectCompanySockets(companyId) {
        if (!this.io || !companyId) return;
        try {
            this.io.in(`company_${companyId}`).disconnectSockets(true);
            console.log(`🔌 [Socket.IO] Sockets forçadamente desconectados para a empresa: ${companyId}`);
        } catch (err) {
            console.warn(`[Socket.IO] Erro ao desconectar sockets da empresa ${companyId}:`, err.message);
        }
    }

    async emitForBot(botId, event, ...args) {
        if (!this.io) return;
        try {
            let companyId = null;
            if (this.activeBots.has(botId)) {
                companyId = this.activeBots.get(botId)?.config?.companyId;
            }
            if (!companyId) {
                const botData = await BotService.getBot(botId);
                companyId = botData?.companyId;
            }
            this.emitToCompany(companyId || 'company_default', event, ...args);
        } catch (_) {
            this.emitToCompany('company_default', event, ...args);
        }
    }

    async stopBot(botId) {
        if (this.activeBots.has(botId)) {
            const instance = this.activeBots.get(botId);
            await instance.stop();
            this.activeBots.delete(botId);
            console.log(`🛑 Bot ${botId} parado via ManagerService`);
        }
        if (this.io) {
            this.emitForBot(botId, 'bot-status', { botId, status: 'stopped' });
            this.emitForBot(botId, 'bot_status_changed', { botId, status: 'stopped' });
        }
    }

    async startAllBots() {
        const bots = await BotService.listBots(null, true);
        console.log(`📦 Verificando ${bots.length} bots cadastrados para restauração de sessões ativas...`);
        
        let restoredCount = 0;
        const CompanyService = require('./CompanyService');
        for (const bot of bots) {
            try {
                // Se a empresa do bot estiver suspensa, não restaura automaticamente
                if (bot.companyId) {
                    const company = await CompanyService.getCompanyById(bot.companyId);
                    if (company && company.isActive === false) {
                        console.log(`⏸️ [BotManager] Bot ${bot.id} (${bot.name}) pertence à empresa suspensa "${company.name}". Restauração ignorada.`);
                        continue;
                    }
                }

                const instance = await this.getBotInstance(bot.id);
                // Só restaura automaticamente conexões de bots que já possuem pareamento/credenciais salvas
                if (!instance.hasSavedCredentials()) {
                    console.log(`⏸️ [BotManager] Bot ${bot.id} (${bot.name}) não possui sessão pareada prévia. Aguardando conexão manual do usuário.`);
                    continue;
                }

                if (restoredCount > 0) {
                    const delay = 3000;
                    console.log(`⏳ Aguardando ${delay/1000}s para restaurar próximo bot...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                await this.startBot(bot.id);
                restoredCount++;
            } catch (error) {
                console.error(`❌ Erro ao restaurar bot ${bot.id}: ${error.message}`);
            }
        }
        console.log(`✅ [BotManager] Restauração concluída: ${restoredCount} bots restaurados.`);
    }

    getStatus(botId) {
        if (!this.activeBots.has(botId)) return 'stopped';
        const instance = this.activeBots.get(botId);
        if (instance.isConnected) return 'running';
        if (instance.isStarting || instance.sock) return 'connecting';
        return 'stopped';
    }

    getBotInfo(botId) {
        const status = this.getStatus(botId);
        let phone = null;
        let profileName = null;
        const instance = this.activeBots.get(botId);
        if (instance) {
            if (instance.channel === 'telegram') {
                phone = instance.botInfo?.username ? `@${instance.botInfo.username}` : 'Telegram Bot';
                profileName = instance.botInfo?.first_name || 'Telegram';
            } else if (instance.channel === 'instagram') {
                phone = instance.pageInfo?.name || 'Instagram Direct';
                profileName = instance.pageInfo?.name || 'Instagram';
            } else if (instance.botNumber) {
                phone = instance.botNumber;
            } else if (instance.sock?.user?.id) {
                phone = instance.sock.user.id.split(':')[0];
                profileName = instance.sock?.user?.name || instance.sock?.user?.notify || null;
            } else {
                profileName = instance.sock?.user?.name || instance.sock?.user?.notify || null;
            }
        }

        // Se ainda não tiver número, tenta ler diretamente do creds.json salvo
        if (!phone) {
            try {
                const path = require('path');
                const fs = require('fs-extra');
                const credsPath = path.join(process.cwd(), 'auth_info', botId, 'creds.json');
                if (fs.existsSync(credsPath)) {
                    const creds = fs.readJsonSync(credsPath);
                    if (creds && creds.me && creds.me.id) {
                        phone = creds.me.id.split(':')[0];
                        profileName = profileName || creds.me.name || null;
                    }
                }
            } catch (_) {}
        }

        return { status, phone, profileName };
    }

    getAllStatus() {
        const status = {};
        for (const [botId, instance] of this.activeBots) {
            if (instance.isConnected) status[botId] = 'running';
            else if (instance.isStarting || instance.sock) status[botId] = 'connecting';
            else status[botId] = 'stopped';
        }
        return status;
    }

    async subscribePresence(botId, contactJid) {
        if (!contactJid) return;
        const bot = this.getConnectedBotInstance(botId);
        if (bot && typeof bot.subscribePresence === 'function') {
            await bot.subscribePresence(contactJid);
        }
    }
}

// Singleton
module.exports = new BotManagerService();
