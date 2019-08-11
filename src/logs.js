const process = require('process');

class Logs {
    constructor(saveLogs) {
        this.saveLogs = saveLogs;
        this.logs = '';
    }

    append(newLog, noBackline) {
        if (this.logs.length === 0 || noBackline === true) {
            if (this.saveLogs !== true) {
                process.stdout.write(`${newLog}`);
            }
            this.logs += newLog;
        } else {
            if (this.saveLogs !== true) {
                process.stdout.write(`\n${newLog}`);
            }
            this.logs += `\n${newLog}`;
        }
    }
}

class Debug {
    constructor(debug_enabled) {
        this.logs = '';
        this.debug_enabled = debug_enabled;
    }

    append(newLog) {
        if (this.debug_enabled === true) {
            this.logs += `${newLog}\n`;
        }
    }

    show(logger) {
        if (this.logs.length > 0) {
            logger.append(`[DEBUG]\n${this.logs}`);
        }
    }
}

module.exports = {
    Debug: Debug,
    Logs: Logs,
};
