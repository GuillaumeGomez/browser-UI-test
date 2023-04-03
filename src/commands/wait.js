// Contains "wait-for*" commands.

const { COLOR_CHECK_ERROR } = require('../consts.js');
const {
    buildPropertyDict,
    validateJson,
    indentString,
    checkJsonEntry,
} = require('./utils.js');

function incrWait(error) {
    return `\
await new Promise(r => setTimeout(r, timeAdd));
if (timeLimit === 0) {
    continue;
}
allTime += timeAdd;
if (allTime >= timeLimit) {
${indentString(error, 1)}
}`;
}

function getWaitForElems(varName, code, error) {
    return [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let ${varName} = null;`,
    `\
while (true) {
${indentString(code, 1)}
${indentString(incrWait(error), 1)}
}`,
    ];
}

function waitForElement(selector, varName) {
    let code;
    let kind;

    if (selector.isXPath) {
        kind = 'XPath';
        code = `\
${varName} = await page.$x("${selector.value}");
if (${varName}.length !== 0) {
    ${varName} = ${varName}[0];
    break;
}`;
    } else {
        kind = 'CSS selector';
        code = `\
${varName} = await page.$("${selector.value}");
if (${varName} !== null) {
    break;
}`;
    }

    return getWaitForElems(
        varName,
        code,
        `throw new Error("The following ${kind} \\"${selector.value}\\" was not found");`,
    );
}

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
                `await new Promise(r => setTimeout(r, ${ret.value}));`,
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
    const [init, looper] = waitForElement(selector, 'parseWaitFor');
    return {
        'instructions': [init + '\n' + looper],
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
                `found \`${tuple[0].getErrorText()}\` (${tuple[0].getArticleKind()})`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected a JSON dict as second tuple element, ' +
                `found \`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const json = tuple[1].getRaw();
    const entries = validateJson(json, {'string': [], 'number': []}, errorMessage);

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
// * ("CSS selector", number)
// * ("XPath", number)
function parseWaitForCount(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': 'expected a tuple with a string and a number, found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a tuple with a string and a number, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'expected a tuple with a string and a number, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as first tuple element, ' +
                `found \`${tuple[0].getErrorText()}\` (${tuple[0].getArticleKind()})`,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': 'expected a number as second tuple element, ' +
                `found \`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }

    const count = tuple[1].getRaw();
    const varName = 'parseWaitForCount';
    let method = '$$';

    if (selector.isXPath) {
        method = '$x';
    }

    const instructions = getWaitForElems(
        varName,
        `\
${varName} = await page.${method}("${selector.value}");
${varName} = ${varName}.length;
if (${varName} === ${count}) {
    break;
}`,
        `throw new Error("Still didn't find ${count} instance of \\"${selector.value}\\" (found " \
+ ${varName} + ")");`,
    );

    return {
        'instructions': [instructions.join('\n')],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * JSON dict
function parseWaitForLocalStorage(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected JSON, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'json') {
        return {'error': `expected JSON, found \`${parser.getRawArgs()}\``};
    }

    const json = elems[0].getRaw();
    let d = '';
    let error = null;

    const warnings = checkJsonEntry(json, entry => {
        if (error !== null) {
            return;
        }
        const key_s = entry['key'].getStringValue();
        let value_s;
        if (entry['value'].kind === 'ident') {
            value_s = entry['value'].getStringValue();
            if (value_s !== 'null') {
                error = `Only \`null\` ident is allowed, found \`${value_s}\``;
            }
        } else {
            value_s = `"${entry['value'].getStringValue()}"`;
        }
        if (d.length > 0) {
            d += ',';
        }
        d += `"${key_s}":${value_s}`;
    });
    if (error !== null) {
        return {'error': error};
    } else if (d.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
            'wait': false,
        };
    }

    const varName = 'parseWaitForLocalStorage';
    const varDict = `${varName}Dict`;
    const varKey = `${varName}Key`;
    const varValue = `${varName}Value`;

    const instructions = getWaitForElems(
        varName,
        `\
${varName} = await page.evaluate(() => {
    const errors = [];
    const ${varDict} = {${d}};
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        let ${varName} = window.localStorage.getItem(${varKey});
        if (${varName} != ${varValue}) {
            errors.push("localStorage item \\"" + ${varKey} + "\\" (of value \\"" + ${varValue} + \
"\\") != \\"" + ${varName} + "\\"");
        }
    }
    return errors;
});
if (${varName}.length === 0) {
    break;
}`,
        `\
const errs = ${varName}.join(", ");
throw new Error("The following local storage entries still don't match: [" + errs + "]");`,
    );

    return {
        'instructions': [instructions.join('\n')],
        'wait': false,
        'checkResult': true,
        'warnings': warnings,
    };
}

function parseWaitForObjectProperty(parser, objName) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected JSON, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'json') {
        return {'error': `expected JSON, found \`${parser.getRawArgs()}\``};
    }

    const json = elems[0].getRaw();
    let d = '';
    let error = null;

    const warnings = checkJsonEntry(json, entry => {
        if (error !== null) {
            return;
        }
        const key_s = entry['key'].getStringValue();
        let value_s;
        if (entry['value'].kind === 'ident') {
            value_s = entry['value'].getStringValue();
            if (value_s !== 'null') {
                error = `Only \`null\` ident is allowed, found \`${value_s}\``;
            }
        } else {
            value_s = `"${entry['value'].getStringValue()}"`;
        }
        if (d.length > 0) {
            d += ',';
        }
        d += `"${key_s}":${value_s}`;
    });
    if (error !== null) {
        return {'error': error};
    } else if (d.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
            'wait': false,
        };
    }

    const varName = 'property';
    const varDict = `${varName}Dict`;
    const varKey = `${varName}Key`;
    const varValue = `${varName}Value`;

    const instructions = getWaitForElems(
        varName,
        `\
${varName} = await page.evaluate(() => {
    const errors = [];
    const ${varDict} = {${d}};
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        if (${objName}[${varKey}] === undefined) {
            errors.push("${objName} doesn't have a property named \`" + ${varKey} + "\`");
        }
        let ${varName} = ${objName}[${varKey}];
        if (${varName} != ${varValue}) {
            errors.push("${objName} item \\"" + ${varKey} + "\\" (of value \\"" + ${varValue} + \
"\\") != \\"" + ${varName} + "\\"");
        }
    }
    return errors;
});
if (${varName}.length === 0) {
    break;
}`,
        `\
const errs = ${varName}.join(", ");
throw new Error("The following ${objName} properties still don't match: [" + errs + "]");`,
    );

    return {
        'instructions': [instructions.join('\n')],
        'wait': false,
        'checkResult': true,
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * JSON dict
function parseWaitForDocumentProperty(parser) {
    return parseWaitForObjectProperty(parser, 'document');
}

// Possible inputs:
//
// * JSON dict
function parseWaitForWindowProperty(parser) {
    return parseWaitForObjectProperty(parser, 'window');
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
        instructions.push(`\
if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`);
    }
    const nonMatchingS = `nonMatchingProps.push(${varKey} + ": (\`" + computedEntry + "\` && \`" \
+ extractedFloat + "\`) != \`" + ${varValue} + "\`)");`;
    const check = `\
computedEntry = computedStyle[${varKey}];
if (e.style[${varKey}] != ${varValue} && computedEntry != ${varValue}) {
    if (typeof computedEntry === "string" && computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
        extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) + "px";
        if (extractedFloat !== ${varValue}) {
            ${nonMatchingS}
        } else {
            continue;
        }
    }
    nonMatchingProps.push(${varKey} + ": (\`" + computedEntry + "\` != \`" + ${varValue} + "\`)");
}`;

    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following CSS properties still don't match: [" + props + "]");`);

    const [init, looper] = waitForElement(data['selector'], varName);
    instructions.push(`\
${init}
let nonMatchingProps;
while (true) {
${indentString(looper, 1)}
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const ${varDict} = {${data['propertyDict']['dict']}};
        const computedStyle = getComputedStyle(e${data['pseudo']});
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${indentString(check, 3)}
        }
        return nonMatchingProps;
    }, ${varName});
    if (nonMatchingProps.length === 0) {
        break;
    }
${indentString(incr, 1)}
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

    const isPseudo = !data.selector.isXPath && data.selector.pseudo !== null;
    if (isPseudo) {
        if (data.warnings === undefined) {
            data.warnings = [];
        }
        data.warnings.push(`Pseudo-elements (\`${data.selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
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

    const [init, looper] = waitForElement(data['selector'], varName);
    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following attributes still don't match: [" + props + "]");`);

    instructions.push(`\
${init}
let nonMatchingProps;
while (true) {
${indentString(looper, 1)}
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const ${varDict} = {${data['propertyDict']['dict']}};
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${indentString(check, 3)}
        }
        return nonMatchingProps;
    }, ${varName});
    if (nonMatchingProps.length === 0) {
        break;
    }
${indentString(incr, 1)}
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
// * ("CSS selector", {"property name": "expected property value"})
// * ("XPath", {"property name": "expected property value"})
function parseWaitForProperty(parser) {
    const data = waitForInitializer(parser, 'property', true);
    if (data.error !== undefined) {
        return data;
    }

    const isPseudo = !data.selector.isXPath && data.selector.pseudo !== null;
    if (isPseudo) {
        if (data.warnings === undefined) {
            data.warnings = [];
        }
        data.warnings.push(`Pseudo-elements (\`${data.selector.pseudo}\`) don't have properties so \
the check will be performed on the element itself`);
    }

    const varName = 'parseWaitForProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const instructions = [];
    const check = `\
if (e[${varKey}] === undefined) {
    nonMatchingProps.push("No property \`" + ${varKey} + "\`");
    continue;
}
computedEntry = e[${varKey}];
if (computedEntry !== ${varValue}) {
    nonMatchingProps.push(${varKey} + ": (\`" + computedEntry + "\` != \`" + ${varValue} + "\`)");
}`;

    const [init, looper] = waitForElement(data['selector'], varName);
    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following properties still don't match: [" + props + "]");`);

    instructions.push(`\
${init}
let nonMatchingProps;
while (true) {
${indentString(looper, 1)}
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const ${varDict} = {${data['propertyDict']['dict']}};
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${indentString(check, 3)}
        }
        return nonMatchingProps;
    }, ${varName});
    if (nonMatchingProps.length === 0) {
        break;
    }
${indentString(incr, 1)}
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
                `found \`${tuple[0].getErrorText()}\` (${tuple[0].getArticleKind()})`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected a string as second tuple element, ' +
                `found \`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }

    let warnings = undefined;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings = [`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`];
    }

    const value = tuple[1].getStringValue();
    const varName = 'parseWaitForText';

    const [init, looper] = waitForElement(selector, varName);
    const incr = incrWait('\
throw new Error("The text still doesn\'t match: `" + computedEntry + "` != `" + value + "`");');

    const instructions = `\
${init}
const value = "${value}";
let computedEntry;
while (true) {
${indentString(looper, 1)}
    computedEntry = await page.evaluate(e => {
        return browserUiTestHelpers.getElemText(e, "${value}");
    }, ${varName});
    if (computedEntry === value) {
        break;
    }
${indentString(incr, 1)}
}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

module.exports = {
    'parseWaitFor': parseWaitFor,
    'parseWaitForAttribute': parseWaitForAttribute,
    'parseWaitForCount': parseWaitForCount,
    'parseWaitForCss': parseWaitForCss,
    'parseWaitForDocumentProperty': parseWaitForDocumentProperty,
    'parseWaitForLocalStorage': parseWaitForLocalStorage,
    'parseWaitForProperty': parseWaitForProperty,
    'parseWaitForText': parseWaitForText,
    'parseWaitForWindowProperty': parseWaitForWindowProperty,
};
