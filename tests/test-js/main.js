const path = require('path');
const process = require('process');

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

function checkClick() {
    const func = require('../../src/parser.js').parseClick;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected a position or a CSS selector'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected position to end with \')\'...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.click(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.click("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.click("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.click("\\\\"a")']});

    return x;
}

function checkFail() {
    const func = require('../../src/parser.js').parseFail;
    const x = new Assert();

    x.assert(func('hello'), {'error': 'Expected "true" or "false" value, found `hello`'});
    x.assert(func('"true"'), {'error': 'Expected "true" or "false" value, found `"true"`'});
    x.assert(func('tru'), {'error': 'Expected "true" or "false" value, found `tru`'});
    x.assert(func('false'), {'instructions': ['arg.expectedToFail = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.expectedToFail = true;'], 'wait': false});

    return x;
}

function checkFocus() {
    const func = require('../../src/parser.js').parseFocus;
    const x = new Assert();

    x.assert(func('a'), {'error': 'Expected a CSS selector'});
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.focus("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.focus("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.focus("\\\\"a")']});

    return x;
}

function checkMoveCursorTo() {
    const func = require('../../src/parser.js').parseMoveCursorTo;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected a position or a CSS selector'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected position to end with \')\'...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.move(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.hover("\\\\"a")']});

    return x;
}

function checkScreenshot() {
    const func = require('../../src/parser.js').parseScreenshot;
    const x = new Assert();

    x.assert(func('hello'), {'error': 'Expected "true" or "false" value, found `hello`'});
    x.assert(func('"true"'), {'error': 'Expected "true" or "false" value, found `"true"`'});
    x.assert(func('tru'), {'error': 'Expected "true" or "false" value, found `tru`'});
    x.assert(func('false'), {'instructions': ['arg.takeScreenshot = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.takeScreenshot = true;'], 'wait': false});

    return x;
}

function checkScrollTo() {
    const func = require('../../src/parser.js').parseScrollTo;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected a position or a CSS selector'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected position to end with \')\'...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.move(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.hover("\\\\"a")']});

    return x;
}

function checkSize() {
    const func = require('../../src/parser.js').parseSize;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected `(` character, found `h`'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected size to end with `)`...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.setViewport({width: 1, height: 2})']});

    return x;
}

const TO_CHECK = [
    {'name': 'click', 'func': checkClick},
    {'name': 'fail', 'func': checkFail},
    {'name': 'focus', 'func': checkFocus},
    {'name': 'move-cursor-to', 'func': checkMoveCursorTo},
    {'name': 'screenshot', 'func': checkScreenshot},
    {'name': 'scroll-to', 'func': checkScrollTo},
    {'name': 'size', 'func': checkSize},
];

function checkCommands() {
    let nbErrors = 0;

    print('=> Starting tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        print(`==> Checking "${TO_CHECK[i].name}"...`);
        const errors = TO_CHECK[i].func();
        nbErrors += errors.errors;
        print(`<== "${TO_CHECK[i].name}": ${errors.errors} ${plural('error', errors.errors)} (in ` +
              `${errors.ranTests} ${plural('test', errors.ranTests)})`);
    }

    print('');
    print(`<= Ending tests with ${nbErrors} ${plural('error', nbErrors)}`);

    return nbErrors;
}

if (require.main === module) {
    const nbErrors = checkCommands();
    process.exit(nbErrors);
} else {
    print('Cannot be used as module!', console.error);
    process.exit(1);
}
