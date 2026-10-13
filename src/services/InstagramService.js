const axios = require('axios');
const BotService = require('./BotService');
const ChatService = require('./ChatService');
const HistoryService = require('./HistoryService');
const ContactService = require('./ContactService');

class InstagramService {
    constructor(botId, io, initialConfig = null) {
        this.botId = botId;
        this.channel = 'instagram';
        this.io = io;
        this.isConnected = false;
        this.config = initialConfig;
        this.pageInfo = null;
        this.userProfileCache = new Map();
    }

    get apiBase() {
        return 'https://graph.facebook.com/v20.0';
    }

    async start(forceNewAuth = false) {
        try {
            this.config = await BotService.getBot(this.botId);
            const token = this.config?.instagramAccessToken;
            let pageId = this.config?.instagramPageId;

            if (!token) {
                console.warn(`⚠️ [Instagram ${this.botId}] instagramAccessToken não configurado.`);
                this.isConnected = false;
                this.emitStatus('disconnected');
                return false;
            }

            console.log(`🔌 [Instagram ${this.botId}] Validando credenciais na Meta Graph API...`);
            let pageData = null;

            // 1. Tenta obter informações diretamente de /me (que sempre é resolvido para a Página vinculada ao Page Token)
            try {
                const meRes = await axios.get(`${this.apiBase}/me`, {
                    params: {
                        access_token: token,
                        fields: 'id,name,instagram_business_account{id,username,name}'
                    },
                    timeout: 10000
                });
                if (meRes.data && meRes.data.id) {
                    pageData = meRes.data;
                    const realPageId = meRes.data.id;
                    // Sincroniza no banco caso o usuário tenha inserido outro ID manualmente
                    if (this.config.instagramPageId !== realPageId) {
                        try {
                            const { getDatabase } = require('./DatabaseService');
                            const db = getDatabase();
                            if (db) {
                                await db.query('UPDATE bots SET "instagramPageId" = $1 WHERE id = $2', [realPageId, this.botId]);
                                this.config.instagramPageId = realPageId;
                                pageId = realPageId;
                            }
                        } catch (_) {}
                    }
                }
            } catch (meErr) {
                console.warn(`ℹ️ [Instagram ${this.botId}] Consulta a /me falhou, tentando fallback com pageId:`, meErr.message);
            }

            // 2. Se /me não retornou os dados, tenta buscar pelo pageId configurado
            if (!pageData && pageId) {
                try {
                    const pageRes = await axios.get(`${this.apiBase}/${pageId}`, {
                        params: {
                            access_token: token,
                            fields: 'id,name,instagram_business_account{id,username,name}'
                        },
                        timeout: 10000
                    });
                    pageData = pageRes.data;
                } catch (pageErr) {
                    // Fallback para caso seja o ID do Instagram diretamente
                    const directRes = await axios.get(`${this.apiBase}/${pageId}`, {
                        params: {
                            access_token: token,
                            fields: 'id,name,username'
                        },
                        timeout: 10000
                    });
                    pageData = directRes.data;
                }
            }

            if (pageData && pageData.id) {
                this.pageInfo = pageData;
                this.isConnected = true;
                const igAccount = pageData.instagram_business_account;
                const igUserLabel = igAccount ? `(@${igAccount.username || igAccount.id})` : '';
                console.log(`✅ [Instagram ${this.botId}] Conectado à Página "${this.pageInfo.name}" (${this.pageInfo.id}) ${igUserLabel}`);

                // Sincroniza tanto instagramPageId quanto instagramAccountId no banco de dados
                try {
                    const { getDatabase } = require('./DatabaseService');
                    const db = getDatabase();
                    if (db) {
                        const igAccountId = igAccount?.id ? String(igAccount.id).trim() : null;
                        const realPageId = String(pageData.id).trim();
                        await db.query(
                            'UPDATE bots SET "instagramPageId" = $1, "instagramAccountId" = COALESCE($2, "instagramAccountId") WHERE id = $3',
                            [realPageId, igAccountId, this.botId]
                        );
                        if (this.config) {
                            this.config.instagramPageId = realPageId;
                            if (igAccountId) this.config.instagramAccountId = igAccountId;
                        }
                    }
                } catch (syncErr) {
                    console.warn(`[Instagram ${this.botId}] Aviso ao sincronizar IDs no banco:`, syncErr.message);
                }

                // Inscrever automaticamente o aplicativo para receber webhooks de mensagens
                try {
                    await axios.post(`${this.apiBase}/${this.pageInfo.id}/subscribed_apps`, null, {
                        params: {
                            subscribed_fields: 'messages,messaging_postbacks,message_deliveries,message_reads',
                            access_token: token
                        },
                        timeout: 10000
                    });
                    console.log(`✅ [Instagram ${this.botId}] Subscrito com sucesso a eventos da Página via subscribed_apps`);
                } catch (subErr) {
                    console.warn(`⚠️ [Instagram ${this.botId}] Aviso ao subscrever app na página:`, subErr.response?.data?.error?.message || subErr.message);
                }

                this.emitStatus('connected');
                return true;
            } else {
                throw new Error('Página do Instagram não encontrada com as credenciais fornecidas');
            }
        } catch (error) {
            console.error(`❌ [Instagram ${this.botId}] Erro ao conectar ao Instagram Direct:`, error.response?.data || error.message);
            this.isConnected = false;
            this.emitStatus('disconnected');
            return false;
        }
    }

    hasSavedCredentials() {
        return Boolean(this.config?.instagramAccessToken);
    }

    async stop() {
        this.isConnected = false;
        console.log(`🛑 [Instagram ${this.botId}] Conexão Instagram pausada.`);
        this.emitStatus('disconnected');
        return true;
    }

    emitStatus(status) {
        if (this.io) {
            this.io.emit('bot_status_changed', {
                botId: this.botId,
                status,
                isConnected: this.isConnected,
                channel: 'instagram',
                pageInfo: this.pageInfo
            });
            this.io.emit('connection_status', {
                botId: this.botId,
                status,
                channel: 'instagram'
            });
        }
    }

    /**
     * Busca dados reais do usuário do Instagram (Nome, @username, foto de perfil)
     */
    async getUserProfile(senderId) {
        if (!senderId) return null;
        if (this.userProfileCache?.has(senderId)) {
            return this.userProfileCache.get(senderId);
        }
        const token = this.config?.instagramAccessToken;
        if (!token) return null;

        try {
            const res = await axios.get(`${this.apiBase}/${senderId}`, {
                params: {
                    fields: 'name,username,profile_pic',
                    access_token: token
                },
                timeout: 8000
            });
            if (res.data) {
                if (!this.userProfileCache) this.userProfileCache = new Map();
                this.userProfileCache.set(senderId, res.data);
                return res.data;
            }
        } catch (err) {
            console.warn(`[Instagram ${this.botId}] Não foi possível obter perfil de ${senderId}:`, err.message);
        }
        return null;
    }

    /**
     * Processa anexos de mídia (áudio, foto, vídeo, figurinha) e baixa para uploads locais
     */
    async processAttachments(attachments) {
        if (!Array.isArray(attachments) || attachments.length === 0) return '';
        const fs = require('fs-extra');
        const path = require('path');
        const uploadsDir = path.join(process.cwd(), 'uploads');
        await fs.ensureDir(uploadsDir);

        const formattedParts = [];

        for (const att of attachments) {
            const type = att.type; // 'image', 'audio', 'video', 'file', 'animated_image' (sticker)
            const rawUrl = att.payload?.url;
            if (!rawUrl) continue;

            let localUrl = rawUrl;
            try {
                let ext = 'dat';
                if (type === 'image') ext = 'jpg';
                else if (type === 'audio') ext = 'mp3';
                else if (type === 'video') ext = 'mp4';
                else if (type === 'animated_image') ext = 'webp';
                
                const fileName = `ig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
                const filePath = path.join(uploadsDir, fileName);

                const response = await axios.get(rawUrl, { responseType: 'arraybuffer', timeout: 15000 });
                await fs.writeFile(filePath, Buffer.from(response.data));
                localUrl = `/uploads/${fileName}`;
            } catch (dlErr) {
                console.warn(`[Instagram Media] Usando URL remota do CDN:`, dlErr.message);
                localUrl = rawUrl;
            }

            if (type === 'image') {
                formattedParts.push(`[ImageUrl:${localUrl}]`);
            } else if (type === 'audio') {
                formattedParts.push(`[AudioUrl:${localUrl}]`);
            } else if (type === 'video') {
                formattedParts.push(`[VideoUrl:${localUrl}]`);
            } else if (type === 'animated_image') {
                formattedParts.push(`[StickerUrl:${localUrl}]`);
            } else {
                formattedParts.push(`[DocumentUrl:${localUrl}|filename:Arquivo_${Date.now()}]`);
            }
        }

        return formattedParts.join('\n');
    }

    /**
     * Processa webhook recebido da Meta Graph API para Instagram
     */
    async handleWebhookEvent(entry) {
        if (!entry) return;

        // Suporta os 3 formatos de entrega do Graph API / Instagram Platform:
        // 1. entry.messaging (padrão)
        // 2. entry.standby (Handover Protocol quando gerenciado pelo Meta Business Suite)
        // 3. entry.changes (quando recebido via feed de alterações)
        let rawEvents = [];
        if (Array.isArray(entry.messaging)) {
            rawEvents = entry.messaging;
        } else if (Array.isArray(entry.standby)) {
            rawEvents = entry.standby;
        } else if (Array.isArray(entry.changes)) {
            rawEvents = entry.changes
                .filter(c => c && (c.field === 'messages' || c.value?.message || c.value?.messaging))
                .map(c => c.value?.messaging || c.value || c)
                .flat();
        }

        if (!Array.isArray(rawEvents) || rawEvents.length === 0) return;

        const chatIo = ChatService.getIo(this.botId) || this.io;

        for (const item of rawEvents) {
            if (!item) continue;
            const message = item.message;
            if (!message) continue;

            const isEcho = Boolean(message.is_echo);
            
            // Se for echo (mensagem enviada pela própria página/atendente pelo app ou Meta Business Suite):
            // O contato é o recipient, e o remetente é o assistente/atendente
            const contactId = isEcho ? item.recipient?.id : item.sender?.id;
            if (!contactId) continue;

            const contactJid = `${contactId}@instagram`;
            const messageId = message.mid || `ig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

            // Processa texto e mídias anexadas
            let textContent = message.text || '';
            if (message.attachments) {
                const mediaContent = await this.processAttachments(message.attachments);
                if (mediaContent) {
                    textContent = textContent ? `${textContent}\n${mediaContent}` : mediaContent;
                } else if (!textContent) {
                    textContent = '[Mídia do Instagram Direct]';
                }
            }

            if (isEcho) {
                // Mensagem enviada pelo operador pelo Instagram Oficial / Meta Business Suite ou encerramento
                const attendantName = this.pageInfo?.name || this.config?.name || 'Atendente Instagram';
                
                await HistoryService.saveMessage(
                    this.botId,
                    contactJid,
                    'assistant',
                    textContent,
                    messageId,
                    attendantName,
                    JSON.stringify(item),
                    'instagram'
                );

                // Consulta se chat já existe para não alterar status de chat finalizado nem sobrescrever nome
                const { getDatabase } = require('./DatabaseService');
                const db = getDatabase();
                let existingChat = null;
                if (db) {
                    const res = await db.query(
                        'SELECT * FROM chats WHERE "botId" = $1 AND "contactJid" = $2 ORDER BY "updatedAt" DESC LIMIT 1',
                        [this.botId, contactJid]
                    );
                    existingChat = res.rows[0];
                }

                // Se o chat está finalizado, NÃO reabre nem muda para attending/waiting!
                if (existingChat && existingChat.status === 'finished') {
                    if (chatIo) {
                        const echoPayload = {
                            botId: this.botId,
                            contactJid,
                            contactName: existingChat.contactName || `Instagram @${contactId.slice(-6)}`,
                            id: messageId,
                            role: 'assistant',
                            senderName: attendantName,
                            message: textContent,
                            content: textContent,
                            timestamp: item.timestamp || Date.now(),
                            channel: 'instagram',
                            chat: existingChat
                        };
                        chatIo.emit('whatsapp-message-received', echoPayload);
                        chatIo.emit('whatsapp-message-sent', echoPayload);
                        if (this.io && this.io !== chatIo) {
                            this.io.emit('whatsapp-message-received', echoPayload);
                            this.io.emit('whatsapp-message-sent', echoPayload);
                        }
                    }
                    continue;
                }

                const chatData = await ChatService.createOrUpdateChat(
                    this.botId,
                    contactJid,
                    existingChat?.contactName || null,
                    existingChat ? existingChat.status : 'attending',
                    existingChat?.profilePicUrl || null,
                    false,
                    false,
                    'instagram'
                );

                if (chatIo) {
                    if (chatData) chatIo.emit('chat-updated', chatData);
                    const echoPayload = {
                        botId: this.botId,
                        contactJid,
                        contactName: chatData?.contactName || existingChat?.contactName || `Instagram @${contactId.slice(-6)}`,
                        id: messageId,
                        role: 'assistant',
                        senderName: attendantName,
                        message: textContent,
                        content: textContent,
                        timestamp: item.timestamp || Date.now(),
                        channel: 'instagram',
                        chat: chatData || existingChat
                    };
                    chatIo.emit('whatsapp-message-received', echoPayload);
                    chatIo.emit('whatsapp-message-sent', echoPayload);
                    if (this.io && this.io !== chatIo) {
                        this.io.emit('whatsapp-message-received', echoPayload);
                        this.io.emit('whatsapp-message-sent', echoPayload);
                    }
                }
                continue;
            }

            // Mensagem recebida do cliente
            const profile = await this.getUserProfile(contactId);
            let senderName = null;
            let profilePicUrl = null;

            if (profile) {
                profilePicUrl = profile.profile_pic || null;
                if (profile.name && profile.username) {
                    senderName = `${profile.name} (@${profile.username})`;
                } else if (profile.username) {
                    senderName = `@${profile.username}`;
                } else if (profile.name) {
                    senderName = profile.name;
                }
            }

            // Busca chat existente para preservar nome e foto caso Graph API venha parcial
            const { getDatabase } = require('./DatabaseService');
            const db = getDatabase();
            let previousChat = null;
            if (db) {
                const res = await db.query(
                    'SELECT * FROM chats WHERE "botId" = $1 AND "contactJid" = $2 ORDER BY "updatedAt" DESC LIMIT 1',
                    [this.botId, contactJid]
                );
                previousChat = res.rows[0];
            }

            const { isValidContactName } = require('../utils/helpers');
            if (!isValidContactName(senderName) && previousChat && isValidContactName(previousChat.contactName)) {
                senderName = previousChat.contactName;
            }
            if (!profilePicUrl && previousChat?.profilePicUrl) {
                profilePicUrl = previousChat.profilePicUrl;
            }
            if (!senderName) {
                senderName = `Instagram @${contactId.slice(-6)}`;
            }

            // 1. Salva ou atualiza contato com nome e foto reais
            try {
                await ContactService.saveContact(this.botId, contactJid, senderName, profilePicUrl, 'instagram');
            } catch (cErr) {
                console.warn('[Instagram Contact] Aviso ao salvar contato:', cErr.message);
            }

            // 2. Verifica se o chat anterior estava finalizado e se é avaliação CSAT
            let isNewSession = false;
            if (!previousChat) {
                isNewSession = true;
            } else if (previousChat.status === 'finished') {
                const { getSetting } = require('./DatabaseService');
                const botCompanyId = this.config?.companyId || 'company_default';
                let csatEnabledVal = await getSetting(`csatEnabled_${botCompanyId}`);
                if (csatEnabledVal === null || csatEnabledVal === undefined) {
                    csatEnabledVal = await getSetting('csatEnabled', 'false');
                }
                const csatEnabled = csatEnabledVal === 'true';

                // Avaliação de 1 a 5 estrelas
                const ratingMatch = textContent && textContent.trim().match(/^(?:nota\s*|⭐\s*)?([1-5])(?:\s*(?:estrelas?|stars?))?(?:\s*[-–/:]\s*(.*))?$/i);

                if (csatEnabled && previousChat.csatRating === null && ratingMatch) {
                    const rating = parseInt(ratingMatch[1], 10);
                    const comment = ratingMatch[2] ? ratingMatch[2].trim() : null;
                    await ChatService.recordCsat(this.botId, contactJid, rating, comment);
                    await HistoryService.saveMessage(this.botId, contactJid, 'user', textContent, messageId, senderName, JSON.stringify(item), 'instagram');

                    const csatThanksTemplate = (await getSetting(`csatThanksTemplate_${botCompanyId}`)) || (await getSetting(
                        'csatThanksTemplate',
                        '⭐ Muito obrigado pela sua avaliação! Sua nota *{nota}/5* foi registrada com sucesso e nos ajuda a melhorar cada vez mais nosso atendimento.'
                    ));
                    const botOfficialName = this.pageInfo?.name || this.config?.name || 'Assistente Virtual';
                    const thanksMsg = csatThanksTemplate
                        .replace(/{nota}/g, String(rating))
                        .replace(/{nome}/g, senderName || 'Cliente');

                    await this.sendMessage(contactJid, thanksMsg, null, botOfficialName);
                    continue;
                }
                isNewSession = true;
            }

            // 3. Salva ou atualiza conversa no ChatService
            const chatData = await ChatService.createOrUpdateChat(
                this.botId,
                contactJid,
                senderName,
                'waiting',
                profilePicUrl,
                false,
                isNewSession,
                'instagram'
            );

            // 3. Salva no histórico unificado
            await HistoryService.saveMessage(
                this.botId,
                contactJid,
                'user',
                textContent,
                messageId,
                senderName,
                JSON.stringify(item),
                'instagram'
            );

            // 4. Notifica o painel LiveChat via Socket.IO em tempo real
            if (chatIo) {
                if (chatData) {
                    chatIo.emit('chat-updated', chatData);
                    if (chatData.status === 'waiting') {
                        chatIo.emit('client-waiting', {
                            chatId: chatData.id,
                            botId: this.botId,
                            contactJid,
                            contactName: senderName,
                            profilePicUrl,
                            status: 'waiting',
                            needsHuman: Boolean(chatData.needsHuman),
                            timestamp: Date.now()
                        });
                    }
                }
                const msgPayload = {
                    botId: this.botId,
                    contactJid,
                    contactName: senderName,
                    id: messageId,
                    role: 'user',
                    message: textContent,
                    content: textContent,
                    timestamp: item.timestamp || Date.now(),
                    channel: 'instagram',
                    chat: chatData
                };
                chatIo.emit('whatsapp-message-received', msgPayload);
                if (this.io && this.io !== chatIo) {
                    this.io.emit('whatsapp-message-received', msgPayload);
                }
            }

            // Se o chat já está em atendimento humano, não aciona URA ou IA
            if (chatData && chatData.status === 'attending' && chatData.attendantId) {
                continue;
            }

            // 5. Integração com URA (Central de Menus)
            const FlowService = require('./FlowService');
            const hasFlow = await FlowService.hasActiveFlow(this.botId);
            if (hasFlow) {
                const handled = await FlowService.handleIncomingMessage(this.botId, contactJid, textContent, this);
                if (handled) continue;
            }

            // 6. Integração com IA (OpenAI)
            if (this.config?.operationMode !== 'human_only' && this.config?.aiEnabled !== false) {
                try {
                    const OpenAIService = require('./OpenAIService');
                    const aiReply = await OpenAIService.generateResponse(this.botId, contactJid, textContent);
                    if (aiReply && aiReply.trim()) {
                        await this.sendMessage(contactJid, aiReply, null, this.config?.name || 'IA Instagram');
                    }
                } catch (aiErr) {
                    console.error(`[Instagram ${this.botId}] Erro ao gerar resposta IA:`, aiErr.message);
                }
            }
        }
    }

    /**
     * Envia payload para a Meta Graph API com fallback automático para HUMAN_AGENT caso a janela de 24h tenha fechado
     */
    async sendGraphApiMessage(payload) {
        const token = this.config?.instagramAccessToken;
        if (!token) throw new Error('Token de acesso do Instagram não configurado.');

        try {
            const res = await axios.post(`${this.apiBase}/me/messages`, {
                messaging_type: 'RESPONSE',
                ...payload
            }, {
                params: { access_token: token },
                timeout: 15000
            });
            return res.data;
        } catch (err) {
            const errCode = err.response?.data?.error?.code;
            const subCode = err.response?.data?.error?.error_subcode;
            // Se erro de janela de 24 horas (#10 ou subcode 2018278), tenta tag HUMAN_AGENT
            if (errCode === 10 || subCode === 2018278) {
                console.warn(`⚠️ [Instagram ${this.botId}] Janela padrão de 24h fechada. Tentando envio com tag HUMAN_AGENT...`);
                try {
                    const fallbackRes = await axios.post(`${this.apiBase}/me/messages`, {
                        messaging_type: 'MESSAGE_TAG',
                        tag: 'HUMAN_AGENT',
                        ...payload
                    }, {
                        params: { access_token: token },
                        timeout: 15000
                    });
                    return fallbackRes.data;
                } catch (fallbackErr) {
                    console.error(`❌ [Instagram ${this.botId}] Falha no fallback HUMAN_AGENT:`, fallbackErr.response?.data || fallbackErr.message);
                    throw (fallbackErr.response?.data?.error?.message ? new Error(fallbackErr.response.data.error.message) : fallbackErr);
                }
            }
            const errMsg = err.response?.data?.error?.message;
            throw (errMsg ? new Error(errMsg) : err);
        }
    }

    async sendMessage(to, text, quotedMsgId = null, senderName = null, extraOptions = {}) {
        if (!to || !text) return null;

        const recipientId = to.replace('@instagram', '').replace('ig_', '');
        const messageToSend = String(text);

        try {
            const publicBase = process.env.PUBLIC_URL || 'https://www.zeplync.online';
            const isAlbumMsg = messageToSend.startsWith('[AlbumUrls:') && messageToSend.endsWith(']');
            const isImageMsg = messageToSend.startsWith('[ImageUrl:') && messageToSend.endsWith(']');

            const formatFullUrl = (u) => {
                if (!u) return '';
                if (u.startsWith('http://') || u.startsWith('https://')) return u;
                return `${publicBase}${u.startsWith('/') ? '' : '/'}${u}`;
            };

            let sentMessageId = `ig_sent_${Date.now()}`;

            if (isAlbumMsg) {
                const inner = messageToSend.replace('[AlbumUrls:', '').replace(']', '');
                const parts = inner.split('|');
                const rawUrls = parts[0].split(',').map(u => u.trim()).filter(Boolean);
                const captionPart = parts.find(p => p.startsWith('caption:'));
                const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : undefined;

                for (const imgUrl of rawUrls) {
                    const fullUrl = formatFullUrl(imgUrl);
                    const resData = await this.sendGraphApiMessage({
                        recipient: { id: recipientId },
                        message: {
                            attachment: {
                                type: 'image',
                                payload: { url: fullUrl, is_reusable: true }
                            }
                        }
                    });
                    if (resData?.message_id) sentMessageId = resData.message_id;
                }

                if (caption) {
                    await this.sendGraphApiMessage({
                        recipient: { id: recipientId },
                        message: { text: caption }
                    });
                }
            } else if (isImageMsg) {
                const inner = messageToSend.replace('[ImageUrl:', '').replace(']', '');
                const parts = inner.split('|');
                const imageUrl = parts[0];
                const captionPart = parts.find(p => p.startsWith('caption:'));
                const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : undefined;

                const fullUrl = formatFullUrl(imageUrl);
                const resData = await this.sendGraphApiMessage({
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { url: fullUrl, is_reusable: true }
                        }
                    }
                });
                if (resData?.message_id) sentMessageId = resData.message_id;

                if (caption) {
                    await this.sendGraphApiMessage({
                        recipient: { id: recipientId },
                        message: { text: caption }
                    });
                }
            } else {
                const resData = await this.sendGraphApiMessage({
                    recipient: { id: recipientId },
                    message: { text: messageToSend }
                });
                if (resData?.message_id) sentMessageId = resData.message_id;
            }

            // Salva no histórico unificado
            await HistoryService.saveMessage(
                this.botId,
                to,
                'assistant',
                messageToSend,
                sentMessageId,
                senderName || this.config?.name || 'Atendente',
                null,
                'instagram'
            );

            // Emite para o Socket.IO para atualizar tela do LiveChat
            const chatIo = ChatService.getIo(this.botId) || this.io;
            if (chatIo) {
                const emitPayload = {
                    botId: this.botId,
                    contactJid: to,
                    id: sentMessageId,
                    role: 'assistant',
                    senderName: senderName || 'Atendente',
                    message: messageToSend,
                    content: messageToSend,
                    timestamp: Date.now(),
                    channel: 'instagram'
                };
                chatIo.emit('whatsapp-message-received', emitPayload);
                chatIo.emit('whatsapp-message-sent', emitPayload);
                if (this.io && this.io !== chatIo) {
                    this.io.emit('whatsapp-message-received', emitPayload);
                    this.io.emit('whatsapp-message-sent', emitPayload);
                }
            }

            return {
                id: sentMessageId,
                messageId: sentMessageId,
                content: messageToSend,
                channel: 'instagram'
            };
        } catch (error) {
            console.error(`❌ [Instagram ${this.botId}] Erro ao enviar Direct para ${to}:`, error.message);
            throw error;
        }
    }
}

module.exports = InstagramService;
