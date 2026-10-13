const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');
const { PORT, HOST, DIRS } = require('./config');
const app = require('./app');
const { applyBaileysPatch } = require('./utils/baileysPatch');
applyBaileysPatch();
const BotManagerService = require('./services/BotManagerService');
const { initDatabase } = require('./services/DatabaseService');

async function bootstrap() {
    console.log('🚀 Iniciando sistema Zeplyn...');

    try {
        // 1. Garantir diretórios
        for (const dir of Object.values(DIRS)) {
            await fs.ensureDir(dir);
        }
        console.log('✅ Diretórios ok');

        // 2. Inicializar Database
        await initDatabase();
        console.log('✅ Banco de dados ok');

        // 3. Setup Servidor & Socket.IO
        const server = http.createServer(app);
        const ALLOWED_CORS_DOMAINS = ['zeplyn.com.br', 'zeplyn.com', 'zeplync.online', 'itecchatbot.com.br'];
        const io = new Server(server, {
            cors: {
                origin: (origin, callback) => {
                    if (!origin) return callback(null, true);
                    try {
                        const host = new URL(origin).hostname;
                        const isAllowed = host === 'localhost' || 
                                          host === '127.0.0.1' || 
                                          ALLOWED_CORS_DOMAINS.some(d => host === d || host.endsWith('.' + d));
                        if (isAllowed) {
                            return callback(null, true);
                        }
                    } catch (_) {}
                    return callback(new Error('Origem não permitida pelo CORS'));
                },
                methods: ["GET", "POST"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling'],
            maxHttpBufferSize: 5e6 // 5 MB máximo por pacote (mitiga DoS por estouro de memória)
        });

        // 4. Injetar Socket.IO no BotManager
        BotManagerService.setIo(io);
        console.log('✅ Socket.IO configurado');

        const { verifySignedToken, isTokenRevoked } = require('./middlewares/authMiddleware');
        const UserService = require('./services/UserService');

        const authenticateAndJoinRooms = async (socket, rawToken) => {
            if (!rawToken || typeof rawToken !== 'string') return null;
            try {
                const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
                if (await isTokenRevoked(token)) return null;
                const decoded = verifySignedToken(token);
                if (!decoded || !decoded.userId) return null;

                const user = await UserService.findUserById(decoded.userId);
                if (!user || !user.isActive) return null;
                if (user.role !== 'superadmin' && user.companyIsActive === false) return null;

                const companyId = user.companyId || 'company_default';
                socket.join(`company_${companyId}`);
                socket.join(`user_${user.id}`);
                if (user.role === 'superadmin') {
                    socket.join('company_superadmin');
                }
                socket.user = user;
                socket.companyId = companyId;

                const UserPresenceService = require('./services/UserPresenceService');
                const pres = UserPresenceService.addSocket(socket.id, user, companyId);
                if (pres && pres.wentOnline) {
                    const payload = { userId: user.id, userName: user.name, isOnline: true };
                    io.to(`company_${companyId}`).emit('attendant:presence-changed', payload);
                    io.to('company_superadmin').emit('attendant:presence-changed', payload);
                }

                return user;
            } catch (_) {
                return null;
            }
        };

        // Autenticação obrigatória e estrita via middleware de handshake (Zero Trust)
        io.use(async (socket, next) => {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;
            if (!token) {
                return next(new Error('Authentication error: Token required'));
            }
            try {
                const user = await authenticateAndJoinRooms(socket, token);
                if (!user) {
                    return next(new Error('Authentication error: Invalid, expired or revoked token'));
                }
                next();
            } catch (err) {
                return next(new Error('Authentication error: Validation failed'));
            }
        });

        // Configurar sinalização e eventos em tempo real
        io.on('connection', (socket) => {
            // Permite ao cliente renovar ou ingressar na sala da empresa após login dinâmico
            socket.on('join-company', async (data) => {
                const token = data?.token || socket.handshake.auth?.token;
                if (token) {
                    await authenticateAndJoinRooms(socket, token);
                }
            });

            socket.on('subscribe-presence', async (data) => {
                try {
                    if (!socket.user) return;
                    const { botId, contactJid } = data || {};
                    if (!contactJid || !botId) return;

                    // Impedir acesso a presença de robôs de outros tenants
                    if (socket.user.role !== 'superadmin') {
                        const BotService = require('./services/BotService');
                        const bot = await BotService.getBot(botId);
                        if (!bot || (bot.companyId || 'company_default') !== socket.companyId) {
                            return;
                        }
                    }

                    await BotManagerService.subscribePresence(botId, contactJid);
                } catch (e) {}
            });

            socket.on('disconnect', () => {
                const UserPresenceService = require('./services/UserPresenceService');
                const pres = UserPresenceService.removeSocket(socket.id);
                if (pres && pres.wentOffline) {
                    const payload = { userId: pres.userId, userName: pres.userName, isOnline: false };
                    io.to(`company_${pres.companyId}`).emit('attendant:presence-changed', payload);
                    io.to('company_superadmin').emit('attendant:presence-changed', payload);
                }
            });
        });

        // 5. Iniciar bots ativos em background (sem travar a subida do servidor)
        BotManagerService.startAllBots().catch(err => {
            console.error('❌ Erro na inicialização em background dos bots:', err);
        });
        console.log('✅ Inicialização dos bots disparada em background');

        // 6. Iniciar Listen
        server.listen(PORT, HOST, () => {
            console.log(`🚀 Servidor rodando em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
        });

        // Encerramento Gracioso (Graceful Shutdown)
        let isShuttingDown = false;
        async function gracefulShutdown(signal) {
            if (isShuttingDown) return;
            isShuttingDown = true;
            console.log(`🛑 Recebido sinal ${signal}. Iniciando encerramento gracioso...`);

            server.close(async () => {
                console.log('✅ Servidor HTTP encerrado.');

                // Desconectar bots do WhatsApp de forma limpa
                try {
                    console.log('⏳ Desconectando instâncias de bots...');
                    if (BotManagerService.activeBots) {
                        for (const [botId, bot] of BotManagerService.activeBots.entries()) {
                            try {
                                if (bot && typeof bot.stop === 'function') await bot.stop();
                            } catch (botErr) {
                                console.error(`Erro ao parar bot ${botId}:`, botErr.message);
                            }
                        }
                    }
                    console.log('✅ Sessões dos bots finalizadas com segurança.');
                } catch (e) {

                    console.error('Erro ao desconectar bots:', e);
                }

                // Encerrar pool do PostgreSQL
                try {
                    const { getDatabase } = require('./services/DatabaseService');
                    const db = getDatabase();
                    if (db && typeof db.end === 'function') {
                        await db.end();
                        console.log('✅ Conexão com PostgreSQL finalizada com sucesso.');
                    }
                } catch (dbErr) {
                    console.error('Erro ao fechar pool do banco:', dbErr);
                }

                console.log('👋 Processo finalizado com sucesso.');
                process.exit(0);
            });

            // Timeout de segurança para forçar encerramento em no máximo 10s
            setTimeout(() => {
                console.error('⚠️ Tempo limite de encerramento excedido. Forçando saída.');
                process.exit(1);
            }, 10000).unref();
        }

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Captura global de exceções não tratadas para evitar encerramento silencioso
        process.on('unhandledRejection', (reason, promise) => {
            console.error('⚠️ [Unhandled Rejection] Promessa rejeitada:', reason);
        });

        process.on('uncaughtException', (error) => {
            console.error('🚨 [Uncaught Exception] Exceção crítica:', error);
        });

    } catch (error) {
        console.error('❌ Falha crítica no bootstrap:', error);
        process.exit(1);
    }
}

bootstrap();
// Restarting system... 