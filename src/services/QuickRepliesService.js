const { getDatabase } = require('./DatabaseService');

class QuickRepliesService {
    /**
     * Sanitiza o atalho (remove '/', espaços e converte para minúsculas)
     */
    sanitizeShortcut(shortcut) {
        if (!shortcut) return '';
        return shortcut.replace(/^\/+/, '').trim().toLowerCase().replace(/\s+/g, '_');
    }

    /**
     * Substitui variáveis dinâmicas no modelo de mensagem
     */
    replaceVariables(template, vars = {}) {
        if (!template || typeof template !== 'string') return '';

        const now = new Date();
        const brazilHours = (now.getUTCHours() - 3 + 24) % 24; // Horário aproximado de Brasília
        let saudacao = 'Olá';
        if (brazilHours >= 5 && brazilHours < 12) saudacao = 'Bom dia';
        else if (brazilHours >= 12 && brazilHours < 18) saudacao = 'Boa tarde';
        else saudacao = 'Boa noite';

        const fullName = vars.contactName || vars.name || 'Cliente';
        const firstName = fullName.split(' ')[0] || 'Cliente';
        const attendant = vars.attendantName || vars.userName || 'Atendente';
        const company = vars.companyName || 'Zeplyn';
        const protocol = vars.protocol || `PROT-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const phone = vars.phone || (vars.contactJid ? vars.contactJid.split('@')[0] : '');

        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return template
            .replace(/{nome}/gi, fullName)
            .replace(/{primeiro_nome}/gi, firstName)
            .replace(/{saudacao}/gi, saudacao)
            .replace(/{atendente}/gi, attendant)
            .replace(/{empresa}/gi, company)
            .replace(/{protocolo}/gi, protocol)
            .replace(/{telefone}/gi, phone)
            .replace(/{data}/gi, dateStr)
            .replace(/{hora}/gi, timeStr);
    }

    /**
     * Lista respostas rápidas de uma empresa
     */
    async list(companyId = 'company_default', search = '', category = '') {
        const db = getDatabase();
        if (!db) return [];

        let query = `
            SELECT id, "companyId", shortcut, title, message, category, "mediaUrl", "mediaType", "createdBy", "createdAt", "updatedAt"
            FROM quick_replies
            WHERE ("companyId" = $1 OR "companyId" = 'company_default')
        `;
        const params = [companyId];
        let paramIndex = 2;

        if (search) {
            query += ` AND (shortcut ILIKE $${paramIndex} OR title ILIKE $${paramIndex} OR message ILIKE $${paramIndex})`;
            params.push(`%${search.trim().replace(/^\/+/, '')}%`);
            paramIndex++;
        }

        if (category && category !== 'Todos') {
            query += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        query += ` ORDER BY category ASC, shortcut ASC`;

        const res = await db.query(query, params);
        return res.rows || [];
    }

    /**
     * Obtém resposta rápida por ID
     */
    async getById(id, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) return null;

        const res = await db.query(
            'SELECT * FROM quick_replies WHERE id = $1 AND ("companyId" = $2 OR "companyId" = \'company_default\')',
            [id, companyId]
        );
        return res.rows[0] || null;
    }

    /**
     * Cria nova resposta rápida
     */
    async create(data, companyId = 'company_default', userId = null) {
        const db = getDatabase();
        if (!db) throw new Error('Database indisponível');

        const shortcut = this.sanitizeShortcut(data.shortcut);
        if (!shortcut) throw new Error('O atalho é obrigatório');
        if (!data.title) throw new Error('O título é obrigatório');
        if (!data.message) throw new Error('A mensagem é obrigatória');

        const now = new Date().toISOString();
        const res = await db.query(`
            INSERT INTO quick_replies ("companyId", shortcut, title, message, category, "mediaUrl", "mediaType", "createdBy", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            companyId,
            shortcut,
            data.title.trim(),
            data.message.trim(),
            data.category ? data.category.trim() : 'Geral',
            data.mediaUrl || null,
            data.mediaType || null,
            userId,
            now,
            now
        ]);

        return res.rows[0];
    }

    /**
     * Atualiza resposta rápida existente
     */
    async update(id, data, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) throw new Error('Database indisponível');

        const existing = await this.getById(id, companyId);
        if (!existing) throw new Error('Resposta rápida não encontrada');

        const shortcut = data.shortcut ? this.sanitizeShortcut(data.shortcut) : existing.shortcut;
        const title = data.title !== undefined ? data.title.trim() : existing.title;
        const message = data.message !== undefined ? data.message.trim() : existing.message;
        const category = data.category !== undefined ? data.category.trim() : existing.category;
        const mediaUrl = data.mediaUrl !== undefined ? data.mediaUrl : existing.mediaUrl;
        const mediaType = data.mediaType !== undefined ? data.mediaType : existing.mediaType;
        const now = new Date().toISOString();

        const res = await db.query(`
            UPDATE quick_replies
            SET shortcut = $1, title = $2, message = $3, category = $4, "mediaUrl" = $5, "mediaType" = $6, "updatedAt" = $7
            WHERE id = $8 AND ("companyId" = $9 OR "companyId" = 'company_default')
            RETURNING *
        `, [
            shortcut,
            title,
            message,
            category,
            mediaUrl,
            mediaType,
            now,
            id,
            companyId
        ]);

        return res.rows[0];
    }

    /**
     * Remove resposta rápida
     */
    async delete(id, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) throw new Error('Database indisponível');

        const res = await db.query(
            'DELETE FROM quick_replies WHERE id = $1 AND ("companyId" = $2 OR "companyId" = \'company_default\') RETURNING id',
            [id, companyId]
        );
        return res.rowCount > 0;
    }
}

module.exports = new QuickRepliesService();
