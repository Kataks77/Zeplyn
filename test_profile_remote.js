require('dotenv').config();
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    const cmd = `cd /var/www/itecchatbot.com.br && node -e "
require('dotenv').config();
const axios = require('axios');
const BotService = require('./src/services/BotService');
async function run() {
    const bot = await BotService.getBot('bot_1791688432197');
    const token = bot.instagramAccessToken;
    try {
        const res = await axios.get('https://graph.facebook.com/v20.0/1441363171453847', {
            params: {
                fields: 'name,username,profile_pic',
                access_token: token
            }
        });
        console.log('PROFILE RES:', JSON.stringify(res.data));
    } catch (err) {
        console.error('PROFILE ERR:', JSON.stringify(err.response ? err.response.data : err.message));
    }
    process.exit(0);
}
run();
"`;
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
    });
}).connect({
    host: process.env.VPS_HOST,
    port: parseInt(process.env.VPS_PORT, 10) || 22,
    username: process.env.VPS_USER || 'root',
    password: process.env.VPS_SSH_PASSWORD || process.env.SSH_PASSWORD
});
