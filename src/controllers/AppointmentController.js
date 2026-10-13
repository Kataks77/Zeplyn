const AppointmentService = require('../services/AppointmentService');

class AppointmentController {
    constructor() {
        this.list = this.list.bind(this);
        this.getById = this.getById.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
        this.sendReminder = this.sendReminder.bind(this);
    }

    async list(req, res) {
        try {
            const companyId = req.user?.role === 'superadmin' && req.query.companyId ? req.query.companyId : (req.user?.companyId || 'company_default');
            const appointments = await AppointmentService.getAppointments(companyId, req.query);
            res.json({ success: true, appointments });
        } catch (error) {
            console.error('Erro em AppointmentController.list:', error);
            res.status(500).json({ error: 'Erro ao listar agendamentos' });
        }
    }

    async getById(req, res) {
        try {
            const appointment = await AppointmentService.getAppointmentById(req.params.id);
            if (!appointment) {
                return res.status(404).json({ error: 'Agendamento não encontrado' });
            }

            // Validação Multi-Tenant (Proteção contra IDOR)
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';
            if (!isSuperAdmin && appointment.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este agendamento pertence a outra empresa.' });
            }

            res.json({ success: true, appointment });
        } catch (error) {
            console.error('Erro em AppointmentController.getById:', error);
            res.status(500).json({ error: 'Erro ao obter agendamento' });
        }
    }

    async create(req, res) {
        try {
            const { botId, contactJid, scheduledAt, title } = req.body;
            if (!botId || !contactJid || !scheduledAt || !title) {
                return res.status(400).json({ error: 'Campos obrigatórios: botId, contactJid, scheduledAt e title.' });
            }

            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';

            if (!isSuperAdmin) {
                const BotService = require('../services/BotService');
                const bot = await BotService.getBot(botId);
                if (!bot || (bot.companyId || 'company_default') !== userCompanyId) {
                    return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                }
            }

            const companyId = userCompanyId;
            const appointment = await AppointmentService.createAppointment({
                ...req.body,
                companyId
            });

            res.status(201).json({ success: true, appointment });
        } catch (error) {
            console.error('Erro em AppointmentController.create:', error);
            res.status(500).json({ error: error.message || 'Erro ao criar agendamento' });
        }
    }

    async update(req, res) {
        try {
            const current = await AppointmentService.getAppointmentById(req.params.id);
            if (!current) {
                return res.status(404).json({ error: 'Agendamento não encontrado' });
            }

            // Validação Multi-Tenant (Proteção contra IDOR)
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';
            if (!isSuperAdmin && current.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este agendamento pertence a outra empresa.' });
            }

            const appointment = await AppointmentService.updateAppointment(req.params.id, req.body);
            res.json({ success: true, appointment });
        } catch (error) {
            console.error('Erro em AppointmentController.update:', error);
            res.status(500).json({ error: error.message || 'Erro ao atualizar agendamento' });
        }
    }

    async delete(req, res) {
        try {
            const current = await AppointmentService.getAppointmentById(req.params.id);
            if (!current) {
                return res.status(404).json({ error: 'Agendamento não encontrado ou não pôde ser excluído' });
            }

            // Validação Multi-Tenant (Proteção contra IDOR)
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';
            if (!isSuperAdmin && current.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este agendamento pertence a outra empresa.' });
            }

            const ok = await AppointmentService.deleteAppointment(req.params.id);
            res.json({ success: true, message: 'Agendamento excluído com sucesso' });
        } catch (error) {
            console.error('Erro em AppointmentController.delete:', error);
            res.status(500).json({ error: 'Erro ao excluir agendamento' });
        }
    }

    async sendReminder(req, res) {
        try {
            const current = await AppointmentService.getAppointmentById(req.params.id);
            if (!current) {
                return res.status(404).json({ error: 'Agendamento não encontrado' });
            }

            // Validação Multi-Tenant (Proteção contra IDOR)
            const isSuperAdmin = req.user?.role === 'superadmin';
            const userCompanyId = req.user?.companyId || 'company_default';
            if (!isSuperAdmin && current.companyId !== userCompanyId) {
                return res.status(403).json({ error: 'Acesso negado: Este agendamento pertence a outra empresa.' });
            }

            await AppointmentService.sendReminder(req.params.id, req.body.type || 'manual');
            res.json({ success: true, message: 'Lembrete enviado com sucesso via WhatsApp' });
        } catch (error) {
            console.error('Erro em AppointmentController.sendReminder:', error);
            res.status(500).json({ error: error.message || 'Erro ao enviar lembrete' });
        }
    }
}

module.exports = new AppointmentController();

