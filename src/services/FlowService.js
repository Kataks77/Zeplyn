const http = require('http');
const https = require('https');
const dns = require('dns');
const BotService = require('./BotService');
const ChatService = require('./ChatService');
const HistoryService = require('./HistoryService');
const { logger } = require('../utils/logger');

function isPrivateIp(ip) {
    if (!ip || typeof ip !== 'string') return true;

    let cleanIp = ip.trim().toLowerCase();
    if (cleanIp.startsWith('::ffff:')) {
        cleanIp = cleanIp.substring(7);
    }

    // IPv4
    const parts = cleanIp.split('.').map(p => parseInt(p, 10));
    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
        if (parts[0] === 0) return true; // 0.0.0.0/8
        if (parts[0] === 10) return true; // 10.0.0.0/8
        if (parts[0] === 127) return true; // 127.0.0.0/8 (Loopback)
        if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 (Link-local / Cloud metadata)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
        if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
        if (parts[0] >= 224) return true; // Multicast & Reservado (224.0.0.0+)
        return false;
    }

    // IPv6
    if (cleanIp === '::' || cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1' || cleanIp === '0:0:0:0:0:0:0:0') {
        return true;
    }
    if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
        return true; // Link-local fe80::/10
    }
    if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd')) {
        return true; // Unique local fc00::/7
    }

    return false;
}

class FlowService {
    constructor() {
        // Sessões ativas por chave: `${botId}:${contactJid}`
        // { currentNodeId, waitingForInput, context, lastActiveAt }
        this.sessions = new Map();
        
        // Limpar sessões inativas periodicamente (a cada 30 min) - unref para não prender o processo
        const cleanupInterval = setInterval(() => this.cleanupInactiveSessions(), 30 * 60 * 1000);
        if (cleanupInterval.unref) cleanupInterval.unref();

        // Verificar timeouts de inatividade e lembretes da URA (a cada 30 segundos) - unref para não prender o processo
        const timeoutsInterval = setInterval(() => this.checkUraInactivityTimeouts(), 30 * 1000);
        if (timeoutsInterval.unref) timeoutsInterval.unref();
    }

    getSessionKey(botId, contactJid) {
        return `${botId}:${contactJid}`;
    }

    getSession(botId, contactJid) {
        const key = this.getSessionKey(botId, contactJid);
        const session = this.sessions.get(key);
        if (!session) return null;
        
        // Se a sessão tiver mais de 12 horas sem interação, expira
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;
        if (Date.now() - session.lastActiveAt > TWELVE_HOURS) {
            this.sessions.delete(key);
            return null;
        }
        return session;
    }

    setSession(botId, contactJid, data) {
        const key = this.getSessionKey(botId, contactJid);
        this.sessions.set(key, {
            ...data,
            lastActiveAt: Date.now()
        });
    }

    resetSession(botId, contactJid) {
        const key = this.getSessionKey(botId, contactJid);
        this.sessions.delete(key);
    }

    cleanupInactiveSessions() {
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;
        const now = Date.now();
        for (const [key, session] of this.sessions.entries()) {
            if (now - session.lastActiveAt > TWELVE_HOURS) {
                this.sessions.delete(key);
            }
        }
    }

    /**
     * Verifica timeouts de inatividade no menu da URA e envia lembrete ou encerra
     */
    async checkUraInactivityTimeouts() {
        if (this.sessions.size === 0) return;
        const now = Date.now();
        const BotManagerService = require('./BotManagerService');

        for (const [key, session] of this.sessions.entries()) {
            if (!session.waitingForInput || !session.isMenu) continue;

            const [botId, contactJid] = key.split(':');
            if (!botId || !contactJid) continue;

            try {
                const bot = await BotService.getBot(botId);
                const timeoutCfg = bot?.flowData?.menuConfig?.timeoutConfig;
                if (!timeoutCfg || timeoutCfg.enabled === false) continue;

                const reminderMinutes = Math.max(1, parseInt(timeoutCfg.reminderMinutes, 10) || 5);
                const reminderMs = reminderMinutes * 60 * 1000;
                const menuSentAt = session.menuSentAt || session.lastActiveAt;
                const elapsedSinceMenu = now - menuSentAt;

                const botInstance = await BotManagerService.getBotInstance(botId);
                if (!botInstance || !botInstance.isConnected) continue;

                // 1. Enviar Lembrete de Inatividade
                if (!session.reminderSent && elapsedSinceMenu >= reminderMs) {
                    const clientName = session.variables?.nome || 'Cliente';
                    const rawReminder = timeoutCfg.reminderMessage || 'Olá, {{nome}}! Ainda está aí? 😊\nPor favor, digite o *número* da opção desejada acima para darmos continuidade ao seu atendimento.';
                    const reminderMsg = rawReminder.replace(/{{nome}}/gi, clientName).replace(/{nome}/gi, clientName);

                    await botInstance.sendMessage(contactJid, reminderMsg, null, "Bot URA");
                    session.reminderSent = true;
                    session.reminderSentAt = now;
                    session.lastActiveAt = now;
                    console.log(`⏰ [URA Timeout] Lembrete de inatividade enviado para ${contactJid} (Bot ${botId})`);
                    continue;
                }

                // 2. Encerrar Atendimento por Inatividade
                if (session.reminderSent && timeoutCfg.autoCloseEnabled !== false) {
                    const closeMinutes = Math.max(1, parseInt(timeoutCfg.closeMinutes, 10) || 15);
                    const closeMs = closeMinutes * 60 * 1000;
                    const elapsedSinceReminder = now - (session.reminderSentAt || now);

                    if (elapsedSinceReminder >= closeMs) {
                        const clientName = session.variables?.nome || 'Cliente';
                        const rawClose = timeoutCfg.closeMessage || 'Seu atendimento foi finalizado por inatividade. Quando precisar de algo, basta nos enviar uma nova mensagem! Tenha um excelente dia! 👋';
                        const closeMsg = rawClose.replace(/{{nome}}/gi, clientName).replace(/{nome}/gi, clientName);

                        await botInstance.sendMessage(contactJid, closeMsg, null, "Bot URA");
                        
                        // Finaliza no ChatService
                        await ChatService.finishChat(botId, contactJid, 'Sistema (Inatividade URA)');
                        this.resetSession(botId, contactJid);
                        console.log(`🚪 [URA Timeout] Sessão de ${contactJid} encerrada por inatividade (Bot ${botId})`);
                    }
                }
            } catch (err) {
                // Silencia erros individuais
            }
        }
    }

    /**
     * Verifica se o bot possui fluxo visual ativo
     */
    async hasActiveFlow(botId) {
        try {
            const bot = await BotService.getBot(botId);
            if (!bot || !bot.flowEnabled || !bot.flowData) return false;
            const nodes = bot.flowData.nodes || [];
            return nodes.length > 0;
        } catch (e) {
            logger.error(`[FlowService] Erro ao verificar fluxo do bot ${botId}:`, e);
            return false;
        }
    }

    /**
     * Helper para formatar variáveis no texto
     */
    interpolateVariables(text, variables = {}) {
        if (!text) return '';
        let result = String(text);
        for (const [key, val] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
            result = result.replace(regex, val || '');
        }
        return result;
    }

    /**
     * Processa a mensagem do cliente de acordo com o fluxo visual
     */
    async processMessage(botId, contactJid, senderName, incomingText, whatsappService, botConfig) {
        try {
            const bot = await BotService.getBot(botId);
            if (!bot || !bot.flowEnabled || !bot.flowData) return false;

            const { nodes = [], edges = [] } = bot.flowData;
            if (nodes.length === 0) return false;

            const cleanText = (incomingText || '').trim();
            const lowerText = cleanText.toLowerCase();

            // Comandos universais para reiniciar o fluxo
            const resetKeywords = ['inicio', 'início', 'comecar', 'começar', 'reiniciar', 'menu', 'voltar', '0'];
            let session = this.getSession(botId, contactJid);

            if (resetKeywords.includes(lowerText)) {
                this.resetSession(botId, contactJid);
                session = null;
            }

            const variables = {
                nome: senderName || 'Cliente',
                telefone: contactJid.split('@')[0],
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR'),
                ...(session?.variables || {})
            };

            // Se não tem sessão ativa, procura o nó de início
            if (!session) {
                const startNode = nodes.find(n => n.type === 'start') || nodes[0];
                if (!startNode) return false;

                // Executa a partir do nó start
                return await this.executeFromNode(startNode.id, botId, contactJid, senderName, cleanText, whatsappService, nodes, edges, variables, false);
            }

            // Se tem sessão e está aguardando input (ex: aguardando resposta do menu ou input de texto)
            const currentNode = nodes.find(n => n.id === session.currentNodeId);
            if (!currentNode) {
                this.resetSession(botId, contactJid);
                const startNode = nodes.find(n => n.type === 'start') || nodes[0];
                if (!startNode) return false;
                return await this.executeFromNode(startNode.id, botId, contactJid, senderName, cleanText, whatsappService, nodes, edges, variables, false);
            }

            // Tratamento de Nó Input (Coleta de Dados com Validação)
            if (currentNode.type === 'input') {
                const valType = currentNode.data?.validationType || 'none';
                let isValid = true;

                if (valType === 'email') {
                    isValid = cleanText.includes('@') && cleanText.includes('.');
                } else if (valType === 'phone') {
                    isValid = cleanText.replace(/\D/g, '').length >= 8;
                } else if (valType === 'cpf') {
                    isValid = cleanText.replace(/\D/g, '').length >= 11;
                } else if (valType === 'number') {
                    isValid = !isNaN(Number(cleanText.replace(/\D/g, '')));
                }

                if (!isValid) {
                    const invalidMsg = currentNode.data?.errorMessage || '❌ Formato inválido. Por favor, verifique e tente novamente:';
                    await whatsappService.sendMessage(contactJid, invalidMsg);
                    return true;
                }

                // Dado válido! Salva variável
                const varName = currentNode.data?.variableName || 'resposta';
                variables[varName] = cleanText;

                this.setSession(botId, contactJid, {
                    ...session,
                    variables
                });

                // Atualizar contato no banco se aplicável
                try {
                    const ContactService = require('./ContactService');
                    if (varName === 'nome' || varName === 'nome_cliente') {
                        await ContactService.createOrUpdateContact(botId, cleanText, contactJid.split('@')[0], contactJid);
                    }
                } catch (e) {
                    logger.warn('[FlowService] Aviso ao atualizar contato via input:', e.message);
                }

                const nextEdge = edges.find(e => e.source === currentNode.id);
                if (nextEdge && nextEdge.target) {
                    return await this.executeFromNode(nextEdge.target, botId, contactJid, senderName, cleanText, whatsappService, nodes, edges, variables, false);
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // Tratamento específico de nó Menu aguardando entrada
            if (currentNode.type === 'menu') {
                const options = currentNode.data?.options || [];
                let matchedIndex = -1;

                // 1. Tentar por número digitado (ex: "1", "1.", "opcao 1", "opção 2", "#1")
                const numMatch = cleanText.match(/^(?:op[cç][aã]o\s*|#)?(\d+)(?:[.\-)\s]|$)/i) || cleanText.match(/\b(\d+)\b/);
                if (numMatch) {
                    const num = parseInt(numMatch[1], 10);
                    if (!isNaN(num) && num >= 1 && num <= options.length) {
                        matchedIndex = num - 1;
                    }
                }

                // 2. Tentar por similaridade de texto com o título da opção se não casou pelo número
                if (matchedIndex === -1) {
                    matchedIndex = options.findIndex(opt => {
                        const optText = (opt.text || opt.label || '').toLowerCase().trim();
                        return optText && (lowerText.includes(optText) || optText.includes(lowerText));
                    });
                }

                if (matchedIndex >= 0) {
                    // Opção encontrada! Buscar a aresta correspondente
                    const targetOption = options[matchedIndex];
                    const targetHandleId = targetOption.id || `option-${matchedIndex}`;
                    
                    // Buscar edge que sai deste menu no handle correspondente
                    let edge = edges.find(e => e.source === currentNode.id && (e.sourceHandle === targetHandleId || e.sourceHandle === `option-${matchedIndex}`));
                    if (!edge) {
                        // Fallback: se não tiver sourceHandle específico, pega por ordem de index
                        const outgoingEdges = edges.filter(e => e.source === currentNode.id);
                        if (outgoingEdges[matchedIndex]) {
                            edge = outgoingEdges[matchedIndex];
                        }
                    }

                    if (edge && edge.target) {
                        // Avança para o próximo nó
                        return await this.executeFromNode(edge.target, botId, contactJid, senderName, cleanText, whatsappService, nodes, edges, variables, false);
                    } else {
                        // Opção válida mas não possui próximo bloco conectado
                        await whatsappService.sendMessage(contactJid, `Você selecionou: *${targetOption.text || targetOption.label}*.\n(Fim do fluxo desta opção). Digite *menu* para reiniciar.`);
                        this.resetSession(botId, contactJid);
                        return true;
                    }
                } else {
                    // Opção inválida digitada
                    const invalidMsg = currentNode.data?.invalidMessage || '❌ Opção inválida. Por favor, digite o *número* correspondente à opção desejada, ou digite *menu* para reiniciar.';
                    await whatsappService.sendMessage(contactJid, invalidMsg);
                    return true;
                }
            }

            if (currentNode.type === 'ai') {
                // Usuário continuou conversando no nó de IA
                const aiResponse = await whatsappService.processAI(cleanText, contactJid);
                if (aiResponse) {
                    await whatsappService.sendMessage(contactJid, aiResponse);
                }
                return true;
            }

            // Para outros nós ou nó genérico, avança para a próxima conexão
            const nextEdge = edges.find(e => e.source === currentNode.id);
            if (nextEdge && nextEdge.target) {
                return await this.executeFromNode(nextEdge.target, botId, contactJid, senderName, cleanText, whatsappService, nodes, edges, variables, false);
            }

            // Não há mais nós conectados
            return false;
        } catch (error) {
            logger.error(`[FlowService] Erro ao processar mensagem do fluxo:`, error);
            return false;
        }
    }

    /**
     * Executa a sequência a partir de um determinado nó (navegando nós não-bloqueantes em cadeia)
     */
    async executeFromNode(startNodeId, botId, contactJid, senderName, incomingText, whatsappService, nodes, edges, variables, skipSelfAction = false) {
        let currentId = startNodeId;
        const visited = new Set();

        while (currentId) {
            if (visited.has(currentId)) {
                logger.warn(`[FlowService] Loop detectado no fluxo do bot ${botId} no nó ${currentId}`);
                break;
            }
            visited.add(currentId);

            const node = nodes.find(n => n.id === currentId);
            if (!node) break;

            // 1. Nó INÍCIO (Start)
            if (node.type === 'start') {
                // O nó início apenas aponta para o próximo
                const edge = edges.find(e => e.source === node.id);
                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                }
                break;
            }

            // 2. Nó MENSAGEM (Text Message)
            if (node.type === 'message') {
                const rawText = node.data?.text || node.data?.content || '';
                const messageText = this.interpolateVariables(rawText, variables);
                if (messageText) {
                    await whatsappService.sendMessage(contactJid, messageText);
                }

                // Verifica se há próximo nó conectado
                const edge = edges.find(e => e.source === node.id);
                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    // Fim da cadeia
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // 3. Nó COLETA DE DADOS (Input com Validação)
            if (node.type === 'input') {
                const rawQ = node.data?.question || 'Por favor, digite sua resposta:';
                const formattedQ = this.interpolateVariables(rawQ, variables);
                await whatsappService.sendMessage(contactJid, formattedQ);

                // Salva a sessão aguardando o dado do usuário
                this.setSession(botId, contactJid, {
                    currentNodeId: node.id,
                    waitingForInput: true,
                    variables
                });
                return true;
            }

            // 4. Nó MENU / OPÇÕES (Choice / Menu)
            if (node.type === 'menu') {
                const title = this.interpolateVariables(node.data?.question || node.data?.title || 'Como posso te ajudar hoje?', variables);
                const options = node.data?.options || [];

                let formatted = `*${title}*\n\n`;
                options.forEach((opt, idx) => {
                    formatted += `${idx + 1}️⃣ ${opt.text || opt.label}\n`;
                });
                formatted += `\n💬 _Digite o número da opção desejada_`;

                await whatsappService.sendMessage(contactJid, formatted);

                // Salva a sessão aguardando a resposta do usuário (com flags de timeout e lembrete)
                this.setSession(botId, contactJid, {
                    currentNodeId: node.id,
                    waitingForInput: true,
                    isMenu: true,
                    menuSentAt: Date.now(),
                    reminderSent: false,
                    variables
                });
                return true;
            }

            // 5. Nó AÇÃO NO CONTATO (Tags / Kanban)
            if (node.type === 'action') {
                const actionType = node.data?.actionType || 'add_tag';
                try {
                    const { getDatabase } = require('./DatabaseService');
                    const db = getDatabase();
                    if (db) {
                        if (actionType === 'add_tag' && node.data?.tagValue) {
                            const tagToAdd = this.interpolateVariables(node.data.tagValue, variables).trim();
                            const chatRes = await db.query('SELECT tags FROM chats WHERE "botId" = $1 AND "contactJid" = $2', [botId, contactJid]);
                            let existingTags = [];
                            if (chatRes.rows.length > 0 && chatRes.rows[0].tags) {
                                try {
                                    existingTags = typeof chatRes.rows[0].tags === 'string' ? JSON.parse(chatRes.rows[0].tags) : chatRes.rows[0].tags;
                                } catch (e) {}
                            }
                            if (!existingTags.includes(tagToAdd)) {
                                existingTags.push(tagToAdd);
                                await ChatService.updateChatTags(botId, contactJid, existingTags);
                            }
                        } else if (actionType === 'remove_tag' && node.data?.tagValue) {
                            const tagToRemove = this.interpolateVariables(node.data.tagValue, variables).trim();
                            const chatRes = await db.query('SELECT tags FROM chats WHERE "botId" = $1 AND "contactJid" = $2', [botId, contactJid]);
                            if (chatRes.rows.length > 0 && chatRes.rows[0].tags) {
                                let existingTags = [];
                                try {
                                    existingTags = typeof chatRes.rows[0].tags === 'string' ? JSON.parse(chatRes.rows[0].tags) : chatRes.rows[0].tags;
                                } catch (e) {}
                                existingTags = existingTags.filter(t => t !== tagToRemove);
                                await ChatService.updateChatTags(botId, contactJid, existingTags);
                            }
                        } else if (actionType === 'set_status' && node.data?.statusValue) {
                            await db.query('UPDATE chats SET status = $1, "updatedAt" = $2 WHERE "botId" = $3 AND "contactJid" = $4', [node.data.statusValue, new Date().toISOString(), botId, contactJid]);
                        }
                    }
                } catch (actErr) {
                    logger.error('[FlowService] Erro ao executar ActionNode:', actErr);
                }

                const edge = edges.find(e => e.source === node.id);
                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // 6. Nó WEBHOOK / REQUISIÇÃO EXTERNA com Proteção contra SSRF e DNS Rebinding (TOCTOU)
            if (node.type === 'webhook') {
                const rawUrl = node.data?.url || '';
                const url = this.interpolateVariables(rawUrl, variables);
                const method = (node.data?.method || 'POST').toUpperCase();
                if (url && url.startsWith('http')) {
                    try {
                        let bodyStr = undefined;
                        if (method !== 'GET') {
                            bodyStr = node.data?.bodyJson || JSON.stringify(variables);
                            bodyStr = this.interpolateVariables(bodyStr, variables);
                        }

                        await this.safeHttpRequest(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: bodyStr,
                            timeout: 5000
                        });
                    } catch (webErr) {
                        logger.warn(`🛑 [FlowService] Chamada webhook bloqueada ou com erro (${url}):`, webErr.message);
                    }
                }

                const edge = edges.find(e => e.source === node.id);
                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // 7. Nó HORÁRIO DE EXPEDIENTE (Business Hours)
            if (node.type === 'business_hours') {
                let isOutside = false;
                try {
                    const BusinessHoursService = require('./BusinessHoursService');
                    const companyId = whatsappService?.config?.companyId || 'company_default';
                    const res = await BusinessHoursService.isOutsideBusinessHours(companyId);
                    isOutside = typeof res === 'boolean' ? res : !!res?.isOutside;
                } catch (e) {
                    logger.warn('[FlowService] Erro ao verificar BusinessHours:', e.message);
                }

                const targetHandle = isOutside ? 'outside' : 'inside';
                const edge = edges.find(e => e.source === node.id && e.sourceHandle === targetHandle) ||
                             edges.find(e => e.source === node.id);

                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // 8. Nó IA ASSISTENTE (OpenAI)
            if (node.type === 'ai') {
                this.setSession(botId, contactJid, {
                    currentNodeId: node.id,
                    waitingForInput: true,
                    variables
                });

                // Se houver texto do cliente, processa imediatamente com a IA com instrução desacoplada (Anti-Injection)
                const customPrompt = node.data?.customPrompt || null;
                const aiResponse = await whatsappService.processAI(incomingText, contactJid, customPrompt);
                if (aiResponse) {
                    await whatsappService.sendMessage(contactJid, aiResponse);
                }
                return true;
            }

            // 9. Nó ENVIAR FIGURINHA OU MÍDIA (Áudio PTT, Imagem, PDF)
            if (node.type === 'sticker' || node.type === 'media') {
                const mediaType = node.data?.mediaType || (node.type === 'sticker' ? 'sticker' : 'image');
                const rawUrl = node.data?.url || node.data?.fileUrl || node.data?.stickerUrl;
                const url = this.interpolateVariables(rawUrl, variables);

                if (url) {
                    if (mediaType === 'audio_ptt') {
                        await whatsappService.sendMessage(contactJid, `[AudioUrl:${url}]`);
                    } else if (mediaType === 'document') {
                        const caption = this.interpolateVariables(node.data?.caption || '', variables);
                        await whatsappService.sendMessage(contactJid, `[DocumentUrl:${url}|filename:${caption || 'documento.pdf'}]`);
                    } else if (mediaType === 'sticker' || node.type === 'sticker') {
                        await whatsappService.sendMessage(contactJid, `[StickerUrl:${url}]`);
                    } else {
                        // Imagem padrão
                        await whatsappService.sendMessage(contactJid, `[ImageUrl:${url}]`);
                        if (node.data?.caption) {
                            const caption = this.interpolateVariables(node.data.caption, variables);
                            await whatsappService.sendMessage(contactJid, caption);
                        }
                    }
                }

                const edge = edges.find(e => e.source === node.id);
                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // 6. Nó TRANSFERIR PARA HUMANO (Live Chat)
            if (node.type === 'human') {
                const department = (node.data?.department || node.data?.queue || '').trim() || null;
                const defaultMsg = department
                    ? `Estou transferindo seu atendimento para o setor de *${department}*. Aguarde um instante! 🧑‍💻`
                    : 'Estou transferindo seu atendimento para nossa equipe humana. Aguarde um instante! 🧑‍💻';

                const transferMsg = this.interpolateVariables(
                    node.data?.message || defaultMsg,
                    variables
                );
                await whatsappService.sendMessage(contactJid, transferMsg);

                // Marca o chat como necessitando de atendente humano e vincula o departamento/tag
                await ChatService.setChatNeedsHuman(botId, contactJid, true, department);
                
                // Finaliza a sessão do fluxo para não interferir no atendente
                this.resetSession(botId, contactJid);
                return true;
            }

            // 7. Nó DELAY / SIMULAR DIGITAÇÃO
            if (node.type === 'delay') {
                const seconds = Math.min(Math.max(node.data?.seconds || 2, 1), 10);
                try {
                    if (whatsappService.sock?.sendPresenceUpdate) {
                        await whatsappService.sock.sendPresenceUpdate('composing', contactJid);
                    }
                } catch (e) { }

                await new Promise(res => setTimeout(res, seconds * 1000));

                const edge = edges.find(e => e.source === node.id);
                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // 8. Nó CONDIÇÃO (Branch / Keyword Match)
            if (node.type === 'condition') {
                const keywords = (node.data?.keywords || '')
                    .split(',')
                    .map(k => k.trim().toLowerCase())
                    .filter(Boolean);

                const lowerMsg = (incomingText || '').toLowerCase();
                const matched = keywords.some(k => lowerMsg.includes(k));

                const targetHandle = matched ? 'true' : 'false';
                const edge = edges.find(e => e.source === node.id && e.sourceHandle === targetHandle) ||
                             edges.find(e => e.source === node.id);

                if (edge && edge.target) {
                    currentId = edge.target;
                    continue;
                } else {
                    this.resetSession(botId, contactJid);
                    return true;
                }
            }

            // Se chegou aqui e não reconheceu o nó, para
            break;
        }

        return true;
    }

    /**
     * Valida de forma assíncrona se uma URL aponta para a internet pública e bloqueia
     * acessos a loopback, metadados de nuvem, IPv6 bracketed e redes privadas via DNS lookup
     */
    async isSafePublicUrl(urlString) {
        try {
            const parsed = new URL(urlString);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return false;
            }

            let hostname = parsed.hostname.toLowerCase();
            // Remove colchetes de IPv6 (ex: [::1] -> ::1)
            if (hostname.startsWith('[') && hostname.endsWith(']')) {
                hostname = hostname.slice(1, -1);
            }

            // 1. Bloqueia loopback direto e hostnames locais conhecidos
            if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
                return false;
            }

            // 2. Bloqueia endpoints de metadados de nuvem e domínios coringas conhecidos de loopback
            if (hostname === '169.254.169.254' || hostname === 'instance-data' || hostname === 'metadata.google.internal' || hostname.endsWith('.nip.io') || hostname.endsWith('.sslip.io')) {
                return false;
            }

            // 3. Se for IP literal (IPv4 ou IPv6)
            if (isPrivateIp(hostname)) {
                return false;
            }

            // 4. Resolução DNS assíncrona: verifica todos os IPs resolvidos do domínio (previne DNS rebinding / *.nip.io)
            try {
                const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
                if (!addresses || addresses.length === 0) {
                    return false;
                }
                for (const addr of addresses) {
                    if (isPrivateIp(addr.address)) {
                        return false;
                    }
                }
            } catch (dnsErr) {
                // Se o domínio não resolver em DNS, bloqueia por precaução
                return false;
            }

            return true;
        } catch (_) {
            return false;
        }
    }
    /**
     * Executa requisição HTTP/HTTPS fixando a conexão ao IP resolvido e validado,
     * eliminando a janela de tempo (TOCTOU) para ataques de DNS Rebinding.
     * Valida TLS SNI e trata redirecionamentos com checagem rigorosa a cada salto.
     */
    async safeHttpRequest(urlString, options = {}, maxRedirects = 3) {
        let currentUrl = urlString;
        let hops = 0;

        while (hops <= maxRedirects) {
            const parsed = new URL(currentUrl);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                throw new Error(`Protocolo inválido: ${parsed.protocol}`);
            }

            let hostname = parsed.hostname.toLowerCase();
            if (hostname.startsWith('[') && hostname.endsWith(']')) {
                hostname = hostname.slice(1, -1);
            }

            // 1. Bloqueia hostnames locais, especiais e provedores de metadados
            if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1' ||
                hostname.endsWith('.local') || hostname.endsWith('.internal') ||
                hostname === '169.254.169.254' || hostname === 'instance-data' ||
                hostname === 'metadata.google.internal' || hostname.endsWith('.nip.io') ||
                hostname.endsWith('.sslip.io')) {
                throw new Error(`Hostname bloqueado por política de segurança SSRF: ${hostname}`);
            }

            // 2. Se for IP literal (IPv4 ou IPv6)
            if (isPrivateIp(hostname)) {
                throw new Error(`IP privado ou reservado bloqueado: ${hostname}`);
            }

            // 3. Resolução DNS: verifica todos os IPs vinculados ao domínio
            let addresses = [];
            try {
                addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
            } catch (dnsErr) {
                throw new Error(`Falha ao resolver DNS para ${hostname}: ${dnsErr.message}`);
            }

            if (!addresses || addresses.length === 0) {
                throw new Error(`Nenhum endereço retornado pelo DNS para ${hostname}`);
            }

            for (const addr of addresses) {
                if (isPrivateIp(addr.address)) {
                    throw new Error(`Endereço IP resolvido proibido (${addr.address}) para ${hostname}`);
                }
            }

            // 4. Conexão fixada ao IP validado (elimina DNS Rebinding)
            const validatedEntry = addresses[0];
            const validatedIp = validatedEntry.address;
            const isHttps = parsed.protocol === 'https:';
            const client = isHttps ? https : http;
            const port = parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80);

            const requestHeaders = {
                'Host': parsed.host,
                'User-Agent': 'ItecBot-Flow/1.0',
                ...(options.headers || {})
            };

            const res = await new Promise((resolve, reject) => {
                const req = client.request({
                    method: options.method || 'GET',
                    host: validatedIp,
                    port: port,
                    path: parsed.pathname + parsed.search,
                    headers: requestHeaders,
                    servername: isHttps ? parsed.hostname : undefined, // Preserva verificação SNI e certificado TLS contra o host original
                    timeout: options.timeout || 5000,
                    lookup: (h, opt, cb) => cb(null, validatedIp, validatedEntry.family || (validatedIp.includes(':') ? 6 : 4))
                }, (response) => {
                    let data = '';
                    response.on('data', chunk => {
                        data += chunk;
                        if (data.length > 1024 * 1024) { // Limite de 1MB para proteção contra DoS
                            req.destroy();
                            resolve({ statusCode: response.statusCode, headers: response.headers, body: data });
                        }
                    });
                    response.on('end', () => {
                        resolve({ statusCode: response.statusCode, headers: response.headers, body: data });
                    });
                });

                req.on('timeout', () => {
                    req.destroy(new Error('Timeout de conexão na requisição do fluxo'));
                });

                req.on('error', (err) => {
                    reject(err);
                });

                if (options.body) {
                    req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
                }
                req.end();
            });

            // Tratamento de redirecionamentos (30x)
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                const location = res.headers['location'];
                if (!location) return res;
                currentUrl = new URL(location, currentUrl).toString();
                hops++;
                continue;
            }

            return res;
        }

        throw new Error('Número máximo de redirecionamentos excedido');
    }
}

module.exports = new FlowService();
