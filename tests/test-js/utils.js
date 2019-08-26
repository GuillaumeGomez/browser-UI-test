const path = require('path');
const process = require('process');

function toJSON(value) {
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return value;
}

function getStackInfo(stack, level = 2) {
    const parents = stack.split('at ');
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

class Assert {
    constructor() {
        this.testSuite = [];
    }

    assert(value1, value2, pos) {
        if (this.testSuite.length > 0) {
            this.testSuite[this.testSuite.length - 1].ranTests += 1;
            this._incrField('totalRanTests', this.testSuite.length - 1);
        }
        if (typeof value2 !== 'undefined') {
            value1 = toJSON(value1);
            value2 = toJSON(value2);
            if (value1 !== value2) {
                if (typeof pos === 'undefined') {
                    pos = getStackInfo(new Error().stack);
                }
                print(`[${pos.file}:${pos.line}] failed: \`${value1}\` != \`${value2}\``);
                if (this.testSuite.length > 0) {
                    this.testSuite[this.testSuite.length - 1].errors += 1;
                    this._incrField('totalErrors', this.testSuite.length - 1);
                }
                return;
            }
        } else if (!value1) {
            if (typeof pos === 'undefined') {
                pos = getStackInfo(new Error().stack);
            }
            print(`[${pos.file}:${pos.line}] failed: \`${value1}\` is evalued to false`);
            if (this.testSuite.length > 0) {
                this.testSuite[this.testSuite.length - 1].errors += 1;
                this._incrField('totalErrors', this.testSuite.length - 1);
            }
            return;
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

    async assertTry(callback, args, expectedValue) {
        const pos = getStackInfo(new Error().stack, 2);
        try {
            const ret = await callback(...args);
            return this.assert(ret, expectedValue, pos);
        } catch (err) {
            return this.assert(err.message, expectedValue, pos);
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

    endTestSuite(printMsg = true) {
        if (this.testSuite.length === 0) {
            throw new Error('No test suite is running, call `startTestSuite` first');
        }
        const {name, totalErrors, totalRanTests} = this.testSuite.pop();
        if (printMsg === true) {
            print(`<${'='.repeat(this.testSuite.length + 1)} "${name}": ${totalErrors} ` +
                `${plural('error', totalErrors)} (in ${totalRanTests} ` +
                `${plural('test', totalRanTests)})`);
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

module.exports = {
    'Assert': Assert,
    'plural': plural,
    'print': print,
};
