// Commands making changes the current page's DOM.

const { getAndSetElements } = require('./utils.js');

function innerParseCssAttribute(parser, argName, varName, callback) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", ` +
                `"${argName} value")\` or \`("CSS selector" or "XPath", [JSON object])\`` +
                ', found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected \`("CSS selector" or "XPath", "${argName} name", ` +
                `"${argName} value")\` or \`("CSS selector" or "XPath", [JSON object])\`` +
                `, found \`${parser.getRawArgs()}\``,
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
            return {'error': 'attribute name (second argument) cannot be empty'};
        }
        const value = tuple[2].getStringValue();
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) + '\n' +
                `await page.evaluate(e => {\n${callback(attributeName, value)}\n}, ` +
                `${varName});`,
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
    let warnings = [];
    const json = tuple[1].getRaw();
    varName += 'Json';

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getErrorText()}\``);
            continue;
        } else if (entry['value'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getErrorText()}\``);
            continue;
        }
        const key_s = entry['key'].getStringValue();
        const value_s = entry['value'].getStringValue();
        if (code.length !== 0) {
            code += '\n';
        }
        code += `await page.evaluate(e => {\n${callback(key_s, value_s)}\n}, ${varName});`;
    }
    warnings = warnings.length > 0 ? warnings : undefined;
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
    'parseText': parseText,
};
