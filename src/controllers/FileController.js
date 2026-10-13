const fs = require('fs-extra');
const path = require('path');
const { DIRS } = require('../config');
const { convertToWhatsAppOgg } = require('../utils/audio');

class FileController {
    /**
     * Upload de arquivo para ser processado pela OpenAI futuramente
     * CORRIGIDO: Agora salva com extensão correta e converte áudio para .ogg Opus
     */
    async upload(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: 'Arquivo nao enviado' });
            
            const filePath = req.file.path;
            const originalName = req.file.originalname;
            
            // Extrair extensão do arquivo original
            const ext = path.extname(originalName).toLowerCase();
            
            // Se não tiver extensão, detectar pelo MIME type
            let finalExt = ext;
            if (!finalExt) {
                finalExt = this.getExtensionFromMimeType(req.file.mimetype);
            }
            
            // Caso seja áudio (por exemplo, gravado via MediaRecorder no frontend como .webm, ou enviado como .mp3, etc.)
            // convertemos para .ogg usando o nosso utilitário para compatibilidade nativa no WhatsApp
            const isAudio = ['.webm', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.amr'].includes(ext) || req.file.mimetype.startsWith('audio/');
            
            if (isAudio) {
                let newFileName = req.file.filename + '.ogg';
                let newFilePath = path.join(path.dirname(filePath), newFileName);
                
                try {
                    // Converter usando o utilitário compartilhado (Opus, Mono, VOIP)
                    await convertToWhatsAppOgg(filePath, newFilePath);
                    await fs.remove(filePath);
                    console.log(`[CONVERTIDO AUDIO] ${originalName} -> ${newFileName}`);
                } catch (convErr) {
                    console.error('[ERRO CONVERSAO AUDIO FFMPEG, mantendo original]', convErr.message);
                    newFileName = req.file.filename + (finalExt || '.webm');
                    newFilePath = filePath;
                }
                
                // Se foi enviado pelo chat para um contato específico, envia via WhatsApp
                let targetBotId = req.body.botId;
                const targetRecipient = req.body.to || req.body.contactJid;
                const userCompanyId = req.user?.role === 'superadmin' ? null : (req.user?.companyId || 'company_default');

                if (targetRecipient) {
                    try {
                        if (targetBotId && req.user?.role !== 'superadmin') {
                            const BotService = require('../services/BotService');
                            const bot = await BotService.getBot(targetBotId);
                            if (!bot || (bot.companyId || 'company_default') !== userCompanyId) {
                                return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                            }
                        }

                        const BotManagerService = require('../services/BotManagerService');
                        let botInstance = targetBotId ? await BotManagerService.getBotInstance(targetBotId) : null;
                        if (!botInstance || !botInstance.isConnected) {
                            const connectedBot = BotManagerService.getConnectedBotInstance(targetBotId, userCompanyId);
                            if (connectedBot) {
                                botInstance = connectedBot;
                                targetBotId = connectedBot.botId;
                            }
                        }
                        if (botInstance && botInstance.isConnected) {
                            const fileUrl = `/uploads/${newFileName}`;
                            const tag = `[AudioUrl:${fileUrl}]`;
                            await botInstance.sendMessage(targetRecipient, tag, req.body.quotedMsgId || null, req.user?.name || 'Operador');
                        }
                    } catch (sendErr) {
                        console.error('⚠️ [FileController] Erro ao enviar áudio para WhatsApp:', sendErr.message);
                    }
                }

                return res.json({
                    id: Date.now(),
                    originalName: originalName,
                    fileName: newFileName,
                    filePath: newFilePath,
                    fileUrl: `/uploads/${newFileName}`,
                    textFileName: '',
                    textFilePath: 'presente',
                    content: 'Áudio gravado e convertido com sucesso',
                    contentLength: req.file.size,
                    uploadedAt: new Date().toISOString()
                });
            }
            
            // Lógica normal para outros tipos de arquivo
            const newFileName = req.file.filename + finalExt;
            const newFilePath = path.join(path.dirname(filePath), newFileName);
            
            await fs.rename(filePath, newFilePath);
            
            console.log(`[OK] Arquivo recebido: ${originalName} (${req.file.size} bytes)`);
            console.log(`[SALVO] ${newFileName}`);
            
            // Se foi enviado pelo chat para um contato específico, envia via WhatsApp
            let targetBotId = req.body.botId;
            const targetRecipient = req.body.to || req.body.contactJid;
            const userCompanyId = req.user?.role === 'superadmin' ? null : (req.user?.companyId || 'company_default');

            if (targetRecipient) {
                try {
                    if (targetBotId && req.user?.role !== 'superadmin') {
                        const BotService = require('../services/BotService');
                        const bot = await BotService.getBot(targetBotId);
                        if (!bot || (bot.companyId || 'company_default') !== userCompanyId) {
                            return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                        }
                    }

                    const BotManagerService = require('../services/BotManagerService');
                    let botInstance = targetBotId ? await BotManagerService.getBotInstance(targetBotId) : null;
                    if (!botInstance || !botInstance.isConnected) {
                        const connectedBot = BotManagerService.getConnectedBotInstance(targetBotId, userCompanyId);
                        if (connectedBot) {
                            botInstance = connectedBot;
                            targetBotId = connectedBot.botId;
                        }
                    }
                    if (botInstance && botInstance.isConnected) {
                        const fileUrl = `/uploads/${newFileName}`;
                        let tag = '';
                        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(finalExt)) tag = `[ImageUrl:${fileUrl}]`;
                        else if (['.mp4', '.webm'].includes(finalExt)) tag = `[VideoUrl:${fileUrl}]`;
                        else tag = `[DocumentUrl:${fileUrl}|filename:${originalName}]`;

                        await botInstance.sendMessage(targetRecipient, tag, req.body.quotedMsgId || null, req.user?.name || 'Operador');
                    }
                } catch (sendErr) {
                    console.error('⚠️ [FileController] Erro ao enviar mídia para WhatsApp:', sendErr.message);
                }
            }

            // Se for documento de texto ou PDF, pré-extrai o conteúdo para RAG
            let extractedText = '';
            try {
                if (['.txt', '.csv', '.json', '.md'].includes(finalExt)) {
                    extractedText = (await fs.readFile(newFilePath, 'utf-8')).substring(0, 10000);
                } else if (finalExt === '.pdf') {
                    const pdfParse = require('pdf-parse');
                    const dataBuffer = await fs.readFile(newFilePath);
                    const pdfData = await pdfParse(dataBuffer);
                    if (pdfData && pdfData.text) {
                        extractedText = pdfData.text.substring(0, 10000);
                    }
                }
            } catch (extErr) {
                console.warn('[FileController] Aviso ao extrair texto do documento:', extErr.message);
            }

            res.json({
                id: Date.now(),
                originalName: originalName,
                fileName: newFileName,
                filePath: newFilePath,
                fileUrl: `/uploads/${newFileName}`,
                textFileName: '',
                textFilePath: 'presente',
                content: 'Arquivo processado com sucesso',
                extractedText: extractedText || null,
                contentLength: req.file.size,
                uploadedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('[ERRO] FileController.upload:', error);
            res.status(500).json({ error: 'Erro no upload: ' + error.message });
        }
    }
    
    /**
     * Detectar extensão pelo MIME type
     */
    getExtensionFromMimeType(mimeType) {
        const mimeMap = {
            'application/pdf': '.pdf',
            'text/plain': '.txt',
            'text/csv': '.csv',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
        };
        return mimeMap[mimeType] || '.bin';
    }

    /**
     * Lista as figurinhas vinculadas ao usuário autenticado (com fallback para as do bot/empresa)
     */
    async listStickers(req, res) {
        try {
            const userId = req.user?.id;
            let { botId } = req.query;
            const companyId = req.user?.role === 'superadmin' ? null : (req.user?.companyId || 'company_default');

            // Se botId foi informado, valida se pertence à empresa do usuário
            if (botId && botId !== 'all' && companyId) {
                const BotService = require('../services/BotService');
                const bot = await BotService.getBot(botId);
                if (!bot || bot.companyId !== companyId) {
                    return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                }
            }

            const StickerService = require('../services/StickerService');
            let stickerRows = [];
            if (userId) {
                stickerRows = await StickerService.listUserStickers(userId, botId, companyId);
            } else {
                stickerRows = await StickerService.listStickers(botId, companyId);
            }

            const stickers = stickerRows.map(item => item.url);
            res.json({ success: true, stickers, rows: stickerRows });
        } catch (error) {
            console.error('[ERRO] FileController.listStickers:', error);
            res.status(500).json({ error: 'Erro ao listar stickers: ' + error.message });
        }
    }

    /**
     * Upload de nova figurinha vinculado ao usuário (e opcionalmente ao bot)
     */
    async uploadSticker(req, res) {
        try {
            if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
            const userId = req.user?.id;
            const botId = req.body.botId;

            // Validação estrita de Tenant se botId foi fornecido
            if (botId && req.user?.role !== 'superadmin') {
                const BotService = require('../services/BotService');
                const bot = await BotService.getBot(botId);
                if (!bot || bot.companyId !== (req.user?.companyId || 'company_default')) {
                    return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                }
            }

            const fs = require('fs-extra');
            const path = require('path');
            const crypto = require('crypto');
            const { DIRS } = require('../config');
            const { convertToWhatsAppWebp } = require('../utils/sticker');
            const StickerService = require('../services/StickerService');

            const tempPath = req.file.path;
            const tempBuffer = await fs.readFile(tempPath);
            const fileHash = crypto.createHash('md5').update(tempBuffer).digest('hex');
            const newFilename = `usr_${userId || 'bot'}_stk_${fileHash}.webp`;
            const finalPath = path.join(DIRS.uploads, newFilename);

            try {
                await convertToWhatsAppWebp(tempPath, finalPath);
                await fs.remove(tempPath).catch(() => {});
            } catch (convErr) {
                console.warn('⚠️ [FileController] Erro na conversão para sticker via ffmpeg, mantendo original:', convErr.message);
                await fs.move(tempPath, finalPath, { overwrite: true });
            }

            const stickerUrl = `/uploads/${newFilename}`;
            let saved = null;

            if (userId) {
                saved = await StickerService.saveUserSticker(userId, stickerUrl, req.body.name || 'Figurinha Personalizada', fileHash);
            }
            if (botId) {
                await StickerService.saveSticker(botId, stickerUrl, req.body.name || 'Figurinha Personalizada', fileHash);
            }

            console.log(`✅ [FileController] Nova figurinha vinculada ao usuário ${userId}: ${newFilename}`);

            res.json({
                success: true,
                sticker: stickerUrl,
                fileUrl: stickerUrl,
                filename: newFilename,
                row: saved
            });
        } catch (error) {
            console.error('[ERRO] FileController.uploadSticker:', error);
            res.status(500).json({ error: 'Erro ao processar figurinha: ' + error.message });
        }
    }

    /**
     * Salva uma figurinha existente (ex: recebida no chat) para a coleção do usuário autenticado
     */
    async saveUserSticker(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ error: 'Usuário não autenticado' });

            let { url, name, botId } = req.body;
            if (!url) return res.status(400).json({ error: 'URL da figurinha não informada' });

            url = url.replace(/\[StickerUrl:/i, '').replace(/\]/g, '').trim();

            const StickerService = require('../services/StickerService');
            const saved = await StickerService.saveUserSticker(userId, url, name || 'Figurinha Salva');

            if (botId) {
                await StickerService.saveSticker(botId, url, name || 'Figurinha Salva');
            }

            res.json({ success: true, sticker: saved ? saved.url : url, row: saved });
        } catch (error) {
            console.error('[ERRO] FileController.saveUserSticker:', error);
            res.status(500).json({ error: 'Erro ao salvar figurinha: ' + error.message });
        }
    }

    /**
     * Deleta figurinha da coleção do usuário
     */
    async deleteSticker(req, res) {
        try {
            const userId = req.user?.id;
            const stickerId = req.params.id;
            const StickerService = require('../services/StickerService');

            if (userId) {
                await StickerService.deleteUserSticker(userId, stickerId);
            }
            res.json({ success: true });
        } catch (error) {
            console.error('[ERRO] FileController.deleteSticker:', error);
            res.status(500).json({ error: 'Erro ao deletar figurinha: ' + error.message });
        }
    }

    /**
     * Sincroniza / importa figurinhas da conexão ativa do bot
     */
    async syncStickers(req, res) {
        try {
            const { botId } = req.body;
            if (!botId) return res.status(400).json({ error: 'Parâmetro botId é obrigatório' });

            // Validação estrita de Tenant
            if (req.user?.role !== 'superadmin') {
                const BotService = require('../services/BotService');
                const bot = await BotService.getBot(botId);
                if (!bot || bot.companyId !== (req.user?.companyId || 'company_default')) {
                    return res.status(403).json({ error: 'Acesso negado: Este robô pertence a outra empresa.' });
                }
            }

            const BotManagerService = require('../services/BotManagerService');
            const botInstance = await BotManagerService.getBotInstance(botId);
            if (!botInstance) {
                return res.status(404).json({ error: 'Instância do bot não encontrada ou desconectada' });
            }

            const count = await botInstance.syncConnectionStickers();
            res.json({ success: true, count });
        } catch (error) {
            console.error('[ERRO] FileController.syncStickers:', error);
            res.status(500).json({ error: 'Erro ao sincronizar figurinhas da conexão: ' + error.message });
        }
    }
}

module.exports = new FileController();