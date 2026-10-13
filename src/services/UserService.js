const crypto = require('crypto');
const { getDatabase } = require('./DatabaseService');
const { hashPassword, verifyPassword } = require('../utils/crypto');

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

/**
 * Criar novo usuário
 */
async function createUser(userData) {
    const db = getDatabase();

    if (!userData || typeof userData !== 'object') {
        throw new Error('Dados de usuário inválidos.');
    }

    // 1. Validação estrita de Nome
    if (!userData.name || typeof userData.name !== 'string' || userData.name.trim().length < 2 || userData.name.trim().length > 100) {
        throw new Error('O nome é obrigatório e deve conter entre 2 e 100 caracteres.');
    }
    const cleanName = userData.name.trim();

    // 2. Validação estrita de E-mail
    if (!userData.email || typeof userData.email !== 'string') {
        throw new Error('O e-mail é obrigatório.');
    }
    const email = userData.email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email) || email.length > 255) {
        throw new Error('Formato de e-mail inválido ou excede o limite permitido.');
    }

    // 3. Validação estrita de Senha
    if (!userData.password || typeof userData.password !== 'string' || userData.password.length < 8) {
        throw new Error('A senha deve conter no mínimo 8 caracteres por segurança.');
    }
    if (userData.password.length > 128) {
        throw new Error('A senha não pode exceder 128 caracteres.');
    }

    // 4. Validação de Unicidade de E-mail
    const existingRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existingRes.rows.length > 0) {
        throw new Error('Email já está em uso no sistema.');
    }

    // 5. Validação de Existência da Empresa Vinculada (Zero Trust)
    const companyId = userData.companyId || 'company_default';
    const compCheck = await db.query('SELECT id FROM companies WHERE id = $1', [companyId]);
    if (compCheck.rows.length === 0) {
        throw new Error(`A empresa vinculada (${companyId}) não existe no sistema.`);
    }

    // 6. Validação de Cargo (Whitelist estrita)
    const validRoles = ['operator', 'admin', 'superadmin'];
    const role = userData.role || 'operator';
    if (!validRoles.includes(role)) {
        throw new Error(`Cargo inválido. Valores permitidos: ${validRoles.join(', ')}`);
    }

    // 7. Sanitização de Telefone
    let cleanPhone = null;
    if (userData.phoneNumber && typeof userData.phoneNumber === 'string') {
        const digits = userData.phoneNumber.trim().replace(/[^0-9+]/g, '');
        if (digits.length >= 8 && digits.length <= 25) {
            cleanPhone = digits;
        }
    }

    const uniqueId = typeof crypto.randomUUID === 'function'
        ? `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
        : `user_${Date.now()}`;

    let jobRoleId = userData.jobRoleId || null;
    let jobRoleName = userData.jobRoleName || null;
    let department = userData.department || null;

    if (jobRoleId) {
        try {
            const roleRes = await db.query('SELECT name, department FROM company_roles WHERE id = $1', [jobRoleId]);
            if (roleRes.rows.length > 0) {
                jobRoleName = roleRes.rows[0].name;
                if (!department) department = roleRes.rows[0].department;
            }
        } catch (e) { }
    }

    const newUser = {
        id: uniqueId,
        name: cleanName,
        email,
        password: userData.password,
        role,
        phoneNumber: cleanPhone,
        companyId,
        jobRoleId,
        jobRoleName,
        department,
        allowedScreens: userData.allowedScreens ? parseScreens(userData.allowedScreens) : null,
        createdAt: new Date().toISOString(),
        isActive: userData.isActive !== undefined ? Boolean(userData.isActive) : true
    };

    await db.query(`
        INSERT INTO users (id, name, email, password, role, "phoneNumber", "createdAt", "isActive", "companyId", "jobRoleId", "jobRoleName", "department", "allowedScreens")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
        newUser.id,
        newUser.name,
        newUser.email,
        await hashPassword(newUser.password),
        newUser.role,
        newUser.phoneNumber,
        newUser.createdAt,
        newUser.isActive,
        newUser.companyId,
        newUser.jobRoleId,
        newUser.jobRoleName,
        newUser.department,
        newUser.allowedScreens ? JSON.stringify(newUser.allowedScreens) : null
    ]);

    return newUser;
}

/**
 * Encontrar usuário por email (busca insensível a maiúsculas/minúsculas otimizada no Postgres)
 */
async function findUserByEmail(email) {
    const db = getDatabase();
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) return null;

    const res = await db.query(`
        SELECT u.*, c.name AS "companyName", c."isActive" AS "companyIsActive", c."allowedScreens" AS "companyAllowedScreens"
        FROM users u
        LEFT JOIN companies c ON u."companyId" = c.id
        WHERE LOWER(u.email) = LOWER($1)
    `, [normalizedEmail]);
    const user = res.rows[0];

    if (!user) return null;

    return {
        ...user,
        isActive: !!user.isActive,
        companyIsActive: user.companyIsActive !== null && user.companyIsActive !== undefined ? !!user.companyIsActive : true,
        allowedScreens: parseScreens(user.allowedScreens),
        companyAllowedScreens: parseScreens(user.companyAllowedScreens)
    };
}


/**
 * Encontrar usuário por ID
 */
async function findUserById(userId) {
    const db = getDatabase();
    const res = await db.query(`
        SELECT u.*, c.name AS "companyName", c."isActive" AS "companyIsActive", c."allowedScreens" AS "companyAllowedScreens"
        FROM users u
        LEFT JOIN companies c ON u."companyId" = c.id
        WHERE u.id = $1
    `, [userId]);
    const user = res.rows[0];

    if (!user) return null;

    return {
        ...user,
        isActive: !!user.isActive,
        companyIsActive: user.companyIsActive !== null && user.companyIsActive !== undefined ? !!user.companyIsActive : true,
        allowedScreens: parseScreens(user.allowedScreens),
        companyAllowedScreens: parseScreens(user.companyAllowedScreens)
    };
}

/**
 * Atualizar usuário
 */
async function updateUser(userId, updates) {
    const db = getDatabase();

    if (!userId || typeof userId !== 'string') {
        throw new Error('ID de usuário inválido.');
    }

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const existing = existingRes.rows[0];
    if (!existing) {
        throw new Error('Usuário não encontrado');
    }

    const isMasterRoot = existing.id === 'admin_default' && existing.role === 'superadmin';

    const fields = [];
    const values = [];
    let count = 1;

    // 1. Validação estrita de Nome
    if (updates.name !== undefined) {
        if (typeof updates.name !== 'string' || updates.name.trim().length < 2 || updates.name.trim().length > 100) {
            throw new Error('O nome deve conter entre 2 e 100 caracteres válidos.');
        }
        fields.push(`name = $${count++}`);
        values.push(updates.name.trim());
    }

    // 2. Validação estrita de E-mail
    if (updates.email !== undefined) {
        if (typeof updates.email !== 'string') {
            throw new Error('E-mail inválido.');
        }
        const email = updates.email.trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email) || email.length > 255) {
            throw new Error('Formato de e-mail inválido.');
        }

        const emailExistsRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [email, userId]);
        if (emailExistsRes.rows.length > 0) {
            throw new Error('Email já está em uso por outro usuário.');
        }
        fields.push(`email = $${count++}`);
        values.push(email);
    }

    // 3. Validação estrita de Senha
    if (updates.password !== undefined && updates.password !== null && String(updates.password).trim() !== '') {
        if (typeof updates.password !== 'string' || updates.password.length < 8) {
            throw new Error('A nova senha deve conter no mínimo 8 caracteres.');
        }
        if (updates.password.length > 128) {
            throw new Error('A senha não pode exceder 128 caracteres.');
        }
        fields.push(`password = $${count++}`);
        values.push(await hashPassword(updates.password));
    }

    // 4. Validação estrita de Cargo (Role)
    if (updates.role !== undefined) {
        const validRoles = ['operator', 'admin', 'superadmin'];
        if (!validRoles.includes(updates.role)) {
            throw new Error(`Cargo inválido. Valores permitidos: ${validRoles.join(', ')}`);
        }
        if (isMasterRoot && updates.role !== 'superadmin') {
            throw new Error('Não é permitido rebaixar os privilégios da conta Superadministrador Master.');
        }
        fields.push(`role = $${count++}`);
        values.push(updates.role);
    }

    // 5. Validação de Telefone
    if (updates.phoneNumber !== undefined) {
        let cleanPhone = null;
        if (updates.phoneNumber && typeof updates.phoneNumber === 'string') {
            const digits = updates.phoneNumber.trim().replace(/[^0-9+]/g, '');
            if (digits.length >= 8 && digits.length <= 25) {
                cleanPhone = digits;
            }
        }
        fields.push(`"phoneNumber" = $${count++}`);
        values.push(cleanPhone);
    }

    // 6. Validação de Ativo/Inativo
    if (updates.isActive !== undefined) {
        if (isMasterRoot && !updates.isActive) {
            throw new Error('Não é permitido inativar a conta Superadministrador Master.');
        }
        fields.push(`"isActive" = $${count++}`);
        values.push(Boolean(updates.isActive));
    }

    // 7. Validação de Empresa Vinculada (Zero Trust)
    if (updates.companyId !== undefined) {
        if (!updates.companyId || typeof updates.companyId !== 'string') {
            throw new Error('ID de empresa inválido.');
        }
        const compCheck = await db.query('SELECT id FROM companies WHERE id = $1', [updates.companyId]);
        if (compCheck.rows.length === 0) {
            throw new Error('A empresa vinculada especificada não existe.');
        }
        fields.push(`"companyId" = $${count++}`);
        values.push(updates.companyId);
    }

    // 8. Cargo da Empresa e Departamento
    if (updates.jobRoleId !== undefined) {
        if (updates.jobRoleId) {
            try {
                const roleRes = await db.query('SELECT name, department FROM company_roles WHERE id = $1', [updates.jobRoleId]);
                if (roleRes.rows.length > 0) {
                    fields.push(`"jobRoleId" = $${count++}`);
                    values.push(updates.jobRoleId);
                    fields.push(`"jobRoleName" = $${count++}`);
                    values.push(roleRes.rows[0].name);
                    if (updates.department === undefined && roleRes.rows[0].department) {
                        fields.push(`"department" = $${count++}`);
                        values.push(roleRes.rows[0].department);
                    }
                } else {
                    fields.push(`"jobRoleId" = $${count++}`);
                    values.push(null);
                    fields.push(`"jobRoleName" = $${count++}`);
                    values.push(null);
                }
            } catch (e) {
                fields.push(`"jobRoleId" = $${count++}`);
                values.push(updates.jobRoleId);
            }
        } else {
            fields.push(`"jobRoleId" = $${count++}`);
            values.push(null);
            fields.push(`"jobRoleName" = $${count++}`);
            values.push(null);
        }
    } else if (updates.jobRoleName !== undefined) {
        fields.push(`"jobRoleName" = $${count++}`);
        values.push(updates.jobRoleName || null);
    }

    if (updates.department !== undefined) {
        fields.push(`"department" = $${count++}`);
        values.push(updates.department || null);
    }

    if (updates.allowedScreens !== undefined) {
        let screensStr = null;
        if (Array.isArray(updates.allowedScreens)) {
            screensStr = JSON.stringify(updates.allowedScreens);
        } else if (typeof updates.allowedScreens === 'string') {
            screensStr = updates.allowedScreens;
        }
        fields.push(`"allowedScreens" = $${count++}`);
        values.push(screensStr);
    }

    if (fields.length === 0) {
        return existing;
    }

    values.push(userId);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${count}`;
    await db.query(sql, values);

    if (updates.allowedScreens !== undefined) {
        try {
            const BotManagerService = require('./BotManagerService');
            if (BotManagerService.io) {
                BotManagerService.io.emit('user_permissions_updated', {
                    userId,
                    allowedScreens: parseScreens(updates.allowedScreens)
                });
            }
        } catch (e) { }
    }

    if (updates.isActive !== undefined) {
        try {
            const BotManagerService = require('./BotManagerService');
            if (BotManagerService.io) {
                BotManagerService.io.emit('user_status_changed', {
                    userId,
                    isActive: Boolean(updates.isActive),
                    suspended: !updates.isActive,
                    message: !updates.isActive ? 'Seu usuário foi inativado no sistema.' : 'Seu usuário foi reativado.'
                });
            }
            if (!updates.isActive) {
                BotManagerService.disconnectUserSockets(userId);
            }
        } catch (e) { }
    }

    return await findUserById(userId);
}

/**
 * Listar usuários (com filtro por empresa)
 */
async function listUsers(companyId = null) {
    const db = getDatabase();
    let query = `
        SELECT u.*, c.name AS "companyName", c."allowedScreens" AS "companyAllowedScreens", cr.color AS "jobRoleColor"
        FROM users u
        LEFT JOIN companies c ON u."companyId" = c.id
        LEFT JOIN company_roles cr ON u."jobRoleId" = cr.id
    `;
    const params = [];
    if (companyId) {
        query += ' WHERE u."companyId" = $1';
        params.push(companyId);
    }
    query += ' ORDER BY u."createdAt" DESC';
    const res = await db.query(query, params);
    const users = res.rows;

    return users.map(user => ({
        ...user,
        isActive: !!user.isActive,
        allowedScreens: parseScreens(user.allowedScreens),
        companyAllowedScreens: parseScreens(user.companyAllowedScreens)
    }));
}

/**
 * Verificar credenciais (login) com hash seguro e upgrade automático de senhas legadas
 */
async function authenticateUser(email, password) {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPassword = (password || '').trim();

    if (!normalizedEmail || !normalizedPassword) {
        return null;
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) return null;

    if (!(await verifyPassword(normalizedPassword, user.password))) {
        return null;
    }

    if (!user.isActive) {
        const err = new Error('Seu usuário está desativado no sistema. Entre em contato com o suporte.');
        err.code = 'USER_INACTIVE';
        throw err;
    }

    // Se não for superadmin, verificar se a empresa do usuário está suspensa
    if (user.role !== 'superadmin' && user.companyIsActive === false) {
        const err = new Error('A empresa vinculada a esta conta está suspensa. Entre em contato com a administração.');
        err.code = 'COMPANY_SUSPENDED';
        throw err;
    }

    // Se a senha ainda estava em formato legado (AES ou puro), atualiza em background para scrypt seguro
    if (user.password && !user.password.startsWith('scrypt:')) {
        const db = getDatabase();
        const newHash = await hashPassword(normalizedPassword);
        db.query('UPDATE users SET password = $1 WHERE id = $2', [newHash, user.id]).catch(err => {
            console.error('Erro ao atualizar hash de senha legada:', err);
        });
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

/**
 * Deletar usuário
 */
async function deleteUser(userId) {
    const db = getDatabase();

    const res = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = res.rows[0];
    if (!user) {
        throw new Error('Usuário não encontrado');
    }

    if (user.id === 'admin_default' && user.role === 'superadmin') {
        throw new Error('Não é permitido excluir a conta do Superadministrador Master da plataforma.');
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM notifications WHERE "userId" = $1', [userId]);
        await client.query('DELETE FROM bots WHERE "userId" = $1', [userId]);
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
        await client.query('COMMIT');
        try {
            const BotManagerService = require('./BotManagerService');
            BotManagerService.disconnectUserSockets(userId);
        } catch (_) {}
        return true;
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Erro ao deletar usuário em cascata:', e);
        throw e;
    } finally {
        client.release();
    }
}

module.exports = {
    createUser,
    findUserByEmail,
    findUserById,
    updateUser,
    listUsers,
    authenticateUser,
    deleteUser
};

