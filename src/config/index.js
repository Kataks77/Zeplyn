const path = require('path');

module.exports = {
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || '0.0.0.0',
    DIRS: {
        botConfigs: path.join(__dirname, '..', '..', 'bot-configs'),
        authInfo: path.join(__dirname, '..', '..', 'auth_info'),
        uploads: path.join(__dirname, '..', '..', 'uploads'),
        extractedTexts: path.join(__dirname, '..', '..', 'extracted_texts'),
        tempAudio: path.join(__dirname, '..', '..', 'temp_audio'),
        temp: path.join(__dirname, '..', '..', 'temp')
    },
    SUPPORTED_FORMATS: ['.pdf', '.txt', '.md', '.docx', '.csv', '.json', '.jsonl']
};
