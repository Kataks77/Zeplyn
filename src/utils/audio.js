const path = require('path');
const fs = require('fs-extra');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

/**
 * Converte um arquivo de áudio para o formato nativo do WhatsApp Voice Note (PTT):
 * - Container: OGG
 * - Codec: Opus (libopus)
 * - Sample Rate: 48000 Hz
 * - Canais: 1 (mono)
 * - Bitrate: 64 kbps (padrão ótimo para voz WhatsApp PTT)
 * - Aplicação: voip (otimizado para voz/comunicação em tempo real)
 */
function convertToWhatsAppOgg(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', inputPath,
            '-vn',
            '-avoid_negative_ts', 'make_zero',
            '-ac', '1',
            '-ar', '48000',
            '-c:a', 'libopus',
            '-b:a', '64k',
            '-application', 'voip',
            '-vbr', 'on',
            '-f', 'ogg',
            outputPath
        ];

        execFile(ffmpegPath, args, (error, stdout, stderr) => {
            if (error) {
                console.error('[ERRO CONVERSÃO AUDIO FFMPEG]', stderr || error);
                reject(error);
                return;
            }

            if (!fs.existsSync(outputPath)) {
                reject(new Error('FFmpeg não gerou o arquivo de saída.'));
                return;
            }

            resolve(outputPath);
        });
    });
}

module.exports = {
    convertToWhatsAppOgg
};
