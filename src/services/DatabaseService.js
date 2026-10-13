const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const pool = new Pool(process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL
} : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'chatbots2',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
});

let isInitialized = false;

async function initDatabase() {
    try {
        if (isInitialized) return pool;

        const client = await pool.connect();
        console.log('✅ Conexão com PostgreSQL estabelecida com sucesso!');
        client.release();

        const MigrationService = require('./MigrationService');
        const migrationService = new MigrationService(pool);
        await migrationService.run();

        isInitialized = true;
        console.log('✅ Banco de dados PostgreSQL inicializado e migrado.');

        // Hidratar variáveis em memória a partir de configurações salvas no banco
        try {
            const { decrypt } = require('../utils/crypto');
            const resKey = await pool.query("SELECT value FROM settings WHERE key = 'openaiApiKey'");
            if (resKey.rows.length > 0 && resKey.rows[0].value) {
                const decKey = decrypt(resKey.rows[0].value);
                if (decKey && decKey.startsWith('sk-') && !process.env.OPENAI_API_KEY) {
                    process.env.OPENAI_API_KEY = decKey;
                    console.log('🔑 Chave OpenAI carregada e descriptografada do banco com sucesso.');
                }
            }
        } catch (keyErr) {
            console.warn('⚠️ Não foi possível carregar openaiApiKey do banco:', keyErr.message);
        }

        return pool;
    } catch (error) {
        console.error('❌ Erro ao inicializar banco de dados PostgreSQL:', error);
        throw error;
    }
}

function getDatabase() {
    return pool;
}

// Wrapper para facilitar a transição de tipos de retorno (SQLlite era .get(), .all(), .run())
async function query(text, params) {
    return pool.query(text, params);
}

async function getSetting(key, defaultValue = null) {
    try {
        const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
        return res.rows.length > 0 ? res.rows[0].value : defaultValue;
    } catch (error) {
        return defaultValue;
    }
}

async function setSetting(key, value) {
    try {
        await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    query,
    getSetting,
    setSetting,
    pool
};

