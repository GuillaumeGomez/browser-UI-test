// Commands making changes the current page's DOM.

const { getAndSetElements, indentString } = require('./utils.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

function innerParseCssAttribute(
    parser, argName, varName, allowNullIdent, callback, allowObjectPath,
) {
    const keyTypes = {
        string: [],
    };
    if (allowObjectPath) {
        keyTypes['object-path'] = [];
    }
    const jsonValidator = {
        kind: 'json',
        keyTypes: keyTypes,
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
        jsonValidator.valueTypes.boolean = {};
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
        code.push(callback(key, value, value.kind));
    }
    const func = allowObjectPath ? `
function setObjValue(object, path, value) {
    for (let i = 0; i < path.length - 1; ++i) {
        const subPath = path[i];
        if (object[subPath] === undefined || object[subPath] === null) {
            if (value === undefined) {
                return;
            }
            object[subPath] = {};
        }
        object = object[subPath];
    }
    if (value === undefined) {
        delete object[path[path.length - 1]];
    } else {
        object[path[path.length - 1]] = value;
    }
}` : '';

    return {
        'instructions': [`\
${getAndSetElements(selector, varName, false)}
await page.evaluate(e => {${indentString(func, 1)}
${indentString(code.join('\n'), 1)}
}, ${varName});`,
        ],
    };
}

// Possible inputs:
//
// * ("selector", "attribute name", "attribute value")
// * ("selector", JSON dict)
function parseSetAttribute(parser) {
    return innerParseCssAttribute(parser, 'attribute', 'parseSetAttributeElem', true,
        (key, value, kind) => {
            if (kind !== 'ident' && kind !== 'boolean') {
                return `e.setAttribute("${key}","${value.value}");`;
            }
            return `e.removeAttribute("${key}");`;
        }, false);
}

// Possible inputs:
//
// * ("selector", "property name", "property value")
// * ("selector", JSON dict)
function parseSetProperty(parser) {
    return innerParseCssAttribute(parser, 'property', 'parseSetPropertyElem', true,
        (key, value, kind) => {
            const k_s = value.key.kind === 'object-path' ? key : `["${key}"]`;
            const arg = kind === 'ident' ? 'undefined' :
                // eslint-disable-next-line no-extra-parens
                (kind === 'boolean' ? `${value.value}` : `"${value.value}"`);
            return `setObjValue(e, ${k_s}, ${arg});`;
        }, true);
}

// Possible inputs:
//
// * ("selector", "CSS property name", "CSS property value")
// * ("selector", JSON dict)
function parseSetCss(parser) {
    return innerParseCssAttribute(parser, 'CSS property', 'parseSetCssElem', false,
        (key, value, _kind) => `e.style["${key}"] = "${value.value}";`, false);
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
