const fs = require('fs-extra');
const path = require('path');

class MigrationService {
    constructor(db) {
        this.db = db; // Agora é o pool do pg
        this.migrationsPath = path.join(__dirname, '..', '..', 'migrations');
    }

    async init() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS migrations_history (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async run() {
        await this.init();

        const coreMigrations = [
            {
                name: '001_initial_schema',
                up: `
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'admin',
                        "phoneNumber" TEXT,
                        "createdAt" TEXT NOT NULL,
                        "isActive" BOOLEAN NOT NULL DEFAULT TRUE
                    );
                    CREATE TABLE IF NOT EXISTS bots (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        "openaiApiKey" TEXT,
                        model TEXT NOT NULL DEFAULT 'gpt-3.5-turbo',
                        "maxTokens" INTEGER NOT NULL DEFAULT 500,
                        temperature REAL NOT NULL DEFAULT 0.7,
                        "systemPrompt" TEXT,
                        "uploadedFiles" TEXT,
                        qa TEXT,
                        "lastActivity" TEXT,
                        "userId" TEXT,
                        "adminId" TEXT,
                        "createdAt" TEXT NOT NULL,
                        FOREIGN KEY ("userId") REFERENCES users(id),
                        FOREIGN KEY ("adminId") REFERENCES users(id)
                    );
                `
            },
            {
                name: '002_add_bot_columns',
                up: `
                    DO $$ 
                    BEGIN 
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "ignoreGroups" BOOLEAN NOT NULL DEFAULT TRUE;
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column ignoreGroups already exists in bots';
                        END;
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "adminPhoneNumber" TEXT;
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column adminPhoneNumber already exists in bots';
                        END;
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "operationMode" TEXT NOT NULL DEFAULT 'standard';
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column operationMode already exists in bots';
                        END;
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "openaiAssistantId" TEXT;
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column openaiAssistantId already exists in bots';
                        END;
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "openaiVectorStoreId" TEXT;
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column openaiVectorStoreId already exists in bots';
                        END;
                    END $$;
                `
            },
            {
                name: '003_notifications_table',
                up: `
                    CREATE TABLE IF NOT EXISTS notifications (
                        id TEXT PRIMARY KEY,
                        "userId" TEXT NOT NULL,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        type TEXT DEFAULT 'Informativo',
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT,
                        "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
                        "sentBy" TEXT,
                        FOREIGN KEY ("userId") REFERENCES users(id)
                    );
                `
            },
            {
                name: '004_messages_table',
                up: `
                    CREATE TABLE IF NOT EXISTS messages (
                        id TEXT PRIMARY KEY,
                        botId TEXT NOT NULL,
                        userId TEXT NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp TEXT NOT NULL,
                        FOREIGN KEY (botId) REFERENCES bots(id)
                    );
                    CREATE INDEX IF NOT EXISTS idx_messages_botId ON messages(botId);
                    CREATE INDEX IF NOT EXISTS idx_messages_userId ON messages(userId);
                `
            },
            {
                name: '005_default_admin',
                up: (() => {
                    const crypto = require('crypto');
                    const { hashPasswordSync, encrypt } = require('../utils/crypto');
                    const initialPass = process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
                    const passHash = hashPasswordSync ? hashPasswordSync(initialPass) : encrypt(initialPass);
                    return `
                    INSERT INTO users (id, name, email, password, role, "createdAt", "isActive")
                    VALUES (
                        'admin_default',
                        'Suporte Zeplyn',
                        'suporte@zeplyn.com.br',
                        '${passHash}',
                        'superadmin',
                        '${new Date().toISOString()}',
                        TRUE
                    ) ON CONFLICT (id) DO NOTHING;
                    `;
                })()
            },
            {
                name: '006_qa_table',
                up: `
                    CREATE TABLE IF NOT EXISTS bot_qa (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        question TEXT NOT NULL,
                        answer TEXT NOT NULL,
                        "createdAt" TEXT NOT NULL,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_qa_botId ON bot_qa("botId");
                `
            },
            {
                name: '007_contacts_table',
                up: `
                    CREATE TABLE IF NOT EXISTS contacts (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        name TEXT NOT NULL,
                        "phoneNumber" TEXT NOT NULL,
                        jid TEXT NOT NULL,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_contacts_botId ON contacts("botId");
                    CREATE INDEX IF NOT EXISTS idx_contacts_phoneNumber ON contacts("phoneNumber");
                `
            },
            {
                name: '008_add_reaction_to_messages',
                up: `
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction TEXT;
                `
            },
            {
                name: '009_lid_mappings_table',
                up: `
                    CREATE TABLE IF NOT EXISTS lid_mappings (
                        lid TEXT PRIMARY KEY,
                        jid TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_lid_mappings_jid ON lid_mappings(jid);
                `
            },
            {
                name: '010_add_profile_pic_columns',
                up: `
                    ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "profilePicUrl" TEXT;
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "profilePicUrl" TEXT;
                `
            },
            {
                name: '011_quick_messages_table',
                up: `
                    CREATE TABLE IF NOT EXISTS quick_messages (
                        id SERIAL PRIMARY KEY,
                        shortcut TEXT UNIQUE NOT NULL,
                        content TEXT NOT NULL,
                        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `
            },
            {
                name: '012_default_quick_messages',
                up: `
                    INSERT INTO quick_messages (shortcut, content) VALUES
                    ('/notificacao', 'Olá *{nome}*, você tem uma nova notificação (*{titulo}*). Por favor, verifique assim que possível.'),
                    ('/boasvindas', 'Olá *{nome}*, seja muito bem-vindo(a)! Como posso te ajudar hoje?'),
                    ('/suporte', 'Olá *{nome}*, o seu atendimento foi encaminhado para o suporte técnico. Por favor, aguarde um momento.')
                    ON CONFLICT (shortcut) DO NOTHING;
                `
            },
            {
                name: '013_messages_sender_name',
                up: `
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS "senderName" TEXT;
                `
            },
            {
                name: '014_chats_needs_human',
                up: `
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "needsHuman" BOOLEAN DEFAULT FALSE;
                `
            },
            {
                name: '015_chats_table_and_csat',
                up: `
                    CREATE TABLE IF NOT EXISTS chats (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        "contactJid" TEXT NOT NULL,
                        "contactName" TEXT,
                        status TEXT NOT NULL DEFAULT 'waiting',
                        "attendantId" TEXT,
                        "profilePicUrl" TEXT,
                        "needsHuman" BOOLEAN DEFAULT FALSE,
                        "csatRating" INTEGER,
                        "csatComment" TEXT,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE,
                        FOREIGN KEY ("attendantId") REFERENCES users(id) ON DELETE SET NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_chats_botId ON chats("botId");
                    CREATE INDEX IF NOT EXISTS idx_chats_contactJid ON chats("contactJid");
                    CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "csatRating" INTEGER;
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "csatComment" TEXT;
                `
            },
            {
                name: '016_cleanup_and_rebrand',
                up: `
                    ALTER TABLE users DROP COLUMN IF EXISTS "apartmentNumber";
                    UPDATE users 
                    SET name = 'Suporte Zeplyn', email = 'suporte@zeplyn.com.br' 
                    WHERE id = 'admin_default';
                    UPDATE quick_messages 
                    SET content = 'Olá *{nome}*, você tem uma nova notificação (*{titulo}*). Por favor, verifique assim que possível.'
                    WHERE shortcut = '/notificacao';
                    DELETE FROM quick_messages WHERE shortcut = '/senha';
                `
            },
            {
                name: '017_drop_legacy_columns',
                up: `
                    ALTER TABLE bots DROP COLUMN IF EXISTS "adminId";
                `
            },
            {
                name: '018_multitenant_companies',
                up: `
                    CREATE TABLE IF NOT EXISTS companies (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        cnpj TEXT,
                        "maxBots" INTEGER NOT NULL DEFAULT 5,
                        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
                        "createdAt" TEXT NOT NULL
                    );

                    INSERT INTO companies (id, name, "maxBots", "isActive", "createdAt")
                    VALUES ('company_default', 'Empresa Principal', 20, TRUE, '${new Date().toISOString()}')
                    ON CONFLICT (id) DO NOTHING;

                    ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyId" TEXT REFERENCES companies(id) ON DELETE SET NULL;
                    ALTER TABLE bots ADD COLUMN IF NOT EXISTS "companyId" TEXT REFERENCES companies(id) ON DELETE CASCADE;
                    ALTER TABLE quick_messages ADD COLUMN IF NOT EXISTS "companyId" TEXT;

                    UPDATE users SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
                    UPDATE bots SET "companyId" = 'company_default' WHERE "companyId" IS NULL;
                    UPDATE quick_messages SET "companyId" = 'company_default' WHERE "companyId" IS NULL;

                    UPDATE users SET role = 'superadmin' WHERE id = 'admin_default' OR email = 'suporte@zeplyn.com.br' OR email = 'suporte@itecchatbot.com.br';
                `
            },
            {
                name: '019_master_superadmin_karllos',
                up: (() => {
                    const crypto = require('crypto');
                    const { hashPasswordSync } = require('../utils/crypto');
                    const configuredPass = process.env.INITIAL_SUPERADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
                    const passHash = configuredPass ? hashPasswordSync(configuredPass) : null;
                    return `
                        UPDATE users 
                        SET role = 'superadmin',
                            "companyId" = 'company_default',
                            "isActive" = TRUE
                            ${passHash ? `, password = CASE WHEN password IS NULL OR password = '' THEN '${passHash}' ELSE password END` : ''}
                        WHERE id = 'admin_default';
                    `;
                })()
            },
            {
                name: '020_cleanup_newsletter_and_broadcast',
                up: `
                    DELETE FROM messages 
                    WHERE "userid" LIKE '%@newsletter%' 
                       OR "userid" LIKE '%@broadcast%' 
                       OR "userid" = 'status@broadcast'
                       OR "userid" LIKE '%@g.us%';

                    DELETE FROM chats 
                    WHERE "contactJid" LIKE '%@newsletter%' 
                       OR "contactJid" LIKE '%@broadcast%' 
                       OR "contactJid" = 'status@broadcast'
                       OR "contactJid" LIKE '%@g.us%';

                    DELETE FROM contacts 
                    WHERE jid LIKE '%@newsletter%' 
                       OR jid LIKE '%@broadcast%' 
                       OR jid = 'status@broadcast'
                       OR jid LIKE '%@g.us%';
                `
            },
            {
                name: '021_bot_stickers_table',
                up: `
                    CREATE TABLE IF NOT EXISTS bot_stickers (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        url TEXT NOT NULL,
                        name TEXT,
                        "createdAt" TEXT NOT NULL,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_bot_stickers_botId ON bot_stickers("botId");
                `
            },
            {
                name: '022_add_bot_flow_columns',
                up: `
                    DO $$ 
                    BEGIN 
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "flowData" TEXT;
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column flowData already exists in bots';
                        END;
                        BEGIN
                            ALTER TABLE bots ADD COLUMN "flowEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
                        EXCEPTION
                            WHEN duplicate_column THEN RAISE NOTICE 'column flowEnabled already exists in bots';
                        END;
                    END $$;
                `
            },
            {
                name: '023_revoked_tokens_table',
                up: `
                    CREATE TABLE IF NOT EXISTS revoked_tokens (
                        token_hash TEXT PRIMARY KEY,
                        "userId" TEXT,
                        "expiresAt" BIGINT NOT NULL,
                        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiresAt ON revoked_tokens("expiresAt");
                `
            },
            {
                name: '024_chat_tags_and_notes',
                up: `
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';
                `
            },
            {
                name: '025_user_chat_tags_table',
                up: `
                    CREATE TABLE IF NOT EXISTS user_tags (
                        id TEXT PRIMARY KEY,
                        "userId" TEXT NOT NULL,
                        name TEXT NOT NULL,
                        color TEXT NOT NULL DEFAULT '#3b82f6',
                        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_user_tags_userId ON user_tags("userId");
                `
            },
            {
                name: '026_campaigns_and_logs_table',
                up: `
                    CREATE TABLE IF NOT EXISTS campaigns (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        "botId" TEXT NOT NULL,
                        "companyId" TEXT,
                        "messageTemplate" TEXT NOT NULL,
                        "mediaUrl" TEXT,
                        "mediaType" TEXT DEFAULT 'none',
                        "delayMin" INTEGER NOT NULL DEFAULT 15,
                        "delayMax" INTEGER NOT NULL DEFAULT 35,
                        "targetType" TEXT NOT NULL DEFAULT 'all',
                        "targetTags" TEXT DEFAULT '[]',
                        "manualNumbers" TEXT DEFAULT '[]',
                        status TEXT NOT NULL DEFAULT 'draft',
                        "scheduledAt" TEXT,
                        "totalCount" INTEGER NOT NULL DEFAULT 0,
                        "sentCount" INTEGER NOT NULL DEFAULT 0,
                        "failedCount" INTEGER NOT NULL DEFAULT 0,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        "completedAt" TEXT,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_campaigns_botId ON campaigns("botId");
                    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

                    CREATE TABLE IF NOT EXISTS campaign_logs (
                        id TEXT PRIMARY KEY,
                        "campaignId" TEXT NOT NULL,
                        "phoneNumber" TEXT NOT NULL,
                        "contactName" TEXT,
                        status TEXT NOT NULL DEFAULT 'pending',
                        "errorMessage" TEXT,
                        "sentAt" TEXT,
                        FOREIGN KEY ("campaignId") REFERENCES campaigns(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaignId ON campaign_logs("campaignId");
                `
            },
            {
                name: '027_roles_queue_schedules',
                up: `
                    CREATE TABLE IF NOT EXISTS company_roles (
                        id TEXT PRIMARY KEY,
                        "companyId" TEXT NOT NULL,
                        name TEXT NOT NULL,
                        department TEXT DEFAULT 'Geral',
                        description TEXT,
                        color TEXT DEFAULT '#3b82f6',
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_company_roles_companyId ON company_roles("companyId");

                    ALTER TABLE users ADD COLUMN IF NOT EXISTS "jobRoleId" TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS "jobRoleName" TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS "department" TEXT;

                    CREATE TABLE IF NOT EXISTS scheduled_messages (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        "contactJid" TEXT NOT NULL,
                        "userId" TEXT,
                        message TEXT NOT NULL,
                        "scheduledAt" TEXT NOT NULL,
                        "cancelIfCustomerReplies" BOOLEAN DEFAULT TRUE,
                        status TEXT DEFAULT 'pending',
                        "createdAt" TEXT NOT NULL,
                        "sentAt" TEXT,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_scheduled_messages_bot_contact ON scheduled_messages("botId", "contactJid");
                    CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
                `
            },
            {
                name: '028_csat_holidays_dossier',
                up: `
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "protocol" TEXT;
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "lastAttendantId" TEXT;
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "closedAt" TEXT;
                    ALTER TABLE IF EXISTS chats ADD COLUMN IF NOT EXISTS "csatAnsweredAt" TEXT;
                    CREATE INDEX IF NOT EXISTS idx_chats_protocol ON chats("protocol");

                    CREATE TABLE IF NOT EXISTS company_holidays (
                        id SERIAL PRIMARY KEY,
                        "companyId" TEXT NOT NULL DEFAULT 'company_default',
                        name TEXT NOT NULL,
                        date TEXT NOT NULL,
                        message TEXT,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_company_holidays_company_date ON company_holidays("companyId", date);

                    INSERT INTO company_holidays ("companyId", name, date, message, "createdAt", "updatedAt")
                    SELECT 'company_default', name, date, message, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
                    FROM (VALUES
                        ('Confraternização Universal (Ano Novo)', '2026-01-01', 'Hoje estamos em recesso de Ano Novo. Desejamos um próspero ano!'),
                        ('Tiradentes', '2026-04-21', 'Hoje é feriado de Tiradentes. Retornaremos no próximo dia útil!'),
                        ('Dia do Trabalho', '2026-05-01', 'Hoje é feriado do Dia do Trabalho. Retornaremos em breve!'),
                        ('Independência do Brasil', '2026-09-07', 'Hoje é feriado da Independência do Brasil.'),
                        ('Nossa Senhora Aparecida', '2026-10-12', 'Hoje é feriado nacional de N. Sra. Aparecida / Dia das Crianças.'),
                        ('Finados', '2026-11-02', 'Hoje é feriado de Finados.'),
                        ('Proclamação da República', '2026-11-15', 'Hoje é feriado da Proclamação da República.'),
                        ('Dia da Consciência Negra', '2026-11-20', 'Hoje é feriado nacional do Dia da Consciência Negra.'),
                        ('Natal', '2026-12-25', 'Desejamos um Feliz Natal! Nossa equipe está em recesso natalino.')
                    ) AS val(name, date, message)
                    WHERE NOT EXISTS (SELECT 1 FROM company_holidays WHERE "companyId" = 'company_default');
                `
            },
            {
                name: '029_quick_replies_shortcuts',
                up: `
                    CREATE TABLE IF NOT EXISTS quick_replies (
                        id SERIAL PRIMARY KEY,
                        "companyId" TEXT NOT NULL DEFAULT 'company_default',
                        shortcut TEXT NOT NULL,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        category TEXT DEFAULT 'Geral',
                        "mediaUrl" TEXT,
                        "mediaType" TEXT,
                        "createdBy" TEXT,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL
                    );
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_company_shortcut ON quick_replies("companyId", LOWER(shortcut));
                    CREATE INDEX IF NOT EXISTS idx_quick_replies_company_category ON quick_replies("companyId", category);

                    INSERT INTO quick_replies ("companyId", shortcut, title, message, category, "createdAt", "updatedAt")
                    SELECT 'company_default', shortcut, title, message, category, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
                    FROM (VALUES
                        ('ola', 'Saudação de Boas-Vindas', '{saudacao}, {primeiro_nome}! Como posso ajudar você hoje?', 'Geral'),
                        ('pix', 'Chave PIX & Instruções de Pagamento', 'Segue nossa chave PIX para pagamento:\n\n🔑 *Chave:* financeiro@empresa.com.br\n🏢 *Favorecido:* {empresa}\n\nApós o pagamento, envie o comprovante por aqui para localizarmos seu pedido! 📄', 'Financeiro'),
                        ('horario', 'Horário de Atendimento', 'Nosso horário de funcionamento é de segunda a sexta-feira, das 08:00 às 18:00. Aos sábados, das 08:00 às 12:00.', 'Atendimento'),
                        ('localizacao', 'Endereço & Localização', 'Estamos localizados na Av. Paulista, 1000 - Bela Vista, São Paulo - SP.\nSerá um prazer receber sua visita! ☕', 'Geral'),
                        ('protocolo', 'Informar Número do Protocolo', 'O número do seu protocolo de atendimento é: *{protocolo}*.\nGuarde este código para acompanhamento posterior. 📋', 'Atendimento'),
                        ('espera', 'Aguardando Verificação', 'Estou consultando seu cadastro no nosso sistema interno, {primeiro_nome}. Um minutinho por favor! ⏳', 'Suporte'),
                        ('encerramento', 'Agradecimento e Finalização', 'Agradecemos pelo seu contato, {primeiro_nome}! Foi um prazer atendê-lo(a). Se precisar de mais alguma coisa, estamos sempre à disposição. Tenha um ótimo dia! ✨', 'Atendimento')
                    ) AS val(shortcut, title, message, category)
                    WHERE NOT EXISTS (SELECT 1 FROM quick_replies WHERE "companyId" = 'company_default');

                    DO $$
                    BEGIN
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quick_messages') THEN
                            INSERT INTO quick_replies ("companyId", shortcut, title, message, category, "createdAt", "updatedAt")
                            SELECT 'company_default', 
                                   REGEXP_REPLACE(LOWER(shortcut), '^/+', ''), 
                                   CONCAT('Atalho /', REGEXP_REPLACE(LOWER(shortcut), '^/+', '')), 
                                   content, 
                                   'Geral', 
                                   CURRENT_TIMESTAMP::text, 
                                   CURRENT_TIMESTAMP::text
                            FROM quick_messages
                            ON CONFLICT DO NOTHING;
                        END IF;
                    END $$;
                `
            },
            {
                name: '030_messages_raw_message',
                up: `
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS "rawMessage" TEXT;
                `
            },
            {
                name: '031_screen_access_permissions',
                up: `
                    ALTER TABLE companies ADD COLUMN IF NOT EXISTS "allowedScreens" TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS "allowedScreens" TEXT;
                `
            },
            {
                name: '032_campaigns_anti_ban_randomization',
                up: `
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "randomTimeEnabled" BOOLEAN DEFAULT TRUE;
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "windowStartTime" TEXT DEFAULT '08:30';
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "windowEndTime" TEXT DEFAULT '18:00';
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "dispatchDays" TEXT DEFAULT '["1","2","3","4","5","6"]';
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchMin" INTEGER DEFAULT 5;
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchMax" INTEGER DEFAULT 12;
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchPauseMin" INTEGER DEFAULT 5;
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "batchPauseMax" INTEGER DEFAULT 15;
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "distributionMode" TEXT DEFAULT 'random_day';
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "waitReason" TEXT;
                    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS "nextDispatchAt" TEXT;
                `
            },
            {
                name: '033_multi_tenant_performance_indexes',
                up: `
                    CREATE INDEX IF NOT EXISTS idx_messages_bot_user_ts ON messages (botid, userid, timestamp ASC);
                    CREATE INDEX IF NOT EXISTS idx_chats_bot_status_updated ON chats ("botId", status, "updatedAt" DESC);
                    CREATE INDEX IF NOT EXISTS idx_chats_bot_contact ON chats ("botId", "contactJid");
                    CREATE INDEX IF NOT EXISTS idx_contacts_bot_jid ON contacts ("botId", jid);
                    CREATE INDEX IF NOT EXISTS idx_bots_company ON bots ("companyId");
                    CREATE INDEX IF NOT EXISTS idx_users_company ON users ("companyId");
                    CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns ("companyId");
                    CREATE INDEX IF NOT EXISTS idx_quick_replies_company ON quick_replies ("companyId");
                `
            },
            {
                name: '034_audit_logs_table',
                up: `
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id TEXT PRIMARY KEY,
                        "companyId" TEXT NOT NULL DEFAULT 'company_default',
                        "userId" TEXT,
                        "userName" TEXT,
                        action TEXT NOT NULL,
                        category TEXT DEFAULT 'general',
                        details TEXT,
                        "ipAddress" TEXT,
                        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs ("companyId", "createdAt" DESC);
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs ("userId");
                    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
                `
            },
            {
                name: '035_audit_logs_enriched_fields',
                up: `
                    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "userEmail" TEXT;
                    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "userRole" TEXT;
                    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "companyName" TEXT;
                    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
                `
            },
            {
                name: '036_user_stickers_table',
                up: `
                    CREATE TABLE IF NOT EXISTS user_stickers (
                        id TEXT PRIMARY KEY,
                        "userId" TEXT NOT NULL,
                        url TEXT NOT NULL,
                        name TEXT,
                        "fileHash" TEXT,
                        "createdAt" TEXT NOT NULL
                    );
                    ALTER TABLE user_stickers ADD COLUMN IF NOT EXISTS "fileHash" TEXT;
                    CREATE INDEX IF NOT EXISTS idx_user_stickers_userId ON user_stickers("userId");
                    CREATE INDEX IF NOT EXISTS idx_user_stickers_hash ON user_stickers("fileHash");
                `
            },
            {
                name: '037_attendances_table',
                up: `
                    CREATE TABLE IF NOT EXISTS attendances (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        "contactJid" TEXT NOT NULL,
                        "contactName" TEXT,
                        "protocol" TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'finished',
                        "attendantId" TEXT,
                        "attendantName" TEXT,
                        "department" TEXT,
                        "csatRating" INTEGER,
                        "csatComment" TEXT,
                        "csatAnsweredAt" TEXT,
                        "startedAt" TEXT NOT NULL,
                        "closedAt" TEXT,
                        "totalMessages" INTEGER DEFAULT 0,
                        "summary" TEXT,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_attendances_bot_contact ON attendances("botId", "contactJid");
                    CREATE INDEX IF NOT EXISTS idx_attendances_protocol ON attendances("protocol");
                `
            },
            {
                name: '038_appointments_table',
                up: `
                    CREATE TABLE IF NOT EXISTS appointments (
                        id TEXT PRIMARY KEY,
                        "botId" TEXT NOT NULL,
                        "companyId" TEXT DEFAULT 'company_default',
                        "contactJid" TEXT NOT NULL,
                        "contactName" TEXT,
                        "contactPhone" TEXT,
                        title TEXT NOT NULL,
                        service TEXT,
                        "attendantId" TEXT,
                        "attendantName" TEXT,
                        "scheduledAt" TEXT NOT NULL,
                        "durationMinutes" INTEGER DEFAULT 30,
                        status TEXT NOT NULL DEFAULT 'pending',
                        "reminder24hSent" BOOLEAN DEFAULT FALSE,
                        "reminder2hSent" BOOLEAN DEFAULT FALSE,
                        "confirmedAt" TEXT,
                        notes TEXT,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        FOREIGN KEY ("botId") REFERENCES bots(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON appointments("companyId", "scheduledAt");
                    CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments("botId", "contactJid");
                    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
                `
            },
            {
                name: '039_user_tags_company_id',
                up: `
                    ALTER TABLE user_tags ADD COLUMN IF NOT EXISTS "companyId" TEXT DEFAULT 'company_default';
                    CREATE INDEX IF NOT EXISTS idx_user_tags_companyId ON user_tags("companyId");
                    UPDATE user_tags ut 
                    SET "companyId" = u."companyId" 
                    FROM users u 
                    WHERE ut."userId" = u.id AND (ut."companyId" IS NULL OR ut."companyId" = 'company_default');
                `
            },
            {
                name: '040_user_attendance_availability',
                up: `
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT TRUE;
                    CREATE INDEX IF NOT EXISTS idx_users_isAvailable ON users("isAvailable");
                `
            },
            {
                name: '041_omnichannel_support',
                up: `
                    ALTER TABLE bots ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';
                    ALTER TABLE bots ADD COLUMN IF NOT EXISTS "telegramToken" TEXT;
                    ALTER TABLE bots ADD COLUMN IF NOT EXISTS "instagramPageId" TEXT;
                    ALTER TABLE bots ADD COLUMN IF NOT EXISTS "instagramAccessToken" TEXT;
                    ALTER TABLE chats ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';
                    CREATE INDEX IF NOT EXISTS idx_bots_channel ON bots(channel);
                    CREATE INDEX IF NOT EXISTS idx_chats_channel ON chats(channel);
                `
            },
            {
                name: '042_products_table',
                up: `
                    CREATE TABLE IF NOT EXISTS products (
                        id TEXT PRIMARY KEY,
                        "companyId" TEXT NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
                        "costPrice" NUMERIC(10,2) DEFAULT 0.00,
                        sku TEXT,
                        category TEXT DEFAULT 'Geral',
                        stock INTEGER DEFAULT 0,
                        "manageStock" BOOLEAN DEFAULT FALSE,
                        "imageUrl" TEXT,
                        images TEXT DEFAULT '[]',
                        "isActive" BOOLEAN DEFAULT TRUE,
                        "createdAt" TEXT NOT NULL,
                        "updatedAt" TEXT NOT NULL,
                        FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
                    );
                    CREATE INDEX IF NOT EXISTS idx_products_companyId ON products("companyId");
                    CREATE INDEX IF NOT EXISTS idx_products_category ON products("companyId", category);
                    CREATE INDEX IF NOT EXISTS idx_products_active ON products("companyId", "isActive");
                    CREATE INDEX IF NOT EXISTS idx_products_sku ON products("companyId", sku);

                    -- Produtos padrão para a empresa principal
                    INSERT INTO products (id, "companyId", name, description, price, "costPrice", sku, category, stock, "manageStock", "isActive", "createdAt", "updatedAt")
                    SELECT 'prod_demo_1', 'company_default', 'Plano Zeplyn Pro - Mensal', 'Assinatura mensal da plataforma Zeplyn com suporte e múltiplos atendentes.', 199.90, 0.00, 'ZEP-PRO-01', 'Planos & Serviços', 999, FALSE, TRUE, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
                    WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_demo_1');

                    INSERT INTO products (id, "companyId", name, description, price, "costPrice", sku, category, stock, "manageStock", "isActive", "createdAt", "updatedAt")
                    SELECT 'prod_demo_2', 'company_default', 'Setup & Treinamento de Chatbot IA', 'Configuração completa de fluxo, personas e base de conhecimento.', 450.00, 50.00, 'ZEP-SETUP-01', 'Serviços', 50, TRUE, TRUE, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
                    WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_demo_2');

                    INSERT INTO products (id, "companyId", name, description, price, "costPrice", sku, category, stock, "manageStock", "isActive", "createdAt", "updatedAt")
                    SELECT 'prod_demo_3', 'company_default', 'Pacote 10.000 Disparos WhatsApp', 'Disparos oficiais em massa com cadência anti-bloqueio Zeplyn.', 280.00, 80.00, 'ZEP-WPP-10K', 'Mensageria', 100, TRUE, TRUE, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text
                    WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'prod_demo_3');
                `
            },
            {
                name: '043_product_multiple_images',
                up: `
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]';
                `
            },
            {
                name: '044_products_extended_fields',
                up: `
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS "promotionalPrice" NUMERIC(10,2);
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStock" INTEGER DEFAULT 0;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'un';
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(10,3) DEFAULT 0.000;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS width NUMERIC(10,2) DEFAULT 0.00;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS height NUMERIC(10,2) DEFAULT 0.00;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS length NUMERIC(10,2) DEFAULT 0.00;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT;
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]';
                    ALTER TABLE products ADD COLUMN IF NOT EXISTS ean TEXT;
                    CREATE INDEX IF NOT EXISTS idx_products_brand ON products("companyId", brand);
                    CREATE INDEX IF NOT EXISTS idx_products_ean ON products("companyId", ean);
                `
            },
            {
                name: '045_advanced_chat_and_performance_indexes',
                up: `
                    CREATE INDEX IF NOT EXISTS idx_chats_attendant_status ON chats ("attendantId", status);
                    CREATE INDEX IF NOT EXISTS idx_chats_needs_human ON chats ("botId", "needsHuman") WHERE "needsHuman" = TRUE;
                    CREATE INDEX IF NOT EXISTS idx_attendances_attendant_status ON attendances ("attendantId", status);
                    CREATE INDEX IF NOT EXISTS idx_attendances_created ON attendances ("createdAt" DESC);
                    CREATE INDEX IF NOT EXISTS idx_messages_userid_ts ON messages (userid, timestamp DESC);
                `
            },
            {
                name: '046_instagram_account_id',
                up: `
                    ALTER TABLE bots ADD COLUMN IF NOT EXISTS "instagramAccountId" TEXT;
                    CREATE INDEX IF NOT EXISTS idx_bots_instagram_account_id ON bots("instagramAccountId");
                `
            }
        ];

        for (const migration of coreMigrations) {
            const alreadyRunRes = await this.db.query('SELECT id FROM migrations_history WHERE name = $1', [migration.name]);
            if (alreadyRunRes.rows.length === 0) {
                console.log(`🚚 Executando migração: ${migration.name}`);
                try {
                    await this.db.query(migration.up);
                    await this.db.query('INSERT INTO migrations_history (name) VALUES ($1)', [migration.name]);
                    console.log(`✅ Migração ${migration.name} finalizada`);
                } catch (error) {
                    if (error.message.includes('already exists') || error.message.includes('duplicate_column')) {
                        await this.db.query('INSERT INTO migrations_history (name) VALUES ($1)', [migration.name]);
                        console.log(`ℹ️ Migração ${migration.name} já aplicada, marcada como concluída`);
                    } else {
                        console.error(`❌ Erro na migração ${migration.name}:`, error);
                        throw error;
                    }
                }
            }
        }
        await this.cleanupDuplicateChats();
    }

    async cleanupDuplicateChats() {
        console.log('🧹 [Cleanup] Iniciando verificação de chats duplicados históricos no banco...');
        try {
            const mappingRes = await this.db.query('SELECT lid, jid FROM lid_mappings');
            const mappings = mappingRes.rows;

            if (mappings.length > 0) {
                console.log(`🧹 [Cleanup] Processando ${mappings.length} mapeamentos LID/JID para unificação de chats...`);
                for (const map of mappings) {
                    const lid = map.lid;
                    const jid = map.jid;

                    // Unificar proativamente as mensagens do LID para o JID do telefone
                    await this.db.query(
                        'UPDATE messages SET userid = $1 WHERE userid = $2',
                        [jid, lid]
                    );

                    const chatsRes = await this.db.query(
                        'SELECT * FROM chats WHERE "contactJid" = $1 OR "contactJid" = $2 ORDER BY "updatedAt" DESC',
                        [lid, jid]
                    );

                    if (chatsRes.rows.length > 1) {
                        console.log(`🧹 [Cleanup] Encontrados ${chatsRes.rows.length} chats para LID ${lid} / JID ${jid}. Mesclando...`);

                        let primaryChat = chatsRes.rows.find(c => c.contactJid === jid) || chatsRes.rows[0];
                        const botId = primaryChat.botId;
                        const canonicalId = `chat_${botId}_${jid.split('@')[0]}`;
                        const chatsToDelete = chatsRes.rows.filter(c => c.id !== primaryChat.id);

                        for (const dupChat of chatsToDelete) {
                            console.log(`   -> Mesclando histórico do chat ${dupChat.id} (JID: ${dupChat.contactJid}) para o principal ${primaryChat.id}`);

                            await this.db.query(
                                'UPDATE messages SET userid = $1 WHERE botid = $2 AND userid = $3',
                                [jid, botId, dupChat.contactJid]
                            );

                            if (primaryChat.status === 'finished' && dupChat.status === 'attending') {
                                primaryChat.status = 'attending';
                                primaryChat.attendantId = dupChat.attendantId;
                            } else if (primaryChat.status === 'waiting' && dupChat.status === 'attending') {
                                primaryChat.status = 'attending';
                                primaryChat.attendantId = dupChat.attendantId;
                            }

                            await this.db.query('DELETE FROM chats WHERE id = $1', [dupChat.id]);
                        }

                        await this.db.query(
                            'UPDATE chats SET "contactJid" = $1, id = $2, status = $3, "attendantId" = $4 WHERE id = $5',
                            [jid, canonicalId, primaryChat.status, primaryChat.attendantId, primaryChat.id]
                        );
                    } else if (chatsRes.rows.length === 1) {
                        const chat = chatsRes.rows[0];
                        const botId = chat.botId;
                        const canonicalId = `chat_${botId}_${jid.split('@')[0]}`;
                        if (chat.contactJid === lid || chat.id !== canonicalId) {
                            console.log(`   -> Corrigindo chat único ${chat.id} de LID ${lid} para JID canônico ${jid}`);
                            await this.db.query(
                                'UPDATE chats SET "contactJid" = $1, id = $2 WHERE id = $3',
                                [jid, canonicalId, chat.id]
                            );
                        }
                    }
                }
            }

            const genericDupRes = await this.db.query(`
                SELECT "botId", "contactJid" FROM chats 
                GROUP BY "botId", "contactJid" 
                HAVING COUNT(*) > 1
            `);

            for (const row of genericDupRes.rows) {
                const { botId, contactJid } = row;
                console.log(`🧹 [Cleanup] Resolvendo duplicação estrita de contactJid no banco: Bot: ${botId}, JID: ${contactJid}`);
                const chatsRes = await this.db.query(
                    'SELECT * FROM chats WHERE "botId" = $1 AND "contactJid" = $2 ORDER BY "updatedAt" DESC',
                    [botId, contactJid]
                );

                if (chatsRes.rows.length > 1) {
                    const primaryChat = chatsRes.rows[0];
                    const canonicalId = `chat_${botId}_${contactJid.split('@')[0]}`;
                    const chatsToDelete = chatsRes.rows.slice(1);

                    for (const dupChat of chatsToDelete) {
                        await this.db.query('DELETE FROM chats WHERE id = $1', [dupChat.id]);
                    }

                    if (primaryChat.id !== canonicalId) {
                        try {
                            await this.db.query('UPDATE chats SET id = $1 WHERE id = $2', [canonicalId, primaryChat.id]);
                        } catch (e) {
                            // Ignora caso o id canônico já esteja em uso
                        }
                    }
                }
            }

            // 3. Limpeza de duplicados por variação de número telefônico (ex: celular BR com e sem o 9º dígito)
            const allChatsRes = await this.db.query('SELECT * FROM chats ORDER BY "updatedAt" DESC');
            const phoneGroupMap = new Map();

            for (const chat of allChatsRes.rows) {
                if (chat.contactJid.endsWith('@g.us') || chat.contactJid.includes('@broadcast') || chat.contactJid.includes('@newsletter') || chat.contactJid.endsWith('@instagram') || chat.contactJid.endsWith('@telegram')) continue;
                const cleanPhone = (chat.contactJid || '').split('@')[0].replace(/\D/g, '');
                if (cleanPhone.length >= 8) {
                    const groupKey = `${chat.botId}_${cleanPhone.slice(-8)}`;
                    if (!phoneGroupMap.has(groupKey)) {
                        phoneGroupMap.set(groupKey, []);
                    }
                    phoneGroupMap.get(groupKey).push(chat);
                }
            }

            for (const [groupKey, groupChats] of phoneGroupMap.entries()) {
                if (groupChats.length > 1) {
                    console.log(`🧹 [Cleanup] Detectados ${groupChats.length} chats para a mesma linha telefônica (${groupKey}). Mesclando...`);
                    let primary = groupChats.find(c => c.status === 'attending') || groupChats[0];
                    const others = groupChats.filter(c => c.id !== primary.id);

                    for (const dup of others) {
                        await this.db.query(
                            'UPDATE messages SET userid = $1 WHERE botid = $2 AND userid = $3',
                            [primary.contactJid, primary.botId, dup.contactJid]
                        );
                        if (primary.status === 'finished' && dup.status === 'attending') {
                            primary.status = 'attending';
                            primary.attendantId = dup.attendantId;
                        } else if (primary.status === 'waiting' && dup.status === 'attending') {
                            primary.status = 'attending';
                            primary.attendantId = dup.attendantId;
                        }
                        await this.db.query('DELETE FROM chats WHERE id = $1', [dup.id]);
                    }
                    await this.db.query(
                        'UPDATE chats SET status = $1, "attendantId" = $2 WHERE id = $3',
                        [primary.status, primary.attendantId, primary.id]
                    );
                }
            }

            console.log('🧹 [Cleanup] Limpeza de chats duplicados concluída com sucesso!');
        } catch (error) {
            console.error('❌ Erro no cleanupDuplicateChats:', error);
        }
    }
}

module.exports = MigrationService;
