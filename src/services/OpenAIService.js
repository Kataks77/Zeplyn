const OpenAI = require('openai');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { logger } = require('../utils/logger');

class OpenAIService {
    constructor(apiKey) {
        if (!apiKey || apiKey === 'sua_api_key_aqui') {
            throw new Error('Chave de API da OpenAI nao configurada corretamente.');
        }
        this.openai = new OpenAI({ apiKey });
        this.apiKey = apiKey;

        console.log(`[OpenAIService] Inicializado com chave: ${apiKey.substring(0, 7)}...`);
        if (this.openai.beta) {
            console.log(`[OpenAIService] Beta APIs disponiveis: ${Object.keys(this.openai.beta).join(', ')}`);
        }
    }

    async getOrCreateAssistant(botConfig) {
        try {
            let assistant;
            const botName = botConfig.name || "Assistente Virtual";
            const systemPrompt = botConfig.systemPrompt || `Você é ${botName}, um assistente virtual inteligente e prestativo.`;
            const assistantConfig = {
                name: botName, 
                instructions: `Seu nome oficial é "${botName}". Identifique-se sempre como "${botName}" quando perguntarem quem é você, qual o seu nome ou como se chama.\n\n${systemPrompt}

REGRAS DE OPERAÇÃO:
1. Se encontrar informação nos arquivos e documentos da base de conhecimento, responda com base nela com exatidão e clareza.
2. Se NÃO encontrar nos arquivos ou na base de conhecimento, informe educadamente que não possui essa informação cadastrada.
3. Mantenha sempre um tom profissional, prestativo e cordial.
4. Nunca invente dados, valores ou afirmações que não estejam na base de conhecimento.`,
                model: botConfig.model || "gpt-4o-mini",
                tools: [{ type: "file_search" }]
            };

            if (botConfig.openaiVectorStoreId) {
                assistantConfig.tool_resources = {
                    file_search: {
                        vector_store_ids: [botConfig.openaiVectorStoreId]
                    }
                };
            }

            console.log(`[OpenAI Update] Atualizando Assistente ${botConfig.openaiAssistantId}...`);

            if (botConfig.openaiAssistantId) {
                try {
                    assistant = await this.openai.beta.assistants.update(botConfig.openaiAssistantId, assistantConfig);
                    console.log(`[OK] Assistente atualizado.`);
                    return assistant;
                } catch (e) {
                    console.warn(`[AVISO] Erro ao atualizar assistente: ${e.message}`);
                }
            }

            try {
                assistant = await this.openai.beta.assistants.create(assistantConfig);
                return assistant;
            } catch (err) {
                console.warn(`[AVISO] Assistants API indisponível (${err.status || err.message}). O bot operará em modo Chat Completions (Prompt + RAG).`);
                return null;
            }
        } catch (error) {
            console.warn(`[AVISO] Ao obter/criar assistente: ${error.message}. O bot operará em modo Chat Completions.`);
            return null;
        }
    }

    async getOrCreateVectorStore(botConfig) {
        try {
            let vectorStore;
            
            const vsInstance = this.openai.vectorStores || this.openai.beta?.vectorStores;

            if (!vsInstance) {
                console.error('[ERRO] API de Vector Stores nao encontrada no SDK!');
                console.log('  OpenAI keys:', Object.keys(this.openai).join(', '));
                if (this.openai.beta) {
                    console.log('  Beta keys:', Object.keys(this.openai.beta).join(', '));
                }
                throw new Error('SDK da OpenAI nao suporta Vector Stores');
            }

            if (botConfig.openaiVectorStoreId) {
                try {
                    vectorStore = await vsInstance.retrieve(botConfig.openaiVectorStoreId);
                    console.log(`[OK] Vector Store encontrado: ${botConfig.openaiVectorStoreId}`);
                    return vectorStore;
                } catch (e) {
                    console.warn(`[AVISO] Vector Store nao encontrado. Criando novo...`);
                }
            }

            vectorStore = await vsInstance.create({
                name: `Vector Store - ${botConfig.name} (${new Date().toISOString()})`
            });
            console.log(`[OK] Vector Store criado: ${vectorStore.id}`);
            return vectorStore;
        } catch (error) {
            console.error('[ERRO] Ao obter/criar Vector Store:', error.message);
            throw error;
        }
    }

    async uploadFileAndAddToVectorStore(filePath, originalName, vectorStoreId, existingFileId = null) {
        try {
            let fileId = existingFileId;

            if (!fileId) {
                if (!(await fs.pathExists(filePath))) {
                    throw new Error(`Arquivo nao encontrado: ${filePath}`);
                }

                console.log(`[UPLOAD] Uploadando ${originalName}...`);
                
                const fileStream = fs.createReadStream(filePath);

                const response = await this.openai.files.create({
                    file: fileStream,
                    purpose: "assistants",
                });
                
                fileId = response.id;
                console.log(`[OK] Arquivo uploaded: ${fileId}`);
            } else {
                console.log(`[REUSE] Arquivo cloud: ${originalName} (${fileId})`);
            }

            const vsInstance = this.openai.vectorStores || this.openai.beta?.vectorStores;
            if (vectorStoreId && vsInstance) {
                try {
                    const existingFiles = await vsInstance.files.list(vectorStoreId);
                    const alreadyExists = existingFiles.data?.some(f => f.id === fileId);
                    
                    if (!alreadyExists) {
                        await vsInstance.files.create(vectorStoreId, { file_id: fileId });
                        console.log(`[OK] Arquivo vinculado ao Vector Store`);
                    } else {
                        console.log(`[OK] Arquivo ja esta no Vector Store`);
                    }
                } catch (e) {
                    if (!e.message.includes('already exists')) {
                        console.error(`[ERRO] Erro ao vincular: ${e.message}`);
                    }
                }
            }

            return { id: fileId };
        } catch (error) {
            console.error('[ERRO] Upload de arquivo:', error.message);
            throw error;
        }
    }

    async transcribeAudio(audioBufferOrPath, filename = 'audio.ogg', language = 'pt') {
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

            const options = {
                file: fs.createReadStream(tempFile),
                model: "whisper-1"
            };
            if (language) {
                options.language = language;
            }

            const transcription = await this.openai.audio.transcriptions.create(options);

            if (needsCleanup && tempFile) {
                await fs.remove(tempFile).catch(() => {});
            }
            return (transcription && transcription.text) ? transcription.text.trim() : '';
        } catch (error) {
            if (needsCleanup && tempFile) {
                await fs.remove(tempFile).catch(() => {});
            }
            console.error('[ERRO] Transcricao Whisper:', error.message);
            throw error;
        }
    }

    async generateTTS(text, voice = 'alloy') {
        try {
            const mp3 = await this.openai.audio.speech.create({
                model: "tts-1",
                voice: voice,
                input: text,
            });
            return Buffer.from(await mp3.arrayBuffer());
        } catch (error) {
            console.error('[ERRO] TTS:', error.message);
            throw error;
        }
    }

    async askAssistant(assistantId, threadId, question) {
        try {
            if (!assistantId) {
                console.error('[ERRO] Assistant ID nao fornecido!');
                return {
                    answer: null,
                    threadId: null,
                    error: 'Assistant nao configurado',
                    isException: true
                };
            }

            let currentThreadId = threadId;
            if (!currentThreadId) {
                const thread = await this.openai.beta.threads.create();
                currentThreadId = thread.id;
                console.log(`[OK] Nova thread: ${currentThreadId}`);
            }

            await this.openai.beta.threads.messages.create(currentThreadId, {
                role: "user",
                content: question
            });

            const run = await this.openai.beta.threads.runs.create(currentThreadId, {
                assistant_id: assistantId
            });

            console.log(`[PROCESS] Run iniciado: ${run.id}`);

            let runStatus = await this.openai.beta.threads.runs.retrieve(currentThreadId, run.id);
            let attempts = 0;
            const maxAttempts = 120;
            
            while (runStatus.status !== 'completed' && attempts < maxAttempts) {
                if (['failed', 'cancelled', 'expired'].includes(runStatus.status)) {
                    console.error(`[ERRO] Run falhou: ${runStatus.status}`);
                    
                    return {
                        answer: null,
                        threadId: currentThreadId,
                        error: `Run falhou: ${runStatus.status}`,
                        errorDetails: runStatus.last_error,
                        isRunError: true
                    };
                }

                await new Promise(r => setTimeout(r, 1000));
                runStatus = await this.openai.beta.threads.runs.retrieve(currentThreadId, run.id);
                attempts++;
            }

            if (attempts >= maxAttempts) {
                console.error(`[ERRO] Run timeout`);
                return {
                    answer: null,
                    threadId: currentThreadId,
                    error: 'Timeout ao processar',
                    isTimeout: true
                };
            }

            const messages = await this.openai.beta.threads.messages.list(currentThreadId);
            const lastMessage = messages.data.find(m => m.role === 'assistant' && m.run_id === run.id);
            
            let rawResponse = lastMessage?.content?.[0]?.text?.value || null;
            
            if (!rawResponse || rawResponse.trim().length === 0) {
                console.warn(`[AVISO] Resposta vazia para: "${question}"`);
                return {
                    answer: null,
                    threadId: currentThreadId,
                    error: 'Nenhuma informacao encontrada',
                    isEmpty: true,
                    isEmptyResponse: true
                };
            }
            
            rawResponse = rawResponse.replace(/\u3010.*?\u3011/g, '').trim();

            console.log(`[RESPOSTA] Recebida: ${rawResponse.substring(0, 80)}...`);

            return {
                answer: rawResponse,
                threadId: currentThreadId,
                success: true
            };
        } catch (error) {
            console.error('[ERRO] Consultando assistente:', error.message);
            
            return {
                threadId: threadId || null,
                error: error.message,
                isException: true,
                exceptionDetails: error
            };
        }
    }

    /**
     * Resposta conversacional inteligente via Chat Completions (padrão de alta velocidade e compatibilidade total)
     */
    async chatCompletion({ messages, model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 600 }) {
        try {
            let validModel = model || 'gpt-4o-mini';
            if (validModel === 'gpt-3.5-turbo-16k') validModel = 'gpt-3.5-turbo';

            const response = await this.openai.chat.completions.create({
                model: validModel,
                messages: messages,
                temperature: Number(temperature) || 0.7,
                max_tokens: Number(maxTokens) || 600
            });

            const answer = response.choices?.[0]?.message?.content?.trim();
            if (!answer) {
                console.warn('[OpenAIService] Resposta vazia recebida do Chat Completions');
                return null;
            }
            return answer;
        } catch (error) {
            console.error('[ERRO] Chat Completion:', error.message);
            throw error;
        }
    }

    /**
     * Resposta conversacional inteligente unificada para bots (WhatsApp, Instagram, Telegram)
     */
    static async generateResponse(botId, contactJid, textContent) {
        try {
            const BotService = require('./BotService');
            const bot = await BotService.getBot(botId);
            if (!bot) return null;

            const { getSetting } = require('./DatabaseService');
            const { decrypt } = require('../utils/crypto');

            const dbKeyRaw = await getSetting('openaiApiKey');
            const dbKey = dbKeyRaw ? decrypt(dbKeyRaw) : null;
            let botKey = bot.openaiApiKey ? (bot.openaiApiKey.includes(':') ? decrypt(bot.openaiApiKey) : bot.openaiApiKey) : null;
            if (!botKey || !botKey.startsWith('sk-') || botKey.includes('•••')) botKey = null;

            let globalDbKey = (dbKey && dbKey.startsWith('sk-') && !dbKey.includes('•••')) ? dbKey : null;
            let envKey = (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) ? process.env.OPENAI_API_KEY : null;
            let apiKey = botKey || globalDbKey || envKey;

            if (!apiKey) return null;

            const instance = new OpenAIService(apiKey);

            const HistoryService = require('./HistoryService');
            const history = await HistoryService.getHistory(botId, contactJid, 6);

            const botName = bot.name || "Assistente Virtual";
            let basePrompt = bot.systemPrompt || `Você é ${botName}, assistente virtual da empresa. Responda de forma gentil, prestativa e natural em português.`;
            if (bot.name) {
                basePrompt = `Seu nome oficial é "${bot.name}". Quando o cliente perguntar quem é você, apresente-se como "${bot.name}".\n\n${basePrompt}`;
            }

            // Consulta produtos ativos no banco
            let productsContext = '';
            try {
                const ProductService = require('./ProductService');
                const products = await ProductService.list(bot.companyId || 'company_default', { isActive: true });
                if (products && products.length > 0) {
                    const lines = products.slice(0, 80).map(p => {
                        const price = Number(p.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const hasPromo = p.promotionalPrice && Number(p.promotionalPrice) > 0 && Number(p.promotionalPrice) < Number(p.price);
                        const promo = hasPromo ? Number(p.promotionalPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;
                        let stock = p.manageStock ? (Number(p.stock) <= 0 ? 'ESGOTADO / SEM ESTOQUE' : `${p.stock} ${p.unit || 'un'} em estoque`) : 'Disponível';
                        return `- PRODUTO: ${p.name} | Marca: ${p.brand || 'N/A'} | Preço: ${price} ${hasPromo ? `(Promoção: ${promo})` : ''} | Estoque: ${stock} ${p.imageUrl ? `| Foto: ${p.imageUrl}` : ''} ${p.checkoutUrl ? `| Link: ${p.checkoutUrl}` : ''} | Descrição: ${p.description || ''}`;
                    });
                    productsContext = `\n\n[CATÁLOGO DE PRODUTOS DISPONÍVEIS NO BANCO DE DADOS (CONSULTA EM TEMPO REAL)]:\n` + lines.join('\n');
                }
            } catch (_) {}

            let fullPrompt = `${basePrompt}

DIRETRIZES:
1. Responda com clareza, empatia e cordialidade em português.
2. Se o cliente perguntar sobre produtos disponíveis, preços ou estoque, consulte o catálogo acima. Se houver promoção, destaque o valor promocional com desconto.
3. Se o cliente pedir para ver foto ou imagem do produto e houver foto cadastrada, envie usando a tag [ImageUrl:URL_DA_FOTO|caption:NOME_DO_PRODUTO]. O sistema enviará a foto diretamente na conversa!
4. Se o cliente quiser comprar ou pedir o link de pagamento, forneça diretamente o link de compra/checkout do produto.
5. Se o produto estiver esgotado, avise com educação.${productsContext}`;

            const messages = [{ role: 'system', content: fullPrompt }];
            if (history && history.length > 0) {
                for (const h of history) {
                    if (h.role === 'internal_note') continue;
                    const clean = (h.content || '').replace(/\[.*?\]/g, '').trim();
                    if (clean) messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: clean });
                }
            }
            messages.push({ role: 'user', content: textContent });

            return await instance.chatCompletion({
                messages,
                model: bot.model || 'gpt-4o-mini',
                temperature: bot.temperature || 0.7,
                maxTokens: bot.maxTokens || 500
            });
        } catch (e) {
            console.error(`[OpenAIService.generateResponse] Erro:`, e.message);
            return null;
        }
    }
}

module.exports = OpenAIService;