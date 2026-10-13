const db = require('../services/DatabaseService');

async function getQuickMessages(req, res, next) {
    try {
        const isSuperAdmin = req.user?.role === 'superadmin';
        const companyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');

        let sql = 'SELECT * FROM quick_messages';
        const params = [];
        if (companyId) {
            sql += ' WHERE "companyId" = $1';
            params.push(companyId);
        }
        sql += ' ORDER BY shortcut ASC';

        const result = await db.query(sql, params);
        return res.json({ success: true, quickMessages: result.rows });
    } catch (error) {
        console.error('Erro ao listar mensagens rápidas:', error);
        next(error);
    }
}

async function saveQuickMessage(req, res, next) {
    try {
        const { id, shortcut, content } = req.body;
        const companyId = req.user?.companyId || 'company_default';
        
        if (!shortcut || !content) {
            return res.status(400).json({ success: false, error: 'Atalho e conteúdo são obrigatórios.' });
        }

        // Validar que o atalho começa com /
        let cleanShortcut = shortcut.trim();
        if (!cleanShortcut.startsWith('/')) {
            cleanShortcut = '/' + cleanShortcut;
        }
        
        // Impedir espaços no atalho
        if (cleanShortcut.includes(' ')) {
            return res.status(400).json({ success: false, error: 'O atalho não pode conter espaços.' });
        }

        if (id) {
            // Verificar existência e pertinência à empresa
            const existRes = await db.query('SELECT * FROM quick_messages WHERE id = $1', [id]);
            if (existRes.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Mensagem rápida não encontrada.' });
            }
            if (req.user?.role !== 'superadmin' && (existRes.rows[0].companyId || 'company_default') !== companyId) {
                return res.status(403).json({ success: false, error: 'Acesso negado: Esta mensagem rápida pertence a outra empresa.' });
            }

            // Verificar atalho duplicado na mesma empresa
            const checkRes = await db.query(
                'SELECT * FROM quick_messages WHERE shortcut = $1 AND "companyId" = $2 AND id <> $3',
                [cleanShortcut, companyId, id]
            );
            if (checkRes.rows.length > 0) {
                return res.status(400).json({ success: false, error: `O atalho "${cleanShortcut}" já está em uso na sua empresa.` });
            }

            const updateRes = await db.query(
                'UPDATE quick_messages SET shortcut = $1, content = $2 WHERE id = $3 RETURNING *',
                [cleanShortcut, content.trim(), id]
            );
            return res.json({ success: true, quickMessage: updateRes.rows[0] });
        } else {
            // Insert: verificar duplicidade na mesma empresa
            const checkRes = await db.query(
                'SELECT * FROM quick_messages WHERE shortcut = $1 AND "companyId" = $2',
                [cleanShortcut, companyId]
            );
            if (checkRes.rows.length > 0) {
                return res.status(400).json({ success: false, error: `O atalho "${cleanShortcut}" já está em uso na sua empresa.` });
            }

            const insertRes = await db.query(
                'INSERT INTO quick_messages (shortcut, content, "companyId") VALUES ($1, $2, $3) RETURNING *',
                [cleanShortcut, content.trim(), companyId]
            );
            return res.json({ success: true, quickMessage: insertRes.rows[0] });
        }
    } catch (error) {
        console.error('Erro ao salvar mensagem rápida:', error);
        next(error);
    }
}

async function deleteQuickMessage(req, res, next) {
    try {
        const { id } = req.params;
        const companyId = req.user?.companyId || 'company_default';
        if (!id) {
            return res.status(400).json({ success: false, error: 'ID é obrigatório.' });
        }

        const existRes = await db.query('SELECT * FROM quick_messages WHERE id = $1', [id]);
        if (existRes.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Mensagem rápida não encontrada.' });
        }
        if (req.user?.role !== 'superadmin' && (existRes.rows[0].companyId || 'company_default') !== companyId) {
            return res.status(403).json({ success: false, error: 'Acesso negado: Esta mensagem rápida pertence a outra empresa.' });
        }

        await db.query('DELETE FROM quick_messages WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Mensagem rápida excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir mensagem rápida:', error);
        next(error);
    }
}

module.exports = {
    getQuickMessages,
    saveQuickMessage,
    deleteQuickMessage
};
