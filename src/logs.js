const process = require('process');
const { EOL } = require('os');

function convertMessageFromJson(message) {
    const lineInfo = message.is_line_exact ? 'line' : 'around line';
    let lineDisplay = '';
    if (message.line !== null && message.line !== undefined) {
        lineDisplay += `${lineInfo} ${message.line.line}`;
        if (Array.isArray(message.line.backtrace)) {
            for (const msg of message.line.backtrace) {
                lineDisplay += `${EOL}    from \`${msg.file}\` line ${msg.line}`;
            }
        }
    }
    const fileDisplay =
        message.file !== null && message.file !== undefined && message.showFile !== false
            ? `\`${message.file}\` ${lineDisplay}: `
            : '';
    const levelDisplay = message.showLogLevel !== false ? `[${message.level.toUpperCase()}] ` : '';
    return `${levelDisplay}${fileDisplay}${message.message}${EOL}`;
}

function convertMessagesFromJson(messages) {
    return messages.map(msg => convertMessageFromJson(msg)).join('');
}

class Logs {
    constructor(showLogs, options) {
        this.logs = [];
        this.showLogs = showLogs;
        this.jsonOutput = false;
        this.showDebug = false;
        this.displayCompact = false;
        this.nbTests = null;
        this.ranTests = [];

        if (options !== undefined) {
            this.jsonOutput = options.isJsonOutput();
            this.showDebug = options.debug;
            if (!this.jsonOutput) {
                this.displayCompact = options.isCompactDisplay();
            }
        }
    }

    shallowClone() {
        const ret = new Logs(this.showLogs);

        ret.jsonOutput = this.jsonOutput;
        ret.showDebug = this.showDebug;
        ret.displayCompact = this.displayCompact;
        ret.nbTests = this.nbTests;
        ret.ranTests = this.ranTests;

        return ret;
    }

    _addLog(level, fileInfo, newLog) {
        if (Array.isArray(newLog)) {
            newLog = newLog.join(EOL);
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
                process.stdout.write(JSON.stringify(newLog) + EOL);
            } else if (newLog.ignoreCompact === true || !this.isCompactDisplay()) {
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
        for (const log of other.logs) {
            this.append(log);
        }
    }

    clear() {
        this.logs = [];
        this.nbTests = null;
    }

    isCompactDisplay() {
        return this.displayCompact && this.nbTests !== null;
    }

    displayCompactFileInfo() {
        process.stdout.write(` (${this.ranTests.length}/${this.nbTests})${EOL}`);
    }

    updateCompactDisplay(file, success) {
        if (this.isCompactDisplay()) {
            process.stdout.write(success ? '.' : 'F');
            this.ranTests.push(file);
            if (this.ranTests.length % 50 === 0) {
                this.displayCompactFileInfo();
            }
        }
    }

    failure(fileInfo, message) {
        const msg = message.length > 0 ? `FAILED (${message})` : 'FAILED';
        if (!this.jsonOutput) {
            this.updateCompactDisplay(fileInfo.file, false);
            fileInfo.showFile = false;
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
            this.updateCompactDisplay(fileInfo.file, true);
            fileInfo.showFile = false;
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
            'ignoreCompact': true,
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

    // This method returns either the `vec` of string if this is in JSON output format, otherwise
    // returns a string.
    getLogsInExpectedFormat() {
        return this.jsonOutput ? this.logs : convertMessagesFromJson(this.logs);
    }

    setNbTests(nbTests) {
        this.nbTests = nbTests;
        if (this.isCompactDisplay()) {
            process.stdout.write(EOL);
        }
    }

    conclude(message) {
        if (this.isCompactDisplay()) {
            let s = '';
            for (let i = this.ranTests.length % 50; i < 50; ++i) {
                s += ' ';
            }
            process.stdout.write(s);
            this.displayCompactFileInfo();
            process.stdout.write(EOL);

            // Now we display logs that might need to be displayed, like warnings and errors.
            for (const test of this.ranTests) {
                const messages = this.logs.filter(log => log.file === test && log.level !== 'info');
                if (messages.length !== 0) {
                    process.stdout.write(`======== ${test} ========${EOL}${EOL}`);
                    process.stdout.write(convertMessagesFromJson(messages));
                    process.stdout.write(EOL);
                }
            }
        }
        this.display(message);
    }
}

module.exports = {
    Logs: Logs,
    convertMessageFromJson: convertMessageFromJson,
    convertMessagesFromJson: convertMessagesFromJson,
};
