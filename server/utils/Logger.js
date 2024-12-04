// server/utils/Logger.js
class Logger {
    constructor(context) {
        this.context = context;
    }

    info(message, data = null) {
        console.log(`[${new Date().toISOString()}] [INFO] [${this.context}]`, message, data || '');
    }

    warn(message, data = null) {
        console.warn(`[${new Date().toISOString()}] [WARN] [${this.context}]`, message, data || '');
    }

    error(message, error = null) {
        console.error(`[${new Date().toISOString()}] [ERROR] [${this.context}]`, message, error || '');
    }
}

export default Logger;