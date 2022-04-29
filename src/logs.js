const process = require('process');

function addLog(logs, newLog, kind) {
    if (typeof newLog === 'object') {
        newLog = newLog.join('\n');
    }
    if (typeof newLog !== 'string' || newLog.length === 0) {
        return;
    }
    logs.append(kind + newLog.split('\n').join('\n' + kind) + '\n');
}

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
    info(newLog) {
        addLog(this, newLog, '[INFO] ');
    }

    // Accepts either a string or an array of string.
    warn(newLog) {
        addLog(this, newLog, '[WARNING] ');
    }
}

class Debug {
    constructor(debug_enabled, logger) {
        // This is to ensure that `debug_enabled` is always a boolean.
        this.debug_enabled = debug_enabled === true;
        this.logger = logger;
    }

    setDebugEnabled(v) {
        // This is to ensure that `debug_enabled` is always a boolean.
        this.debug_enabled = v === true;
    }

    isEnabled() {
        return this.debug_enabled;
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
