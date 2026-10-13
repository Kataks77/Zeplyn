const express = require('express');
const router = express.Router();
const path = require('path');
const FileController = require('../controllers/FileController');
const multer = require('multer');
const { DIRS } = require('../config');
const { authenticateRequest } = require('../middlewares/authMiddleware');

// Lista negra de extensões perigosas / executáveis e arquivos de script
const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml', '.pl', 
    '.cgi', '.jar', '.vbs', '.vbe', '.ps1', '.ps2', '.reg', '.dll', '.msi',
    '.html', '.htm', '.xhtml', '.svg', '.js', '.mjs', '.py', '.scr'
];

// Configuração segura do Multer
const upload = multer({ 
    dest: DIRS.uploads,
    limits: {
        fileSize: 25 * 1024 * 1024, // Limite de 25 MB (padrão WhatsApp)
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const originalName = (file.originalname || '').toLowerCase();
        
        // Bloqueia tentativas de arquivos ocultos / dotfiles
        if (originalName.startsWith('.')) {
            return cb(new Error('Arquivos ocultos não são permitidos.'));
        }

        // Bloqueia extensões duplas perigosas (ex: shell.php.jpg, mal.exe.pdf)
        const hasDangerousInName = BLOCKED_EXTENSIONS.some(ext => originalName.includes(ext));
        if (hasDangerousInName) {
            return cb(new Error('Tipo de arquivo não permitido por motivos de segurança.'));
        }

        const ext = path.extname(originalName);
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            return cb(new Error('Tipo de arquivo não permitido por motivos de segurança.'));
        }
        cb(null, true);
    }
});

// Todas as rotas de arquivos exigem autenticação
router.use(authenticateRequest);

router.post('/upload', upload.single('file'), FileController.upload);
router.get('/stickers', FileController.listStickers);
router.post('/stickers/upload', upload.single('file'), FileController.uploadSticker);
router.post('/stickers/save', FileController.saveUserSticker);
router.delete('/stickers/:id', FileController.deleteSticker);
router.post('/stickers/sync', FileController.syncStickers);

module.exports = router;
