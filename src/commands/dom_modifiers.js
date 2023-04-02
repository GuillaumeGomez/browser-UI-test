// Commands making changes the current page's DOM.

const { getAndSetElements, checkJsonEntry, indentString } = require('./utils.js');

function innerParseCssAttribute(parser, argName, varName, callback) {
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
    if (tuple.length === 3) {
        if (tuple[1].kind !== 'string' || tuple[2].kind !== 'string') {
            return {
                'error': `expected strings for ${argName} name and ${argName} value (second ` +
                    'and third arguments)',
            };
        }
        const attributeName = tuple[1].getStringValue(true);
        if (attributeName.length === 0) {
            return {'error': `${argName} name (second argument) cannot be empty`};
        }
        const value = tuple[2].getStringValue();
        return {
            'instructions': [
                `\
${getAndSetElements(selector, varName, false)}
await page.evaluate(e => {
${indentString(callback(attributeName, value), 1)}
}, ${varName});`,
            ],
        };
    } else if (tuple.length !== 2) {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", "${argName} ` +
                'value")` or `("CSS selector" or "XPath", [JSON object])`',
        };
    }
    if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected json as second argument (since there are only two arguments), ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    }

    let code = '';
    const json = tuple[1].getRaw();
    varName += 'Json';

    const warnings = checkJsonEntry(json, entry => {
        const key_s = entry['key'].getStringValue();
        const value_s = entry['value'].getStringValue();
        if (code.length !== 0) {
            code += '\n';
        }
        code += `\
await page.evaluate(e => {
${indentString(callback(key_s, value_s), 1)}
}, ${varName});`;
    });
    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': warnings,
        };
    }
    return {
        'instructions': [
            getAndSetElements(selector, varName, false) + '\n' +
            code,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector", "attribute name", "attribute value")
// * ("XPath", "attribute name", "attribute value")
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseAttribute(parser) {
    return innerParseCssAttribute(parser, 'attribute', 'parseAttributeElem',
        (key, value) => `e.setAttribute("${key}","${value}");`);
}

// Possible inputs:
//
// * ("CSS selector", "property name", "property value")
// * ("XPath", "attribute name", "property value")
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseProperty(parser) {
    return innerParseCssAttribute(parser, 'property', 'parsePropertyElem',
        (key, value) => `e["${key}"] = "${value}";`);
}

// Possible inputs:
//
// * ("CSS selector", "CSS property name", "CSS property value")
// * ("XPath", "CSS property name", "CSS property value")
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseCss(parser) {
    return innerParseCssAttribute(parser, 'CSS property', 'parseCssElem',
        (key, value) => `e.style["${key}"] = "${value}";`);
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
