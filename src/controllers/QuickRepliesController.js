const QuickRepliesService = require('../services/QuickRepliesService');

class QuickRepliesController {
    constructor() {
        this.list = this.list.bind(this);
        this.getById = this.getById.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
        this.preview = this.preview.bind(this);
    }

    async list(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const { search, category } = req.query;
            const items = await QuickRepliesService.list(companyId, search, category);
            res.json({ success: true, quickReplies: items });
        } catch (error) {
            console.error('Erro QuickRepliesController.list:', error);
            res.status(500).json({ error: error.message || 'Erro ao listar respostas rápidas' });
        }
    }

    async getById(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const item = await QuickRepliesService.getById(req.params.id, companyId);
            if (!item) return res.status(404).json({ error: 'Resposta rápida não encontrada' });
            res.json({ success: true, quickReply: item });
        } catch (error) {
            console.error('Erro QuickRepliesController.getById:', error);
            res.status(500).json({ error: error.message || 'Erro ao obter resposta rápida' });
        }
    }

    async create(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const userId = req.user?.id || null;
            const created = await QuickRepliesService.create(req.body, companyId, userId);
            res.status(201).json({ success: true, quickReply: created });
        } catch (error) {
            console.error('Erro QuickRepliesController.create:', error);
            res.status(400).json({ error: error.message || 'Erro ao criar resposta rápida' });
        }
    }

    async update(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const updated = await QuickRepliesService.update(req.params.id, req.body, companyId);
            res.json({ success: true, quickReply: updated });
        } catch (error) {
            console.error('Erro QuickRepliesController.update:', error);
            res.status(400).json({ error: error.message || 'Erro ao atualizar resposta rápida' });
        }
    }

    async delete(req, res) {
        try {
            const companyId = req.user?.companyId || 'company_default';
            const deleted = await QuickRepliesService.delete(req.params.id, companyId);
            if (!deleted) return res.status(404).json({ error: 'Resposta rápida não encontrada ou permissão negada' });
            res.json({ success: true, message: 'Resposta rápida removida com sucesso' });
        } catch (error) {
            console.error('Erro QuickRepliesController.delete:', error);
            res.status(500).json({ error: error.message || 'Erro ao excluir resposta rápida' });
        }
    }

    async preview(req, res) {
        try {
            const { message, contactName, attendantName, companyName, protocol } = req.body;
            const parsed = QuickRepliesService.replaceVariables(message, {
                contactName,
                attendantName: attendantName || req.user?.name,
                companyName,
                protocol
            });
            res.json({ success: true, parsed });
        } catch (error) {
            console.error('Erro QuickRepliesController.preview:', error);
            res.status(500).json({ error: 'Erro ao gerar prévia' });
        }
    }
}

module.exports = new QuickRepliesController();
