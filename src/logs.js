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

module.exports = {
    Logs: Logs,
};
