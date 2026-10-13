const { getDatabase } = require('./DatabaseService');
const BotManagerService = require('./BotManagerService');
const { sanitizePhoneNumber } = require('../utils/helpers');

class CampaignService {
    constructor() {
        this.runningCampaigns = new Set();
        this.pausedCampaigns = new Set();
        this.canceledCampaigns = new Set();

        // Garante colunas anti-ban e horários aleatórios no banco
        this.ensureColumns().catch(err => {
            console.error('⚠️ [CampaignService] Aviso ao verificar colunas anti-ban:', err.message);
        });

        // Checar campanhas agendadas a cada 30 segundos
        setInterval(() => this.checkScheduledCampaigns(), 30 * 1000);

        // Retomar campanhas em execução após reinício do servidor (com atraso de 6s para os bots subirem)
        setTimeout(() => this.resumeInterruptedCampaigns(), 6000);
    }

    getIo() {
        return BotManagerService.io;
    }

    /**
     * Garante a criação de colunas anti-ban e controle de horários no banco
     */
    async ensureColumns() {
        const db = getDatabase();
        if (!db) return;
        try {
            await db.query(`
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "randomTimeEnabled" BOOLEAN DEFAULT TRUE;
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "windowStartTime" TEXT DEFAULT '08:30';
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "windowEndTime" TEXT DEFAULT '18:00';
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "dispatchDays" TEXT DEFAULT '["1","2","3","4","5","6"]';
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchMin" INTEGER DEFAULT 5;
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchMax" INTEGER DEFAULT 12;
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchPauseMin" INTEGER DEFAULT 5;
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchPauseMax" INTEGER DEFAULT 15;
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "distributionMode" TEXT DEFAULT 'random_day';
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "waitReason" TEXT;
                ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "nextDispatchAt" TEXT;
            `);
        } catch (e) {
            console.warn('⚠️ [CampaignService] Falha ao verificar colunas (já existem ou migração pendente):', e.message);
        }
    }

    /**
     * Resolve Spintax: substitui variações {Olá|Oi|Bom dia} por uma opção randômica
     */
    parseSpintax(text) {
        if (!text) return '';
        let spintaxRegex = /\{([^{}]+)\}/;
        let match;
        let result = text;
        while ((match = spintaxRegex.exec(result)) !== null) {
            const options = match[1].split('|');
            const chosen = options[Math.floor(Math.random() * options.length)].trim();
            result = result.slice(0, match.index) + chosen + result.slice(match.index + match[0].length);
        }
        return result;
    }

    /**
     * Interpola variáveis dinâmicas: {{nome}}, {{telefone}}, {{data}}, {{hora}}
     */
    interpolateVariables(text, contact = {}) {
        if (!text) return '';
        let result = text;
        const vars = {
            nome: contact.name || contact.contactName || 'Cliente',
            telefone: contact.phoneNumber || '',
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            ...(contact.customVars || {})
        };

        for (const [key, val] of Object.entries(vars)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            result = result.replace(regex, val || '');
        }
        return result;
    }

    /**
     * Lista campanhas filtrando por empresa ou bot
     */
    async listCampaigns(companyId = null, botId = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            let sql = `
                SELECT c.*, b.name as "botName"
                FROM campaigns c
                LEFT JOIN bots b ON c."botId" = b.id
                WHERE 1=1
            `;
            const params = [];

            if (companyId) {
                params.push(companyId);
                sql += ` AND (c."companyId" = $${params.length} OR c."companyId" IS NULL)`;
            }

            if (botId) {
                params.push(botId);
                sql += ` AND c."botId" = $${params.length}`;
            }

            sql += ` ORDER BY c."createdAt" DESC`;

            const res = await db.query(sql, params);
            return res.rows;
        } catch (error) {
            console.error('❌ Erro no listCampaigns:', error);
            return [];
        }
    }

    /**
     * Obtém detalhes de uma campanha específica
     */
    async getCampaign(id) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const res = await db.query(`
                SELECT c.*, b.name as "botName"
                FROM campaigns c
                LEFT JOIN bots b ON c."botId" = b.id
                WHERE c.id = $1
            `, [id]);
            return res.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro no getCampaign:', error);
            return null;
        }
    }

    /**
     * Cria uma nova campanha com suporte a janelas de horários e dispersão anti-ban
     */
    async createCampaign(data, companyId = null) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        const {
            name,
            botId,
            messageTemplate,
            mediaUrl = null,
            mediaType = 'none',
            delayMin = 30,
            delayMax = 75,
            targetType = 'all',
            targetTags = [],
            manualNumbers = [],
            scheduledAt = null,
            // Configurações de horários aleatórios e proteção anti-ban
            randomTimeEnabled = true,
            windowStartTime = '08:30',
            windowEndTime = '18:00',
            dispatchDays = ['1', '2', '3', '4', '5', '6'],
            batchMin = 5,
            batchMax = 12,
            batchPauseMin = 5,
            batchPauseMax = 15,
            distributionMode = 'random_day'
        } = data;

        if (!name || !botId || !messageTemplate) {
            throw new Error('Nome da campanha, Bot e Mensagem são obrigatórios');
        }

        const id = `camp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();
        const initialStatus = scheduledAt ? 'scheduled' : 'draft';

        const tagsJson = typeof targetTags === 'string' ? targetTags : JSON.stringify(targetTags || []);
        const numbersJson = typeof manualNumbers === 'string' ? manualNumbers : JSON.stringify(manualNumbers || []);
        const daysJson = typeof dispatchDays === 'string' ? dispatchDays : JSON.stringify(dispatchDays || ['1', '2', '3', '4', '5', '6']);

        const insertQuery = `
            INSERT INTO campaigns (
                id, name, "botId", "companyId", "messageTemplate", 
                "mediaUrl", "mediaType", "delayMin", "delayMax", 
                "targetType", "targetTags", "manualNumbers", 
                status, "scheduledAt", "totalCount", "sentCount", "failedCount",
                "randomTimeEnabled", "windowStartTime", "windowEndTime", "dispatchDays",
                "batchMin", "batchMax", "batchPauseMin", "batchPauseMax", "distributionMode",
                "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, $9, 
                $10, $11, $12, 
                $13, $14, 0, 0, 0,
                $15, $16, $17, $18,
                $19, $20, $21, $22, $23,
                $24, $25
            ) RETURNING *
        `;

        const values = [
            id, name, botId, companyId, messageTemplate,
            mediaUrl, mediaType, Math.max(parseInt(delayMin, 10) || 30, 5), Math.max(parseInt(delayMax, 10) || 75, 10),
            targetType, tagsJson, numbersJson,
            initialStatus, scheduledAt || null,
            Boolean(randomTimeEnabled), windowStartTime || '08:30', windowEndTime || '18:00', daysJson,
            Math.max(parseInt(batchMin, 10) || 5, 2), Math.max(parseInt(batchMax, 10) || 12, 3),
            Math.max(parseInt(batchPauseMin, 10) || 5, 1), Math.max(parseInt(batchPauseMax, 10) || 15, 2),
            distributionMode || 'random_day',
            now, now
        ];

        const res = await db.query(insertQuery, values);
        return res.rows[0];
    }

    /**
     * Exclui uma campanha e seus logs
     */
    async deleteCampaign(id) {
        const db = getDatabase();
        if (!db) return false;

        this.canceledCampaigns.add(id);
        this.runningCampaigns.delete(id);

        try {
            await db.query('DELETE FROM campaign_logs WHERE "campaignId" = $1', [id]);
            await db.query('DELETE FROM campaigns WHERE id = $1', [id]);
            return true;
        } catch (error) {
            console.error('❌ Erro no deleteCampaign:', error);
            throw error;
        }
    }

    /**
     * Pausa uma campanha em execução
     */
    async pauseCampaign(id) {
        const db = getDatabase();
        if (!db) return false;

        this.pausedCampaigns.add(id);
        this.runningCampaigns.delete(id);

        await db.query(`
            UPDATE campaigns 
            SET status = 'paused', "waitReason" = NULL, "nextDispatchAt" = NULL, "updatedAt" = $1 
            WHERE id = $2
        `, [new Date().toISOString(), id]);

        const io = this.getIo();
        if (io) {
            io.emit('campaign:status-change', { campaignId: id, status: 'paused', waitReason: null, nextDispatchAt: null });
        }
        return true;
    }

    /**
     * Cancela uma campanha
     */
    async cancelCampaign(id) {
        const db = getDatabase();
        if (!db) return false;

        this.canceledCampaigns.add(id);
        this.runningCampaigns.delete(id);
        this.pausedCampaigns.delete(id);

        await db.query(`
            UPDATE campaigns 
            SET status = 'canceled', "waitReason" = NULL, "nextDispatchAt" = NULL, "updatedAt" = $1 
            WHERE id = $2
        `, [new Date().toISOString(), id]);

        const io = this.getIo();
        if (io) {
            io.emit('campaign:status-change', { campaignId: id, status: 'canceled', waitReason: null, nextDispatchAt: null });
        }
        return true;
    }

    /**
     * Retorna os logs de disparo de uma campanha
     */
    async getCampaignLogs(campaignId) {
        const db = getDatabase();
        if (!db) return [];

        try {
            const res = await db.query(`
                SELECT * FROM campaign_logs 
                WHERE "campaignId" = $1 
                ORDER BY "sentAt" DESC NULLS LAST, id ASC
            `, [campaignId]);
            return res.rows;
        } catch (error) {
            console.error('❌ Erro no getCampaignLogs:', error);
            return [];
        }
    }

    /**
     * Inicia a execução da campanha
     */
    async startCampaign(id) {
        const campaign = await this.getCampaign(id);
        if (!campaign) throw new Error('Campanha não encontrada');

        if (this.runningCampaigns.has(id)) {
            return { message: 'Campanha já está em execução.' };
        }

        this.pausedCampaigns.delete(id);
        this.canceledCampaigns.delete(id);
        this.runningCampaigns.add(id);

        const db = getDatabase();
        await db.query(`
            UPDATE campaigns 
            SET status = 'running', "updatedAt" = $1 
            WHERE id = $2
        `, [new Date().toISOString(), id]);

        const io = this.getIo();
        if (io) {
            io.emit('campaign:status-change', { campaignId: id, status: 'running' });
        }

        // Executar em background
        setImmediate(() => {
            this.runCampaignProcess(id).catch(err => {
                console.error(`❌ Erro no processamento da campanha ${id}:`, err);
                this.runningCampaigns.delete(id);
            });
        });

        return { success: true, message: 'Disparos da campanha iniciados com sucesso.' };
    }

    /**
     * Avalia se o momento atual está dentro da janela de horários e dias permitidos do dia
     */
    getDailyWindowStatus(campaign) {
        if (!campaign.randomTimeEnabled) {
            return { isWithinWindow: true, msUntilNextWindow: 0, reason: null };
        }

        const timezone = 'America/Sao_Paulo';
        const now = new Date();

        const formatter = new Intl.DateTimeFormat('pt-BR', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(now);
        const getPart = type => parts.find(p => p.type === type)?.value;

        const year = getPart('year');
        const month = getPart('month');
        const day = getPart('day');
        const currentHour = parseInt(getPart('hour'), 10);
        const currentMinute = parseInt(getPart('minute'), 10);
        const currentMinutesOfDay = currentHour * 60 + currentMinute;

        // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
        const dayOfWeek = new Date(`${year}-${month}-${day}T12:00:00Z`).getUTCDay();

        let allowedDays = [1, 2, 3, 4, 5, 6];
        try {
            if (campaign.dispatchDays) {
                const parsed = typeof campaign.dispatchDays === 'string'
                    ? JSON.parse(campaign.dispatchDays)
                    : campaign.dispatchDays;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    allowedDays = parsed.map(Number);
                }
            }
        } catch (e) {}

        const startTimeStr = campaign.windowStartTime || '08:30';
        const endTimeStr = campaign.windowEndTime || '18:00';
        const [startH, startM] = startTimeStr.split(':').map(Number);
        const [endH, endM] = endTimeStr.split(':').map(Number);

        const windowStartMinutes = (startH * 60) + (startM || 0);
        const windowEndMinutes = (endH * 60) + (endM || 0);

        const isDayAllowed = allowedDays.includes(dayOfWeek);
        const isHourAllowed = currentMinutesOfDay >= windowStartMinutes && currentMinutesOfDay < windowEndMinutes;

        if (isDayAllowed && isHourAllowed) {
            return { isWithinWindow: true, msUntilNextWindow: 0, reason: null };
        }

        // Calcula minutos de espera até a próxima abertura da janela
        let waitMinutes = 0;
        let isToday = false;

        if (isDayAllowed && currentMinutesOfDay < windowStartMinutes) {
            // Ainda é hoje, antes do início da janela
            waitMinutes = windowStartMinutes - currentMinutesOfDay;
            isToday = true;
        } else {
            // Passou do horário de hoje ou hoje não é dia permitido -> calcular próximo dia válido
            let daysAhead = 1;
            while (!allowedDays.includes((dayOfWeek + daysAhead) % 7) && daysAhead < 7) {
                daysAhead++;
            }
            const minutesToMidnight = (24 * 60) - currentMinutesOfDay;
            waitMinutes = minutesToMidnight + ((daysAhead - 1) * 24 * 60) + windowStartMinutes;
        }

        // Variação randômica humana de 1 a 4 minutos para evitar disparos no exato segundo zero
        const randomJitterMinutes = Math.floor(Math.random() * 4) + 1;
        const totalWaitMs = (waitMinutes + randomJitterMinutes) * 60 * 1000;

        const targetTime = new Date(Date.now() + totalWaitMs);
        const targetTimeStr = targetTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        let reason = '';
        if (isToday) {
            reason = `🕒 Aguardando início da janela de disparo (${startTimeStr} às ${endTimeStr}). Próximo envio hoje às ${targetTimeStr}`;
        } else if (!isDayAllowed) {
            reason = `📅 Dia não permitido para envios. Próximo envio em ${targetTime.toLocaleDateString('pt-BR')} às ${targetTimeStr}`;
        } else {
            reason = `🌙 Fora do horário de disparo (${startTimeStr} às ${endTimeStr}). Próximo envio amanhã às ${targetTimeStr}`;
        }

        return {
            isWithinWindow: false,
            msUntilNextWindow: totalWaitMs,
            reason,
            targetTimeStr
        };
    }

    /**
     * Espera assíncrona inteligente com checagem frequente de cancelamento e atualização via Socket.IO
     */
    async waitWithCancellation(campaignId, targetMs, reason = '') {
        const startTime = Date.now();
        const nextDispatchAt = new Date(startTime + targetMs).toISOString();

        const db = getDatabase();
        if (db) {
            db.query(`
                UPDATE campaigns 
                SET "waitReason" = $1, "nextDispatchAt" = $2, "updatedAt" = $3 
                WHERE id = $4
            `, [reason, nextDispatchAt, new Date().toISOString(), campaignId]).catch(() => {});
        }

        const io = this.getIo();
        if (io) {
            io.emit('campaign:progress', {
                campaignId,
                waitReason: reason,
                nextDispatchAt,
                status: 'running'
            });
        }

        while (Date.now() - startTime < targetMs) {
            if (this.pausedCampaigns.has(campaignId) || this.canceledCampaigns.has(campaignId)) {
                return false;
            }
            // Slices curtos de 2 segundos para resposta instantânea ao usuário
            const remaining = targetMs - (Date.now() - startTime);
            const slice = Math.min(2000, remaining);
            await new Promise(r => setTimeout(r, slice));
        }

        // Limpa razão de espera após concluir o tempo
        if (db) {
            db.query(`
                UPDATE campaigns 
                SET "waitReason" = NULL, "nextDispatchAt" = NULL, "updatedAt" = $1 
                WHERE id = $2
            `, [new Date().toISOString(), campaignId]).catch(() => {});
        }

        return true;
    }

    /**
     * Popula a lista de destinatários nos logs da campanha
     */
    async populateCampaignRecipients(campaign) {
        const db = getDatabase();
        if (!db) return [];

        const existingLogs = await db.query(
            'SELECT COUNT(*) FROM campaign_logs WHERE "campaignId" = $1',
            [campaign.id]
        );

        if (parseInt(existingLogs.rows[0].count, 10) > 0) {
            const remaining = await db.query(
                'SELECT * FROM campaign_logs WHERE "campaignId" = $1 AND status = \'pending\' ORDER BY id ASC',
                [campaign.id]
            );
            return remaining.rows;
        }

        const recipients = [];
        const addRecipient = (name, rawPhone) => {
            const { cleanNumber, isValid } = sanitizePhoneNumber(rawPhone);
            if (isValid && cleanNumber) {
                recipients.push({ name: name || 'Cliente', phoneNumber: cleanNumber });
            }
        };

        if (campaign.targetType === 'all') {
            const res = await db.query(`
                SELECT DISTINCT name, "phoneNumber" 
                FROM contacts 
                WHERE "botId" = $1 
                  AND jid NOT LIKE '%@newsletter%' 
                  AND jid NOT LIKE '%@broadcast%' 
                  AND jid NOT LIKE '%@g.us%'
            `, [campaign.botId]);
            for (const r of res.rows) {
                if (r.phoneNumber) {
                    addRecipient(r.name, r.phoneNumber);
                }
            }
        } else if (campaign.targetType === 'tag') {
            let tags = [];
            try {
                tags = typeof campaign.targetTags === 'string' ? JSON.parse(campaign.targetTags) : campaign.targetTags;
            } catch (e) {}

            const res = await db.query(`
                SELECT DISTINCT "contactName" as name, "contactJid", tags 
                FROM chats 
                WHERE "botId" = $1 
                  AND "contactJid" NOT LIKE '%@newsletter%' 
                  AND "contactJid" NOT LIKE '%@broadcast%' 
                  AND "contactJid" NOT LIKE '%@g.us%'
            `, [campaign.botId]);

            for (const r of res.rows) {
                let chatTags = [];
                try {
                    chatTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags;
                } catch (e) {}

                const hasMatch = tags.some(t => chatTags.includes(t));
                if (hasMatch) {
                    const cleanPhone = (r.contactJid || '').split('@')[0].replace(/\D/g, '');
                    if (cleanPhone) {
                        addRecipient(r.name, cleanPhone);
                    }
                }
            }
        } else if (campaign.targetType === 'manual') {
            let rawNumbers = [];
            try {
                rawNumbers = typeof campaign.manualNumbers === 'string' ? JSON.parse(campaign.manualNumbers) : campaign.manualNumbers;
            } catch (e) {}

            for (const item of rawNumbers) {
                if (typeof item === 'string') {
                    const parts = item.split(',');
                    if (parts.length > 1) {
                        const name = parts[0].trim();
                        addRecipient(name, parts[1]);
                    } else {
                        addRecipient('Cliente', item);
                    }
                } else if (item && item.phoneNumber) {
                    addRecipient(item.name || 'Cliente', item.phoneNumber);
                }
            }
        }

        // Remove duplicatas
        const uniqueRecipients = [];
        const seen = new Set();
        for (const item of recipients) {
            if (!seen.has(item.phoneNumber)) {
                seen.add(item.phoneNumber);
                uniqueRecipients.push(item);
            }
        }

        // Salvar logs no banco
        for (const r of uniqueRecipients) {
            const logId = `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
            await db.query(`
                INSERT INTO campaign_logs (id, "campaignId", "phoneNumber", "contactName", status)
                VALUES ($1, $2, $3, $4, 'pending')
            `, [logId, campaign.id, r.phoneNumber, r.name]);
        }

        // Atualizar totalCount
        await db.query(`
            UPDATE campaigns 
            SET "totalCount" = $1 
            WHERE id = $2
        `, [uniqueRecipients.length, campaign.id]);

        const logs = await db.query(
            'SELECT * FROM campaign_logs WHERE "campaignId" = $1 AND status = \'pending\' ORDER BY id ASC',
            [campaign.id]
        );
        return logs.rows;
    }

    /**
     * Processamento em fila com intervalo anti-ban, janelas de horário e pausas humanas por lote
     */
    async runCampaignProcess(campaignId) {
        const db = getDatabase();
        if (!db) return;

        const campaign = await this.getCampaign(campaignId);
        if (!campaign) return;

        console.log(`📢 [CampaignService] Iniciando processamento da campanha "${campaign.name}" (${campaignId})...`);

        // Obter conexão do bot
        const botInstance = await BotManagerService.getBotInstance(campaign.botId);
        if (!botInstance || !botInstance.isConnected) {
            console.error(`❌ [CampaignService] Bot ${campaign.botId} não está conectado ao WhatsApp. Pausando campanha.`);
            await this.pauseCampaign(campaignId);
            return;
        }

        // Carrega destinatários pendentes
        const pendingLogs = await this.populateCampaignRecipients(campaign);
        console.log(`📋 [CampaignService] Destinatários pendentes a enviar: ${pendingLogs.length}`);

        const delayMin = Math.max(campaign.delayMin || 30, 5);
        const delayMax = Math.max(campaign.delayMax || 75, delayMin);

        // Parâmetros de lotes inteligentes
        const batchMin = Math.max(campaign.batchMin || 5, 2);
        const batchMax = Math.max(campaign.batchMax || 12, batchMin);
        const batchPauseMin = Math.max(campaign.batchPauseMin || 5, 1);
        const batchPauseMax = Math.max(campaign.batchPauseMax || 15, batchPauseMin);

        let batchCounter = 0;
        let currentBatchTarget = Math.floor(Math.random() * (batchMax - batchMin + 1)) + batchMin;

        let sentCount = campaign.sentCount || 0;
        let failedCount = campaign.failedCount || 0;
        const totalCount = campaign.totalCount || pendingLogs.length;

        for (let i = 0; i < pendingLogs.length; i++) {
            // Checar se foi pausada ou cancelada
            if (this.pausedCampaigns.has(campaignId)) {
                console.log(`⏸️ [CampaignService] Campanha ${campaignId} pausada pelo usuário.`);
                this.runningCampaigns.delete(campaignId);
                return;
            }

            if (this.canceledCampaigns.has(campaignId)) {
                console.log(`🛑 [CampaignService] Campanha ${campaignId} cancelada pelo usuário.`);
                this.runningCampaigns.delete(campaignId);
                return;
            }

            // 1. CHECAGEM DA JANELA DIÁRIA DE HORÁRIO ATIVO (Anti-Ban)
            const windowStatus = this.getDailyWindowStatus(campaign);
            if (!windowStatus.isWithinWindow) {
                console.log(`⏸️ [Anti-Ban Janela] ${windowStatus.reason}`);
                const proceed = await this.waitWithCancellation(
                    campaignId,
                    windowStatus.msUntilNextWindow,
                    windowStatus.reason
                );
                if (!proceed) return;

                // Re-obter instância do bot caso tenha reconectado durante a longa espera
                const freshBot = await BotManagerService.getBotInstance(campaign.botId);
                if (!freshBot || !freshBot.isConnected) {
                    console.error(`❌ [CampaignService] Bot ${campaign.botId} desconectado após a janela. Pausando.`);
                    await this.pauseCampaign(campaignId);
                    return;
                }
            }

            const item = pendingLogs[i];
            const cleanPhone = item.phoneNumber.replace(/\D/g, '');
            const jid = `${cleanPhone}@s.whatsapp.net`;

            try {
                // Resolver Spintax
                let text = this.parseSpintax(campaign.messageTemplate);

                // Interpolar variáveis
                text = this.interpolateVariables(text, {
                    name: item.contactName,
                    phoneNumber: cleanPhone
                });

                // Anexar mídia se configurada
                let messageToSend = text;
                if (campaign.mediaUrl) {
                    if (campaign.mediaType === 'audio_ptt') {
                        messageToSend = `[AudioUrl:${campaign.mediaUrl}]`;
                    } else if (campaign.mediaType === 'document') {
                        messageToSend = `[DocumentUrl:${campaign.mediaUrl}|filename:${campaign.name}.pdf]\n${text}`;
                    } else if (campaign.mediaType === 'image') {
                        messageToSend = `[ImageUrl:${campaign.mediaUrl}]\n${text}`;
                    }
                }

                // Enviar mensagem pelo WhatsApp
                await botInstance.sendMessage(jid, messageToSend);
                sentCount++;
                batchCounter++;

                // Atualizar log como enviado
                await db.query(`
                    UPDATE campaign_logs 
                    SET status = 'sent', "sentAt" = $1 
                    WHERE id = $2
                `, [new Date().toISOString(), item.id]);

                console.log(`✅ [Campaign] (${sentCount}/${totalCount}) Enviado para ${cleanPhone} (${item.contactName || 'Cliente'}) - Lote: ${batchCounter}/${currentBatchTarget}`);

            } catch (sendError) {
                failedCount++;
                console.error(`❌ [Campaign] Erro ao enviar para ${cleanPhone}:`, sendError.message);

                await db.query(`
                    UPDATE campaign_logs 
                    SET status = 'failed', "errorMessage" = $1, "sentAt" = $2 
                    WHERE id = $3
                `, [sendError.message || 'Falha no envio', new Date().toISOString(), item.id]);
            }

            // Atualiza contadores na tabela da campanha
            await db.query(`
                UPDATE campaigns 
                SET "sentCount" = $1, "failedCount" = $2, "updatedAt" = $3 
                WHERE id = $4
            `, [sentCount, failedCount, new Date().toISOString(), campaignId]);

            // Emite progresso em tempo real via Socket.IO
            const io = this.getIo();
            if (io) {
                io.emit('campaign:progress', {
                    campaignId,
                    sentCount,
                    failedCount,
                    totalCount,
                    lastPhone: cleanPhone,
                    status: 'running'
                });
            }

            // Se for o último item, encerra o loop
            if (i >= pendingLogs.length - 1) break;

            // 2. CHECAGEM DE PAUSA HUMANA ALEATÓRIA ENTRE LOTES (Anti-Ban)
            if (campaign.randomTimeEnabled && batchCounter >= currentBatchTarget) {
                const randomPauseMin = Math.floor(Math.random() * (batchPauseMax - batchPauseMin + 1)) + batchPauseMin;
                const pauseMs = randomPauseMin * 60 * 1000;
                const resumeDate = new Date(Date.now() + pauseMs);
                const resumeTimeStr = resumeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                console.log(`☕ [Anti-Ban Lote] Lote de ${batchCounter} envios concluído. Pausa humana aleatória de ${randomPauseMin} minutos até às ${resumeTimeStr}...`);

                const proceed = await this.waitWithCancellation(
                    campaignId,
                    pauseMs,
                    `☕ Pausa humana anti-bloqueio (${randomPauseMin} min). Próximo lote às ${resumeTimeStr}`
                );

                if (!proceed) return;

                // Reinicia contador de lote e sorteia novo tamanho de lote
                batchCounter = 0;
                currentBatchTarget = Math.floor(Math.random() * (batchMax - batchMin + 1)) + batchMin;
            } else {
                // 3. INTERVALO INDIVIDUAL ALEATÓRIO ENTRE MENSAGENS
                let randomSecs;
                if (campaign.distributionMode === 'random_day') {
                    // Modo horário aleatório ao longo do dia: variação mais dinâmica
                    const minS = Math.max(delayMin, 20);
                    const maxS = Math.max(delayMax, minS + 10);
                    randomSecs = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
                } else {
                    randomSecs = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                }

                console.log(`⏳ [Anti-Ban] Intervalo de ${randomSecs}s antes do próximo envio...`);
                const proceed = await this.waitWithCancellation(
                    campaignId,
                    randomSecs * 1000,
                    `⏳ Intervalo anti-ban: aguardando ${randomSecs}s`
                );

                if (!proceed) return;
            }
        }

        // Finalizada com sucesso!
        this.runningCampaigns.delete(campaignId);
        await db.query(`
            UPDATE campaigns 
            SET status = 'completed', "waitReason" = NULL, "nextDispatchAt" = NULL, "completedAt" = $1, "updatedAt" = $1 
            WHERE id = $2
        `, [new Date().toISOString(), campaignId]);

        console.log(`🎉 [CampaignService] Campanha ${campaignId} concluída com sucesso! Total enviados: ${sentCount}, Falhas: ${failedCount}`);

        const io = this.getIo();
        if (io) {
            io.emit('campaign:status-change', { 
                campaignId, 
                status: 'completed', 
                waitReason: null, 
                nextDispatchAt: null 
            });
        }
    }

    /**
     * Checa campanhas com data e hora agendadas
     */
    async checkScheduledCampaigns() {
        const db = getDatabase();
        if (!db) return;

        try {
            const now = new Date().toISOString();
            const res = await db.query(`
                SELECT id, name FROM campaigns 
                WHERE status = 'scheduled' 
                  AND "scheduledAt" IS NOT NULL 
                  AND "scheduledAt" <= $1
            `, [now]);

            for (const c of res.rows) {
                console.log(`⏰ [CampaignService] Iniciando campanha agendada "${c.name}" (${c.id})...`);
                await this.startCampaign(c.id);
            }
        } catch (e) {
            console.error('❌ Erro no checkScheduledCampaigns:', e.message);
        }
    }

    /**
     * Retoma campanhas que foram interrompidas por reinício do servidor
     */
    async resumeInterruptedCampaigns() {
        const db = getDatabase();
        if (!db) return;

        try {
            const res = await db.query(`
                SELECT id, name FROM campaigns 
                WHERE status = 'running'
            `);

            for (const c of res.rows) {
                if (!this.runningCampaigns.has(c.id)) {
                    console.log(`🔄 [CampaignService] Retomando campanha em execução pós-reinício: "${c.name}" (${c.id})...`);
                    this.startCampaign(c.id).catch(err => {
                        console.error(`Erro ao retomar campanha ${c.id}:`, err);
                    });
                }
            }
        } catch (e) {
            console.error('❌ Erro no resumeInterruptedCampaigns:', e.message);
        }
    }
}

module.exports = new CampaignService();
