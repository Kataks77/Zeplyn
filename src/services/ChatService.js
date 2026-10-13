const { getDatabase } = require('./DatabaseService');
const { isIgnoredJid, isValidContactName } = require('../utils/helpers');

class ChatService {
    // Retorna o objeto do Socket.io do singleton BotManagerService com isolamento de salas por empresa
    getIo(targetBotId = null) {
        try {
            const BotManagerService = require('./BotManagerService');
            const rawIo = BotManagerService.io;
            if (!rawIo) return null;

            return {
                ...rawIo,
                emit: (event, ...args) => {
                    let botId = targetBotId;
                    const firstArg = args[0];
                    if (!botId && firstArg && typeof firstArg === 'object') {
                        botId = firstArg.botId || firstArg.chat?.botId;
                    }

                    let companyId = null;
                    if (firstArg && typeof firstArg === 'object' && firstArg.companyId) {
                        companyId = firstArg.companyId;
                    } else if (botId && BotManagerService.activeBots.has(botId)) {
                        companyId = BotManagerService.activeBots.get(botId)?.config?.companyId;
                    }

                    BotManagerService.emitToCompany(companyId || 'company_default', event, ...args);
                },
                to: (...args) => rawIo.to(...args),
                in: (...args) => rawIo.in(...args)
            };
        } catch (e) {
            console.error('Erro ao obter Socket.io no ChatService:', e);
            return null;
        }
    }

    async resolveAndMergeChats(db, botId, canonicalJid, jidList) {
        if (!db || !botId || !canonicalJid) return;

        try {
            const { getContactJidVariants } = require('../utils/helpers');

            // 1. Busca mapeamentos adicionais na tabela lid_mappings para garantir que nenhum alias fique de fora
            let allJids = Array.isArray(jidList) ? [...jidList] : [canonicalJid];
            try {
                const lmRes = await db.query(
                    'SELECT lid, jid FROM lid_mappings WHERE lid = ANY($1) OR jid = ANY($1)',
                    [allJids]
                );
                for (const row of lmRes.rows) {
                    if (row.lid && !allJids.includes(row.lid)) allJids.push(row.lid);
                    if (row.jid && !allJids.includes(row.jid)) allJids.push(row.jid);
                }
            } catch (lmErr) { }

            // 2. Expande para variantes de 9º dígito e sem DDI
            const { canonicalJid: normalizedCanonical, jidList: expandedJids } = getContactJidVariants(canonicalJid, allJids);
            const targetCanonical = normalizedCanonical || canonicalJid;
            const targetJidList = expandedJids.length > 0 ? expandedJids : allJids;

            const res = await db.query(
                'SELECT * FROM chats WHERE "botId" = $1 AND "contactJid" = ANY($2) ORDER BY "updatedAt" DESC',
                [botId, targetJidList]
            );

            if (res.rows.length <= 1) {
                if (res.rows.length === 1) {
                    const chat = res.rows[0];
                    const cleanPhone = targetCanonical.split('@')[0].replace(/\D/g, '');
                    const canonicalId = `chat_${botId}_${cleanPhone}`;
                    if (chat.contactJid !== targetCanonical || chat.id !== canonicalId) {
                        console.log(`[Merge] Atualizando chat único ${chat.id} para JID e ID canônicos: ${targetCanonical}`);
                        await db.query(
                            'UPDATE chats SET "contactJid" = $1, id = $2 WHERE id = $3',
                            [targetCanonical, canonicalId, chat.id]
                        );
                    }
                }
                return;
            }

            console.log(`🔍 [Merge] Detectados ${res.rows.length} chats para o contato ${targetCanonical}. Iniciando mesclagem...`);

            // Prioriza o chat canônico ou o que estiver em atendimento
            let primaryChat = res.rows.find(c => c.status === 'attending') || 
                              res.rows.find(c => c.contactJid === targetCanonical) || 
                              res.rows[0];
            const cleanPhone = targetCanonical.split('@')[0].replace(/\D/g, '');
            const canonicalId = `chat_${botId}_${cleanPhone}`;
            const chatsToDelete = res.rows.filter(c => c.id !== primaryChat.id);

            for (const dupChat of chatsToDelete) {
                console.log(`   -> Mesclando duplicado: ${dupChat.id} (JID: ${dupChat.contactJid}) para o principal: ${primaryChat.id}`);

                if (dupChat.contactJid !== targetCanonical) {
                    await db.query(
                        'UPDATE messages SET userid = $1 WHERE botid = $2 AND userid = $3',
                        [targetCanonical, botId, dupChat.contactJid]
                    );
                }

                if (primaryChat.status === 'finished' && dupChat.status === 'attending') {
                    primaryChat.status = 'attending';
                    primaryChat.attendantId = dupChat.attendantId;
                } else if (primaryChat.status === 'waiting' && dupChat.status === 'attending') {
                    primaryChat.status = 'attending';
                    primaryChat.attendantId = dupChat.attendantId;
                }

                await db.query('DELETE FROM chats WHERE id = $1', [dupChat.id]);

                const io = this.getIo();
                if (io) {
                    io.emit('chat-merged', {
                        botId: botId,
                        oldJid: dupChat.contactJid,
                        newJid: targetCanonical,
                        deletedChatId: dupChat.id,
                        chat: {
                            ...primaryChat,
                            id: canonicalId,
                            contactJid: targetCanonical
                        }
                    });
                }
            }

            await db.query(
                'UPDATE chats SET "contactJid" = $1, id = $2, status = $3, "attendantId" = $4 WHERE id = $5',
                [targetCanonical, canonicalId, primaryChat.status, primaryChat.attendantId, primaryChat.id]
            );

        } catch (error) {
            console.error('❌ Erro no ChatService.resolveAndMergeChats:', error);
        }
    }

    async createOrUpdateChat(botId, contactJid, contactName, status = 'waiting', profilePicUrl = null, isFromAgenda = false, isNewSession = false, channel = null) {
        if (!contactJid || isIgnoredJid(contactJid, true)) return null;
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            const { getContactJidVariants } = require('../utils/helpers');

            const isOmnichannel = contactJid.endsWith('@instagram') || contactJid.endsWith('@telegram');
            const resolvedChannel = (typeof channel !== 'undefined' && channel) || (contactJid.endsWith('@instagram') ? 'instagram' : (contactJid.endsWith('@telegram') ? 'telegram' : 'whatsapp'));
            let canonicalJid = contactJid;
            let alternateJid = null;
            let jidList = [contactJid];
            let cleanPhone = contactJid.split('@')[0].replace(/\D/g, '') || contactJid.split('@')[0];

            if (!isOmnichannel) {
                if (contactJid.endsWith('@lid')) {
                    const resolved = await ContactService.getJidByLid(contactJid);
                    if (resolved) {
                        canonicalJid = resolved;
                        alternateJid = contactJid;
                    }
                } else if (contactJid.endsWith('@s.whatsapp.net')) {
                    const resolvedLid = await ContactService.getLidByJid(contactJid);
                    if (resolvedLid) {
                        alternateJid = resolvedLid;
                    }
                }

                const initialLids = alternateJid ? [alternateJid] : [];
                const variants = getContactJidVariants(canonicalJid, initialLids);
                canonicalJid = variants.canonicalJid;
                jidList = variants.jidList;
                cleanPhone = variants.cleanPhone;

                // Mesclar chats duplicados antes de qualquer operação
                await this.resolveAndMergeChats(db, botId, canonicalJid, jidList);
            }

            // Busca se existe esse contato salvo na tabela de contatos (agenda)
            let finalContactName = contactName || null;

            const phoneList = [cleanPhone];
            if (cleanPhone.startsWith('55') && cleanPhone.length > 10) {
                phoneList.push(cleanPhone.substring(2));
            }

            const contactRes = await db.query(`
                SELECT name, "profilePicUrl" 
                FROM contacts 
                WHERE "botId" = $1 AND (
                    jid = ANY($2) 
                    OR "phoneNumber" = ANY($3)
                )
                ORDER BY 
                    CASE WHEN name LIKE 'Contato %' OR name ~ '^[0-9]+$' OR name LIKE 'Cliente %' THEN 1 ELSE 0 END,
                    "updatedAt" DESC
                LIMIT 1
            `, [botId, jidList, phoneList]);
            
            let finalProfilePicUrl = profilePicUrl;
            if (contactRes.rows.length > 0) {
                const dbName = contactRes.rows[0].name;
                const dbHasValidName = isValidContactName(dbName);
                const passedHasValidName = isValidContactName(contactName);

                // Se a agenda/CRM já tem um nome salvo e o que chegou não é da agenda (é só pushName), prioriza o nome da agenda
                if (dbHasValidName && (!passedHasValidName || !isFromAgenda)) {
                    finalContactName = dbName;
                } else if (passedHasValidName) {
                    finalContactName = contactName.trim();
                } else if (dbHasValidName) {
                    finalContactName = dbName;
                }

                if (!finalProfilePicUrl && contactRes.rows[0].profilePicUrl) {
                    finalProfilePicUrl = contactRes.rows[0].profilePicUrl;
                }
            }

            const now = new Date().toISOString();

            // Verifica se o chat já existe usando canonical ou alternate
            const res = await db.query(
                'SELECT * FROM chats WHERE "botId" = $1 AND "contactJid" = ANY($2) ORDER BY "updatedAt" DESC LIMIT 1',
                [botId, jidList]
            );

            let chatData = null;

            if (res.rows.length > 0) {
                const existingChat = res.rows[0];
                const existingHasValidName = isValidContactName(existingChat.contactName);
                const currentHasValidName = isValidContactName(finalContactName);

                // Preserva nome válido anterior do chat se a chamada atual não tiver nome válido
                if (existingHasValidName && !currentHasValidName) {
                    finalContactName = existingChat.contactName;
                } else if (!existingHasValidName && !currentHasValidName) {
                    finalContactName = canonicalJid.endsWith('@instagram')
                        ? `Instagram @${cleanPhone.slice(-6)}`
                        : (canonicalJid.endsWith('@telegram') ? `Telegram @${cleanPhone.slice(-6)}` : `Contato ${cleanPhone}`);
                }

                // Preserva foto anterior caso a chamada atual não tenha foto
                if (!finalProfilePicUrl && existingChat.profilePicUrl) {
                    finalProfilePicUrl = existingChat.profilePicUrl;
                }

                const contactNameClean = finalContactName;
                const isFinishedChat = existingChat.status === 'finished';
                const isClientIncoming = status === 'waiting';
                const shouldStartNewSession = isNewSession || (isFinishedChat && isClientIncoming);

                let updateQuery = `
                    UPDATE chats 
                    SET "contactName" = $1, "updatedAt" = $2, "contactJid" = $3, "botId" = $4, channel = COALESCE($5, channel, 'whatsapp')
                `;
                const queryParams = [contactNameClean, now, canonicalJid, botId, resolvedChannel, existingChat.id];
                let paramIndex = 7;
                let newProtocol = null;

                if (shouldStartNewSession) {
                    // Novo atendimento: gera novo protocolo, limpa avaliação CSAT e fechamento anterior, zera atendente
                    newProtocol = `PROT-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
                    updateQuery += `, status = 'waiting', "protocol" = $${paramIndex}, "closedAt" = NULL, "csatRating" = NULL, "csatComment" = NULL, "csatAnsweredAt" = NULL, "needsHuman" = FALSE, "attendantId" = NULL, "createdAt" = $${paramIndex + 1}`;
                    queryParams.push(newProtocol, now);
                    paramIndex += 2;
                } else if (status && !isFinishedChat) {
                    // Se o atendimento não estava finalizado e foi informado status (ex: attending), atualiza
                    updateQuery += `, status = $${paramIndex}`;
                    queryParams.push(status);
                    paramIndex++;
                }

                if (finalProfilePicUrl) {
                    updateQuery += `, "profilePicUrl" = $${paramIndex}`;
                    queryParams.push(finalProfilePicUrl);
                    paramIndex++;
                }

                updateQuery += ` WHERE id = $6 RETURNING *`;
                
                const updateRes = await db.query(updateQuery, queryParams);
                chatData = updateRes.rows[0];

                if (shouldStartNewSession) {
                    try {
                        const HistoryService = require('./HistoryService');
                        await HistoryService.saveMessage(
                            botId,
                            canonicalJid,
                            'system',
                            `🚀 Novo Atendimento Iniciado (Nova mensagem do cliente). Protocolo: ${newProtocol}`,
                            `sys_start_${Date.now()}`,
                            'Sistema'
                        );
                    } catch (sysErr) {
                        console.warn('Aviso ao registrar marcador de novo atendimento:', sysErr.message);
                    }

                    // Limpar sessões ativas do FlowService e OpenAI para garantir atendimento 100% novo
                    try {
                        const FlowService = require('./FlowService');
                        FlowService.resetSession(botId, canonicalJid);
                        if (alternateJid) FlowService.resetSession(botId, alternateJid);
                        for (const j of jidList) FlowService.resetSession(botId, j);

                        const { setSetting } = require('./DatabaseService');
                        await setSetting(`thread_${botId}_${canonicalJid}`, '');
                        if (alternateJid) await setSetting(`thread_${botId}_${alternateJid}`, '');
                    } catch (resetErr) { }
                }
            } else {
                // Insere novo chat como "Aguardando" por padrão com protocolo inicial
                const chatId = isOmnichannel 
                    ? `chat_${botId}_${canonicalJid.replace(/[@.]/g, '_')}` 
                    : `chat_${botId}_${cleanPhone}`;
                const initialProtocol = `PROT-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
                const insertRes = await db.query(`
                    INSERT INTO chats (id, "botId", "contactJid", "contactName", status, "profilePicUrl", "createdAt", "updatedAt", "protocol", "needsHuman", channel)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10)
                    ON CONFLICT (id) DO UPDATE SET
                        "contactName" = EXCLUDED."contactName",
                        "updatedAt" = EXCLUDED."updatedAt",
                        "profilePicUrl" = COALESCE(EXCLUDED."profilePicUrl", chats."profilePicUrl"),
                        channel = COALESCE(EXCLUDED.channel, chats.channel, 'whatsapp')
                    RETURNING *
                `, [chatId, botId, canonicalJid, contactNameClean, status, finalProfilePicUrl, now, now, initialProtocol, resolvedChannel]);
                chatData = insertRes.rows[0];
            }

            // Notifica via Socket.IO
            const io = this.getIo();
            if (io) {
                io.emit('chat-updated', chatData);
                if (chatData && chatData.status === 'waiting') {
                    io.emit('client-waiting', {
                        chatId: chatData.id,
                        botId: chatData.botId,
                        contactJid: chatData.contactJid,
                        contactName: chatData.contactName || 'Cliente',
                        profilePicUrl: chatData.profilePicUrl,
                        status: 'waiting',
                        needsHuman: Boolean(chatData.needsHuman),
                        timestamp: Date.now()
                    });
                }
            }

            return chatData;
        } catch (error) {
            console.error('❌ Erro no ChatService.createOrUpdateChat:', error);
            return null;
        }
    }

    async setChatNeedsHuman(botId, contactJid, needsHuman = true, department = null) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            const now = new Date().toISOString();

            const res = await db.query(`
                UPDATE chats 
                SET "needsHuman" = $1, "updatedAt" = $2
                WHERE "botId" = $3 AND "contactJid" = ANY($4)
                RETURNING *
            `, [needsHuman, now, botId, jidList]);

            if (res.rows.length > 0) {
                let chatData = res.rows[0];

                // Se houver departamento selecionado na URA, adiciona a etiqueta/departamento ao chat
                if (department && needsHuman) {
                    try {
                        let currentTags = [];
                        if (chatData.tags) {
                            currentTags = typeof chatData.tags === 'string' ? JSON.parse(chatData.tags) : (Array.isArray(chatData.tags) ? chatData.tags : []);
                        }
                        const cleanDept = String(department).trim();
                        if (cleanDept && !currentTags.includes(cleanDept)) {
                            currentTags.push(cleanDept);
                            const updatedTagsRes = await db.query(
                                'UPDATE chats SET tags = $1 WHERE id = $2 RETURNING *',
                                [JSON.stringify(currentTags), chatData.id]
                            );
                            if (updatedTagsRes.rows.length > 0) {
                                chatData = updatedTagsRes.rows[0];
                            }
                        }
                    } catch (tagErr) {
                        console.error('Erro ao adicionar departamento como tag do chat:', tagErr);
                    }
                }

                const io = this.getIo();
                if (io) {
                    io.emit('chat-updated', chatData);
                    if (needsHuman) {
                        // Tentar distribuição automática Round-Robin
                        try {
                            const RoundRobinService = require('./RoundRobinService');
                            RoundRobinService.distributeChat(botId, canonicalJid, department).catch(err => {
                                console.error('Erro na distribuição Round-Robin:', err);
                            });
                        } catch (rrErr) {
                            console.error('Erro ao chamar RoundRobinService:', rrErr);
                        }

                        io.emit('human-intervention-needed', {
                            botId: botId,
                            contactJid: canonicalJid,
                            contactName: chatData.contactName,
                            department: department || null
                        });
                        io.emit('client-waiting', {
                            chatId: chatData.id,
                            botId: botId,
                            contactJid: canonicalJid,
                            contactName: chatData.contactName || 'Cliente',
                            reason: department ? `Mini-URA: Transferência para [${department}]` : 'Solicitação de atendente humano',
                            department: department || null,
                            needsHuman: true,
                            status: chatData.status,
                            timestamp: Date.now()
                        });
                    }
                }
                return chatData;
            }
            return null;
        } catch (error) {
            console.error('❌ Erro no ChatService.setChatNeedsHuman:', error);
            return null;
        }
    }

    async captureChat(botId, contactJid, attendantId, attendantName) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Mesclar chats duplicados antes de qualquer operação
            await this.resolveAndMergeChats(db, botId, canonicalJid, jidList);

            const now = new Date().toISOString();
            
            // 1. Verifica se o chat já existe no banco usando canonical ou alternate

            const checkRes = await db.query(
                'SELECT * FROM chats WHERE "botId" = $1 AND "contactJid" = ANY($2)',
                [botId, jidList]
            );

            let chatData = null;

            if (checkRes.rows.length > 0) {
                const existingChat = checkRes.rows[0];
                const isPreviousFinished = existingChat.status === 'finished';
                const newProtocol = (isPreviousFinished || !existingChat.protocol)
                    ? `PROT-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
                    : existingChat.protocol;

                // Atualização ATÔMICA (Compare-And-Swap):
                // Só permite reivindicar se o atendimento estiver na fila de espera ('waiting'), finalizado ('finished'),
                // sem atendente ("attendantId" IS NULL) ou já for do próprio atendente ("attendantId" = $1).
                const res = await db.query(`
                    UPDATE chats 
                    SET status = 'attending', 
                        "attendantId" = $1, 
                        "updatedAt" = $2, 
                        "contactJid" = $3, 
                        "needsHuman" = FALSE,
                        "closedAt" = NULL,
                        "protocol" = $4,
                        "csatRating" = CASE WHEN status = 'finished' THEN NULL ELSE "csatRating" END,
                        "csatComment" = CASE WHEN status = 'finished' THEN NULL ELSE "csatComment" END,
                        "csatAnsweredAt" = CASE WHEN status = 'finished' THEN NULL ELSE "csatAnsweredAt" END,
                        "createdAt" = CASE WHEN status = 'finished' THEN $2 ELSE "createdAt" END
                    WHERE id = $5
                      AND (
                          status IN ('waiting', 'finished') 
                          OR "attendantId" IS NULL 
                          OR "attendantId" = $1
                      )
                    RETURNING *
                `, [attendantId, now, canonicalJid, newProtocol, existingChat.id]);

                if (res.rows.length === 0) {
                    // Condição de corrida detectada: outro operador reivindicou o atendimento no mesmo instante
                    const currentRes = await db.query('SELECT * FROM chats WHERE id = $1', [existingChat.id]);
                    const currentChat = currentRes.rows[0] || existingChat;
                    const conflictErr = new Error('Este atendimento já foi assumido por outro atendente.');
                    conflictErr.code = 'CHAT_ALREADY_CLAIMED';
                    conflictErr.currentChat = currentChat;
                    throw conflictErr;
                }

                chatData = res.rows[0];

                if (isPreviousFinished) {
                    try {
                        const HistoryService = require('./HistoryService');
                        await HistoryService.saveMessage(
                            botId,
                            canonicalJid,
                            'system',
                            `🚀 Novo Atendimento Iniciado por ${attendantName || 'Atendente'}. Protocolo: ${newProtocol}`,
                            `sys_start_${Date.now()}`,
                            'Sistema'
                        );
                    } catch (sysErr) {
                        console.warn('Aviso ao registrar marcador de novo atendimento:', sysErr.message);
                    }
                }
            } else {
                // Se não existe, precisamos criar o chat diretamente como 'attending'!
                // Busca se existe esse contato salvo na tabela de contatos para pegar o nome correto
                let contactName = 'Cliente WhatsApp';
                let profilePicUrl = null;
                const contactRes = await db.query(
                    'SELECT name, "profilePicUrl" FROM contacts WHERE "botId" = $1 AND jid = ANY($2)',
                    [botId, jidList]
                );
                if (contactRes.rows.length > 0) {
                    contactName = contactRes.rows[0].name || contactName;
                    profilePicUrl = contactRes.rows[0].profilePicUrl || null;
                } else {
                    const cleanPhone = canonicalJid.split('@')[0];
                    contactName = `Contato ${cleanPhone}`;
                }

                const chatId = `chat_${botId}_${canonicalJid.split('@')[0]}`;
                const insertRes = await db.query(`
                    INSERT INTO chats (id, "botId", "contactJid", "contactName", status, "attendantId", "profilePicUrl", "createdAt", "updatedAt", "needsHuman")
                    VALUES ($1, $2, $3, $4, 'attending', $5, $6, $7, $7, FALSE)
                    ON CONFLICT (id) DO UPDATE 
                    SET status = 'attending',
                        "attendantId" = EXCLUDED."attendantId",
                        "updatedAt" = EXCLUDED."updatedAt",
                        "needsHuman" = FALSE
                    WHERE chats.status IN ('waiting', 'finished') OR chats."attendantId" IS NULL OR chats."attendantId" = EXCLUDED."attendantId"
                    RETURNING *
                `, [chatId, botId, canonicalJid, contactName, attendantId, profilePicUrl, now]);

                if (insertRes.rows.length === 0) {
                    const currentRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
                    const currentChat = currentRes.rows[0] || null;
                    const conflictErr = new Error('Este atendimento já foi assumido por outro atendente.');
                    conflictErr.code = 'CHAT_ALREADY_CLAIMED';
                    conflictErr.currentChat = currentChat;
                    throw conflictErr;
                }

                chatData = insertRes.rows[0];
            }

            // Emite notificação de captura
            const io = this.getIo();
            if (io) {
                io.emit('chat-captured', {
                    chat: chatData,
                    attendantName: attendantName
                });
                // E também emite chat-updated para atualizar a lista
                io.emit('chat-updated', chatData);
            }

            // Envia mensagem via WhatsApp informando que o atendimento foi capturado (se habilitado)
            try {
                const { getSetting } = require('./DatabaseService');
                const BotService = require('./BotService');
                const bot = await BotService.getBot(botId);
                const companyId = bot?.companyId || 'company_default';

                let captureEnabledVal = await getSetting(`captureNoticeEnabled_${companyId}`);
                if (captureEnabledVal === null || captureEnabledVal === undefined) {
                    captureEnabledVal = await getSetting('captureNoticeEnabled', 'true');
                }
                const captureEnabled = captureEnabledVal === 'true' || captureEnabledVal === true;

                if (captureEnabled) {
                    const captureTemplate = (await getSetting(`captureMessageTemplate_${companyId}`)) || (await getSetting(
                        'captureMessageTemplate',
                        'Olá! Sou o(a) atendente *{atendente}* e assumi seu atendimento. Em que posso te ajudar?'
                    ));

                    const cleanPhone = canonicalJid.split('@')[0];
                    const captureMsg = captureTemplate
                        .replace(/{atendente}/g, attendantName || 'Atendente')
                        .replace(/{nome}/g, chatData.contactName || 'Cliente')
                        .replace(/{telefone}/g, cleanPhone);

                    const BotManagerService = require('./BotManagerService');
                    const botInstance = await BotManagerService.getBotInstance(botId);
                    if (botInstance && botInstance.isConnected) {
                        botInstance.sendMessage(
                            canonicalJid,
                            captureMsg,
                            null,
                            attendantName || "Atendente"
                        ).catch(err => console.error('❌ Erro ao enviar mensagem de captura via WhatsApp:', err));
                    }
                }
            } catch (err) {
                console.error('❌ Erro ao processar mensagem de captura:', err);
            }

            return chatData;
        } catch (error) {
            console.error('❌ Erro no ChatService.captureChat:', error);
            return null;
        }
    }

    async releaseChat(botId, contactJid) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Mesclar chats duplicados antes de qualquer operação
            await this.resolveAndMergeChats(db, botId, canonicalJid, jidList);

            const now = new Date().toISOString();

            const res = await db.query(`
                UPDATE chats 
                SET status = 'waiting', "needsHuman" = FALSE, "attendantId" = NULL, "updatedAt" = $1, "contactJid" = $2
                WHERE "botId" = $3 AND "contactJid" = ANY($4)
                RETURNING *
            `, [now, canonicalJid, botId, jidList]);

            if (res.rows.length === 0) return null;
            const chatData = res.rows[0];

            // Emite notificação de liberação (devolvido ao bot)
            const io = this.getIo();
            if (io) {
                io.emit('chat-released', {
                    chat: chatData
                });
            }

            return chatData;
        } catch (error) {
            console.error('❌ Erro no ChatService.releaseChat:', error);
            return null;
        }
    }

    async finishChat(botId, contactJid, attendantName = 'Atendente') {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Mesclar chats duplicados antes de qualquer operação
            await this.resolveAndMergeChats(db, botId, canonicalJid, jidList);

            const now = new Date().toISOString();

            // Buscar dados atuais do chat para recuperar atendente e gerar protocolo
            const currentChatRes = await db.query(
                'SELECT id, protocol, "attendantId", "lastAttendantId" FROM chats WHERE "botId" = $1 AND "contactJid" = ANY($2) LIMIT 1',
                [botId, jidList]
            );
            const currentChat = currentChatRes.rows[0];
            const protocol = currentChat?.protocol || `PROT-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
            const lastAttendant = currentChat?.attendantId || currentChat?.lastAttendantId || null;

            const res = await db.query(`
                UPDATE chats 
                SET status = 'finished', 
                    "needsHuman" = FALSE,
                    "attendantId" = NULL, 
                    "lastAttendantId" = COALESCE($5, "lastAttendantId"), 
                    "closedAt" = $1, 
                    "protocol" = $6,
                    "updatedAt" = $1, 
                    "contactJid" = $2
                WHERE "botId" = $3 AND "contactJid" = ANY($4)
                RETURNING *
            `, [now, canonicalJid, botId, jidList, lastAttendant, protocol]);

            if (res.rows.length === 0) return null;
            const chatData = res.rows[0];

            // Registra marcador de encerramento no histórico da conversa
            try {
                const HistoryService = require('./HistoryService');
                const ratingTxt = currentChat?.csatRating ? ` (Avaliação: ${currentChat.csatRating}/5)` : '';
                await HistoryService.saveMessage(
                    botId,
                    canonicalJid,
                    'system',
                    `🏁 Atendimento Finalizado por ${attendantName || 'Atendente'}. Protocolo: ${protocol}${ratingTxt}`,
                    `sys_end_${Date.now()}`,
                    'Sistema'
                );
            } catch (sysErr) {
                console.warn('Aviso ao registrar marcador de finalização:', sysErr.message);
            }

            // Limpa sessões de URA/Fluxo e memória da IA para que novos contatos iniciem limpos
            try {
                const FlowService = require('./FlowService');
                FlowService.resetSession(botId, canonicalJid);
                if (alternateJid) FlowService.resetSession(botId, alternateJid);
                for (const jid of jidList) {
                    FlowService.resetSession(botId, jid);
                }

                const { setSetting } = require('./DatabaseService');
                await setSetting(`thread_${botId}_${canonicalJid}`, '');
                if (alternateJid) await setSetting(`thread_${botId}_${alternateJid}`, '');
            } catch (cleanupErr) {
                console.warn('Aviso ao resetar sessões no finishChat:', cleanupErr.message);
            }

            // Emite notificação de liberação/finalização e atualização de lista
            const io = this.getIo();
            if (io) {
                io.emit('chat-released', {
                    chat: chatData
                });
                io.emit('chat-updated', chatData);
            }

            // Enviar mensagem de encerramento configurada via WhatsApp
            try {
                const { getSetting } = require('./DatabaseService');
                const BotService = require('./BotService');
                const bot = await BotService.getBot(botId);
                const companyId = bot?.companyId || 'company_default';

                let farewellEnabledVal = await getSetting(`farewellMessageEnabled_${companyId}`);
                if (farewellEnabledVal === null || farewellEnabledVal === undefined) {
                    farewellEnabledVal = await getSetting('farewellMessageEnabled', 'true');
                }
                const farewellEnabled = farewellEnabledVal === 'true' || farewellEnabledVal === true;

                const farewellTemplate = (await getSetting(`farewellMessageTemplate_${companyId}`)) || (await getSetting(
                    'farewellMessageTemplate',
                    'Seu atendimento foi finalizado. Protocolo: {protocolo}. Obrigado pelo contato!'
                ));

                let csatEnabledVal = await getSetting(`csatEnabled_${companyId}`);
                if (csatEnabledVal === null || csatEnabledVal === undefined) {
                    csatEnabledVal = await getSetting('csatEnabled', 'false');
                }
                const csatEnabled = csatEnabledVal === 'true';

                const csatTemplate = (await getSetting(`csatMessageTemplate_${companyId}`)) || (await getSetting(
                    'csatMessageTemplate',
                    'Por favor, avalie nosso atendimento enviando uma nota de 1 a 5 (onde 1 é muito insatisfeito e 5 é excelente).'
                ));

                let farewellMessage = '';
                if (farewellEnabled && farewellTemplate && farewellTemplate.trim() !== '') {
                    const cleanPhone = canonicalJid.split('@')[0];
                    farewellMessage = farewellTemplate
                        .replace(/{nome}/g, chatData.contactName || 'Cliente')
                        .replace(/{telefone}/g, cleanPhone)
                        .replace(/{atendente}/g, attendantName || 'Atendente')
                        .replace(/{protocolo}/gi, protocol)
                        .replace(/{protocol}/gi, protocol);
                }

                if (csatEnabled && csatTemplate && csatTemplate.trim() !== '') {
                    const cleanPhone = canonicalJid.split('@')[0];
                    const csatText = csatTemplate
                        .replace(/{nome}/g, chatData.contactName || 'Cliente')
                        .replace(/{telefone}/g, cleanPhone)
                        .replace(/{atendente}/g, attendantName || 'Atendente')
                        .replace(/{protocolo}/gi, protocol)
                        .replace(/{protocol}/gi, protocol);
                    farewellMessage = farewellMessage ? `${farewellMessage}\n\n${csatText}` : csatText;
                }

                if (farewellMessage && farewellMessage.trim() !== '') {
                    const BotManagerService = require('./BotManagerService');
                    const botInstance = await BotManagerService.getBotInstance(botId);
                    if (botInstance && botInstance.isConnected) {
                        botInstance.sendMessage(
                            canonicalJid,
                            farewellMessage,
                            null,
                            attendantName
                        ).catch(err => console.error('❌ Erro ao enviar mensagem de encerramento:', err));
                    }
                }
            } catch (msgErr) {
                console.error('❌ Erro ao processar envio de mensagem de encerramento:', msgErr);
            }

            // Persistir histórico detalhado do atendimento na tabela attendances
            try {
                const msgCountRes = await db.query(
                    'SELECT COUNT(*) as count FROM messages WHERE botid = $1 AND userid = ANY($2) AND timestamp >= $3',
                    [botId, jidList, chatData.createdAt || now]
                );
                const totalMsgs = parseInt(msgCountRes.rows[0]?.count, 10) || 0;

                let attendantDept = null;
                if (lastAttendant) {
                    const uRes = await db.query('SELECT department FROM users WHERE id = $1', [lastAttendant]);
                    if (uRes.rows.length > 0) attendantDept = uRes.rows[0].department;
                }

                await db.query(`
                    INSERT INTO attendances (
                        id, "botId", "contactJid", "contactName", "protocol", status,
                        "attendantId", "attendantName", "department", "csatRating", "csatComment",
                        "csatAnsweredAt", "startedAt", "closedAt", "totalMessages", "createdAt", "updatedAt"
                    ) VALUES (
                        $1, $2, $3, $4, $5, 'finished', $6, $7, $8, $9, $10, $11, $12, $13, $14, $12, $13
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        status = 'finished',
                        "attendantName" = EXCLUDED."attendantName",
                        "department" = COALESCE(EXCLUDED."department", attendances."department"),
                        "closedAt" = EXCLUDED."closedAt",
                        "totalMessages" = EXCLUDED."totalMessages",
                        "updatedAt" = EXCLUDED."updatedAt"
                `, [
                    `att_${protocol}`,
                    botId,
                    canonicalJid,
                    chatData.contactName || 'Cliente',
                    protocol,
                    lastAttendant,
                    attendantName || 'Atendente',
                    attendantDept,
                    chatData.csatRating || null,
                    chatData.csatComment || null,
                    chatData.csatAnsweredAt || null,
                    chatData.createdAt || now,
                    now,
                    totalMsgs
                ]);
            } catch (attErr) {
                console.warn('Aviso ao registrar histórico de atendimento em attendances:', attErr.message);
            }

            return chatData;
        } catch (error) {
            console.error('❌ Erro no ChatService.finishChat:', error);
            return null;
        }
    }

    /**
     * Registra a nota e feedback de satisfação (CSAT / NPS)
     */
    async recordCsat(botId, contactJid, rating, comment = null) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) { canonicalJid = resolved; alternateJid = contactJid; }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) alternateJid = resolvedLid;
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            const numRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
            const now = new Date().toISOString();

            const res = await db.query(`
                UPDATE chats 
                SET "csatRating" = $1, 
                    "csatComment" = $2, 
                    "csatAnsweredAt" = $3,
                    "updatedAt" = $3
                WHERE "botId" = $4 AND "contactJid" = ANY($5)
                RETURNING *
            `, [numRating, comment ? comment.trim() : null, now, botId, jidList]);

            if (res.rows.length === 0) return null;
            const updatedChat = res.rows[0];

            // Sincronizar avaliação na tabela attendances
            try {
                await db.query(`
                    UPDATE attendances
                    SET "csatRating" = $1, "csatComment" = $2, "csatAnsweredAt" = $3, "updatedAt" = $3
                    WHERE "botId" = $4 AND "contactJid" = ANY($5) AND "protocol" = $6
                `, [numRating, comment ? comment.trim() : null, now, botId, jidList, updatedChat.protocol]);
            } catch (attCsatErr) {
                console.warn('Aviso ao sincronizar CSAT em attendances:', attCsatErr.message);
            }

            const io = this.getIo();
            if (io) {
                io.emit('chat-updated', { chat: updatedChat });
                io.emit('csat-recorded', {
                    botId,
                    contactJid: canonicalJid,
                    rating: numRating,
                    comment: comment ? comment.trim() : null,
                    protocol: updatedChat.protocol,
                    chatId: updatedChat.id
                });
            }

            return updatedChat;
        } catch (error) {
            console.error('❌ Erro no ChatService.recordCsat:', error);
            return null;
        }
    }

    /**
     * Retorna o histórico cronológico completo de todos os atendimentos do cliente
     */
    async getAttendanceHistory(botId, contactJid) {
        const db = getDatabase();
        if (!db) return [];

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) { canonicalJid = resolved; alternateJid = contactJid; }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) alternateJid = resolvedLid;
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Garantir existência da tabela attendances
            await db.query(`
                CREATE TABLE IF NOT EXISTS attendances (
                    id TEXT PRIMARY KEY,
                    "botId" TEXT NOT NULL,
                    "contactJid" TEXT NOT NULL,
                    "contactName" TEXT,
                    "protocol" TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'finished',
                    "attendantId" TEXT,
                    "attendantName" TEXT,
                    "department" TEXT,
                    "csatRating" INTEGER,
                    "csatComment" TEXT,
                    "csatAnsweredAt" TEXT,
                    "startedAt" TEXT NOT NULL,
                    "closedAt" TEXT,
                    "totalMessages" INTEGER DEFAULT 0,
                    "summary" TEXT,
                    "createdAt" TEXT NOT NULL,
                    "updatedAt" TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_attendances_bot_contact ON attendances("botId", "contactJid");
                CREATE INDEX IF NOT EXISTS idx_attendances_protocol ON attendances("protocol");
            `);

            // 1. Buscar atendimentos gravados na tabela attendances
            const attRes = await db.query(`
                SELECT a.*, 
                       u.name as "userAttendantName", u.department as "userDepartment", u."jobRoleName" as "userRole"
                FROM attendances a
                LEFT JOIN users u ON a."attendantId" = u.id
                WHERE a."botId" = $1 AND a."contactJid" = ANY($2)
                ORDER BY a."startedAt" DESC, a."createdAt" DESC
            `, [botId, jidList]);

            const attendances = attRes.rows.map(row => ({
                id: row.id,
                protocol: row.protocol,
                status: row.status || 'finished',
                attendantId: row.attendantId,
                attendantName: row.userAttendantName || row.attendantName || 'Atendente',
                department: row.userDepartment || row.department || 'Geral',
                role: row.userRole || null,
                csatRating: row.csatRating,
                csatComment: row.csatComment,
                csatAnsweredAt: row.csatAnsweredAt,
                startedAt: row.startedAt,
                closedAt: row.closedAt,
                totalMessages: parseInt(row.totalMessages, 10) || 0,
                summary: row.summary,
                createdAt: row.createdAt
            }));

            // 2. Buscar o chat atual da tabela chats para incluir atendimento em andamento ou recente
            const chatRes = await db.query(`
                SELECT c.*,
                       u.name as "attendantName", u.department as "attendantDepartment", u."jobRoleName" as "attendantRole",
                       lu.name as "lastAttendantName", lu.department as "lastAttendantDepartment", lu."jobRoleName" as "lastAttendantRole"
                FROM chats c
                LEFT JOIN users u ON c."attendantId" = u.id
                LEFT JOIN users lu ON c."lastAttendantId" = lu.id
                WHERE c."botId" = $1 AND c."contactJid" = ANY($2)
                ORDER BY c."updatedAt" DESC LIMIT 1
            `, [botId, jidList]);

            const currentChat = chatRes.rows[0];

            if (currentChat && currentChat.protocol) {
                const existingIdx = attendances.findIndex(a => a.protocol === currentChat.protocol);
                const currentItem = {
                    id: `att_${currentChat.protocol}`,
                    protocol: currentChat.protocol,
                    status: currentChat.status || 'waiting',
                    attendantId: currentChat.attendantId || currentChat.lastAttendantId,
                    attendantName: currentChat.attendantName || currentChat.lastAttendantName || (currentChat.status === 'attending' ? 'Atendente' : 'IA / Automático'),
                    department: currentChat.attendantDepartment || currentChat.lastAttendantDepartment || 'Geral',
                    role: currentChat.attendantRole || currentChat.lastAttendantRole || null,
                    csatRating: currentChat.csatRating,
                    csatComment: currentChat.csatComment,
                    csatAnsweredAt: currentChat.csatAnsweredAt,
                    startedAt: currentChat.createdAt,
                    closedAt: currentChat.closedAt,
                    totalMessages: 0,
                    isCurrent: currentChat.status !== 'finished',
                    createdAt: currentChat.createdAt
                };

                if (existingIdx >= 0) {
                    attendances[existingIdx] = {
                        ...attendances[existingIdx],
                        ...currentItem
                    };
                } else {
                    attendances.unshift(currentItem);
                }
            }

            // 3. Buscar mensagens para calcular métricas e extrair atendimentos históricos
            const messagesRes = await db.query(`
                SELECT id, role, content, timestamp, "senderName"
                FROM messages
                WHERE botid = $1 AND userid = ANY($2)
                ORDER BY timestamp ASC
            `, [botId, jidList]);

            const allMessages = messagesRes.rows || [];

            // Identificar atendimentos registrados nos divisores de sistema
            const systemMarkers = allMessages.filter(m => m.role === 'system' && (
                m.content.includes('Atendimento Finalizado') || m.content.includes('Novo Atendimento')
            ));

            for (const marker of systemMarkers) {
                const protMatch = marker.content.match(/Protocolo:\s*([A-Z0-9_-]+)/i);
                if (!protMatch) continue;
                const prot = protMatch[1];

                if (!attendances.some(a => a.protocol === prot)) {
                    const opMatch = marker.content.match(/(?:por|Iniciado por)\s+([^.]+?)\.\s*Protocolo/i);
                    const ratingMatch = marker.content.match(/(?:Avaliação|Nota):\s*(\d+)\/5/i);
                    const isFinished = marker.content.includes('Finalizado');

                    attendances.push({
                        id: `msg_marker_${prot}`,
                        protocol: prot,
                        status: isFinished ? 'finished' : 'attending',
                        attendantName: opMatch ? opMatch[1].trim() : 'Atendente',
                        department: 'Geral',
                        csatRating: ratingMatch ? parseInt(ratingMatch[1], 10) : null,
                        csatComment: null,
                        csatAnsweredAt: null,
                        startedAt: marker.timestamp,
                        closedAt: isFinished ? marker.timestamp : null,
                        totalMessages: 0,
                        isHistorical: true,
                        createdAt: marker.timestamp
                    });
                }
            }

            // 4. Associar mensagens e calcular duração amigável para cada atendimento
            for (let i = 0; i < attendances.length; i++) {
                const att = attendances[i];
                const startT = new Date(att.startedAt).getTime() || 0;
                const endT = att.closedAt ? new Date(att.closedAt).getTime() : Date.now();

                const msgsInSession = allMessages.filter(m => {
                    const t = new Date(m.timestamp).getTime();
                    return t >= (startT - 1000) && t <= (endT + 2000);
                });

                att.totalMessages = msgsInSession.length > 0 ? msgsInSession.length : (att.totalMessages || 0);
                att.messages = msgsInSession.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    senderName: m.senderName
                }));

                // Formatar duração
                if (att.startedAt && att.closedAt) {
                    const diffMin = Math.round((new Date(att.closedAt) - new Date(att.startedAt)) / 60000);
                    if (diffMin < 1) att.durationFormatted = '< 1 min';
                    else if (diffMin < 60) att.durationFormatted = `${diffMin} min`;
                    else {
                        const hrs = Math.floor(diffMin / 60);
                        const mins = diffMin % 60;
                        att.durationFormatted = `${hrs}h ${mins}m`;
                    }
                } else if (att.status === 'attending') {
                    att.durationFormatted = 'Em andamento';
                } else {
                    att.durationFormatted = '-';
                }
            }

            // Ordenar por data mais recente no topo
            attendances.sort((a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt));

            return attendances;
        } catch (error) {
            console.error('❌ Erro no ChatService.getAttendanceHistory:', error);
            return [];
        }
    }

    /**
     * Compila o dossiê oficial e comprovante do atendimento para exportação e impressão (PDF)
     */
    async getChatDossier(botId, contactJid, targetProtocol = null) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) { canonicalJid = resolved; alternateJid = contactJid; }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) alternateJid = resolvedLid;
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // 1. Buscar dados do chat com bot, atendente e empresa
            const chatRes = await db.query(`
                SELECT 
                    c.*,
                    b.name as "botName",
                    b."companyId",
                    co.name as "companyName",
                    co.cnpj as "companyCnpj",
                    u.name as "attendantName",
                    u.email as "attendantEmail",
                    u.department as "attendantDepartment",
                    u."jobRoleName" as "attendantRole",
                    lu.name as "lastAttendantName",
                    lu.email as "lastAttendantEmail",
                    lu.department as "lastAttendantDepartment",
                    lu."jobRoleName" as "lastAttendantRole"
                FROM chats c
                JOIN bots b ON c."botId" = b.id
                LEFT JOIN companies co ON b."companyId" = co.id
                LEFT JOIN users u ON c."attendantId" = u.id
                LEFT JOIN users lu ON c."lastAttendantId" = lu.id
                WHERE c."botId" = $1 AND c."contactJid" = ANY($2)
                ORDER BY c."updatedAt" DESC LIMIT 1
            `, [botId, jidList]);

            if (chatRes.rows.length === 0) return null;
            const chat = chatRes.rows[0];

            // Se targetProtocol foi informado, buscar dados específicos desse atendimento
            let specificAtt = null;
            if (targetProtocol) {
                try {
                    const attRes = await db.query(
                        'SELECT * FROM attendances WHERE "botId" = $1 AND "contactJid" = ANY($2) AND "protocol" = $3 LIMIT 1',
                        [botId, jidList, targetProtocol]
                    );
                    if (attRes.rows.length > 0) specificAtt = attRes.rows[0];
                } catch (e) {}
            }

            // 2. Buscar histórico completo de mensagens
            const messagesRes = await db.query(`
                SELECT id, role, content, timestamp, "senderName", reaction
                FROM messages
                WHERE botid = $1 AND userid = ANY($2)
                ORDER BY timestamp ASC
            `, [botId, jidList]);

            let messages = messagesRes.rows || [];

            // Se for um atendimento específico com datas definidas, filtrar mensagens daquela sessão
            if (specificAtt && specificAtt.startedAt) {
                const sT = new Date(specificAtt.startedAt).getTime() - 1000;
                const eT = specificAtt.closedAt ? (new Date(specificAtt.closedAt).getTime() + 2000) : Date.now();
                const sessionMsgs = messages.filter(m => {
                    const t = new Date(m.timestamp).getTime();
                    return t >= sT && t <= eT;
                });
                if (sessionMsgs.length > 0) {
                    messages = sessionMsgs;
                }
            }

            // 3. Garantir protocolo oficial
            const protocol = specificAtt?.protocol || targetProtocol || chat.protocol || `PROT-${(chat.createdAt || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-${(chat.id || 'CHAT').slice(-4).toUpperCase()}`;

            if (specificAtt) {
                if (specificAtt.attendantName) chat.attendantName = specificAtt.attendantName;
                if (specificAtt.department) chat.attendantDepartment = specificAtt.department;
                if (specificAtt.startedAt) chat.createdAt = specificAtt.startedAt;
                if (specificAtt.closedAt) chat.closedAt = specificAtt.closedAt;
                if (specificAtt.csatRating !== undefined && specificAtt.csatRating !== null) chat.csatRating = specificAtt.csatRating;
                if (specificAtt.csatComment) chat.csatComment = specificAtt.csatComment;
            }

            // 4. Calcular estatísticas de mensagens e tempo
            const totalMessages = messages.length;
            const userMessages = messages.filter(m => m.role === 'user').length;
            const operatorMessages = messages.filter(m => m.role === 'assistant').length;
            const firstMsgTime = messages[0]?.timestamp || chat.createdAt;
            const lastMsgTime = messages[messages.length - 1]?.timestamp || chat.updatedAt;

            // 5. Gerar hash de autenticidade (SHA-256)
            const crypto = require('crypto');
            const authPayload = `${protocol}|${chat.id}|${chat.botId}|${canonicalJid}|${totalMessages}|${firstMsgTime}|${lastMsgTime}`;
            const digitalSignature = crypto.createHash('sha256').update(authPayload).digest('hex').toUpperCase();

            const formattedMessages = messages.map(m => {
                const isFromMe = m.role === 'assistant' || m.role === 'operator' || m.role === 'system';
                return {
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    createdAt: m.timestamp,
                    fromMe: isFromMe,
                    senderName: m.senderName || (isFromMe ? (chat.attendantName || chat.lastAttendantName || 'Atendente') : (chat.contactName || 'Cliente')),
                    reaction: m.reaction
                };
            });

            const clientInfo = {
                jid: canonicalJid,
                phone: canonicalJid.split('@')[0],
                name: chat.contactName || 'Cliente',
                createdAt: chat.createdAt,
                closedAt: chat.closedAt || (chat.status === 'finished' ? chat.updatedAt : null)
            };

            return {
                protocol,
                chatId: chat.id,
                status: chat.status,
                client: clientInfo,
                contact: clientInfo,
                company: {
                    name: chat.companyName || 'Empresa Principal',
                    cnpj: chat.companyCnpj || null
                },
                attendant: {
                    name: chat.attendantName || chat.lastAttendantName || 'Atendente Virtual',
                    email: chat.attendantEmail || chat.lastAttendantEmail || null,
                    department: chat.attendantDepartment || chat.lastAttendantDepartment || 'Atendimento Geral',
                    role: chat.attendantRole || chat.lastAttendantRole || 'Atendente'
                },
                bot: {
                    id: chat.botId,
                    name: chat.botName || 'Bot Oficial'
                },
                csat: {
                    rating: chat.csatRating,
                    comment: chat.csatComment,
                    answeredAt: chat.csatAnsweredAt
                },
                timing: {
                    openedAt: chat.createdAt,
                    closedAt: chat.closedAt || (chat.status === 'finished' ? chat.updatedAt : null),
                    firstMessageAt: firstMsgTime,
                    lastMessageAt: lastMsgTime
                },
                stats: {
                    totalMessages,
                    userMessages,
                    operatorMessages
                },
                digitalSignature,
                securityHash: digitalSignature,
                generatedAt: new Date().toISOString(),
                messages: formattedMessages
            };
        } catch (error) {
            console.error('❌ Erro no ChatService.getChatDossier:', error);
            return null;
        }
    }

    /**
     * Gera dossiê oficial e comprovante do atendimento em formato PDF
     */
    async generateChatDossierPdf(botId, contactJid, protocol = null) {
        const dossier = await this.getChatDossier(botId, contactJid, protocol);
        if (!dossier) return null;

        const PDFDocument = require('pdfkit');

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    margin: 36,
                    size: 'A4',
                    bufferPages: true,
                    info: {
                        Title: `Dossiê de Atendimento - ${dossier.protocol}`,
                        Author: 'Zeplyn',
                        Subject: `Protocolo ${dossier.protocol}`
                    }
                });

                const chunks = [];
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', err => reject(err));

                const contentWidth = 595.28 - 72; // 523.28 pt

                const drawDossierHeader = (isFirst = true) => {
                    const h = isFirst ? 58 : 34;
                    doc.rect(36, 36, contentWidth, h).fill('#0f172a');
                    doc.fillColor('#ffffff').fontSize(isFirst ? 14 : 11).font('Helvetica-Bold')
                       .text(dossier.company?.name ? dossier.company.name.toUpperCase() : 'ZEPLYN', 48, isFirst ? 46 : 44);

                    if (isFirst) {
                        doc.fillColor('#94a3b8').fontSize(8.5).font('Helvetica')
                           .text('Comprovante Oficial de Atendimento & Dossiê de Mensagens', 48, 66);
                        doc.fillColor('#10b981').fontSize(11).font('Helvetica-Bold')
                           .text(dossier.protocol, 260, 46, { width: contentWidth - 230, align: 'right' });
                        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
                           .text('Emissão: ' + new Date().toLocaleString('pt-BR'), 260, 64, { width: contentWidth - 230, align: 'right' });
                        doc.rect(36, 94, contentWidth, 3).fill('#10b981');
                    } else {
                        doc.fillColor('#10b981').fontSize(8.5).font('Helvetica-Bold')
                           .text(`Protocolo: ${dossier.protocol}`, 260, 44, { width: contentWidth - 230, align: 'right' });
                        doc.rect(36, 70, contentWidth, 2).fill('#10b981');
                    }
                };

                drawDossierHeader(true);

                // Caixa de Metadados do Atendimento
                let curY = 104;
                doc.rect(36, curY, contentWidth, 74).fillAndStroke('#f8fafc', '#e2e8f0');

                // Linha 1: Cliente & Telefone
                doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold').text('CLIENTE:', 46, curY + 10);
                doc.fillColor('#0f172a').font('Helvetica').text(`${dossier.client?.name || 'Cliente'} (${dossier.client?.phone || ''})`, 100, curY + 10);

                doc.fillColor('#475569').font('Helvetica-Bold').text('STATUS:', 330, curY + 10);
                const statusLabel = dossier.status === 'finished' ? 'FINALIZADO' : (dossier.status === 'attending' ? 'EM ATENDIMENTO' : 'AGUARDANDO');
                doc.fillColor(dossier.status === 'finished' ? '#10b981' : '#f59e0b').font('Helvetica-Bold').text(statusLabel, 385, curY + 10);

                // Linha 2: Atendente & Setor
                doc.fillColor('#475569').font('Helvetica-Bold').text('OPERADOR:', 46, curY + 26);
                doc.fillColor('#0f172a').font('Helvetica').text(`${dossier.attendant?.name || 'Atendente Virtual'} • ${dossier.attendant?.department || 'Geral'}`, 100, curY + 26);

                doc.fillColor('#475569').font('Helvetica-Bold').text('CANAL:', 330, curY + 26);
                doc.fillColor('#0f172a').font('Helvetica').text(dossier.bot?.name || 'WhatsApp', 385, curY + 26);

                // Linha 3: Horários e CSAT
                const openDate = dossier.timing?.openedAt ? new Date(dossier.timing.openedAt).toLocaleString('pt-BR') : '-';
                const closeDate = dossier.timing?.closedAt ? new Date(dossier.timing.closedAt).toLocaleString('pt-BR') : 'Em andamento';
                doc.fillColor('#475569').font('Helvetica-Bold').text('ABERTURA:', 46, curY + 42);
                doc.fillColor('#0f172a').font('Helvetica').text(openDate, 100, curY + 42);

                doc.fillColor('#475569').font('Helvetica-Bold').text('TÉRMINO:', 330, curY + 42);
                doc.fillColor('#0f172a').font('Helvetica').text(closeDate, 385, curY + 42);

                // Linha 4: CSAT & Total de Mensagens
                const csatVal = dossier.csat?.rating ? `${dossier.csat.rating} / 5.0 estrelas` : 'Não avaliado';
                doc.fillColor('#475569').font('Helvetica-Bold').text('CSAT:', 46, curY + 58);
                doc.fillColor('#f59e0b').font('Helvetica-Bold').text(csatVal, 100, curY + 58);

                doc.fillColor('#475569').font('Helvetica-Bold').text('MENSAGENS:', 330, curY + 58);
                doc.fillColor('#0f172a').font('Helvetica').text(`${dossier.stats?.totalMessages || 0} registradas`, 405, curY + 58);

                curY += 86;

                // Título do Histórico
                doc.rect(36, curY, 4, 14).fill('#10b981');
                doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold')
                   .text('TRANSCRIÇÃO CRONOLÓGICA DAS MENSAGENS', 46, curY + 1);

                curY += 20;

                const messages = dossier.messages || [];
                if (messages.length === 0) {
                    doc.rect(36, curY, contentWidth, 24).fillAndStroke('#ffffff', '#f1f5f9');
                    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
                       .text('Nenhuma mensagem registrada nesta sessão de atendimento.', 46, curY + 8);
                    curY += 24;
                } else {
                    messages.forEach((msg) => {
                        const msgText = msg.content || '[Mídia ou Anexo]';
                        doc.fontSize(7.5).font('Helvetica');
                        const textHeight = doc.heightOfString(msgText, { width: contentWidth - 40 });
                        const blockHeight = Math.max(28, textHeight + 18);

                        if (curY + blockHeight > 760) {
                            doc.addPage();
                            drawDossierHeader(false);
                            curY = 80;
                        }

                        const isUser = msg.role === 'user';
                        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR') : '';
                        const dateStr = msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('pt-BR') : '';

                        const bubbleBg = isUser ? '#f1f5f9' : '#ecfdf5';
                        const bubbleBorder = isUser ? '#cbd5e1' : '#a7f3d0';
                        const senderColor = isUser ? '#1e293b' : '#047857';
                        const senderTag = isUser ? (msg.senderName || 'CLIENTE') : (msg.senderName || 'ATENDENTE / IA');

                        doc.rect(36, curY, contentWidth, blockHeight).fillAndStroke(bubbleBg, bubbleBorder);

                        doc.fillColor(senderColor).fontSize(7).font('Helvetica-Bold')
                           .text(senderTag, 44, curY + 4);

                        doc.fillColor('#94a3b8').fontSize(6.5).font('Helvetica')
                           .text(`${dateStr} às ${timeStr}`, 300, curY + 4, { width: contentWidth - 275, align: 'right' });

                        doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica')
                           .text(msgText, 44, curY + 15, { width: contentWidth - 20 });

                        curY += blockHeight + 4;
                    });
                }

                // Autenticidade e Assinatura Digital
                if (curY + 45 > 760) {
                    doc.addPage();
                    drawDossierHeader(false);
                    curY = 80;
                } else {
                    curY += 10;
                }

                doc.rect(36, curY, contentWidth, 34).fillAndStroke('#f8fafc', '#e2e8f0');
                doc.fillColor('#0f172a').fontSize(6.8).font('Helvetica-Bold')
                   .text('ASSINATURA DIGITAL E VALIDADE JURÍDICA (SHA-256):', 44, curY + 7);
                doc.fillColor('#475569').fontSize(6.5).font('Helvetica')
                   .text(dossier.digitalSignature || 'INTEGRIDADE_VERIFICADA', 44, curY + 18, { width: contentWidth - 16 });

                // Rodapé de todas as páginas
                const pages = doc.bufferedPageRange();
                for (let p = 0; p < pages.count; p++) {
                    doc.switchToPage(p);
                    doc.rect(36, 796, contentWidth, 0.5).fill('#cbd5e1');
                    doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
                       .text(`Zeplyn • Comprovante do Atendimento ${dossier.protocol} • Documento Oficial`, 36, 804);
                    doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold')
                       .text(`Página ${p + 1} de ${pages.count}`, 36, 804, { width: contentWidth, align: 'right' });
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    async transferChat(botId, contactJid, targetAttendantId, currentAttendantId, currentAttendantName = null, transferNote = null, notifyClient = true, targetDepartment = null) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            const HistoryService = require('./HistoryService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Mesclar chats duplicados antes de qualquer operação
            await this.resolveAndMergeChats(db, botId, canonicalJid, jidList);

            const now = new Date().toISOString();
            const io = this.getIo();

            // Identificar nome do atendente atual
            let finalCurrentName = currentAttendantName || 'Atendente';
            if (!currentAttendantName && currentAttendantId) {
                const curUserRes = await db.query('SELECT name FROM users WHERE id = $1', [currentAttendantId]);
                if (curUserRes.rows.length > 0) {
                    finalCurrentName = curUserRes.rows[0].name;
                }
            }

            // 1. Transferir para um Departamento / Setor da Empresa
            if (targetDepartment && String(targetDepartment).trim()) {
                const cleanDept = String(targetDepartment).trim();
                const RoundRobinService = require('./RoundRobinService');
                const rrResult = await RoundRobinService.distributeChat(botId, canonicalJid, cleanDept);

                let targetAttendantName = null;
                let finalAttendantId = null;
                let chatData = null;

                if (rrResult?.operator) {
                    targetAttendantName = rrResult.operator.name;
                    finalAttendantId = rrResult.operator.id;
                    chatData = rrResult.chat;
                } else {
                    const res = await db.query(`
                        UPDATE chats 
                        SET status = 'waiting', "attendantId" = NULL, "updatedAt" = $1, "contactJid" = $2, "needsHuman" = TRUE
                        WHERE "botId" = $3 AND "contactJid" = ANY($4)
                        RETURNING *
                    `, [now, canonicalJid, botId, jidList]);
                    if (res.rows.length === 0) return null;
                    chatData = res.rows[0];
                }

                try {
                    let currentTags = [];
                    if (chatData.tags) {
                        currentTags = typeof chatData.tags === 'string' ? JSON.parse(chatData.tags) : (Array.isArray(chatData.tags) ? chatData.tags : []);
                    }
                    if (!currentTags.includes(cleanDept)) {
                        currentTags.push(cleanDept);
                        const updated = await db.query('UPDATE chats SET tags = $1 WHERE id = $2 RETURNING *', [JSON.stringify(currentTags), chatData.id]);
                        if (updated.rows.length > 0) chatData = updated.rows[0];
                    }
                } catch (e) {}

                const noteText = `🔄 [Transferência para Setor] Atendimento transferido por ${finalCurrentName} para o setor *${cleanDept}*${targetAttendantName ? ` (Operador: ${targetAttendantName})` : ' (Fila do Setor)'}.${transferNote ? `\nMotivo: ${transferNote.trim()}` : ''}`;
                const noteId = `note_dept_${Date.now()}`;
                await HistoryService.saveMessage(botId, canonicalJid, 'internal_note', noteText, noteId, finalCurrentName);

                if (io) {
                    io.emit('chat-transferred', {
                        chat: chatData,
                        fromAttendantId: currentAttendantId,
                        fromAttendantName: finalCurrentName,
                        toAttendantId: finalAttendantId,
                        toAttendantName: targetAttendantName || `Fila de ${cleanDept}`,
                        toDepartment: cleanDept,
                        toQueue: !finalAttendantId,
                        note: transferNote
                    });
                    io.emit('chat-updated', chatData);
                    io.emit('whatsapp-message-received', {
                        botId,
                        contactJid: canonicalJid,
                        id: noteId,
                        role: 'internal_note',
                        senderName: finalCurrentName,
                        message: noteText,
                        content: noteText,
                        timestamp: Date.now()
                    });
                }

                if (notifyClient) {
                    try {
                        const transferMsg = `Seu atendimento foi transferido para o nosso setor de *${cleanDept}*${targetAttendantName ? ` com o(a) consultor(a) *${targetAttendantName}*` : ''}. Aguarde um instante! 🧑‍💻`;
                        const BotManagerService = require('./BotManagerService');
                        const botInstance = await BotManagerService.getBotInstance(botId);
                        if (botInstance && botInstance.isConnected) {
                            botInstance.sendMessage(canonicalJid, transferMsg, null, "Sistema").catch(err => console.error('Erro ao notificar cliente via WhatsApp:', err));
                        }
                    } catch (err) {
                        console.error('Erro ao enviar mensagem de transferência de setor:', err);
                    }
                }

                return chatData;
            }

            const isReturningToQueue = !targetAttendantId || targetAttendantId === 'queue' || targetAttendantId === 'waiting';

            if (isReturningToQueue) {
                // 2. Devolver para a Fila Geral de Espera
                const res = await db.query(`
                    UPDATE chats 
                    SET status = 'waiting', "attendantId" = NULL, "updatedAt" = $1, "contactJid" = $2, "needsHuman" = TRUE
                    WHERE "botId" = $3 AND "contactJid" = ANY($4)
                    RETURNING *
                `, [now, canonicalJid, botId, jidList]);

                if (res.rows.length === 0) return null;
                const chatData = res.rows[0];

                // Gravar nota interna com o motivo
                const noteText = `🔄 [Devolvido para Fila] Atendimento retornado para a fila de espera por ${finalCurrentName}.${transferNote ? `\nMotivo: ${transferNote.trim()}` : ''}`;
                const noteId = `note_queue_${Date.now()}`;
                await HistoryService.saveMessage(botId, canonicalJid, 'internal_note', noteText, noteId, finalCurrentName);

                if (io) {
                    io.emit('chat-transferred', {
                        chat: chatData,
                        fromAttendantId: currentAttendantId,
                        fromAttendantName: finalCurrentName,
                        toAttendantId: null,
                        toAttendantName: 'Fila Geral de Espera',
                        toQueue: true,
                        note: transferNote
                    });
                    io.emit('client-waiting', {
                        botId: botId,
                        contactJid: canonicalJid,
                        contactName: chatData.contactName || 'Cliente',
                        status: 'waiting',
                        timestamp: Date.now()
                    });
                    io.emit('chat-updated', chatData);
                    io.emit('whatsapp-message-received', {
                        botId,
                        contactJid: canonicalJid,
                        id: noteId,
                        role: 'internal_note',
                        senderName: finalCurrentName,
                        message: noteText,
                        content: noteText,
                        timestamp: Date.now()
                    });
                }

                return chatData;
            }

            // 3. Transferir para um atendente específico
            const userRes = await db.query('SELECT name FROM users WHERE id = $1', [targetAttendantId]);
            if (userRes.rows.length === 0) {
                throw new Error('Atendente de destino não encontrado no sistema.');
            }
            const targetAttendantName = userRes.rows[0].name;

            const res = await db.query(`
                UPDATE chats 
                SET status = 'attending', "attendantId" = $1, "updatedAt" = $2, "contactJid" = $3, "needsHuman" = FALSE
                WHERE "botId" = $4 AND "contactJid" = ANY($5)
                RETURNING *
            `, [targetAttendantId, now, canonicalJid, botId, jidList]);

            if (res.rows.length === 0) return null;
            const chatData = res.rows[0];
            chatData.attendantName = targetAttendantName;

            // Gravar nota interna sobre a transferência
            const noteText = `🔄 [Transferência de Atendimento] Transferido de ${finalCurrentName} para ${targetAttendantName}.${transferNote ? `\nMotivo: ${transferNote.trim()}` : ''}`;
            const noteId = `note_trans_${Date.now()}`;
            await HistoryService.saveMessage(botId, canonicalJid, 'internal_note', noteText, noteId, finalCurrentName);

            // 3. Emitir eventos do Socket.IO
            if (io) {
                io.emit('chat-transferred', {
                    chat: chatData,
                    fromAttendantId: currentAttendantId,
                    fromAttendantName: finalCurrentName,
                    toAttendantId: targetAttendantId,
                    toAttendantName: targetAttendantName,
                    toQueue: false,
                    note: transferNote
                });
                io.emit('chat-updated', chatData);
                io.emit('whatsapp-message-received', {
                    botId,
                    contactJid: canonicalJid,
                    id: noteId,
                    role: 'internal_note',
                    senderName: finalCurrentName,
                    message: noteText,
                    content: noteText,
                    timestamp: Date.now()
                });
            }

            // 4. Enviar mensagem via WhatsApp para o cliente informando a transferência (se habilitado)
            if (notifyClient) {
                try {
                    const { getSetting } = require('./DatabaseService');
                    const BotService = require('./BotService');
                    const bot = await BotService.getBot(botId);
                    const companyId = bot?.companyId || 'company_default';

                    let transferEnabledVal = await getSetting(`transferNoticeEnabled_${companyId}`);
                    if (transferEnabledVal === null || transferEnabledVal === undefined) {
                        transferEnabledVal = await getSetting('transferNoticeEnabled', 'true');
                    }
                    const transferEnabled = transferEnabledVal === 'true' || transferEnabledVal === true;

                    if (transferEnabled) {
                        const transferTemplate = (await getSetting(`transferMessageTemplate_${companyId}`)) || (await getSetting(
                            'transferMessageTemplate',
                            'Seu atendimento foi transferido para o(a) atendente *{atendente}*, que continuará o seu suporte a partir de agora. 🧑‍💻'
                        ));

                        const cleanPhone = canonicalJid.split('@')[0];
                        const transferMsg = transferTemplate
                            .replace(/{atendente}/g, targetAttendantName || 'Atendente')
                            .replace(/{nome}/g, chatData.contactName || 'Cliente')
                            .replace(/{telefone}/g, cleanPhone);

                        const BotManagerService = require('./BotManagerService');
                        const botInstance = await BotManagerService.getBotInstance(botId);
                        if (botInstance && botInstance.isConnected) {
                            botInstance.sendMessage(
                                canonicalJid,
                                transferMsg,
                                null,
                                "Sistema"
                            ).catch(err => console.error('❌ Erro ao enviar mensagem de transferência via WhatsApp:', err));
                        }
                    }
                } catch (err) {
                    console.error('❌ Erro ao obter instância do bot para mensagem de transferência:', err);
                }
            }

            return chatData;
        } catch (error) {
            console.error('❌ Erro no ChatService.transferChat:', error);
            throw error;
        }
    }

    async getChatStatus(botId, contactJid) {
        const db = getDatabase();
        if (!db) return 'waiting';

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            // Mesclar chats duplicados antes de qualquer operação
            await this.resolveAndMergeChats(db, botId, canonicalJid, jidList);

            const res = await db.query(
                'SELECT status FROM chats WHERE "botId" = $1 AND "contactJid" = ANY($2)',
                [botId, jidList]
            );
            if (res.rows.length === 0) return 'waiting';
            return res.rows[0].status;
        } catch (error) {
            console.error('❌ Erro ao ler status do chat:', error);
            return 'waiting';
        }
    }

    async getChatState(botId, contactJid) {
        const db = getDatabase();
        if (!db) return { status: 'waiting', needsHuman: false, attendantId: null, isAttending: false, isHumanAssigned: false };

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            const res = await db.query(
                'SELECT id, status, "needsHuman", "attendantId", "contactName" FROM chats WHERE "botId" = $1 AND "contactJid" = ANY($2) ORDER BY "updatedAt" DESC LIMIT 1',
                [botId, jidList]
            );

            if (res.rows.length === 0) {
                return { status: 'waiting', needsHuman: false, attendantId: null, isAttending: false, isHumanAssigned: false };
            }

            const chat = res.rows[0];
            const isAttending = chat.status === 'attending';
            const needsHuman = chat.needsHuman === true;
            const hasAttendant = Boolean(chat.attendantId);
            const isHumanAssigned = isAttending || needsHuman || hasAttendant;

            return {
                id: chat.id,
                status: chat.status,
                needsHuman,
                attendantId: chat.attendantId,
                isAttending,
                isHumanAssigned,
                contactName: chat.contactName
            };
        } catch (error) {
            console.error('❌ Erro ao ler estado do chat:', error);
            return { status: 'waiting', needsHuman: false, attendantId: null, isAttending: false, isHumanAssigned: false };
        }
    }

    async listChats(botId = null, companyId = null) {
        const db = getDatabase();
        if (!db) return [];

        try {
            let sql = `
                SELECT 
                    c.*, 
                    COALESCE(
                        NULLIF(CASE WHEN ct.name LIKE 'Contato %' OR ct.name ~ '^[0-9]+$' OR ct.name LIKE 'Cliente %' THEN NULL ELSE ct.name END, ''),
                        NULLIF(CASE WHEN c."contactName" LIKE 'Contato %' OR c."contactName" ~ '^[0-9]+$' OR c."contactName" LIKE 'Cliente %' THEN NULL ELSE c."contactName" END, ''),
                        NULLIF(ct.name, ''),
                        NULLIF(c."contactName", ''),
                        CASE 
                            WHEN c."contactJid" LIKE '%@instagram' THEN 'Instagram @' || right(split_part(c."contactJid", '@', 1), 6)
                            WHEN c."contactJid" LIKE '%@telegram' THEN 'Telegram @' || right(split_part(c."contactJid", '@', 1), 6)
                            ELSE split_part(c."contactJid", '@', 1)
                        END
                    ) as "contactName",
                    COALESCE(ct."profilePicUrl", c."profilePicUrl") as "profilePicUrl",
                    COALESCE(ct."phoneNumber", split_part(c."contactJid", '@', 1)) as "contactPhone",
                    u.name as "attendantName", 
                    b.name as "botName", 
                    b."companyId"
                FROM chats c
                LEFT JOIN LATERAL (
                    SELECT ct.name, ct."profilePicUrl", ct."phoneNumber"
                    FROM contacts ct
                    LEFT JOIN lid_mappings lm ON (lm.lid = c."contactJid" OR lm.jid = c."contactJid")
                    WHERE ct."botId" = c."botId" AND (
                        ct.jid = c."contactJid"
                        OR (lm.jid IS NOT NULL AND ct.jid = lm.jid)
                        OR ct."phoneNumber" = split_part(c."contactJid", '@', 1)
                        OR (lm.jid IS NOT NULL AND ct."phoneNumber" = split_part(lm.jid, '@', 1))
                        OR split_part(ct.jid, '@', 1) = split_part(c."contactJid", '@', 1)
                    )
                    ORDER BY 
                        CASE WHEN ct.name LIKE 'Contato %' OR ct.name ~ '^[0-9]+$' THEN 1 ELSE 0 END,
                        ct."updatedAt" DESC
                    LIMIT 1
                ) ct ON true
                LEFT JOIN users u ON c."attendantId" = u.id
                LEFT JOIN bots b ON c."botId" = b.id
            `;
            const conditions = [
                `c."contactJid" NOT LIKE '%@newsletter'`,
                `c."contactJid" NOT LIKE '%@broadcast'`,
                `c."contactJid" NOT LIKE '%@g.us%'`
            ];
            const params = [];
            let count = 1;

            if (botId) {
                conditions.push(`(c."botId" = $${count} OR (c.channel IN ('instagram', 'telegram') AND b."companyId" = (SELECT "companyId" FROM bots WHERE id = $${count})))`);
                params.push(botId);
                count++;
            }
            if (companyId) {
                conditions.push(`b."companyId" = $${count++}`);
                params.push(companyId);
            }

            if (conditions.length > 0) {
                sql += ` WHERE ` + conditions.join(' AND ');
            }
            sql += ` ORDER BY c."updatedAt" DESC`;

            const res = await db.query(sql, params);

            // Desduplicação estrita de chats retornados (mesmo bot + mesmo contato/telefone)
            const deduplicated = [];
            const seenKeys = new Set();
            for (const chat of res.rows) {
                const isOmni = (chat.contactJid || '').endsWith('@instagram') || (chat.contactJid || '').endsWith('@telegram');
                const cleanPhone = (chat.contactJid || '').split('@')[0].replace(/\D/g, '');
                const uniqueKey = isOmni
                    ? `${chat.contactJid}`
                    : (cleanPhone.length >= 8 ? `${chat.botId}_${cleanPhone.slice(-8)}` : `${chat.botId}_${chat.contactJid || chat.id}`);

                if (!seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    deduplicated.push(chat);
                }
            }

            return deduplicated;
        } catch (error) {
            console.error('❌ Erro ao listar chats:', error);
            return [];
        }
    }

    async recordCsat(botId, contactJid, rating, comment = null) {
        const db = getDatabase();
        if (!db) return false;

        try {
            const ContactService = require('./ContactService');
            let canonicalJid = contactJid;
            let alternateJid = null;

            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved) {
                    canonicalJid = resolved;
                    alternateJid = contactJid;
                }
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid) {
                    alternateJid = resolvedLid;
                }
            }

            const jidList = [canonicalJid];
            if (alternateJid) jidList.push(alternateJid);

            const res = await db.query(`
                UPDATE chats
                SET "csatRating" = $1, "csatComment" = $2, "updatedAt" = $3
                WHERE "botId" = $4 AND "contactJid" = ANY($5) AND status = 'finished'
                RETURNING id
            `, [rating, comment, new Date().toISOString(), botId, jidList]);

            return res.rowCount > 0;
        } catch (error) {
            console.error('❌ Erro ao gravar CSAT:', error);
            return false;
        }
    }

    async updateChatTags(botId, contactJid, tags) {
        const db = getDatabase();
        if (!db) return null;

        try {
            const ContactService = require('./ContactService');
            let jidList = [contactJid];
            if (contactJid.endsWith('@lid')) {
                const resolved = await ContactService.getJidByLid(contactJid);
                if (resolved && !jidList.includes(resolved)) jidList.push(resolved);
            } else if (contactJid.endsWith('@s.whatsapp.net')) {
                const resolvedLid = await ContactService.getLidByJid(contactJid);
                if (resolvedLid && !jidList.includes(resolvedLid)) jidList.push(resolvedLid);
            }

            const tagsJson = typeof tags === 'string' ? tags : JSON.stringify(tags || []);
            const now = new Date().toISOString();

            const res = await db.query(`
                UPDATE chats 
                SET tags = $1, "updatedAt" = $2
                WHERE "botId" = $3 AND "contactJid" = ANY($4)
                RETURNING *
            `, [tagsJson, now, botId, jidList]);

            if (res.rows.length === 0) return null;
            const updatedChat = res.rows[0];

            const io = this.getIo();
            if (io) {
                io.emit('chat:tags-updated', {
                    botId,
                    contactJid: updatedChat.contactJid || contactJid,
                    tags: updatedChat.tags
                });
                io.emit('chat-updated', updatedChat);
            }

            return updatedChat;
        } catch (error) {
            console.error('❌ Erro no ChatService.updateChatTags:', error);
            throw error;
        }
    }
}

module.exports = new ChatService();
