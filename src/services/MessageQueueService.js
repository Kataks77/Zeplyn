/**
 * MessageQueueService
 * Gerencia a fila de envio de mensagens do WhatsApp com controle de taxa (rate limiting),
 * espaçamento inteligente (jitter humanizado) e proteção anti-bloqueio (anti-ban).
 */
class MessageQueueService {
    constructor() {
        // Filas separadas por botId para evitar que um bot bloqueie o outro
        this.queues = new Map();
        this.isProcessing = new Map();
        this.minDelayMs = 400;
        this.maxDelayMs = 1000;
    }

    /**
     * Enfileira uma mensagem para envio seguro
     * @param {string} botId 
     * @param {Function} sendTask Função async que executa o envio efetivo
     * @param {object} meta Informações da mensagem para log/rastreamento
     * @returns {Promise<any>}
     */
    enqueue(botId, sendTask, meta = {}) {
        return new Promise((resolve, reject) => {
            if (!this.queues.has(botId)) {
                this.queues.set(botId, []);
                this.isProcessing.set(botId, false);
            }

            const queue = this.queues.get(botId);
            queue.push({
                sendTask,
                meta,
                resolve,
                reject,
                retries: 0,
                maxRetries: 3,
                enqueuedAt: Date.now()
            });

            this.processNext(botId);
        });
    }

    async processNext(botId) {
        if (this.isProcessing.get(botId)) return;

        const queue = this.queues.get(botId);
        if (!queue || queue.length === 0) return;

        this.isProcessing.set(botId, true);
        const item = queue.shift();

        try {
            // Executa a tarefa de envio real
            const result = await item.sendTask();
            item.resolve(result);
        } catch (error) {
            console.error(`⚠️ [MessageQueue] Falha no envio para ${item.meta.to || 'destinatário'}: ${error.message}`);
            
            // Retentar se for erro recuperável e não tiver atingido o limite
            if (item.retries < item.maxRetries) {
                item.retries++;
                console.log(`🔁 [MessageQueue] Agendando retentativa ${item.retries}/${item.maxRetries}...`);
                queue.unshift(item);
                await this.wait(2000); // Espera 2s antes de tentar de novo
            } else {
                item.reject(error);
            }
        } finally {
            // Espaçamento humanizado (jitter) entre mensagens para proteger o chip
            const delay = Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
            await this.wait(delay);

            this.isProcessing.set(botId, false);
            // Processa próximo item da fila
            this.processNext(botId);
        }
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getQueueLength(botId) {
        const queue = this.queues.get(botId);
        return queue ? queue.length : 0;
    }
}

// Singleton para toda a aplicação
module.exports = new MessageQueueService();
