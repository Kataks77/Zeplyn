const { getDatabase } = require('./DatabaseService');
const { encrypt, decrypt } = require('../utils/crypto');

function safeDecrypt(val) {
    if (!val || typeof val !== 'string') return null;
    let current = val;
    let rounds = 0;
    while (current && typeof current === 'string' && current.startsWith('gcm:') && rounds < 5) {
        const dec = decrypt(current);
        if (!dec || dec === current) break;
        current = dec;
        rounds++;
    }
    return current;
}

function safeEncrypt(val) {
    if (!val || typeof val !== 'string') return null;
    if (val.startsWith('gcm:')) return val; // Já encriptado
    return encrypt(val);
}

/**
 * Carregar bot por ID
 */
async function getBot(botId) {
    const db = getDatabase();
    const res = await db.query('SELECT * FROM bots WHERE id = $1', [botId]);
    const bot = res.rows[0];

    if (!bot) return null;

    // Buscar QAs da tabela separada
    const qaRes = await db.query('SELECT * FROM bot_qa WHERE "botId" = $1 ORDER BY "createdAt" ASC', [botId]);

    let parsedFlow = null;
    if (bot.flowData) {
        try {
            parsedFlow = typeof bot.flowData === 'string' ? JSON.parse(bot.flowData) : bot.flowData;
        } catch (e) {
            parsedFlow = null;
        }
    }

    return {
        ...bot,
        channel: bot.channel || 'whatsapp',
        telegramToken: bot.telegramToken ? safeDecrypt(bot.telegramToken) : null,
        instagramPageId: bot.instagramPageId || null,
        instagramAccountId: bot.instagramAccountId || null,
        instagramAccessToken: bot.instagramAccessToken ? safeDecrypt(bot.instagramAccessToken) : null,
        openaiApiKey: safeDecrypt(bot.openaiApiKey),
        uploadedFiles: bot.uploadedFiles ? JSON.parse(bot.uploadedFiles) : [],
        flowData: parsedFlow,
        flowEnabled: !!bot.flowEnabled,
        qa: qaRes.rows
    };
}

/**
 * Criar novo bot
 */
async function createBot(botData) {
    const db = getDatabase();

    const bot = {
        id: botData.id || `bot_${Date.now()}`,
        name: botData.name,
        companyId: botData.companyId || 'company_default',
        openaiApiKey: botData.openaiApiKey || '',
        model: botData.model || 'gpt-3.5-turbo',
        maxTokens: botData.maxTokens || 500,
        temperature: botData.temperature || 0.7,
        systemPrompt: botData.systemPrompt || '',
        uploadedFiles: botData.uploadedFiles || [],
        flowData: botData.flowData ? (typeof botData.flowData === 'object' ? JSON.stringify(botData.flowData) : botData.flowData) : null,
        flowEnabled: !!botData.flowEnabled,
        lastActivity: botData.lastActivity || null,
        userId: botData.userId || null,
        createdAt: botData.createdAt || new Date().toISOString(),
        ignoreGroups: botData.ignoreGroups !== undefined ? !!botData.ignoreGroups : true,
        operationMode: botData.operationMode || 'standard',
        adminPhoneNumber: botData.adminPhoneNumber || null,
        channel: botData.channel || 'whatsapp',
        telegramToken: botData.telegramToken ? safeEncrypt(botData.telegramToken) : null,
        instagramPageId: botData.instagramPageId || null,
        instagramAccessToken: botData.instagramAccessToken ? safeEncrypt(botData.instagramAccessToken) : null
    };

    await db.query(`
        INSERT INTO bots (
            id, name, "openaiApiKey", model, "maxTokens", temperature, "systemPrompt",
            "uploadedFiles", "flowData", "flowEnabled", "lastActivity", "userId", "createdAt", "ignoreGroups", "operationMode", "adminPhoneNumber", "companyId",
            channel, "telegramToken", "instagramPageId", "instagramAccessToken"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    `, [
        bot.id,
        bot.name,
        encrypt(bot.openaiApiKey),
        bot.model,
        bot.maxTokens,
        bot.temperature,
        bot.systemPrompt,
        JSON.stringify(bot.uploadedFiles),
        bot.flowData,
        bot.flowEnabled,
        bot.lastActivity,
        bot.userId,
        bot.createdAt,
        bot.ignoreGroups,
        bot.operationMode,
        bot.adminPhoneNumber,
        bot.companyId,
        bot.channel,
        bot.telegramToken,
        bot.instagramPageId,
        bot.instagramAccessToken
    ]);

    // Inserir QAs se existirem
    if (botData.qa && Array.isArray(botData.qa)) {
        for (const item of botData.qa) {
            await addBotQA(bot.id, item.question, item.answer, item.id);
        }
    }

    return bot;
}

/**
 * Métodos para QA
 */
async function listBotQA(botId) {
    const db = getDatabase();
    const res = await db.query('SELECT * FROM bot_qa WHERE "botId" = $1 ORDER BY "createdAt" ASC', [botId]);
    return res.rows;
}

async function addBotQA(botId, question, answer, id = null) {
    const db = getDatabase();
    const qaId = id || `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    await db.query(`
        INSERT INTO bot_qa (id, "botId", question, answer, "createdAt")
        VALUES ($1, $2, $3, $4, $5)
    `, [qaId, botId, question, answer, createdAt]);

    return { id: qaId, botId, question, answer, createdAt };
}

async function updateBotQA(qaId, question, answer) {
    const db = getDatabase();
    await db.query(`
        UPDATE bot_qa SET question = $1, answer = $2 WHERE id = $3
    `, [question, answer, qaId]);
    return true;
}

async function deleteBotQA(qaId) {
    const db = getDatabase();
    await db.query('DELETE FROM bot_qa WHERE id = $1', [qaId]);
    return true;
}

/**
 * Atualizar bot
 */
async function updateBot(botId, updates) {
    const db = getDatabase();
    const res = await db.query('SELECT * FROM bots WHERE id = $1', [botId]);
    const existing = res.rows[0];
    if (!existing) {
        throw new Error('Bot não encontrado');
    }

    const fields = [];
    const values = [];
    let count = 1;

    if (updates.name !== undefined) { fields.push(`name = $${count++}`); values.push(updates.name); }
    if (updates.openaiApiKey !== undefined) { fields.push(`"openaiApiKey" = $${count++}`); values.push(encrypt(updates.openaiApiKey)); }
    if (updates.model !== undefined) { fields.push(`model = $${count++}`); values.push(updates.model); }
    if (updates.maxTokens !== undefined) { fields.push(`"maxTokens" = $${count++}`); values.push(updates.maxTokens); }
    if (updates.temperature !== undefined) { fields.push(`temperature = $${count++}`); values.push(updates.temperature); }
    if (updates.systemPrompt !== undefined) { fields.push(`"systemPrompt" = $${count++}`); values.push(updates.systemPrompt); }
    if (updates.uploadedFiles !== undefined) { fields.push(`"uploadedFiles" = $${count++}`); values.push(JSON.stringify(updates.uploadedFiles)); }
    if (updates.flowData !== undefined) {
        fields.push(`"flowData" = $${count++}`);
        values.push(updates.flowData ? (typeof updates.flowData === 'object' ? JSON.stringify(updates.flowData) : updates.flowData) : null);
    }
    if (updates.flowEnabled !== undefined) {
        fields.push(`"flowEnabled" = $${count++}`);
        values.push(!!updates.flowEnabled);
    }
    if (updates.lastActivity !== undefined) { fields.push(`"lastActivity" = $${count++}`); values.push(updates.lastActivity); }
    if (updates.userId !== undefined) { fields.push(`"userId" = $${count++}`); values.push(updates.userId); }
    if (updates.ignoreGroups !== undefined) { fields.push(`"ignoreGroups" = $${count++}`); values.push(!!updates.ignoreGroups); }
    if (updates.adminPhoneNumber !== undefined) { fields.push(`"adminPhoneNumber" = $${count++}`); values.push(updates.adminPhoneNumber); }
    if (updates.operationMode !== undefined) { fields.push(`"operationMode" = $${count++}`); values.push(updates.operationMode); }
    if (updates.openaiAssistantId !== undefined) { fields.push(`"openaiAssistantId" = $${count++}`); values.push(updates.openaiAssistantId); }
    if (updates.openaiVectorStoreId !== undefined) { fields.push(`"openaiVectorStoreId" = $${count++}`); values.push(updates.openaiVectorStoreId); }
    if (updates.companyId !== undefined) { fields.push(`"companyId" = $${count++}`); values.push(updates.companyId); }
    if (updates.channel !== undefined) { fields.push(`channel = $${count++}`); values.push(updates.channel); }
    if (updates.telegramToken !== undefined) {
        fields.push(`"telegramToken" = $${count++}`);
        values.push(updates.telegramToken ? safeEncrypt(updates.telegramToken) : null);
    }
    if (updates.instagramPageId !== undefined) { fields.push(`"instagramPageId" = $${count++}`); values.push(updates.instagramPageId); }
    if (updates.instagramAccountId !== undefined) { fields.push(`"instagramAccountId" = $${count++}`); values.push(updates.instagramAccountId); }
    if (updates.instagramAccessToken !== undefined) {
        fields.push(`"instagramAccessToken" = $${count++}`);
        values.push(updates.instagramAccessToken ? safeEncrypt(updates.instagramAccessToken) : null);
    }

    if (fields.length === 0) {
        return await getBot(botId);
    }

    values.push(botId);
    const sql = `UPDATE bots SET ${fields.join(', ')} WHERE id = $${count}`;
    await db.query(sql, values);

    return await getBot(botId);
}

/**
 * Deletar bot
 */
async function deleteBot(botId) {
    const db = getDatabase();

    try {
        // Limpar dependências para evitar erro de Foreign Key
        await db.query('DELETE FROM messages WHERE botid = $1', [botId]).catch(() => { });
        await db.query('DELETE FROM chats WHERE "botId" = $1', [botId]).catch(() => { });
        await db.query('DELETE FROM contacts WHERE "botId" = $1', [botId]).catch(() => { });
        await db.query('DELETE FROM bot_qa WHERE "botId" = $1', [botId]).catch(() => { });
    } catch (e) {
        console.error('Erro ao limpar dependências do bot:', e);
    }

    await db.query('DELETE FROM bots WHERE id = $1', [botId]);
    return true;
}

/**
 * Listar bots (filtrando por companyId se especificado)
 */
async function listBots(companyId = null) {
    const db = getDatabase();
    let query = 'SELECT b.*, c.name as "companyName" FROM bots b LEFT JOIN companies c ON b."companyId" = c.id';
    const params = [];
    if (companyId) {
        query += ' WHERE b."companyId" = $1';
        params.push(companyId);
    }
    query += ' ORDER BY b."createdAt" DESC';
    const res = await db.query(query, params);
    const botsData = res.rows;

    const enrichedBots = [];
    for (const bot of botsData) {
        const qaRes = await db.query('SELECT * FROM bot_qa WHERE "botId" = $1', [bot.id]);
        let parsedFlow = null;
        if (bot.flowData) {
            try {
                parsedFlow = typeof bot.flowData === 'string' ? JSON.parse(bot.flowData) : bot.flowData;
            } catch (e) {
                parsedFlow = null;
            }
        }
        enrichedBots.push({
            ...bot,
            openaiApiKey: decrypt(bot.openaiApiKey),
            uploadedFiles: bot.uploadedFiles ? JSON.parse(bot.uploadedFiles) : [],
            flowData: parsedFlow,
            flowEnabled: !!bot.flowEnabled,
            qa: qaRes.rows
        });
    }
    return enrichedBots;
}

module.exports = {
    getBot,
    createBot,
    updateBot,
    deleteBot,
    listBots,
    listBotQA,
    addBotQA,
    updateBotQA,
    deleteBotQA
};
;
