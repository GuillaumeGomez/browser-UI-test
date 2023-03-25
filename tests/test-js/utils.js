const path = require('path');
const fs = require('fs');
const process = require('process');

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

function print(x, out) {
    if (typeof out !== 'undefined') {
        out(x);
    } else {
        process.stdout.write(`${x}\n`);
    }
}

function plural(x, nb) {
    if (nb !== 1) {
        return `${x}s`;
    }
    return x;
}

function printDiff(i, value, out) {
    let s = '=> ';
    for (let count = 0; count < 34 && i < value.length; ++count) {
        s += value[i];
        i += 1;
    }
    print(s, out);
}

class Assert {
    constructor() {
        this.testSuite = [];
        // If `--bless` option is used.
        this.blessEnabled = false;
    }

    assertOrBless(value1, value2, errCallback, pos, extraInfo, toJson = true, out = undefined) {
        let callback = undefined;
        if (this.blessEnabled) {
            callback = errCallback;
        }
        return this.assert(value1, value2, pos, extraInfo, toJson, out, callback);
    }

    // `extraInfo` is used as an additional message in case the test fails.
    assert(value1, value2, pos, extraInfo, toJson = true, out = undefined, errCallback = undefined) {
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
            print(`[${pos.file}:${pos.line}] failed: \`${value1}\` is evalued to false`, out);
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

    _addTest() {
        if (this.testSuite.length > 0) {
            this.testSuite[this.testSuite.length - 1].ranTests += 1;
            this._incrField('totalRanTests', this.testSuite.length - 1);
        }
    }

    _incrField(fieldName, pos) {
        for (pos = pos >= this.testSuite.length ? this.testSuite.length - 1 : pos;
            pos >= 0;
            --pos) {
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
    async assertTryUi(callback, args, expectedValue, extraInfo, toJson = true, out = undefined, errCallback = undefined) {
        if (!this.blessEnabled) {
            errCallback = undefined;
        }
        const pos = getStackInfo(new Error().stack, 2);
        try {
            const ret = await callback(...args);
            const parts = expectedValue.split('$LINE');
            let startIndex = 0;
            if (parts.length > 1) {
                for (const part of parts) {
                    const toCheck = ret.slice(startIndex, startIndex + part.length);
                    if (!this.assert(toCheck, part, pos, extraInfo, toJson)) {
                        if (typeof errCallback !== 'undefined') {
                            errCallback(ret, expectedValue);
                        } else {
                            print(`===full output===\n${ret}\n==end of output==`);
                        }
                        return false;
                    }
                    startIndex = part.length;
                    while (startIndex < ret.length && ret[startIndex] !== ')') {
                        startIndex += 1;
                    }
                }
                return true;
            }
            return this.assert(ret, expectedValue, pos, extraInfo, toJson, out, errCallback);
        } catch (err) {
            return this.assert(err.message, expectedValue, pos, extraInfo, toJson, out, errCallback);
        }
    }

    startTestSuite(name, printMsg = true) {
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
    }

    endTestSuite(printMsg = true, errorOccurred = false) {
        if (this.testSuite.length === 0) {
            throw new Error('No test suite is running, call `startTestSuite` first');
        }
        const {name, totalErrors, totalRanTests} = this.testSuite.pop();
        if (printMsg === true) {
            print(`<${'='.repeat(this.testSuite.length + 1)} "${name}": ${totalErrors} ` +
                `${plural('error', totalErrors)} (in ${totalRanTests} ` +
                `${plural('test', totalRanTests)})`);
        }
        if (errorOccurred === true) {
            this._incrError();
        }
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

module.exports = {
    'Assert': Assert,
    'plural': plural,
    'print': print,
    'removeFolder': removeFolder,
};
