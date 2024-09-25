// Contains "wait-for*" commands.

const { COLOR_CHECK_ERROR } = require('../consts.js');
const {
    indentString,
    fillEnabledChecksV2,
    makeExtendedChecks,
    makeTextExtendedChecks,
    validatePositionDictV2,
    commonPositionCheckCode,
    commonSizeCheckCode,
    generateCheckObjectPaths,
} = require('./utils.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError, plural } = require('../utils.js');

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

function waitForElement(selector, varName, { checkAll = false, revert = false} = {}) {
    const kind = selector.isXPath ? 'XPath' : 'CSS selector';
    const selectorS = selector.isXPath ? `::-p-xpath(${selector.value})` : selector.value;
    let comp = '!==';
    let errorMessage = `\
throw new Error("The ${kind} \\"${selector.value}\\" was not found");`;

    if (revert) {
        comp = '===';
        errorMessage = `\
throw new Error("The ${kind} \\"${selector.value}\\" still exists");`;
    }

    let code = `\
${varName} = await page.$$("${selectorS}");
if (${varName}.length ${comp} 0) {
    break;
}`;
    if (!checkAll) {
        code += `\n${varName} = ${varName}[0];`;
    }
    return getWaitForElems(varName, code, errorMessage);
}

// Possible inputs:
//
// * Number of milliseconds
// * "selector"
function parseWaitFor(parser) {
    const ret = validator(parser, {
        kind: 'selector',
        alternatives: [
            {
                kind: 'number',
                allowFloat: false,
                allowNegative: false,
                allowZero: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const value = ret.value;
    if (value.kind === 'number') {
        return {
            'instructions': [
                `await new Promise(r => setTimeout(r, ${ret.value.value}));`,
            ],
            'wait': false,
        };
    }
    const [init, looper] = waitForElement(value, 'parseWaitFor');
    return {
        'instructions': [init + '\n' + looper],
        'wait': false,
    };
}

// Possible inputs:
//
// * "selector"
function parseWaitForFalse(parser) {
    const ret = validator(parser, {
        kind: 'selector',
    });
    if (hasError(ret)) {
        return ret;
    }

    const value = ret.value;
    const [init, looper] = waitForElement(value, 'parseWaitForFalse', {revert: true});
    return {
        'instructions': [init + '\n' + looper],
        'wait': false,
    };
}

// Possible inputs:
//
// * ("selector", number)
function parseWaitForCount(parser) {
    return parseWaitForCountInner(parser, false);
}

// Possible inputs:
//
// * ("selector", number)
function parseWaitForCountFalse(parser) {
    return parseWaitForCountInner(parser, true);
}

function parseWaitForCountInner(parser, waitFalse) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'number',
                allowFloat: false,
                allowNegative: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const count = tuple[1].value.getRaw();
    const varName = 'parseWaitForCount';
    const selectorS = selector.isXPath ? `::-p-xpath(${selector.value})` : selector.value;
    let comp = '===';
    let errorMessage = `"Still didn't find ${count} ${plural('instance', count)} of \
\\"${selector.value}\\" (found " + ${varName} + ")"`;
    if (waitFalse) {
        comp = '!==';
        errorMessage = `"Still found ${count} ${plural('instance', count)} of \
\\"${selector.value}\\" (found " + ${varName} + ")"`;
    }

    const instructions = getWaitForElems(
        varName,
        `\
${varName} = await page.$$("${selectorS}");
${varName} = ${varName}.length;
if (${varName} ${comp} ${count}) {
    break;
}`,
        `throw new Error(${errorMessage});`,
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
    const ret = validator(parser, {
        kind: 'json',
        keyTypes: {
            string: [],
        },
        allowAllValues: true,
        valueTypes: {
            ident: {
                allowed: ['null'],
            },
        },
    });
    if (hasError(ret)) {
        return ret;
    }

    const json = ret.value.entries;

    const code = [];
    for (const [key, value] of json) {
        if (value.kind === 'ident') {
            code.push(`"${key}": ${value.value}`);
        } else {
            code.push(`"${key}": "${value.parser.getStringValue()}"`);
        }
    }
    if (code.length === 0) {
        return {
            'instructions': [],
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
    const ${varDict} = {
${indentString(code.join(',\n'), 2)}
    };
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
    };
}

function parseWaitForObjectProperty(parser, objName) {
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'NEAR', 'STARTS_WITH'];
    const jsonValidator = {
        kind: 'json',
        keyTypes: {
            string: [],
            'object-path': [],
        },
        allowAllValues: true,
        valueTypes: {
            ident: {
                allowed: ['null'],
            },
        },
    };
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            jsonValidator,
            {
                kind: 'ident',
                allowed: identifiers,
                optional: true,
                alternatives: [
                    {
                        kind: 'array',
                        valueTypes: {
                            'ident': {
                                allowed: identifiers,
                            },
                        },
                    },
                ],
            },
        ],
        alternatives: [
            jsonValidator,
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const value = ret.value;
    // It's safe to do `value.entries` because it's either a json or an array, and both
    // have `entries`.
    let json = value.entries;
    const enabledChecks = new Set();
    const warnings = [];
    if (value.kind === 'tuple') {
        json = value.entries[0].value.entries;
        if (value.entries.length > 1) {
            const checked = fillEnabledChecksV2(
                value.entries[1],
                enabledChecks,
                warnings,
                'second',
            );
            if (checked !== null) {
                return checked;
            }
        }
    }

    const undefProps = [];
    const values = [];
    for (const [key, value] of json) {
        const k_s = value.key.kind === 'object-path' ? key : `["${key}"]`;
        if (value.kind !== 'ident') {
            values.push(`[${k_s},"${value.parser.getStringValue()}"]`);
        } else {
            undefProps.push(k_s);
        }
    }
    // No element to check, we can return empty instructions.
    if (values.length === 0 && undefProps.length === 0) {
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

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks, false, 'errors', `${objName} property`, varName, varKey, varValue);

    if (undefProps.length > 0 && hasSpecialChecks) {
        const k = [...enabledChecks].join(', ');
        warnings.push(`Special checks (${k}) will be ignored for \`null\``);
    }

    const instructions = getWaitForElems(
        varName,
        `\
${varName} = await page.evaluate(() => {
${indentString(generateCheckObjectPaths(), 1)}
    const errors = [];
    const ${varDict} = [${values.join(',')}];
    const undefProps = [${undefProps.join(',')}];
    for (const prop of undefProps) {
        checkObjectPaths(${objName}, prop, val => {
            if (val !== undefined && val !== null) {
                const p = prop.map(p => \`"\${p}"\`).join('.');
                errors.push("Expected property \`" + p + "\` to not exist, found: \`" + val + "\`");
            }
        }, _notFound => {},
        );
    }
    for (const [${varKey}, ${varValue}] of ${varDict}) {
        checkObjectPaths(${objName}, ${varKey}, val => {
            if (val === undefined) {
                const p = ${varKey}.map(p => \`"\${p}"\`).join('.');
                errors.push("${objName} doesn't have a property \`" + p + "\`");
                return;
            }
            const ${varName} = String(val);
${indentString(checks.join('\n'), 3)}
        }, _notFound => {
            const p = ${varKey}.map(p => \`"\${p}"\`).join('.');
            errors.push("${objName} doesn't have a property \`" + p + "\`");
        });
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
// * ("selector", {"CSS property name": "expected CSS property value"})
// * ("selector", {"CSS property name": "expected CSS property value"}, ALL)
function parseWaitForCss(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: [],
                },
                valueTypes: {
                    string: {},
                    number: {
                        allowFloat: true,
                        allowNegative: true,
                    },
                },
            },
            {
                kind: 'ident',
                allowed: ['ALL'],
                optional: true,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const checkAll = tuple.length > 2;
    let needColorCheck = false;
    const keys = [];
    const values = [];

    for (const [key, value] of json) {
        if (key === 'color') {
            needColorCheck = true;
        }
        keys.push(`"${key}"`);
        values.push(`"${value.parser.getStringValue()}"`);
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
    if (needColorCheck) {
        instructions.push(`\
if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`);
    }

    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following CSS properties still don't match: [" + props + "]");`);

    const pseudo = !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '';
    const [init, looper] = waitForElement(selector, varName, {checkAll});
    instructions.push(`\
const { checkCssProperty } = require('command-helpers.js');

async function checkCssForElem(elem) {
    const jsHandle = await elem.evaluateHandle(e => {
        const entries = [${keys.join(',')}];
        const assertComputedStyle = window.getComputedStyle(e${pseudo});
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
    const values = [${values.join(',')}];
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
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector", {"attribute name": "expected attribute value"})
// * ("XPath", {"attribute name": "expected attribute value"})
function parseWaitForAttribute(parser) {
    const identifiers = ['ALL', 'CONTAINS', 'ENDS_WITH', 'NEAR', 'STARTS_WITH'];
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: [],
                },
                valueTypes: {
                    string: {},
                    number: {
                        allowFloat: true,
                        allowNegative: true,
                    },
                    ident: {
                        allowed: ['null'],
                    },
                },
            },
            {
                kind: 'ident',
                allowed: identifiers,
                optional: true,
                alternatives: [
                    {
                        kind: 'array',
                        valueTypes: {
                            'ident': {
                                allowed: identifiers,
                            },
                        },
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const enabledChecks = new Set();
    const warnings = [];

    if (tuple.length > 2) {
        const ret = fillEnabledChecksV2(
            tuple[2], enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const varName = 'parseWaitForAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks, false, 'nonMatchingAttrs', 'attribute', 'attr', varKey, varValue);

    let checker;
    if (!enabledChecks.has('ALL')) {
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

    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    const tests = [];
    const nullAttributes = [];
    for (const [key, value] of json) {
        if (value.kind !== 'ident') {
            tests.push(`"${key}":"${value.value}"`);
        } else {
            nullAttributes.push(`"${key}"`);
        }
    }

    if (nullAttributes.length > 0 && hasSpecialChecks) {
        const k = [...enabledChecks.keys()]
            .filter(k => k !== 'ALL')
            .map(k => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
    }

    const [init, looper] = waitForElement(selector, varName, {checkAll: enabledChecks.has('ALL')});
    const incr = incrWait(`\
const props = nonMatchingAttrs.join(", ");
throw new Error("The following attributes still don't match: [" + props + "]");`);

    const instructions = `\
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
}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("selector", {"property name": "expected property value"})
function parseWaitForProperty(parser) {
    const identifiers = ['ALL', 'CONTAINS', 'ENDS_WITH', 'NEAR', 'STARTS_WITH'];
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: [],
                    'object-path': [],
                },
                valueTypes: {
                    string: {},
                    number: {
                        allowFloat: true,
                        allowNegative: true,
                    },
                    ident: {
                        allowed: ['null'],
                    },
                },
            },
            {
                kind: 'ident',
                allowed: identifiers,
                optional: true,
                alternatives: [
                    {
                        kind: 'array',
                        valueTypes: {
                            'ident': {
                                allowed: identifiers,
                            },
                        },
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const enabledChecks = new Set();
    const warnings = [];

    if (tuple.length > 2) {
        const ret = fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const varName = 'parseWaitForProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks, false, 'nonMatchingProps', 'property', 'val', varKey, varValue);

    let checker;
    if (!enabledChecks.has('ALL')) {
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

    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have properties so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    const tests = [];
    const nullProps = [];
    for (const [key, value] of json) {
        const k_s = value.key.kind === 'object-path' ? key : `["${key}"]`;
        if (value.kind !== 'ident') {
            tests.push(`[${k_s},"${value.parser.getStringValue()}"]`);
        } else {
            nullProps.push(k_s);
        }
    }

    if (nullProps.length > 0 && hasSpecialChecks) {
        const k = [...enabledChecks.keys()]
            .filter(k => k !== 'ALL')
            .map(k => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
    }

    const [init, looper] = waitForElement(selector, varName, {checkAll: enabledChecks.has('ALL')});
    const incr = incrWait(`\
const props = nonMatchingProps.join(", ");
throw new Error("The following properties still don't match: [" + props + "]");`);

    const instructions = `\
async function checkPropForElem(elem) {
    return await elem.evaluate(e => {
${indentString(generateCheckObjectPaths(), 2)}

        const nonMatchingProps = [];
        const ${varDict} = [${tests.join(',')}];
        const nullProps = [${nullProps.join(',')}];
        for (const prop of nullProps) {
            checkObjectPaths(e, prop, val => {
                if (val !== undefined && val !== null) {
                    const p = prop.map(p => \`"\${p}"\`).join('.');
                    nonMatchingProps.push("Expected property \`" + p + "\` to not exist, \
found: \`" + val + "\`");
                    return;
                }
            }, _notFound => {
            });
        }
        for (const [${varKey}, ${varValue}] of ${varDict}) {
            checkObjectPaths(e, ${varKey}, val => {
                if (val === undefined) {
                    const p = ${varKey}.map(p => \`"\${p}"\`).join('.');
                    nonMatchingProps.push("Property \`" + p + "\` doesn't exist");
                    return;
                }
${indentString(checks.join('\n'), 4)}
            }, _notFound => {
                const p = ${varKey}.map(p => \`"\${p}"\`).join('.');
                nonMatchingProps.push("Property \`" + p + "\` doesn't exist");
            });
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
}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("selector", "text")
function parseWaitForText(parser) {
    const identifiers = ['ALL', 'CONTAINS', 'ENDS_WITH', 'STARTS_WITH'];
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'string',
            },
            {
                kind: 'ident',
                allowed: identifiers,
                optional: true,
                alternatives: [
                    {
                        kind: 'array',
                        valueTypes: {
                            'ident': {
                                allowed: identifiers,
                            },
                        },
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;

    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        const ret = fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const value = tuple[1].value.getStringValue();
    const varName = 'parseWaitForText';

    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have inner text so \
the check will be performed on the element itself`);
    }

    const checks = makeTextExtendedChecks(enabledChecks, false);

    let checker;
    if (!enabledChecks.has('ALL')) {
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

    const [init, looper] = waitForElement(selector, varName, {checkAll: enabledChecks.has('ALL')});
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

// Possible inputs:
//
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseWaitForPosition(parser) {
    const identifiers = ['ALL'];
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: ['x', 'y'],
                },
                valueTypes: {
                    number: {
                        allowNegative: true,
                        allowFloat: true,
                    },
                },
            },
            {
                kind: 'ident',
                allowed: identifiers,
                optional: true,
                alternatives: [
                    {
                        kind: 'array',
                        valueTypes: {
                            'ident': {
                                allowed: identifiers,
                            },
                        },
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;

    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        const ret = fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const checks = validatePositionDictV2(tuple[1].value.entries);

    const varName = 'assertPosition';
    const errorsVarName = 'errors';

    const whole = commonPositionCheckCode(
        selector,
        checks,
        enabledChecks.has('ALL'),
        varName,
        errorsVarName,
        false,
    );

    const [init, looper] = waitForElement(selector, varName, {checkAll: enabledChecks.has('ALL')});
    const incr = incrWait(`\
const err = ${errorsVarName}.join(", ");
throw new Error("The following checks still fail: [" + err + "]");`);

    const instructions = `\
${init}
while (true) {
${indentString(looper, 1)}
${indentString(whole, 1)}
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
// Possible inputs:
//
// * ("CSS selector", JSON dict)
// * ("XPath", JSON dict)
function parseWaitForSize(parser) {
    const identifiers = ['ALL'];
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: ['height', 'width'],
                },
                valueTypes: {
                    number: {
                        allowNegative: true,
                        allowFloat: true,
                    },
                },
            },
            {
                kind: 'ident',
                allowed: identifiers,
                optional: true,
                alternatives: [
                    {
                        kind: 'array',
                        valueTypes: {
                            'ident': {
                                allowed: identifiers,
                            },
                        },
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        const ret = fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const varName = 'assertSize';
    const errorsVarName = 'errors';

    const whole = commonSizeCheckCode(
        selector, enabledChecks.has('ALL'), false, json, varName, errorsVarName);

    const [init, looper] = waitForElement(selector, varName, {checkAll: enabledChecks.has('ALL')});
    const incr = incrWait(`\
const err = ${errorsVarName}.join(", ");
throw new Error("The following checks still fail: [" + err + "]");`);

    const instructions = `\
${init}
while (true) {
${indentString(looper, 1)}
${indentString(whole, 1)}
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
    'parseWaitForFalse': parseWaitForFalse,
    'parseWaitForAttribute': parseWaitForAttribute,
    'parseWaitForCount': parseWaitForCount,
    'parseWaitForCountFalse': parseWaitForCountFalse,
    'parseWaitForCss': parseWaitForCss,
    'parseWaitForDocumentProperty': parseWaitForDocumentProperty,
    'parseWaitForLocalStorage': parseWaitForLocalStorage,
    'parseWaitForPosition': parseWaitForPosition,
    'parseWaitForProperty': parseWaitForProperty,
    'parseWaitForText': parseWaitForText,
    'parseWaitForWindowProperty': parseWaitForWindowProperty,
    'parseWaitForSize': parseWaitForSize,
};
