const path = require('path');
const fs = require('fs-extra');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

/**
 * Converte qualquer imagem (PNG, JPG, WEBP, GIF) para o formato padrão de Figurinha do WhatsApp:
 * - Formato: WebP
 * - Dimensões: 512x512 pixels (mantendo proporção e preenchendo bordas com transparência)
 * - Canal Alfa: RGBA com fundo transparente
 * - Otimizado para WhatsApp Web e Mobile
 */
function convertToWhatsAppWebp(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', inputPath,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
            '-c:v', 'libwebp',
            '-lossless', '0',
            '-q:v', '80',
            '-preset', 'picture',
            outputPath
        ];

        execFile(ffmpegPath, args, (error) => {
            if (error) {
                console.error('[ERRO CONVERSAO STICKER FFMPEG]', error);
                reject(error);
            } else {
                resolve(outputPath);
            }
        });
    });
}

module.exports = {
    convertToWhatsAppWebp
};