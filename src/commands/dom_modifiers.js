// Commands making changes the current page's DOM.

const { getAndSetElements, indentString, validateJson } = require('./utils.js');

function innerParseCssAttribute(parser, argName, varName, allowNullIdent, callback) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} value")\
\` or \`("CSS selector" or "XPath", [JSON object])\`, found nothing`,
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} value")\
\` or \`("CSS selector" or "XPath", [JSON object])\`, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple[0].kind !== 'string') {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} ` +
                'value")` or `("CSS selector" or "XPath", [JSON object])`',
        };
    }
    const selector = tuple[0].getSelector('(first argument)');
    if (selector.error !== undefined) {
        return selector;
    }

    let entries;
    if (tuple.length === 3) {
        if (tuple[1].kind !== 'string') {
            return { 'error': `expected string for ${argName} name (second argument), found \
\`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})` };
        }

        const kinds = ['string', 'number'];
        if (allowNullIdent) {
            kinds.push('ident');
        }
        if (kinds.indexOf(tuple[2].kind) === -1) {
            return {
                'error': `expected ${kinds.join(' or ')} for ${argName} value (third argument), \
found \`${tuple[2].getErrorText()}\` (${tuple[2].getArticleKind()})`,
            };
        }
        if (tuple[2].kind === 'ident' && tuple[2].value !== 'null') {
            return {
                'error': `Only \`null\` ident is allowed for idents, found \`${tuple[2].value}\``,
            };
        }
        entries = {
            values: Object.create(null),
        };
        entries.values[tuple[1].value] = tuple[2];
    } else if (tuple.length === 2) {
        if (tuple[1].kind !== 'json') {
            return {
                'error': 'expected json as second argument (since there are only two arguments), ' +
                    `found ${tuple[1].getArticleKind()}`,
            };
        }

        const json = tuple[1].getRaw();
        const validators = {'string': [], 'number': []};
        if (allowNullIdent) {
            validators['ident'] = ['null'];
        }
        entries = validateJson(json, validators, argName);
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
    } else {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} ` +
                'value")` or `("CSS selector" or "XPath", [JSON object])`',
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
function parseAttribute(parser) {
    return innerParseCssAttribute(parser, 'attribute', 'parseAttributeElem', true,
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
function parseProperty(parser) {
    return innerParseCssAttribute(parser, 'property', 'parsePropertyElem', true,
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
function parseCss(parser) {
    return innerParseCssAttribute(parser, 'CSS property', 'parseCssElem', false,
        (key, value, _isIdent) => `e.style["${key}"] = "${value}";`);
}

// Possible inputs:
//
// * ("CSS selector", "text")
// * ("XPath", "text")
function parseText(parser) {
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
    const varName = 'parseTextElem';
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
    'parseAttribute': parseAttribute,
    'parseCss': parseCss,
    'parseProperty': parseProperty,
    'parseText': parseText,
};
