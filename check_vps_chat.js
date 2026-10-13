require('dotenv').config();
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    const cmd = `cd /var/www/itecchatbot.com.br && node -e "
require('dotenv').config();
const { getDatabase } = require('./src/services/DatabaseService');
async function run() {
    const pool = getDatabase();
    await pool.query('UPDATE chats SET \\\"contactName\\\" = \\'Firmino (@priv.kataks)\\', status = \\'finished\\' WHERE \\\"contactJid\\\" LIKE \\'%1441363171453847%\\'');
    await pool.query('INSERT INTO contacts (id, \\\"botId\\\", name, \\\"phoneNumber\\\", jid, \\\"profilePicUrl\\\", \\\"createdAt\\\", \\\"updatedAt\\\") SELECT \\'contact_bot_1791688432197_1441363171453847\\', \\\"botId\\\", \\'Firmino (@priv.kataks)\\', \\'1441363171453847\\', \\'1441363171453847@instagram\\', \\\"profilePicUrl\\\", NOW(), NOW() FROM chats WHERE \\\"contactJid\\\" LIKE \\'%1441363171453847%\\' ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, \\\"profilePicUrl\\\" = COALESCE(EXCLUDED.\\\"profilePicUrl\\\", contacts.\\\"profilePicUrl\\\\\")');
    const chats = await pool.query('SELECT id, \\\"contactJid\\\", \\\"contactName\\\", status, \\\"profilePicUrl\\\", \\\"closedAt\\\", \\\"updatedAt\\\" FROM chats WHERE \\\"contactJid\\\" LIKE \\'%1441363171453847%\\'');
    console.log('CHATS UPDATED:', JSON.stringify(chats.rows, null, 2));
    const contacts = await pool.query('SELECT * FROM contacts WHERE jid LIKE \\'%1441363171453847%\\'');
    console.log('CONTACTS UPDATED:', JSON.stringify(contacts.rows, null, 2));
    process.exit(0);
}
run();
"`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        let data = '';
        stream.on('data', d => { console.log('OUT:', d.toString()); data += d; });
        stream.stderr.on('data', d => console.error('ERR:', d.toString()));
        stream.on('close', (code) => {
            console.log('CLOSED:', code);
            conn.end();
        });
    });
}).connect({
    host: process.env.VPS_HOST,
    port: parseInt(process.env.VPS_PORT, 10) || 22,
    username: process.env.VPS_USER || 'root',
    password: process.env.VPS_SSH_PASSWORD || process.env.SSH_PASSWORD
});
