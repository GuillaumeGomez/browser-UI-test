// Contains commands which don't really have a "category".

const path = require('path');
const { getAndSetElements, checkJsonEntry, validateJson } = require('./utils.js');

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseLocalStorage(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected JSON, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'json') {
        return {'error': `expected JSON, found \`${parser.getRawArgs()}\``};
    }

    const json = elems[0].getRaw();
    const content = [];
    let error = null;

    const warnings = checkJsonEntry(json, entry => {
        if (error !== null) {
            return;
        }
        const key_s = entry['key'].getStringValue();
        const value_s = entry['value'].getStringValue();
        if (entry['value'].kind === 'ident') {
            if (value_s !== 'null') {
                error = `Only \`null\` ident is allowed, found \`${value_s}\``;
            }
            content.push(`localStorage.removeItem("${key_s}");`);
        } else {
            content.push(`localStorage.setItem("${key_s}", "${value_s}");`);
        }
    });
    if (error !== null) {
        return {'error': error};
    } else if (content.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
        };
    }
    return {
        'instructions': [
            `await page.evaluate(() => {\n${content.join('\n')}\n})`,
        ],
        'warnings': warnings,
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
// * "name"
// * ("name")
// * ("name", "element to screenshot")
function parseScreenshot(parser, options) {
    const elems = parser.elems;
    let filename;
    let selector = null;

    if (elems.length === 0) {
        return {'error': 'expected a string or a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple' && elems[0].kind !== 'string') {
        return {'error': `expected a string or a tuple, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        filename = elems[0].getStringValue();
    } else {
        const tuple = elems[0].getRaw();
        if (tuple.length !== 1 && tuple.length !== 2) {
            let err = `expected a tuple with one or two strings, found \`${tuple.length}\` element`;
            if (tuple.length > 1) {
                err += 's';
            }
            return {'error': err};
        }
        for (const el of tuple) {
            if (el.kind !== 'string') {
                return {
                    'error': `expected all tuple elements to be strings, found \`\
${el.getErrorText()}\``,
                };
            }
        }
        filename = tuple[0].getStringValue();
        if (tuple.length === 2) {
            selector = tuple[1].getSelector();
            if (selector.error !== undefined) {
                return selector;
            }
        }
    }
    return innerParseScreenshot(options, filename, selector);
}

function parseObjPropertyInner(parser, objName) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple or a JSON dict, found nothing'};
    // eslint-disable-next-line no-extra-parens
    } else if (elems.length !== 1) {
        return {'error': `expected a JSON dict, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind !== 'json') {
        return {
            'error': `expected a JSON dict, found \`${elems[0].getErrorText()}\` \
(${elems[0].getArticleKind()})`,
        };
    }

    let warnings = [];
    const entries = validateJson(elems[0].getRaw(), ['string', 'number'], 'property');
    if (entries.error !== undefined) {
        return entries;
    } else if (entries.warnings !== undefined) {
        warnings = entries.warnings;
    }

    if (Object.entries(entries.values).length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': warnings.length > 0 ? warnings : undefined,
            'checkResult': true,
        };
    }

    const varName = 'parseProp';

    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';
    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }

    const instructions = [`\
await page.evaluate(() => {
    const ${varDict} = {${d}};
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        ${objName}[${varKey}] = ${varValue};
    }
});`,
    ];

    return {
        'instructions': instructions,
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseDocumentProperty(parser) {
    return parseObjPropertyInner(parser, 'document');
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseWindowProperty(parser) {
    return parseObjPropertyInner(parser, 'window');
}

module.exports = {
    'parseLocalStorage': parseLocalStorage,
    'parseScreenshot': parseScreenshot,
    'innerParseScreenshot': innerParseScreenshot,
    'parseDocumentProperty': parseDocumentProperty,
    'parseWindowProperty': parseWindowProperty,
};
