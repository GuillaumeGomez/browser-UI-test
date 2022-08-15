// All `assert*` commands.

const {
    buildPropertyDict,
    fillEnabledChecks,
    getAndSetElements,
    getAssertSelector,
    getInsertStrings,
    validateJson,
    indentString,
} = require('./utils.js');
const { COLOR_CHECK_ERROR } = require('../consts.js');

function parseAssertCssInner(parser, assertFalse) {
    const selector = getAssertSelector(parser);
    if (selector.error !== undefined) {
        return selector;
    }
    const checkAllElements = selector.checkAllElements;

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

    const indent = checkAllElements ? 1 : 0;

    // This allows to round values in pixels to make checks simpler in case it's a decimal.
    const extra = `\
if (typeof assertComputedStyle[${varKey}] === "string" && \
assertComputedStyle[${varKey}].search(/^(\\d+\\.\\d+px)$/g) === 0) {
    if (browserUiTestHelpers.extractFloat(assertComputedStyle[${varKey}], true) + "px" !== \
${varValue}) {
        localErr.push('expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\`, \
found \`' + assertComputedStyle[${varKey}] + '\` (or \`' + \
browserUiTestHelpers.extractFloat(assertComputedStyle[${varKey}], true) + 'px\`)');
    }
    succeeded = true;
}`;

    let code = `const ${varDict} = {${propertyDict['dict']}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
    const localErr = [];
    let succeeded = false;
    if (e.style[${varKey}] != ${varValue} && assertComputedStyle[${varKey}] != \
${varValue}) {
${indentString(extra, 2)}
        if (!succeeded) {
            localErr.push('expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\`\
, found \`' + assertComputedStyle[${varKey}] + '\`');
        }
    }
`;
    if (assertFalse) {
        code += `    if (localErr.length === 0) {
        nonMatchingProps.push("assert didn't fail for key \`" + ${varKey} + '\`');
    }`;
    } else {
        code += '    nonMatchingProps.push(...localErr);';
    }

    code += '\n}';

    const errorCheck = `\
if (nonMatchingProps.length !== 0) {
    const props = nonMatchingProps.join(", ");
    throw "The following errors happened (for ${xpath}\`${selector.value}\`): [" + props + "]";
}`;

    const instructions = [];
    if (propertyDict['needColorCheck']) {
        instructions.push(`if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`,
        );
    }
    let whole = getAndSetElements(selector, varName, checkAllElements) + '\n';
    if (checkAllElements) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
    }
    whole += indentString(`\
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e${pseudo});
${indentString(code, 1)}
${indentString(errorCheck, 1)}
`, indent);
    if (checkAllElements) {
        whole += `    }, ${varName}[i]);
}`;
    } else {
        whole += `}, ${varName});`;
    }
    instructions.push(whole);
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
        if (assertFalse) {
            checks.push(`\
if (String(${objName}[${varKey}]).indexOf(${varValue}) !== -1) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\` (for \
CONTAINS check)');
}`);
        } else {
            checks.push(`\
if (String(${objName}[${varKey}]).indexOf(${varValue}) === -1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) does not contain \`' + ${varValue} + '\`');
}`);
        }
    }
    if (enabled_checks['STARTS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (String(${objName}[${varKey}]).startsWith(${varValue})) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\` (for \
STARTS_WITH check)');
}`);
        } else {
            checks.push(`\
if (!String(${objName}[${varKey}]).startsWith(${varValue})) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) does not start with \`' + ${varValue} + '\`');
}`);
        }
    }
    if (enabled_checks['ENDS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (String(${objName}[${varKey}]).endsWith(${varValue})) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\` (for \
ENDS_WITH check)');
}`);
        } else {
            checks.push(`\
if (!String(${objName}[${varKey}]).endsWith(${varValue})) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) does not end with \`' + ${varValue} + '\`');
}`);
        }
    }
    // If no check was enabled.
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (String(${objName}[${varKey}]) == ${varValue}) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\`');
}`);
        } else {
            checks.push(`\
if (String(${objName}[${varKey}]) != ${varValue}) {
    nonMatchingProps.push('Expected \`' + ${varValue} + '\` for property \`' + ${varKey} \
+ '\`, found \`' + ${objName}[${varKey}] + '\`');
}`);
        }
    }

    let err = '';
    if (!assertFalse) {
        err = '\n';
        err += indentString(`nonMatchingProps.push('Unknown ${objName} property \`' + ${varKey} + \
'\`');`, 3);
    }

    const instructions = [`\
await page.evaluate(() => {
    const nonMatchingProps = [];
    const ${varDict} = {${d}};
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        if (${objName}[${varKey}] === undefined) {${err}
            continue;
        }
${indentString(checks.join('\n'), 2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
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
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH])
function parseAssertDocumentProperty(parser) {
    return parseAssertObjPropertyInner(parser, false, 'document');
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH])
function parseAssertDocumentPropertyFalse(parser) {
    return parseAssertObjPropertyInner(parser, true, 'document');
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH])
function parseAssertWindowProperty(parser) {
    return parseAssertObjPropertyInner(parser, false, 'window');
}

// Possible inputs:
//
// * {"DOM property": "value"}
// * ({"DOM property": "value"})
// * ({"DOM property": "value"}, CONTAINS|ENDS_WITH|STARTS_WITH)
// * ({"DOM property": "value"}, [CONTAINS|ENDS_WITH|STARTS_WITH])
function parseAssertWindowPropertyFalse(parser) {
    return parseAssertObjPropertyInner(parser, true, 'window');
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

    const selector = tuple[0].getSelector();
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemProp';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Key';
    const varValue = varName + 'Value';

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        if (assertFalse) {
            checks.push(`\
if (String(e[${varKey}]).indexOf(${varValue}) !== -1) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\` (for \
CONTAINS check)');
}`);
        } else {
            checks.push(`\
if (String(e[${varKey}]).indexOf(${varValue}) === -1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) does not contain \`' + ${varValue} + '\`');
}`);
        }
    }
    if (enabled_checks['STARTS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (String(e[${varKey}]).startsWith(${varValue})) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\` (for \
STARTS_WITH check)');
}`);
        } else {
            checks.push(`\
if (!String(e[${varKey}]).startsWith(${varValue})) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) does not start with \`' + ${varValue} + '\`');
}`);
        }
    }
    if (enabled_checks['ENDS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (String(e[${varKey}]).endsWith(${varValue})) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\` (for \
ENDS_WITH check)');
}`);
        } else {
            checks.push(`\
if (!String(e[${varKey}]).endsWith(${varValue})) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) does not end with \`' + ${varValue} + '\`');
}`);
        }
    }
    // If no check was enabled.
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (String(e[${varKey}]) == ${varValue}) {
    nonMatchingProps.push("assert didn't fail for property \`" + ${varKey} + '\`');
}`);
        } else {
            checks.push(`\
if (String(e[${varKey}]) != ${varValue}) {
    nonMatchingProps.push('Expected \`' + ${varValue} + '\` for property \`' + ${varKey} \
+ '\`, found \`' + e[${varKey}] + '\`');
}`);
        }
    }

    const json = tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'property');
    if (entries.error !== undefined) {
        return entries;
    }
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        if (entries.warnings === undefined) {
            entries.warnings = [];
        }
        entries.warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }


    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }

    let unknown = '';
    if (!assertFalse) {
        unknown = '\n';
        unknown += indentString(
            `nonMatchingProps.push('Unknown property \`' + ${varKey} + '\`');`, 3);
    }

    const checkAllElements = enabled_checks['ALL'] === true;
    const indent = checkAllElements ? 1 : 0;
    let whole = getAndSetElements(selector, varName, checkAllElements) + '\n';
    if (checkAllElements) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
    }
    whole += indentString(`\
await page.evaluate(e => {
    const nonMatchingProps = [];
    const ${varDict} = {${d}};
    for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
        if (e[${varKey}] === undefined) {${unknown}
            continue;
        }
${indentString(checks.join('\n'), 2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
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

    const selector = tuple[0].getSelector();
    const xpath = selector.isXPath ? 'XPath ' : 'selector ';

    const varName = 'parseAssertElemAttr';
    const varDict = varName + 'Dict';
    const varKey = varName + 'Attribute';
    const varValue = varName + 'Value';

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        if (assertFalse) {
            checks.push(`\
if (attr.indexOf(${varValue}) !== -1) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + ${varKey} + "\` (\`" + attr + \
"\`) (for CONTAINS check)");
}`);
        } else {
            checks.push(`\
if (attr.indexOf(${varValue}) === -1) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't contain \`"\
 + ${varValue} + "\` (for CONTAINS check)");
}`);
        }
    }
    if (enabled_checks['STARTS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (attr.startsWith(${varValue})) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + ${varKey} + "\` (\`" + attr + \
"\`) (for STARTS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!attr.startsWith(${varValue})) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't start with \
\`" + ${varValue} + "\` (for STARTS_WITH check)");
}`);
        }
    }
    if (enabled_checks['ENDS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (attr.endsWith(${varValue})) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + ${varKey} + "\` (\`" + attr + \
"\`) (for ENDS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!attr.endsWith(${varValue})) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` (\`" + attr + "\`) doesn't end with \`"\
 + ${varValue} + "\`");
}`);
        }
    }
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (attr === ${varValue}) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + ${varKey} + "\` (\`" + \
attr + "\`)");
}`);
        } else {
            checks.push(`\
if (attr !== ${varValue}) {
    nonMatchingAttrs.push("attribute \`" + ${varKey} + "\` isn't equal to \`" + ${varValue} + "\` \
(\`" + attr + "\`)");
}`);
        }
    }

    const json = tuple[1].getRaw();
    const entries = validateJson(json, ['string', 'number'], 'attribute');
    if (entries.error !== undefined) {
        return entries;
    }
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        if (entries.warnings === undefined) {
            entries.warnings = [];
        }
        entries.warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }

    // JSON.stringify produces a problematic output so instead we use this.
    let d = '';
    for (const [k, v] of Object.entries(entries.values)) {
        if (d.length > 0) {
            d += ',';
        }
        d += `"${k}":"${v}"`;
    }

    let noAttrError = '';
    if (!assertFalse) {
        noAttrError = `
        nonMatchingAttrs.push("No attribute named \`" + ${varKey} + "\`");`;
    }

    const code = `const nonMatchingAttrs = [];
const ${varDict} = {${d}};
for (const [${varKey}, ${varValue}] of Object.entries(${varDict})) {
    if (!e.hasAttribute(${varKey})) {${noAttrError}
        continue;
    }
    const attr = e.getAttribute(${varKey});
${indentString(checks.join('\n'), 1)}
}
if (nonMatchingAttrs.length !== 0) {
    const props = nonMatchingAttrs.join(", ");
    throw "The following errors happened (for ${xpath}\`${selector.value}\`): [" + props + "]";
}`;

    let instructions;
    if (enabled_checks['ALL'] === true) {
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
    let warnings = [];

    let d = '';
    for (const entry of json) {
        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getText()}\``);
            continue;
        }
        const key_s = entry['key'].getStringValue();
        let value_s;
        if (entry['value'].kind === 'ident') {
            value_s = entry['value'].getStringValue();
            if (value_s !== 'null') {
                return {'error': `Only \`null\` ident is allowed, found \`${value_s}\``};
            }
        } else {
            value_s = `"${entry['value'].getStringValue()}"`;
        }
        if (d.length > 0) {
            d += ',';
        }
        d += `"${key_s}":${value_s}`;
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (d.length === 0) {
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
        let ${varName} = window.localStorage.getItem("${varKey}");
        if (${varName} ${checkSign} ${varValue}) {
            errors.push("localStorage item \\"" + ${varKey} + "\\" (of value \\"" + ${varValue} + \
"\\") ${checkSign} \\"" + ${varName} + "\\"");
        }
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
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
    'parseAssertWindowProperty': parseAssertWindowProperty,
    'parseAssertWindowPropertyFalse': parseAssertWindowPropertyFalse,
};
