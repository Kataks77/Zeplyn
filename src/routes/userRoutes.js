const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const AuditService = require('../services/AuditService');
const { requireAdmin, authenticateRequest } = require('../middlewares/authMiddleware');

// Listar atendentes da empresa para transferência de atendimento (disponível para operadores/administradores autenticados)
router.get('/attendants', authenticateRequest, async (req, res) => {
    try {
        const isSuperAdmin = req.user && req.user.role === 'superadmin';
        const targetCompanyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');
        const db = require('../services/DatabaseService').getDatabase();
        if (!db) return res.json([]);

        let sql = `
            SELECT u.id, u.name, u.email, u.role, u."jobRoleName", u.department, u."companyId",
                   COALESCE(u."isAvailable", TRUE) as "isAvailable",
                   c.name as "companyName",
                   COUNT(ch.id) FILTER (WHERE ch.status = 'attending') as "activeChatsCount",
                   COUNT(ch.id) FILTER (WHERE ch.status = 'finished') as "finishedChatsCount"
            FROM users u
            LEFT JOIN companies c ON u."companyId" = c.id
            LEFT JOIN chats ch ON u.id = ch."attendantId"
            WHERE u."isActive" = TRUE
        `;
        const params = [];
        if (targetCompanyId) {
            sql += ` AND u."companyId" = $1`;
            params.push(targetCompanyId);
        }
        sql += `
            GROUP BY u.id, u.name, u.email, u.role, u."jobRoleName", u.department, u."companyId", u."isAvailable", c.name
            ORDER BY u.name ASC
        `;
        const result = await db.query(sql, params);
        const UserPresenceService = require('../services/UserPresenceService');
        const attendants = result.rows.map(att => {
            const isOnline = UserPresenceService.isUserOnline(att.id);
            const activeCount = parseInt(att.activeChatsCount, 10) || 0;
            const finishedCount = parseInt(att.finishedChatsCount, 10) || 0;
            let liveStatus = 'offline';
            if (isOnline) {
                if (!att.isAvailable) {
                    liveStatus = 'paused';
                } else if (activeCount > 0) {
                    liveStatus = 'busy';
                } else {
                    liveStatus = 'available';
                }
            }
            return {
                ...att,
                isOnline,
                liveStatus,
                activeChatsCount: activeCount,
                finishedChatsCount: finishedCount
            };
        });
        res.json(attendants);
    } catch (err) {
        console.error('Erro ao listar atendentes para transferência:', err);
        res.status(500).json({ error: 'Erro ao listar atendentes' });
    }
});

// Atualizar status de disponibilidade para atendimento (Disponível vs Pausado)
router.put('/me/availability', authenticateRequest, async (req, res) => {
    try {
        const db = require('../services/DatabaseService').getDatabase();
        if (!db) return res.status(500).json({ error: 'Banco de dados indisponível' });

        const isAvailable = Boolean(req.body.isAvailable);
        await db.query('UPDATE users SET "isAvailable" = $1 WHERE id = $2', [isAvailable, req.user.id]);

        const BotManagerService = require('../services/BotManagerService');
        const io = BotManagerService.io;
        if (io) {
            const companyId = req.user.companyId || 'company_default';
            const payload = { userId: req.user.id, isAvailable, userName: req.user.name };
            io.to(`company_${companyId}`).emit('user:availability-changed', payload);
            io.to('company_superadmin').emit('user:availability-changed', payload);
        }

        res.json({ success: true, isAvailable });
    } catch (err) {
        console.error('Erro ao atualizar disponibilidade:', err);
        res.status(500).json({ error: 'Erro ao atualizar disponibilidade' });
    }
});

// Listar usuários: Superadmin tem visão global/filtrada por empresa; Admin vê apenas operadores da sua empresa
router.get('/', requireAdmin, async (req, res) => {
    try {
        const isSuperAdmin = req.user && req.user.role === 'superadmin';
        const targetCompanyId = isSuperAdmin ? (req.query.companyId || null) : (req.user?.companyId || 'company_default');

        const users = await UserService.listUsers(targetCompanyId);
        // Remover senhas por segurança antes de enviar
        const safeUsers = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        res.json(safeUsers);
    } catch (err) {
        console.error('Erro ao listar usuários:', err);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Obter usuário por ID (Superadmin ou usuário da mesma empresa)
router.get('/:userId', requireAdmin, async (req, res) => {
    try {
        const user = await UserService.findUserById(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Validação multi-tenant
        if (req.user?.role !== 'superadmin' && user.companyId !== req.user?.companyId) {
            return res.status(403).json({ error: 'Acesso negado a este usuário.' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (err) {
        console.error(`Erro ao obter usuário ${req.params.userId}:`, err);
        res.status(500).json({ error: 'Erro ao obter usuário' });
    }
});

// Criar novo usuário (Superadmin para qualquer empresa; Admin de empresa exclusivamente para a sua empresa)
router.post('/', requireAdmin, async (req, res) => {
    try {
        const body = req.body || {};
        const { name, email, password, phoneNumber, isActive, jobRoleId, jobRoleName, department } = body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
        }

        const isSuperAdmin = req.user?.role === 'superadmin';
        let companyId = body.companyId;
        let role = body.role || 'operator';

        if (!isSuperAdmin) {
            // Admin da empresa só pode criar usuários para sua própria empresa
            companyId = req.user?.companyId || 'company_default';
            // Admin de empresa não pode criar superadmin
            if (role === 'superadmin') {
                role = 'admin';
            }
        } else {
            // Superadmin pode escolher a empresa ou usar a padrão
            if (!companyId) {
                companyId = 'company_default';
            }
        }

        const newUser = await UserService.createUser({
            name,
            email,
            password,
            role,
            phoneNumber,
            companyId,
            jobRoleId,
            jobRoleName,
            department,
            isActive
        });

        const { password: _, ...userWithoutPassword } = newUser;

        AuditService.logRequest(req, {
            action: 'USER_CREATE',
            description: `Cadastrou o usuário ${name} (${email}) com o cargo ${role}`,
            category: 'users',
            details: { userId: newUser.id, name, email, role, companyId }
        }).catch(() => { });

        res.status(201).json(userWithoutPassword);
    } catch (err) {
        console.error('Erro ao criar usuário:', err);
        const msg = err.message || '';
        const isClientError = msg.includes('obrigat') ||
            msg.includes('inválid') ||
            msg.includes('caracteres') ||
            msg.includes('já está em uso') ||
            msg.includes('não existe');
        res.status(isClientError ? 400 : 500).json({ error: msg || 'Erro ao criar usuário' });
    }
});

// Atualizar usuário (Superadmin edita qualquer um; Admin de empresa edita apenas membros da sua própria empresa)
router.put('/:userId', requireAdmin, async (req, res) => {
    try {
        const userToUpdate = await UserService.findUserById(req.params.userId);
        if (!userToUpdate) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const isSuperAdmin = req.user?.role === 'superadmin';
        const updates = { ...(req.body || {}) };

        if (!isSuperAdmin) {
            // Admin não pode editar superadmins
            if (userToUpdate.role === 'superadmin') {
                return res.status(403).json({ error: 'Não é permitido alterar dados de um Superadministrador.' });
            }
            // Admin só pode editar usuários da sua própria empresa
            if (userToUpdate.companyId !== req.user?.companyId) {
                return res.status(403).json({ error: 'Acesso negado: Este usuário pertence a outra empresa.' });
            }
            // Admin não pode transferir usuário de empresa nem promover para superadmin
            delete updates.companyId;
            if (updates.role === 'superadmin') {
                delete updates.role;
            }
        }

        const updatedUser = await UserService.updateUser(req.params.userId, updates);
        const { password: _, ...userWithoutPassword } = updatedUser;

        AuditService.logRequest(req, {
            action: 'USER_UPDATE',
            description: `Atualizou os dados do usuário ${userToUpdate.name} (${userToUpdate.email})`,
            category: 'users',
            details: { userId: req.params.userId, name: userToUpdate.name, updatedFields: Object.keys(updates) }
        }).catch(() => { });

        res.json(userWithoutPassword);
    } catch (err) {
        console.error(`Erro ao atualizar usuário ${req.params.userId}:`, err);
        const msg = err.message || '';
        const isForbidden = msg.includes('Não é permitido');
        const isClientError = msg.includes('obrigat') ||
            msg.includes('inválid') ||
            msg.includes('caracteres') ||
            msg.includes('já está em uso') ||
            msg.includes('não existe');
        res.status(isForbidden ? 403 : (isClientError ? 400 : 500)).json({ error: msg || 'Erro ao atualizar usuário' });
    }
});

// Deletar usuário (Superadmin exclui qualquer um exceto master; Admin exclui apenas da sua empresa)
router.delete('/:userId', requireAdmin, async (req, res) => {
    try {
        if (req.user && req.user.id === req.params.userId) {
            return res.status(400).json({ error: 'Não é possível excluir o próprio usuário logado.' });
        }

        const userToDelete = await UserService.findUserById(req.params.userId);
        if (!userToDelete) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const isSuperAdmin = req.user?.role === 'superadmin';

        if (!isSuperAdmin) {
            if (userToDelete.role === 'superadmin') {
                return res.status(403).json({ error: 'Não é permitido excluir um Superadministrador.' });
            }
            if (userToDelete.companyId !== req.user?.companyId) {
                return res.status(403).json({ error: 'Acesso negado: Este usuário pertence a outra empresa.' });
            }
        }

        await UserService.deleteUser(req.params.userId);

        AuditService.logRequest(req, {
            action: 'USER_DELETE',
            description: `Excluiu o usuário ${userToDelete.name} (${userToDelete.email})`,
            category: 'users',
            details: { userId: req.params.userId, name: userToDelete.name, email: userToDelete.email }
        }).catch(() => { });

        res.json({ success: true, message: 'Usuário excluído com sucesso' });
    } catch (err) {
        console.error(`Erro ao excluir usuário ${req.params.userId}:`, err);
        const msg = err.message || '';
        const isForbidden = msg.includes('Não é permitido');
        res.status(isForbidden ? 403 : 500).json({ error: msg || 'Erro ao excluir usuário' });
    }
});

module.exports = router;
