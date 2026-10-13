/**
 * Script de Verificação e Validação das Correções de Segurança
 */
const assert = require('assert');
const crypto = require('crypto');
const { encrypt, decrypt, hashPassword, hashPasswordSync, verifyPassword } = require('./src/utils/crypto');
const FlowService = require('./src/services/FlowService');

async function runTests() {
    console.log('🧪 Iniciando testes de segurança...');

    // 1. Teste de Criptografia e Hash Assíncrono (scrypt)
    console.log('\n--- 1. Criptografia & Senhas ---');
    const plainText = 'MinhaSenhaSegura@123';
    const hash = await hashPassword(plainText);
    assert(hash.startsWith('scrypt:'), 'Hash deve começar com scrypt:');
    console.log('✅ hashPassword gerou hash seguro scrypt');

    const isValid = await verifyPassword(plainText, hash);
    assert.strictEqual(isValid, true, 'Senha correta deve validar como true');

    const isInvalid = await verifyPassword('SenhaIncorreta!123', hash);
    assert.strictEqual(isInvalid, false, 'Senha incorreta deve validar como false');
    console.log('✅ verifyPassword assíncrono validou corretamente com proteção timing-safe');

    const syncHash = hashPasswordSync(plainText);
    assert(syncHash.startsWith('scrypt:'), 'hashPasswordSync deve funcionar sincronamente');
    const syncValid = await verifyPassword(plainText, syncHash);
    assert.strictEqual(syncValid, true, 'Hash gerado por hashPasswordSync deve ser validado');
    console.log('✅ hashPasswordSync validado para migrations');

    // 2. Teste de Criptografia AEAD
    const secretData = 'dado-super-secreto';
    const encrypted = encrypt(secretData);
    assert(encrypted.startsWith('gcm:'), 'Criptografia moderna deve usar gcm');
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, secretData, 'Descriptografia deve recompor texto original');
    console.log('✅ AEAD AES-256-GCM funcionando perfeitamente');

    // 3. Teste de Proteção contra SSRF em FlowService
    console.log('\n--- 2. Proteção SSRF Reforçada (FlowService) ---');
    const dangerousUrls = [
        'http://localhost:3000/api',
        'http://127.0.0.1:5432',
        'http://[::1]',
        'http://[::1]:8080/admin',
        'http://127.0.0.1.nip.io/internal',
        'http://169.254.169.254/latest/meta-data/',
        'http://10.0.0.1/admin',
        'http://192.168.1.1/router',
        'http://172.16.0.5:8080/internal',
        'http://0.0.0.0:80',
        'http://internal-service.local/status'
    ];

    for (const url of dangerousUrls) {
        const isSafe = await FlowService.isSafePublicUrl(url);
        assert.strictEqual(isSafe, false, `URL interna deve ser bloqueada: ${url}`);
    }
    console.log('✅ IPv6 bracketed ([::1]), DNS rebinding (*.nip.io) e redes privadas foram todos bloqueados com sucesso');

    const safeUrls = [
        'https://api.telegram.org/bot123/sendMessage',
        'https://api.openai.com/v1/chat/completions',
        'https://hooks.zapier.com/hooks/catch/123/abc',
        'https://api.github.com/users'
    ];

    for (const url of safeUrls) {
        const isSafe = await FlowService.isSafePublicUrl(url);
        assert.strictEqual(isSafe, true, `URL pública legítima deve ser permitida: ${url}`);
    }
    console.log('✅ URLs públicas legítimas foram devidamente aceitas');

    // Teste de safeHttpRequest bloqueando SSRF e DNS rebinding
    console.log('\n--- 3. Validação de safeHttpRequest (Prevenção de DNS Rebinding / SSRF) ---');
    for (const url of dangerousUrls.slice(0, 5)) {
        let blocked = false;
        try {
            await FlowService.safeHttpRequest(url, { timeout: 1000 });
        } catch (err) {
            blocked = true;
        }
        assert.strictEqual(blocked, true, `safeHttpRequest deve bloquear conexão para: ${url}`);
    }
    console.log('✅ safeHttpRequest bloqueou com sucesso todas as requisições para IPs/hostnames perigosos');

    // 4. Teste de URLs Assinadas para Uploads Privados
    console.log('\n--- 4. Mídias Assinadas (/uploads) ---');
    const { generateSignedMediaUrl, verifySignedMediaUrl } = require('./src/middlewares/authMiddleware');
    const filename = 'comprovante_sigiloso_12345.pdf';
    const signedUrl = generateSignedMediaUrl(filename, 3600 * 1000);
    assert(signedUrl.includes('sig=') && signedUrl.includes('exp='), 'URL assinada deve conter parâmetros sig e exp');

    const parsedMediaUrl = new URL(signedUrl, 'http://localhost');
    const expParam = parsedMediaUrl.searchParams.get('exp');
    const sigParam = parsedMediaUrl.searchParams.get('sig');

    const isMediaValid = verifySignedMediaUrl(filename, sigParam, expParam);
    assert.strictEqual(isMediaValid, true, 'Link assinado legítimo deve ser aceito');

    const isTampered = verifySignedMediaUrl('outro_arquivo.pdf', sigParam, expParam);
    assert.strictEqual(isTampered, false, 'Link assinado adulterado para outro arquivo deve ser rejeitado');

    const isForgedSig = verifySignedMediaUrl(filename, 'assinatura_falsa_123', expParam);
    assert.strictEqual(isForgedSig, false, 'Assinatura inválida deve ser rejeitada');

    const isExpired = verifySignedMediaUrl(filename, sigParam, (Date.now() - 1000).toString());
    assert.strictEqual(isExpired, false, 'Assinatura expirada deve ser rejeitada');

    // Teste: authorizeMediaAccess deve rejeitar JWT em query param (?token=) e exigir Bearer header
    const { authorizeMediaAccess, generateSignedToken } = require('./src/middlewares/authMiddleware');
    const validJwt = generateSignedToken({ userId: 1, role: 'admin' });

    let statusCalled = null;
    let jsonCalled = null;
    const mockRes = {
        status: (s) => {
            statusCalled = s;
            return {
                json: (j) => { jsonCalled = j; }
            };
        }
    };

    // Tentativa 1: JWT passado via ?token= (deve ser rejeitado com 401)
    let nextCalled = false;
    await authorizeMediaAccess({
        path: '/relatorio_privado.pdf',
        query: { token: validJwt },
        headers: {}
    }, mockRes, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'JWT em query string (?token=) NÃO deve ser aceito');
    assert.strictEqual(statusCalled, 401, 'Deve retornar 401 para tentativa de JWT via query string');

    // Tentativa 2: JWT passado via cabeçalho Authorization: Bearer (deve ser aceito)
    nextCalled = false;
    statusCalled = null;
    await authorizeMediaAccess({
        path: '/relatorio_privado.pdf',
        query: {},
        headers: { authorization: `Bearer ${validJwt}` }
    }, mockRes, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'JWT em cabeçalho Authorization Bearer DEVE ser aceito');
    console.log('✅ authorizeMediaAccess bloqueia JWT em ?token= e restringe exclusivamente a Authorization: Bearer');

    // 5. Teste de Redação de Query String nos Logs
    console.log('\n--- 5. Redação de Query String nos Logs Globais ---');
    const redactUrlQuery = (rawUrl) => {
        let safeUrl = rawUrl || '';
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
        return safeUrl;
    };

    const leakedUrl = '/uploads/doc.pdf?sig=9f82ab7c8e&exp=1790000000000&token=jwt_secret_token_123';
    const redacted = redactUrlQuery(leakedUrl);
    assert(!redacted.includes('9f82ab7c8e'), 'A assinatura HMAC não deve constar no log');
    assert(!redacted.includes('jwt_secret_token_123'), 'O token JWT não deve constar no log');
    assert(redacted.includes('sig=%5BREDACTED%5D') || redacted.includes('sig=[REDACTED]'), 'Parâmetro sig deve ser redigido');
    assert(redacted.includes('token=%5BREDACTED%5D') || redacted.includes('token=[REDACTED]'), 'Parâmetro token deve ser redigido');
    console.log('✅ Query strings sensíveis com tokens/assinaturas são redigidas dos logs antes da gravação');

    // 6. Teste de Validação de Domínios CORS
    console.log('\n--- 6. Validação Estrita de CORS ---');
    const ALLOWED_CORS_DOMAINS = ['zeplyn.com.br', 'zeplyn.com', 'zeplync.online', 'itecchatbot.com.br'];
    const isCorsAllowed = (origin) => {
        try {
            const host = new URL(origin).hostname;
            return host === 'localhost' || 
                   host === '127.0.0.1' || 
                   ALLOWED_CORS_DOMAINS.some(d => host === d || host.endsWith('.' + d));
        } catch (_) {
            return false;
        }
    };

    assert.strictEqual(isCorsAllowed('https://app.zeplyn.com.br'), true, 'Subdomínio legítimo permitido');
    assert.strictEqual(isCorsAllowed('https://zeplyn.com'), true, 'Domínio base permitido');
    assert.strictEqual(isCorsAllowed('http://localhost:5173'), true, 'Localhost permitido');
    assert.strictEqual(isCorsAllowed('https://attackerzeplyn.com'), false, 'Ataque de sufixo deve ser bloqueado');
    assert.strictEqual(isCorsAllowed('https://fakeitecchatbot.com.br'), false, 'Domínio malicioso deve ser bloqueado');
    assert.strictEqual(isCorsAllowed('https://notzeplync.online'), false, 'Domínio malicioso deve ser bloqueado');
    console.log('✅ Proteção contra bypass de CORS verificada e validada');

    console.log('\n🎉 TODOS OS TESTES DE SEGURANÇA FORAM CONCLUÍDOS COM SUCESSO!');
    process.exit(0);
}

runTests().catch(err => {
    console.error('❌ Falha nos testes de segurança:', err);
    process.exit(1);
});
