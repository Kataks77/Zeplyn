const WhatsAppService = require('./services/WhatsAppService');
const { initDatabase } = require('./services/DatabaseService');

async function runStandaloneBot(botId) {
    try {
        console.log(`🤖 Iniciando BOT ${botId} em modo standalone...`);
        
        // 1. Inicializar Database
        initDatabase();
        console.log('✅ Banco de dados ok');

        // 2. Criar Instância
        const bot = new WhatsAppService(botId, null); // Null para o Socket.IO (não necessário em standalone)
        
        // 3. Iniciar
        await bot.start();
        console.log(`✅ Bot ${botId} rodando`);

        // Handlers de sinal
        process.on('SIGINT', () => {
            console.log(`🛑 Parando bot ${botId}`);
            bot.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error(`❌ Erro no bot ${botId}:`, error);
        process.exit(1);
    }
}

// Se executado diretamente: node src/bot.js botId
const botIdFromArg = process.argv[2];
if (botIdFromArg) {
    runStandaloneBot(botIdFromArg);
} else {
    console.warn('⚠️ Informe o botId: node src/bot.js botId');
}

module.exports = runStandaloneBot;
