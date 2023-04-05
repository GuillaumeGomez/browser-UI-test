// Commands making changes the current page's DOM.

const { getAndSetElements, indentString, validateJson } = require('./utils.js');

function innerParseCssAttribute(parser, argName, varName, allowNullIdent, callback) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': 'expected `("CSS selector" or "XPath", JSON)`, found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected \`("CSS selector" or "XPath", JSON)\`, found \`\
${parser.getRawArgs()}\` (${parser.getArticleKind()})`,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': `expected a tuple of two elements, found ${tuple.length}`,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': `expected a string as first argument of the tuple, found \`\
${tuple[0].getErrorText()}\` (${tuple[1].getArticleKind()})`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': `expected JSON as second argument, found \`${tuple[1].getErrorText()}\` \
(${tuple[1].getArticleKind()})`,
        };
    }

    const selector = tuple[0].getSelector('(first argument)');
    if (selector.error !== undefined) {
        return selector;
    }

    const json = tuple[1].getRaw();
    const validators = {'string': [], 'number': []};
    if (allowNullIdent) {
        validators['ident'] = ['null'];
    }
    const entries = validateJson(json, validators, argName);
    if (entries.error !== undefined) {
        return entries;
    }
    if (Object.entries(entries.values).length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
        };
    }

    const code = [];
    for (const [key, value] of Object.entries(entries.values)) {
        if (key === '') {
            return {
                'error': 'empty strings cannot be used as keys',
            };
        }
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
        'warnings': entries.warnings,
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
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected `("CSS selector" or "XPath", "text")`, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected `("CSS selector" or "XPath", "text")`, found' +
                ` \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2 || tuple[0].kind !== 'string' || tuple[1].kind !== 'string') {
        return {'error': 'expected `("CSS selector" or "XPath", "text")`'};
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const value = tuple[1].getStringValue();
    const varName = 'parseSetTextElem';
    return {
        'instructions': [
            getAndSetElements(selector, varName, false) + '\n' +
            'await page.evaluate(e => {\n' +
            'if (["input", "textarea"].indexOf(e.tagName.toLowerCase()) !== -1) {\n' +
            `e.value = "${value}";\n` +
            '} else {\n' +
            `e.innerText = "${value}";\n` +
            '}\n' +
            `}, ${varName});`,
        ],
    };
}

module.exports = {
    'parseSetAttribute': parseSetAttribute,
    'parseSetCss': parseSetCss,
    'parseSetProperty': parseSetProperty,
    'parseSetText': parseSetText,
};
