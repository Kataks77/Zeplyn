const RoleService = require('../services/RoleService');

class RoleController {
    constructor() {
        this.listRoles = this.listRoles.bind(this);
        this.listDepartments = this.listDepartments.bind(this);
        this.getRole = this.getRole.bind(this);
        this.createRole = this.createRole.bind(this);
        this.updateRole = this.updateRole.bind(this);
        this.deleteRole = this.deleteRole.bind(this);
    }

    async listRoles(req, res) {
        try {
            let companyId = null;
            if (req.user && req.user.role === 'superadmin') {
                companyId = req.query.companyId || null;
            } else if (req.user) {
                companyId = req.user.companyId || 'company_default';
            }
            const roles = await RoleService.listRoles(companyId);
            res.json({ success: true, roles });
        } catch (error) {
            console.error('Erro RoleController.listRoles:', error);
            res.status(500).json({ error: 'Erro ao listar cargos' });
        }
    }

    async listDepartments(req, res) {
        try {
            let companyId = null;
            if (req.user && req.user.role === 'superadmin') {
                companyId = req.query.companyId || null;
            } else if (req.user) {
                companyId = req.user.companyId || 'company_default';
            }
            const departments = await RoleService.listDepartments(companyId);
            res.json({ success: true, departments });
        } catch (error) {
            console.error('Erro RoleController.listDepartments:', error);
            res.status(500).json({ error: 'Erro ao listar departamentos da empresa' });
        }
    }

    async checkTenantRole(req, roleId) {
        if (!roleId) return false;
        if (req.user?.role === 'superadmin') return true;
        const role = await RoleService.getRole(roleId);
        if (!role) return false;
        const userCompanyId = req.user?.companyId || 'company_default';
        const roleCompanyId = role.companyId || 'company_default';
        return roleCompanyId === userCompanyId;
    }

    async getRole(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantRole(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Este cargo pertence a outra empresa.' });
            }

            const role = await RoleService.getRole(id);
            if (!role) return res.status(404).json({ error: 'Cargo não encontrado' });
            res.json({ success: true, role });
        } catch (error) {
            console.error('Erro RoleController.getRole:', error);
            res.status(500).json({ error: 'Erro ao obter cargo' });
        }
    }

    async createRole(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const role = await RoleService.createRole(req.body, companyId);
            res.status(201).json({ success: true, role });
        } catch (error) {
            console.error('Erro RoleController.createRole:', error);
            res.status(400).json({ error: error.message || 'Erro ao criar cargo' });
        }
    }

    async updateRole(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantRole(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Este cargo pertence a outra empresa.' });
            }

            const role = await RoleService.updateRole(id, req.body);
            res.json({ success: true, role });
        } catch (error) {
            console.error('Erro RoleController.updateRole:', error);
            res.status(400).json({ error: error.message || 'Erro ao atualizar cargo' });
        }
    }

    async deleteRole(req, res) {
        try {
            const { id } = req.params;
            if (!(await this.checkTenantRole(req, id))) {
                return res.status(403).json({ error: 'Acesso negado: Este cargo pertence a outra empresa.' });
            }

            await RoleService.deleteRole(id);
            res.json({ success: true, message: 'Cargo removido com sucesso' });
        } catch (error) {
            console.error('Erro RoleController.deleteRole:', error);
            res.status(500).json({ error: 'Erro ao remover cargo' });
        }
    }
}

module.exports = new RoleController();
