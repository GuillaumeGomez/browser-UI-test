// Contains commands which don't really have a "category".

const path = require('path');
const { getAndSetElements } = require('./utils.js');

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
    let warnings = [];

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
        if (entry['value'].kind === 'ident') {
            if (value_s !== 'null') {
                return {'error': `Only \`null\` ident is allowed, found \`${value_s}\``};
            }
            content.push(`localStorage.removeItem("${key_s}");`);
        } else {
            content.push(`localStorage.setItem("${key_s}", "${value_s}");`);
        }
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (content.length === 0) {
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

module.exports = {
    'parseLocalStorage': parseLocalStorage,
    'parseScreenshot': parseScreenshot,
    'innerParseScreenshot': innerParseScreenshot,
};
