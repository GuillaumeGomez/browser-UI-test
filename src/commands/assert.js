// All `assert*` commands.

// FIXME: rename this `utils.js` into `command_utils.js`.
const {
    fillEnabledChecksV2,
    getAndSetElements,
    getInsertStrings,
    indentString,
    makeExtendedChecks,
    makeTextExtendedChecks,
    validatePositionDictV2,
    commonPositionCheckCode,
    commonSizeCheckCode,
} = require('./utils.js');
const { COLOR_CHECK_ERROR } = require('../consts.js');
const { cleanString } = require('../parser.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

function parseAssertCssInner(parser, assertFalse) {
    const jsonValidator = {
        kind: 'json',
        allowEmptyValues: false,
        keyTypes: {
            'string': [],
        },
        valueTypes: {
            'string': {},
            'number': {
                allowNegative: true,
                allowFloat: true,
            },
        },
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                jsonValidator,
                {
                    kind: 'ident',
                    allowed: ['ALL'],
                    optional: true,
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const checkAllElements = tuple.length > 2;
    const propertyDict = tuple[1].value.entries;
    const selector = tuple[0].value;

    const xpath = selector.isXPath ? 'XPath ' : 'selector ';
    const pseudo = !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '';

    const varName = 'parseAssertElemCss';
    const varDict = varName + 'Dict';

    let extra;
    if (checkAllElements) {
        extra = `\
for (const elem of ${varName}) {
    await checkElem(elem);
}`;
    } else {
        extra = `await checkElem(${varName});`;
    }
    let assertCheck;
    if (assertFalse) {
        assertCheck = `\
if (localErr.length === 0) {
    nonMatchingProps.push("assert didn't fail for key \`" + key + '\`');
}`;
    } else {
        assertCheck = 'nonMatchingProps.push(...localErr);';
    }

    const instructions = [];
    if (propertyDict.has('color')) {
        instructions.push(`\
if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`);
    }

    let keys = '';
    let values = '';
    for (const [key, value] of propertyDict) {
        if (keys.length !== 0) {
            keys += ',';
            values += ',';
        }
        keys += `"${key}"`;
        values += `"${value.value}"`;
    }

    instructions.push(`\
const { checkCssProperty } = require('command-helpers.js');

async function checkElem(elem) {
    const nonMatchingProps = [];
    const jsHandle = await elem.evaluateHandle(e => {
        const ${varDict} = [${keys}];
        const assertComputedStyle = window.getComputedStyle(e${pseudo});
        const simple = [];
        const computed = [];
        const keys = [];

        for (const entry of ${varDict}) {
            simple.push(e.style[entry]);
            computed.push(assertComputedStyle[entry]);
            keys.push(entry);
        }
        return [keys, simple, computed];
    });
    const [keys, simple, computed] = await jsHandle.jsonValue();
    const values = [${values}];

    for (const [i, key] of keys.entries()) {
        const localErr = [];
        checkCssProperty(key, values[i], simple[i], computed[i], localErr);
${indentString(assertCheck, 3)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join("; ");
        throw "The following errors happened (for ${xpath}\`${selector.value}\`): [" + props + "]";
    }
}
${getAndSetElements(selector, varName, checkAllElements)}
${extra}`);
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", {"css property": "value"})
// * ("XPath", {"css property": "value"})
// * ("CSS", {"css property": "value"}, ALL)
// * ("XPath", {"css property": "value"}, ALL)
function parseAssertCss(parser) {
    return parseAssertCssInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", {"css property": "value"})
// * ("XPath", {"css property": "value"})
// * ("CSS", {"css property": "value"}, ALL)
// * ("XPath", {"css property": "value"}, ALL)
function parseAssertCssFalse(parser) {
    return parseAssertCssInner(parser, true);
}

function parseAssertObjPropertyInner(parser, assertFalse, objName) {
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR'];
    const jsonValidator = {
        kind: 'json',
        keyTypes: {
            'string': [],
        },
        valueTypes: {
            'string': {},
            'number': {
                allowNegative: true,
                allowFloat: true,
            },
            'ident': {
                allowed: ['null'],
            },
        },
    };
    const ret = validator(parser,
        {
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
            alternatives: [jsonValidator],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const enabledChecks = new Set();
    const warnings = [];
    let json_dict;

    if (ret.kind === 'json') {
        json_dict = ret.value.entries;
    } else {
        const tuple = ret.value.entries;
        json_dict = tuple[0].value.entries;
        if (tuple.length > 1) {
            const ret = fillEnabledChecksV2(
                tuple[1],
                enabledChecks,
                warnings,
                'second',
            );
            if (ret !== null) {
                return ret;
            }
        }
    }

    if (json_dict.size === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': warnings.length > 0 ? warnings : undefined,
            'checkResult': true,
        };
    }

    const varName = 'parseAssertDictProp';

    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';
    // JSON.stringify produces a problematic output so instead we use this.
    const values = [];
    const undefProps = [];
    for (const [k, v] of json_dict) {
        if (v.kind !== 'ident') {
            values.push(`"${k}":"${v.value}"`);
        } else {
            undefProps.push(`"${k}"`);
        }
    }
    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks,
        assertFalse,
        'nonMatchingProps',
        `${objName} property`,
        varName,
        varKey,
        varValue,
    );

    if (undefProps.length > 0 && hasSpecialChecks) {
        const k = [...enabledChecks].join(', ');
        warnings.push(`Special checks (${k}) will be ignored for \`null\``);
    }

    let err = '';
    let unexpectedPropError = '';
    let expectedPropError = '';
    if (!assertFalse) {
        err = '\n';
        err += indentString(`nonMatchingProps.push('Unknown ${objName} property \`' + ${varKey} + \
'\`');`, 3);
        unexpectedPropError = `
            nonMatchingProps.push("Expected property \`" + prop + "\` to not exist, found: \
\`" + ${objName}[prop] + "\`");`;
    } else {
        expectedPropError = `
        nonMatchingProps.push("Property named \`" + prop + "\` doesn't exist");`;
    }

    const instructions = [`\
await page.evaluate(() => {
    const nonMatchingProps = [];
    const ${varDict} = {${values.join(',')}};
    const undefProps = [${undefProps.join(',')}];
    for (const prop of undefProps) {
        if (${objName}[prop] !== undefined && ${objName}[prop] !== null) {${unexpectedPropError}
            continue;
        }${expectedPropError}
    }
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        if (${objName}[${varKey}] === undefined) {${err}
            continue;
        }
        const ${varName} = String(${objName}[${varKey}]);
${indentString(checks.join('\n'), 2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join("; ");
        throw "The following errors happened: [" + props + "]";
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
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH|NEAR)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH|NEAR])
function parseAssertDocumentProperty(parser) {
    return parseAssertObjPropertyInner(parser, false, 'document');
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH|NEAR)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH|NEAR])
function parseAssertDocumentPropertyFalse(parser) {
    return parseAssertObjPropertyInner(parser, true, 'document');
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH|NEAR)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH|NEAR])
function parseAssertWindowProperty(parser) {
    return parseAssertObjPropertyInner(parser, false, 'window');
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH|NEAR)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH|NEAR])
function parseAssertWindowPropertyFalse(parser) {
    return parseAssertObjPropertyInner(parser, true, 'window');
}

function parseAssertPropertyInner(parser, assertFalse) {
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR', 'ALL'];
    const jsonValidator = {
        kind: 'json',
        keyTypes: {
            'string': [],
            'object-path': [],
        },
        valueTypes: {
            'string': {},
            'number': {
                allowNegative: true,
                allowFloat: true,
            },
            'ident': {
                allowed: ['null'],
            },
        },
    };
    const selectorValidator = { kind: 'selector' };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                selectorValidator,
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
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
    }

    const selector = tuple[0].value;
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks,
        assertFalse,
        'nonMatchingProps',
        'property',
        'prop',
        `${varKey}.map(p => \`"\${p}"\`).join('.')`,
        varValue,
    );

    const json = tuple[1].value.entries;

    const props = [];
    const undefProps = [];
    for (const [k, v] of json) {
        const k_s = v.key.kind === 'object-path' ? k : `["${k}"]`;
        if (v.kind !== 'ident') {
            props.push(`[${k_s},"${v.value}"]`);
        } else {
            undefProps.push(k_s);
        }
    }

    if (props.length + undefProps.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have properties so \
the check will be performed on the element itself`);
    }

    if (undefProps.length > 0 && hasSpecialChecks) {
        const k = [...enabledChecks].filter(k => k !== 'ALL').join(', ');
        warnings.push(`Special checks (${k}) will be ignored for \`null\``);
    }

    let expectedPropError = '';
    let unexpectedPropError = '';
    let unknown = '';
    if (!assertFalse) {
        unknown = `\
const p = ${varKey}.map(p => \`"\${p}"\`).join('.');
nonMatchingProps.push('Unknown property \`' + ${varKey} + '\`');
`;
        unexpectedPropError = `\
const p = prop.map(p => \`"\${p}"\`).join('.');
nonMatchingProps.push("Expected property \`" + p + "\` to not exist, found: \`" + val + "\`");`;

    } else {
        expectedPropError = `
const p = prop.map(p => \`"\${p}"\`).join('.');
nonMatchingProps.push("Property named \`" + p + "\` doesn't exist");`;
    }

    const checkAllElements = enabledChecks.has('ALL') === true;
    const indent = checkAllElements ? 1 : 0;
    let whole = getAndSetElements(selector, varName, checkAllElements) + '\n';
    if (checkAllElements) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
    }
    whole += indentString(`\
await page.evaluate(e => {
    function checkObjectPaths(object, path, callback, notFoundCallback) {
        const found = [];

        for (const subPath of path) {
            found.push(subPath);
            if (object === undefined || object === null) {
                notFoundCallback(found);
                return;
            }
            object = object[subPath];
        }
        callback(object);
    }

    const nonMatchingProps = [];
    const ${varDict} = [${props.join(',')}];
    const undefProps = [${undefProps.join(',')}];
    for (const prop of undefProps) {
        checkObjectPaths(e, prop, val => {
            if (val !== undefined && val !== null) {
${indentString(unexpectedPropError, 4)}
                return;
            }
${indentString(expectedPropError, 3)}
        }, prop => {
${indentString(expectedPropError, 3)}
        });
    }
    for (const [${varKey}, ${varValue}] of ${varDict}) {
        checkObjectPaths(e, ${varKey}, val => {
            if (val === undefined && val === null) {${indentString(unknown, 4)}
                return;
            }
            const prop = String(val);
${indentString(checks.join('\n'), 3)}
        }, ${varKey} => {
${indentString(unknown, 3)}});
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join("; ");
        throw "The following errors happened (for ${xpath}\`${selector.value}\`): [" + props + "]";
    }
`, indent);
    if (checkAllElements) {
        whole += `    }, ${varName}[i]);
}`;
    } else {
        whole += `}, ${varName});`;
    }
    return {
        'instructions': [whole],
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", {"DOM property": "value"})
// * ("XPath", {"DOM property": "value"})
// * ("CSS", {"DOM property": "value"}, IDENT)
// * ("XPath", {"DOM property": "value"}, IDENT)
// * ("CSS", {"DOM property": "value"}, [IDENT])
// * ("XPath", {"DOM property": "value"}, [IDENT})
function parseAssertProperty(parser) {
    return parseAssertPropertyInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", {"DOM property": "value"})
// * ("XPath", {"DOM property": "value"})
// * ("CSS", {"DOM property": "value"}, IDENT)
// * ("XPath", {"DOM property": "value"}, IDENT)
// * ("CSS", {"DOM property": "value"}, [IDENT])
// * ("XPath", {"DOM property": "value"}, [IDENT})
function parseAssertPropertyFalse(parser) {
    return parseAssertPropertyInner(parser, true);
}

function parseAssertAttributeInner(parser, assertFalse) {
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR', 'ALL'];
    const jsonValidator = {
        kind: 'json',
        keyTypes: {
            'string': [],
        },
        valueTypes: {
            'string': {},
            'number': {
                allowNegative: true,
                allowFloat: true,
            },
            'ident': {
                allowed: ['null'],
            },
        },
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
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
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
    }

    const selector = tuple[0].value;
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Attribute';
    const varValue = varName + 'Value';

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks, assertFalse, 'nonMatchingAttrs', 'attribute', 'attr', varKey, varValue);

    const json = tuple[1].value.entries;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    const tests = [];
    const nullAttributes = [];
    for (const [k, v] of json) {
        if (v.kind !== 'ident') {
            tests.push(`"${k}":"${v.value}"`);
        } else {
            nullAttributes.push(`"${k}"`);
        }
    }

    if (nullAttributes.length > 0 && hasSpecialChecks) {
        const k = [...enabledChecks].filter(k => k !== 'ALL').join(', ');
        warnings.push(`Special checks (${k}) will be ignored for \`null\``);
    }

    let noAttrError = '';
    let unexpectedAttrError = '';
    let expectedAttrError = '';
    if (!assertFalse) {
        noAttrError = `
        nonMatchingAttrs.push("No attribute named \`" + ${varKey} + "\`");`;
        unexpectedAttrError = `
        nonMatchingAttrs.push("Expected attribute \`" + attr + "\` to not exist, found: \`" + \
e.getAttribute(attr) + "\`");`;
    } else {
        expectedAttrError = `
    nonMatchingAttrs.push("Attribute named \`" + attr + "\` doesn't exist");`;
    }

    const code = `const nonMatchingAttrs = [];
const ${varDict} = {${tests.join(',')}};
const nullAttributes = [${nullAttributes.join(',')}];
for (const attr of nullAttributes) {
    if (e.hasAttribute(attr)) {${unexpectedAttrError}
        continue;
    }${expectedAttrError}
}
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
    if (!e.hasAttribute(${varKey})) {${noAttrError}
        continue;
    }
    const attr = e.getAttribute(${varKey});
${indentString(checks.join('\n'), 1)}
}
if (nonMatchingAttrs.length !== 0) {
    const props = nonMatchingAttrs.join("; ");
    throw "The following errors happened (for ${xpath}\`${selector.value}\`): [" + props + "]";
}`;

    let instructions;
    if (enabledChecks.has('ALL')) {
        instructions = `\
${getAndSetElements(selector, varName, true)}
for (let i = 0, len = ${varName}.length; i < len; ++i) {
    await page.evaluate(e => {
${indentString(code, 2)}
    }, ${varName}[i]);
}`;
    } else {
        instructions = `\
${getAndSetElements(selector, varName, false)}
await page.evaluate(e => {
${indentString(code, 1)}
}, ${varName});`;
    }
    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", {"attribute name": "value"})
// * ("XPath", {"attribute name": "value"})
// * ("CSS", {"attribute name": "value"}, IDENT)
// * ("XPath", {"attribute name": "value"}, IDENT)
// * ("CSS", {"attribute name": "value"}, [IDENT])
// * ("XPath", {"attribute name": "value"}, [IDENT])
function parseAssertAttribute(parser) {
    return parseAssertAttributeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", {"attribute name": "value"})
// * ("XPath", {"attribute name": "value"})
// * ("CSS", {"attribute name": "value"}, IDENT)
// * ("XPath", {"attribute name": "value"}, IDENT)
// * ("CSS", {"attribute name": "value"}, [IDENT])
// * ("XPath", {"attribute name": "value"}, [IDENT])
function parseAssertAttributeFalse(parser) {
    return parseAssertAttributeInner(parser, true);
}

function parseAssertCountInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                {
                    kind: 'number',
                    allowFloat: false,
                    allowNegative: false,
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;

    const selector = tuple[0].value;
    const occurences = tuple[1].value.getRaw();

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);
    const varName = 'parseAssertElemCount';
    let start;
    if (selector.isXPath) {
        start = `let ${varName} = await page.$x("${selector.value}");\n`;
    } else {
        start = `let ${varName} = await page.$$("${selector.value}");\n`;
    }
    start += `${varName} = ${varName}.length;\n`;
    return {
        'instructions': [
            start +
            // TODO: maybe check differently depending on the tag kind?
            `${insertBefore}if (${varName} !== ${occurences}) {\n` +
            `throw 'expected ${occurences} elements, found ' + ${varName};\n` +
            `}${insertAfter}`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS", number of occurences [integer])
// * ("XPath", number of occurences [integer])
function parseAssertCount(parser) {
    return parseAssertCountInner(parser, false);
}

// Possible inputs:
//
// * ("CSS", number of occurences [integer])
// * ("XPath", number of occurences [integer])
function parseAssertCountFalse(parser) {
    return parseAssertCountInner(parser, true);
}

function parseAssertTextInner(parser, assertFalse) {
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR', 'ALL'];
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'string' },
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
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
    }

    const selector = tuple[0].value;
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have text so \
the check will be performed on the element itself`);
    }

    const varName = 'parseAssertElemStr';

    const checks = makeTextExtendedChecks(enabledChecks, assertFalse);

    let checker;
    if (enabledChecks.has('ALL')) {
        checker = `\
for (const elem of ${varName}) {
    await checkTextForElem(elem);
}`;
    } else {
        checker = `await checkTextForElem(${varName});`;
    }

    const instructions = `\
async function checkTextForElem(elem) {
    await elem.evaluate(e => {
        const errors = [];
        const value = ${tuple[1].value.displayInCode()};
        const elemText = browserUiTestHelpers.getElemText(e, value);
${indentString(checks.join('\n'), 2)}
        if (errors.length !== 0) {
            const errs = errors.join("; ");
            throw "The following errors happened: [" + errs + "]";
        }
    });
}

${getAndSetElements(selector, varName, enabledChecks.has('ALL'))}
${checker}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'checkResult': true,
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector", text [STRING])
// * ("XPath", text [STRING])
// * ("CSS selector", text [STRING], ALL)
// * ("XPath", text [STRING], ALL)
function parseAssertText(parser) {
    return parseAssertTextInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector", text [STRING])
// * ("XPath", text [STRING])
// * ("CSS selector", text [STRING], ALL)
// * ("XPath", text [STRING], ALL)
function parseAssertTextFalse(parser) {
    return parseAssertTextInner(parser, true);
}

function parseAssertInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                {
                    kind: 'boolean',
                    alternatives: [
                        { kind: 'selector' },
                    ],
                },
            ],
            alternatives: [
                { kind: 'boolean' },
                { kind: 'selector' },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    let value = ret.value;
    if (ret.kind === 'tuple') {
        value = value.entries[0].value;
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    if (value.kind === 'boolean') {
        return {
            'instructions': [`\
function compareArrayLike(t1, t2) {
    if (t1.length !== t2.length) {
        return false;
    }
    for (const [index, value] of t1.entries()) {
        if (value !== t2[index]) {
            return false;
        }
    }
    return true;
}
function compareJson(j1, j2) {
    for (const key of Object.keys(j1)) {
        if (j2[key] !== j1[key]) {
            return false;
        }
    }
    for (const key of Object.keys(j2)) {
        if (j2[key] !== j1[key]) {
            return false;
        }
    }
    return true;
}

const check = ${value.value};
${insertBefore}if (!check) {
    throw "Condition \`${cleanString(value.getRaw())}\` was evaluated as false";
}${insertAfter}`],
            'wait': false,
            'checkResult': true,
        };
    }

    let instructions;
    if (value.isXPath) {
        instructions = [
            `${insertBefore}if ((await page.$x("${value.value}")).length === 0) { ` +
            `throw 'XPath "${value.value}" not found'; }${insertAfter}`,
        ];
    } else {
        instructions = [
            `${insertBefore}if ((await page.$("${value.value}")) === null) { ` +
            `throw '"${value.value}" not found'; }${insertAfter}`,
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * "CSS selector"
// * "XPath"
// * boolean
// * ("CSS selector")
// * ("XPath")
// * (boolean)
function parseAssert(parser) {
    return parseAssertInner(parser, false);
}

// Possible inputs:
//
// * "CSS selector"
// * "XPath"
// * boolean
// * ("CSS selector")
// * ("XPath")
// * (boolean)
function parseAssertFalse(parser) {
    return parseAssertInner(parser, true);
}

function parseAssertPositionInner(parser, assertFalse) {
    const jsonValidator = {
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
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                jsonValidator,
                {
                    kind: 'ident',
                    allowed: ['ALL'],
                    optional: true,
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
    }

    const selector = tuple[0].value;
    const checks = validatePositionDictV2(tuple[1].value.entries);
    const errorsVarName = 'errors';
    const varName = 'assertPosition';

    const whole = `\
${getAndSetElements(selector, varName, enabledChecks.has('ALL'))}
${commonPositionCheckCode(
        selector, checks, enabledChecks.has('ALL'), varName, errorsVarName, assertFalse,
    )}
if (${errorsVarName}.length > 0) {
    throw "The following errors happened: [" + ${errorsVarName}.join("; ") + "]";
}`;

    return {
        'instructions': [whole],
        'warnings': warnings,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"X" | "Y": integer})
// * ("CSS selector" | "XPath", {"X" | "Y": integer}, ALL)
function parseAssertPosition(parser) {
    return parseAssertPositionInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"X" | "Y": integer})
// * ("CSS selector" | "XPath", {"X" | "Y": integer}, ALL)
function parseAssertPositionFalse(parser) {
    return parseAssertPositionInner(parser, true);
}

function parseAssertLocalStorageInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'json',
            keyTypes: {
                'string': [],
            },
            valueTypes: {
                'string': {},
                'number': {
                    allowNegative: true,
                    allowFloat: true,
                },
                'ident': {
                    allowed: ['null'],
                },
            },
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const json = ret.value.entries;

    let d = '';
    for (const [key, value] of json) {
        let value_s;
        if (value.kind === 'ident') {
            value_s = value.value;
        } else {
            value_s = `"${value.value}"`;
        }
        if (d.length > 0) {
            d += ',';
        }
        d += `"${key}":${value_s}`;
    }

    if (d.length === 0) {
        return {
            'instructions': [],
            'warnings': [],
            'wait': false,
        };
    }

    const varName = 'localStorageElem';
    const varDict = `${varName}Dict`;
    const varKey = `${varName}Key`;
    const varValue = `${varName}Value`;

    const checkSign = assertFalse ? '==' : '!=';

    const code = `\
await page.evaluate(() => {
    const errors = [];
    const ${varDict} = {${d}};
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        let ${varName} = window.localStorage.getItem(${varKey});
        if (${varName} ${checkSign} ${varValue}) {
            errors.push("localStorage item \\"" + ${varKey} + "\\" (of value \\"" + ${varValue} + \
"\\") ${checkSign} \\"" + ${varName} + "\\"");
        }
    }
    if (errors.length !== 0) {
        const errs = errors.join("; ");
        throw "The following errors happened: [" + errs + "]";
    }
});`;
    return {
        'instructions': [code],
        'warnings': [],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * JSON object (for example: {"key": "expected value", "another key": "another expected"})
function parseAssertLocalStorage(parser) {
    return parseAssertLocalStorageInner(parser, false);
}

// Possible inputs:
//
// * JSON object (for example: {"key": "unexpected value", "another key": "another unexpected"})
function parseAssertLocalStorageFalse(parser) {
    return parseAssertLocalStorageInner(parser, true);
}

function parseAssertVariableInner(parser, assertFalse) {
    const identifiers = ['CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'ident' },
                {
                    kind: 'json',
                    keyTypes: {
                        'string': [],
                    },
                    valueTypes: {
                        'string': {},
                        'number': {
                            allowNegative: true,
                            allowFloat: true,
                        },
                        'ident': {},
                    },
                    alternatives: [
                        { kind: 'string' },
                        {
                            kind: 'number',
                            allowFloat: true,
                            allowNegative: true,
                        },
                    ],
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
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const warnings = [];
    const enabledChecks = new Set();

    if (tuple.length > 2) {
        fillEnabledChecksV2(tuple[2], enabledChecks, warnings, 'third');
    }

    const checks = [];

    if (enabledChecks.has('CONTAINS')) {
        if (assertFalse) {
            checks.push(`\
if (value1.indexOf(value2) !== -1) {
    errors.push("\`" + value1 + "\` contains \`" + value2 + "\` (for CONTAINS check)");
}`);
        } else {
            checks.push(`\
if (value1.indexOf(value2) === -1) {
    errors.push("\`" + value1 + "\` doesn't contain \`" + value2 + "\` (for CONTAINS check)");
}`);
        }
    }
    if (enabledChecks.has('STARTS_WITH')) {
        if (assertFalse) {
            checks.push(`\
if (value1.startsWith(value2)) {
    errors.push("\`" + value1 + "\` starts with \`" + value2 + "\` (for STARTS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!value1.startsWith(value2)) {
    errors.push("\`" + value1 + "\` doesn't start with \`" + value2 + "\` (for STARTS_WITH check)");
}`);
        }
    }
    if (enabledChecks.has('ENDS_WITH')) {
        if (assertFalse) {
            checks.push(`\
if (value1.endsWith(value2)) {
    errors.push("\`" + value1 + "\` ends with \`" + value2 + "\` (for ENDS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!value1.endsWith(value2)) {
    errors.push("\`" + value1 + "\` doesn't end with \`" + value2 + "\` (for ENDS_WITH check)");
}`);
        }
    }
    if (enabledChecks.has('NEAR')) {
        if (assertFalse) {
            checks.push(`\
if (Number.isNaN(value1)) {
    errors.push('\`' + value1 + '\` is NaN (for NEAR check)');
} else if (Math.abs(value1 - value2) <= 1) {
    errors.push('\`' + value1 + '\` is within 1 of \`' + value2 + '\` (for NEAR check)');
}`);
        } else {
            checks.push(`\
if (Number.isNaN(value1)) {
    errors.push('\`' + value1 + '\` is NaN (for NEAR check)');
} else if (Math.abs(value1 - value2) > 1) {
    errors.push('\`' + value1 + '\` is not within 1 of \`' + value2 + '\` (for NEAR \
check)');
}`);
        }
    }
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (value1 === value2) {
    errors.push("\`" + value1 + "\` is equal to \`" + value2 + "\`");
}`);
        } else {
            checks.push(`\
if (value1 !== value2) {
    errors.push("\`" + value1 + "\` isn't equal to \`" + value2 + "\`");
}`);
        }
    }

    return {
        'instructions': [`\
function stringifyValue(value) {
    if (['number', 'string', 'boolean'].indexOf(typeof value) !== -1) {
        return String(value);
    }
    return JSON.stringify(value);
}
const value1 = stringifyValue(arg.variables["${tuple[0].value.displayInCode()}"]);
const value2 = stringifyValue(${tuple[1].value.displayInCode()});
const errors = [];
${checks.join('\n')}
if (errors.length !== 0) {
    const errs = errors.join("; ");
    throw "The following errors happened: [" + errs + "]";
}`,
        ],
        'wait': false,
        'warnings': warnings,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * (ident, "string" | number | JSON dict)
function parseAssertVariable(parser) {
    return parseAssertVariableInner(parser, false);
}

// Possible inputs:
//
// * (ident, "string" | number | JSON dict)
function parseAssertVariableFalse(parser) {
    return parseAssertVariableInner(parser, true);
}

function parseAssertSizeInner(parser, assertFalse) {
    const jsonValidator = {
        kind: 'json',
        keyTypes: {
            'string': ['height', 'width'],
        },
        valueTypes: {
            'number': {
                allowNegative: true,
                allowFloat: true,
            },
        },
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                jsonValidator,
                {
                    kind: 'ident',
                    allowed: ['ALL'],
                    optional: true,
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const checkAllElements = tuple.length > 2;
    const json = tuple[1].value.entries;
    const selector = tuple[0].value;

    const varName = 'assertSizeElem';
    const instructions = `\
${getAndSetElements(selector, varName, checkAllElements)}
${commonSizeCheckCode(selector, checkAllElements, assertFalse, json, varName, 'errors')}
if (errors.length !== 0) {
    const errs = errors.join("; ");
    throw "The following errors happened: [" + errs + "]";
}
`;

    return {
        'instructions': [instructions],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"width"|"height": number})
function parseAssertSize(parser) {
    return parseAssertSizeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"width"|"height": number})
function parseAssertSizeFalse(parser) {
    return parseAssertSizeInner(parser, true);
}


module.exports = {
    'parseAssert': parseAssert,
    'parseAssertFalse': parseAssertFalse,
    'parseAssertAttribute': parseAssertAttribute,
    'parseAssertAttributeFalse': parseAssertAttributeFalse,
    'parseAssertCount': parseAssertCount,
    'parseAssertCountFalse': parseAssertCountFalse,
    'parseAssertCss': parseAssertCss,
    'parseAssertCssFalse': parseAssertCssFalse,
    'parseAssertDocumentProperty': parseAssertDocumentProperty,
    'parseAssertDocumentPropertyFalse': parseAssertDocumentPropertyFalse,
    'parseAssertLocalStorage': parseAssertLocalStorage,
    'parseAssertLocalStorageFalse': parseAssertLocalStorageFalse,
    'parseAssertPosition': parseAssertPosition,
    'parseAssertPositionFalse': parseAssertPositionFalse,
    'parseAssertProperty': parseAssertProperty,
    'parseAssertPropertyFalse': parseAssertPropertyFalse,
    'parseAssertSize': parseAssertSize,
    'parseAssertSizeFalse': parseAssertSizeFalse,
    'parseAssertText': parseAssertText,
    'parseAssertTextFalse': parseAssertTextFalse,
    'parseAssertVariable': parseAssertVariable,
    'parseAssertVariableFalse': parseAssertVariableFalse,
    'parseAssertWindowProperty': parseAssertWindowProperty,
    'parseAssertWindowPropertyFalse': parseAssertWindowPropertyFalse,
};
