// Contains commands which don't really have a "category".

const path = require('path');
const { COLOR_CHECK_ERROR } = require('../consts.js');
const {
    buildPropertyDict,
    getAndSetElements,
    validateJson,
} = require('./utils.js');

// Possible inputs:
//
// * Number of milliseconds
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//a")
function parseWaitFor(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected an integer or a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1) {
        return {
            'error': 'expected an integer or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'number') {
        const ret = elems[0].getIntegerValue('number of milliseconds', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                `await page.waitFor(${ret.value});`,
            ],
            'wait': false,
        };
    } else if (elems[0].kind !== 'string') {
        return {
            'error': 'expected an integer or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const selector = elems[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    let instructions;
    if (selector.isXPath) {
        instructions = [
            `await page.waitForXPath("${selector.value}");`,
        ];
    } else {
        instructions = [
            `await page.waitForSelector("${selector.value}");`,
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
    };
}

function waitForInitializer(parser, errorMessage, allowEmptyValues) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': 'expected a tuple with a string and a JSON dict, found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a tuple with a string and a JSON dict, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'expected a tuple with a string and a JSON dict, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as first tuple element, ' +
                `found \`${tuple[0].getArticleKind()}\``,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected a JSON dict as second tuple element, ' +
                `found \`${tuple[1].getArticleKind()}\``,
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const json = tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], errorMessage);

    if (entries.error !== undefined) {
        return entries;
    }

    const propertyDict = buildPropertyDict(entries, errorMessage, allowEmptyValues);
    if (propertyDict.error !== undefined) {
        return propertyDict;
    }

    return {
        'selector': selector,
        'warnings': entries.warnings,
        'pseudo': !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '',
        'propertyDict': propertyDict,
    };
}

// Possible inputs:
//
// * ("CSS selector", {"CSS property name": "expected CSS property value"})
// * ("XPath", {"CSS property name": "expected CSS property value"})
function parseWaitForCss(parser) {
    const data = waitForInitializer(parser, 'CSS property', false);
    if (data.error !== undefined) {
        return data;
    }

    const varName = 'parseWaitForCss';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const instructions = [];
    if (data['propertyDict']['needColorCheck']) {
        instructions.push('if (!arg.showText) {\n' +
            `throw "${COLOR_CHECK_ERROR}";\n` +
            '}',
        );
    }
    const nonMatchingS = `nonMatchingProps.push(${varKey} + ": ((\`" + computedEntry + "\` && \`" \
+ extractedFloat + "\`) != \`" + ${varValue} + "\`)");`;
    const check = `\
computedEntry = computedStyle[${varKey}];
if (e.style[${varKey}] != ${varValue} && computedEntry != ${varValue}) {
    if (typeof computedEntry === "string" && computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
        extractedFloat = browserUiTestHelpers.extractFloat(computedEntry, true) + "px";
        if (extractedFloat !== ${varValue}) {
            ${nonMatchingS}
        } else {
            continue;
        }
    }
    nonMatchingProps.push(${varKey} + ": (\`" + computedEntry + "\` != \`" + ${varValue} + "\`)");
}`;

    instructions.push(getAndSetElements(data['selector'], varName, false) + '\n' +
// `page._timeoutSettings.timeout` is an internal thing so better be careful at any puppeteer
// version update!
`let timeLimit = page._timeoutSettings.timeout();
const timeAdd = 50;
let allTime = 0;
let nonMatchingProps;
while (true) {
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const ${varDict} = {${data['propertyDict']['dict']}};
        const computedStyle = getComputedStyle(e${data['pseudo']});
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
            ${check}
        }
        return nonMatchingProps;
    }, ${varName});
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`);

    return {
        'instructions': instructions,
        'wait': false,
        'warnings': data['warnings'],
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector", {"attribute name": "expected attribute value"})
// * ("XPath", {"attribute name": "expected attribute value"})
function parseWaitForAttribute(parser) {
    const data = waitForInitializer(parser, 'attribute', true);
    if (data.error !== undefined) {
        return data;
    }

    const varName = 'parseWaitForAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const instructions = [];
    const check = `\
computedEntry = e.getAttribute(${varKey});
if (computedEntry !== ${varValue}) {
    nonMatchingProps.push(${varKey} + ": (\`" + computedEntry + "\` != \`" + ${varValue} + "\`)");
}`;

    instructions.push(getAndSetElements(data['selector'], varName, false) + '\n' +
// `page._timeoutSettings.timeout` is an internal thing so better be careful at any puppeteer
// version update!
`let timeLimit = page._timeoutSettings.timeout();
const timeAdd = 50;
let allTime = 0;
let nonMatchingProps;
while (true) {
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const ${varDict} = {${data['propertyDict']['dict']}};
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
            ${check}
        }
        return nonMatchingProps;
    }, ${varName});
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`);

    return {
        'instructions': instructions,
        'wait': false,
        'warnings': data['warnings'],
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector", "text")
// * ("XPath", "text")
function parseWaitForText(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': 'expected a tuple with two strings, found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a tuple with two strings, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'expected a tuple with two strings, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as first tuple element, ' +
                `found \`${tuple[0].getArticleKind()}\``,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected a string as second tuple element, ' +
                `found \`${tuple[1].getArticleKind()}\``,
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const value = tuple[1].getStringValue();
    const varName = 'parseWaitForText';

    const instructions = getAndSetElements(selector, varName, false) + '\n' +
// `page._timeoutSettings.timeout` is an internal thing so better be careful at any puppeteer
// version update!
`let timeLimit = page._timeoutSettings.timeout();
const timeAdd = 50;
const value = "${value}";
let allTime = 0;
let computedEntry;
while (true) {
    computedEntry = await page.evaluate(e => {
        return browserUiTestHelpers.getElemText(e, "${value}");
    }, ${varName});
    if (computedEntry === value) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The text still doesn't match: \`" + computedEntry + "\` != \
\`" + value + "\`");
    }
}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'checkResult': true,
    };
}

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
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getText()}\``);
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
                    'error': `expected all tuple elements to be strings, found \`${el.getText()}\``,
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
    'parseWaitFor': parseWaitFor,
    'parseWaitForAttribute': parseWaitForAttribute,
    'parseWaitForCss': parseWaitForCss,
    'parseWaitForText': parseWaitForText,
    'parseScreenshot': parseScreenshot,
    'innerParseScreenshot': innerParseScreenshot,
};
