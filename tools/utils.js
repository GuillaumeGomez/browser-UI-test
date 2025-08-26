const path = require('path');
const fs = require('fs');
const process = require('process');
const { plural } = require('../src/utils.js');
const { convertMessageFromJson } = require('../src/logs.js');

function toJSON(value) {
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return value;
}

function getStackInfo(stack, level = 2) {
    const parents = stack.split(' at ');
    const parent = parents[level >= parents.length ? parents.length - 1 : level].trim();
    const parts = parent.split(':');
    const line = parts[parts.length - 2];
    const file_name = path.basename(parts[0].split('(')[1]);
    return {'file': file_name, 'line': line};
}

function print(x, out, backline = true) {
    if (typeof out !== 'undefined') {
        out(x);
    } else {
        if (backline) {
            process.stdout.write(`${x}\n`);
        } else {
            process.stdout.write(x);
        }
    }
}

function printDiff(i, value, out) {
    let s = '=> ';
    for (let count = 0; count < 34 && i < value.length; ++count) {
        s += value[i];
        i += 1;
    }
    print(s, out);
}

function extractExpectedErrors(filePath) {
    const content = fs.readFileSync(filePath, 'utf8').split('\n');
    const expected = [];
    let i = 0;
    while (i < content.length) {
        let line = content[i].trim();
        i += 1;
        if (!line.startsWith('//~')) {
            continue;
        }
        let ups = 0;
        let x = 3;
        while (x < line.length && line[x] === '^') {
            ups += 1;
            x += 1;
        }
        if (i - ups < 0) {
            throw new Error(`Invalid number of \`~\` at line ${i + 1} in file \`${filePath}\``);
        }
        while (x < line.length && line[x] === ' ') {
            x += 1;
        }
        line = line.slice(x);
        const sub = line.split(' ')[0];
        let level = '';
        if (sub === 'ERROR:') {
            level = 'error';
        } else if (sub === 'WARNING:') {
            level = 'warning';
        } else if (sub === 'INFO:') {
            level = 'info';
        } else if (sub === 'DEBUG:') {
            level = 'debug';
        } else {
            throw new Error(`Unknown level \`${sub}\` at line ${i} in file \`${filePath}\``);
        }
        const message = line.slice(sub.length + 1).trim();
        if (message.length === 0) {
            throw new Error(`Missing message after level at line ${i} in file \`${filePath}\``);
        }
        expected.push({
            level: level,
            message: message,
            line: i - ups,
            originalLine: i,
        });
    }
    return expected;
}

function isMatchingError(error, msg) {
    if (error.found === true || error.level !== msg.level || !msg.message.includes(error.message)) {
        return false;
    }
    if (error.line === msg.line.line) {
        return true;
    }
    const backtrace = msg.line.backtrace;
    return Array.isArray(backtrace) && backtrace[backtrace.length - 1].line === error.line;
}

class Assert {
    constructor() {
        this.testSuite = [];
        // If `--bless` option is used.
        this.blessEnabled = false;
        // If `--no-sandbox` option is used.
        this.noSandboxEnabled = false;
        // Arguments that can be of use in tests.
        this.extraArgs = [];
    }

    assertOrBless(value1, value2, errCallback, pos, extraInfo, toJson = true, out = undefined) {
        let callback = undefined;
        if (this.blessEnabled) {
            callback = errCallback;
        }
        return this.assert(value1, value2, pos, extraInfo, toJson, out, callback);
    }

    // Checks that it failed as expected.
    assertError(value, errorMessage) {
        this._addTest();
        if (value.error !== undefined && value.error === errorMessage) {
            return true;
        }
        const pos = getStackInfo(new Error().stack);
        print(`[${pos.file}:${pos.line}] failed:`);
        if (value.error === undefined) {
            print(
                `Expected an error (\`${errorMessage}\`)\n===============\n   FOUND: \
\`${JSON.stringify(value)}\``,
            );
        } else {
            print(`EXPECTED: \`${errorMessage}\`\n===============\n   FOUND: \`${value.error}\``);
        }
        this._incrError();
        return false;
    }

    // `extraInfo` is used as an additional message in case the test fails.
    assert(
        value1, value2, pos, extraInfo, toJson = true, out = undefined, errCallback = undefined,
    ) {
        this._addTest();
        const ori1 = value1;
        const ori2 = value2;
        if (typeof value2 !== 'undefined') {
            if (toJson === true) {
                value1 = toJSON(value1);
                value2 = toJSON(value2);
            }
            if (value1 !== value2) {
                if (typeof pos === 'undefined') {
                    pos = getStackInfo(new Error().stack);
                }
                if (typeof errCallback !== 'undefined') {
                    errCallback(ori1, ori2);
                } else {
                    if (typeof extraInfo === 'undefined') {
                        print(`[${pos.file}:${pos.line}] failed:`, out);
                    } else {
                        print(`[${pos.file}:${pos.line}] failed (in ${extraInfo}):`, out);
                    }
                    print(`EXPECTED: \`${value2}\`\n===============\n   FOUND: \`${value1}\``, out);
                    for (let i = 0; i < value1.length && i < value2.length; ++i) {
                        if (value1[i] !== value2[i]) {
                            i -= 8;
                            if (i < 0) {
                                i = 0;
                            }
                            print('|||||> Error happened around there:', out);
                            printDiff(i, value2, out);
                            printDiff(i, value1, out);
                            break;
                        }
                    }
                    this._incrError();
                }
                return false;
            }
        } else if (!value1) {
            if (typeof pos === 'undefined') {
                pos = getStackInfo(new Error().stack);
            }
            print(`[${pos.file}:${pos.line}] failed: \`${value1}\` is evaluated to false`, out);
            this._incrError();
            return false;
        }
        return true;
    }

    addError(message) {
        this._addTest();
        print(`An error occurred: ${message}`);
        this._incrError();
    }

    addSuccess() {
        this._addTest();
    }

    _addTest() {
        if (this.testSuite.length > 0) {
            this.testSuite[this.testSuite.length - 1].ranTests += 1;
            this._incrField('totalRanTests', this.testSuite.length - 1);
        }
    }

    _incrField(fieldName, pos) {
        for (
            pos = pos >= this.testSuite.length ? this.testSuite.length - 1 : pos;
            pos >= 0;
            --pos
        ) {
            if (this.testSuite[pos][fieldName] !== undefined) {
                this.testSuite[pos][fieldName] += 1;
            }
        }
    }

    _incrError() {
        if (this.testSuite.length > 0) {
            this.testSuite[this.testSuite.length - 1].errors += 1;
            this._incrField('totalErrors', this.testSuite.length - 1);
        }
    }

    // `extraInfo` is used as an additional message in case the test fails.
    async assertTry(callback, args, expectedValue, extraInfo, toJson = true) {
        const pos = getStackInfo(new Error().stack, 2);
        try {
            const ret = await callback(...args);
            return this.assert(ret, expectedValue, pos, extraInfo, toJson);
        } catch (err) {
            return this.assert(err.message, expectedValue, pos, extraInfo, toJson);
        }
    }

    // Same as `assertTry` but handle some corner cases linked to UI tests.
    async assertTryUi(
        callback, args, expectedValue, file, toJson = true, out = undefined,
        errCallback = undefined,
    ) {
        if (!this.blessEnabled) {
            errCallback = undefined;
        }
        const pos = getStackInfo(new Error().stack, 2);
        try {
            const messages = await callback(...args);
            const expectedErrors = extractExpectedErrors(file);
            // Now we get each JSON error message.
            let output = '';
            const unexpectedErrors = [];
            const notFoundErrors = [];
            for (const msg of messages) {
                output += convertMessageFromJson(msg);
                if (msg.line === undefined || msg.line === null) {
                    continue;
                }
                const match = expectedErrors.find(e => isMatchingError(e, msg));
                if (match === undefined) {
                    unexpectedErrors.push(`[${msg.level}] ${convertMessageFromJson(msg)}`);
                } else {
                    match.found = true;
                }
            }
            for (const expected of expectedErrors) {
                if (expected.found !== true) {
                    notFoundErrors.push(`\`${file}\`: Expected error not found at line ` +
                        expected.originalLine);
                }
            }
            if (notFoundErrors.length + unexpectedErrors.length !== 0) {
                if (unexpectedErrors.length !== 0) {
                    print('Unexpected errors:');
                    for (const err of unexpectedErrors) {
                        print(`+> ${err}`, undefined, false);
                    }
                }
                if (notFoundErrors.length !== 0) {
                    print('Not found errors:');
                    for (const err of notFoundErrors) {
                        print(`+> ${err}`);
                    }
                }
                this._addTest();
                this._incrError();
                return false;
            }
            const parts = expectedValue.split('$LINE');
            let startIndex = 0;
            if (parts.length > 1) {
                for (const part of parts) {
                    const toCheck = output.slice(startIndex, startIndex + part.length);
                    if (!this.assert(toCheck, part, pos, file, toJson)) {
                        if (errCallback !== undefined) {
                            errCallback(output, expectedValue);
                        } else {
                            print(`===full output===\n${output}\n==end of output==`);
                        }
                        return false;
                    }
                    startIndex = part.length;
                    while (startIndex < output.length && output[startIndex] !== ')') {
                        startIndex += 1;
                    }
                }
                return true;
            }
            return this.assert(output, expectedValue, pos, file, toJson, out, errCallback);
        } catch (err) {
            return this.assert(
                err.message, expectedValue, pos, file, toJson, out, errCallback);
        }
    }

    async startTestSuite(name, printMsg, callback) {
        this.testSuite.push({
            'name': name,
            'errors': 0,
            'ranTests': 0,
            'totalRanTests': 0,
            'totalErrors': 0,
        });
        if (printMsg === true) {
            print(`${'='.repeat(this.testSuite.length)}> Checking "${name}"...`);
        }
        let errorOccurred = false;
        try {
            errorOccurred = await callback(this.testSuite.length, name);
        } catch (err) {
            print(err);
            errorOccurred = true;
        }
        const {totalErrors, totalRanTests} = this.testSuite.pop();
        if (errorOccurred === true) {
            this._incrError();
        }
        return {totalRanTests, totalErrors};
    }

    getTotalRanTests() {
        if (this.testSuite.length === 0) {
            return 0;
        }
        return this.testSuite[this.testSuite.length - 1].totalRanTests;
    }

    getTotalErrors() {
        if (this.testSuite.length === 0) {
            return 0;
        }
        return this.testSuite[this.testSuite.length - 1].totalErrors;
    }
}

function removeFolder(entry) {
    if (fs.existsSync(entry)) {
        fs.readdirSync(entry).forEach(file => {
            const curPath = path.join(entry, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                removeFolder(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(entry);
    }
}

function getAllFiles(dirPath) {
    const allFiles = [];

    for (const file of fs.readdirSync(dirPath, {'encoding': 'utf8'})) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            allFiles.push(...getAllFiles(fullPath));
        } else {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
}

module.exports = {
    'Assert': Assert,
    'plural': plural,
    'print': print,
    'removeFolder': removeFolder,
    'API_OUTPUT': path.join(__dirname, '../tests/api-output'),
    'getAllFiles': getAllFiles,
};
