const process = require('process');

class Logs {
    constructor(showLogs) {
        this.showLogs = showLogs;
        this.logs = '';
    }

    append(newLog, noBackline) {
        if (this.logs.length === 0 || noBackline === true) {
            if (this.showLogs === true) {
                process.stdout.write(`${newLog}`);
            }
            this.logs += newLog;
        } else {
            if (this.showLogs === true) {
                process.stdout.write(`\n${newLog}`);
            }
            this.logs += `\n${newLog}`;
        }
    }

    // Accepts either a string or an array of string.
    warn(newLog) {
        if (typeof newLog === 'object') {
            newLog = newLog.join('\n');
        }
        if (typeof newLog !== 'string' || newLog.length === 0) {
            return;
        }
        this.append('[WARNING] ' + newLog.split('\n').join('\n[WARNING] '));
    }
}

class Debug {
    constructor(debug_enabled, logger) {
        this.debug_enabled = debug_enabled;
        this.logger = logger;
    }

    append(newLog) {
        if (this.debug_enabled === true) {
            this.logger.append(`[DEBUG] ${newLog}`);
        }
    }
}

module.exports = {
    Debug: Debug,
    Logs: Logs,
};
