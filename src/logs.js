const process = require('process');

function convertMessageFromJson(message) {
    const lineInfo = message.is_line_exact ? 'line' : 'around line';
    let lineDisplay = '';
    if (message.line !== null && message.line !== undefined) {
        lineDisplay += `${lineInfo} ${message.line.line}`;
        if (Array.isArray(message.line.backtrace)) {
            for (const msg of message.line.backtrace) {
                lineDisplay += `\n    from \`${msg.file}\` line ${msg.line}`;
            }
        }
    }
    const fileDisplay = message.file !== null && message.file !== undefined
        ? `${message.file}${lineDisplay}: `
        : '';
    const levelDisplay = message.showLogLevel !== false ? `[${message.level.toUpperCase()}] ` : '';
    return `${levelDisplay}${fileDisplay}${message.message}\n`;
}

function convertMessagesFromJson(messages) {
    return messages.map(msg => convertMessageFromJson(msg)).join('');
}

class Logs {
    constructor(showLogs, options) {
        this.showLogs = showLogs;
        if (options === undefined) {
            this.jsonOutput = false;
            this.showDebug = false;
        } else {
            this.jsonOutput = options.isJsonOutput();
            this.showDebug = options.debug;
        }
        this.logs = [];
    }

    _addLog(level, fileInfo, newLog) {
        if (Array.isArray(newLog)) {
            newLog = newLog.join('\n');
        }
        if (typeof newLog !== 'string' || newLog.length === 0) {
            return;
        }
        if (fileInfo === undefined) {
            throw new Error('Missing `fileInfo` argument in `Logs._addLog`');
        } else if (fileInfo === null) {
            fileInfo = {};
        }
        this.append({
            'file': fileInfo.file,
            'is_line_exact': fileInfo.is_line_exact,
            'line': fileInfo.line,
            'showLogLevel': fileInfo.showLogLevel,
            'level': level,
            'message': newLog,
        });
    }

    append(newLog) {
        if (newLog.message.length === 0) {
            return;
        } else if (!this.showDebug && newLog.level === 'debug') {
            return;
        }

        this.logs.push(newLog);
        if (this.showLogs === true) {
            if (this.jsonOutput) {
                process.stdout.write(JSON.stringify(newLog) + '\n');
            } else {
                process.stdout.write(convertMessageFromJson(newLog));
            }
        }
    }

    // Accepts either a string or an array of string.
    error(fileInfo, newLog) {
        this._addLog('error', fileInfo, newLog);
    }

    // Accepts either a string or an array of string.
    info(fileInfo, newLog) {
        this._addLog('info', fileInfo, newLog);
    }

    // Accepts either a string or an array of string.
    warn(fileInfo, newLog) {
        this._addLog('warning', fileInfo, newLog);
    }

    // Accepts either a string or an array of string.
    debug(fileInfo, newLog) {
        this._addLog('debug', fileInfo, newLog);
    }

    appendLogs(other) {
        for (const log of other) {
            this.append(log);
        }
    }

    failure(fileInfo, message) {
        const msg = message.length > 0 ? `FAILED (${message})` : 'FAILED';
        if (!this.jsonOutput) {
            fileInfo.file = null;
        }
        fileInfo.showLogLevel = false;
        this.error(fileInfo, msg);
        // Little hack to have a nicer rendering...
        if (!this.jsonOutput) {
            const failure = this.logs.pop();
            for (const log of this.logs) {
                if (log.level === 'info') {
                    log.message += failure.message;
                    break;
                }
            }
        }
    }

    success(fileInfo, message) {
        if (!this.jsonOutput) {
            fileInfo.file = null;
        }
        fileInfo.showLogLevel = false;
        this.info(fileInfo, message);
        // Little hack to have a nicer rendering...
        if (!this.jsonOutput) {
            const success = this.logs.pop();
            for (const log of this.logs) {
                if (log.level === 'info') {
                    log.message += success.message;
                    break;
                }
            }
        }
    }

    display(message) {
        this.append({
            'message': message,
            'level': 'info',
            'showLogLevel': false,
        });
    }

    setDebugEnabled(v) {
        // This is to ensure that `showDebug` is always a boolean.
        this.showDebug = v === true;
    }

    isDebugEnabled() {
        return this.showDebug;
    }

    isEmpty() {
        return this.logs.length === 0;
    }

    lastError() {
        for (let i = this.logs.length; i > 0; --i) {
            const msg = this.logs[i - 1];
            if (msg.level === 'error') {
                return msg;
            }
        }
        return null;
    }
}

module.exports = {
    Logs: Logs,
    convertMessageFromJson: convertMessageFromJson,
    convertMessagesFromJson: convertMessagesFromJson,
};
