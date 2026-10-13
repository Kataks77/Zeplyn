const { getDatabase } = require('./DatabaseService');
const BotManagerService = require('./BotManagerService');
const ContactService = require('./ContactService');

class AppointmentService {
    constructor() {
        this.io = null;
        this.isCronRunning = false;
        this.cronInterval = null;
    }

    setIo(io) {
        this.io = io;
    }

    getIo() {
        if (!this.io) {
            try {
                const { getIo } = require('./SocketService');
                this.io = getIo();
            } catch (e) {}
        }
        return this.io;
    }

    async init() {
        const db = getDatabase();
        if (!db) return;

        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS appointments (
                    id TEXT PRIMARY KEY,
                    "botId" TEXT NOT NULL,
                    "companyId" TEXT DEFAULT 'company_default',
                    "contactJid" TEXT NOT NULL,
                    "contactName" TEXT,
                    "contactPhone" TEXT,
                    title TEXT NOT NULL,
                    service TEXT,
                    "attendantId" TEXT,
                    "attendantName" TEXT,
                    "scheduledAt" TEXT NOT NULL,
                    "durationMinutes" INTEGER DEFAULT 30,
                    status TEXT NOT NULL DEFAULT 'pending',
                    "reminder24hSent" BOOLEAN DEFAULT FALSE,
                    "reminder2hSent" BOOLEAN DEFAULT FALSE,
                    "confirmedAt" TEXT,
                    notes TEXT,
                    "createdAt" TEXT NOT NULL,
                    "updatedAt" TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON appointments("companyId", "scheduledAt");
                CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments("botId", "contactJid");
                CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
            `);

            this.startReminderCron();
            console.log('✅ [AppointmentService] Módulo de agendamentos e lembretes inicializado.');
        } catch (err) {
            console.error('❌ [AppointmentService] Erro ao inicializar tabela:', err.message);
        }
    }

    /**
     * Lista agendamentos com filtros por data, status e busca
     */
    async getAppointments(companyId, filters = {}) {
        const db = getDatabase();
        if (!db) return [];

        try {
            let query = `
                SELECT a.*, 
                       b.name as "botName",
                       u.name as "userAttendantName",
                       u.email as "attendantEmail"
                FROM appointments a
                LEFT JOIN bots b ON a."botId" = b.id
                LEFT JOIN users u ON a."attendantId" = u.id
                WHERE 1=1
            `;
            const params = [];
            let paramIdx = 1;

            if (companyId && companyId !== 'all') {
                query += ` AND a."companyId" = $${paramIdx}`;
                params.push(companyId);
                paramIdx++;
            }

            if (filters.startDate) {
                query += ` AND a."scheduledAt" >= $${paramIdx}`;
                params.push(filters.startDate);
                paramIdx++;
            }

            if (filters.endDate) {
                query += ` AND a."scheduledAt" <= $${paramIdx}`;
                params.push(filters.endDate);
                paramIdx++;
            }

            if (filters.status && filters.status !== 'all') {
                query += ` AND a.status = $${paramIdx}`;
                params.push(filters.status);
                paramIdx++;
            }

            if (filters.attendantId && filters.attendantId !== 'all') {
                query += ` AND a."attendantId" = $${paramIdx}`;
                params.push(filters.attendantId);
                paramIdx++;
            }

            if (filters.botId && filters.botId !== 'all') {
                query += ` AND a."botId" = $${paramIdx}`;
                params.push(filters.botId);
                paramIdx++;
            }

            if (filters.contactJid) {
                query += ` AND a."contactJid" = $${paramIdx}`;
                params.push(filters.contactJid);
                paramIdx++;
            }

            if (filters.search) {
                query += ` AND (a."contactName" ILIKE $${paramIdx} OR a."contactPhone" ILIKE $${paramIdx} OR a.title ILIKE $${paramIdx} OR a.service ILIKE $${paramIdx})`;
                params.push(`%${filters.search.trim()}%`);
                paramIdx++;
            }

            query += ` ORDER BY a."scheduledAt" ASC`;

            const res = await db.query(query, params);
            return res.rows.map(row => ({
                ...row,
                attendantName: row.userAttendantName || row.attendantName || 'Não atribuído'
            }));
        } catch (error) {
            console.error('❌ Erro no AppointmentService.getAppointments:', error);
            return [];
        }
    }

    async getAppointmentById(id) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const res = await db.query('SELECT * FROM appointments WHERE id = $1', [id]);
            return res.rows[0] || null;
        } catch (error) {
            console.error('❌ Erro no AppointmentService.getAppointmentById:', error);
            return null;
        }
    }

    /**
     * Cria um novo agendamento
     */
    async createAppointment(data) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const now = new Date().toISOString();
            const id = `apt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            let canonicalJid = data.contactJid;

            if (canonicalJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(canonicalJid);
                if (resolved) canonicalJid = resolved;
            }

            const phone = data.contactPhone || canonicalJid.split('@')[0];
            const duration = parseInt(data.durationMinutes, 10) || 30;
            const status = data.status || 'pending';
            const scheduledAt = new Date(data.scheduledAt).toISOString();

            const res = await db.query(`
                INSERT INTO appointments (
                    id, "botId", "companyId", "contactJid", "contactName", "contactPhone",
                    title, service, "attendantId", "attendantName", "scheduledAt",
                    "durationMinutes", status, notes, "createdAt", "updatedAt"
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15
                ) RETURNING *
            `, [
                id,
                data.botId,
                data.companyId || 'company_default',
                canonicalJid,
                data.contactName || 'Cliente',
                phone,
                data.title || 'Agendamento',
                data.service || data.title || 'Atendimento',
                data.attendantId || null,
                data.attendantName || null,
                scheduledAt,
                duration,
                status,
                data.notes || null,
                now
            ]);

            const created = res.rows[0];

            // Envia mensagem imediata de confirmação de agendamento via WhatsApp
            if (data.sendImmediateConfirmation !== false) {
                try {
                    await this.sendBookingConfirmationMessage(created);
                } catch (msgErr) {
                    console.warn('Aviso ao enviar confirmação de agendamento no WhatsApp:', msgErr.message);
                }
            }

            const io = this.getIo();
            if (io) {
                const companyId = created.companyId || 'company_default';
                io.to(`company_${companyId}`).emit('appointment-created', created);
                io.to('company_superadmin').emit('appointment-created', created);
            }

            return created;
        } catch (error) {
            console.error('❌ Erro no AppointmentService.createAppointment:', error);
            throw error;
        }
    }

    /**
     * Atualiza um agendamento existente
     */
    async updateAppointment(id, data) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const current = await this.getAppointmentById(id);
            if (!current) return null;

            const now = new Date().toISOString();
            const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt).toISOString() : current.scheduledAt;
            const duration = data.durationMinutes !== undefined ? parseInt(data.durationMinutes, 10) : current.durationMinutes;
            const status = data.status || current.status;
            const confirmedAt = status === 'confirmed' ? (current.confirmedAt || now) : null;

            // Se mudou a data do agendamento, reseta os sinalizadores de lembrete
            const dateChanged = data.scheduledAt && scheduledAt !== current.scheduledAt;
            const reminder24h = dateChanged ? false : (data.reminder24hSent !== undefined ? data.reminder24hSent : current.reminder24hSent);
            const reminder2h = dateChanged ? false : (data.reminder2hSent !== undefined ? data.reminder2hSent : current.reminder2hSent);

            const res = await db.query(`
                UPDATE appointments SET
                    title = COALESCE($1, title),
                    service = COALESCE($2, service),
                    "attendantId" = $3,
                    "attendantName" = $4,
                    "scheduledAt" = $5,
                    "durationMinutes" = $6,
                    status = $7,
                    "confirmedAt" = $8,
                    "reminder24hSent" = $9,
                    "reminder2hSent" = $10,
                    notes = $11,
                    "updatedAt" = $12
                WHERE id = $13
                RETURNING *
            `, [
                data.title || current.title,
                data.service || current.service,
                data.attendantId !== undefined ? data.attendantId : current.attendantId,
                data.attendantName !== undefined ? data.attendantName : current.attendantName,
                scheduledAt,
                duration,
                status,
                confirmedAt,
                reminder24h,
                reminder2h,
                data.notes !== undefined ? data.notes : current.notes,
                now,
                id
            ]);

            const updated = res.rows[0];

            // Se a data mudou e requested aviso, notificar cliente do reagendamento
            if (dateChanged && data.notifyClientOnReschedule) {
                try {
                    await this.sendRescheduledNotification(updated);
                } catch (e) {}
            }

            const io = this.getIo();
            if (io) {
                const companyId = updated.companyId || 'company_default';
                io.to(`company_${companyId}`).emit('appointment-updated', updated);
                io.to('company_superadmin').emit('appointment-updated', updated);
            }

            return updated;
        } catch (error) {
            console.error('❌ Erro no AppointmentService.updateAppointment:', error);
            throw error;
        }
    }

    async deleteAppointment(id) {
        const db = getDatabase();
        if (!db) return false;

        try {
            const current = await this.getAppointmentById(id);
            await db.query('DELETE FROM appointments WHERE id = $1', [id]);
            const io = this.getIo();
            if (io) {
                const companyId = current?.companyId || 'company_default';
                io.to(`company_${companyId}`).emit('appointment-deleted', { id });
                io.to('company_superadmin').emit('appointment-deleted', { id });
            }
            return true;
        } catch (error) {
            console.error('❌ Erro no AppointmentService.deleteAppointment:', error);
            return false;
        }
    }

    /**
     * Envia mensagem inicial confirmando que a data foi marcada
     */
    async sendBookingConfirmationMessage(apt) {
        const botInstance = BotManagerService.getConnectedBotInstance(apt.botId, apt.companyId);
        if (!botInstance) return;

        const dateObj = new Date(apt.scheduledAt);
        const dateFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const professional = apt.attendantName || botInstance.config?.name || 'Nossa Equipe';
        const service = apt.service || apt.title || 'Atendimento';

        const msgText = `📅 *Agendamento Confirmado!*\n\nOlá *${apt.contactName || 'Cliente'}*, seu horário foi marcado com sucesso!\n\n📋 *Serviço:* ${service}\n🗓️ *Data:* ${dateFormatted}\n⏰ *Horário:* ${timeFormatted}\n👨‍⚕️ *Profissional:* ${professional}\n\nEnviaremos um lembrete próximo ao dia. Caso precise remarcar, basta nos responder por aqui! ✨`;

        await botInstance.sendMessage(apt.contactJid, msgText);

        try {
            const HistoryService = require('./HistoryService');
            await HistoryService.saveMessage(apt.botId, apt.contactJid, 'assistant', msgText, `apt_conf_${Date.now()}`, professional);
        } catch (e) {}
    }

    /**
     * Envia lembrete interativo anti-falta (Pergunta 1 para Confirmar ou 2 para Reagendar)
     */
    async sendReminder(appointmentId, reminderType = 'manual') {
        const apt = await this.getAppointmentById(appointmentId);
        if (!apt) throw new Error('Agendamento não encontrado');

        const botInstance = BotManagerService.getConnectedBotInstance(apt.botId, apt.companyId);
        if (!botInstance) throw new Error('Nenhum bot do WhatsApp conectado para enviar o lembrete.');

        const dateObj = new Date(apt.scheduledAt);
        const dateFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
        const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const professional = apt.attendantName || botInstance.config?.name || 'Nossa Equipe';
        const service = apt.service || apt.title || 'Consulta';

        const intro = reminderType === '2h' 
            ? '⏰ *Seu compromisso é daqui a pouco!*'
            : '🔔 *Lembrete de Agendamento*';

        const msgText = `${intro}\n\nOlá *${apt.contactName || 'Cliente'}*, passando para confirmar seu horário:\n\n📋 *Procedimento:* ${service}\n🗓️ *Data:* ${dateFormatted}\n⏰ *Horário:* ${timeFormatted}\n👨‍⚕️ *Profissional:* ${professional}\n\nPor gentileza, confirme sua presença:\n👉 Digite *1* para *Confirmar Presença*\n👉 Digite *2* para *Solicitar Reagendamento*`;

        await botInstance.sendMessage(apt.contactJid, msgText);

        const db = getDatabase();
        const now = new Date().toISOString();
        const updates = { updatedAt: now };

        if (reminderType === '24h') updates.reminder24hSent = true;
        if (reminderType === '2h') updates.reminder2hSent = true;

        await db.query(`
            UPDATE appointments 
            SET "reminder24hSent" = COALESCE($1, "reminder24hSent"),
                "reminder2hSent" = COALESCE($2, "reminder2hSent"),
                "updatedAt" = $3
            WHERE id = $4
        `, [
            reminderType === '24h' ? true : null,
            reminderType === '2h' ? true : null,
            now,
            apt.id
        ]);

        try {
            const HistoryService = require('./HistoryService');
            await HistoryService.saveMessage(apt.botId, apt.contactJid, 'assistant', msgText, `apt_rem_${Date.now()}`, professional);
        } catch (e) {}

        const io = this.getIo();
        if (io) {
            io.emit('appointment-updated', { ...apt, ...updates });
        }

        return true;
    }

    /**
     * Notificação ao cliente quando o horário foi alterado
     */
    async sendRescheduledNotification(apt) {
        const botInstance = BotManagerService.getConnectedBotInstance(apt.botId, apt.companyId);
        if (!botInstance) return;

        const dateObj = new Date(apt.scheduledAt);
        const dateFormatted = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const msgText = `🔄 *Seu agendamento foi atualizado!*\n\nOlá *${apt.contactName || 'Cliente'}*, seu horário para *${apt.service || apt.title}* foi remarcado:\n\n🗓️ *Nova Data:* ${dateFormatted}\n⏰ *Novo Horário:* ${timeFormatted}\n\nCaso tenha alguma dúvida, basta nos responder por aqui!`;

        await botInstance.sendMessage(apt.contactJid, msgText);
    }

    /**
     * Intercepta respostas no WhatsApp ("1" para confirmar, "2" para reagendar)
     */
    async handleClientIncomingReply(botId, senderJid, text) {
        if (!text || typeof text !== 'string') return { handled: false };
        const cleanText = text.trim().toLowerCase();

        // Aceita "1", "confirmo", "confirmar", "sim", "confirmado", "ok"
        const isConfirm = cleanText === '1' || cleanText === 'confirmo' || cleanText === 'confirmar' || cleanText === 'confirmado' || cleanText === 'sim' || cleanText === 'vou comparecer';
        // Aceita "2", "reagendar", "cancelar", "remarcar", "não posso", "nao posso"
        const isReschedule = cleanText === '2' || cleanText === 'reagendar' || cleanText === 'remarcar' || cleanText === 'cancelar' || cleanText === 'não posso' || cleanText === 'nao posso';

        if (!isConfirm && !isReschedule) {
            return { handled: false };
        }

        const db = getDatabase();
        if (!db) return { handled: false };

        try {
            let canonicalJid = senderJid;
            let alternateJid = null;

            if (senderJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(senderJid);
                if (resolved) { canonicalJid = resolved; alternateJid = senderJid; }
            } else if (senderJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(senderJid);
                if (resolvedLid) alternateJid = resolvedLid;
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Busca agendamentos futuros ou do dia com status 'pending'
            const now = new Date();
            const pastHour = new Date(now.getTime() - (2 * 60 * 60 * 1000)).toISOString();

            const res = await db.query(`
                SELECT * FROM appointments
                WHERE "botId" = $1 AND "contactJid" = ANY($2)
                  AND "scheduledAt" >= $3
                  AND status = 'pending'
                ORDER BY "scheduledAt" ASC LIMIT 1
            `, [botId, jidList, pastHour]);

            if (res.rows.length === 0) {
                return { handled: false };
            }

            const apt = res.rows[0];
            const botInstance = BotManagerService.getConnectedBotInstance(botId, apt.companyId);
            const nowIso = new Date().toISOString();

            const dateObj = new Date(apt.scheduledAt);
            const dateFormatted = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const timeFormatted = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            if (isConfirm) {
                await db.query(`
                    UPDATE appointments
                    SET status = 'confirmed', "confirmedAt" = $1, "updatedAt" = $1
                    WHERE id = $2
                `, [nowIso, apt.id]);

                const confirmMsg = `✅ *Presença Confirmada!*\n\nMuito obrigado, *${apt.contactName || 'Cliente'}*! Seu horário para o dia *${dateFormatted} às ${timeFormatted}* está 100% confirmado. Te aguardamos!`;

                if (botInstance) {
                    await botInstance.sendMessage(apt.contactJid, confirmMsg);
                }

                // Registra nota interna no chat
                try {
                    const HistoryService = require('./HistoryService');
                    await HistoryService.saveMessage(
                        botId, 
                        apt.contactJid, 
                        'system', 
                        `🟢 [Agenda Automática] Cliente confirmou presença para ${dateFormatted} às ${timeFormatted}.`, 
                        `sys_apt_${Date.now()}`, 
                        'Sistema'
                    );
                } catch (e) {}

                const io = this.getIo();
                if (io) {
                    io.emit('appointment-confirmed', { ...apt, status: 'confirmed', confirmedAt: nowIso });
                    io.emit('appointment-updated', { ...apt, status: 'confirmed', confirmedAt: nowIso });
                }

                return { handled: true, action: 'confirmed', appointment: apt };
            }

            if (isReschedule) {
                await db.query(`
                    UPDATE appointments
                    SET status = 'rescheduled', "updatedAt" = $1
                    WHERE id = $2
                `, [nowIso, apt.id]);

                const rescheduleMsg = `🗓️ *Solicitação de Reagendamento Recebida!*\n\nSem problemas, *${apt.contactName || 'Cliente'}*! Registramos seu pedido. Nossa equipe entrará em contato em breve para escolher um novo horário para você.`;

                if (botInstance) {
                    await botInstance.sendMessage(apt.contactJid, rescheduleMsg);
                }

                // Notifica atendentes no chat
                try {
                    const HistoryService = require('./HistoryService');
                    await HistoryService.saveMessage(
                        botId, 
                        apt.contactJid, 
                        'system', 
                        `⚠️ [Agenda] Cliente solicitou reagendamento da consulta de ${dateFormatted} às ${timeFormatted}.`, 
                        `sys_apt_resched_${Date.now()}`, 
                        'Sistema'
                    );
                } catch (e) {}

                const io = this.getIo();
                if (io) {
                    io.emit('appointment-rescheduled', { ...apt, status: 'rescheduled' });
                    io.emit('appointment-updated', { ...apt, status: 'rescheduled' });
                }

                return { handled: true, action: 'rescheduled', appointment: apt };
            }

            return { handled: false };
        } catch (err) {
            console.error('❌ Erro no AppointmentService.handleClientIncomingReply:', err);
            return { handled: false };
        }
    }

    /**
     * Cron automático que roda a cada 2 minutos checando lembretes de 24h e 2h
     */
    startReminderCron() {
        if (this.isCronRunning) return;
        this.isCronRunning = true;

        this.cronInterval = setInterval(async () => {
            await this.processPendingReminders();
        }, 120000); // 2 minutos

        // Executa uma vez logo após iniciar
        setTimeout(() => this.processPendingReminders(), 10000);
    }

    async processPendingReminders() {
        const db = getDatabase();
        if (!db) return;

        try {
            const now = new Date();
            const nowIso = now.toISOString();

            // 1. Lembretes de 24 horas: agendamentos entre agora e as próximas 24h
            const in24h = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString();
            const res24h = await db.query(`
                SELECT id FROM appointments
                WHERE status = 'pending'
                  AND "reminder24hSent" = FALSE
                  AND "scheduledAt" > $1
                  AND "scheduledAt" <= $2
                LIMIT 20
            `, [nowIso, in24h]);

            for (const row of res24h.rows) {
                try {
                    await this.sendReminder(row.id, '24h');
                    console.log(`⏰ [AppointmentService] Lembrete 24h enviado para agendamento ${row.id}`);
                } catch (err) {
                    console.warn(`Aviso ao enviar lembrete 24h para ${row.id}:`, err.message);
                }
            }

            // 2. Lembretes de 2 horas: agendamentos entre agora e as próximas 2h
            const in2h = new Date(now.getTime() + (2 * 60 * 60 * 1000)).toISOString();
            const res2h = await db.query(`
                SELECT id FROM appointments
                WHERE status IN ('pending', 'confirmed')
                  AND "reminder2hSent" = FALSE
                  AND "scheduledAt" > $1
                  AND "scheduledAt" <= $2
                LIMIT 20
            `, [nowIso, in2h]);

            for (const row of res2h.rows) {
                try {
                    await this.sendReminder(row.id, '2h');
                    console.log(`⏰ [AppointmentService] Lembrete 2h enviado para agendamento ${row.id}`);
                } catch (err) {
                    console.warn(`Aviso ao enviar lembrete 2h para ${row.id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('❌ Erro no AppointmentService.processPendingReminders:', err.message);
        }
    }
}

module.exports = new AppointmentService();
