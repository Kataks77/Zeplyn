const { getDatabase } = require('./DatabaseService');
const BotManagerService = require('./BotManagerService');

class RoundRobinService {
    constructor() {
        this.lastAssignedIndexByDept = new Map();
    }

    getIo() {
        return BotManagerService.io;
    }

    /**
     * Distribui automaticamente um atendimento para o próximo operador disponível
     */
    async distributeChat(botId, contactJid, department = null) {
        const db = getDatabase();
        if (!db) return null;

        try {
            // Obter bot e empresa
            const botRes = await db.query('SELECT "companyId" FROM bots WHERE id = $1', [botId]);
            const companyId = botRes.rows[0]?.companyId || 'company_default';

            // Buscar operadores ativos e disponíveis para atendimento da empresa
            let usersRes = await db.query(`
                SELECT u.id, u.name, u.email, u.department, u."jobRoleName", u."isAvailable" 
                FROM users u
                WHERE (u."companyId" = $1 OR u."companyId" IS NULL) 
                  AND u."isActive" = TRUE 
                  AND COALESCE(u."isAvailable", TRUE) = TRUE
                  AND u.role IN ('admin', 'operator')
                ORDER BY u.name ASC
            `, [companyId]);

            let eligibleOperators = usersRes.rows;
            if (eligibleOperators.length === 0) {
                console.log(`ℹ️ [RoundRobin] Nenhum operador ativo/disponível no momento para a empresa ${companyId}. Mantendo na fila geral.`);
                return null;
            }

            // Se houver departamento especificado (ex: "Vendas", "Suporte", "Financeiro")
            if (department && String(department).trim()) {
                const cleanDept = String(department).trim().toLowerCase();
                const deptFiltered = eligibleOperators.filter(op => {
                    const opDept = (op.department || '').toLowerCase();
                    const opRole = (op.jobRoleName || '').toLowerCase();
                    return opDept.includes(cleanDept) || opRole.includes(cleanDept);
                });

                if (deptFiltered.length > 0) {
                    eligibleOperators = deptFiltered;
                    console.log(`🎯 [RoundRobin] Filtrado para o departamento "${department}": ${eligibleOperators.length} operadores.`);
                } else {
                    // Transbordo / Fallback Inteligente ativado!
                    console.log(`⚠️ [RoundRobin] Nenhum operador ativo no setor "${department}". Executando transbordo de fila inteligente...`);

                    // Buscar configuração de transbordo do bot
                    try {
                        const BotService = require('./BotService');
                        const bot = await BotService.getBot(botId);
                        const fallbackCfg = bot?.flowData?.menuConfig?.fallbackConfig || {};
                        const fallbackEnabled = fallbackCfg.enabled !== false;

                        if (fallbackEnabled) {
                            const rawMsg = fallbackCfg.message || 'Nossos consultores do setor *{{setor}}* não estão disponíveis no momento. Estamos transferindo você para a nossa equipe de plantão! 🧑‍💻';
                            const fallbackMsg = rawMsg.replace(/{{setor}}/gi, department).replace(/{setor}/gi, department);

                            const botInstance = await BotManagerService.getBotInstance(botId);
                            if (botInstance && botInstance.isConnected) {
                                await botInstance.sendMessage(contactJid, fallbackMsg, null, "Sistema URA");
                            }

                            // Registra nota interna no atendimento
                            const HistoryService = require('./HistoryService');
                            const noteId = `note_fallback_${Date.now()}`;
                            const noteText = `🛡️ [Transbordo Inteligente] Cliente solicitou o setor "${department}", mas nenhum operador estava disponível. Atendimento transferido automaticamente para a Fila Geral de Plantão.`;
                            await HistoryService.saveMessage(botId, contactJid, 'internal_note', noteText, noteId, 'Sistema URA');
                        }
                    } catch (fbErr) {
                        console.error('❌ Erro ao processar mensagem de transbordo inteligente:', fbErr);
                    }
                }
            }

            // Seleção Equitativa (Menor carga de chats em andamento)
            const loadsRes = await db.query(`
                SELECT "attendantId", COUNT(*) as count 
                FROM chats 
                WHERE "botId" = $1 AND status = 'attending' 
                GROUP BY "attendantId"
            `, [botId]);

            const loadMap = new Map();
            for (const row of loadsRes.rows) {
                if (row.attendantId) {
                    loadMap.set(row.attendantId, parseInt(row.count, 10));
                }
            }

            // Ordena os operadores do que tem MENOS chats para o que tem MAIS
            eligibleOperators.sort((a, b) => {
                const loadA = loadMap.get(a.id) || 0;
                const loadB = loadMap.get(b.id) || 0;
                return loadA - loadB;
            });

            const selectedOperator = eligibleOperators[0];

            console.log(`🔄 [RoundRobin] Chat ${contactJid} atribuído automaticamente ao operador ${selectedOperator.name} (${selectedOperator.jobRoleName || 'Atendente'})`);

            // Capturar atendimento para este operador
            const ChatService = require('./ChatService');
            const updatedChat = await ChatService.captureChat(botId, contactJid, selectedOperator.id, selectedOperator.name);

            const io = this.getIo();
            if (io && updatedChat) {
                let companyId = 'company_default';
                try {
                    const BotService = require('./BotService');
                    const bot = await BotService.getBot(botId);
                    if (bot?.companyId) companyId = bot.companyId;
                } catch (_) {}
                const payload = {
                    chat: updatedChat,
                    operator: selectedOperator,
                    department: department || null
                };
                io.to(`company_${companyId}`).emit('chat:round-robin-assigned', payload);
                io.to('company_superadmin').emit('chat:round-robin-assigned', payload);
            }

            return {
                distributed: true,
                operator: selectedOperator,
                chat: updatedChat
            };
        } catch (error) {
            console.error('❌ Erro no RoundRobinService.distributeChat:', error);
            return null;
        }
    }

    /**
     * Retorna métricas da fila de espera em tempo real
     */
    async getQueueStats(botId = null, companyId = null) {
        const db = getDatabase();
        if (!db) return { waitingCount: 0, avgWaitMinutes: 0, activeOperatorsCount: 0, roundRobinEnabled: true };

        try {
            let whereClause = `WHERE (status = 'waiting' OR ("needsHuman" = TRUE AND status != 'attending' AND status != 'finished'))`;
            const params = [];
            if (botId && botId !== 'all') {
                params.push(botId);
                whereClause += ` AND "botId" = $${params.length}`;
            }

            const waitingRes = await db.query(`
                SELECT id, "contactJid", "updatedAt", "createdAt" 
                FROM chats 
                ${whereClause}
                ORDER BY "updatedAt" ASC
            `, params);

            // Desduplica contatos únicos na fila por telefone para contagem 100% fidedigna
            const uniqueWaitingRows = [];
            const seenWaiting = new Set();
            for (const row of waitingRes.rows) {
                const clean = (row.contactJid || '').split('@')[0].replace(/\D/g, '');
                const key = clean.length >= 8 ? clean.slice(-8) : (row.contactJid || row.id);
                if (!seenWaiting.has(key)) {
                    seenWaiting.add(key);
                    uniqueWaitingRows.push(row);
                }
            }

            const waitingCount = uniqueWaitingRows.length;
            let avgWaitMinutes = 0;

            if (waitingCount > 0) {
                const now = Date.now();
                const totalWaitMs = uniqueWaitingRows.reduce((acc, row) => {
                    const time = new Date(row.updatedAt || row.createdAt).getTime();
                    return acc + Math.max(0, now - time);
                }, 0);
                avgWaitMinutes = Math.round((totalWaitMs / waitingCount) / (60 * 1000));
            }

            // Operadores ativos
            let opSql = `
                SELECT COUNT(*) as count 
                FROM users 
                WHERE "isActive" = TRUE AND role IN ('admin', 'operator')
            `;
            const opParams = [];
            if (companyId) {
                opParams.push(companyId);
                opSql += ` AND ("companyId" = $1 OR "companyId" IS NULL)`;
            }

            const opRes = await db.query(opSql, opParams);
            const activeOperatorsCount = parseInt(opRes.rows[0]?.count, 10) || 0;

            return {
                waitingCount,
                avgWaitMinutes,
                activeOperatorsCount,
                roundRobinEnabled: true
            };
        } catch (error) {
            console.error('❌ Erro no RoundRobinService.getQueueStats:', error);
            return { waitingCount: 0, avgWaitMinutes: 0, activeOperatorsCount: 0, roundRobinEnabled: true };
        }
    }
}

module.exports = new RoundRobinService();
