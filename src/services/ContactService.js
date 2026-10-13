const { getDatabase } = require('./DatabaseService');
const { isIgnoredJid, isValidContactName } = require('../utils/helpers');

class ContactService {
    constructor() {
        this.isBackgroundSyncRunning = false;
        // Inicia rotina em background silenciosa após boot do sistema
        setTimeout(() => {
            this.startBackgroundPhotoWorker();
        }, 12000);
    }

    startBackgroundPhotoWorker() {
        // Roda a cada 30 segundos verificando lotes de contatos sem fotos
        setInterval(() => {
            this.processBackgroundPhotoSync().catch(() => {});
        }, 30 * 1000);
    }

    async processBackgroundPhotoSync() {
        if (this.isBackgroundSyncRunning) return;
        this.isBackgroundSyncRunning = true;
        try {
            const db = getDatabase();
            if (!db) return;

            const BotManagerService = require('./BotManagerService');
            if (!BotManagerService.activeBots || BotManagerService.activeBots.size === 0) return;

            // Busca lote de contatos sem foto, priorizando os que não foram verificados recentemente
            const query = `
                SELECT c.id, c."botId", c.jid, c."phoneNumber", c.name 
                FROM contacts c
                WHERE (c."profilePicUrl" IS NULL OR c."profilePicUrl" = '')
                  AND c.jid NOT LIKE '%@newsletter'
                  AND c.jid NOT LIKE '%@broadcast'
                  AND c.jid NOT LIKE '%@g.us%'
                ORDER BY c."updatedAt" ASC NULLS FIRST
                LIMIT 20
            `;
            const res = await db.query(query).catch(() => null);
            if (!res || !res.rows || res.rows.length === 0) return;

            let updatedCount = 0;
            const now = new Date().toISOString();

            for (const contact of res.rows) {
                let botInstance = BotManagerService.activeBots.get(contact.botId);
                if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
                    botInstance = BotManagerService.getConnectedBotInstance(contact.botId);
                }
                if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
                    for (const [, inst] of BotManagerService.activeBots) {
                        if (inst.isConnected && inst.sock) {
                            botInstance = inst;
                            break;
                        }
                    }
                }

                if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
                    // Sem bots online no momento
                    break;
                }

                const cleanPhone = (contact.phoneNumber || contact.jid?.split('@')[0] || '').replace(/\D/g, '');
                if (!cleanPhone) {
                    await db.query(`UPDATE contacts SET "updatedAt" = $1 WHERE id = $2`, [now, contact.id]).catch(() => {});
                    continue;
                }

                const targetJid = contact.jid && !contact.jid.includes('@lid') ? contact.jid : `${cleanPhone}@s.whatsapp.net`;

                try {
                    const picUrl = await botInstance.sock.profilePictureUrl(targetJid, 'image').catch(() => null);
                    if (picUrl) {
                        await db.query(`
                            UPDATE contacts 
                            SET "profilePicUrl" = $1, "updatedAt" = $2
                            WHERE id = $3
                        `, [picUrl, now, contact.id]);

                        await db.query(`
                            UPDATE chats 
                            SET "profilePicUrl" = $1, "updatedAt" = $2
                            WHERE "botId" = $3 AND ("contactJid" = $4 OR "contactJid" LIKE $5)
                        `, [picUrl, now, contact.botId, targetJid, `${cleanPhone}%`]).catch(() => {});

                        updatedCount++;
                    } else {
                        // Não possui foto pública: avança fila atualizando updatedAt
                        await db.query(`UPDATE contacts SET "updatedAt" = $1 WHERE id = $2`, [now, contact.id]).catch(() => {});
                    }
                } catch (_) {
                    await db.query(`UPDATE contacts SET "updatedAt" = $1 WHERE id = $2`, [now, contact.id]).catch(() => {});
                }

                await new Promise(r => setTimeout(r, 120)); // Delay seguro anti rate-limit
            }

            if (updatedCount > 0) {
                const io = this.getIo();
                if (io) {
                    io.emit('contacts-updated', {});
                }
            }
        } catch (_) {
        } finally {
            this.isBackgroundSyncRunning = false;
        }
    }

    getIo() {
        try {
            const BotManagerService = require('./BotManagerService');
            return BotManagerService.io;
        } catch (e) {
            console.error('Erro ao obter Socket.io no ContactService:', e);
            return null;
        }
    }

    async saveContact(botId, jid, name, profilePicUrl = null, channel = null) {
        if (!jid || isIgnoredJid(jid, true)) return null;
        const cleanPhone = jid.split('@')[0].replace(/\D/g, '') || jid.split('@')[0];
        return this.createOrUpdateContact(botId, name, cleanPhone, jid, profilePicUrl);
    }

    async createOrUpdateContact(botId, name, phoneNumber, jid, profilePicUrl = null, isFromAgenda = false) {
        if (!jid || isIgnoredJid(jid, true)) return null;
        const db = getDatabase();
        if (!db) return null;

        try {
            const isOmni = jid && (jid.endsWith('@instagram') || jid.endsWith('@telegram'));
            const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : (jid ? jid.split('@')[0].replace(/\D/g, '') : '');
            const cleanJid = jid || `${cleanPhone}@s.whatsapp.net`;
            const passedHasValidName = isValidContactName(name);
            const defaultPlaceholder = isOmni
                ? (cleanJid.endsWith('@instagram') ? `Instagram @${cleanPhone.slice(-6)}` : `Telegram @${cleanPhone.slice(-6)}`)
                : `Contato ${cleanPhone}`;
            let cleanName = passedHasValidName ? name.trim() : defaultPlaceholder;
            const now = new Date().toISOString();
            const contactId = `contact_${botId}_${cleanJid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

            // Verifica se o contato já existe
            const res = await db.query(
                'SELECT * FROM contacts WHERE "botId" = $1 AND (jid = $2 OR ("phoneNumber" = $3 AND jid NOT LIKE \'%@instagram\' AND jid NOT LIKE \'%@telegram\'))',
                [botId, cleanJid, cleanPhone]
            );

            let contactData = null;
            if (res.rows.length > 0) {
                const existing = res.rows[0];
                const existingHasValidName = isValidContactName(existing.name);

                // Se o contato no banco já possui um nome bom e válido:
                // - Se o novo nome não for válido, mantém o existente no banco.
                // - Se o novo nome for apenas pushName (isFromAgenda === false), PRESERVA o nome existente da agenda/CRM!
                // - Só substitui se o novo nome vier da agenda (isFromAgenda === true) ou se o banco estava sem nome válido.
                if (existingHasValidName && (!passedHasValidName || !isFromAgenda)) {
                    cleanName = existing.name;
                } else if (passedHasValidName) {
                    cleanName = name.trim();
                } else {
                    cleanName = existing.name || defaultPlaceholder;
                }

                let updateQuery = `
                    UPDATE contacts 
                    SET name = $1, jid = $2, "updatedAt" = $3
                `;
                const queryParams = [cleanName, cleanJid, now, existing.id];
                let paramIndex = 5;
                if (profilePicUrl) {
                    updateQuery += `, "profilePicUrl" = $${paramIndex}`;
                    queryParams.push(profilePicUrl);
                    paramIndex++;
                }
                updateQuery += ` WHERE id = $4 RETURNING *`;
                
                const updateRes = await db.query(updateQuery, queryParams);
                contactData = updateRes.rows[0];
            } else {
                const insertRes = await db.query(`
                    INSERT INTO contacts (id, "botId", name, "phoneNumber", jid, "profilePicUrl", "createdAt", "updatedAt")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *
                `, [contactId, botId, cleanName, cleanPhone, cleanJid, profilePicUrl, now, now]);
                contactData = insertRes.rows[0];
            }

            // Atualiza o nome e foto correspondente na tabela chats se o chat existir, e notifica o painel
            let alternateJid = null;
            if (cleanJid.endsWith('@lid')) {
                alternateJid = await this.getJidByLid(cleanJid);
            } else if (cleanJid.endsWith('@s.whatsapp.net')) {
                alternateJid = await this.getLidByJid(cleanJid);
            }
            const jidList = [cleanJid];
            if (alternateJid && !jidList.includes(alternateJid)) jidList.push(alternateJid);

            const isNameValid = isValidContactName(cleanName);
            let chatUpdateQuery = `
                UPDATE chats
                SET "contactName" = ${isNameValid ? '$1' : `CASE WHEN "contactName" IS NULL OR "contactName" = '' OR "contactName" LIKE 'Contato %' OR "contactName" LIKE 'Cliente %' THEN $1 ELSE "contactName" END`},
                    "updatedAt" = $2
            `;
            const chatParams = [cleanName, now, botId, jidList];
            let chatParamIndex = 5;
            if (profilePicUrl) {
                chatUpdateQuery += `, "profilePicUrl" = COALESCE($${chatParamIndex}, "profilePicUrl")`;
                chatParams.push(profilePicUrl);
                chatParamIndex++;
            }
            chatUpdateQuery += ` WHERE "botId" = $3 AND "contactJid" = ANY($4) RETURNING *`;

            const chatUpdateRes = await db.query(chatUpdateQuery, chatParams);

            if (chatUpdateRes.rows.length > 0) {
                const io = this.getIo();
                if (io) {
                    for (const row of chatUpdateRes.rows) {
                        io.emit('chat-updated', row);
                    }
                }
            }

            return contactData;
        } catch (error) {
            console.error('❌ Erro no ContactService.createOrUpdateContact:', error);
            return null;
        }
    }

    async listContacts(botId = null, companyId = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            let sql = `
                SELECT c.* 
                FROM contacts c
                INNER JOIN bots b ON c."botId" = b.id
            `;
            const conditions = [
                `c.jid NOT LIKE '%@newsletter'`,
                `c.jid NOT LIKE '%@broadcast'`,
                `c.jid NOT LIKE '%@g.us%'`
            ];
            const params = [];
            let count = 1;

            if (botId && botId !== 'all') {
                conditions.push(`c."botId" = $${count++}`);
                params.push(botId);
            }
            if (companyId) {
                conditions.push(`b."companyId" = $${count++}`);
                params.push(companyId);
            }

            if (conditions.length > 0) {
                sql += ` WHERE ` + conditions.join(' AND ');
            }
            sql += ` ORDER BY c.name ASC`;

            const res = await db.query(sql, params);
            return res.rows;
        } catch (error) {
            console.error('❌ Erro ao listar contatos:', error);
            return [];
        }
    }

    async deleteContact(botId, contactId) {
        const db = getDatabase();
        if (!db) return false;

        try {
            await db.query(
                'DELETE FROM contacts WHERE "botId" = $1 AND id = $2',
                [botId, contactId]
            );
            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar contato:', error);
            return false;
        }
    }

    /**
     * Desvincula / remove todos os contatos do CRM associados a um bot (ao desativar/desconectar conexão)
     */
    async deleteContactsByBotId(botId) {
        if (!botId) return false;
        const db = getDatabase();
        if (!db) return false;

        try {
            const res = await db.query(
                'DELETE FROM contacts WHERE "botId" = $1',
                [botId]
            );
            console.log(`🧹 [ContactService] ${res.rowCount || 0} contatos CRM desvinculados/removidos do bot ${botId}`);

            const io = this.getIo();
            if (io) {
                io.emit('contacts-cleared', { botId });
                io.emit('contacts-updated', { botId });
            }
            return true;
        } catch (error) {
            console.error('❌ Erro no ContactService.deleteContactsByBotId:', error);
            return false;
        }
    }

    async syncFromChats(botId) {
        const db = getDatabase();
        if (!db) return 0;

        try {
            // Pega os chats existentes desse bot
            const chatsRes = await db.query(
                'SELECT * FROM chats WHERE "botId" = $1',
                [botId]
            );

            let importedCount = 0;
            const BotManagerService = require('./BotManagerService');
            const botInstance = BotManagerService.activeBots.get(botId);
            const sock = botInstance && botInstance.isConnected ? botInstance.sock : null;

            for (const chat of chatsRes.rows) {
                const jid = chat.contactJid;
                if (!jid || jid.includes('@g.us') || jid.endsWith('@broadcast')) continue;
                const phoneNumber = jid.split('@')[0];
                const name = chat.contactName || `Contato ${phoneNumber}`;
                
                let profilePicUrl = chat.profilePicUrl || null;
                // Removida a busca massiva de fotos de perfil para evitar timeout/ban
                
                const contact = await this.createOrUpdateContact(botId, name, phoneNumber, jid, profilePicUrl);
                if (contact) importedCount++;
            }
            return importedCount;
        } catch (error) {
            console.error('❌ Erro no ContactService.syncFromChats:', error);
            return 0;
        }
    }

    async saveLidMapping(lid, jid) {
        const db = getDatabase();
        if (!db || !lid || !jid) return;
        try {
            await db.query(`
                INSERT INTO lid_mappings (lid, jid)
                VALUES ($1, $2)
                ON CONFLICT (lid) DO UPDATE SET jid = $2
            `, [lid, jid]);
        } catch (error) {
            console.error('❌ Erro ao salvar lid mapping:', error);
        }
    }

    async getJidByLid(lid) {
        const db = getDatabase();
        if (!db || !lid) return null;
        try {
            const res = await db.query(
                'SELECT jid FROM lid_mappings WHERE lid = $1',
                [lid]
            );
            return res.rows.length > 0 ? res.rows[0].jid : null;
        } catch (error) {
            console.error('❌ Erro ao buscar jid por lid:', error);
            return null;
        }
    }

    async getLidByJid(jid) {
        const db = getDatabase();
        if (!db || !jid) return null;
        try {
            const res = await db.query(
                'SELECT lid FROM lid_mappings WHERE jid = $1',
                [jid]
            );
            return res.rows.length > 0 ? res.rows[0].lid : null;
        } catch (error) {
            console.error('❌ Erro ao buscar lid por jid:', error);
            return null;
        }
    }

    /**
     * Busca e atualiza as fotos de perfil de contatos via WhatsApp Baileys
     */
    async syncProfilePictures(botId = null, limit = 100, companyId = null) {
        const db = getDatabase();
        if (!db) return { success: false, error: 'Banco de dados indisponível' };

        const BotManagerService = require('./BotManagerService');
        let botInstance = null;
        if (botId && botId !== 'all') {
            botInstance = BotManagerService.activeBots.get(botId);
        }
        if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
            botInstance = BotManagerService.getConnectedBotInstance(botId, companyId);
        }
        if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
            for (const [, inst] of BotManagerService.activeBots) {
                if (inst.isConnected && inst.sock) {
                    botInstance = inst;
                    break;
                }
            }
        }

        if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
            return { success: false, error: 'O robô do WhatsApp precisa estar conectado via QR Code para buscar as fotos de perfil.' };
        }

        const sock = botInstance.sock;
        const targetBotId = botInstance.botId;

        let query = `
            SELECT c.id, c."botId", c.jid, c."phoneNumber", c.name 
            FROM contacts c
            INNER JOIN bots b ON c."botId" = b.id
            WHERE (c."profilePicUrl" IS NULL OR c."profilePicUrl" = '')
              AND c.jid NOT LIKE '%@newsletter'
              AND c.jid NOT LIKE '%@broadcast'
              AND c.jid NOT LIKE '%@g.us%'
        `;
        const params = [];
        let pIndex = 1;

        if (botId && botId !== 'all') {
            query += ` AND c."botId" = $${pIndex++}`;
            params.push(botId);
        }
        if (companyId) {
            query += ` AND b."companyId" = $${pIndex++}`;
            params.push(companyId);
        }
        query += ` ORDER BY c.id ASC LIMIT ${Number(limit) || 100}`;

        const contactsRes = await db.query(query, params);
        const contactsToUpdate = contactsRes.rows;

        let updatedCount = 0;
        let checkedCount = 0;

        for (const contact of contactsToUpdate) {
            checkedCount++;
            const cleanPhone = (contact.phoneNumber || contact.jid?.split('@')[0] || '').replace(/\D/g, '');
            if (!cleanPhone) continue;
            const targetJid = contact.jid && !contact.jid.includes('@lid') ? contact.jid : `${cleanPhone}@s.whatsapp.net`;

            try {
                const picUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
                const now = new Date().toISOString();
                if (picUrl) {
                    await db.query(`
                        UPDATE contacts 
                        SET "profilePicUrl" = $1, "updatedAt" = $2
                        WHERE id = $3
                    `, [picUrl, now, contact.id]);

                    await db.query(`
                        UPDATE chats 
                        SET "profilePicUrl" = $1, "updatedAt" = $2
                        WHERE "botId" = $3 AND ("contactJid" = $4 OR "contactJid" LIKE $5)
                    `, [picUrl, now, contact.botId, targetJid, `${cleanPhone}%`]).catch(() => {});

                    updatedCount++;
                } else {
                    await db.query(`UPDATE contacts SET "updatedAt" = $1 WHERE id = $2`, [now, contact.id]).catch(() => {});
                }
            } catch (_) {
                const now = new Date().toISOString();
                await db.query(`UPDATE contacts SET "updatedAt" = $1 WHERE id = $2`, [now, contact.id]).catch(() => {});
            }

            await new Promise(r => setTimeout(r, 80));
        }

        const io = this.getIo();
        if (io && updatedCount > 0) {
            io.emit('contacts-updated', { botId: targetBotId });
        }

        return {
            success: true,
            updatedCount,
            checkedCount,
            totalRemaining: Math.max(0, contactsToUpdate.length - updatedCount)
        };
    }

    /**
     * Atualiza a foto de perfil de um contato individual
     */
    async refreshContactPhoto(contactId, botId = null, companyId = null) {
        const db = getDatabase();
        if (!db || !contactId) return { success: false, error: 'Parâmetro inválido' };

        const res = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
        if (res.rows.length === 0) return { success: false, error: 'Contato não encontrado' };
        const contact = res.rows[0];

        const BotManagerService = require('./BotManagerService');
        const botInstance = BotManagerService.getConnectedBotInstance(botId || contact.botId, companyId);
        if (!botInstance || !botInstance.isConnected || !botInstance.sock) {
            return { success: false, error: 'Robô do WhatsApp desconectado.' };
        }

        const cleanPhone = (contact.phoneNumber || contact.jid?.split('@')[0] || '').replace(/\D/g, '');
        const targetJid = contact.jid && !contact.jid.includes('@lid') ? contact.jid : `${cleanPhone}@s.whatsapp.net`;

        try {
            const picUrl = await botInstance.sock.profilePictureUrl(targetJid, 'image').catch(() => null);
            if (picUrl) {
                const now = new Date().toISOString();
                await db.query(`UPDATE contacts SET "profilePicUrl" = $1, "updatedAt" = $2 WHERE id = $3`, [picUrl, now, contact.id]);
                await db.query(`UPDATE chats SET "profilePicUrl" = $1, "updatedAt" = $2 WHERE "botId" = $3 AND ("contactJid" = $4 OR "contactJid" LIKE $5)`, [picUrl, now, contact.botId, targetJid, `${cleanPhone}%`]).catch(() => {});
                
                const io = this.getIo();
                if (io) io.emit('contacts-updated', { botId: contact.botId });
                return { success: true, profilePicUrl: picUrl };
            }
            return { success: false, error: 'Este contato não possui foto pública no WhatsApp ou a privacidade oculta a imagem.' };
        } catch (e) {
            return { success: false, error: 'Não foi possível obter a foto do perfil: ' + e.message };
        }
    }
}

module.exports = new ContactService();
