// Commands making changes the current page's DOM.

const { getAndSetElements, indentString } = require('./utils.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

function innerParseCssAttribute(parser, argName, varName, allowNullIdent, callback) {
    const jsonValidator = {
        kind: 'json',
        keyTypes: {
            string: [],
        },
        valueTypes: {
            string: {},
            number: {
                allowNegative: true,
                allowFloat: true,
            },
        },
    };
    if (allowNullIdent) {
        jsonValidator.valueTypes.ident = {
            allowed: ['null'],
        };
    }
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                jsonValidator,
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const attributes = tuple[1].value.entries;
    const selector = tuple[0].value;

    if (attributes.size === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }
    const code = [];
    for (const [key, value] of attributes) {
        code.push(callback(key, value.value, value.kind === 'ident'));
    }

    return {
        'instructions': [
            `\
${getAndSetElements(selector, varName, false)}
await page.evaluate(e => {
${indentString(code.join('\n'), 1)}
}, ${varName});`,
        ],
    };
}

// Possible inputs:
//
// * ("CSS selector", "attribute name", "attribute value")
// * ("XPath", "attribute name", "attribute value")
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseSetAttribute(parser) {
    return innerParseCssAttribute(parser, 'attribute', 'parseSetAttributeElem', true,
        (key, value, isIdent) => {
            if (!isIdent) {
                return `e.setAttribute("${key}","${value}");`;
            }
            return `e.removeAttribute("${key}");`;
        });
}

// Possible inputs:
//
// * ("CSS selector", "property name", "property value")
// * ("XPath", "attribute name", "property value")
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseSetProperty(parser) {
    return innerParseCssAttribute(parser, 'property', 'parseSetPropertyElem', true,
        (key, value, isIdent) => {
            if (!isIdent) {
                return `e["${key}"] = "${value}";`;
            }
            return `delete e["${key}"];`;
        });
}

// Possible inputs:
//
// * ("CSS selector", "CSS property name", "CSS property value")
// * ("XPath", "CSS property name", "CSS property value")
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseSetCss(parser) {
    return innerParseCssAttribute(parser, 'CSS property', 'parseSetCssElem', false,
        (key, value, _isIdent) => `e.style["${key}"] = "${value}";`);
}

// Possible inputs:
//
// * ("CSS selector", "text")
// * ("XPath", "text")
function parseSetText(parser) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'string' },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const text = tuple[1].value.getStringValue();
    const varName = 'parseSetTextElem';

    return {
        'instructions': [`\
${getAndSetElements(selector, varName, false)}
await page.evaluate(e => {
    if (["input", "textarea"].indexOf(e.tagName.toLowerCase()) !== -1) {
        e.value = "${text}";
    } else {
        e.innerText = "${text}";
    }
}, ${varName});`,
        ],
    };
}

module.exports = {
    'parseSetAttribute': parseSetAttribute,
    'parseSetCss': parseSetCss,
    'parseSetProperty': parseSetProperty,
    'parseSetText': parseSetText,
};
