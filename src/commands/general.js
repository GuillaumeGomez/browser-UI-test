// Contains commands which don't really have a "category".

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
};
