const { encryptPayload, decryptPayload } = require('../utils/crypto');

// Lista de padrões de rotas sensíveis que devem ser protegidas
const SENSITIVE_ROUTES = [
    '/api/login',
    '/api/register',
    '/api/logout',
    '/api/users',
    '/api/openai-key',
    '/api/groq-key',
    '/api/chats',
    '/api/contacts',
    '/api/settings',
    '/api/business-hours',
    '/api/notifications',
    '/api/quick-messages',
    '/api/quick-replies',
    '/api/bots',
    '/api/companies',
    '/api/dashboard',
    '/api/campaigns',
    '/api/roles',
    '/api/reports',
    '/api/stickers',
    '/api/metrics',
    '/api/record-metrics'
];

/**
 * Verifica se a URL da requisição corresponde a uma rota sensível da API
 */
function isSensitivePath(url) {
    if (!url) return false;
    const cleanUrl = url.toLowerCase().split('?')[0];
    // Exclui apenas rotas públicas de infraestrutura/healthcheck, webhooks externos e exports binários
    if (cleanUrl === '/api/health' || cleanUrl.startsWith('/api/webhooks') || cleanUrl.startsWith('/api/webhook') || cleanUrl.startsWith('/webhooks') || cleanUrl.startsWith('/webhook') || cleanUrl.includes('/export')) return false;
    return SENSITIVE_ROUTES.some(sensitiveRoute => cleanUrl.startsWith(sensitiveRoute) || cleanUrl.includes(sensitiveRoute)) || cleanUrl.startsWith('/api/');
}

/**
 * Middleware de criptografia/descriptografia de payload
 */
function cryptoMiddleware(req, res, next) {
    const isSensitive = isSensitivePath(req.originalUrl || req.url);
    const hasEncryptedHeader = req.headers['x-encrypted-payload'] === 'true';
    const acceptsEncrypted = req.headers['x-accept-encrypted'] === 'true';
    const skipEncryption = req.headers['x-skip-encryption'] === 'true';

    // 1. DESCRIPTOGRAFIA FAIL-CLOSED: Se o corpo veio com _enc ou cabeçalho criptografado
    if (req.body && typeof req.body === 'object' && req.body._enc !== undefined) {
        if (typeof req.body._enc === 'string' && req.body._enc.includes(':')) {
            try {
                const decrypted = decryptPayload(req.body._enc);
                if (decrypted !== null && decrypted !== undefined) {
                    req.body = decrypted;
                    req.isEncryptedPayload = true;
                } else {
                    // FAIL-CLOSED: Rejeição imediata se não passar na verificação AEAD
                    return res.status(400).json({
                        error: 'Falha na validação de integridade ou autenticidade do payload criptografado (AEAD). Requisição rejeitada.'
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    error: 'Erro crítico na validação do payload criptografado.'
                });
            }
        } else {
            // Se _enc veio em formato inválido/malformado
            return res.status(400).json({ error: 'Payload criptografado malformado.' });
        }
    } else if (hasEncryptedHeader) {
        req.isEncryptedPayload = true;
    }

    // 2. CRIPTOGRAFIA DE RESPOSTA: Interceptar res.json
    const originalJson = res.json.bind(res);

    res.json = function (data) {
        // Se a criptografia estiver desativada explicitamente por header
        if (skipEncryption) {
            return originalJson(data);
        }

        // Criptografa a resposta se o cliente aceita criptografia E a rota é da API / sensível ou requisição foi criptografada
        const shouldEncrypt = (acceptsEncrypted && (req.isEncryptedPayload || hasEncryptedHeader || isSensitive)) &&
            data !== null &&
            data !== undefined &&
            !(typeof data === 'object' && data._enc);

        if (shouldEncrypt) {
            try {
                const encryptedPayload = encryptPayload(data);
                res.setHeader('X-Encrypted-Payload', 'true');
                res.setHeader('Content-Type', 'application/json');
                return originalJson({ _enc: encryptedPayload });
            } catch (err) {
                console.error('❌ [CryptoMiddleware] Erro ao criptografar resposta:', err);
                return originalJson(data);
            }
        }

        return originalJson(data);
    };

    next();
}

module.exports = {
    cryptoMiddleware,
    isSensitivePath,
    SENSITIVE_ROUTES
};
