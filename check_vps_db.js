require('dotenv').config();
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCode = `
    cd /var/www/itecchatbot.com.br
    node -e "
      require('dotenv').config();
      const db = require('./src/services/DatabaseService');
      (async () => {
        await db.initDatabase();
        const bots = await db.query('SELECT id, name, channel, \\"companyId\\", \\"instagramPageId\\", \\"instagramAccountId\\" FROM bots');
        console.log('Bots on VPS:', bots.rows);

        const users = await db.query('SELECT id, name, email, \\"companyId\\", role FROM users');
        console.log('Users on VPS:', users.rows);

        const chats = await db.query('SELECT id, \\"botId\\", \\"contactJid\\", \\"contactName\\", channel, \\"updatedAt\\" FROM chats ORDER BY \\"updatedAt\\" DESC LIMIT 10');
        console.log('Recent chats on VPS:', chats.rows);

        const msgs = await db.query('SELECT id, botid, userid, role, content, channel, timestamp FROM messages ORDER BY timestamp DESC LIMIT 10');
        console.log('Recent messages on VPS:', msgs.rows);

        process.exit(0);
      })().catch(e => { console.error(e); process.exit(1); });
    "
  `;

  conn.exec(remoteCode, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => {
      conn.end();
      process.exit(0);
    });
  });
}).connect({
  host: process.env.VPS_HOST,
  port: parseInt(process.env.VPS_PORT, 10) || 22,
  username: process.env.VPS_USER || 'root',
  password: process.env.VPS_SSH_PASSWORD
});
