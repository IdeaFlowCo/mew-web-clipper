export class Logger {
    context;
    constructor(context) {
        this.context = context;
    }
    info(...args) {
        console.log(`[INFO] [${this.context}]`, ...args);
    }
    error(...args) {
        console.error(`[ERROR] [${this.context}]`, ...args);
    }
}
