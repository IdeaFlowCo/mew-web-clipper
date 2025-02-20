export class Logger {
    private context: string;
    constructor(context: string) {
        this.context = context;
    }
    info(...args: unknown[]): void {
        console.log(`[INFO] [${this.context}]`, ...args);
    }
    error(...args: unknown[]): void {
        console.error(`[ERROR] [${this.context}]`, ...args);
    }
}
