// All `assert*` commands.

const {
    buildPropertyDict,
    fillEnabledChecks,
    getAndSetElements,
    getAssertSelector,
    getInsertStrings,
    validateJson,
} = require('./utils.js');
const { COLOR_CHECK_ERROR } = require('../consts.js');

function parseAssertCssInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }
    const checkAllElements = selector.checkAllElements;
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const xpath = selector.isXPath ? 'XPath ' : 'selector ';
    const pseudo = !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '';

    const json = selector.tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'CSS property');

    if (entries.error !== undefined) {
        return entries;
    }

    const varName = 'parseAssertElemCss';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';
    const propertyDict = buildPropertyDict(entries, 'CSS property', false);
    if (propertyDict.error !== undefined) {
        return propertyDict;
    }
    // This allows to round values in pixels to make checks simpler in case it's a decimal.
    const extra = `\
if (typeof assertComputedStyle[${varKey}] === "string" && \
assertComputedStyle[${varKey}].search(/^(\\d+\\.\\d+px)$/g) === 0) {
    if (browserUiTestHelpers.extractFloat(assertComputedStyle[${varKey}], true) + "px" !== \
${varValue}) {
        throw 'expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\` for ${xpath}\
\`${selector.value}\`, found \`' + assertComputedStyle[${varKey}] + '\` (or \`' + \
browserUiTestHelpers.extractFloat(assertComputedStyle[${varKey}], true) + 'px\`)';
    }
    continue;
}`;
    const code = `const ${varDict} = {${propertyDict['dict']}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${insertBefore}if (e.style[${varKey}] != ${varValue} && \
assertComputedStyle[${varKey}] != ${varValue}) {
${extra}
throw 'expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\` for ${xpath}\
\`${selector.value}\`, found \`' + assertComputedStyle[${varKey}] + '\`';
}${insertAfter}
}\n`;

    const instructions = [];
    if (propertyDict['needColorCheck']) {
        instructions.push('if (!arg.showText) {\n' +
            `throw "${COLOR_CHECK_ERROR}";\n` +
            '}',
        );
    }
    if (!checkAllElements) {
        instructions.push(getAndSetElements(selector, varName, checkAllElements) + '\n' +
            'await page.evaluate(e => {\n' +
            `let assertComputedStyle = getComputedStyle(e${pseudo});\n${code}` +
            `}, ${varName});`,
        );
    } else {
        instructions.push(getAndSetElements(selector, varName, checkAllElements) + '\n' +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                'await page.evaluate(e => {\n' +
                `let assertComputedStyle = getComputedStyle(e${pseudo});\n${code}` +
                `}, ${varName}[i]);\n` +
            '}',
        );
    }
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

function parseAssertDocumentPropertyInner(parser, assertFalse) {
    const elems = parser.elems;
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH'];

    if (elems.length === 0) {
        return {'error': 'expected a tuple or a JSON dict, found nothing'};
    // eslint-disable-next-line no-extra-parens
    } else if (elems.length !== 1 || (elems[0].kind !== 'tuple' && elems[0].kind !== 'json')) {
        return {'error': `expected a tuple or a JSON dict, found \`${parser.getRawArgs()}\``};
    }

    const enabled_checks = Object.create(null);
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
                    `${tuple[0].getText()}\` (${tuple[0].getArticleKind()})`,
            };
        }
        json_dict = tuple[0].getRaw();
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
        json_dict = elems[0].getRaw();
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    const entries = validateJson(json_dict, ['string', 'number'], 'property');
    if (entries.error !== undefined) {
        return entries;
    } else if (entries.warnings !== undefined) {
        for (const warning of entries.warnings) {
            warnings.push(warning);
        }
    }

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
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push(`if (String(document[${varKey}]).indexOf(${varValue}) === -1) {
    throw 'Property \`' + ${varKey} + '\` (\`' + document[${varKey}] + '\`) does not contain \
\`' + ${varValue} + '\`';
}`);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push(`if (!String(document[${varKey}]).startsWith(${varValue})) {
    throw 'Property \`' + ${varKey} + '\` (\`' + document[${varKey}] + '\`) does not start with \
\`' + ${varValue} + '\`';
}`);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push(`if (!String(document[${varKey}]).endsWith(${varValue})) {
    throw 'Property \`' + ${varKey} + '\` (\`' + document[${varKey}] + '\`) does not end with \
\`' + ${varValue} + '\`';
}`);
    }
    // If no check was enabled.
    if (checks.length === 0) {
        checks.push(`if (String(document[${varKey}]) != ${varValue}) {
    throw 'Expected \`' + ${varValue} + '\` for property \`' + ${varKey} + '\`, \
found \`' + document[${varKey}] + '\`';
}`);
    }

    let code = `const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
${insertBefore}if (document[${varKey}] === undefined) {
    throw 'Unknown document property \`' + ${varKey} + '\`';
}\n`;

    if (assertFalse) {
        code += '} catch (e) { continue; }\n';
    }

    for (const check of checks) {
        code += `(() => {
${insertBefore}${check}${insertAfter}
})();\n`;
    }
    code += '}\n';

    const instructions = [
        'await page.evaluate(() => {\n' +
            code +
        '});',
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
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH])
function parseAssertDocumentProperty(parser) {
    return parseAssertDocumentPropertyInner(parser, false);
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH])
function parseAssertDocumentPropertyFalse(parser) {
    return parseAssertDocumentPropertyInner(parser, true);
}

function parseAssertPropertyInner(parser, assertFalse) {
    const err = 'Read the documentation to see the accepted inputs';
    const elems = parser.elems;
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH'];
    const warnings = [];
    const enabled_checks = Object.create(null);

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
                `\`${tuple[1].getText()}\` (${tuple[1].getArticleKind()})`,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const [insertBefore, insertAfter] = getInsertStrings(
        assertFalse,
        false,
        'TO_REPLACE',
    );
    const selector = tuple[0].getSelector();
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push([`\
if (String(e[${varKey}]).indexOf(${varValue}) === -1) {
    throw "property \`" + ${varKey} + "\` (\`" + String(e[${varKey}]) + "\`) doesn't contain \`" + \
${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, 'CONTAINS']);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push([`\
if (!String(e[${varKey}]).startsWith(${varValue})) {
    throw "property \`" + ${varKey} + "\` (\`" + String(e[${varKey}]) + "\`) doesn't start with \`"\
 + ${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, 'STARTS_WITH']);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push([`\
if (!String(e[${varKey}]).endsWith(${varValue})) {
    throw "property \`" + ${varKey} + "\` (\`" + String(e[${varKey}]) + "\`) doesn't end with \`" +\
 ${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, 'ENDS_WITH']);
    }
    if (checks.length === 0) {
        checks.push([`\
if (String(e[${varKey}]) != ${varValue}) {
    throw "property \`" + ${varKey} + "\` (\`" + String(e[${varKey}]) + "\`) isn't equal to \`" + \
${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, '']);
    }

    let all_checks = '';
    for (const check of checks) {
        all_checks += '(() => {\n' +
            insertBefore +
            check[0];

        if (check[1].length > 0) {
            all_checks += insertAfter.replace('TO_REPLACE', ` (for ${check[1]} check)`);
        } else {
            all_checks += insertAfter.replace('TO_REPLACE', '');
        }

        all_checks += '\n})();\n';
    }

    const json = tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'property');
    if (entries.error !== undefined) {
        return entries;
    }

    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }
    let notFound = 'return;';
    if (!assertFalse) {
        notFound = `throw 'There is no property \`' + ${varKey} + '\` for \
${xpath}\`${selector.value}\`';`;
    }
    const code = `const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
(() => {
if (e[${varKey}] === undefined) {
${notFound}
}
})();
${all_checks}\
}\n`;

    let instructions;
    if (enabled_checks['ALL'] === true) {
        instructions = [
            getAndSetElements(selector, varName, true) + '\n' +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                `await ${varName}[i].evaluate(e => {\n` +
                    `${code}` +
                '});\n' +
            '}',
        ];
    } else {
        instructions = [
            getAndSetElements(selector, varName, false) + '\n' +
            `await ${varName}.evaluate(e => {\n` +
                `${code}` +
            '});',
        ];
    }
    return {
        'instructions': instructions,
        'wait': false,
        'warnings': entries.warnings,
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
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH'];
    const warnings = [];
    const enabled_checks = Object.create(null);

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
                `\`${tuple[1].getText()}\` (${tuple[1].getArticleKind()})`,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const [insertBefore, insertAfter] = getInsertStrings(
        assertFalse,
        false,
        'TO_REPLACE',
    );
    const selector = tuple[0].getSelector();
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Attribute';
    const varValue = varName + 'Value';

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push([`\
if (attr.indexOf(${varValue}) === -1) {
    throw "attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't contain \`" + \
${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, 'CONTAINS']);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push([`\
if (!attr.startsWith(${varValue})) {
    throw "attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't start with \`"\
 + ${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, 'STARTS_WITH']);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push([`\
if (!attr.endsWith(${varValue})) {
    throw "attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't end with \`" +\
 ${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, 'ENDS_WITH']);
    }
    if (checks.length === 0) {
        checks.push([`\
if (attr !== ${varValue}) {
    throw "attribute \`" + ${varKey} + "\` (\`" + attr + "\`) isn't equal to \`" + \
${varValue} + "\` for ${xpath}\`${selector.value}\`";
}`, '']);
    }

    let all_checks = '';
    for (const check of checks) {
        all_checks += '(() => {\n' +
            insertBefore +
            check[0];

        if (check[1].length > 0) {
            all_checks += insertAfter.replace('TO_REPLACE', ` (for ${check[1]} check)`);
        } else {
            all_checks += insertAfter.replace('TO_REPLACE', '');
        }

        all_checks += '\n})();\n';
    }

    const json = tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'attribute');
    if (entries.error !== undefined) {
        return entries;
    }


    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }

    let notFound = 'return;';
    if (!assertFalse) {
        notFound = `throw "${xpath}\`${selector.value}\` doesn't have an attribute named \`" + \
${varKey} + "\`";`;
    }
    const code = `const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
if (!e.hasAttribute(${varKey})) {
    ${notFound}
}
const attr = e.getAttribute(${varKey});
${all_checks}\
}\n`;

    let instructions;
    if (enabled_checks['ALL'] === true) {
        instructions = getAndSetElements(selector, varName, true) + '\n' +
            `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                'await page.evaluate(e => {\n' +
                code +
                `}, ${varName}[i]);\n` +
            '}';
    } else {
        instructions = getAndSetElements(selector, varName, false) + '\n' +
            'await page.evaluate(e => {\n' +
            code +
            `}, ${varName});`;
    }
    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': entries.warnings,
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
        if (tuple.length < 2) {
            return {'error': err};
        }
        return {'error': 'unexpected argument after number of occurences'};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': `expected second argument to be a number, found \`${tuple[1].getRaw()}\``,
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
    const varName = 'parseAssertElemInt';
    let start;
    if (selector.isXPath) {
        start = `let ${varName} = await page.$x("${selector.value}");\n`;
    } else {
        start = `let ${varName} = await page.$$("${selector.value}");\n`;
    }
    return {
        'instructions': [
            start +
            // TODO: maybe check differently depending on the tag kind?
            `${insertBefore}if (${varName}.length !== ${occurences.value}) {\n` +
            `throw 'expected ${occurences.value} elements, found ' + ${varName}.length;\n` +
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
    const enabled_checks = Object.create(null);

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length < 2 || tuple.length > 3) {
        return {'error': 'invalid number of values in the tuple, read the documentation to see ' +
                    'the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a string, found \`${tuple[1].getRaw()}\``,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabled_checks, warnings, 'third');
        if (ret !== null) {
            return ret;
        }
    }

    const [insertBefore, insertAfter] = getInsertStrings(
        assertFalse,
        false,
        'TO_REPLACE',
    );
    const selector = tuple[0].getSelector();

    const value = tuple[1].getStringValue();
    const varName = 'parseAssertElemStr';

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        checks.push([`browserUiTestHelpers.elemTextContains(e, "${value}");`, 'CONTAINS']);
    }
    if (enabled_checks['STARTS_WITH']) {
        checks.push([`browserUiTestHelpers.elemTextStartsWith(e, "${value}");`, 'STARTS_WITH']);
    }
    if (enabled_checks['ENDS_WITH']) {
        checks.push([`browserUiTestHelpers.elemTextEndsWith(e, "${value}");`, 'ENDS_WITH']);
    }
    if (checks.length === 0) {
        checks.push([`browserUiTestHelpers.compareElemText(e, "${value}");`, '']);
    }

    let all_checks = '';
    for (const check of checks) {
        all_checks += '(() => {\n' +
            insertBefore +
            check[0] + '\n';

        if (check[1].length > 0) {
            all_checks += insertAfter.replace('TO_REPLACE', ` (for ${check[1]} check)`);
        } else {
            all_checks += insertAfter.replace('TO_REPLACE', '');
        }

        all_checks += '})();\n';
    }

    let instructions = getAndSetElements(selector, varName, enabled_checks['ALL'] === true) + '\n';
    if (enabled_checks['ALL'] !== true) {
        instructions += 'await page.evaluate(e => {\n' +
            all_checks +
            `}, ${varName});`;
    } else {
        instructions += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
            'await page.evaluate(e => {\n' +
            all_checks +
            `}, ${varName}[i]);\n` +
            '}';
    }
    return {
        'instructions': [instructions],
        'wait': false,
        'checkResult': true,
        'warnings': warnings.length > 0 ? warnings : undefined,
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
    const err = 'expected a tuple, a CSS selector or an XPath';
    const elems = parser.elems;

    let tuple;
    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': `expected a CSS selector or an XPath, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        tuple = elems;
    } else if (elems[0].kind === 'tuple') {
        tuple = elems[0].getRaw();
        if (tuple.length !== 1) {
            return {
                'error': 'expected only a CSS selector or an XPath in the tuple, found ' +
                    `${tuple.length} elements`,
            };
        } else if (tuple[0].kind !== 'string') {
            return {
                'error': 'expected argument to be a CSS selector or an XPath, ' +
                    `found \`${tuple[0].getRaw()}\``,
            };
        }
    } else {
        return {'error': err + `, found \`${elems[0].getRaw()}\``};
    }
    const selector = tuple[0].getSelector();

    if (selector.error !== undefined) {
        return selector;
    }
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

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
// * ("CSS selector")
// * ("XPath")
function parseAssert(parser) {
    return parseAssertInner(parser, false);
}

// Possible inputs:
//
// * "CSS selector"
// * "XPath"
// * ("CSS selector")
// * ("XPath")
function parseAssertFalse(parser) {
    return parseAssertInner(parser, true);
}

function parseAssertPositionInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }

    const isPseudo = !selector.isXPath && selector.pseudo !== null;

    const checkAllElements = selector.checkAllElements;
    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    const json = selector.tuple[1].getRaw();

    const entries = validateJson(json, ['number'], 'JSON dict key');

    if (entries.error !== undefined) {
        return entries;
    }

    const varName = 'parseAssertPosition';

    let code = '';
    for (const [key, value] of Object.entries(entries.values)) {
        if (key === 'x') {
            code += 'function checkX(e) {\n' +
                insertBefore +
                'let x = e.getBoundingClientRect().left;\n';
            if (isPseudo) {
                code += `let pseudoStyle = window.getComputedStyle(e, "${selector.pseudo}");\n` +
                    'let style = window.getComputedStyle(e);\n' +
                    'x += browserUiTestHelpers.extractFloat(pseudoStyle.left) - ' +
                        'browserUiTestHelpers.extractFloat(style.marginLeft);\n';
            }
            code += 'let roundedX = Math.round(x);\n' +
                `if (x !== ${value} && roundedX !== Math.round(${value})) {\n` +
                `throw "different X values: " + x + "(or " + roundedX + ") != " + ${value};\n` +
                `}${insertAfter}\n` +
                '}\n' +
                'checkX(elem);\n';
        } else if (key === 'y') {
            code += 'function checkY(e) {\n' +
                insertBefore +
                'let y = e.getBoundingClientRect().top;\n';
            if (isPseudo) {
                code += `let pseudoStyle = window.getComputedStyle(e, "${selector.pseudo}");\n` +
                    'let style = window.getComputedStyle(e);\n' +
                    'y += browserUiTestHelpers.extractFloat(pseudoStyle.top) - ' +
                        'browserUiTestHelpers.extractFloat(style.marginTop);\n';
            }
            code += 'let roundedY = Math.round(y);\n' +
                `if (y !== ${value} && roundedY !== Math.round(${value})) {\n` +
                `throw "different Y values: " + y + "(or " + roundedY + ") != " + ${value};\n` +
                `}${insertAfter}\n` +
                '}\n' +
                'checkY(elem);\n';
        } else {
            return {
                'error': 'Only accepted keys are "x" and "y", found `' +
                    `"${key}"\` (in \`${selector.tuple[1].getText()}\`)`,
            };
        }
    }
    let instructions = getAndSetElements(selector, varName, checkAllElements);
    if (!checkAllElements) {
        if (code.length !== 0) {
            instructions += '\nawait page.evaluate(elem => {\n' +
                code +
                `}, ${varName});`;
        }
    } else {
        if (code.length !== 0) {
            instructions += `\nfor (let i = 0, len = ${varName}.length; i < len; ++i) {\n` +
                'await page.evaluate(elem => {\n' +
                code +
                `}, ${varName}[i]);\n` +
            '}';
        }
    }
    return {
        'instructions': [instructions],
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
        let value_s;
        let err_s;
        if (entry['value'].kind === 'ident') {
            value_s = entry['value'].getStringValue();
            err_s = value_s;
            if (value_s !== 'null') {
                return {'error': `Only \`null\` ident is allowed, found \`${value_s}\``};
            }
        } else {
            value_s = `"${entry['value'].getStringValue()}"`;
            err_s = `\\"${entry['value'].getStringValue()}\\"`;
        }
        if (assertFalse) {
            content.push(
                `if (localStorage.getItem("${key_s}") == ${value_s}) {\n` +
                    `var value = localStorage.getItem("${key_s}");\n` +
                    `throw "localStorage item \\"${key_s}\\" (" + value + ") == ${err_s}";\n` +
                '}');
        } else {
            content.push(
                `if (localStorage.getItem("${key_s}") != ${value_s}) {\n` +
                    `var value = localStorage.getItem("${key_s}");\n` +
                    `throw "localStorage item \\"${key_s}\\" (" + value + ") != ${err_s}";\n` +
                '}');
        }
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (content.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
            'wait': false,
        };
    }
    return {
        'instructions': [
            `await page.evaluate(() => {\n${content.join('\n')}\n});`,
        ],
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
    'parseAssertText': parseAssertText,
    'parseAssertTextFalse': parseAssertTextFalse,
};
