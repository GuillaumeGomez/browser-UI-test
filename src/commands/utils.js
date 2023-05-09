// Utility functions used by the command parsing functions.

function getAndSetElements(selector, varName, checkAllElements) {
    let code;
    if (selector.isXPath) {
        code = `let ${varName} = await page.$x("${selector.value}");\n` +
        `if (${varName}.length === 0) { throw 'XPath "${selector.value}" not found'; }`;
        if (!checkAllElements) {
            code += `\n${varName} = ${varName}[0];`;
        }
    } else if (!checkAllElements) {
        code = `let ${varName} = await page.$("${selector.value}");\n` +
        `if (${varName} === null) { throw '"${selector.value}" not found'; }`;
    } else {
        code = `let ${varName} = await page.$$("${selector.value}");\n` +
        `if (${varName}.length === 0) { throw '"${selector.value}" not found'; }`;
    }
    return code;
}

function checkIntegerTuple(tuple, text1, text2, negativeCheck = false) {
    const value = tuple.getRaw();
    if (value.length !== 2 || value[0].kind !== 'number' || value[1].kind !== 'number') {
        return {
            'error': `expected "([number], [number])", found \`${tuple.getErrorText()}\``,
        };
    }
    const ret = value[0].getIntegerValue(text1, negativeCheck);
    if (ret.error !== undefined) {
        return ret;
    }
    const ret2 = value[1].getIntegerValue(text2, negativeCheck);
    if (ret2.error !== undefined) {
        return ret2;
    }
    return {'value': [ret.value, ret2.value]};
}

function validateJson(json, allowedValueTypes, keyName, allowedKeys = null) {
    const entries = Object.create(null);
    const warnings = [];

    for (const entry of json) {
        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getErrorText()}\``);
            continue;
        } else if (!Object.prototype.hasOwnProperty.call(allowedValueTypes, entry['value'].kind)) {
            let allowed = '';
            const types = Object.keys(allowedValueTypes);
            // Keep this loop like this because of `length - 1`!!
            for (let i = 0; i < types.length - 1; ++i) {
                if (allowed.length !== 0) {
                    allowed += ', ';
                }
                allowed += types[i];
            }
            if (allowed.length !== 0) {
                allowed += ' and ';
            }
            allowed += types[types.length - 1];
            const article = types.length > 1 ? 'are' : 'is';
            const extra = types.length > 1 ? 's' : '';
            return {
                'error': `only ${allowed} type${extra} ${article} allowed as value, found \`` +
                    `${entry['value'].getErrorText()}\` (${entry['value'].getArticleKind()})`,
            };
        }
        const key_s = entry['key'].getStringValue();
        if (key_s.length < 1) {
            return {
                'error': 'empty name of properties ("" or \'\') are not allowed',
            };
        }
        const kind = entry['value'].kind;
        const value_s = entry['value'].getStringValue();
        const allowedValues = allowedValueTypes[kind];
        // If `allowedValues` is empty, all values are allowed. Otherwise, only the provided values
        // can be used.
        if (allowedValues.length !== 0 && allowedValues.indexOf(value_s) === -1) {
            return {
                'error': `Forbidden \`${kind}\` used (\`${value_s}\`). Allowed idents: \
[${allowedValues.join(', ')}]`,
            };
        }
        if (Object.prototype.hasOwnProperty.call(entries, key_s)) {
            return {
                'error': `${keyName} \`${key_s}\` is duplicated`,
            };
        } else if (allowedKeys !== null && allowedKeys.indexOf(key_s) === -1) {
            return {
                'error': `Unexpected key \`${key_s}\`, allowed keys: [${allowedKeys.join(', ')}]`,
            };
        }
        entries[key_s] = {
            'value': value_s,
            'kind': kind,
        };
    }
    return {
        'values': entries,
        'warnings': warnings,
    };
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

function getAssertSelector(parser) {
    const err = 'expected a tuple, read the documentation to see the accepted inputs';
    const elems = parser.elems;

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
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': `expected JSON dictionary as second argument, found \
\`${tuple[1].getErrorText()}\``,
        };
    } else if (tuple.length === 3) {
        if (tuple[2].kind !== 'ident') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${tuple[2].getRaw()}\``,
            };
        } else if (tuple[2].getRaw() !== 'ALL') {
            return {
                'error': 'expected identifier `ALL` as third argument or nothing, found `' +
                    `${tuple[2].getRaw()}\``,
            };
        }
    }

    const selector = tuple[0].getSelector();
    if (tuple.length === 3) {
        // We already checked it above so let's go!
        selector.checkAllElements = true;
    }
    selector.tuple = tuple;
    return selector;
}

function fillEnabledChecks(elem, identifiers, enabled_checks, warnings, err_pos) {
    if (elem.kind === 'ident') {
        if (identifiers.indexOf(elem.getRaw()) === -1) {
            return {
                'error': `unknown identifier \`${elem.getRaw()}\`. Available identifiers ` +
                    'are: [' + identifiers.map(x => `\`${x}\``).join(', ') + ']',
            };
        }
        enabled_checks[elem.getRaw()] = true;
    } else if (elem.kind === 'array') {
        const array = elem.getRaw();
        const duplicated = Object.create(null);

        if (array.length > 0 && array[0].kind !== 'ident') {
            return {
                'error': `expected an identifier or an array of identifiers as ${err_pos} ` +
                    'argument (among ' + identifiers.map(x => `\`${x}\``).join(', ') +
                    `), found an array of \`${array[0].kind}\` (in \`${elem.getErrorText()}\`)`,
            };
        }

        for (const entry of array) {
            if (identifiers.indexOf(entry.getRaw()) === -1) {
                return {
                    'error': `unknown identifier \`${entry.getRaw()}\`. Available identifiers` +
                        ' are: [' + identifiers.map(x => `\`${x}\``).join(', ') + ']',
                };
            }
            if (enabled_checks[entry.getRaw()] === true) {
                duplicated[entry.getRaw()] = true;
            } else {
                enabled_checks[entry.getRaw()] = true;
            }
        }
        for (const duplicata of Object.keys(duplicated)) {
            warnings.push(
                `\`${duplicata}\` is present more than once in the ${err_pos} argument array`);
        }
    } else {
        return {
            'error': 'expected an identifier or an array of identifiers (among ' +
                identifiers.map(x => `\`${x}\``).join(', ') +
                `) as ${err_pos} argument or nothing, found \`${elem.getRaw()}\` ` +
                `(${elem.getArticleKind()})`,
        };
    }
    return null;
}

function makeExtendedChecks(enabledChecks, assertFalse, pushTo, kind, storedVar, varKey, varValue) {
    const checks = [];

    if (enabledChecks['CONTAINS']) {
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
    if (enabledChecks['STARTS_WITH']) {
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
    if (enabledChecks['ENDS_WITH']) {
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
    if (enabledChecks['NEAR']) {
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
    // eslint-disable-next-line no-extra-parens
    const hasSpecialChecks = (enabledChecks['ALL'] && checks.length > 1) || checks.length !== 0;
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

    if (enabledChecks['CONTAINS']) {
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
    if (enabledChecks['STARTS_WITH']) {
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
    if (enabledChecks['ENDS_WITH']) {
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

function buildPropertyDict(entries, errorText, allowEmptyValues, valuesAsStrings = true) {
    const ret = {
        'needColorCheck': false,
        'dict': '',
        'keys': [],
        'values': [],
    };

    // JSON.stringify produces a problematic output so instead we use this.
    for (const [k, v] of Object.entries(entries.values)) {
        if (k.length === 0) {
            return {
                'error': `Empty ${errorText} keys ("" or '') are not allowed`,
            };
        } else if (v.value.length === 0 && allowEmptyValues !== true) {
            return {
                'error': `Empty values are not allowed: \`${k}\` has an empty value`,
            };
        }
        if (k === 'color') {
            ret['needColorCheck'] = true;
        }
        if (ret['dict'].length > 0) {
            ret['dict'] += ',';
        }
        if (valuesAsStrings === true) {
            ret['dict'] += `"${k}":"${v.value}"`;
            ret['values'].push(`"${v.value}"`);
        } else {
            ret['dict'] += `"${k}":${v.value}`;
            ret['values'].push(`${v.value}`);
        }
        ret['keys'].push(`"${k}"`);
    }
    return ret;
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

function checkJsonEntry(json, callback) {
    const warnings = [];

    for (const entry of json) {
        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getErrorText()}\``);
            continue;
        } else if (entry['value'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getErrorText()}\``);
            continue;
        }
        callback(entry);
    }
    return warnings;
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

module.exports = {
    'getAndSetElements': getAndSetElements,
    'checkIntegerTuple': checkIntegerTuple,
    'validateJson': validateJson,
    'getInsertStrings': getInsertStrings,
    'getAssertSelector': getAssertSelector,
    'fillEnabledChecks': fillEnabledChecks,
    'buildPropertyDict': buildPropertyDict,
    'indentString': indentString,
    'checkJsonEntry': checkJsonEntry,
    'makeExtendedChecks': makeExtendedChecks,
    'makeTextExtendedChecks': makeTextExtendedChecks,
    'getSizes': getSizes,
};
