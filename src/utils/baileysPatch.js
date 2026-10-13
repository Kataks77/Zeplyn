const fs = require('fs');
const path = require('path');

/**
 * Aplica correções críticas de protocolo no Baileys:
 * 1. Correção do cálculo de 'fromMe' ao receber recibos do tipo 'retry'.
 *    No Baileys original, se attrs.recipient existir na stanza de retry (enviada pelo WhatsApp moderno),
 *    o Baileys calculava erroneamente fromMe = false e ignorava a solicitação de reenvio de chave,
 *    deixando o destinatário preso eternamente em "Aguardando esta mensagem. Isso pode levar alguns instantes".
 */
function applyBaileysPatch() {
    try {
        const baileysLibDir = path.join(
            __dirname,
            '..',
            '..',
            'node_modules',
            '@whiskeysockets',
            'baileys',
            'lib'
        );

        if (!fs.existsSync(baileysLibDir)) {
            return;
        }

        // 1. Correção de retry decrypt em messages-recv.js
        const recvPath = path.join(baileysLibDir, 'Socket', 'messages-recv.js');
        if (fs.existsSync(recvPath)) {
            let contentRecv = fs.readFileSync(recvPath, 'utf8');
            const buggyRecv = 'const fromMe = !attrs.recipient || ((attrs.type === \'retry\' || attrs.type === \'sender\') && isNodeFromMe);';
            const fixedRecv = 'const fromMe = !attrs.recipient || attrs.type === \'retry\' || ((attrs.type === \'sender\') && isNodeFromMe);';
            if (contentRecv.includes(buggyRecv)) {
                contentRecv = contentRecv.replace(buggyRecv, fixedRecv);
                fs.writeFileSync(recvPath, contentRecv, 'utf8');
                console.log('✅ [BaileysPatch] Correção de retry decrypt aplicada com sucesso no Baileys.');
            }
        }
    } catch (err) {
        console.warn('⚠️ [BaileysPatch] Aviso ao aplicar patch no Baileys:', err.message);
    }
}

module.exports = {
    applyBaileysPatch
};
