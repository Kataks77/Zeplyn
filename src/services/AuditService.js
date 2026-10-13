const { getDatabase } = require('./DatabaseService');

class AuditService {
    constructor() {
        this.companyNamesCache = new Map();
    }

    async resolveCompanyName(db, companyId) {
        if (!companyId || companyId === 'company_default') return 'Empresa Padrão';
        if (this.companyNamesCache.has(companyId)) return this.companyNamesCache.get(companyId);
        try {
            const res = await db.query('SELECT name FROM companies WHERE id = $1', [companyId]);
            if (res.rows.length > 0) {
                const name = res.rows[0].name;
                this.companyNamesCache.set(companyId, name);
                return name;
            }
        } catch (_) {}
        return companyId;
    }

    /**
     * Registra uma ação administrativa, operacional ou de navegação de forma enriquecida
     */
    async logAction({
        companyId,
        companyName = null,
        userId = null,
        userName = null,
        userEmail = null,
        userRole = null,
        action,
        description = null,
        category = 'general',
        details = null,
        ipAddress = null
    }) {
        try {
            const db = getDatabase();
            if (!db) return;

            const targetCompanyId = companyId || 'company_default';
            const targetCompanyName = companyName || await this.resolveCompanyName(db, targetCompanyId);
            const logId = `aud_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
            const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details ? String(details) : null);

            await db.query(`
                INSERT INTO audit_logs (
                    id, 
                    "companyId", 
                    "companyName", 
                    "userId", 
                    "userName", 
                    "userEmail", 
                    "userRole", 
                    action, 
                    description, 
                    category, 
                    details, 
                    "ipAddress", 
                    "createdAt"
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
            `, [
                logId,
                targetCompanyId,
                targetCompanyName,
                userId || null,
                userName || 'Sistema',
                userEmail || null,
                userRole || null,
                action,
                description || action,
                category,
                detailsStr,
                ipAddress || null
            ]);
        } catch (error) {
            console.error('⚠️ [AuditService] Falha ao registrar log de auditoria:', error.message);
        }
    }

    /**
     * Helper prático para gravar log a partir do req do Express
     */
    async logRequest(req, { action, description, category = 'general', details = null }) {
        if (!req || !req.user) return;
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress;
        return this.logAction({
            companyId: req.user.companyId || 'company_default',
            companyName: req.user.companyName || null,
            userId: req.user.id,
            userName: req.user.name,
            userEmail: req.user.email,
            userRole: req.user.role,
            action,
            description,
            category,
            details,
            ipAddress: ip
        });
    }

    /**
     * Lista histórico de auditoria segregado por empresa com suporte a busca completa
     */
    async listLogs({ companyId, page = 1, limit = 50, category = null, search = null }) {
        const db = getDatabase();
        if (!db) return { logs: [], total: 0, page, totalPages: 1 };

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
        const offset = (parsedPage - 1) * parsedLimit;

        const whereClauses = [];
        const params = [];

        if (companyId) {
            params.push(companyId);
            whereClauses.push(`a."companyId" = $${params.length}`);
        }

        if (category) {
            params.push(category);
            whereClauses.push(`a.category = $${params.length}`);
        }

        if (search) {
            params.push(`%${search}%`);
            whereClauses.push(`(
                a.action ILIKE $${params.length} OR 
                COALESCE(a.description, '') ILIKE $${params.length} OR 
                COALESCE(a."userName", u.name, '') ILIKE $${params.length} OR 
                COALESCE(a."userEmail", u.email, '') ILIKE $${params.length} OR 
                COALESCE(a."companyName", c.name, '') ILIKE $${params.length} OR 
                COALESCE(a.details, '') ILIKE $${params.length}
            )`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countRes = await db.query(`
            SELECT COUNT(*) as total 
            FROM audit_logs a
            LEFT JOIN companies c ON a."companyId" = c.id
            LEFT JOIN users u ON a."userId" = u.id
            ${whereSql}
        `, params);
        const total = parseInt(countRes.rows[0]?.total || 0, 10);

        const logsRes = await db.query(`
            SELECT 
                a.id,
                a."companyId",
                COALESCE(NULLIF(a."companyName", ''), c.name, 'Empresa Padrão') AS "companyName",
                a."userId",
                COALESCE(NULLIF(a."userName", ''), u.name, 'Sistema') AS "userName",
                COALESCE(NULLIF(a."userEmail", ''), u.email, '—') AS "userEmail",
                COALESCE(NULLIF(a."userRole", ''), u.role, 'operador') AS "userRole",
                a.action,
                COALESCE(NULLIF(a.description, ''), a.action) AS description,
                a.category,
                a.details,
                a."ipAddress",
                a."createdAt"
            FROM audit_logs a
            LEFT JOIN companies c ON a."companyId" = c.id
            LEFT JOIN users u ON a."userId" = u.id
            ${whereSql}
            ORDER BY a."createdAt" DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, parsedLimit, offset]);

        return {
            logs: logsRes.rows,
            total,
            page: parsedPage,
            limit: parsedLimit,
            totalPages: Math.ceil(total / parsedLimit) || 1
        };
    }
}

module.exports = new AuditService();
