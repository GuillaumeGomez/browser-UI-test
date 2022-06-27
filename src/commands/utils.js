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
            'error': 'invalid syntax: expected "([number], [number])", ' +
                `found \`${tuple.getText()}\``,
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

function validateJson(json, allowedValueTypes, keyName) {
    const entries = Object.create(null);
    const warnings = [];

    for (const entry of json) {
        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getText()}\``);
            continue;
        } else if (allowedValueTypes.indexOf(entry['value'].kind) === -1) {
            let allowed = '';
            for (let i = 0; i < allowedValueTypes.length - 1; ++i) {
                if (allowed.length !== 0) {
                    allowed += ', ';
                }
                allowed += allowedValueTypes[i];
            }
            if (allowed.length !== 0) {
                allowed += ' and ';
            }
            allowed += allowedValueTypes[allowedValueTypes.length - 1];
            const article = allowedValueTypes.length > 1 ? 'are' : 'is';
            return {
                'error': `only ${allowed} ${article} allowed, found \`` +
                    `${entry['value'].getText()}\` (${entry['value'].getArticleKind()})`,
            };
        }
        const key_s = entry['key'].getStringValue();
        if (key_s.length < 1) {
            return {
                'error': 'empty name of properties ("" or \'\') are not allowed',
            };
        }
        if (Object.prototype.hasOwnProperty.call(entries, key_s)) {
            return {
                'error': `${keyName} \`${key_s}\` is duplicated`,
            };
        }
        const value_s = entry['value'].getStringValue();
        entries[key_s] = value_s;
    }
    return {
        'values': entries,
        'warnings': warnings.length > 0 ? warnings : undefined,
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
        return {'error': 'invalid number of values in the tuple, read the documentation to see ' +
                    'the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': `expected JSON dictionary as second argument, found \`${tuple[1].getText()}\``,
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
                    `), found an array of \`${array[0].kind}\` (in \`${elem.getText()}\`)`,
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

function buildPropertyDict(entries, errorText, allowEmptyValues) {
    const ret = {
        'needColorCheck': false,
        'dict': '',
    };

    // JSON.stringify produces a problematic output so instead we use this.
    for (const [k, v] of Object.entries(entries.values)) {
        if (v.length === 0 && allowEmptyValues !== true) {
            return {
                'error': `Empty values are not allowed: \`${k}\` has an empty value`,
            };
        } else if (k.length === 0) {
            return {
                'error': `Empty ${errorText} keys ("" or '') are not allowed`,
            };
        }
        if (k === 'color') {
            ret['needColorCheck'] = true;
        }
        if (ret['dict'].length > 0) {
            ret['dict'] += ',';
        }
        ret['dict'] += `"${k}":"${v}"`;
    }
    return ret;
}

module.exports = {
    'getAndSetElements': getAndSetElements,
    'checkIntegerTuple': checkIntegerTuple,
    'validateJson': validateJson,
    'getInsertStrings': getInsertStrings,
    'getAssertSelector': getAssertSelector,
    'fillEnabledChecks': fillEnabledChecks,
    'buildPropertyDict': buildPropertyDict,
};
