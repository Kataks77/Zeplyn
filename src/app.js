const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { DIRS } = require('./config');
const { authenticateRequest, rateLimitMiddleware, sanitizeControlCharactersMiddleware, authorizeMediaAccess } = require('./middlewares/authMiddleware');
const { cryptoMiddleware } = require('./middlewares/cryptoMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const botRoutes = require('./routes/botRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const fileRoutes = require('./routes/fileRoutes');
const chatRoutes = require('./routes/chatRoutes');
const contactRoutes = require('./routes/contactRoutes');
const quickMessageRoutes = require('./routes/quickMessageRoutes');
const quickRepliesRoutes = require('./routes/quickRepliesRoutes');
const healthRoutes = require('./routes/healthRoutes');
const companyRoutes = require('./routes/companyRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const roleRoutes = require('./routes/roleRoutes');
const reportRoutes = require('./routes/reportRoutes');
const accessRoutes = require('./routes/accessRoutes');
const auditRoutes = require('./routes/auditRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const productRoutes = require('./routes/productRoutes');
const wallboardRoutes = require('./routes/wallboardRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Inicializar serviço de retenção e limpeza de mídias antigas
const MediaRetentionService = require('./services/MediaRetentionService');
MediaRetentionService.start();

// Inicializar serviço de mensagens agendadas e round-robin
require('./services/ScheduledMessageService');

// Inicializar módulo de agendamentos e lembretes
const AppointmentService = require('./services/AppointmentService');
AppointmentService.init();

const app = express();
app.disable('x-powered-by');

// ==========================================
// PROTEÇÃO CONTRA VARREDURA & ARQUIVOS SENSÍVEIS (Anti-Recon & Dotfiles)
// ==========================================
const BLOCKED_EXTENSIONS = [
    '.env', '.git', '.bak', '.zip', '.tar', '.gz', '.tar.gz', '.old', '.backup',
    '.sql', '.sqlite', '.sqlite3', '.db', '.log', '.sh', '.bash', '.php',
    '.conf', '.config', '.yml', '.yaml', '.ini', '.key', '.pem', '.crt'
];

const BLOCKED_DIRECTORIES = ['/wp-admin', '/phpmyadmin', '/actuator', '/graphql', '/debug', '/console', '/dump'];

app.use((req, res, next) => {
    const cleanUrl = (req.path || '').toLowerCase();

    // 1. Bloqueia qualquer arquivo oculto / dotfile (ex: /.env, /.git, /.htaccess, etc.) exceto /.well-known (SSL)
    if (/(?:^|\/)\.(?!well-known)/.test(cleanUrl)) {
        return res.status(404).send('Not Found');
    }

    // 2. Bloqueia extensões de arquivos sensíveis ou backups
    if (BLOCKED_EXTENSIONS.some(ext => cleanUrl.endsWith(ext) || cleanUrl.includes(ext + '/'))) {
        return res.status(404).send('Not Found');
    }

    // 3. Bloqueia tentativas comuns de varredura de diretórios de sistemas legados
    if (BLOCKED_DIRECTORIES.some(dir => cleanUrl === dir || cleanUrl.startsWith(dir + '/'))) {
        return res.status(404).send('Not Found');
    }

    next();
});

// Middlewares de Segurança Rigorosos (Enterprise Security Headers)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' wss: ws: https:;"
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
});

app.use((req, res, next) => {
    // Redige os parâmetros da query string para evitar vazamento de tokens, assinaturas ou segredos nos logs
    let safeUrl = req.originalUrl || req.url || '';
    const qIndex = safeUrl.indexOf('?');
    if (qIndex !== -1) {
        const pathname = safeUrl.substring(0, qIndex);
        const search = safeUrl.substring(qIndex + 1);
        try {
            const params = new URLSearchParams(search);
            for (const key of Array.from(params.keys())) {
                params.set(key, '[REDACTED]');
            }
            safeUrl = `${pathname}?${params.toString()}`;
        } catch (_) {
            safeUrl = `${pathname}?[REDACTED]`;
        }
    }

    console.log(`🌐 [Global Log] ${req.method} ${safeUrl} | Headers: ${JSON.stringify(req.headers['x-user-id'] || 'no-uid')}`);
    next();
});

// Middlewares globais (CORS Restrito e Seguro)
const ALLOWED_CORS_DOMAINS = ['zeplyn.com.br', 'zeplyn.com', 'zeplync.online', 'itecchatbot.com.br'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        try {
            const host = new URL(origin).hostname;
            const isAllowed = host === 'localhost' || 
                              host === '127.0.0.1' || 
                              ALLOWED_CORS_DOMAINS.some(d => host === d || host.endsWith('.' + d));
            if (isAllowed) {
                return callback(null, origin);
            }
        } catch (_) {}
        return callback(null, false);
    },
    credentials: true
}));
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeControlCharactersMiddleware);
app.use(cryptoMiddleware);

// Prevenção de HTTP Parameter Pollution (HPP)
app.use((req, res, next) => {
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            if (Array.isArray(req.query[key])) {
                req.query[key] = req.query[key][req.query[key].length - 1];
            }
        }
    }
    next();
});

// Cabeçalhos rigorosos de não-armazenamento em cache para APIs de dados privados
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Rotas da API (Públicas de infraestrutura / healthcheck / webhooks de terceiros)
app.use('/api', healthRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/webhook', webhookRoutes);

// Rate Limits Rigorosos por Operação Crítica (Anti Brute-Force & Anti Spam Registration)
app.use('/api/login', rateLimitMiddleware(5, 5 * 60000, 'Muitas tentativas de login. Bloqueado temporariamente por 5 minutos.'));
app.use('/api/register', rateLimitMiddleware(3, 15 * 60000, 'Limite de cadastros excedido para este IP. Tente novamente mais tarde.'));
app.use('/api/upload', rateLimitMiddleware(15, 60000, 'Limite de envio de arquivos excedido. Aguarde 1 minuto.'));

// Rotas da API (Protegidas)
app.use('/api', rateLimitMiddleware(1200, 60000));
app.use('/api', authRoutes); // Login/register públicos, logout protegido
app.use('/api/users', authenticateRequest, userRoutes);
app.use('/api/bots', authenticateRequest, botRoutes);
app.use('/api/notifications', authenticateRequest, notificationRoutes);
app.use('/api', authenticateRequest, dashboardRoutes);
app.use('/api', authenticateRequest, fileRoutes);
app.use('/api', authenticateRequest, chatRoutes);
app.use('/api/contacts', authenticateRequest, contactRoutes);
app.use('/api/quick-messages', authenticateRequest, quickMessageRoutes);
app.use('/api/quick-replies', authenticateRequest, quickRepliesRoutes);
app.use('/api/companies', authenticateRequest, companyRoutes);
app.use('/api/campaigns', authenticateRequest, campaignRoutes);
app.use('/api/roles', authenticateRequest, roleRoutes);
app.use('/api/reports', authenticateRequest, reportRoutes);
app.use('/api/access', authenticateRequest, accessRoutes);
app.use('/api/audit-logs', authenticateRequest, auditRoutes);
app.use('/api/appointments', authenticateRequest, appointmentRoutes);
app.use('/api/products', authenticateRequest, productRoutes);
app.use('/api/wallboard', authenticateRequest, wallboardRoutes);

// Arquivos de rastreadores e segurança padrão
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /api/\nDisallow: /uploads/\n');
});

app.get('/.well-known/security.txt', (req, res) => {
    res.type('text/plain').send('Contact: mailto:seguranca@zeplyn.com.br\nExpires: 2027-12-31T23:59:59.000Z\n');
});

// Proteção e entrega de arquivos de uploads com autenticação/assinatura, rate limit, anti-hotlink e bloqueio de execução
app.use('/uploads', rateLimitMiddleware(180, 60000, 'Limite de acesso a mídias excedido.'));
app.use('/uploads', authorizeMediaAccess);
app.use('/uploads', (req, res, next) => {
    // 1. Bloqueia tentativas de Path Traversal
    if (req.path.includes('..') || req.path.includes('%2e') || req.path.includes('%2E')) {
        return res.status(403).send('Forbidden');
    }

    // 2. Impede servir arquivos executáveis, scripts ou vetores de XSS a partir de uploads
    const dangerousUploadExts = ['.html', '.htm', '.xhtml', '.svg', '.php', '.js', '.sh', '.py', '.exe', '.bat'];
    if (dangerousUploadExts.some(ext => req.path.toLowerCase().endsWith(ext))) {
        return res.status(403).send('Forbidden');
    }

    // 3. Anti-Hotlinking / Proteção de Origem: Impede embedding de mídias por sites de terceiros
    const referer = req.headers['referer'] || req.headers['origin'];
    if (referer) {
        try {
            const refHost = new URL(referer).hostname;
            const isAllowedRef = refHost === 'localhost' || 
                                 refHost === '127.0.0.1' || 
                                 ALLOWED_CORS_DOMAINS.some(d => refHost === d || refHost.endsWith('.' + d));
            if (!isAllowedRef) {
                return res.status(403).send('Forbidden');
            }
        } catch (_) {}
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // Cache privado para usuário
    if (req.path.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
    }
    next();
}, express.static(DIRS.uploads, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1d',
    etag: true
}));

// Servir Frontend SPA moderno Zeplyn (React / Vite)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    console.log('⚡ [App] Servindo Frontend React SPA (client/dist)');
    app.use(express.static(clientDistPath));

    app.get('*', (req, res, next) => {
        if (req.url.startsWith('/api') || req.url.startsWith('/uploads') || req.url.startsWith('/socket.io')) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

// Middleware de Erro Global Seguro (sem vazamento de exceções em produção)
app.use((err, req, res, next) => {
    console.error('❌ Erro da Aplicação:', err.message || err);
    const status = err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(status).json({
        error: status === 500 ? 'Erro interno no servidor' : (err.message || 'Erro na requisição'),
        message: status === 500 && isProduction ? 'Ocorreu uma falha no processamento interno.' : err.message
    });
});

module.exports = app;
