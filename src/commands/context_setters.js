// Commands changing the browser-ui-test state of the current test.

const consts = require('../consts.js');
const { validator } = require('../validator.js');
const { hasError } = require('../utils.js');
const { getAndSetElements } = require('./utils.js');

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseExpectFailure(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    return {
        'instructions': [
            `arg.expectedToFail = ${ret.value.getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseShowText(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    // We need the value to be updated first.
    const instructions = [`arg.showText = ${ret.value.getRaw()};`];
    // And then to make the expected changes to the DOM.
    if (ret.value.getRaw() === 'true') {
        instructions.push(`\
await page.evaluate(() => {
    let tmp = document.getElementById('${consts.STYLE_HIDE_TEXT_ID}');
    if (tmp) { tmp.remove(); }
});`,
        );
    } else {
        const text_hide = consts.CSS_TEXT_HIDE;
        instructions.push(`\
await page.evaluate(() => {
    window.${consts.STYLE_ADDER_FUNCTION}('${text_hide}', '${consts.STYLE_HIDE_TEXT_ID}');
});`,
        );
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
    const ret = validator(parser, {
        kind: 'boolean',
        alternatives: [
            {
                kind: 'selector',
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    if (ret.value.kind === 'boolean') {
        return {
            'instructions': [
                `arg.screenshotComparison = ${ret.value.getRaw()};`,
            ],
            'wait': false,
        };
    }
    return {
        'instructions': [
            `arg.screenshotComparison = "${ret.value.value}";`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseDebug(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    return {
        'instructions': [`\
if (arg && arg.logs && arg.logs.setDebugEnabled) {
    arg.logs.setDebugEnabled(${ret.value.getRaw()});
} else {
    throw "\`debug\` command needs an object with a \`logs\` field of \`Logs\` type!";
}`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseScreenshotOnFailure(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    return {
        'instructions': [
            `arg.screenshotOnFailure = ${ret.value.getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parsePauseOnError(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    return {
        'instructions': [
            `arg.pauseOnError = ${ret.value.getRaw()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * number
function parseSetTimeout(parser) {
    const ret = validator(parser, {
        kind: 'number',
        allowFloat: false,
        allowNegative: false,
    });
    if (hasError(ret)) {
        return ret;
    }

    const warnings = [];
    if (parseInt(ret.value.value) === 0) {
        warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
            'this reload');
    }
    return {
        'instructions': [
            `pages[0].setDefaultTimeout(${ret.value.value})`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseFailOnJsError(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    const instructions = [`\
const oldValue = arg.failOnJsError;
arg.failOnJsError = ${ret.value.getRaw()};
if (oldValue !== true) {
    arg.jsErrors.splice(0, arg.jsErrors.length);
}`,
    ];

    return {
        'instructions': instructions,
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseFailOnRequestError(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }
    const instructions = [`\
const oldValue = arg.failOnRequestError;
arg.failOnRequestError = ${ret.value.getRaw()};
if (oldValue !== true) {
    arg.requestErrors.splice(0, arg.requestErrors.length);
}`];

    return {
        'instructions': instructions,
        'wait': false,
    };
}

// Possible inputs:
//
// * (selector, block)
function parseWithinIFrame(parser) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                {
                    kind: 'selector',
                },
                {
                    kind: 'block',
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }
    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;

    if (isPseudo) {
        return {
            'error': 'Pseudo elements cannot be <iframe>',
        };
    }

    const code = `\
${getAndSetElements(selector, 'iframe', false)}
await iframe.evaluate(el => {
    if (el.tagName !== "IFRAME") {
        throw "selector \`${selector.value}\` is not an \`<iframe>\` but a \`<" + \
el.tagName.toLowerCase() + ">\`";
    }
});
pages.push(iframe);`;

    return {
        'instructions': [code],
        'callback': () => {
            const context = parser.get_current_context();
            parser.pushNewContext({
                'ast': context.ast,
                'commands': tuple[1].value.value,
                'currentCommand': 0,
                'functionArgs': new Map(),
                'dropCallback': pages => {
                    if (pages.length < 2) {
                        throw new Error('`pages` is empty whereas it should never happen!');
                    }
                    pages.pop();
                },
            });
        },
        'noPosIncrease': true,
    };
}

module.exports = {
    'parseDebug': parseDebug,
    'parseExpectFailure': parseExpectFailure,
    'parseFailOnJsError': parseFailOnJsError,
    'parseFailOnRequestError': parseFailOnRequestError,
    'parsePauseOnError': parsePauseOnError,
    'parseScreenshotComparison': parseScreenshotComparison,
    'parseScreenshotOnFailure': parseScreenshotOnFailure,
    'parseShowText': parseShowText,
    'parseSetTimeout': parseSetTimeout,
    'parseWithinIFrame': parseWithinIFrame,
};
