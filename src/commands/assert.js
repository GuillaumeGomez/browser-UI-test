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
    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[${varKey}], true) + "px" !== \
${varValue}) {
        localErr.push('expected \`' + ${varValue} + '\` for key \`' + ${varKey} + '\`, \
found \`' + assertComputedStyle[${varKey}] + '\` (or \`' + \
browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[${varKey}], true) + 'px\`)');
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
    const identifiers = ['CONTAINS', 'ENDS_WITH', 'STARTS_WITH', 'NEAR'];

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
                    `${tuple[0].getErrorText()}\` (${tuple[0].getArticleKind()})`,
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
    if (enabled_checks['NEAR']) {
        if (assertFalse) {
            checks.push(`\
if (Number.isNaN(${objName}[${varKey}])) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) is NaN');
} else if (Math.abs(${objName}[${varKey}] - ${varValue}) <= 1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) is within 1 of \`' + ${varValue} + '\`');
}`);
        } else {
            checks.push(`\
if (Number.isNaN(${objName}[${varKey}])) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) is NaN');
} else if (Math.abs(${objName}[${varKey}] - ${varValue}) > 1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + ${objName}[${varKey}] + '\
\`) is not within 1 of \`' + ${varValue} + '\`');
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
                `\`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
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
    if (enabled_checks['NEAR']) {
        if (assertFalse) {
            checks.push(`\
if (Number.isNaN(e[${varKey}])) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) is NaN');
} else if (Math.abs(e[${varKey}] - ${varValue}) <= 1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) is within 1 of \`' + ${varValue} + '\`');
}`);
        } else {
            checks.push(`\
if (Number.isNaN(e[${varKey}])) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) is NaN');
} else if (Math.abs(e[${varKey}] - ${varValue}) > 1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + e[${varKey}] + '\
\`) is not within 1 of \`' + ${varValue} + '\`');
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
    const identifiers = ['ALL', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'NEAR'];
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
                `\`${tuple[1].getErrorText()}\` (${tuple[1].getArticleKind()})`,
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
    if (enabled_checks['NEAR']) {
        if (assertFalse) {
            checks.push(`\
if (Number.isNaN(attr)) {
    nonMatchingProps.push('attribute \`' + ${varKey} + '\` (\`' + attr + '\
\`) is NaN');
} else if (Math.abs(attr] - ${varValue}) <= 1) {
    nonMatchingProps.push('attribute \`' + ${varKey} + '\` (\`' + attr + '\
\`) is within 1 of \`' + ${varValue} '\`');
}`);
        } else {
            checks.push(`\
if (Number.isNaN(attr)) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + attr + '\
\`) is NaN');
} else if (Math.abs(attr - ${varValue}) > 1) {
    nonMatchingProps.push('Property \`' + ${varKey} + '\` (\`' + attr + '\
\`) is not within 1 of \`' + ${varValue} '\`');
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
        return {'error': `expected 2 elements in the tuple, found ${tuple.length}`};
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
    const enabled_checks = Object.create(null);

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
            'error': `expected second argument to be a string, found \`${tuple[1].getRaw()}\``,
        };
    } else if (tuple.length === 3) {
        const ret = fillEnabledChecks(tuple[2], identifiers, enabled_checks, warnings, 'third');
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

    const value = tuple[1].getStringValue();
    const varName = 'parseAssertElemStr';

    const checks = [];
    if (enabled_checks['CONTAINS']) {
        if (assertFalse) {
            checks.push(`\
if (browserUiTestHelpers.elemTextContains(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` contains \`" + value + "\` \
(for CONTAINS check)");
}`);
        } else {
            checks.push(`\
if (!browserUiTestHelpers.elemTextContains(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` doesn't contain \`" + \
value + "\` (for CONTAINS check)");
}`);
        }
    }
    if (enabled_checks['STARTS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (browserUiTestHelpers.elemTextStartsWith(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` starts with \`" + value \
+ "\` (for STARTS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!browserUiTestHelpers.elemTextStartsWith(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` doesn't start with \`" + \
value + "\` (for STARTS_WITH check)");
}`);
        }
    }
    if (enabled_checks['ENDS_WITH']) {
        if (assertFalse) {
            checks.push(`\
if (browserUiTestHelpers.elemTextEndsWith(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` ends with \`" + value + \
"\` (for ENDS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!browserUiTestHelpers.elemTextEndsWith(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` doesn't end with \`" + \
value + "\` (for ENDS_WITH check)");
}`);
        }
    }
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (browserUiTestHelpers.compareElemText(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` is equal to \`" + value \
+ "\`");
}`);
        } else {
            checks.push(`\
if (!browserUiTestHelpers.compareElemText(e, value)) {
    errors.push("\`" + browserUiTestHelpers.getElemText(e, value) + "\` isn't equal to \`" + \
value + "\`");
}`);
        }
    }

    let whole = getAndSetElements(selector, varName, enabled_checks['ALL'] === true) + '\n';
    let indent = 0;
    if (enabled_checks['ALL'] === true) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
        indent = 1;
    }
    whole += indentString(`\
await page.evaluate(e => {
    const errors = [];
    const value = "${value}";
${indentString(checks.join('\n'), 1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
`, indent);
    if (enabled_checks['ALL'] === true) {
        whole += `    }, ${varName}[i]);
}`;
    } else {
        whole += `}, ${varName});`;
    }

    return {
        'instructions': [whole],
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

    const json = selector.tuple[1].getRaw();

    const entries = validateJson(json, ['number'], 'JSON dict key');

    if (entries.error !== undefined) {
        return entries;
    }

    const varName = 'parseAssertPosition';

    let checks = '';
    for (const [key, value] of Object.entries(entries.values)) {
        if (key === 'x') {
            checks += `\ncheckAssertPosBrowser(elem, 'left', 'marginLeft', 'X', ${value}, errors);`;
        } else if (key === 'y') {
            checks += `\ncheckAssertPosBrowser(elem, 'top', 'marginTop', 'Y', ${value}, errors);`;
        } else {
            return {
                'error': 'Only accepted keys are "x" and "y", found `' +
                    `"${key}"\` (in \`${selector.tuple[1].getErrorText()}\`)`,
            };
        }
    }

    let extra = '';
    if (isPseudo) {
        extra += `
let pseudoStyle = window.getComputedStyle(e, "${selector.pseudo}");
let style = window.getComputedStyle(e);
v += browserUiTestHelpers.extractFloatOrZero(pseudoStyle[field]) - \
browserUiTestHelpers.extractFloatOrZero(style[styleField]);`;
    }

    let check;
    if (assertFalse) {
        check = `\
if (v === value || roundedV === Math.round(value)) {
    errors.push("same " + kind + " values (whereas it shouldn't): " + v + " (or " + roundedV + ") \
!= " + value);
}`;
    } else {
        check = `\
if (v !== value && roundedV !== Math.round(value)) {
    errors.push("different " + kind + " values: " + v + " (or " + roundedV + ") != " + value);
}`;
    }

    const code = `\
function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
    let v = e.getBoundingClientRect()[field];${indentString(extra, 1)}
    let roundedV = Math.round(v);
${indentString(check, 1)}
}${checks}`;

    let whole = getAndSetElements(selector, varName, checkAllElements) + '\n';
    let indent = 0;
    if (checkAllElements) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
        indent = 1;
    }
    whole += indentString(`\
await page.evaluate(elem => {
    const errors = [];
${indentString(code, 1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
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
if (Number.isNaN(value1])) {
    nonMatchingProps.push('\`' + value1 + '\` is NaN');
} else if (Math.abs(value1 - value2) <= 1) {
    nonMatchingProps.push('\`' + value1 + '\` is within 1 of \`' + value2 '\`');
}`);
        } else {
            checks.push(`\
if (Number.isNaN(value1])) {
    nonMatchingProps.push('\`' + value1 + '\` is NaN');
} else if (Math.abs(value1 - value2) > 1) {
    nonMatchingProps.push('\`' + value1 + '\` is not within 1 of \`' + value2 '\`');
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
    const errs = errors.join(", ");
    throw "The following errors happened: [" + errs + "]";
}`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
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
    'parseAssertVariable': parseAssertVariable,
    'parseAssertVariableFalse': parseAssertVariableFalse,
    'parseAssertWindowProperty': parseAssertWindowProperty,
    'parseAssertWindowPropertyFalse': parseAssertWindowPropertyFalse,
};
