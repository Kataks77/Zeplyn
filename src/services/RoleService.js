const { getDatabase } = require('./DatabaseService');

class RoleService {
    async listRoles(companyId = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            let sql = `
                SELECT r.*, COUNT(u.id) as "userCount"
                FROM company_roles r
                LEFT JOIN users u ON u."jobRoleId" = r.id
                WHERE 1=1
            `;
            const params = [];
            if (companyId) {
                params.push(companyId);
                sql += ` AND (r."companyId" = $${params.length} OR r."companyId" IS NULL)`;
            }

            sql += ` GROUP BY r.id ORDER BY r."createdAt" DESC`;

            const res = await db.query(sql, params);
            return res.rows.map(row => ({
                ...row,
                userCount: parseInt(row.userCount, 10) || 0
            }));
        } catch (error) {
            console.error('❌ Erro no RoleService.listRoles:', error);
            return [];
        }
    }

    async listDepartments(companyId = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            const params = [];
            let companyClauseRoles = '';
            let companyClauseUsers = '';

            if (companyId) {
                params.push(companyId);
                companyClauseRoles = `WHERE (r."companyId" = $1 OR r."companyId" IS NULL)`;
                companyClauseUsers = `WHERE (u."companyId" = $1 OR u."companyId" IS NULL)`;
            }

            const sql = `
                WITH all_depts AS (
                    SELECT DISTINCT TRIM(department) as department
                    FROM (
                        SELECT department FROM company_roles r ${companyClauseRoles}
                        UNION
                        SELECT department FROM users u ${companyClauseUsers}
                    ) sub
                    WHERE department IS NOT NULL AND TRIM(department) != ''
                )
                SELECT 
                    d.department as name,
                    COUNT(DISTINCT u.id) as "attendantCount"
                FROM all_depts d
                LEFT JOIN users u ON LOWER(TRIM(u.department)) = LOWER(d.department) 
                     AND u."isActive" = TRUE 
                     ${companyId ? `AND (u."companyId" = $1 OR u."companyId" IS NULL)` : ''}
                GROUP BY d.department
                ORDER BY d.department ASC
            `;

            const res = await db.query(sql, params);
            return res.rows.map(r => ({
                name: r.name,
                attendantCount: parseInt(r.attendantCount, 10) || 0
            }));
        } catch (error) {
            console.error('❌ Erro no RoleService.listDepartments:', error);
            return [];
        }
    }

    async getRole(id) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const res = await db.query('SELECT * FROM company_roles WHERE id = $1', [id]);
            return res.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro no RoleService.getRole:', error);
            return null;
        }
    }

    async createRole(data, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        const { name, department = 'Geral', description = '', color = '#3b82f6' } = data;
        if (!name || !name.trim()) {
            throw new Error('O nome do cargo é obrigatório');
        }

        const id = `role_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();

        const res = await db.query(`
            INSERT INTO company_roles (id, "companyId", name, department, description, color, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [id, companyId, name.trim(), department.trim(), description.trim(), color, now, now]);

        return res.rows[0];
    }

    async updateRole(id, data) {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');

        const { name, department = 'Geral', description = '', color = '#3b82f6' } = data;
        const now = new Date().toISOString();

        const res = await db.query(`
            UPDATE company_roles 
            SET name = $1, department = $2, description = $3, color = $4, "updatedAt" = $5
            WHERE id = $6
            RETURNING *
        `, [name.trim(), department.trim(), description.trim(), color, now, id]);

        if (res.rows.length === 0) throw new Error('Cargo não encontrado');

        // Atualizar também o jobRoleName nos usuários que possuem este cargo
        await db.query(`
            UPDATE users 
            SET "jobRoleName" = $1, "department" = $2 
            WHERE "jobRoleId" = $3
        `, [name.trim(), department.trim(), id]);

        return res.rows[0];
    }

    async deleteRole(id) {
        const db = getDatabase();
        if (!db) return false;

        try {
            // Desassocia os usuários do cargo
            await db.query('UPDATE users SET "jobRoleId" = NULL, "jobRoleName" = NULL WHERE "jobRoleId" = $1', [id]);
            await db.query('DELETE FROM company_roles WHERE id = $1', [id]);
            return true;
        } catch (error) {
            console.error('❌ Erro no RoleService.deleteRole:', error);
            throw error;
        }
    }
}

module.exports = new RoleService();
