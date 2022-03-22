// Contains commands which don't really have a "category".

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

// Possible inputs:
//
// * ("CSS selector", {"CSS property name": "expected CSS property value"}
// * ("XPath", {"CSS property name": "expected CSS property value"}
function parseWaitForCss(parser) {
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
    const entries = validateJson(json, ['string', 'number'], 'CSS property');

    if (entries.error !== undefined) {
        return entries;
    } else if (entries.values.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': entries.warnings,
            'checkResult': true,
        };
    }
    const propertyDict = buildPropertyDict(entries, 'CSS property', false);
    if (propertyDict.error !== undefined) {
        return propertyDict;
    }
    const varName = 'parseWaitForCss';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const pseudo = !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '';

    const instructions = [];
    if (propertyDict['needColorCheck']) {
        instructions.push('if (!arg.showText) {\n' +
            `throw "${COLOR_CHECK_ERROR}";\n` +
            '}',
        );
    }
    const nonMatchingS = `nonMatchingProps.push(${varKey} + ": ((" + computedEntry + " && " + \
extractedFloat + ") != " + ${varValue} + ")");`;
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
    nonMatchingProps.push(${varKey} + ": (" + computedEntry + " != " + ${varValue} + ")");
}`;

    instructions.push(getAndSetElements(selector, varName, false) +
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
        const ${varDict} = {${propertyDict['dict']}};
        const computedStyle = getComputedStyle(e${pseudo});
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

module.exports = {
    'parseLocalStorage': parseLocalStorage,
    'parseWaitFor': parseWaitFor,
    'parseWaitForCss': parseWaitForCss,
};
