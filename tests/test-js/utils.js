const path = require('path');

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
        // eslint-disable-next-line
        console.log(x);
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
        this.totalRanTests = 0;
        this.totalErrors = 0;
        this.errors = 0;
        this.ranTests = 0;
        this.currentTestSuite = null;
    }

    assert(value1, value2, pos) {
        this.ranTests += 1;
        this.totalRanTests += 1;
        if (typeof value2 !== 'undefined') {
            value1 = toJSON(value1);
            value2 = toJSON(value2);
            if (value1 !== value2) {
                if (typeof pos === 'undefined') {
                    pos = getStackInfo(new Error().stack);
                }
                print(`[${pos.file}:${pos.line}] failed: \`${value1}\` != \`${value2}\``);
                this.errors += 1;
                this.totalErrors += 1;
                return;
            }
        } else if (!value1) {
            if (typeof pos === 'undefined') {
                pos = getStackInfo(new Error().stack);
            }
            print(`[${pos.file}:${pos.line}] failed: \`${value1}\` is evalued to false`);
            this.errors += 1;
            this.totalErrors += 1;
            return;
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
        if (this.currentTestSuite !== null) {
            throw `The test suite "${this.currentTestSuite}" is already running, call ` +
                '`endTestSuite` first';
        }
        this.currentTestSuite = name;
        if (printMsg === true) {
            print(`==> Checking "${this.currentTestSuite}"...`);
        }
    }

    endTestSuite(printMsg = true) {
        if (this.currentTestSuite === null) {
            throw 'No test suite is running, call `startTestSuite` first';
        }
        if (printMsg === true) {
            print(`<== "${this.currentTestSuite}": ${this.errors} ${plural('error', this.errors)}` +
                ` (in ${this.ranTests} ${plural('test', this.ranTests)})`);
        }
        this.currentTestSuite = null;
        this.ranTests = 0;
        this.errors = 0;
    }
}

module.exports = {
    Assert: Assert,
    plural: plural,
    print: print,
};
