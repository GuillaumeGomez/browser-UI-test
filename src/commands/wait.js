// Contains "wait-for*" commands.

const { COLOR_CHECK_ERROR } = require('../consts.js');
const {
    buildPropertyDict,
    validateJson,
    indentString,
    checkJsonEntry,
    fillEnabledChecks,
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

function waitForElement(selector, varName, checkAll = false) {
    let code;
    let kind;

    if (!checkAll) {
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

    if (selector.isXPath) {
        kind = 'XPath';
        code = `${varName} = await page.$x("${selector.value}");`;
    } else {
        kind = 'CSS selector';
        code = `${varName} = await page.$$("${selector.value}");`;
    }
    code += `
if (${varName}.length !== 0) {
    break;
}`;

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

function waitForChecker(parser, allowExtra) {
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
    if (tuple.length !== 2 && (!allowExtra || tuple.length !== 3)) {
        if (!allowExtra) {
            return {
                'error': 'expected a tuple with a string and a JSON dict, ' +
                    `found \`${parser.getRawArgs()}\``,
            };
        } else {
            return {
                'error': 'invalid number of values in the tuple: expected 2 or 3, found ' +
                    tuple.length,
            };
        }
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
    return {
        'tuple': tuple,
        'json': tuple[1].getRaw(),
        'selector': selector,
    };
}

function waitForInitializer(parser, errorMessage, allowEmptyValues, allowExtra) {
    const checker = waitForChecker(parser, allowExtra);
    if (checker.error !== undefined) {
        return checker;
    }

    const entries = validateJson(checker.json, {'string': [], 'number': []}, errorMessage);
    if (entries.error !== undefined) {
        return entries;
    }

    const propertyDict = buildPropertyDict(entries, errorMessage, allowEmptyValues);
    if (propertyDict.error !== undefined) {
        return propertyDict;
    }

    const selector = checker.selector;
    return {
        'selector': selector,
        'warnings': entries.warnings,
        'pseudo': !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '',
        'propertyDict': propertyDict,
        'tuple': checker.tuple,
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
        return {'error': 'expected JSON or tuple, found nothing'};
    // eslint-disable-next-line no-extra-parens
    } else if (elems.length !== 1 || (elems[0].kind !== 'json' && elems[0].kind !== 'tuple')) {
        return {'error': `expected JSON or tuple, found \`${parser.getRawArgs()}\``};
    }

    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR'];
    const enabled_checks = Object.create(null);
    const warnings = [];
    let json;
    if (elems[0].kind === 'tuple') {
        const tuple = elems[0].getRaw();
        if (tuple.length < 1 || tuple.length > 2) {
            return {
                'error': `expected a tuple of one or two elements, found ${tuple.length} elements`,
            };
        } else if (tuple[0].kind !== 'json') {
            return {
                'error': 'expected first element of the tuple to be a JSON dict, found `' +
                    `${tuple[0].getErrorText()}\` (${tuple[0].getArticleKind()})`,
            };
        }
        json = tuple[0].getRaw();
        if (tuple.length > 1) {
            const ret = fillEnabledChecks(
                tuple[1],
                identifiers,
                enabled_checks,
                warnings,
                'second',
            );
            if (ret !== null) {
                return ret;
            }
        }
    } else {
        json = elems[0].getRaw();
    }

    let error = null;

    const undefProps = [];
    const values = [];
    warnings.push(...checkJsonEntry(json, entry => {
        if (error !== null) {
            return;
        }
        const key_s = entry['key'].getStringValue();
        if (entry['value'].kind === 'ident') {
            const value_s = entry['value'].getStringValue();
            if (value_s !== 'null') {
                error = `Only \`null\` ident is allowed, found \`${value_s}\``;
            }
            undefProps.push(`"${key_s}"`);
        } else {
            const value_s = `"${entry['value'].getStringValue()}"`;
            values.push(`"${key_s}":${value_s}`);
        }
    }));
    if (error !== null) {
        return {'error': error};
    } else if (values.length === 0 && undefProps.length === 0) {
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

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push(`\
if (String(${varName}).indexOf(${varValue}) === -1) {
    errors.push('Property \`' + ${varKey} + '\` (\`' + ${varName} + '\
\`) does not contain \`' + ${varValue} + '\`');
}`);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push(`\
if (!String(${varName}).startsWith(${varValue})) {
    errors.push('Property \`' + ${varKey} + '\` (\`' + ${varName} + '\
\`) does not start with \`' + ${varValue} + '\`');
}`);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push(`\
if (!String(${varName}).endsWith(${varValue})) {
    errors.push('Property \`' + ${varKey} + '\` (\`' + ${varName} + '\
\`) does not end with \`' + ${varValue} + '\`');
}`);
    }
    if (enabled_checks['NEAR']) {
        checks.push(`\
if (Number.isNaN(${varName})) {
    errors.push('Property \`' + ${varKey} + '\` (\`' + ${varName} + '\`) is NaN (for NEAR check)');
} else if (Math.abs(${varName} - ${varValue}) > 1) {
    errors.push('Property \`' + ${varKey} + '\` (\`' + ${varName} + '\
\`) is not within 1 of \`' + ${varValue} + '\` (for NEAR check)');
}`);
    }

    const hasSpecialChecks = checks.length !== 0;
    // If no check was enabled.
    if (checks.length === 0) {
        checks.push(`\
if (String(${varName}) != ${varValue}) {
    errors.push("${objName} item \\"" + ${varKey} + "\\" (of value \\"" + ${varValue} + \
"\\") != \\"" + ${varName} + "\\"");
}`);
    }
    if (undefProps.length > 0 && hasSpecialChecks) {
        const k = Object.entries(enabled_checks).map(([k, _]) => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
    }

    const instructions = getWaitForElems(
        varName,
        `\
${varName} = await page.evaluate(() => {
    const errors = [];
    const ${varDict} = {${values.join(',')}};
    const undefProps = [${undefProps.join(',')}];
    for (const prop of undefProps) {
        if (${objName}[prop] !== undefined && ${objName}[prop] !== null) {
            errors.push("Expected property \`" + prop + "\` to not exist, found: \
\`" + ${objName}[prop] + "\`");
            continue;
        }
    }
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        if (${objName}[${varKey}] === undefined) {
            errors.push("${objName} doesn't have a property named \`" + ${varKey} + "\`");
        }
        const ${varName} = ${objName}[${varKey}];
${indentString(checks.join('\n'), 2)}
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
// * ("CSS selector", {"CSS property name": "expected CSS property value"}, ALL)
// * ("XPath", {"CSS property name": "expected CSS property value"}, ALL)
function parseWaitForCss(parser) {
    const data = waitForInitializer(parser, 'CSS property', false, true);
    let checkAll = false;
    if (data.error !== undefined) {
        return data;
    } else if (data.tuple.length === 3) {
        if (data.tuple[2].kind !== 'ident') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${data.tuple[2].getRaw()}\``,
            };
        } else if (data.tuple[2].getRaw() !== 'ALL') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${data.tuple[2].getRaw()}\``,
            };
        }
        checkAll = true;
    }

    const varName = 'parseWaitForCss';

    let checker;
    if (!checkAll) {
        checker = `const nonMatchingProps = await checkCssForElem(${varName});`;
    } else {
        checker = `\
let nonMatchingProps = [];
for (const elem of ${varName}) {
    const ret = await checkCssForElem(elem);
    if (ret.length !== 0) {
        nonMatchingProps = ret;
        break;
    }
}`;
    }

    const instructions = [];
    const propertyDict = data['propertyDict'];
    if (propertyDict['needColorCheck']) {
        instructions.push(`\
if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`);
    }

    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following CSS properties still don't match: [" + props + "]");`);

    const [init, looper] = waitForElement(data['selector'], varName, checkAll);
    instructions.push(`\
const { checkCssProperty } = require('command-helpers.js');

async function checkCssForElem(elem) {
    const jsHandle = await elem.evaluateHandle(e => {
        const entries = [${propertyDict['keys'].join(',')}];
        const assertComputedStyle = window.getComputedStyle(e${data['pseudo']});
        const simple = [];
        const computed = [];
        const keys = [];

        for (const entry of entries) {
            simple.push(e.style[entry]);
            computed.push(assertComputedStyle[entry]);
            keys.push(entry);
        }
        return [keys, simple, computed];
    });
    const [keys, simple, computed] = await jsHandle.jsonValue();
    const values = [${propertyDict['values'].join(',')}];
    const nonMatchingProps = [];

    for (const [i, key] of keys.entries()) {
        const localErr = [];
        checkCssProperty(key, values[i], simple[i], computed[i], localErr);
        nonMatchingProps.push(...localErr);
    }
    return nonMatchingProps;
}

${init}
while (true) {
${indentString(looper, 1)}
${indentString(checker, 1)}
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
    const waitChecker = waitForChecker(parser, true);
    if (waitChecker.error !== undefined) {
        return waitChecker;
    }

    const entries = validateJson(
        waitChecker.json, {'string': [], 'number': [], 'ident': ['null']}, 'attribute');
    if (entries.error !== undefined) {
        return entries;
    }

    const warnings = entries.warnings !== undefined ? entries.warnings : [];
    const enabled_checks = Object.create(null);

    if (waitChecker.tuple.length === 3) {
        const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
        const ret = fillEnabledChecks(
            waitChecker.tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const varName = 'parseWaitForAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const instructions = [];
    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push(`\
if (attr.indexOf(${varValue}) === -1) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't contain \`"\
 + ${varValue} + "\` (for CONTAINS check)");
}`);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push(`\
if (!attr.startsWith(${varValue})) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't start with \
\`" + ${varValue} + "\` (for STARTS_WITH check)");
}`);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push(`\
if (!attr.endsWith(${varValue})) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't end with \`"\
 + ${varValue} + "\`");
}`);
    }
    if (enabled_checks['NEAR']) {
        checks.push(`\
if (Number.isNaN(attr)) {
    nonMatchingAttrs.push('attribute \`' + ${varKey} + '\` (\`' + attr + '\
\`) is NaN (for NEAR check)');
} else if (Math.abs(attr - ${varValue}) > 1) {
    nonMatchingAttrs.push('attribute \`' + ${varKey} + '\` (\`' + attr + '\
\`) is not within 1 of \`' + ${varValue} + '\` (for NEAR check)');
}`);
    }
    // eslint-disable-next-line no-extra-parens
    const hasSpecialChecks = (enabled_checks['ALL'] && checks.length > 1) || checks.length !== 0;
    if (checks.length === 0) {
        checks.push(`\
if (attr !== ${varValue}) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` isn't equal to \`" + ${varValue} + "\` \
(\`" + attr + "\`)");
}`);
    }

    let checker;
    if (!enabled_checks['ALL']) {
        checker = `const nonMatchingAttrs = await checkAttrForElem(${varName});`;
    } else {
        checker = `\
let nonMatchingAttrs = [];
for (const elem of ${varName}) {
    const ret = await checkAttrForElem(elem);
    if (ret.length !== 0) {
        nonMatchingAttrs = ret;
        break;
    }
}`;
    }

    const selector = waitChecker.selector;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    const tests = [];
    const nullAttributes = [];
    for (const [k, v] of Object.entries(entries.values)) {
        if (v.kind !== 'ident') {
            tests.push(`"${k}":"${v.value}"`);
        } else {
            nullAttributes.push(`"${k}"`);
        }
    }

    if (nullAttributes.length > 0 && hasSpecialChecks) {
        const k = Object.entries(enabled_checks)
            .filter(([k, v]) => v && k !== 'ALL')
            .map(([k, _]) => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
    }

    const [init, looper] = waitForElement(selector, varName, enabled_checks['ALL']);
    const incr = incrWait(`\
const props = nonMatchingAttrs.join(", ");
throw new Error("The following attributes still don't match: [" + props + "]");`);

    instructions.push(`\
async function checkAttrForElem(elem) {
    return await elem.evaluate(e => {
        const nonMatchingAttrs = [];
        const ${varDict} = {${tests.join(',')}};
        const nullAttributes = [${nullAttributes.join(',')}];
        for (const ${varKey} of nullAttributes) {
            if (e.hasAttribute(${varKey})) {
                const attr = e.getAttribute(${varKey});
                nonMatchingAttrs.push("Expected \`null\` for attribute \`" + ${varKey} + "\`, \
found: \`" + attr + "\`");
                continue;
            }
        }
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
            if (!e.hasAttribute(${varKey})) {
                nonMatchingAttrs.push("Attribute named \`" + ${varKey} + "\` doesn't exist");
                continue;
            }
            const attr = e.getAttribute(${varKey});
${indentString(checks.join('\n'), 3)}
        }
        return nonMatchingAttrs;
    });
}

${init}
while (true) {
${indentString(looper, 1)}
${indentString(checker, 1)}
    if (nonMatchingAttrs.length === 0) {
        break;
    }
${indentString(incr, 1)}
}`);

    return {
        'instructions': instructions,
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector", {"property name": "expected property value"})
// * ("XPath", {"property name": "expected property value"})
function parseWaitForProperty(parser) {
    const waitChecker = waitForChecker(parser, true);
    if (waitChecker.error !== undefined) {
        return waitChecker;
    }

    const entries = validateJson(
        waitChecker.json, {'string': [], 'number': [], 'ident': ['null']}, 'property');
    if (entries.error !== undefined) {
        return entries;
    }

    const warnings = entries.warnings !== undefined ? entries.warnings : [];
    const enabled_checks = Object.create(null);

    if (waitChecker.tuple.length === 3) {
        const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
        const ret = fillEnabledChecks(
            waitChecker.tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const varName = 'parseWaitForProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const instructions = [];
    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push(`\
if (prop.indexOf(${varValue}) === -1) {
    nonMatchingProps.push("property \`" + ${varKey} + "\` (\`" + prop + "\`) doesn't contain \`"\
 + ${varValue} + "\` (for CONTAINS check)");
}`);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push(`\
if (!prop.startsWith(${varValue})) {
    nonMatchingProps.push("property \`" + ${varKey} + "\` (\`" + prop + "\`) doesn't start with \
\`" + ${varValue} + "\` (for STARTS_WITH check)");
}`);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push(`\
if (!prop.endsWith(${varValue})) {
    nonMatchingProps.push("property \`" + ${varKey} + "\` (\`" + prop + "\`) doesn't end with \`"\
 + ${varValue} + "\`");
}`);
    }
    if (enabled_checks['NEAR']) {
        checks.push(`\
if (Number.isNaN(prop)) {
    nonMatchingProps.push('property \`' + ${varKey} + '\` (\`' + prop + '\
\`) is NaN (for NEAR check)');
} else if (Math.abs(prop - ${varValue}) > 1) {
    nonMatchingProps.push('property \`' + ${varKey} + '\` (\`' + prop + '\
\`) is not within 1 of \`' + ${varValue} + '\` (for NEAR check)');
}`);
    }
    // eslint-disable-next-line no-extra-parens
    const hasSpecialChecks = (enabled_checks['ALL'] && checks.length > 1) || checks.length !== 0;
    if (checks.length === 0) {
        checks.push(`\
if (prop !== ${varValue}) {
    nonMatchingProps.push("property \`" + ${varKey} + "\` isn't equal to \`" + ${varValue} + "\` \
(\`" + prop + "\`)");
}`);
    }

    let checker;
    if (!enabled_checks['ALL']) {
        checker = `const nonMatchingProps = await checkPropForElem(${varName});`;
    } else {
        checker = `\
let nonMatchingProps = [];
for (const elem of ${varName}) {
    const ret = await checkPropForElem(elem);
    if (ret.length !== 0) {
        nonMatchingProps = ret;
        break;
    }
}`;
    }

    const selector = waitChecker.selector;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have properties so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    const tests = [];
    const nullProps = [];
    for (const [k, v] of Object.entries(entries.values)) {
        if (v.kind !== 'ident') {
            tests.push(`"${k}":"${v.value}"`);
        } else {
            nullProps.push(`"${k}"`);
        }
    }

    if (nullProps.length > 0 && hasSpecialChecks) {
        const k = Object.entries(enabled_checks)
            .filter(([k, v]) => v && k !== 'ALL')
            .map(([k, _]) => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
    }

    const [init, looper] = waitForElement(selector, varName, enabled_checks['ALL']);
    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following properties still don't match: [" + props + "]");`);

    instructions.push(`\
async function checkPropForElem(elem) {
    return await elem.evaluate(e => {
        const nonMatchingProps = [];
        const ${varDict} = {${tests.join(',')}};
        const nullProps = [${nullProps.join(',')}];
        for (const ${varKey} of nullProps) {
            if (e[${varKey}] !== undefined && e[${varKey}] !== null) {
                const prop = e[${varKey}];
                nonMatchingProps.push("Expected property \`" + ${varKey} + "\` to not exist, \
found: \`" + prop + "\`");
                continue;
            }
        }
        for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
            if (e[${varKey}] === undefined || e[${varKey}] === null) {
                nonMatchingProps.push("Property named \`" + ${varKey} + "\` doesn't exist");
                continue;
            }
            const prop = e[${varKey}];
${indentString(checks.join('\n'), 3)}
        }
        return nonMatchingProps;
    });
}

${init}
while (true) {
${indentString(looper, 1)}
${indentString(checker, 1)}
    if (nonMatchingProps.length === 0) {
        break;
    }
${indentString(incr, 1)}
}`);

    return {
        'instructions': instructions,
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector", "text")
// * ("XPath", "text")
function parseWaitForText(parser) {
    const elems = parser.elems;
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH'];
    const warnings = [];
    const enabled_checks = Object.create(null);

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
    if (tuple.length < 2 || tuple.length > 3) {
        return {
            'error': `expected a tuple of 2 or 3 elements, found \`${tuple.length}\``,
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
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const value = tuple[1].getStringValue();
    const varName = 'parseWaitForText';

    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have inner text so \
the check will be performed on the element itself`);
    }

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push(`\
if (!elemText.includes(value)) {
    errors.push("\`" + elemText + "\` doesn't contain \`" + value + "\` (for CONTAINS check)");
}`);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push(`\
if (!elemText.startsWith(value)) {
    errors.push("\`" + elemText + "\` doesn't start with \`" + value + "\` (for STARTS_WITH \
check)");
}`);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push(`\
if (!elemText.endsWith(value)) {
    errors.push("\`" + elemText + "\` doesn't end with \`" + value + "\` (for ENDS_WITH check)");
}`);
    }
    if (checks.length === 0) {
        checks.push(`\
if (elemText !== value) {
    errors.push("\`" + elemText + "\` isn't equal to \`" + value + "\`");
}`);
    }

    let checker;
    if (!enabled_checks['ALL']) {
        checker = `const errors = await checkTextForElem(${varName});`;
    } else {
        checker = `\
let errors = [];
for (const elem of ${varName}) {
    errors = await checkTextForElem(elem);
    if (errors.length !== 0) {
        break;
    }
}`;
    }

    const [init, looper] = waitForElement(selector, varName, enabled_checks['ALL'] === true);
    const incr = incrWait(`\
const err = errors.join(", ");
throw new Error("The following checks still fail: [" + err + "]");`);

    const instructions = `\
${init}
async function checkTextForElem(elem) {
    return await elem.evaluate(e => {
        const value = "${value}";
        const elemText = browserUiTestHelpers.getElemText(e, value);
        const errors = [];
${indentString(checks.join('\n'), 2)}
        return errors;
    });
}
const value = "${value}";
while (true) {
${indentString(looper, 1)}
${indentString(checker, 1)}
    if (errors.length === 0) {
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
