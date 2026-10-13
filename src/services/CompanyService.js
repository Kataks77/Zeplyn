const { getDatabase } = require('./DatabaseService');
const UserService = require('./UserService');
const crypto = require('crypto');

function parseScreens(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

class CompanyService {
    /**
     * Listar todas as empresas com contadores de bots e usuários
     */
    async listCompanies() {
        const db = getDatabase();
        if (!db) return [];

        const query = `
            SELECT c.*, 
                   COUNT(DISTINCT b.id)::int AS "botCount",
                   COUNT(DISTINCT u.id)::int AS "userCount"
            FROM companies c
            LEFT JOIN bots b ON b."companyId" = c.id
            LEFT JOIN users u ON u."companyId" = c.id
            GROUP BY c.id
            ORDER BY c."createdAt" DESC
        `;
        const res = await db.query(query);
        return res.rows.map(r => ({
            ...r,
            isActive: r.isActive !== undefined ? Boolean(r.isActive) : true,
            allowedScreens: parseScreens(r.allowedScreens)
        }));
    }

    /**
     * Buscar empresa por ID
     */
    async getCompanyById(companyId) {
        const db = getDatabase();
        if (!db) return null;

        const query = `
            SELECT c.*, 
                   COUNT(DISTINCT b.id)::int AS "botCount",
                   COUNT(DISTINCT u.id)::int AS "userCount"
            FROM companies c
            LEFT JOIN bots b ON b."companyId" = c.id
            LEFT JOIN users u ON u."companyId" = c.id
            WHERE c.id = $1
            GROUP BY c.id
        `;
        const res = await db.query(query, [companyId]);
        const company = res.rows[0];
        if (!company) return null;
        return {
            ...company,
            isActive: company.isActive !== undefined ? Boolean(company.isActive) : true,
            allowedScreens: parseScreens(company.allowedScreens)
        };
    }

    /**
     * Obter quantidade de bots ativos de uma empresa
     */
    async getCompanyBotCount(companyId) {
        const comp = await this.getCompanyById(companyId);
        return comp ? comp.botCount : 0;
    }

    /**
     * Obter detalhes completos da empresa (com lista de bots e usuários)
     */
    async getCompanyDetails(companyId) {
        const company = await this.getCompanyById(companyId);
        if (!company) return null;

        const BotService = require('./BotService');
        const UserService = require('./UserService');
        const BotManagerService = require('./BotManagerService');

        const bots = await BotService.listBots(companyId);
        const enrichedBots = bots.map(b => ({
            id: b.id,
            name: b.name,
            model: b.model,
            status: BotManagerService.getStatus(b.id),
            createdAt: b.createdAt
        }));

        const users = await UserService.listUsers(companyId);
        const safeUsers = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            phoneNumber: u.phoneNumber,
            isActive: u.isActive,
            createdAt: u.createdAt
        }));

        return {
            company,
            bots: enrichedBots,
            users: safeUsers
        };
    }

    /**
     * Criar uma nova empresa e o respectivo usuário administrador da empresa
     */
    async createCompany(data) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        const {
            name,
            cnpj,
            maxBots = 5,
            adminName,
            adminEmail,
            adminPassword,
            adminPhone
        } = data;

        if (!name || !name.trim()) {
            throw new Error('Nome da empresa é obrigatório');
        }

        if (!adminEmail || !adminPassword || !adminName) {
            throw new Error('Nome, e-mail e senha do administrador da empresa são obrigatórios');
        }

        // Verifica se o e-mail já existe
        const existingUser = await UserService.findUserByEmail(adminEmail);
        if (existingUser) {
            throw new Error('O e-mail informado para o administrador já está cadastrado no sistema');
        }

        const companyId = `comp_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Date.now()}`;
        const now = new Date().toISOString();

        // 1. Cria a empresa
        await db.query(`
            INSERT INTO companies (id, name, cnpj, "maxBots", "isActive", "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            companyId,
            name.trim(),
            cnpj ? cnpj.trim() : null,
            parseInt(maxBots, 10) || 5,
            true,
            now
        ]);

        // 2. Cria o usuário administrador da empresa
        const adminUser = await UserService.createUser({
            name: adminName.trim(),
            email: adminEmail.trim(),
            password: adminPassword,
            role: 'admin',
            phoneNumber: adminPhone || null,
            companyId: companyId
        });

        // 3. Cria atalhos de mensagens rápidas padrão para a nova empresa
        try {
            await db.query(`
                INSERT INTO quick_messages (shortcut, content, "companyId") VALUES
                ('/boasvindas', 'Olá *{nome}*, seja bem-vindo(a)! Como posso te ajudar hoje?', $1),
                ('/suporte', 'Olá *{nome}*, estamos encaminhando seu atendimento para nossa equipe. Aguarde um momento.', $1),
                ('/notificacao', 'Olá *{nome}*, você tem uma nova atualização importante. Por favor, verifique.', $1)
                ON CONFLICT DO NOTHING
            `, [companyId]);
        } catch (e) {
            console.warn('[CompanyService] Erro ao criar mensagens rápidas padrão da empresa:', e.message);
        }

        return {
            id: companyId,
            name: name.trim(),
            cnpj,
            maxBots: parseInt(maxBots, 10) || 5,
            createdAt: now,
            isActive: true,
            adminUser: {
                id: adminUser.id,
                name: adminUser.name,
                email: adminUser.email
            }
        };
    }

    /**
     * Atualizar dados da empresa
     */
    async updateCompany(companyId, updates) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        const fields = [];
        const values = [];
        let count = 1;

        if (updates.name !== undefined) {
            fields.push(`name = $${count++}`);
            values.push(updates.name.trim());
        }
        if (updates.cnpj !== undefined) {
            fields.push(`cnpj = $${count++}`);
            values.push(updates.cnpj ? updates.cnpj.trim() : null);
        }
        if (updates.maxBots !== undefined) {
            fields.push(`"maxBots" = $${count++}`);
            values.push(parseInt(updates.maxBots, 10));
        }
        if (updates.allowedScreens !== undefined) {
            let screensVal = null;
            if (Array.isArray(updates.allowedScreens)) {
                screensVal = JSON.stringify(updates.allowedScreens);
            } else if (typeof updates.allowedScreens === 'string') {
                screensVal = updates.allowedScreens;
            }
            fields.push(`"allowedScreens" = $${count++}`);
            values.push(screensVal);
        }

        if (fields.length === 0) return await this.getCompanyById(companyId);

        values.push(companyId);
        const sql = `UPDATE companies SET ${fields.join(', ')} WHERE id = $${count}`;
        await db.query(sql, values);

        if (updates.allowedScreens !== undefined) {
            try {
                const BotManagerService = require('./BotManagerService');
                if (BotManagerService.io) {
                    BotManagerService.io.emit('company_permissions_updated', {
                        companyId,
                        allowedScreens: parseScreens(updates.allowedScreens)
                    });
                }
            } catch (sockErr) {
                console.warn('[CompanyService] Erro ao emitir company_permissions_updated:', sockErr.message);
            }
        }

        // Se a empresa foi suspensa (isActive = false), interrompe imediatamente todos os bots ativos vinculados a ela
        if (updates.isActive === false || updates.isActive === 'false') {
            try {
                const botRes = await db.query('SELECT id FROM bots WHERE "companyId" = $1', [companyId]);
                const BotManagerService = require('./BotManagerService');
                for (const row of botRes.rows) {
                    await BotManagerService.stopBot(row.id).catch(err => {
                        console.warn(`[CompanyService] Erro ao parar bot ${row.id} da empresa suspensa:`, err.message);
                    });
                }
                console.log(`🛑 [CompanyService] Todos os bots da empresa ${companyId} foram suspensos com sucesso.`);
            } catch (botStopErr) {
                console.error('[CompanyService] Erro ao parar bots da empresa suspensa:', botStopErr);
            }
        }

        // Notifica todos os clientes conectados via Socket.IO em tempo real sobre o bloqueio/reativação
        if (updates.isActive !== undefined) {
            const isSuspended = updates.isActive === false || updates.isActive === 'false';
            try {
                const BotManagerService = require('./BotManagerService');
                if (BotManagerService.io) {
                    BotManagerService.io.emit('company_status_changed', {
                        companyId,
                        isActive: !isSuspended,
                        suspended: isSuspended,
                        reason: isSuspended ? 'financial_pending' : 'reactivated',
                        message: isSuspended 
                            ? 'Sua conta está suspensa por pendências financeiras. Entre em contato com o setor financeiro para regularizar o acesso.'
                            : 'O acesso da sua empresa foi reativado com sucesso!'
                    });
                    console.log(`📢 [Socket.IO] Evento company_status_changed emitido para empresa ${companyId} (Suspensa: ${isSuspended})`);
                }
                if (isSuspended) {
                    BotManagerService.disconnectCompanySockets(companyId);
                }
            } catch (socketErr) {
                console.warn('[CompanyService] Erro ao emitir company_status_changed:', socketErr.message);
            }
        }

        return await this.getCompanyById(companyId);
    }

    /**
     * Excluir empresa e seus recursos vinculados
     */
    async deleteCompany(companyId) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        // Se houver bots da empresa conectados, para as instâncias antes de excluir
        const botRes = await db.query('SELECT id FROM bots WHERE "companyId" = $1', [companyId]);
        const BotManagerService = require('./BotManagerService');
        for (const row of botRes.rows) {
            await BotManagerService.stopBot(row.id).catch(() => {});
        }

        await db.query('DELETE FROM companies WHERE id = $1', [companyId]);
        return true;
    }
}

module.exports = new CompanyService();
