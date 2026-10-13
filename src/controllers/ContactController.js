const ContactService = require('../services/ContactService');

class ContactController {
    constructor() {
        this.listContacts = this.listContacts.bind(this);
        this.createContact = this.createContact.bind(this);
        this.deleteContact = this.deleteContact.bind(this);
        this.syncFromChats = this.syncFromChats.bind(this);
        this.importArray = this.importArray.bind(this);
        this.clearContacts = this.clearContacts.bind(this);
        this.syncProfilePictures = this.syncProfilePictures.bind(this);
        this.refreshContactPhoto = this.refreshContactPhoto.bind(this);
    }

    async checkTenantBot(req, botId) {
        if (!botId || botId === 'all') return true;
        if (req.user?.role === 'superadmin') return true;
        const BotService = require('../services/BotService');
        const bot = await BotService.getBot(botId);
        if (!bot) return false;
        const userCompanyId = req.user?.companyId || 'company_default';
        const botCompanyId = bot.companyId || 'company_default';
        return botCompanyId === userCompanyId;
    }

    async listContacts(req, res) {
        try {
            const { botId } = req.query;
            let companyId = null;
            if (req.user.role === 'superadmin') {
                companyId = req.query.companyId || null;
            } else {
                companyId = req.user.companyId || 'company_default';
            }

            if (botId && botId !== 'all') {
                if (!(await this.checkTenantBot(req, botId))) {
                    return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                }
            }

            const contacts = await ContactService.listContacts(botId, companyId);
            res.json({ success: true, contacts });
        } catch (error) {
            console.error('Erro ContactController.listContacts:', error);
            res.status(500).json({ error: 'Erro ao listar contatos' });
        }
    }

    async createContact(req, res) {
        try {
            const { botId, name, phoneNumber } = req.body;
            if (!botId || !name || !phoneNumber) {
                return res.status(400).json({ error: 'Parâmetros botId, name e phoneNumber são obrigatórios' });
            }

            if (!(await this.checkTenantBot(req, botId))) {
                return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
            }

            let profilePicUrl = null;
            try {
                const BotManagerService = require('../services/BotManagerService');
                const botInstance = BotManagerService.activeBots.get(botId);
                if (botInstance && botInstance.sock && botInstance.isConnected) {
                    const cleanPhone = phoneNumber.replace(/\D/g, '');
                    const jid = `${cleanPhone}@s.whatsapp.net`;
                    profilePicUrl = await botInstance.sock.profilePictureUrl(jid, 'image').catch(() => null);
                }
            } catch (e) {}

            const contact = await ContactService.createOrUpdateContact(botId, name, phoneNumber, null, profilePicUrl);
            res.json({ success: true, contact });
        } catch (error) {
            console.error('Erro ContactController.createContact:', error);
            res.status(500).json({ error: 'Erro ao criar contato' });
        }
    }

    async deleteContact(req, res) {
        try {
            const { botId, id } = req.body;
            if (!botId || !id) {
                return res.status(400).json({ error: 'Parâmetros botId e id são obrigatórios' });
            }

            if (!(await this.checkTenantBot(req, botId))) {
                return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
            }

            const success = await ContactService.deleteContact(botId, id);
            res.json({ success });
        } catch (error) {
            console.error('Erro ContactController.deleteContact:', error);
            res.status(500).json({ error: 'Erro ao deletar contato' });
        }
    }

    async syncFromChats(req, res) {
        try {
            const { botId } = req.body;
            if (!botId) {
                return res.status(400).json({ error: 'Parâmetro botId é obrigatório' });
            }

            if (!(await this.checkTenantBot(req, botId))) {
                return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
            }

            const count = await ContactService.syncFromChats(botId);
            res.json({ success: true, count });
        } catch (error) {
            console.error('Erro ContactController.syncFromChats:', error);
            res.status(500).json({ error: 'Erro ao sincronizar contatos' });
        }
    }

    async importArray(req, res) {
        try {
            const { botId, contacts } = req.body;
            if (!botId || !Array.isArray(contacts)) {
                return res.status(400).json({ error: 'Parâmetros botId e contacts (array) são obrigatórios' });
            }

            if (!(await this.checkTenantBot(req, botId))) {
                return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
            }

            let importedCount = 0;
            const { sanitizePhoneNumber } = require('../utils/helpers');
            for (const item of contacts) {
                if (item.name && item.phoneNumber) {
                    const { cleanNumber, isValid } = sanitizePhoneNumber(item.phoneNumber);
                    const finalPhone = isValid && cleanNumber ? cleanNumber : String(item.phoneNumber).replace(/\D/g, '');
                    const contact = await ContactService.createOrUpdateContact(botId, item.name, finalPhone);
                    if (contact) importedCount++;
                }
            }

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CONTACTS_IMPORT',
                    description: `Importou ${importedCount} contato(s) para o robô`,
                    category: 'contacts',
                    details: { botId, count: importedCount }
                });
            } catch (_) {}

            res.json({ success: true, count: importedCount });
        } catch (error) {
            console.error('Erro ContactController.importArray:', error);
            res.status(500).json({ error: 'Erro ao importar contatos' });
        }
    }

    async clearContacts(req, res) {
        try {
            const { botId } = req.body;
            if (!botId) {
                return res.status(400).json({ error: 'Parâmetro botId é obrigatório' });
            }

            if (!(await this.checkTenantBot(req, botId))) {
                return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
            }

            const success = await ContactService.deleteContactsByBotId(botId);

            try {
                const AuditService = require('../services/AuditService');
                AuditService.logRequest(req, {
                    action: 'CONTACTS_CLEAR',
                    description: `Limpou/desvinculou a lista de contatos do robô`,
                    category: 'contacts',
                    details: { botId }
                });
            } catch (_) {}

            res.json({ success });
        } catch (error) {
            console.error('Erro ContactController.clearContacts:', error);
            res.status(500).json({ error: 'Erro ao desvincular contatos' });
        }
    }

    async syncProfilePictures(req, res) {
        try {
            const { botId, limit } = req.body || {};
            const userCompanyId = req.user?.role === 'superadmin' ? null : (req.user?.companyId || 'company_default');
            
            if (botId && botId !== 'all') {
                if (!(await this.checkTenantBot(req, botId))) {
                    return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                }
            }

            const result = await ContactService.syncProfilePictures(botId, limit || 150, userCompanyId);
            res.json(result);
        } catch (error) {
            console.error('Erro ContactController.syncProfilePictures:', error);
            res.status(500).json({ error: 'Erro ao sincronizar fotos dos contatos: ' + error.message });
        }
    }

    async refreshContactPhoto(req, res) {
        try {
            const { contactId, botId } = req.body || {};
            if (!contactId) return res.status(400).json({ error: 'contactId é obrigatório' });
            const userCompanyId = req.user?.role === 'superadmin' ? null : (req.user?.companyId || 'company_default');
            
            const result = await ContactService.refreshContactPhoto(contactId, botId, userCompanyId);
            res.json(result);
        } catch (error) {
            console.error('Erro ContactController.refreshContactPhoto:', error);
            res.status(500).json({ error: 'Erro ao atualizar foto do contato: ' + error.message });
        }
    }
}

module.exports = new ContactController();
