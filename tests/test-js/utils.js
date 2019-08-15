const path = require('path');

function toJSON(value) {
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return value;
}

function getStackInfo(stack) {
    const parent = stack.split('at ')[2].trim();
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
        this.errors = 0;
        this.ranTests = 0;
    }

    assert(value1, value2) {
        this.ranTests += 1;
        if (typeof value2 !== 'undefined') {
            value1 = toJSON(value1);
            value2 = toJSON(value2);
            if (value1 !== value2) {
                const pos = getStackInfo(new Error().stack);
                print(`[${pos.file}:${pos.line}] failed: \`${value1}\` != \`${value2}\``);
                this.errors += 1;
                return;
            }
        } else if (!value1) {
            const pos = getStackInfo(new Error().stack);
            print(`[${pos.file}:${pos.line}] failed: \`${value1}\` is evalued to false`);
            this.errors += 1;
            return;
        }
    }
}

module.exports = {
    Assert: Assert,
    plural: plural,
    print: print,
};
