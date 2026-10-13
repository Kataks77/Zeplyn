const ProductService = require('../services/ProductService');

class ProductController {
    constructor() {
        this.list = this.list.bind(this);
        this.getById = this.getById.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
        this.toggleStatus = this.toggleStatus.bind(this);
        this.getCategories = this.getCategories.bind(this);
    }

    async list(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            let companyId;
            if (isSuperAdmin) {
                // Se o superadmin passou 'all', lista todos sem restrição de empresa
                if (req.query.companyId === 'all') {
                    companyId = null;
                } else {
                    companyId = req.query.companyId || null;
                }
            } else {
                // Usuários regulares / administradores de empresa são estritamente isolados em sua empresa
                companyId = userCompanyId;
            }

            const products = await ProductService.list(companyId, req.query);
            res.json({ success: true, products });
        } catch (error) {
            console.error('Erro em ProductController.list:', error);
            res.status(500).json({ error: error.message || 'Erro ao listar produtos' });
        }
    }

    async getById(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            const product = await ProductService.getById(req.params.id);
            if (!product) {
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            // Proteção Multi-Tenant contra IDOR
            if (!isSuperAdmin && product.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este produto pertence a outra empresa.' });
            }

            res.json({ success: true, product });
        } catch (error) {
            console.error('Erro em ProductController.getById:', error);
            res.status(500).json({ error: error.message || 'Erro ao obter dados do produto' });
        }
    }

    async create(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            // O produto deve SEMPRE ser vinculado a uma empresa
            const targetCompanyId = (isSuperAdmin && req.body.companyId) 
                ? req.body.companyId 
                : userCompanyId;

            if (!targetCompanyId) {
                return res.status(400).json({ error: 'É obrigatório selecionar a empresa para vincular o produto.' });
            }

            const product = await ProductService.create(req.body, targetCompanyId);
            res.status(201).json({ success: true, product });
        } catch (error) {
            console.error('Erro em ProductController.create:', error);
            res.status(400).json({ error: error.message || 'Erro ao cadastrar produto' });
        }
    }

    async update(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            const current = await ProductService.getById(req.params.id);
            if (!current) {
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            // Proteção Multi-Tenant contra IDOR
            if (!isSuperAdmin && current.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este produto pertence a outra empresa.' });
            }

            const updated = await ProductService.update(
                req.params.id, 
                req.body, 
                isSuperAdmin ? null : userCompanyId
            );
            res.json({ success: true, product: updated });
        } catch (error) {
            console.error('Erro em ProductController.update:', error);
            res.status(400).json({ error: error.message || 'Erro ao atualizar produto' });
        }
    }

    async delete(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            const current = await ProductService.getById(req.params.id);
            if (!current) {
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            // Proteção Multi-Tenant contra IDOR
            if (!isSuperAdmin && current.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este produto pertence a outra empresa.' });
            }

            const ok = await ProductService.delete(req.params.id, isSuperAdmin ? null : userCompanyId);
            if (!ok) {
                return res.status(404).json({ error: 'Produto não encontrado ou não pôde ser excluído.' });
            }

            res.json({ success: true, message: 'Produto excluído com sucesso.' });
        } catch (error) {
            console.error('Erro em ProductController.delete:', error);
            res.status(500).json({ error: error.message || 'Erro ao remover produto' });
        }
    }

    async toggleStatus(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            const current = await ProductService.getById(req.params.id);
            if (!current) {
                return res.status(404).json({ error: 'Produto não encontrado.' });
            }

            if (!isSuperAdmin && current.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este produto pertence a outra empresa.' });
            }

            const updated = await ProductService.toggleStatus(req.params.id, isSuperAdmin ? null : userCompanyId);
            res.json({ success: true, product: updated });
        } catch (error) {
            console.error('Erro em ProductController.toggleStatus:', error);
            res.status(500).json({ error: error.message || 'Erro ao alterar status do produto' });
        }
    }

    async getCategories(req, res) {
        try {
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';
            const companyId = isSuperAdmin ? (req.query.companyId || null) : userCompanyId;

            const categories = await ProductService.getCategories(companyId);
            res.json({ success: true, categories });
        } catch (error) {
            console.error('Erro em ProductController.getCategories:', error);
            res.status(500).json({ error: error.message || 'Erro ao obter categorias de produtos' });
        }
    }
}

module.exports = new ProductController();
