require('dotenv').config();
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const archiveName = 'itecchatbot-update.tar.gz';
console.log('📦 1. Criando pacote compactado com as atualizações do sistema...');

try {
  if (fs.existsSync(archiveName)) fs.unlinkSync(archiveName);
  
  // Usando tar nativo do Windows (disponível em Windows 10 e 11)
  // Empacota src, client, package.json, package-lock.json, docker-compose.yml, etc.
  execSync(`tar -czf ${archiveName} --exclude=node_modules --exclude=client/node_modules --exclude=auth_info --exclude=temp --exclude=temp_audio --exclude=.git --exclude=.env --exclude=${archiveName} src client package.json package-lock.json docker-compose.yml Dockerfile nodemon.json README.md`);
  
  const stats = fs.statSync(archiveName);
  console.log(`✅ Pacote ${archiveName} criado com sucesso: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} catch (err) {
  console.error('❌ Erro ao empacotar arquivos:', err.message);
  process.exit(1);
}

const vpsHost = process.env.VPS_HOST;
const vpsPort = parseInt(process.env.VPS_PORT, 10) || 22;
const vpsUser = process.env.VPS_USER || 'root';

if (!vpsHost) {
  console.error('❌ [Config] VPS_HOST não configurado no arquivo .env!');
  process.exit(1);
}

const conn = new Client();
console.log(`🔌 2. Conectando via SSH ao servidor ${vpsHost} na porta ${vpsPort}...`);

conn.on('ready', () => {
  console.log(`✅ Conexão SSH autenticada com sucesso como ${vpsUser}!`);
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ Erro ao iniciar SFTP:', err.message);
      conn.end();
      process.exit(1);
    }
    
    const remoteDest = `/var/www/itecchatbot.com.br/${archiveName}`;
    console.log(`🚀 3. Enviando ${archiveName} para o servidor em ${remoteDest}...`);
    
    const readStream = fs.createReadStream(archiveName);
    const writeStream = sftp.createWriteStream(remoteDest);
    
    let uploadedBytes = 0;
    const totalBytes = fs.statSync(archiveName).size;
    
    readStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      const pct = ((uploadedBytes / totalBytes) * 100).toFixed(1);
      process.stdout.write(`\r   Progresso do upload: ${pct}% (${(uploadedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    writeStream.on('close', () => {
      console.log('\n✅ Upload concluído com sucesso!');
      console.log('⚙️ 4. Aplicando atualizações e reiniciando aplicação no servidor...');
      
      const remoteCmd = `
        set -e
        mkdir -p /var/www/itecchatbot.com.br
        cd /var/www/itecchatbot.com.br
        echo "-> Extraindo pacote de atualização..."
        tar -xzf ${archiveName}
        rm -f ${archiveName}
        echo "-> Verificando dependências de produção..."
        npm install --production --silent || npm install --production
        
        echo "-> Verificando processo do servidor (PM2 / Docker / Systemd)..."
        if command -v pm2 >/dev/null 2>&1; then
          echo "-> Reiniciando com PM2..."
          pm2 restart all || pm2 reload all || pm2 start src/server.js --name itecchatbot
          pm2 save || true
          pm2 status
        elif command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
          echo "-> Reiniciando com Docker Compose..."
          docker compose restart || docker-compose restart || docker compose up -d
        elif systemctl list-units --type=service | grep -i itec >/dev/null 2>&1; then
          echo "-> Reiniciando via Systemd..."
          systemctl restart itec* || true
        else
          echo "-> PM2 não detectado na raiz. Verificando processos node ativos:"
          ps aux | grep node | grep -v grep || true
        fi
        echo "-> Atualizando dados do Instagram no banco..."
        node -e "
          require('dotenv').config();
          const { getDatabase } = require('./src/services/DatabaseService');
          const db = getDatabase();
          if (db) {
            db.query(\`
              UPDATE chats 
              SET \\\"contactName\\\" = 'Firmino (@priv.kataks)', status = 'finished'
              WHERE \\\"contactJid\\\" LIKE '%1441363171453847%';

              INSERT INTO contacts (id, \\\"botId\\\", name, \\\"phoneNumber\\\", jid, \\\"profilePicUrl\\\", \\\"createdAt\\\", \\\"updatedAt\\\")
              SELECT 'contact_bot_1791688432197_1441363171453847', \\\"botId\\\", 'Firmino (@priv.kataks)', '1441363171453847', '1441363171453847@instagram', \\\"profilePicUrl\\\", NOW(), NOW()
              FROM chats
              WHERE \\\"contactJid\\\" LIKE '%1441363171453847%'
              ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, \\\"profilePicUrl\\\" = COALESCE(EXCLUDED.\\\"profilePicUrl\\\", contacts.\\\"profilePicUrl\\\");
            \`).then(() => {
              console.log('✅ Dados do contato e chat do Instagram corrigidos no banco!');
              process.exit(0);
            }).catch(e => {
              console.warn('Aviso banco:', e.message);
              process.exit(0);
            });
          } else { process.exit(0); }
        " || true
        
        echo "========================================="
        echo "🎉 DEPLOY CONCLUÍDO COM SUCESSO NO VPS!"
        echo "========================================="
      `;
      
      conn.exec(remoteCmd, (err, stream) => {
        if (err) {
          console.error('❌ Erro ao executar script remoto:', err.message);
          conn.end();
          process.exit(1);
        }
        
        stream.on('close', (code) => {
          console.log(`\n🏁 Script remoto finalizou com código de saída: ${code}`);
          if (fs.existsSync(archiveName)) fs.unlinkSync(archiveName);
          conn.end();
          process.exit(code === 0 ? 0 : 1);
        });
        
        stream.on('data', (data) => {
          process.stdout.write(data.toString());
        });
        
        stream.stderr.on('data', (data) => {
          process.stderr.write(data.toString());
        });
      });
    });
    
    writeStream.on('error', (err) => {
      console.error('\n❌ Erro na gravação SFTP:', err.message);
      conn.end();
      process.exit(1);
    });
    
    readStream.pipe(writeStream);
  });
}).on('error', (err) => {
  console.error('❌ Falha na autenticação ou conexão SSH:', err.message);
  process.exit(1);
}).connect({
  host: vpsHost,
  port: vpsPort,
  username: vpsUser,
  password: process.env.VPS_SSH_PASSWORD || process.env.SSH_PASSWORD,
  privateKey: process.env.VPS_SSH_KEY ? fs.readFileSync(process.env.VPS_SSH_KEY) : undefined,
  readyTimeout: 30000,
  keepaliveInterval: 10000
});
