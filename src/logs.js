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
        lineDisplay += ': ';
    }
    let fileDisplay = '';
    if (message.file !== null && message.file !== undefined && message.file !== '' &&
        message.showFile !== false
    ) {
        const extra = lineDisplay.length === 0 ? ': ' : ' ';
        fileDisplay = `\`${message.file}\`${extra}`;
    }
    const levelDisplay = message.showLogLevel !== false ? `[${message.level.toUpperCase()}] ` : '';
    const newLine = message.disableNewLine === true ? '' : EOL;
    const url = typeof message.url === 'string' ? `${EOL}    at <${message.url}>` : '';
    return `${levelDisplay}${fileDisplay}${lineDisplay}${message.message}${url}${newLine}`;
}

function convertMessagesFromJson(messages) {
    return messages.map(msg => convertMessageFromJson(msg)).join('');
}

// Gets the real test file from the `fileInfo`: if there is a backtrace, then we get its last item
// as it will be the "real" test file.
function getTestFile(fileInfo) {
    let file = fileInfo.file;
    if (fileInfo.line !== null
        && fileInfo.line !== undefined
        && Array.isArray(fileInfo.line.backtrace)
    ) {
        file = fileInfo.line.backtrace[fileInfo.line.backtrace.length - 1].file;
    }
    return file;
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
        this.nbErrors = 0;

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
        ret.nbErrors = this.nbErrors;

        return ret;
    }

    _addLog(level, fileInfo, newLog, { fromLogs = false, url = undefined } = {}) {
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
        if (!fromLogs && level === 'error') {
            if (this.nbErrors === 0) {
                this.failure(fileInfo, '', true);
            }
            this.nbErrors += 1;
        }
        this.append({
            'file': fileInfo.file,
            'is_line_exact': fileInfo.is_line_exact,
            'line': fileInfo.line,
            'showLogLevel': fileInfo.showLogLevel,
            'level': level,
            'message': newLog,
            'showFile': fileInfo.showFile,
            url,
        });
    }

    append(newLog, showLog = true) {
        if (newLog.message.length === 0) {
            return;
        } else if (!this.showDebug && newLog.level === 'debug') {
            return;
        }

        this.logs.push(newLog);
        if (this.showLogs === true && showLog) {
            if (this.jsonOutput) {
                process.stdout.write(JSON.stringify(newLog) + EOL);
            } else if (newLog.ignoreCompact === true || !this.isCompactDisplay()) {
                process.stdout.write(convertMessageFromJson(newLog));
            }
        }
    }

    // Accepts either a string or an array of string.
    error(fileInfo, newLog, { fromLogs = false, url = undefined } = {}) {
        this._addLog('error', fileInfo, newLog, { fromLogs, url });
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
        this.nbErrors += other.nbErrors;
        for (const log of other.logs) {
            this.append(log, false);
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

    updateCompactDisplay(fileInfo, success) {
        if (!this.isCompactDisplay()) {
            return;
        }
        process.stdout.write(success ? '.' : 'F');

        const file = getTestFile(fileInfo);

        this.ranTests.push(file);
        if (this.ranTests.length % 50 === 0) {
            this.displayCompactFileInfo();
        } else if (this.ranTests.length === this.nbTests) {
            let s = '';
            for (let i = this.ranTests.length % 50; i < 50; ++i) {
                s += ' ';
            }
            process.stdout.write(s);
            this.displayCompactFileInfo();
        }
    }

    failure(fileInfo, message, fromLogs) {
        const msg = message.length > 0 ? `FAILED (${message})` : 'FAILED';
        // We clone to prevent updating the original `fileInfo`.
        const copy = JSON.parse(JSON.stringify(fileInfo));
        copy.showLogLevel = false;
        copy.line = null;
        // We need to update the file as we're not interested by the one where the error occurred
        // but by the test file which started all this.
        copy.file = getTestFile(fileInfo);
        if (this.isCompactDisplay()) {
            copy.showFile = false;
            this.updateCompactDisplay(copy, false);
            if (!fromLogs && message.length > 0) {
                this.error(fileInfo, message, { fromLogs: true });
            }
        } else {
            this.info(copy, msg);
        }
    }

    success(fileInfo, message) {
        if (!this.jsonOutput) {
            this.updateCompactDisplay(fileInfo, true);
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

    startTest(testName) {
        if (!this.isCompactDisplay()) {
            this.display(testName + '... ', this.isCompactDisplay());
        }
    }

    display(message, disableNewLine = false) {
        this.append({
            message: message,
            level: 'info',
            showLogLevel: false,
            ignoreCompact: true,
            disableNewLine,
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
            process.stdout.write(EOL);

            this.ranTests.sort();

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
