const axios = require('axios');
const BotService = require('./BotService');
const ChatService = require('./ChatService');
const HistoryService = require('./HistoryService');
const ContactService = require('./ContactService');

class TelegramService {
    constructor(botId, io) {
        this.botId = botId;
        this.channel = 'telegram';
        this.io = io;
        this.isConnected = false;
        this.isPolling = false;
        this.config = null;
        this.botInfo = null;
        this.pollingOffset = 0;
        this.pollingTimeout = null;
        this.pollingAbortController = null;
    }

    get apiBase() {
        const token = this.config?.telegramToken;
        if (!token) return null;
        return `https://api.telegram.org/bot${token}`;
    }

    async start(forceNewAuth = false) {
        try {
            this.config = await BotService.getBot(this.botId);
            const token = this.config?.telegramToken;
            if (!token) {
                console.warn(`⚠️ [Telegram ${this.botId}] Nenhum telegramToken configurado.`);
                this.isConnected = false;
                this.emitStatus('disconnected');
                return false;
            }

            console.log(`🔌 [Telegram ${this.botId}] Validando token com Telegram API...`);
            const meRes = await axios.get(`${this.apiBase}/getMe`, { timeout: 10000 });
            if (meRes.data && meRes.data.ok) {
                this.botInfo = meRes.data.result;
                this.isConnected = true;
                console.log(`✅ [Telegram ${this.botId}] Conectado com sucesso como @${this.botInfo.username} (${this.botInfo.first_name})`);
                this.emitStatus('connected');

                // Inicia long polling contínuo
                this.startPolling();
                return true;
            } else {
                throw new Error('Resposta getMe inválida da API do Telegram');
            }
        } catch (error) {
            console.error(`❌ [Telegram ${this.botId}] Erro ao iniciar serviço do Telegram:`, error.message);
            this.isConnected = false;
            this.emitStatus('disconnected');
            return false;
        }
    }

    hasSavedCredentials() {
        return Boolean(this.config?.telegramToken);
    }

    async stop() {
        this.isPolling = false;
        this.isConnected = false;
        if (this.pollingAbortController) {
            try { this.pollingAbortController.abort(); } catch (_) {}
        }
        if (this.pollingTimeout) {
            clearTimeout(this.pollingTimeout);
            this.pollingTimeout = null;
        }
        console.log(`🛑 [Telegram ${this.botId}] Serviço do Telegram finalizado.`);
        this.emitStatus('disconnected');
        return true;
    }

    emitStatus(status) {
        if (this.io) {
            this.io.emit('bot_status_changed', {
                botId: this.botId,
                status,
                isConnected: this.isConnected,
                channel: 'telegram',
                botInfo: this.botInfo
            });
            this.io.emit('connection_status', {
                botId: this.botId,
                status,
                channel: 'telegram'
            });
        }
    }

    startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;

        const pollLoop = async () => {
            if (!this.isPolling || !this.isConnected || !this.apiBase) return;

            try {
                this.pollingAbortController = new AbortController();
                const res = await axios.get(`${this.apiBase}/getUpdates`, {
                    params: {
                        offset: this.pollingOffset,
                        timeout: 20
                    },
                    signal: this.pollingAbortController.signal,
                    timeout: 25000
                });

                if (res.data && res.data.ok && Array.isArray(res.data.result)) {
                    for (const update of res.data.result) {
                        this.pollingOffset = update.update_id + 1;
                        await this.handleUpdate(update).catch(err => {
                            console.error(`[Telegram ${this.botId}] Erro ao processar update ${update.update_id}:`, err.message);
                        });
                    }
                }
            } catch (err) {
                if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                    console.warn(`[Telegram ${this.botId}] Aviso no polling:`, err.message);
                }
            }

            if (this.isPolling) {
                this.pollingTimeout = setTimeout(pollLoop, 1000);
            }
        };

        pollLoop();
    }

    async handleUpdate(update) {
        const msg = update.message || update.edited_message;
        if (!msg || !msg.chat) return;

        const chatId = String(msg.chat.id);
        const contactJid = `${chatId}@telegram`;
        const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || `Telegram ${chatId}`;
        const messageId = `tg_${msg.message_id}`;

        let textContent = msg.text || msg.caption || '';
        let mediaUrl = null;
        let mediaType = null;

        if (msg.photo && msg.photo.length > 0) {
            mediaType = 'image';
            const largestPhoto = msg.photo[msg.photo.length - 1];
            mediaUrl = await this.getFileDirectUrl(largestPhoto.file_id);
            if (!textContent) textContent = '[Foto do Telegram]';
        } else if (msg.voice || msg.audio) {
            mediaType = 'audio';
            const audioObj = msg.voice || msg.audio;
            mediaUrl = await this.getFileDirectUrl(audioObj.file_id);
            if (!textContent) textContent = '[Áudio do Telegram]';
        } else if (msg.document) {
            mediaType = 'document';
            mediaUrl = await this.getFileDirectUrl(msg.document.file_id);
            if (!textContent) textContent = `[Documento: ${msg.document.file_name || 'arquivo'}]`;
        } else if (msg.sticker) {
            mediaType = 'sticker';
            mediaUrl = await this.getFileDirectUrl(msg.sticker.file_id);
            if (!textContent) textContent = '[Figurinha do Telegram]';
        }

        if (!textContent && !mediaUrl) return;

        // 1. Salva ou atualiza contato
        try {
            await ContactService.saveContact(this.botId, contactJid, senderName, null, 'telegram');
        } catch (_) {}

        // 2. Salva ou atualiza conversa no ChatService
        const chatData = await ChatService.createOrUpdateChat(
            this.botId,
            contactJid,
            senderName,
            'waiting',
            null,
            false,
            false,
            'telegram'
        );

        // 3. Salva no histórico unificado
        await HistoryService.saveMessage(
            this.botId,
            contactJid,
            'user',
            textContent,
            messageId,
            senderName,
            JSON.stringify(msg),
            'telegram'
        );

        // 4. Notifica o painel LiveChat via Socket.IO em tempo real
        if (this.io) {
            this.io.emit('whatsapp-message-received', {
                botId: this.botId,
                contactJid,
                contactName: senderName,
                id: messageId,
                role: 'user',
                message: textContent,
                content: textContent,
                timestamp: (msg.date ? msg.date * 1000 : Date.now()),
                channel: 'telegram',
                mediaUrl,
                mediaType,
                chat: chatData
            });
        }

        // Se o chat já está sendo atendido por um humano, não dispara automação do bot
        if (chatData && chatData.status === 'attending' && chatData.attendantId) {
            return;
        }

        // 5. Integração com URA (Central de Menus)
        const FlowService = require('./FlowService');
        const hasFlow = await FlowService.hasActiveFlow(this.botId);
        if (hasFlow) {
            const handled = await FlowService.handleIncomingMessage(this.botId, contactJid, textContent, this);
            if (handled) return;
        }

        // 6. Integração com Inteligência Artificial (OpenAI)
        if (this.config?.operationMode !== 'human_only' && this.config?.aiEnabled !== false) {
            try {
                const OpenAIService = require('./OpenAIService');
                const aiReply = await OpenAIService.generateResponse(this.botId, contactJid, textContent);
                if (aiReply && aiReply.trim()) {
                    await this.sendMessage(contactJid, aiReply, null, this.config?.name || 'IA Telegram');
                }
            } catch (aiErr) {
                console.error(`[Telegram ${this.botId}] Erro ao gerar resposta IA:`, aiErr.message);
            }
        }
    }

    async getFileDirectUrl(fileId) {
        if (!fileId || !this.apiBase) return null;
        try {
            const token = this.config?.telegramToken;
            const res = await axios.get(`${this.apiBase}/getFile`, { params: { file_id: fileId }, timeout: 8000 });
            if (res.data && res.data.ok && res.data.result?.file_path) {
                return `https://api.telegram.org/file/bot${token}/${res.data.result.file_path}`;
            }
        } catch (_) {}
        return null;
    }

    async sendMessage(to, text, quotedMsgId = null, senderName = null, extraOptions = {}) {
        if (!to || !text || !this.apiBase) return null;

        const chatId = to.replace('@telegram', '').replace('tg_', '');
        const messageToSend = String(text);

        const publicBase = process.env.PUBLIC_URL || 'https://www.zeplync.online';
        const isAlbumMsg = messageToSend.startsWith('[AlbumUrls:') && messageToSend.endsWith(']');
        const isImageMsg = messageToSend.startsWith('[ImageUrl:') && messageToSend.endsWith(']');

        const formatFullUrl = (u) => {
            if (!u) return '';
            if (u.startsWith('http://') || u.startsWith('https://')) return u;
            return `${publicBase}${u.startsWith('/') ? '' : '/'}${u}`;
        };

        try {
            let res;
            let sentMessageId = `tg_sent_${Date.now()}`;

            if (isAlbumMsg) {
                const inner = messageToSend.replace('[AlbumUrls:', '').replace(']', '');
                const parts = inner.split('|');
                const rawUrls = parts[0].split(',').map(u => u.trim()).filter(Boolean);
                const captionPart = parts.find(p => p.startsWith('caption:'));
                const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : undefined;

                if (rawUrls.length === 1) {
                    res = await axios.post(`${this.apiBase}/sendPhoto`, {
                        chat_id: chatId,
                        photo: formatFullUrl(rawUrls[0]),
                        caption: caption || undefined
                    }, { timeout: 15000 });
                    sentMessageId = `tg_sent_${res.data?.result?.message_id || Date.now()}`;
                } else if (rawUrls.length > 1) {
                    const media = rawUrls.slice(0, 10).map((u, idx) => ({
                        type: 'photo',
                        media: formatFullUrl(u),
                        caption: (idx === 0 && caption) ? caption : undefined
                    }));
                    res = await axios.post(`${this.apiBase}/sendMediaGroup`, {
                        chat_id: chatId,
                        media
                    }, { timeout: 20000 });
                    sentMessageId = `tg_sent_${res.data?.result?.[0]?.message_id || Date.now()}`;
                }
            } else if (isImageMsg) {
                const inner = messageToSend.replace('[ImageUrl:', '').replace(']', '');
                const parts = inner.split('|');
                const imageUrl = parts[0];
                const captionPart = parts.find(p => p.startsWith('caption:'));
                const caption = captionPart ? decodeURIComponent(captionPart.replace('caption:', '')) : undefined;

                res = await axios.post(`${this.apiBase}/sendPhoto`, {
                    chat_id: chatId,
                    photo: formatFullUrl(imageUrl),
                    caption: caption || undefined
                }, { timeout: 15000 });
                sentMessageId = `tg_sent_${res.data?.result?.message_id || Date.now()}`;
            } else {
                try {
                    // Tenta enviar com formatação Markdown
                    res = await axios.post(`${this.apiBase}/sendMessage`, {
                        chat_id: chatId,
                        text: messageToSend,
                        parse_mode: 'Markdown'
                    }, { timeout: 10000 });
                } catch (mdErr) {
                    // Fallback para texto puro caso contenha caracteres especiais de markdown não escapados
                    res = await axios.post(`${this.apiBase}/sendMessage`, {
                        chat_id: chatId,
                        text: messageToSend
                    }, { timeout: 10000 });
                }
                sentMessageId = `tg_sent_${res.data?.result?.message_id || Date.now()}`;
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
                'telegram'
            );

            // Emite para o Socket.IO para atualizar tela do LiveChat
            if (this.io) {
                this.io.emit('whatsapp-message-received', {
                    botId: this.botId,
                    contactJid: to,
                    id: sentMessageId,
                    role: 'assistant',
                    senderName: senderName || 'Atendente',
                    message: messageToSend,
                    content: messageToSend,
                    timestamp: Date.now(),
                    channel: 'telegram'
                });
            }

            return {
                id: sentMessageId,
                messageId: sentMessageId,
                content: messageToSend,
                channel: 'telegram'
            };
        } catch (error) {
            console.error(`❌ [Telegram ${this.botId}] Erro ao enviar mensagem para ${to}:`, error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = TelegramService;
