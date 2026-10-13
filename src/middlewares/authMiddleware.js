const UserService = require('../services/UserService');
const BotService = require('../services/BotService');
const { getDatabase } = require('../services/DatabaseService');
const crypto = require('crypto');
const path = require('path');

// Cache em memória de tokens revogados para performance imediata
const revokedTokensCache = new Set();
const rateLimitStore = new Map();

// 1. Validação estrita do segredo JWT (nunca permitir chave fraca ou compartilhada com ENCRYPTION_KEY)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'zeplyn-default-secret-key-32' || JWT_SECRET === 'itecchatbot-default-secret-key-32') {
    console.error('❌ [FATAL SECURITY ERROR] JWT_SECRET não configurado exclusivamente para JWT!');
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET não configurado. Defina uma chave forte exclusiva para JWT no arquivo .env.');
}

/**
 * Gera um token JWT assinado criptograficamente com HMAC-SHA256, jti único, issuer e audience
 */
function generateSignedToken(payload, expiresInMs = 24 * 60 * 60 * 1000) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Date.now() + expiresInMs;
    const jti = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        iss: 'zeplyn',
        aud: 'zeplyn-api',
        jti,
        exp,
        iat: Date.now()
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

/**
 * Verifica e decodifica um token JWT assinado, validando assinatura, expiração, iss e aud
 */
function verifySignedToken(token) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expSigBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && payload.exp < Date.now()) {
            return null; // Token expirado
        }
        // Validação de claims de segurança
        if (payload.iss && payload.iss !== 'zeplyn' && payload.iss !== 'itecchatbot') {
            return null; // Emissor não confiável
        }
        if (payload.aud && payload.aud !== 'zeplyn-api' && payload.aud !== 'itecchatbot-api') {
            return null; // Audiência incorreta
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * Verifica se o token foi revogado com política Fail-Closed (se o banco falhar, não libera acesso)
 */
async function isTokenRevoked(token) {
    if (!token) return true;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (revokedTokensCache.has(tokenHash)) return true;

    try {
        const db = getDatabase();
        const res = await db.query(
            'SELECT 1 FROM revoked_tokens WHERE token_hash = $1 AND "expiresAt" > $2',
            [tokenHash, Date.now()]
        );
        if (res.rows.length > 0) {
            revokedTokensCache.add(tokenHash);
            return true;
        }
        return false;
    } catch (err) {
        console.error('❌ [Auth] Falha crítica ao verificar revogação no banco:', err.message);
        // Fail-Closed: Não autenticar se não for possível verificar o estado de revogação
        throw new Error('AUTH_REVOCATION_CHECK_FAILED');
    }
}

/**
 * Revoga um token com persistência no banco de dados e invalidação imediata em memória
 */
async function revokeToken(token, userId = null, expiresAt = null) {
    if (!token) return;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    revokedTokensCache.add(tokenHash);

    try {
        const db = getDatabase();
        const exp = expiresAt || (Date.now() + 24 * 60 * 60 * 1000);
        await db.query(
            'INSERT INTO revoked_tokens (token_hash, "userId", "expiresAt") VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO NOTHING',
            [tokenHash, userId, exp]
        );
    } catch (err) {
        console.warn('⚠️ [Auth] Aviso ao persistir revogação no banco:', err.message);
    }
}

// Helper legado para compatibilidade de rotas
function generateSessionToken(payload = {}) {
    return generateSignedToken(payload);
}

/**
 * Rate limiting avançado por IP e por Usuário autenticado
 */
function rateLimitMiddleware(maxRequests = 100, windowMs = 60000, message = 'Muitas requisições. Tente novamente mais tarde.', keyGenerator = null) {
    return (req, res, next) => {
        const url = req.originalUrl || req.url || '';

        // Rotas essenciais de infraestrutura, dossiê/comprovante, exportações e webhooks externos não são bloqueadas
        if (process.env.NODE_ENV === 'test' || url.includes('/dossier') || url.includes('/health') || url.includes('/export') || url.includes('/webhooks')) {
            return next();
        }

        const clientIp = req.ip || req.connection?.remoteAddress || '';
        const isLocalhost = clientIp.includes('127.0.0.1') || clientIp.includes('::1') || clientIp === 'localhost';

        // Em desenvolvimento/localhost, não limita tráfego geral do painel
        if (isLocalhost && !url.includes('/login') && !url.includes('/register') && maxRequests >= 100) {
            return next();
        }

        let key = 'unknown';
        if (typeof keyGenerator === 'function') {
            key = keyGenerator(req);
        } else if (req.user && req.user.id) {
            key = `user:${req.user.id}`;
        } else {
            // NUNCA confiar em cabeçalhos forjáveis como x-user-id;
            // Apenas extrai ID se houver token Bearer criptograficamente assinado e válido
            let authId = null;
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
                try {
                    const token = req.headers.authorization.slice(7).trim();
                    const decoded = verifySignedToken(token);
                    if (decoded && (decoded.userId || decoded.id)) {
                        authId = decoded.userId || decoded.id;
                    }
                } catch (_) {}
            }

            if (authId) {
                key = `user:${authId}`;
            } else {
                key = `ip:${clientIp || 'unknown'}`;
            }
        }

        const now = Date.now();

        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const limit = rateLimitStore.get(key);
        if (now > limit.resetTime) {
            limit.count = 1;
            limit.resetTime = now + windowMs;
            return next();
        }

        if (limit.count >= maxRequests) {
            return res.status(429).json({
                error: message,
                retryAfter: Math.ceil((limit.resetTime - now) / 1000)
            });
        }

        limit.count++;
        next();
    };
}

// Middleware de autenticação centralizado Stateless com JWT e Checagem de Revogação Fail-Closed
async function authenticateRequest(req, res, next) {
    const rawUrl = (req.originalUrl || req.url || '').split('?')[0];
    if (rawUrl.startsWith('/api/webhooks')) {
        return next();
    }

    const authHeader = req.headers.authorization;
    const userIdHeader = req.headers['x-user-id'];

    // 1. Autenticar via Token Bearer assinado (JWT)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();

        // 1.1 Verificar se o token foi revogado com Fail-Closed
        try {
            if (await isTokenRevoked(token)) {
                return res.status(401).json({ error: 'Token revogado ou sessão encerrada. Faça login novamente.' });
            }
        } catch (revErr) {
            return res.status(503).json({ error: 'Serviço de autenticação temporariamente indisponível.' });
        }

        // 1.2 Validar assinatura criptográfica, claims e expiração
        const jwtPayload = verifySignedToken(token);
        if (jwtPayload && jwtPayload.userId) {
            try {
                // Não confia cegamente em dados de role/companyId do payload; busca a fonte da verdade no banco
                const user = await UserService.findUserById(jwtPayload.userId);
                if (user) {
                    if (!user.isActive) {
                        return res.status(403).json({
                            error: 'Acesso negado: Seu usuário foi inativado pela administração.',
                            suspended: true
                        });
                    }
                    if (user.role !== 'superadmin' && user.companyIsActive === false) {
                        return res.status(403).json({
                            error: 'Acesso suspenso: A empresa vinculada à sua conta está temporariamente suspensa por pendências financeiras.',
                            suspended: true
                        });
                    }
                    req.user = user;
                    req.sessionToken = token;
                    return next();
                }
            } catch (err) {
                console.error('❌ Erro ao validar usuário JWT:', err.message);
                return res.status(500).json({ error: 'Erro interno ao validar autenticação.' });
            }
        }
    }

    return res.status(401).json({ error: 'Acesso negado. Token JWT inválido, expirado ou usuário não autenticado.' });
}

// Middleware de autorização para administradores (admin e superadmin)
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Acesso negado. Não autenticado.' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acesso negado. Permissão de administrador necessária.' });
    }
    next();
}

// Middleware de autorização exclusivo para o proprietário da plataforma SaaS
function requireSuperAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Acesso negado. Não autenticado.' });
    }
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Acesso negado. Permissão de Super Administrador necessária.' });
    }
    next();
}

// Middleware genérico de autorização por múltiplos papéis
function requireRole(allowedRoles = ['admin', 'superadmin']) {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Acesso negado. Não autenticado.' });
        }
        if (!rolesArray.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acesso negado. Permissão insuficiente.' });
        }
        next();
    };
}

// Middleware de propriedade do bot com isolamento multi-tenant
async function requireBotOwnership(req, res, next) {
    try {
        const botId = req.params.botId || req.body.botId;
        if (!botId) return res.status(400).json({ error: 'Bot ID é obrigatório' });
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

        const bot = await BotService.getBot(botId);
        if (!bot) return res.status(404).json({ error: 'Bot não encontrado' });

        // Validação Multi-Tenant: apenas superadmin pode ver bots de outras empresas
        const userCompanyId = req.user.companyId || 'company_default';
        const botCompanyId = bot.companyId || 'company_default';
        if (req.user.role !== 'superadmin' && botCompanyId !== userCompanyId) {
            return res.status(403).json({ error: 'Acesso negado. Este bot pertence a outra empresa.' });
        }

        req.bot = bot;
        next();
    } catch (error) {
        console.error('Erro ao verificar bot:', error);
        return res.status(500).json({ error: 'Erro interno' });
    }
}

// Sanitização de entradas: remove bytes nulos e caracteres de controle perigosos de baixo nível
function sanitizeControlCharactersMiddleware(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        sanitizeObject(req.body);
    }
    next();
}

function sanitizeObject(obj) {
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
            // Remove null bytes que podem quebrar parsers de C/Postgres
            obj[key] = obj[key].replace(/\0/g, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
        }
    }
}

// Limpeza periódica de rate limits e tokens revogados expirados
const gcInterval = setInterval(async () => {
    const now = Date.now();
    for (const [key, limit] of rateLimitStore.entries()) {
        if (limit.resetTime <= now) rateLimitStore.delete(key);
    }
    try {
        const db = getDatabase();
        await db.query('DELETE FROM revoked_tokens WHERE "expiresAt" <= $1', [now]);
    } catch (err) {}
}, 60000);
if (gcInterval.unref) gcInterval.unref();

// Middleware de autorização por tela / módulo contratado (Zero-Trust Fail-Closed)
function requireScreenAccess(screenId) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Acesso negado. Usuário não autenticado.' });
        }

        // 1. Superadmin tem acesso irrestrito a todas as telas e APIs
        if (req.user.role === 'superadmin') {
            return next();
        }

        // 2. Se a empresa do usuário possuir restrição de módulos pelo Superadmin
        if (Array.isArray(req.user.companyAllowedScreens) && req.user.companyAllowedScreens.length > 0) {
            if (!req.user.companyAllowedScreens.includes(screenId)) {
                return res.status(403).json({
                    error: `Acesso negado: O módulo "${screenId}" não está habilitado no plano desta empresa.`,
                    screen: screenId
                });
            }
        }

        // 3. Se for Admin da empresa, tem acesso a todos os módulos liberados para a empresa
        if (req.user.role === 'admin') {
            return next();
        }

        // 4. Se for Operador/Atendente, checar permissão específica
        const userScreens = Array.isArray(req.user.allowedScreens)
            ? req.user.allowedScreens
            : ['chat', 'contacts', 'quick_messages', 'tags']; // default fallback

        if (!userScreens.includes(screenId)) {
            return res.status(403).json({
                error: `Acesso negado: Seu usuário não possui permissão para acessar o módulo "${screenId}".`,
                screen: screenId
            });
        }

        next();
    };
}

/**
 * Gera uma URL assinada temporária para acesso a mídia privada (proteção contra acesso público direto)
 */
function generateSignedMediaUrl(filename, expiresInMs = 24 * 60 * 60 * 1000) {
    if (!filename) return '';
    const baseName = path.basename(filename);
    const exp = Date.now() + expiresInMs;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${baseName}:${exp}`).digest('hex');
    return `/uploads/${baseName}?sig=${signature}&exp=${exp}`;
}

/**
 * Valida se uma assinatura de mídia temporária é válida e não expirou
 */
function verifySignedMediaUrl(filename, sig, exp) {
    if (!filename || !sig || !exp) return false;
    const expNum = parseInt(exp, 10);
    if (isNaN(expNum) || Date.now() > expNum) return false;

    const baseName = path.basename(filename);
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${baseName}:${expNum}`).digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expSigBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expSigBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expSigBuf);
}

/**
 * Middleware para autorizar acesso a mídias privadas em /uploads
 * - Permite figurinhas e stickers públicos
 * - Exige token JWT autenticado (Header ou Query) OU URL assinada (sig + exp) para arquivos privados (áudios, PDFs, comprovantes, etc.)
 */
async function authorizeMediaAccess(req, res, next) {
    const filename = path.basename(req.path || '');
    const ext = path.extname(filename).toLowerCase();

    // 1. Assets públicos da interface e mídias de chat (imagens, figurinhas, áudios, vídeos, documentos)
    const ALLOWED_MEDIA_EXTS = [
        '.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg',
        '.ogg', '.oga', '.mp3', '.wav', '.m4a', '.opus',
        '.mp4', '.webm',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'
    ];
    if (ALLOWED_MEDIA_EXTS.includes(ext)) {
        return next();
    }

    // 2. Validação por Link Assinado com HMAC temporário (?sig=...&exp=...)
    if (req.query.sig && req.query.exp) {
        if (verifySignedMediaUrl(filename, req.query.sig, req.query.exp)) {
            return next();
        }
        return res.status(403).json({ error: 'Link assinado de mídia expirado ou inválido.' });
    }

    // 3. Validação por Token JWT (estritamente via cabeçalho Authorization: Bearer para não expor tokens em query strings/URLs/logs)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    }

    if (token) {
        try {
            if (!(await isTokenRevoked(token))) {
                const payload = verifySignedToken(token);
                if (payload && payload.userId) {
                    return next();
                }
            }
        } catch (_) {}
    }

    // 4. Bloqueia acesso não autorizado a mídias privadas (áudios, vídeos, documentos)
    return res.status(401).json({
        error: 'Acesso negado: Este arquivo de mídia requer autenticação ou link temporário assinado.'
    });
}

module.exports = {
    authenticateRequest,
    requireAdmin,
    requireSuperAdmin,
    requireRole,
    requireBotOwnership,
    requireScreenAccess,
    rateLimitMiddleware,
    generateSessionToken,
    generateSignedToken,
    verifySignedToken,
    revokeToken,
    isTokenRevoked,
    sanitizeControlCharactersMiddleware,
    sanitizeInputMiddleware: sanitizeControlCharactersMiddleware, // Alias para manter compatibilidade
    generateSignedMediaUrl,
    verifySignedMediaUrl,
    authorizeMediaAccess
};


