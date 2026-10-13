const crypto = require('crypto');

// A chave de criptografia de segredos do banco de dados (OpenAI, Groq, Telegram, Instagram)
// NUNCA deve ser compartilhada com o frontend nem exposta no bundle Vite.
const DATABASE_ENCRYPTION_KEY = process.env.DATABASE_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'zeplyn-default-secret-key-32';
const ENCRYPTION_KEY = DATABASE_ENCRYPTION_KEY;

// Chave compartilhada para criptografia de payloads da API HTTP com o frontend
const PAYLOAD_ENCRYPTION_KEY = process.env.PAYLOAD_ENCRYPTION_KEY || process.env.VITE_ENCRYPTION_KEY || '44236bbd6e32b83f3287a53b6babb594';

const GCM_IV_LENGTH = 12; // 12 bytes é a recomendação oficial do NIST para AES-GCM
const CBC_IV_LENGTH = 16; // Para compatibilidade retroativa com registros legados CBC

const INSECURE_DEFAULT_KEYS = [
    'zeplyn-default-secret-key-32',
    'itecchatbot-default-secret-key-32'
];

if (process.env.NODE_ENV === 'production') {
    const activeKey = process.env.DATABASE_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
    if (!activeKey || INSECURE_DEFAULT_KEYS.includes(activeKey)) {
        console.error('❌ [FATAL SECURITY ERROR] ENCRYPTION_KEY não configurada ou usando chave padrão insegura em produção!');
        throw new Error('FATAL SECURITY ERROR: ENCRYPTION_KEY não configurada ou insegura. Defina uma chave forte exclusiva de 32 bytes no arquivo .env em produção.');
    }
}

function getKeyBuffer(customKey = null) {
    const rawKey = customKey || DATABASE_ENCRYPTION_KEY;
    return Buffer.alloc(32, rawKey).subarray(0, 32);
}

/**
 * Criptografa usando AES-256-GCM (AEAD autenticado com tag de integridade de 16 bytes).
 * Formato gerado: "gcm:ivHex:tagHex:cipherHex"
 * Fail-Closed: se falhar, NUNCA retorna o texto original em plano; lança erro.
 */
function encrypt(text, customKey = null) {
    if (!text && text !== '') return null;
    try {
        const key = getKeyBuffer(customKey || ENCRYPTION_KEY);
        const iv = crypto.randomBytes(GCM_IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(String(text), 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const tag = cipher.getAuthTag(); // 16 bytes auth tag
        return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    } catch (error) {
        console.error('❌ [Crypto] Falha crítica na criptografia AEAD:', error.message);
        throw new Error('CRYPTO_ENCRYPTION_FAILED');
    }
}

/**
 * Descriptografa com validação criptográfica estrita Fail-Closed.
 * Suporta:
 * 1. Formato moderno AEAD: "gcm:iv:tag:cipher"
 * 2. Formato GCM direto de 3 partes: "iv:tag:cipher"
 * 3. Fallback legado CBC de 2 partes: "iv:cipher" (para leitura segura de registros antigos)
 * Retorna null em caso de adulteração, chave incorreta ou falha de integridade.
 */
function decrypt(text, customKey = null) {
    if (!text && text !== '') return null;
    if (typeof text !== 'string') return null;
    if (!text.includes(':')) return null;

    try {
        const key = getKeyBuffer(customKey || ENCRYPTION_KEY);
        const parts = text.split(':');

        // 1. Formato moderno padrão AEAD AES-256-GCM com prefixo "gcm"
        if (parts[0] === 'gcm' && parts.length === 4) {
            const iv = Buffer.from(parts[1], 'hex');
            const tag = Buffer.from(parts[2], 'hex');
            const encryptedText = Buffer.from(parts[3], 'hex');

            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString('utf8');
        }

        // 2. Formato GCM de 3 partes sem prefixo "iv:tag:cipher"
        if (parts.length === 3) {
            const iv = Buffer.from(parts[0], 'hex');
            const tag = Buffer.from(parts[1], 'hex');
            const encryptedText = Buffer.from(parts[2], 'hex');

            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString('utf8');
        }

        // 3. Fallback para leitura de registros legados CBC de 2 partes "iv:cipher"
        if (parts.length === 2) {
            const iv = Buffer.from(parts[0], 'hex');
            const encryptedText = Buffer.from(parts[1], 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString('utf8');
        }

        return null;
    } catch (error) {
        // Fail-Closed: tag inválida, adulteração ou chave incompatível
        return null;
    }
}

/**
 * Criptografa objetos ou dados arbitrários como string serializada em AEAD para comunicação HTTP com o frontend
 */
function encryptPayload(data, customKey = null) {
    if (data === null || data === undefined) return null;
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const key = customKey || PAYLOAD_ENCRYPTION_KEY;
    return encrypt(jsonStr, key);
}

/**
 * Descriptografa e reconstrói o objeto JSON com validação de integridade Fail-Closed.
 * Suporta a chave do payload do frontend e efetua verificação estrita AEAD (GCM tag).
 */
function decryptPayload(encryptedStr, customKey = null) {
    if (!encryptedStr || typeof encryptedStr !== 'string') return null;

    if (customKey) {
        const decryptedStr = decrypt(encryptedStr, customKey);
        if (decryptedStr !== null && decryptedStr !== undefined) {
            try { return JSON.parse(decryptedStr); } catch { return decryptedStr; }
        }
        return null;
    }

    const candidateKeys = [
        PAYLOAD_ENCRYPTION_KEY,
        process.env.PAYLOAD_ENCRYPTION_KEY,
        process.env.VITE_ENCRYPTION_KEY,
        '44236bbd6e32b83f3287a53b6babb594',
        process.env.ENCRYPTION_KEY,
        DATABASE_ENCRYPTION_KEY,
        'zeplyn-default-secret-key-32'
    ].filter(Boolean);

    const uniqueKeys = Array.from(new Set(candidateKeys));

    for (const key of uniqueKeys) {
        const decryptedStr = decrypt(encryptedStr, key);
        if (decryptedStr !== null && decryptedStr !== undefined) {
            try {
                return JSON.parse(decryptedStr);
            } catch {
                return decryptedStr;
            }
        }
    }

    return null;
}

/**
 * Gera um hash criptográfico seguro e unidirecional para senhas usando scrypt + salt aleatório de forma ASSÍNCRONA
 * (Não bloqueia a thread do Event Loop)
 */
function hashPassword(password) {
    if (!password) return Promise.resolve(null);
    const salt = crypto.randomBytes(16).toString('hex');
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

function hashPasswordSync(password) {
    if (!password) return null;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

/**
 * Valida a senha contra o hash armazenado de forma ASSÍNCRONA e com proteção contra timing attacks.
 * Suporta hashes modernos (scrypt) e mantém compatibilidade com senhas legadas criptografadas com AES ou texto puro.
 */
async function verifyPassword(password, storedHash) {
    if (!password || !storedHash) return false;
    if (typeof password !== 'string' || typeof storedHash !== 'string') return false;

    // Formato moderno com scrypt (assíncrono)
    if (storedHash.startsWith('scrypt:')) {
        const parts = storedHash.split(':');
        if (parts.length === 3) {
            const salt = parts[1];
            const originalHash = parts[2];
            const origBuf = Buffer.from(originalHash, 'hex');
            return new Promise((resolve) => {
                crypto.scrypt(password, salt, 64, (err, derivedKey) => {
                    if (err) return resolve(false);
                    if (origBuf.length !== derivedKey.length) return resolve(false);
                    resolve(crypto.timingSafeEqual(origBuf, derivedKey));
                });
            });
        }
    }

    // Compatibilidade com senhas legadas (AES-256)
    try {
        const decrypted = decrypt(storedHash);
        if (decrypted && typeof decrypted === 'string') {
            const decBuf = Buffer.from(decrypted);
            const passBuf = Buffer.from(password);
            if (decBuf.length === passBuf.length && crypto.timingSafeEqual(decBuf, passBuf)) {
                return true;
            }
        }
    } catch { }

    // Fallback timing-safe para texto puro se houver legados sem criptografia
    const storedBuf = Buffer.from(storedHash);
    const passBuf = Buffer.from(password);
    if (storedBuf.length !== passBuf.length) return false;
    return crypto.timingSafeEqual(storedBuf, passBuf);
}

module.exports = {
    encrypt,
    decrypt,
    encryptPayload,
    decryptPayload,
    hashPassword,
    hashPasswordSync,
    verifyPassword
};
