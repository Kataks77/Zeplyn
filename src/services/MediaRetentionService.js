const fs = require('fs-extra');
const path = require('path');
const { DIRS } = require('../config');

class MediaRetentionService {
    constructor() {
        this.retentionDays = parseInt(process.env.MEDIA_RETENTION_DAYS || '30', 10);
        this.intervalHours = 24;
        this.timer = null;
    }

    start() {
        console.log(`🧹 [MediaRetention] Serviço de retenção de mídias ativado (Retenção: ${this.retentionDays} dias).`);
        
        // Executa uma limpeza inicial após 1 minuto de inicialização do servidor
        setTimeout(() => {
            this.cleanOldFiles().catch(err => {
                console.error('❌ [MediaRetention] Erro na limpeza inicial:', err);
            });
        }, 60000).unref();

        // Agenda limpeza a cada 24 horas
        this.timer = setInterval(() => {
            this.cleanOldFiles().catch(err => {
                console.error('❌ [MediaRetention] Erro na limpeza periódica:', err);
            });
        }, this.intervalHours * 60 * 60 * 1000);

        if (this.timer.unref) this.timer.unref();
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async cleanOldFiles() {
        const uploadDir = DIRS.uploads;
        if (!await fs.pathExists(uploadDir)) return;

        const files = await fs.readdir(uploadDir);
        const now = Date.now();
        const maxAgeMs = this.retentionDays * 24 * 60 * 60 * 1000;

        let deletedCount = 0;
        let deletedBytes = 0;

        for (const file of files) {
            // Ignorar arquivos ocultos ou de sistema
            if (file.startsWith('.')) continue;

            const filePath = path.join(uploadDir, file);
            try {
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    const fileAgeMs = now - stats.mtimeMs;
                    if (fileAgeMs > maxAgeMs) {
                        deletedBytes += stats.size;
                        await fs.remove(filePath);
                        deletedCount++;
                    }
                }
            } catch (err) {
                // Arquivo pode ter sido removido por outro processo
            }
        }

        if (deletedCount > 0) {
            const mbFreed = (deletedBytes / (1024 * 1024)).toFixed(2);
            console.log(`🧹 [MediaRetention] Limpeza de uploads concluída: ${deletedCount} arquivos expirados removidos (${mbFreed} MB liberados).`);
        }

        // Limpeza de arquivos residuais temporários (conversões de áudio e transcrições com > 2 horas)
        await this.cleanTempDirectories([DIRS.temp, DIRS.tempAudio]);
    }

    async cleanTempDirectories(directories) {
        const now = Date.now();
        const maxTempAgeMs = 2 * 60 * 60 * 1000; // 2 horas
        let cleanedTemp = 0;

        for (const dir of directories) {
            if (!dir || !(await fs.pathExists(dir))) continue;
            try {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    if (file.startsWith('.')) continue;
                    const filePath = path.join(dir, file);
                    const stats = await fs.stat(filePath);
                    if (stats.isFile() && (now - stats.mtimeMs) > maxTempAgeMs) {
                        await fs.remove(filePath);
                        cleanedTemp++;
                    }
                }
            } catch (_) {}
        }

        if (cleanedTemp > 0) {
            console.log(`🧹 [MediaRetention] Limpeza de temporários: ${cleanedTemp} arquivos residuais removidos.`);
        }
    }
}

module.exports = new MediaRetentionService();
