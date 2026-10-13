const { getSetting, setSetting, getDatabase } = require('./DatabaseService');

const DEFAULT_HOURS = {
    enabled: true,
    timezone: 'America/Sao_Paulo',
    monday: { label: "Segunda-feira", enabled: true, start: "08:00", end: "18:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
    tuesday: { label: "Terça-feira", enabled: true, start: "08:00", end: "18:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
    wednesday: { label: "Quarta-feira", enabled: true, start: "08:00", end: "18:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
    thursday: { label: "Quinta-feira", enabled: true, start: "08:00", end: "18:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
    friday: { label: "Sexta-feira", enabled: true, start: "08:00", end: "18:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
    saturday: { label: "Sábado", enabled: false, start: "08:00", end: "12:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
    sunday: { label: "Domingo", enabled: false, start: "00:00", end: "00:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" }
};

const DEFAULT_OUT_OF_OFFICE_MSG = "Olá *{nome}*, no momento estamos fora do nosso horário de atendimento.\nNosso expediente é de segunda a sexta, das 08:00 às 18:00. Deixe sua mensagem e retornaremos assim que iniciarmos o expediente!";
const DEFAULT_HOLIDAY_MSG = "Olá *{nome}*! Hoje estamos em recesso de feriado (*{feriado}*). 🎉\nRetornaremos nossas atividades no próximo dia útil. Sua mensagem foi registrada com sucesso!";

class BusinessHoursService {
    /**
     * Obtém as configurações de horário de atendimento, templates e feriados da empresa
     */
    async getSettings(companyId = 'company_default') {
        const hoursRaw = await getSetting(`businessHours_${companyId}`) || await getSetting('businessHours');
        const enabledSetting = await getSetting(`businessHoursEnabled_${companyId}`);
        const fallbackEnabledSetting = await getSetting('businessHoursEnabled');
        const timezoneSetting = await getSetting(`businessHoursTimezone_${companyId}`) || await getSetting('businessHoursTimezone');
        const outOfOfficeTemplate = await getSetting(`outOfOfficeTemplate_${companyId}`) || await getSetting('outOfOfficeMessageTemplate', DEFAULT_OUT_OF_OFFICE_MSG);
        const holidayTemplate = await getSetting(`holidayTemplate_${companyId}`) || await getSetting('holidayMessageTemplate', DEFAULT_HOLIDAY_MSG);

        let hours = { ...DEFAULT_HOURS };
        let parsed = null;
        if (hoursRaw) {
            try {
                parsed = JSON.parse(hoursRaw);
                hours = { ...DEFAULT_HOURS, ...parsed };
                // Garantir dias da semana caso venha de formato legado simples
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                for (const d of days) {
                    if (!hours[d] || typeof hours[d] !== 'object') {
                        hours[d] = {
                            label: DEFAULT_HOURS[d]?.label || d,
                            enabled: parsed.enabled !== undefined ? parsed.enabled : (d !== 'sunday'),
                            start: parsed.start || "08:00",
                            end: parsed.end || "18:00",
                            hasLunchBreak: false,
                            lunchStart: "12:00",
                            lunchEnd: "13:00"
                        };
                    }
                }
            } catch (e) {
                console.error('Erro ao fazer parse de businessHours:', e);
            }
        }

        // Determinar se está habilitado com prioridade para a flag explícita
        let isEnabled = true;
        if (enabledSetting !== null && enabledSetting !== undefined) {
            isEnabled = enabledSetting === 'true' || enabledSetting === true;
        } else if (fallbackEnabledSetting !== null && fallbackEnabledSetting !== undefined) {
            isEnabled = fallbackEnabledSetting === 'true' || fallbackEnabledSetting === true;
        } else if (parsed && parsed.enabled !== undefined) {
            isEnabled = parsed.enabled === true || parsed.enabled === 'true';
        } else if (hours.enabled !== undefined) {
            isEnabled = hours.enabled === true || hours.enabled === 'true';
        }

        const timezone = timezoneSetting || (parsed && parsed.timezone) || hours.timezone || 'America/Sao_Paulo';

        hours.enabled = isEnabled;
        hours.timezone = timezone;

        const holidays = await this.listHolidays(companyId);

        return {
            enabled: isEnabled,
            timezone,
            hours,
            outOfOfficeTemplate,
            holidayTemplate,
            holidays
        };
    }

    /**
     * Salva as configurações de horário de atendimento e mensagens
     */
    async saveSettings(payload, companyId = 'company_default') {
        const { enabled, timezone, hours, outOfOfficeTemplate, holidayTemplate, holidays } = payload || {};

        let isEnabled = true;
        if (enabled !== undefined) {
            isEnabled = enabled === true || enabled === 'true';
        } else if (hours && hours.enabled !== undefined) {
            isEnabled = hours.enabled === true || hours.enabled === 'true';
        }

        const tz = timezone || (hours && hours.timezone) || 'America/Sao_Paulo';

        let hoursToSave = {};
        if (hours && typeof hours === 'object') {
            hoursToSave = { ...hours };
        }
        hoursToSave.enabled = isEnabled;
        hoursToSave.timezone = tz;

        await setSetting(`businessHours_${companyId}`, JSON.stringify(hoursToSave));
        await setSetting(`businessHoursEnabled_${companyId}`, String(isEnabled));
        await setSetting(`businessHoursTimezone_${companyId}`, tz);

        if (companyId === 'company_default') {
            await setSetting('businessHours', JSON.stringify(hoursToSave));
            await setSetting('businessHoursEnabled', String(isEnabled));
            await setSetting('businessHoursTimezone', tz);
        }

        if (outOfOfficeTemplate !== undefined) {
            await setSetting(`outOfOfficeTemplate_${companyId}`, outOfOfficeTemplate);
            if (companyId === 'company_default') {
                await setSetting('outOfOfficeMessageTemplate', outOfOfficeTemplate);
            }
        }

        if (holidayTemplate !== undefined) {
            await setSetting(`holidayTemplate_${companyId}`, holidayTemplate);
            if (companyId === 'company_default') {
                await setSetting('holidayMessageTemplate', holidayTemplate);
            }
        }

        if (Array.isArray(holidays)) {
            await this.syncHolidays(holidays, companyId);
        }

        return true;
    }

    /**
     * Lista todos os feriados cadastrados para a empresa
     */
    async listHolidays(companyId = 'company_default') {
        const db = getDatabase();
        if (!db) return [];
        try {
            const res = await db.query(
                'SELECT id, "companyId", name, date, message, "createdAt" FROM company_holidays WHERE "companyId" = $1 ORDER BY date ASC',
                [companyId]
            );
            return res.rows || [];
        } catch (e) {
            console.error('Erro ao listar feriados:', e);
            return [];
        }
    }

    /**
     * Cadastra um novo feriado
     */
    async addHoliday({ name, date, message }, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');
        const now = new Date().toISOString();
        const res = await db.query(
            'INSERT INTO company_holidays ("companyId", name, date, message, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [companyId, name.trim(), date.trim(), message ? message.trim() : null, now, now]
        );
        return res.rows[0];
    }

    /**
     * Deleta um feriado
     */
    async deleteHoliday(id, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) throw new Error('Banco de dados indisponível');
        await db.query('DELETE FROM company_holidays WHERE id = $1 AND "companyId" = $2', [id, companyId]);
        return true;
    }

    /**
     * Sincroniza a lista completa de feriados
     */
    async syncHolidays(holidaysList, companyId = 'company_default') {
        const db = getDatabase();
        if (!db) return;
        try {
            await db.query('DELETE FROM company_holidays WHERE "companyId" = $1', [companyId]);
            const now = new Date().toISOString();
            for (const h of holidaysList) {
                if (h.name && h.date) {
                    await db.query(
                        'INSERT INTO company_holidays ("companyId", name, date, message, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6)',
                        [companyId, h.name.trim(), h.date.trim(), h.message ? h.message.trim() : null, now, now]
                    );
                }
            }
        } catch (e) {
            console.error('Erro ao sincronizar feriados:', e);
        }
    }

    /**
     * Retorna a data e hora no fuso horário configurado
     */
    getCurrentTime(timezone = 'America/Sao_Paulo') {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('pt-BR', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            const parts = formatter.formatToParts(now);
            const getPart = type => parts.find(p => p.type === type)?.value;

            const year = getPart('year');
            const month = getPart('month');
            const day = getPart('day');
            let hour = parseInt(getPart('hour'), 10);
            if (hour === 24) hour = 0; // Ajuste para retorno de 24h à meia-noite
            const minute = parseInt(getPart('minute'), 10);

            // Obter dia da semana no fuso
            const dayOfWeekIdx = new Date(`${year}-${month}-${day}T12:00:00Z`).getUTCDay();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayName = days[dayOfWeekIdx];
            const dateStr = `${year}-${month}-${day}`;

            return {
                year,
                month,
                day,
                hour,
                minute,
                timeMinutes: hour * 60 + minute,
                dayName,
                dateStr
            };
        } catch (e) {
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            let h = now.getHours();
            let m = now.getMinutes();
            return {
                hour: h,
                minute: m,
                timeMinutes: h * 60 + m,
                dayName: days[now.getDay()],
                dateStr: now.toISOString().slice(0, 10)
            };
        }
    }

    /**
     * Verifica se o momento atual está fora do expediente comercial ou em feriado
     */
    async isOutsideBusinessHours(companyId = 'company_default') {
        try {
            const settings = await this.getSettings(companyId);
            const { enabled, hours, outOfOfficeTemplate, holidayTemplate, holidays } = settings;

            // Se o controle de expediente estiver desativado globalmente, está sempre dentro do expediente
            if (enabled === false || hours?.enabled === false) {
                return { isOutside: false };
            }

            const current = this.getCurrentTime(settings.timezone || hours?.timezone || 'America/Sao_Paulo');

            // 1. Verificar se hoje coincide com algum Feriado cadastrado
            const todayHoliday = (holidays || []).find(h => h.date === current.dateStr);
            if (todayHoliday) {
                return {
                    isOutside: true,
                    reason: 'holiday',
                    holidayName: todayHoliday.name,
                    template: todayHoliday.message || holidayTemplate || DEFAULT_HOLIDAY_MSG
                };
            }

            // 2. Verificar regras do dia da semana
            const dayConfig = hours[current.dayName];
            if (!dayConfig || !dayConfig.enabled) {
                return {
                    isOutside: true,
                    reason: 'day_off',
                    dayName: current.dayName,
                    template: outOfOfficeTemplate || DEFAULT_OUT_OF_OFFICE_MSG
                };
            }

            // Converter horários de início e fim
            const startRaw = (dayConfig.start || "08:00").trim();
            const endRaw = (dayConfig.end || "18:00").trim();

            const [startH, startM] = startRaw.split(':').map(Number);
            const [endH, endM] = endRaw.split(':').map(Number);

            const startMinutes = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM);
            let endMinutes = (isNaN(endH) ? 18 : endH) * 60 + (isNaN(endM) ? 0 : endM);

            // Ajuste crucial para "00:00" ou "24:00" como horário de término:
            // Em formulários e relógios 24h, o fechamento às 00:00 ou 24:00 representa o final do dia (meia-noite = 1440 min)
            if (endRaw === '00:00' || endRaw === '24:00' || (endH === 0 && endM === 0 && (startH > 0 || startM > 0))) {
                endMinutes = 24 * 60; // 1440 minutos
            }

            // Se configurado 24 horas abertas (ex: 00:00 às 00:00 ou 00:00 às 23:59 ou 00:00 às 24:00)
            const is24Hours = (startMinutes === 0 && (endMinutes === 0 || endMinutes >= 1439));
            if (is24Hours) {
                return { isOutside: false };
            }

            // 3. Verificar intervalo de almoço
            if (dayConfig.hasLunchBreak && dayConfig.lunchStart && dayConfig.lunchEnd) {
                const [lStartH, lStartM] = dayConfig.lunchStart.split(':').map(Number);
                const [lEndH, lEndM] = dayConfig.lunchEnd.split(':').map(Number);
                const lunchStartMinutes = (isNaN(lStartH) ? 12 : lStartH) * 60 + (isNaN(lStartM) ? 0 : lStartM);
                const lunchEndMinutes = (isNaN(lEndH) ? 13 : lEndH) * 60 + (isNaN(lEndM) ? 0 : lEndM);

                if (current.timeMinutes >= lunchStartMinutes && current.timeMinutes < lunchEndMinutes) {
                    return {
                        isOutside: true,
                        reason: 'lunch',
                        template: outOfOfficeTemplate || DEFAULT_OUT_OF_OFFICE_MSG
                    };
                }
            }

            // 4. Verificar se o horário atual está dentro do expediente
            let isInside = false;
            if (startMinutes < endMinutes) {
                // Horário normal diurno (ex: 08:00 às 18:00, ou 08:00 às 00:00 -> 480 a 1440)
                isInside = current.timeMinutes >= startMinutes && current.timeMinutes < endMinutes;
            } else if (startMinutes > endMinutes) {
                // Horário noturno que cruza a meia-noite (ex: 18:00 às 02:00)
                isInside = current.timeMinutes >= startMinutes || current.timeMinutes < endMinutes;
            } else {
                // startMinutes === endMinutes
                isInside = false;
            }

            if (!isInside) {
                return {
                    isOutside: true,
                    reason: 'outside_hours',
                    template: outOfOfficeTemplate || DEFAULT_OUT_OF_OFFICE_MSG
                };
            }

            return { isOutside: false };
        } catch (e) {
            console.error('Erro no BusinessHoursService.isOutsideBusinessHours:', e);
            return { isOutside: false };
        }
    }
}

module.exports = new BusinessHoursService();
