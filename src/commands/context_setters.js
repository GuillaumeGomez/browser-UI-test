// Commands changing the browser-ui-test state of the current test.

const consts = require('../consts.js');

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseFail(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `arg.expectedToFail = ${elems[0].getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseShowText(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    // We need the value to be updated first.
    const instructions = [`arg.showText = ${elems[0].getRaw()};`];
    // And then to make the expected changes to the DOM.
    if (elems[0].getRaw() === 'true') {
        instructions.push('await page.evaluate(() => {\n' +
            `let tmp = document.getElementById('${consts.STYLE_HIDE_TEXT_ID}');\n` +
            'if (tmp) { tmp.remove(); }\n' +
            '});');
    } else {
        instructions.push('await page.evaluate(() => {\n' +
            `window.${consts.STYLE_ADDER_FUNCTION}('${consts.CSS_TEXT_HIDE}', ` +
            `'${consts.STYLE_HIDE_TEXT_ID}');\n` +
            '});');
    }
    return {
        'instructions': instructions,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
// * "CSS selector"
// * "XPath"
function parseScreenshotComparison(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected boolean or CSS selector or XPath, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool' && elems[0].kind !== 'string') {
        return {
            'error': `expected boolean or CSS selector or XPath, found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'bool') {
        return {
            'instructions': [
                `arg.screenshotComparison = ${elems[0].getRaw()};`,
            ],
            'wait': false,
        };
    }
    const warnings = [];
    const selector = elems[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    } else if (selector.value === 'true' || selector.value === 'false') {
        warnings.push(`\`${elems[0].getErrorText()}\` is a string and will be used as CSS ` +
            'selector. If you want to set `true` or `false` value, remove quotes.');
    }
    return {
        'instructions': [
            `arg.screenshotComparison = "${selector.value}";`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings.join('\n') : undefined,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseDebug(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            'if (arg && arg.debug_log && arg.debug_log.setDebugEnabled) {\n' +
            `arg.debug_log.setDebugEnabled(${elems[0].getRaw()});\n` +
            '} else {\n' +
            'throw "`debug` command needs an object with a `debug_log` field of `Debug` type!";\n' +
            '}',
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseScreenshotOnFailure(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `arg.screenshotOnFailure = ${elems[0].getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parsePauseOnError(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `arg.pauseOnError = ${elems[0].getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * number
function parseSetTimeout(parser) {
    const warnings = [];
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected integer for number of milliseconds, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'number') {
        return {
            'error': 'expected integer for number of milliseconds, found' +
                ` \`${parser.getRawArgs()}\``,
        };
    }
    const ret = elems[0].getIntegerValue('number of milliseconds', true);
    if (ret.error !== undefined) {
        return ret;
    }
    if (parseInt(ret.value) === 0) {
        warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
            'this reload');
    }
    return {
        'instructions': [
            `page.setDefaultTimeout(${ret.value})`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
    };
}

function parseFailOnJsError(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    const instructions = [
        `const oldValue = arg.failOnJsError;
arg.failOnJsError = ${elems[0].getRaw()};
if (oldValue !== true) {
    arg.jsErrors.splice(0, arg.jsErrors.length);
}`];

    return {
        'instructions': instructions,
        'wait': false,
    };
}

function parseFailOnRequestError(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    const instructions = [
        `const oldValue = arg.failOnRequestError;
arg.failOnRequestError = ${elems[0].getRaw()};
if (oldValue !== true) {
    arg.requestErrors.splice(0, arg.requestErrors.length);
}`];

    return {
        'instructions': instructions,
        'wait': false,
    };
}

module.exports = {
    'parseDebug': parseDebug,
    'parseFail': parseFail,
    'parseFailOnJsError': parseFailOnJsError,
    'parseFailOnRequestError': parseFailOnRequestError,
    'parsePauseOnError': parsePauseOnError,
    'parseScreenshotComparison': parseScreenshotComparison,
    'parseScreenshotOnFailure': parseScreenshotOnFailure,
    'parseShowText': parseShowText,
    'parseSetTimeout': parseSetTimeout,
};
