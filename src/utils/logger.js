const P = require('pino');

const logger = P({ level: 'silent' });

// Erros que devem ser suprimidos (não críticos) do Signal Protocol
const suppressedErrors = [
    'Bad MAC',
    'Failed to decrypt message with any known session'
];

function shouldSuppressError(...args) {
    for (const arg of args) {
        let message = '';

        if (typeof arg === 'string') {
            message = arg;
        } else if (arg instanceof Error) {
            message = (arg.message || '') + ' ' + (arg.stack || '');
        } else if (arg && typeof arg === 'object') {
            try {
                message = JSON.stringify(arg);
            } catch (e) {
                message = String(arg);
            }
        } else {
            message = String(arg);
        }

        if (suppressedErrors.some(pattern => message.includes(pattern))) {
            return true;
        }
    }
    return false;
}

const originalConsoleError = console.error;
const originalConsoleLog = console.log;

function initSuppressor() {
    console.error = function (...args) {
        if (!shouldSuppressError(...args)) {
            originalConsoleError.apply(console, args);
        }
    };

    console.log = function (...args) {
        if (!shouldSuppressError(...args)) {
            originalConsoleLog.apply(console, args);
        }
    };
}

module.exports = {
    logger,
    initSuppressor,
    shouldSuppressError
};
