// Utility functions used by the command parsing functions.

function getAndSetElements(selector, varName, checkAllElements) {
    const selectorS = selector.isXPath ? `::-p-xpath(${selector.value})` : selector.value;
    if (!checkAllElements) {
        return `\
const ${varName} = await page.$("${selectorS}");
if (${varName} === null) { throw '"${selector.value}" not found'; }`;
    }
    return `\
const ${varName} = await page.$$("${selectorS}");
if (${varName}.length === 0) { throw '"${selector.value}" not found'; }`;
}

function getInsertStrings(assertFalse, insideLoop, extra = '', backlineAtEnd = true) {
    const backlineStart = backlineAtEnd === true ? '' : '\n';
    const backlineEnd = backlineAtEnd === true ? '\n' : '';
    const insertBefore = `${backlineStart}try {${backlineEnd}`;

    if (assertFalse) {
        if (insideLoop) {
            // We want to check ALL elements, not return at the first successful one!
            return [insertBefore, `\n} catch(e) { continue; } throw "assert didn't fail${extra}";`];
        } else {
            return [insertBefore, `\n} catch(e) { return; } throw "assert didn't fail${extra}";`];
        }
    }
    return ['', ''];
}

function fillEnabledChecksV2(elem, enabled_checks, warnings, err_pos) {
    if (elem.kind === 'ident') {
        enabled_checks.add(elem.value.getRaw());
    } else if (elem.kind === 'array') {
        const array = elem.value.entries;
        const warned = new Set();

        for (const entry of array) {
            const v = entry.getRaw();
            if (enabled_checks.has(v)) {
                if (!warned.has(v)) {
                    warned.add(v);
                    warnings.push(
                        `\`${v}\` is present more than once in the ${err_pos} argument array`);
                }
            }
            enabled_checks.add(v);
        }
    } else {
        return {
            error: `expected an ident or an array, found \`${elem}\``,
        };
    }
    return null;
}

function makeExtendedChecks(enabledChecks, assertFalse, pushTo, kind, storedVar, varKey, varValue) {
    const checks = [];

    if (enabledChecks.has('CONTAINS')) {
        if (assertFalse) {
            checks.push(`\
if (${storedVar}.includes(${varValue})) {
    ${pushTo}.push("assert didn't fail for ${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + \
"\`) (for CONTAINS check)");
}`);
        } else {
            checks.push(`\
if (!${storedVar}.includes(${varValue})) {
    ${pushTo}.push("${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + "\`) doesn't contain \`"\
 + ${varValue} + "\` (for CONTAINS check)");
}`);
        }
    }
    if (enabledChecks.has('STARTS_WITH')) {
        if (assertFalse) {
            checks.push(`\
if (${storedVar}.startsWith(${varValue})) {
    ${pushTo}.push("assert didn't fail for ${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + \
"\`) (for STARTS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!${storedVar}.startsWith(${varValue})) {
    ${pushTo}.push("${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + "\`) doesn't start with \
\`" + ${varValue} + "\` (for STARTS_WITH check)");
}`);
        }
    }
    if (enabledChecks.has('ENDS_WITH')) {
        if (assertFalse) {
            checks.push(`\
if (${storedVar}.endsWith(${varValue})) {
    ${pushTo}.push("assert didn't fail for ${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + \
"\`) (for ENDS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!${storedVar}.endsWith(${varValue})) {
    ${pushTo}.push("${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + "\`) doesn't end with \`"\
 + ${varValue} + "\`");
}`);
        }
    }
    if (enabledChecks.has('NEAR')) {
        checks.push(`\
const tmpNb = parseFloat(${storedVar});
const tmpNb2 = parseFloat(${varValue});
if (Number.isNaN(tmpNb)) {
    ${pushTo}.push('${kind} \`' + ${varKey} + '\` (\`' + ${storedVar} + '\`) is NaN (for \
NEAR check)');
} else if (Number.isNaN(tmpNb2)) {
    ${pushTo}.push('provided value for \`' + ${varKey} + '\` is NaN (for NEAR check)');
`);
        if (assertFalse) {
            checks[checks.length - 1] += `\
} else if (Math.abs(tmpNb - tmpNb2) <= 1) {
    ${pushTo}.push('${kind} \`' + ${varKey} + '\` (\`' + ${storedVar} + '\`) is within 1 of \`' + \
${varValue} + '\` (for NEAR check)');
}`;
        } else {
            checks[checks.length - 1] += `\
} else if (Math.abs(${storedVar} - ${varValue}) > 1) {
    ${pushTo}.push('${kind} \`' + ${varKey} + '\` (\`' + ${storedVar} + '\`) is not within 1 of \
\`' + ${varValue} + '\` (for NEAR check)');
}`;
        }
    }
    const hasSpecialChecks = checks.length !== 0;
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (${storedVar} === ${varValue}) {
    ${pushTo}.push("assert didn't fail for ${kind} \`" + ${varKey} + "\` (\`" + ${storedVar} + \
"\`)");
}`);
        } else {
            checks.push(`\
if (${storedVar} !== ${varValue}) {
    ${pushTo}.push("expected \`" + ${varValue} + "\` for ${kind} \`" + ${varKey} + "\`, found \`" \
+ ${storedVar} + "\`");
}`);
        }
    }

    return {
        'checks': checks,
        'hasSpecialChecks': hasSpecialChecks,
    };
}

function makeTextExtendedChecks(enabledChecks, assertFalse) {
    const checks = [];

    if (enabledChecks.has('CONTAINS')) {
        if (assertFalse) {
            checks.push(`\
if (elemText.includes(value)) {
    errors.push("\`" + elemText + "\` contains \`" + value + "\` (for CONTAINS check)");
}`);
        } else {
            checks.push(`\
if (!elemText.includes(value)) {
    errors.push("\`" + elemText + "\` doesn't contain \`" + value + "\` (for CONTAINS check)");
}`);
        }
    }
    if (enabledChecks.has('STARTS_WITH')) {
        if (assertFalse) {
            checks.push(`\
if (elemText.startsWith(value)) {
    errors.push("\`" + elemText + "\` starts with \`" + value + "\` (for STARTS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!elemText.startsWith(value)) {
    errors.push("\`" + elemText + "\` doesn't start with \`" + value + "\` (for STARTS_WITH \
check)");
}`);
        }
    }
    if (enabledChecks.has('ENDS_WITH')) {
        if (assertFalse) {
            checks.push(`\
if (elemText.endsWith(value)) {
    errors.push("\`" + elemText + "\` ends with \`" + value + "\` (for ENDS_WITH check)");
}`);
        } else {
            checks.push(`\
if (!elemText.endsWith(value)) {
    errors.push("\`" + elemText + "\` doesn't end with \`" + value + "\` (for ENDS_WITH check)");
}`);
        }
    }
    if (checks.length === 0) {
        if (assertFalse) {
            checks.push(`\
if (elemText === value) {
    errors.push("\`" + elemText + "\` is equal to \`" + value + "\`");
}`);
        } else {
            checks.push(`\
if (elemText !== value) {
    errors.push("\`" + elemText + "\` isn't equal to \`" + value + "\`");
}`);
        }
    }
    return checks;
}

function indentString(s, indentLevel) {
    let indent = '';

    if (indentLevel < 1 || s.length === 0) {
        return s;
    }
    while (indentLevel > 0) {
        indent += '    ';
        indentLevel -= 1;
    }
    const parts = s.split('\n');
    return parts.map(p => {
        if (p.length > 0) {
            return `${indent}${p}`;
        }
        return p;
    }).join('\n');
}

function validatePositionDictV2(json) {
    let checks = '';
    for (const [key, value] of json) {
        if (key === 'x') {
            checks += `
checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', ${value.value}, innerErrors);`;
        } else if (key === 'y') {
            checks += `
checkAssertPosBrowser(elem, 'top', 'marginTop', 'Y', ${value.value}, innerErrors);`;
        }
    }
    return checks;
}

function commonPositionCheckCode(
    selector, checks, checkAllElements, varName, errorsVarName, assertFalse,
) {
    const isPseudo = !selector.isXPath && selector.pseudo !== null;

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

    const pseudo = isPseudo ? selector.pseudo : '';
    const code = `\
function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
    const v = browserUiTestHelpers.getElementPosition(e, "${pseudo}", field, styleField);
    const roundedV = Math.round(v);
${indentString(check, 1)}
}${checks}`;

    let indent = 0;
    let whole = `const ${errorsVarName} = [];\n`;
    if (checkAllElements) {
        whole += `for (let i = 0, len = ${varName}.length; i < len; ++i) {\n`;
        indent = 1;
    }
    whole += indentString(`\
${errorsVarName}.push(...await page.evaluate(elem => {
    const innerErrors = [];
${indentString(code, 1)}
    return innerErrors;
`, indent);
    if (checkAllElements) {
        whole += `    }, ${varName}[i]));
    if (${errorsVarName}.length !== 0) {
        break;
    }
}`;
    } else {
        whole += `}, ${varName}));`;
    }
    return whole;
}

function getSizes(selector) {
    const isPseudo = !selector.isXPath && selector.pseudo !== null;

    // To get the size of a pseudo element, we need to get the computed style for it. There is
    // one thing to be careful about: if the `box-sizing` is "border-box", "height" and "width"
    // already include the border and the padding.
    if (isPseudo) {
        return `\
const style = getComputedStyle(e, "${selector.pseudo}");
let height = parseFloat(style["height"]);
let width = parseFloat(style["width"]);
if (style["box-sizing"] !== "border-box") {
    height += parseFloat(style["padding-top"]) + parseFloat(style["padding-bottom"]);
    height += parseFloat(style["border-top-width"]) + parseFloat(style["border-bottom-width"]);
    width += parseFloat(style["padding-left"]) + parseFloat(style["padding-right"]);
    width += parseFloat(style["border-left-width"]) + parseFloat(style["border-right-width"]);
}`;
    }
    return `\
const height = e.offsetHeight;
const width = e.offsetWidth;`;
}

function commonSizeCheckCode(
    selector, checkAllElements, assertFalse, json, varName, errorsVarName,
) {
    const checks = [];
    const width = json.get('width');
    if (width !== undefined) {
        if (assertFalse) {
            checks.push(`\
if (width === ${width.value}) {
    innerErrors.push("width is equal to \`${width.value}\`");
}`);
        } else {
            checks.push(`\
if (width !== ${width.value}) {
    innerErrors.push("expected a width of \`${width.value}\`, found \`" + width + "\`");
}`);
        }
    }

    const height = json.get('height');
    if (height !== undefined) {
        if (assertFalse) {
            checks.push(`\
if (height === ${height.value}) {
    innerErrors.push("height is equal to \`${height.value}\`");
}`);
        } else {
            checks.push(`\
if (height !== ${height.value}) {
    innerErrors.push("expected a height of \`${height.value}\`, found \`" + height + "\`");
}`);
        }
    }

    let checker;
    if (checkAllElements) {
        checker = `\
for (const elem of ${varName}) {
    ${errorsVarName}.push(...await checkElemSize(elem));
    if (${errorsVarName}.length !== 0) {
        break;
    }
}`;
    } else {
        checker = `${errorsVarName}.push(...await checkElemSize(${varName}));`;
    }

    return `\
async function checkElemSize(elem) {
    return await elem.evaluate(e => {
        const innerErrors = [];
${indentString(getSizes(selector), 2)}
${indentString(checks.join('\n'), 2)}
        return innerErrors;
    });
}
const ${errorsVarName} = [];
${checker}`;
}

function generateCheckObjectPaths() {
    return `\
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
}`;
}

module.exports = {
    'getAndSetElements': getAndSetElements,
    'getInsertStrings': getInsertStrings,
    'fillEnabledChecksV2': fillEnabledChecksV2,
    'indentString': indentString,
    'makeExtendedChecks': makeExtendedChecks,
    'makeTextExtendedChecks': makeTextExtendedChecks,
    'getSizes': getSizes,
    'validatePositionDictV2': validatePositionDictV2,
    'commonPositionCheckCode': commonPositionCheckCode,
    'commonSizeCheckCode': commonSizeCheckCode,
    'generateCheckObjectPaths': generateCheckObjectPaths,
};
