const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const BotManagerService = require('../services/BotManagerService');

const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;

/**
 * Validação do Webhook pelo Meta / Instagram (Handshake de subscrição)
 */
function handleMetaVerify(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe') {
        return res.status(403).send('Forbidden');
    }

    const expectedToken = META_VERIFY_TOKEN || (process.env.NODE_ENV !== 'production' ? 'zeplyn_meta_verify_token' : null);
    if (!expectedToken) {
        console.error('❌ [Meta Webhook] META_VERIFY_TOKEN não configurado no .env!');
        return res.status(403).send('Forbidden');
    }

    if (typeof token === 'string' && token.length === expectedToken.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
        console.log('✅ [Meta Webhook] Handshake verificado com sucesso pelo Meta/Instagram');
        return res.status(200).send(challenge);
    }

    console.warn('⚠️ [Meta Webhook] Falha de verificação do handshake de webhook (token inválido):', token);
    return res.status(403).send('Forbidden');
}

/**
 * Valida a assinatura HMAC-SHA256 enviada pelo Meta no cabeçalho X-Hub-Signature-256
 */
function verifyMetaSignature(req) {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('❌ [Meta Webhook] META_APP_SECRET obrigatório em produção não configurado!');
            return false;
        }
        return true;
    }

    const signature = req.headers['x-hub-signature-256'];
    if (!signature || typeof signature !== 'string') {
        console.warn('⚠️ [Meta Webhook] Requisição POST rejeitada: Cabeçalho X-Hub-Signature-256 ausente.');
        return false;
    }

    const [scheme, hash] = signature.split('=');
    if (scheme !== 'sha256' || !hash) {
        console.warn('⚠️ [Meta Webhook] Assinatura X-Hub-Signature-256 malformada.');
        return false;
    }

    const payload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const expectedHash = crypto.createHmac('sha256', appSecret).update(payload).digest('hex');

    const expectedBuf = Buffer.from(expectedHash, 'hex');
    const actualBuf = Buffer.from(hash, 'hex');

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
        console.warn('⚠️ [Meta Webhook] Assinatura HMAC inválida do Meta!');
        return false;
    }

    return true;
}

router.get('/', handleMetaVerify);
router.get('/meta', handleMetaVerify);
router.get('/instagram', handleMetaVerify);

/**
 * Recepção de mensagens do Instagram Direct
 */
async function handleMetaMessages(req, res) {
    if (!verifyMetaSignature(req)) {
        return res.status(403).send('Invalid signature');
    }

    const body = req.body;
    console.log(`📩 [Meta Webhook] Recebido: object="${body?.object}", entries=${body?.entry?.length || 0}`);

    if (body?.object === 'instagram' || body?.object === 'page' || (Array.isArray(body?.entry) && body.entry.length > 0)) {
        res.status(200).send('EVENT_RECEIVED'); // Responde 200 imediatamente para o Meta

        try {
            if (Array.isArray(body.entry)) {
                for (const entry of body.entry) {
                    const pageId = entry.id;
                    let botInstance = await BotManagerService.getBotByInstagramPageId(pageId);

                    // Se não encontrou diretamente pelo entry.id, tenta resolver pelo recipient/sender dentro dos eventos
                    if (!botInstance) {
                        const items = Array.isArray(entry.messaging) 
                            ? entry.messaging 
                            : (Array.isArray(entry.standby) 
                                ? entry.standby 
                                : (Array.isArray(entry.changes) ? entry.changes.map(c => c.value).filter(Boolean) : []));

                        for (const it of items) {
                            const recipientId = it?.recipient?.id;
                            const senderId = it?.sender?.id;
                            if (recipientId) {
                                botInstance = await BotManagerService.getBotByInstagramPageId(recipientId);
                                if (botInstance) break;
                            }
                            if (senderId && it?.message?.is_echo) {
                                botInstance = await BotManagerService.getBotByInstagramPageId(senderId);
                                if (botInstance) break;
                            }
                        }
                    }

                    // Fallback definitivo: qualquer bot ativo ou configurado para Instagram
                    if (!botInstance) {
                        botInstance = await BotManagerService.getBotByInstagramPageId(null);
                    }

                    if (botInstance && typeof botInstance.handleWebhookEvent === 'function') {
                        await botInstance.handleWebhookEvent(entry).catch(err => {
                            console.error(`[Instagram Webhook] Erro ao processar evento da página ${pageId}:`, err.message);
                        });
                    } else {
                        console.warn(`[Instagram Webhook] Nenhuma conexão ativa encontrada para a Página ID ${pageId}`);
                    }
                }
            }
        } catch (err) {
            console.error('[Instagram Webhook] Erro ao despachar mensagens:', err.message);
        }
    } else {
        res.status(404).send('Not Found');
    }
}

router.post('/', handleMetaMessages);
router.post('/meta', handleMetaMessages);
router.post('/instagram', handleMetaMessages);

module.exports = router;
