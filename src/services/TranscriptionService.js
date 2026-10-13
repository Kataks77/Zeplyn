const fs = require('fs-extra');
const path = require('path');
const OpenAI = require('openai');
const { getSetting } = require('./DatabaseService');
const { decrypt } = require('../utils/crypto');

class TranscriptionService {
    /**
     * Obtém as configurações e credenciais ativas para transcrição de áudio
     */
    async getTranscriptionConfig(botId = null) {
        // 1. Provedor configurado: 'groq' (grátis), 'openai' ou 'disabled'
        const preferredProvider = await getSetting('transcriptionProvider', 'groq');

        // 2. Chave do Groq (Prioridade para transcrição 100% gratuita / R$ 0,00)
        let groqKeyRaw = await getSetting('groqApiKey');
        let groqKey = groqKeyRaw ? (groqKeyRaw.includes(':') ? decrypt(groqKeyRaw) : groqKeyRaw) : null;
        if (!groqKey || groqKey.includes('•••') || groqKey === 'sua_api_key_aqui') {
            groqKey = process.env.GROQ_API_KEY || null;
        }

        // 3. Chave da OpenAI (Global ou por Bot)
        let openaiKey = null;
        if (botId) {
            try {
                const BotService = require('./BotService');
                const bot = await BotService.getBot(botId);
                const botKey = bot?.openaiApiKey ? (bot.openaiApiKey.includes(':') ? decrypt(bot.openaiApiKey) : bot.openaiApiKey) : null;
                if (botKey && botKey.startsWith('sk-') && !botKey.includes('•••')) {
                    openaiKey = botKey;
                }
            } catch (err) {
                console.warn('[TranscriptionService] Aviso ao buscar chave do bot:', err.message);
            }
        }

        if (!openaiKey) {
            let dbKeyRaw = await getSetting('openaiApiKey');
            if (!dbKeyRaw) dbKeyRaw = await getSetting('openai_api_key');
            const dbKey = dbKeyRaw ? (dbKeyRaw.includes(':') ? decrypt(dbKeyRaw) : dbKeyRaw) : null;
            if (dbKey && dbKey.startsWith('sk-') && !dbKey.includes('•••')) {
                openaiKey = dbKey;
            }
        }

        if (!openaiKey && process.env.OPENAI_API_KEY?.startsWith('sk-')) {
            openaiKey = process.env.OPENAI_API_KEY;
        }

        // Determinar o provedor ativo
        let activeProvider = 'none';
        if (preferredProvider === 'disabled') {
            activeProvider = 'disabled';
        } else if (preferredProvider === 'groq' && groqKey) {
            activeProvider = 'groq';
        } else if (preferredProvider === 'openai' && openaiKey) {
            activeProvider = 'openai';
        } else if (groqKey) {
            // Fallback inteligente: Groq é gratuito
            activeProvider = 'groq';
        } else if (openaiKey) {
            activeProvider = 'openai';
        }

        return {
            preferredProvider,
            activeProvider,
            groqKey,
            openaiKey,
            hasGroq: Boolean(groqKey),
            hasOpenAI: Boolean(openaiKey)
        };
    }

    /**
     * Verifica se a transcrição automática em segundo plano para novos áudios está ligada.
     * Por padrão é FALSE para evitar custos involuntários e gastar cotas.
     */
    async shouldAutoTranscribe() {
        const auto = await getSetting('autoTranscribeAudios', 'false');
        return auto === 'true' || auto === true;
    }

    /**
     * Executa a transcrição do arquivo de áudio
     * @param {string|Buffer} audioBufferOrPath - Caminho absoluto ou buffer do arquivo
     * @param {string} filename - Nome do arquivo (ex: 'audio.ogg')
     * @param {string} language - Idioma ('pt')
     * @param {string|null} botId - ID opcional do bot para herdar chave
     */
    async transcribe(audioBufferOrPath, filename = 'audio.ogg', language = 'pt', botId = null) {
        const config = await this.getTranscriptionConfig(botId);

        if (config.activeProvider === 'disabled') {
            throw new Error('A transcrição de áudio está desativada nas configurações do sistema.');
        }

        if (config.activeProvider === 'none') {
            throw new Error(
                'Nenhum provedor de transcrição configurado. ' +
                'Adicione uma chave gratuita do Groq (100% Grátis / R$ 0,00) ou a chave da OpenAI no menu Configurações.'
            );
        }

        let tempFile = null;
        let needsCleanup = false;

        try {
            if (typeof audioBufferOrPath === 'string' && (await fs.pathExists(audioBufferOrPath))) {
                tempFile = audioBufferOrPath;
            } else {
                const tempDir = path.join(__dirname, '..', '..', 'temp');
                await fs.ensureDir(tempDir);
                tempFile = path.join(tempDir, `transcribe_${Date.now()}_${filename}`);
                await fs.writeFile(tempFile, audioBufferOrPath);
                needsCleanup = true;
            }

            let transcriptionText = '';
            let usedProvider = config.activeProvider;

            // 1. Tentar Groq (Custo Zero / Free Tier Whisper Large V3)
            if (config.activeProvider === 'groq') {
                try {
                    const groqClient = new OpenAI({
                        apiKey: config.groqKey.trim(),
                        baseURL: 'https://api.groq.com/openai/v1'
                    });

                    const res = await groqClient.audio.transcriptions.create({
                        file: fs.createReadStream(tempFile),
                        model: 'whisper-large-v3',
                        language: language || 'pt',
                        response_format: 'json'
                    });

                    transcriptionText = res?.text ? res.text.trim() : '';
                    usedProvider = 'groq';
                } catch (groqErr) {
                    console.warn('[TranscriptionService] Falha no Groq Whisper:', groqErr.message);
                    // Se falhou no Groq e temos OpenAI, tenta fallback
                    if (config.openaiKey) {
                        console.log('[TranscriptionService] Tentando fallback para OpenAI Whisper...');
                        const openaiClient = new OpenAI({ apiKey: config.openaiKey.trim() });
                        const res = await openaiClient.audio.transcriptions.create({
                            file: fs.createReadStream(tempFile),
                            model: 'whisper-1',
                            language: language || 'pt'
                        });
                        transcriptionText = res?.text ? res.text.trim() : '';
                        usedProvider = 'openai';
                    } else {
                        throw groqErr;
                    }
                }
            } else if (config.activeProvider === 'openai') {
                const openaiClient = new OpenAI({ apiKey: config.openaiKey.trim() });
                const res = await openaiClient.audio.transcriptions.create({
                    file: fs.createReadStream(tempFile),
                    model: 'whisper-1',
                    language: language || 'pt'
                });
                transcriptionText = res?.text ? res.text.trim() : '';
                usedProvider = 'openai';
            }

            if (needsCleanup && tempFile) {
                await fs.remove(tempFile).catch(() => {});
            }

            return {
                transcription: transcriptionText,
                provider: usedProvider,
                isFree: usedProvider === 'groq'
            };
        } catch (error) {
            if (needsCleanup && tempFile) {
                await fs.remove(tempFile).catch(() => {});
            }
            console.error('[TranscriptionService] Erro na transcrição:', error.message);
            throw error;
        }
    }
}

module.exports = new TranscriptionService();
