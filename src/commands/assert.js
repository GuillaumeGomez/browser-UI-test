// All `assert*` commands.

const {
    buildPropertyDict,
    fillEnabledChecks,
    getAndSetElements,
    getAssertSelector,
    getInsertStrings,
    validateJson,
    indentString,
    checkJsonEntry,
    makeExtendedChecks,
    makeTextExtendedChecks,
    getSizes,
    validatePositionDict,
    commonPositionCheckCode,
} = require('./utils.js');
const { COLOR_CHECK_ERROR } = require('../consts.js');
const { cleanString } = require('../parser.js');

function parseAssertCssInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }
    const checkAllElements = selector.checkAllElements;

    const xpath = selector.isXPath ? 'XPath ' : 'selector ';
    const pseudo = !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '';

    const json = selector.tuple[1].getRaw();
    const entries = validateJson(json, {'string': [], 'number': []}, 'CSS property');

    if (entries.error !== undefined) {
        return entries;
    }

    const varName = 'parseAssertElemCss';
    const varDict = varName + 'Dict';
    const propertyDict = buildPropertyDict(entries, 'CSS property', false);
    if (propertyDict.error !== undefined) {
        return propertyDict;
    }

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
    if (propertyDict['needColorCheck']) {
        instructions.push(`\
if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`);
    }

    instructions.push(`\
const { checkCssProperty } = require('command-helpers.js');

async function checkElem(elem) {
    const nonMatchingProps = [];
    const jsHandle = await elem.evaluateHandle(e => {
        const ${varDict} = [${propertyDict['keys'].join(',')}];
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
    const values = [${propertyDict['values'].join(',')}];

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
        'warnings': entries.warnings,
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
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple or a JSON dict, found nothing'};
    // eslint-disable-next-line no-extra-parens
    } else if (elems.length !== 1 || (elems[0].kind !== 'tuple' && elems[0].kind !== 'json')) {
        return {'error': `expected a tuple or a JSON dict, found \`${parser.getRawArgs()}\``};
    }

    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR'];
    const enabledChecks = Object.create(null);
    const warnings = [];
    let json_dict;

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
        json_dict = tuple[0].getRaw();
        if (tuple.length > 1) {
            const ret = fillEnabledChecks(
                tuple[1],
                identifiers,
                enabledChecks,
                warnings,
                'second',
            );
            if (ret !== null) {
                return ret;
            }
        }
    } else {
        json_dict = elems[0].getRaw();
    }

    const entries = validateJson(
        json_dict, {'string': [], 'number': [], 'ident': ['null']}, 'property');
    if (entries.error !== undefined) {
        return entries;
    }
    warnings.push(...entries.warnings);

    if (Object.entries(entries.values).length === 0) {
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
    for (const [k, v] of Object.entries(entries.values)) {
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
        const k = Object.entries(enabledChecks).map(([k, _]) => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
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
    const err = 'Read the documentation to see the accepted inputs';
    const elems = parser.elems;
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
    const warnings = [];
    const enabledChecks = Object.create(null);

    if (elems.length === 0) {
        return {
            'error': 'expected a tuple, found nothing. ' + err,
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple, found \`${parser.getRawArgs()}\`. ${err}`};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length < 2 || tuple.length > 3) {
        return {
            'error': 'invalid number of values in the tuple (expected 2 or 3, found ' +
                tuple.length + '), ' + err,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as first argument, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected a JSON dictionary as second argument, found ' +
                `\`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const selector = tuple[0].getSelector();
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks, assertFalse, 'nonMatchingProps', 'property', 'prop', varKey, varValue);

    const json = tuple[1].getRaw();
    const entries = validateJson(
        json, {'string': [], 'number': [], 'ident': ['null']}, 'property');
    if (entries.error !== undefined) {
        return entries;
    }
    warnings.push(...entries.warnings);
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have properties so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    const props = [];
    const undefProps = [];
    for (const [k, v] of Object.entries(entries.values)) {
        if (v.kind !== 'ident') {
            props.push(`"${k}":"${v.value}"`);
        } else {
            undefProps.push(`"${k}"`);
        }
    }

    if (undefProps.length > 0 && hasSpecialChecks) {
        const k = Object.entries(enabledChecks)
            .filter(([k, v]) => v && k !== 'ALL')
            .map(([k, _]) => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
    }

    let expectedPropError = '';
    let unexpectedPropError = '';
    let unknown = '';
    if (!assertFalse) {
        unknown = '\n' + indentString(
            `nonMatchingProps.push('Unknown property \`' + ${varKey} + '\`');`, 3);
        unexpectedPropError = `
            nonMatchingProps.push("Expected property \`" + prop + "\` to not exist, found: \
\`" + e[prop] + "\`");`;
    } else {
        expectedPropError = `
        nonMatchingProps.push("Property named \`" + prop + "\` doesn't exist");`;
    }

    const checkAllElements = enabledChecks['ALL'] === true;
    const indent = checkAllElements ? 1 : 0;
    let whole = getAndSetElements(selector, varName, checkAllElements) + '\n';
    if (checkAllElements) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
    }
    whole += indentString(`\
await page.evaluate(e => {
    const nonMatchingProps = [];
    const ${varDict} = {${props.join(',')}};
    const undefProps = [${undefProps.join(',')}];
    for (const prop of undefProps) {
        if (e[prop] !== undefined && e[prop] !== null) {${unexpectedPropError}
            continue;
        }${expectedPropError}
    }
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        if (e[${varKey}] === undefined || e[${varKey}] === null) {${unknown}
            continue;
        }
        const prop = String(e[${varKey}]);
${indentString(checks.join('\n'), 2)}
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
    const err = 'Read the documentation to see the accepted inputs';
    const elems = parser.elems;
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
    const warnings = [];
    const enabledChecks = Object.create(null);

    if (elems.length === 0) {
        return {
            'error': 'expected a tuple, found nothing. ' + err,
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple, found \`${parser.getRawArgs()}\`. ${err}`};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length < 2 || tuple.length > 3) {
        return {
            'error': 'invalid number of values in the tuple (expected 2 or 3, found ' +
                tuple.length + '), ' + err,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as first argument, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected a JSON dictionary as second argument, found ' +
                `\`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const selector = tuple[0].getSelector();
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Attribute';
    const varValue = varName + 'Value';

    const { checks, hasSpecialChecks } = makeExtendedChecks(
        enabledChecks, assertFalse, 'nonMatchingAttrs', 'attribute', 'attr', varKey, varValue);

    const json = tuple[1].getRaw();
    const entries = validateJson(
        json,
        {'string': [], 'number': [], 'ident': ['null']},
        'attribute',
    );
    if (entries.error !== undefined) {
        return entries;
    }
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    warnings.push(...entries.warnings);
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
        const k = Object.entries(enabledChecks)
            .filter(([k, v]) => v && k !== 'ALL')
            .map(([k, _]) => k);
        warnings.push(`Special checks (${k.join(', ')}) will be ignored for \`null\``);
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
    if (enabledChecks['ALL'] === true) {
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
    const err = 'expected a tuple or a string, read the documentation to see the accepted inputs';
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {'error': `expected 2 elements in the tuple, found ${tuple.length}`};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': `expected second argument to be a number, found \
\`${tuple[1].getErrorText()}\``,
        };
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const occurences = tuple[1].getIntegerValue('number of occurences', true);
    if (occurences.error !== undefined) {
        return occurences;
    }
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
            `${insertBefore}if (${varName} !== ${occurences.value}) {\n` +
            `throw 'expected ${occurences.value} elements, found ' + ${varName};\n` +
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
    const err = 'expected a tuple, read the documentation to see the accepted inputs';
    const elems = parser.elems;
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH'];
    const warnings = [];
    const enabledChecks = Object.create(null);

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length < 2 || tuple.length > 3) {
        return {
            'error': 'invalid number of values in the tuple: expected 2 or 3, found ' +
                tuple.length,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a string, found \`\
${tuple[1].getErrorText()}\``,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabledChecks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const selector = tuple[0].getSelector();
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have text so \
the check will be performed on the element itself`);
    }

    const varName = 'parseAssertElemStr';

    const checks = makeTextExtendedChecks(enabledChecks, assertFalse);

    let checker;
    if (enabledChecks['ALL'] === true) {
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
        const value = ${tuple[1].displayInCode()};
        const elemText = browserUiTestHelpers.getElemText(e, value);
${indentString(checks.join('\n'), 2)}
        if (errors.length !== 0) {
            const errs = errors.join("; ");
            throw "The following errors happened: [" + errs + "]";
        }
    });
}

${getAndSetElements(selector, varName, enabledChecks['ALL'] === true)}
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
    const err = 'expected a boolean, a CSS selector or an XPath';
    const elems = parser.elems;

    let tuple;
    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': `expected a CSS selector, an XPath or a boolean, \
found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string' || elems[0].kind === 'boolean') {
        tuple = elems;
    } else if (elems[0].kind === 'tuple') {
        tuple = elems[0].getRaw();
        if (tuple.length !== 1) {
            return {
                'error': 'expected only a CSS selector, an XPath or a boolean in the tuple, found' +
                    ` ${tuple.length} elements`,
            };
        } else if (tuple[0].kind !== 'string' && tuple[0].kind !== 'boolean') {
            return {
                'error': 'expected argument to be a CSS selector, an XPath or a boolean, ' +
                    `found \`${tuple[0].getErrorText()}\` (${tuple[0].getArticleKind()})`,
            };
        }
    } else {
        return {
            'error': err + `, found \`${elems[0].getErrorText()}\` (${elems[0].getArticleKind()})`,
        };
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    if (tuple[0].kind === 'boolean') {
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

const check = ${tuple[0].value};
${insertBefore}if (!check) {
    throw "Condition \`${cleanString(tuple[0].getRaw())}\` was evaluated as false";
}${insertAfter}`],
            'wait': false,
            'checkResult': true,
        };
    }
    const selector = tuple[0].getSelector();

    if (selector.error !== undefined) {
        return selector;
    }

    let instructions;
    if (selector.isXPath) {
        instructions = [
            `${insertBefore}if ((await page.$x("${selector.value}")).length === 0) { ` +
            `throw 'XPath "${selector.value}" not found'; }${insertAfter}`,
        ];
    } else {
        instructions = [
            `${insertBefore}if ((await page.$("${selector.value}")) === null) { ` +
            `throw '"${selector.value}" not found'; }${insertAfter}`,
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
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }

    const checks = validatePositionDict(selector.tuple[1]);
    if (checks.error !== undefined) {
        return checks;
    }

    const errorsVarName = 'errors';
    const varName = 'assertPosition';

    let whole = commonPositionCheckCode(
        selector,
        checks.checks,
        selector.checkAllElements,
        varName,
        errorsVarName,
        assertFalse,
        getAndSetElements(selector, varName, selector.checkAllElements) + '\n',
    );
    whole += `\
if (${errorsVarName}.length > 0) {
    throw "The following errors happened: [" + ${errorsVarName}.join("; ") + "]";
}`;

    return {
        'instructions': [whole],
        'warnings': checks.warnings,
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
        'warnings': warnings,
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
    const elems = parser.elems;
    const enabled_checks = Object.create(null);
    const warnings = [];

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2 && tuple.length !== 3) {
        let err = `expected 2 or 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'ident') {
        return {
            'error': 'expected first argument to be an ident, ' +
                `found ${tuple[0].getArticleKind()} (\`${tuple[0].getErrorText()}\`)`,
        };
    } else if (tuple[1].kind !== 'number' &&
        tuple[1].kind !== 'string' &&
        tuple[1].kind !== 'json') {
        return {
            'error': `expected second argument to be a number, a string or a JSON dict, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getErrorText()}\`)`,
        };
    } else if (tuple.length > 2) {
        const identifiers = ['CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
        const ret = fillEnabledChecks(tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const checks = [];

    if (enabled_checks['CONTAINS']) {
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
    if (enabled_checks['STARTS_WITH']) {
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
    if (enabled_checks['ENDS_WITH']) {
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
    if (enabled_checks['NEAR']) {
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
const value1 = stringifyValue(arg.variables["${tuple[0].displayInCode()}"]);
const value2 = stringifyValue(${tuple[1].displayInCode()});
const errors = [];
${checks.join('\n')}
if (errors.length !== 0) {
    const errs = errors.join("; ");
    throw "The following errors happened: [" + errs + "]";
}`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * (ident, "string" | number)
function parseAssertVariable(parser) {
    return parseAssertVariableInner(parser, false);
}

// Possible inputs:
//
// * (ident, "string" | number)
function parseAssertVariableFalse(parser) {
    return parseAssertVariableInner(parser, true);
}

function parseAssertSizeInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }

    const checkAllElements = selector.checkAllElements;
    const json = selector.tuple[1].getRaw();

    const entries = validateJson(json, {'number': []}, 'JSON dict key', ['height', 'width']);
    if (entries.error !== undefined) {
        return entries;
    }

    const checks = [];
    for (const [k, v] of Object.entries(entries.values)) {
        if (k === 'width') {
            if (assertFalse) {
                checks.push(`\
if (width === ${v.value}) {
    errors.push("width is equal to \`${v.value}\`");
}`);
            } else {
                checks.push(`\
if (width !== ${v.value}) {
    errors.push("expected a width of \`${v.value}\`, found \`" + width + "\`");
}`);
            }
        } else if (k === 'height') {
            if (assertFalse) {
                checks.push(`\
if (height === ${v.value}) {
    errors.push("height is equal to \`${v.value}\`");
}`);
            } else {
                checks.push(`\
if (height !== ${v.value}) {
    errors.push("expected a height of \`${v.value}\`, found \`" + height + "\`");
}`);
            }
        }
    }

    const varName = 'assertSizeElem';
    let checker;
    if (checkAllElements) {
        checker = `\
for (const elem of ${varName}) {
    errors.push(...await checkElemSize(elem));
}`;
    } else {
        checker = `errors.push(...await checkElemSize(${varName}));`;
    }

    const instructions = `\
async function checkElemSize(elem) {
    return await elem.evaluate(e => {
        const errors = [];
${indentString(getSizes(selector), 2)}
${indentString(checks.join('\n'), 2)}
        return errors;
    });
}
${getAndSetElements(selector, varName, checkAllElements)}
const errors = [];
${checker}
if (errors.length !== 0) {
    const errs = errors.join("; ");
    throw "The following errors happened: [" + errs + "]";
}
`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': entries.warnings,
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
