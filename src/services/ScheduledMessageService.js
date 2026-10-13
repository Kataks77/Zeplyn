const { getDatabase } = require('./DatabaseService');
const BotManagerService = require('./BotManagerService');

class ScheduledMessageService {
    constructor() {
        // Verifica mensagens agendadas a cada 15 segundos
        setInterval(() => this.processPendingMessages(), 15 * 1000);
    }

    getIo() {
        return BotManagerService.io;
    }

    async scheduleMessage({ botId, contactJid, userId, message, scheduledAt, cancelIfCustomerReplies = true }) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        if (!botId || !contactJid || !message || !scheduledAt) {
            throw new Error('botId, contactJid, message e scheduledAt são obrigatórios');
        }

        const id = `sched_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();

        const res = await db.query(`
            INSERT INTO scheduled_messages (
                id, "botId", "contactJid", "userId", message, 
                "scheduledAt", "cancelIfCustomerReplies", status, 
                "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
            RETURNING *
        `, [id, botId, contactJid, userId || null, message.trim(), new Date(scheduledAt).toISOString(), cancelIfCustomerReplies, now]);

        await this.emitScoped(botId, 'scheduled-message:created', res.rows[0]);

        return res.rows[0];
    }

    async emitScoped(botId, event, data) {
        const io = this.getIo();
        if (!io) return;
        let companyId = 'company_default';
        try {
            const BotService = require('./BotService');
            const bot = await BotService.getBot(botId);
            if (bot?.companyId) companyId = bot.companyId;
        } catch (_) {}
        io.to(`company_${companyId}`).emit(event, data);
        io.to('company_superadmin').emit(event, data);
    }

    async getScheduledMessages(botId, contactJid) {
        const db = getDatabase();
        if (!db) return [];

        try {
            const res = await db.query(`
                SELECT sm.*, u.name as "userName" 
                FROM scheduled_messages sm
                LEFT JOIN users u ON sm."userId" = u.id
                WHERE sm."botId" = $1 AND sm."contactJid" = $2 AND sm.status = 'pending'
                ORDER BY sm."scheduledAt" ASC
            `, [botId, contactJid]);
            return res.rows;
        } catch (error) {
            console.error('❌ Erro no ScheduledMessageService.getScheduledMessages:', error);
            return [];
        }
    }

    async cancelScheduledMessage(id) {
        const db = getDatabase();
        if (!db) return false;

        try {
            const res = await db.query(`
                UPDATE scheduled_messages 
                SET status = 'canceled', "sentAt" = $1 
                WHERE id = $2 AND status = 'pending' 
                RETURNING *
            `, [new Date().toISOString(), id]);

            if (res.rows.length > 0) {
                const item = res.rows[0];
                await this.emitScoped(item.botId, 'scheduled-message:canceled', item);
                await this.emitScoped(item.botId, 'scheduled-message:cancelled', item);
            }
            return true;
        } catch (error) {
            console.error('❌ Erro no ScheduledMessageService.cancelScheduledMessage:', error);
            throw error;
        }
    }

    async processPendingMessages() {
        const db = getDatabase();
        if (!db) return;

        try {
            const now = new Date().toISOString();
            const res = await db.query(`
                SELECT sm.*, u.name as "userName" 
                FROM scheduled_messages sm
                LEFT JOIN users u ON sm."userId" = u.id
                WHERE sm.status = 'pending' AND sm."scheduledAt" <= $1
            `, [now]);

            for (const item of res.rows) {
                try {
                    // Se estiver configurado para cancelar caso o cliente tenha respondido antes
                    if (item.cancelIfCustomerReplies) {
                        const ContactService = require('./ContactService');
                        const { getContactJidVariants } = require('../utils/helpers');

                        let extraLids = [];
                        if (item.contactJid.endsWith('@lid')) {
                            const resolved = await ContactService.getJidByLid(item.contactJid);
                            if (resolved) extraLids.push(item.contactJid);
                        } else if (item.contactJid.endsWith('@s.whatsapp.net')) {
                            const resolvedLid = await ContactService.getLidByJid(item.contactJid);
                            if (resolvedLid) extraLids.push(resolvedLid);
                        }
                        const { jidList } = getContactJidVariants(item.contactJid, extraLids);

                        const replyCheck = await db.query(`
                            SELECT id FROM messages 
                            WHERE botid = $1 AND userid = ANY($2) AND role = 'user' AND timestamp > $3
                            LIMIT 1
                        `, [item.botId, jidList, item.createdAt]);

                        if (replyCheck.rows.length > 0) {
                            console.log(`ℹ️ [ScheduledMessage] Mensagem ${item.id} cancelada automaticamente pois o cliente respondeu antes.`);
                            await db.query(`
                                UPDATE scheduled_messages 
                                SET status = 'canceled', "sentAt" = $1 
                                WHERE id = $2
                            `, [new Date().toISOString(), item.id]);

                            await this.emitScoped(item.botId, 'scheduled-message:canceled', item);
                            await this.emitScoped(item.botId, 'scheduled-message:cancelled', item);
                            continue;
                        }
                    }

                    // Enviar mensagem
                    const botInstance = await BotManagerService.getBotInstance(item.botId);
                    if (botInstance && botInstance.isConnected) {
                        const senderName = item.userName || null;
                        await botInstance.sendMessage(item.contactJid, item.message, null, senderName);

                        await db.query(`
                            UPDATE scheduled_messages 
                            SET status = 'sent', "sentAt" = $1 
                            WHERE id = $2
                        `, [new Date().toISOString(), item.id]);

                        console.log(`⏰ [ScheduledMessage] Mensagem agendada enviada com sucesso para ${item.contactJid}!`);

                        await this.emitScoped(item.botId, 'scheduled-message:sent', item);
                    } else {
                        console.warn(`⚠️ [ScheduledMessage] Bot ${item.botId} não conectado. Tentará novamente no próximo ciclo.`);
                    }
                } catch (err) {
                    console.error(`❌ [ScheduledMessage] Erro ao enviar mensagem ${item.id}:`, err);
                }
            }
        } catch (e) {
            console.error('❌ Erro no processPendingMessages:', e.message);
        }
    }
}

module.exports = new ScheduledMessageService();
