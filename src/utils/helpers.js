/**
 * Divide um texto em chunks menores
 * @param {string} content - Conteúdo a ser dividido
 * @param {number} firstChunkSize - Tamanho do primeiro chunk (padrão: 100000)
 * @param {number} otherChunkSize - Tamanho dos outros chunks (padrão: 200000)
 * @returns {string[]} Array de chunks
 */
function splitIntoChunks(content, firstChunkSize = 100000, otherChunkSize = 200000) {
    if (!content || content.length === 0) return [];

    const chunks = [];
    const totalLength = content.length;

    // Primeiro chunk (menor)
    if (totalLength > firstChunkSize) {
        let firstChunk = content.substring(0, firstChunkSize);
        const remainingAfterFirst = content.substring(firstChunkSize);

        const breakPoints = [
            firstChunk.lastIndexOf('\n\n'),
            firstChunk.lastIndexOf('.\n'),
            firstChunk.lastIndexOf('.\n\n'),
            firstChunk.lastIndexOf('\n'),
            firstChunk.lastIndexOf('. ')
        ].filter(pos => pos > firstChunkSize * 0.7);

        if (breakPoints.length > 0) {
            const bestBreak = Math.max(...breakPoints);
            firstChunk = content.substring(0, bestBreak + 1);
        }

        chunks.push(firstChunk.trim());

        let remaining = remainingAfterFirst;
        while (remaining.length > 0) {
            if (remaining.length <= otherChunkSize) {
                chunks.push(remaining.trim());
                break;
            }

            let chunk = remaining.substring(0, otherChunkSize);
            const remainingAfterChunk = remaining.substring(otherChunkSize);

            const chunkBreakPoints = [
                chunk.lastIndexOf('\n\n'),
                chunk.lastIndexOf('.\n'),
                chunk.lastIndexOf('.\n\n'),
                chunk.lastIndexOf('\n'),
                chunk.lastIndexOf('. ')
            ].filter(pos => pos > otherChunkSize * 0.7);

            if (chunkBreakPoints.length > 0) {
                const bestBreak = Math.max(...chunkBreakPoints);
                chunk = remaining.substring(0, bestBreak + 1);
                remaining = remaining.substring(bestBreak + 1);
            } else {
                remaining = remainingAfterChunk;
            }

            chunks.push(chunk.trim());
        }
    } else {
        chunks.push(content.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Função para limpar e formatar texto extraído de PDF
 */
function cleanAndFormatPDFText(text) {
    if (!text) return '';

    let cleaned = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/\f/g, '\n\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');
    cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

    cleaned = cleaned.replace(/(\n)(\d+[\.\)])\s+/g, '$1$2 ');
    cleaned = cleaned.replace(/(\n)([•\-*])\s+/g, '$1$2 ');

    cleaned = cleaned.replace(/(\n)([A-ZÁÉÍÓÚÇ][^\n]{0,60})(\n)([A-Z])/g, (match, p1, p2, p3, p4) => {
        if (!/[.!?:;]$/.test(p2)) {
            return p1 + p2 + p3 + p3 + p4;
        }
        return match;
    });

    cleaned = cleaned.trim();

    if (cleaned && !cleaned.endsWith('\n')) {
        cleaned += '\n';
    }

    return cleaned;
}

/**
 * Verifica se um JID é inválido para atendimento (Canais/Newsletters, Status/Broadcasts, etc.)
 */
function isIgnoredJid(jid, ignoreGroups = true) {
    if (!jid || typeof jid !== 'string') return true;
    const clean = jid.toLowerCase().trim();
    // 1. Canais do WhatsApp (Newsletters)
    if (clean.includes('@newsletter') || clean.endsWith('@newsletter')) return true;
    // 2. Status e Stories do WhatsApp e Listas de Transmissão
    if (clean === 'status@broadcast' || clean.includes('@broadcast') || clean.endsWith('@broadcast')) return true;
    // 3. Grupos do WhatsApp (quando configurado para ignorar)
    if (ignoreGroups && (clean.includes('@g.us') || clean.endsWith('@g.us'))) return true;
    // 4. Chamadas, temporários e contas reservadas
    if (clean.includes('@call') || clean.includes('@temp') || clean === '0@c.us' || clean === 'status') return true;
    return false;
}

/**
 * Verifica se uma string representa um nome real de contato e não um placeholder genérico ou número puro de telefone
 */
function isValidContactName(name) {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim();
    if (!clean) return false;

    // Placeholders comuns e genéricos
    const genericLower = clean.toLowerCase();
    if (
        genericLower === 'usuário' ||
        genericLower === 'usuario' ||
        genericLower === 'cliente' ||
        genericLower === 'cliente whatsapp' ||
        genericLower === 'cliente instagram' ||
        genericLower === 'cliente telegram' ||
        genericLower === 'whatsapp' ||
        genericLower === 'instagram' ||
        genericLower === 'telegram' ||
        genericLower === 'sem nome' ||
        genericLower === 'contato' ||
        genericLower.startsWith('contato ') ||
        genericLower.startsWith('instagram @') ||
        genericLower.startsWith('telegram @')
    ) {
        return false;
    }

    // Se for composto unicamente por dígitos ou formatações de telefone (+, -, (), espaços, pontos)
    const digitsOnly = clean.replace(/[\s\+\-\(\)\.]/g, '');
    if (/^\d{7,}$/.test(digitsOnly)) {
        return false;
    }

    return true;
}

/**
 * Normaliza e higieniza números de telefone (especialmente padrão brasileiro com 9º dígito e E.164)
 * @param {string} raw - Número bruto (com ou sem formatação, com ou sem DDI)
 * @returns {{ cleanNumber: string, isValid: boolean, isMobileBR: boolean, jid: string }}
 */
function sanitizePhoneNumber(raw) {
    if (!raw) return { cleanNumber: '', isValid: false, isMobileBR: false, jid: '' };
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return { cleanNumber: '', isValid: false, isMobileBR: false, jid: '' };

    while (digits.startsWith('0')) {
        digits = digits.substring(1);
    }

    // Se tem 10 ou 11 dígitos, é número brasileiro sem DDI 55
    if (digits.length === 10 || digits.length === 11) {
        digits = '55' + digits;
    }

    let isMobileBR = false;
    let isValid = false;

    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        const ddd = parseInt(digits.substring(2, 4), 10);
        if (ddd >= 11 && ddd <= 99) {
            const localNum = digits.substring(4);
            if (localNum.length === 8) {
                const firstDigit = localNum[0];
                if (['6', '7', '8', '9'].includes(firstDigit)) {
                    // Celular sem o 9º dígito: adiciona o 9 para WhatsApp
                    digits = digits.substring(0, 4) + '9' + localNum;
                    isMobileBR = true;
                    isValid = true;
                } else {
                    // Telefone fixo (inicia com 2, 3, 4, 5)
                    isMobileBR = false;
                    isValid = true;
                }
            } else if (localNum.length === 9) {
                if (localNum.startsWith('9')) {
                    isMobileBR = true;
                    isValid = true;
                } else {
                    isValid = false;
                }
            }
        }
    } else if (digits.length >= 8 && digits.length <= 15) {
        // Número internacional válido (E.164)
        isValid = true;
    }

    const jid = isValid ? `${digits}@s.whatsapp.net` : '';
    return {
        cleanNumber: digits,
        isValid,
        isMobileBR,
        jid
    };
}

/**
 * Retorna todos os identificadores e variantes possíveis de um contato
 * (canonical JID, variantes de 9º dígito BR, variantes sem DDI, LIDs conhecidos)
 */
function getContactJidVariants(contactJid, extraLids = []) {
    if (!contactJid || typeof contactJid !== 'string') {
        return { canonicalJid: contactJid || '', jidList: [], cleanPhone: '' };
    }

    const jidSet = new Set();
    const cleanJid = contactJid.trim();
    jidSet.add(cleanJid);

    if (Array.isArray(extraLids)) {
        for (const lid of extraLids) {
            if (lid && typeof lid === 'string') jidSet.add(lid.trim());
        }
    }

    // Se for canal omnichannel (Instagram ou Telegram), preserva integralmente o canal
    if (cleanJid.endsWith('@instagram') || cleanJid.endsWith('@telegram')) {
        const cleanId = cleanJid.split('@')[0];
        return {
            canonicalJid: cleanJid,
            jidList: [cleanJid],
            cleanPhone: cleanId
        };
    }

    const isLid = cleanJid.endsWith('@lid');
    const cleanDigits = cleanJid.split('@')[0].replace(/\D/g, '');
    let canonicalJid = cleanJid;

    if (!isLid && cleanDigits) {
        let phone = cleanDigits;
        while (phone.startsWith('0')) phone = phone.substring(1);

        // Se tem 10 ou 11 dígitos, adiciona DDI 55
        if (phone.length === 10 || phone.length === 11) {
            phone = '55' + phone;
        }

        if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
            const ddd = phone.substring(2, 4);
            const rest = phone.substring(4);

            if (rest.length === 8) {
                // Número brasileiro de 8 dígitos (celular sem 9 ou fixo)
                const with9 = `55${ddd}9${rest}`;
                const without9 = phone;
                jidSet.add(`${with9}@s.whatsapp.net`);
                jidSet.add(`${without9}@s.whatsapp.net`);
                jidSet.add(`${ddd}9${rest}@s.whatsapp.net`);
                jidSet.add(`${ddd}${rest}@s.whatsapp.net`);
                if (['6', '7', '8', '9'].includes(rest[0])) {
                    canonicalJid = `${with9}@s.whatsapp.net`;
                } else {
                    canonicalJid = `${without9}@s.whatsapp.net`;
                }
            } else if (rest.length === 9) {
                // Número brasileiro de 9 dígitos
                const with9 = phone;
                const without9 = `55${ddd}${rest.substring(1)}`;
                jidSet.add(`${with9}@s.whatsapp.net`);
                jidSet.add(`${without9}@s.whatsapp.net`);
                jidSet.add(`${ddd}${rest}@s.whatsapp.net`);
                jidSet.add(`${ddd}${rest.substring(1)}@s.whatsapp.net`);
                canonicalJid = `${with9}@s.whatsapp.net`;
            } else {
                jidSet.add(`${phone}@s.whatsapp.net`);
                canonicalJid = `${phone}@s.whatsapp.net`;
            }
        } else {
            jidSet.add(`${phone}@s.whatsapp.net`);
            canonicalJid = `${phone}@s.whatsapp.net`;
        }
    }

    const cleanPhone = canonicalJid.split('@')[0].replace(/\D/g, '');

    return {
        canonicalJid,
        jidList: Array.from(jidSet),
        cleanPhone
    };
}

module.exports = {
    splitIntoChunks,
    cleanAndFormatPDFText,
    isIgnoredJid,
    isValidContactName,
    sanitizePhoneNumber,
    getContactJidVariants
};

