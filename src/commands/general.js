// Contains commands which don't really have a "category".

const path = require('path');
const { getAndSetElements, indentString } = require('./utils.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseSetLocalStorage(parser) {
    const ret = validator(parser,
        {
            kind: 'json',
            keyTypes: {
                string: [],
            },
            allowAllValues: true,
            allowRecursiveValues: false,
            valueTypes: {
                // In case it's an ident, we only want to allow `null`.
                ident: {
                    allowed: ['null'],
                },
            },
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const json = ret.value.entries;
    const content = [];

    for (const [key, value] of json) {
        if (value.kind === 'ident') {
            content.push(`localStorage.removeItem("${key}");`);
        } else {
            content.push(`localStorage.setItem("${key}", "${value.value}");`);
        }
    }
    if (content.length === 0) {
        return {
            'instructions': [],
        };
    }
    return {
        'instructions': [
            `await page.evaluate(() => {\n${content.join('\n')}\n})`,
        ],
    };
}

function innerParseScreenshot(options, filename, selector) {
    let instructions = '';
    const varName = 'screenshotElem';
    let fullPage = true;
    let extraInfo = '';

    if (selector !== null) {
        instructions += getAndSetElements(selector, varName, false) + '\n';
        fullPage = false;
        if (selector.isXPath) {
            extraInfo = ` for XPath \`${selector.value}\``;
        } else {
            extraInfo = ` for CSS selector \`${selector.value}\``;
        }
    } else {
        // In case no selector was specified, we take a screenshot of the whole page.
        instructions += `const ${varName} = page;\n`;
    }

    const p = path.join(options.getImageFolder(), filename) + '.png';
    const opt = {
        'path': p,
        'fullPage': fullPage,
    };
    instructions += `await ${varName}.screenshot(${JSON.stringify(opt)});`;
    return {
        'instructions': [instructions],
        'wait': false,
        'infos': [`Generating screenshot${extraInfo} into \`${p}\``],
    };
}

// Possible inputs:
//
// * ("name")
// * ("name", "element to screenshot")
function parseScreenshot(parser, options) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                {
                    kind: 'string',
                    allowEmpty: false,
                },
                {
                    kind: 'selector',
                    optional: true,
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    return innerParseScreenshot(
        options,
        tuple[0].value.getStringValue(), tuple.length > 1 ? tuple[1].value : null,
    );
}

function parseObjPropertyInner(parser, objName) {
    const ret = validator(parser,
        {
            kind: 'json',
            keyTypes: {
                string: [],
            },
            valueTypes: {
                // In case it's an ident, we only want to allow `null`.
                string: {},
                number: {
                    allowFloat: true,
                    allowNegative: true,
                },
            },
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const json = ret.value.entries;
    const content = [];

    for (const [key, value] of json) {
        content.push(`["${key}", "${value.value}"]`);
    }

    if (content.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'checkResult': true,
        };
    }

    const varName = 'parseProp';

    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';
    // JSON.stringify produces a problematic output so instead we use this.

    const instructions = [`\
await page.evaluate(() => {
    const ${varDict} = new Map([
${indentString(content.join(',\n'), 2)}
    ]);
    for (const [${varKey}, ${varValue}] of ${varDict}) {
        ${objName}[${varKey}] = ${varValue};
    }
});`,
    ];

    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseSetDocumentProperty(parser) {
    return parseObjPropertyInner(parser, 'document');
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseSetWindowProperty(parser) {
    return parseObjPropertyInner(parser, 'window');
}

// Possible inputs:
//
// * "file path"
function parseInclude(parser) {
    const ret = validator(parser, { kind: 'string' });
    if (hasError(ret)) {
        return ret;
    }

    return {'path': ret.value.value };
}

module.exports = {
    'parseSetLocalStorage': parseSetLocalStorage,
    'parseScreenshot': parseScreenshot,
    'innerParseScreenshot': innerParseScreenshot,
    'parseSetDocumentProperty': parseSetDocumentProperty,
    'parseSetWindowProperty': parseSetWindowProperty,
    'parseInclude': parseInclude,
};
