const { getDatabase } = require('./DatabaseService');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { DIRS } = require('../config');

class StickerService {
    getIo() {
        try {
            const BotManagerService = require('./BotManagerService');
            return BotManagerService.io;
        } catch (e) {
            return null;
        }
    }

    async ensureTable() {
        const db = getDatabase();
        if (!db) return;
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS bot_stickers (
                    id TEXT PRIMARY KEY,
                    "botId" TEXT NOT NULL,
                    url TEXT NOT NULL,
                    name TEXT,
                    "fileHash" TEXT,
                    "createdAt" TEXT NOT NULL,
                    FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                );
                ALTER TABLE bot_stickers ADD COLUMN IF NOT EXISTS "fileHash" TEXT;
                CREATE INDEX IF NOT EXISTS idx_bot_stickers_botId ON bot_stickers("botId");
                CREATE INDEX IF NOT EXISTS idx_bot_stickers_hash ON bot_stickers("fileHash");

                CREATE TABLE IF NOT EXISTS user_stickers (
                    id TEXT PRIMARY KEY,
                    "userId" TEXT NOT NULL,
                    url TEXT NOT NULL,
                    name TEXT,
                    "fileHash" TEXT,
                    "createdAt" TEXT NOT NULL
                );
                ALTER TABLE user_stickers ADD COLUMN IF NOT EXISTS "fileHash" TEXT;
                CREATE INDEX IF NOT EXISTS idx_user_stickers_userId ON user_stickers("userId");
                CREATE INDEX IF NOT EXISTS idx_user_stickers_hash ON user_stickers("fileHash");
            `);

            // Deduplica figurinhas legadas já inseridas no banco
            await this.deduplicateStickers();
        } catch (e) {
            // silent if already exists
        }
    }

    /**
     * Deduplica figurinhas duplicadas no banco para o mesmo robô
     */
    async deduplicateStickers() {
        const db = getDatabase();
        if (!db) return;
        try {
            // 1. Preenche fileHash para figurinhas existentes sem hash
            const unhashed = await db.query('SELECT id, url FROM bot_stickers WHERE "fileHash" IS NULL');
            for (const row of unhashed.rows) {
                const filename = row.url.replace('/uploads/', '');
                const filepath = path.join(DIRS.uploads, filename);
                if (await fs.pathExists(filepath)) {
                    try {
                        const buffer = await fs.readFile(filepath);
                        const hash = crypto.createHash('md5').update(buffer).digest('hex');
                        await db.query('UPDATE bot_stickers SET "fileHash" = $1 WHERE id = $2', [hash, row.id]);
                    } catch (err) {}
                }
            }

            // 2. Remove registros duplicados que compartilham o mesmo hash para o mesmo botId
            const delRes = await db.query(`
                DELETE FROM bot_stickers a USING bot_stickers b
                WHERE a.ctid < b.ctid 
                  AND a."botId" = b."botId" 
                  AND a."fileHash" = b."fileHash" 
                  AND a."fileHash" IS NOT NULL
            `);
            if (delRes.rowCount > 0) {
                console.log(`🧹 [StickerService] ${delRes.rowCount} figurinhas duplicadas foram removidas.`);
            }
        } catch (err) {
            console.warn('⚠️ [StickerService] Erro ao deduplicar figurinhas:', err.message);
        }
    }

    /**
     * Lista as figurinhas vinculadas respeitando estritamente o isolamento da empresa (Tenant)
     */
    async listStickers(botId = null, companyId = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            await this.ensureTable();

            let query = `
                SELECT s.* 
                FROM bot_stickers s
                INNER JOIN bots b ON s."botId" = b.id
            `;
            const conditions = [];
            const params = [];
            let count = 1;

            if (botId && botId !== 'all') {
                conditions.push(`s."botId" = $${count++}`);
                params.push(botId);
            }

            if (companyId) {
                conditions.push(`b."companyId" = $${count++}`);
                params.push(companyId);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY s."createdAt" DESC';

            const res = await db.query(query, params);

            // Garante unicidade de imagem na resposta
            const seen = new Set();
            const uniqueRows = [];
            for (const row of res.rows) {
                const key = row.fileHash || row.url;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueRows.push(row);
                }
            }
            return uniqueRows;
        } catch (error) {
            console.error('❌ [StickerService] Erro ao listar figurinhas do bot:', error);
            return [];
        }
    }

    /**
     * Salva uma figurinha vinculando-a exclusivamente a este bot sem duplicar
     */
    async saveSticker(botId, url, name = null, fileHash = null) {
        if (!botId || !url) return null;
        const db = getDatabase();
        if (!db) return null;

        try {
            await this.ensureTable();

            // Se fileHash não foi fornecido, calcula a partir do arquivo em disco
            let hash = fileHash;
            if (!hash) {
                try {
                    const filename = url.replace('/uploads/', '');
                    const filepath = path.join(DIRS.uploads, filename);
                    if (await fs.pathExists(filepath)) {
                        const buffer = await fs.readFile(filepath);
                        hash = crypto.createHash('md5').update(buffer).digest('hex');
                    }
                } catch (hErr) {}
            }

            // Verifica se a figurinha já está cadastrada para este bot (por hash ou por URL)
            let checkQuery = 'SELECT * FROM bot_stickers WHERE "botId" = $1 AND (url = $2';
            const checkParams = [botId, url];
            if (hash) {
                checkQuery += ' OR "fileHash" = $3';
                checkParams.push(hash);
            }
            checkQuery += ') LIMIT 1';

            const check = await db.query(checkQuery, checkParams);
            if (check.rows.length > 0) {
                // Atualiza o fileHash no banco se ainda estava nulo
                if (hash && !check.rows[0].fileHash) {
                    await db.query('UPDATE bot_stickers SET "fileHash" = $1 WHERE id = $2', [hash, check.rows[0].id]);
                    check.rows[0].fileHash = hash;
                }
                return check.rows[0];
            }

            const id = `stk_${botId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const now = new Date().toISOString();
            const cleanName = name || 'Figurinha WhatsApp';

            const insertRes = await db.query(`
                INSERT INTO bot_stickers (id, "botId", url, name, "fileHash", "createdAt")
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [id, botId, url, cleanName, hash, now]);

            const saved = insertRes.rows[0];

            const io = this.getIo();
            if (io) {
                io.emit('bot-stickers-updated', { botId, sticker: saved });
            }

            console.log(`✨ [StickerService] Figurinha vinculada ao bot ${botId}: ${url} (Hash: ${hash})`);
            return saved;
        } catch (error) {
            console.error('❌ [StickerService] Erro ao salvar figurinha:', error);
            return null;
        }
    }

    /**
     * Remove uma figurinha específica de um bot
     */
    async deleteSticker(botId, stickerId) {
        const db = getDatabase();
        if (!db) return false;

        try {
            await db.query(
                'DELETE FROM bot_stickers WHERE "botId" = $1 AND (id = $2 OR url = $2)',
                [botId, stickerId]
            );
            return true;
        } catch (error) {
            console.error('❌ [StickerService] Erro ao deletar figurinha:', error);
            return false;
        }
    }

    /**
     * Desvincula / remove todas as figurinhas de um bot quando sua conexão é encerrada ou desfeita
     */
    async deleteStickersByBotId(botId) {
        if (!botId) return false;
        const db = getDatabase();
        if (!db) return false;

        try {
            await this.ensureTable();
            const res = await db.query(
                'DELETE FROM bot_stickers WHERE "botId" = $1',
                [botId]
            );
            console.log(`🧹 [StickerService] ${res.rowCount || 0} figurinhas desvinculadas do bot ${botId}`);

            const io = this.getIo();
            if (io) {
                io.emit('bot-stickers-cleared', { botId });
            }
            return true;
        } catch (error) {
            console.error('❌ [StickerService] Erro ao desvincular figurinhas do bot:', error);
            return false;
        }
    }

    /**
     * Lista as figurinhas vinculadas ao usuário. Se o usuário ainda não tiver nenhuma figurinha,
     * busca figurinhas do bot/empresa como fallback inicial para não deixar a lista vazia.
     */
    async listUserStickers(userId, botId = null, companyId = null) {
        if (!userId) return this.listStickers(botId, companyId);
        const db = getDatabase();
        if (!db) return [];

        try {
            await this.ensureTable();

            const res = await db.query(
                'SELECT * FROM user_stickers WHERE "userId" = $1 ORDER BY "createdAt" DESC',
                [userId]
            );

            // Se o usuário já tiver figurinhas salvas, retorna elas
            if (res.rows.length > 0) {
                const seen = new Set();
                const uniqueRows = [];
                for (const row of res.rows) {
                    const key = row.fileHash || row.url;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueRows.push(row);
                    }
                }
                return uniqueRows;
            }

            // Fallback: se o usuário ainda não tiver nenhuma figurinha salva, traz figurinhas do bot/empresa
            return await this.listStickers(botId, companyId);
        } catch (error) {
            console.error('❌ [StickerService] Erro ao listar figurinhas do usuário:', error);
            return [];
        }
    }

    /**
     * Salva uma figurinha vinculada exclusivamente ao usuário
     */
    async saveUserSticker(userId, url, name = null, fileHash = null) {
        if (!userId || !url) return null;
        const db = getDatabase();
        if (!db) return null;

        try {
            await this.ensureTable();

            let cleanUrl = url;
            const match = url.match(/\[StickerUrl:(.*?)\]/);
            if (match) cleanUrl = match[1].trim();

            // Se fileHash não foi fornecido, calcula a partir do arquivo em disco
            let hash = fileHash;
            if (!hash) {
                try {
                    const filename = cleanUrl.replace('/uploads/', '');
                    const filepath = path.join(DIRS.uploads, filename);
                    if (await fs.pathExists(filepath)) {
                        const buffer = await fs.readFile(filepath);
                        hash = crypto.createHash('md5').update(buffer).digest('hex');
                    }
                } catch (hErr) {}
            }

            // Verifica se a figurinha já está cadastrada para este usuário (por hash ou por URL)
            let checkQuery = 'SELECT * FROM user_stickers WHERE "userId" = $1 AND (url = $2';
            const checkParams = [userId, cleanUrl];
            if (hash) {
                checkQuery += ' OR "fileHash" = $3';
                checkParams.push(hash);
            }
            checkQuery += ') LIMIT 1';

            const check = await db.query(checkQuery, checkParams);
            if (check.rows.length > 0) {
                if (hash && !check.rows[0].fileHash) {
                    await db.query('UPDATE user_stickers SET "fileHash" = $1 WHERE id = $2', [hash, check.rows[0].id]);
                    check.rows[0].fileHash = hash;
                }
                return check.rows[0];
            }

            const id = `stk_usr_${userId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const now = new Date().toISOString();
            const cleanName = name || 'Minha Figurinha';

            const insertRes = await db.query(`
                INSERT INTO user_stickers (id, "userId", url, name, "fileHash", "createdAt")
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [id, userId, cleanUrl, cleanName, hash, now]);

            const saved = insertRes.rows[0];

            const io = this.getIo();
            if (io) {
                io.emit('user-stickers-updated', { userId, sticker: saved });
            }

            console.log(`✨ [StickerService] Figurinha vinculada ao usuário ${userId}: ${cleanUrl} (Hash: ${hash})`);
            return saved;
        } catch (error) {
            console.error('❌ [StickerService] Erro ao salvar figurinha para usuário:', error);
            return null;
        }
    }

    /**
     * Remove uma figurinha específica de um usuário
     */
    async deleteUserSticker(userId, stickerId) {
        if (!userId) return false;
        const db = getDatabase();
        if (!db) return false;

        try {
            await this.ensureTable();
            await db.query(
                'DELETE FROM user_stickers WHERE "userId" = $1 AND (id = $2 OR url = $2)',
                [userId, stickerId]
            );
            const io = this.getIo();
            if (io) {
                io.emit('user-stickers-deleted', { userId, stickerId });
            }
            return true;
        } catch (error) {
            console.error('❌ [StickerService] Erro ao deletar figurinha do usuário:', error);
            return false;
        }
    }
}

module.exports = new StickerService();
