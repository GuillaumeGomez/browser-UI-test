// List commands handling inputs.

const { getAndSetElements } = require('./utils.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseClick(parser) {
    const number = {
        kind: 'number',
        allowFloat: false,
        allowNegative: false,
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [number, number],
            alternatives: [
                { kind: 'selector' },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const p = ret.value;

    if (p.kind === 'tuple') {
        const tuple = p.entries;
        return {
            'instructions': [
                `await pages[0].mouse.click(${tuple[0].value.value}, ${tuple[1].value.value});`,
            ],
        };
    }
    const selector = p;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    const warnings = [];
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) can't be retrieved so \
\`click\` will be performed on the element directly`);
    }
    const varName = 'parseClickVar';

    return {
        'instructions': [
            getAndSetElements(selector, varName, false) + '\n' +
            `await ${varName}.click();`,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector"|"XPath", {"x"|"y": [number]})
function parseClickWithOffset(parser) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                {
                    kind: 'selector',
                },
                {
                    kind: 'json',
                    keyTypes: {
                        string: ['x', 'y'],
                    },
                    valueTypes: {
                        number: {
                            allowFloat: false,
                            allowNegative: true,
                        },
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;

    const warnings = [];
    const varName = 'parseClickWithOffsetVar';
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) can't be retrieved so \
\`click\` will be performed on the element directly`);
    }

    const content = [];
    for (const [key, value] of tuple[1].value.entries) {
        content.push(`"${key}": ${value.value}`);
    }

    return {
        'instructions': [`\
${getAndSetElements(selector, varName, false)}
await ${varName}.click({
    "offset": {${content.join(', ')}},
});`,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseFocus(parser) {
    const ret = validator(parser, { kind: 'selector' });
    if (hasError(ret)) {
        return ret;
    }

    const selector = ret.value;
    const varName = 'parseFocusVar';
    return {
        'instructions': [
            `\
${getAndSetElements(selector, varName, false)}
await ${varName}.focus();`,
        ],
    };
}

// Possible inputs:
//
// * "text" (in here, it'll write into the current focused element)
// * keycode (in here, it'll write the given keycode into the current focused element)
function parseWrite(parser) {
    const ret = validator(parser, {
        kind: 'string',
        alternatives: [
            {
                kind: 'number',
                allowNegative: false,
                allowFloat: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const value = ret.value;
    if (value.kind === 'number') {
        return {
            'instructions': [
                `await pages[0].keyboard.press(String.fromCharCode(${value.value}));`,
            ],
        };
    }
    return {
        'instructions': [
            `await pages[0].keyboard.type("${value.getStringValue()}");`,
        ],
    };
}

// Possible inputs:
//
// * ("CSS selector" or "XPath", "text")
// * ("CSS selector" or "XPath", keycode)
function parseWriteInto(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'string',
                alternatives: [
                    {
                        kind: 'number',
                        allowNegative: false,
                        allowFloat: false,
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const varName = 'parseWriteVar';
    const value = tuple[1].value;
    if (value.kind === 'string') {
        return {
            'instructions': [`\
${getAndSetElements(selector, varName, false)}
await ${varName}.type("${value.getStringValue()}");`,
            ],
        };
    }
    return {
        'instructions': [`\
${getAndSetElements(selector, varName, false)}
${varName}.focus();
await ${varName};
pages[0].keyboard.press(String.fromCharCode(${value.value}));`],
    };
}


// Possible inputs:
//
// * ("key", delay)
// * (keycode, delay)
// * "key"
// * keycode
//
// The key codes (both strings and integers) can be found here:
// https://github.com/puppeteer/puppeteer/blob/v1.14.0/lib/USKeyboardLayout.js
function parsePressKey(parser) {
    const number = {
        kind: 'number',
        allowNegative: false,
        allowFloat: false,
    };
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'string',
                allowEmpty: false,
                alternatives: [number],
            },
            number,
        ],
        alternatives: [
            {
                kind: 'string',
                allowEmpty: false,
            },
            number,
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const value = ret.value;
    if (value.kind === 'number') {
        return {
            'instructions': [
                `await pages[0].keyboard.press(String.fromCharCode(${value.value}))`,
            ],
        };
    } else if (value.kind === 'string') {
        return {
            'instructions': [
                `await pages[0].keyboard.press("${value.getStringValue()}")`,
            ],
        };
    }

    const tuple = value.entries;
    // First we get the delay value.
    const delay = tuple[1].value.value;

    // Then we get the keycode.
    if (tuple[0].value.kind === 'string') {
        return {
            'instructions': [
                `await pages[0].keyboard.press("${tuple[0].value.getStringValue()}", ${delay})`,
            ],
        };
    }
    return {
        'instructions': [
            `await pages[0].keyboard.press(String.fromCharCode(${tuple[0].value.value}), ${delay})`,
        ],
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseMoveCursorTo(parser) {
    const number = {
        kind: 'number',
        allowNegative: false,
        allowFloat: false,
    };
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [number, number],
        alternatives: [
            { kind: 'selector' },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const value = ret.value;
    if (value.kind === 'tuple') {
        const [x, y] = value.entries;
        return {
            'instructions': [
                `await pages[0].mouse.move(${x.value.value}, ${y.value.value});`,
            ],
        };
    }
    if (value.isXPath) {
        const varName = 'parseMoveCursorToVar';
        return {
            'instructions': [`\
${getAndSetElements(value, varName, false)}
await ${varName}.hover();`,
            ],
        };
    }
    return {
        'instructions': [
            `await page.hover("${value.value}");`,
        ],
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseScrollTo(parser) {
    return parseMoveCursorTo(parser); // The page will scroll to the element
}


// Possible inputs:
//
// * ((x, y), (x, y))
// * ((x, y), "selector")
// * ("selector", (x, y))
// * ("selector", "selector")
function parseDragAndDrop(parser) {
    const number = {
        kind: 'number',
        allowNegative: false,
        allowFloat: false,
    };
    const tupleValidator = {
        kind: 'tuple',
        elements: [number, number],
    };
    const selectorOrTuple = {
        kind: 'selector',
        alternatives: [tupleValidator],
    };
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [selectorOrTuple, selectorOrTuple],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;

    function setupThings(arg, varName, posName) {
        let code = '';
        if (arg.kind !== 'tuple') {
            const box = `${varName}_box`;
            code += getAndSetElements(arg.value, varName, false) + '\n' +
                `const ${box} = await ${varName}.boundingBox();\n` +
                `const ${posName} = [${box}.x + ${box}.width / 2, ${box}.y + ${box}.height / 2];\n`;
        } else {
            const args = arg.value.entries;
            code += `const ${posName} = [${args[0].value.getRaw()}, ${args[1].value.getRaw()}];\n`;
        }
        return `${code}await pages[0].mouse.move(${posName}[0], ${posName}[1]);`;
    }

    return {
        'instructions': [`\
${setupThings(tuple[0], 'parseDragAndDropElem', 'start')}
await pages[0].mouse.down();
${setupThings(tuple[1], 'parseDragAndDropElem2', 'end')}
await pages[0].mouse.up();`,
        ],
    };
}

module.exports = {
    'parseClick': parseClick,
    'parseClickWithOffset': parseClickWithOffset,
    'parseDragAndDrop': parseDragAndDrop,
    'parseFocus': parseFocus,
    'parseMoveCursorTo': parseMoveCursorTo,
    'parsePressKey': parsePressKey,
    'parseScrollTo': parseScrollTo,
    'parseWrite': parseWrite,
    'parseWriteInto': parseWriteInto,
};
