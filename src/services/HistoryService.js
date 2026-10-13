const { getDatabase } = require('./DatabaseService');

class HistoryService {
    async saveMessage(botId, userId, role, content, messageId = null, senderName = null, rawMessage = null, channel = 'whatsapp') {
        if (!userId || userId.endsWith('@broadcast') || userId.endsWith('@g.us')) return;
        const db = getDatabase();
        if (!db) return;

        try {
            const idToSave = messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await db.query(`
                INSERT INTO messages (id, botid, userid, role, content, timestamp, "senderName", "rawMessage", channel)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO UPDATE SET "rawMessage" = COALESCE(EXCLUDED."rawMessage", messages."rawMessage")
            `, [idToSave, botId, userId, role, content, new Date().toISOString(), senderName, rawMessage, channel || 'whatsapp']);
        } catch (error) {
            console.error('❌ Erro ao salvar histórico:', error);
        }
    }

    async getHistory(botId, userId, limit = 50, sinceTimestamp = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            const ContactService = require('./ContactService');
            const { getContactJidVariants } = require('../utils/helpers');

            let extraLids = [];
            if (userId.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(userId);
                if (resolved) extraLids.push(userId);
            } else if (userId.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(userId);
                if (resolvedLid) extraLids.push(resolvedLid);
            }

            const { jidList } = getContactJidVariants(userId, extraLids);
            const isInstagramUser = Array.isArray(jidList) && jidList.some(j => j && (j.endsWith('@instagram') || j.endsWith('@telegram')));

            let sql = `
                SELECT id, role AS direction, role, content, reaction, "senderName", timestamp AS "createdAt", timestamp, botid FROM messages 
                WHERE userid = ANY($1) AND (botid = $2 OR channel = 'instagram' OR $3 = TRUE)
            `;
            const params = [jidList, botId, isInstagramUser];

            if (sinceTimestamp) {
                params.push(sinceTimestamp);
                sql += ` AND timestamp >= $${params.length}`;
            }

            params.push(limit);
            sql += ` ORDER BY timestamp DESC LIMIT $${params.length}`;

            const res = await db.query(sql, params);
            const rows = res.rows;
            return rows.reverse(); // Ordem cronológica para o bot
        } catch (error) {
            console.error('❌ Erro ao ler histórico:', error);
            return [];
        }
    }

    async updateReaction(messageId, reaction) {
        const db = getDatabase();
        if (!db) return;

        try {
            await db.query(`
                UPDATE messages SET reaction = $1 WHERE id = $2
            `, [reaction || null, messageId]);
        } catch (error) {
            console.error('❌ Erro ao atualizar reação no banco:', error);
        }
    }
}

module.exports = new HistoryService();

