const CompanyService = require('../services/CompanyService');

class CompanyController {
    async list(req, res) {
        try {
            if (req.user.role !== 'superadmin') {
                return res.status(403).json({ error: 'Apenas o Superadministrador da plataforma pode listar empresas.' });
            }
            const companies = await CompanyService.listCompanies();
            res.json(companies);
        } catch (error) {
            console.error('Erro CompanyController.list:', error);
            res.status(500).json({ error: 'Erro ao listar empresas: ' + error.message });
        }
    }

    async getById(req, res) {
        try {
            const { companyId } = req.params;
            if (req.user.role !== 'superadmin' && req.user.companyId !== companyId) {
                return res.status(403).json({ error: 'Acesso negado aos dados desta empresa.' });
            }
            const company = await CompanyService.getCompanyById(companyId);
            if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
            res.json(company);
        } catch (error) {
            console.error('Erro CompanyController.getById:', error);
            res.status(500).json({ error: 'Erro ao obter empresa: ' + error.message });
        }
    }

    async getDetails(req, res) {
        try {
            const { companyId } = req.params;
            if (req.user.role !== 'superadmin' && req.user.companyId !== companyId) {
                return res.status(403).json({ error: 'Acesso negado aos detalhes desta empresa.' });
            }
            const details = await CompanyService.getCompanyDetails(companyId);
            if (!details) return res.status(404).json({ error: 'Empresa não encontrada' });
            res.json(details);
        } catch (error) {
            console.error('Erro CompanyController.getDetails:', error);
            res.status(500).json({ error: 'Erro ao obter detalhes da empresa: ' + error.message });
        }
    }

    async create(req, res) {
        try {
            if (req.user.role !== 'superadmin') {
                return res.status(403).json({ error: 'Apenas o Superadministrador pode criar novas empresas.' });
            }
            const newCompany = await CompanyService.createCompany(req.body);
            res.status(201).json({ success: true, company: newCompany });
        } catch (error) {
            console.error('Erro CompanyController.create:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            const { companyId } = req.params;
            if (req.user.role !== 'superadmin') {
                return res.status(403).json({ error: 'Apenas o Superadministrador pode editar configurações da empresa.' });
            }
            const updated = await CompanyService.updateCompany(companyId, req.body);
            res.json({ success: true, company: updated });
        } catch (error) {
            console.error('Erro CompanyController.update:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async delete(req, res) {
        try {
            const { companyId } = req.params;
            if (req.user.role !== 'superadmin') {
                return res.status(403).json({ error: 'Apenas o Superadministrador pode excluir empresas.' });
            }
            if (companyId === 'company_default') {
                return res.status(400).json({ error: 'A empresa principal do sistema não pode ser excluída.' });
            }
            await CompanyService.deleteCompany(companyId);
            res.json({ success: true, message: 'Empresa excluída com sucesso.' });
        } catch (error) {
            console.error('Erro CompanyController.delete:', error);
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new CompanyController();
