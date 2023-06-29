// All `compare*` commands.

const { getAndSetElements, getInsertStrings, validateJson, indentString } = require('./utils.js');
const { COLOR_CHECK_ERROR } = require('../consts.js');

function parseCompareElementsTextInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple of CSS selector/XPath, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple of CSS selector/XPath, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected a tuple with 2 CSS selectors/XPathes, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`};
    }
    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsText';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, false);

    return {
        'instructions': [
            selectors +
            `${insertBefore}await page.evaluate((e1, e2) => {\n` +
            'let e1value;\n' +
            'if (e1.tagName.toLowerCase() === "input") {\n' +
                'e1value = e1.value;\n' +
            '} else {\n' +
                'e1value = e1.textContent;\n' +
            '}\n' +
            'if (e2.tagName.toLowerCase() === "input") {\n' +
                'if (e2.value !== e1value) {\n' +
                    'throw \'"\' + e1value + \'" !== "\' + e2.value + \'"\';\n' +
                '}\n' +
            '} else if (e2.textContent !== e1value) {\n' +
                'throw \'"\' + e1value + \'" !== "\' + e2.textContent + \'"\';\n' +
            '}\n' +
            `}, ${varName}1, ${varName}2);${insertAfter}`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2")
function parseCompareElementsText(parser) {
    return parseCompareElementsTextInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2")
function parseCompareElementsTextFalse(parser) {
    return parseCompareElementsTextInner(parser, true);
}

function parseCompareElementsAttributeInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length < 3 || tuple.length > 4) {
        let err = `expected 3 or 4 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'array') {
        return {
            'error': 'expected third argument to be an array of string, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple.length === 4) {
        const operators = ['<', '<=', '>', '>=', '='];

        if (tuple[3].kind !== 'string') {
            return {
                'error': 'expected fourth argument to be a string of an operator (one of ' +
                    operators.map(x => `\`${x}\``).join(', ') + '), found ' +
                    tuple[3].getArticleKind(),
            };
        } else if (operators.indexOf(tuple[3].getRaw()) === -1) {
            return {
                'error': `Unknown operator \`${tuple[3].getRaw()}\` in fourth argument. Expected ` +
                    `one of [${operators.map(x => `\`${x}\``).join(', ')}]`,
            };
        }
    }

    const operator = tuple.length === 4 ? tuple[3].getRaw() : '=';

    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getErrorText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsAttr';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    let arr = '';
    for (let i = 0; i < array.length; ++i) {
        if (i > 0) {
            arr += ',';
        }
        arr += `"${array[i].getStringValue()}"`;
    }

    let comparison;

    if (operator === '=') {
        comparison = `\
${insertBefore}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
    throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
}${insertAfter}`;
    } else {
        const matchings = {
            '<': '>=',
            '<=': '>',
            '>': '<=',
            '>=': '<',
        };
        comparison = `\
let value1 = browserUiTestHelpers.extractFloat(e1.getAttribute(attr));
if (value1 === null) {
    throw attr + " (" + e1.getAttribute(attr) + ") from \`${selector1.value}\` isn't a number so \
comparison cannot be performed";
}
let value2 = browserUiTestHelpers.extractFloat(e2.getAttribute(attr));
if (value2 === null) {
    throw attr + " (" + e2.getAttribute(attr) + ") from \`${selector2.value}\` isn't a number so \
comparison cannot be performed";
}
${insertBefore}if (value1 ${matchings[operator]} value2) {
    throw attr + ": " + e1.getAttribute(attr) + " ${matchings[operator]} " + e2.getAttribute(attr);
}${insertAfter}`;
    }

    const code = `const attributes = [${arr}];
for (const attr of attributes) {
${indentString(comparison, 1)}
}
`;

    return {
        'instructions': [
            selectors +
            'await page.evaluate((e1, e2) => {\n' +
            code +
            `}, ${varName}1, ${varName}2);`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["attr"])
function parseCompareElementsAttribute(parser) {
    return parseCompareElementsAttributeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["attr"])
function parseCompareElementsAttributeFalse(parser) {
    return parseCompareElementsAttributeInner(parser, true);
}

function parseCompareElementsCssInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'array') {
        return {
            'error': 'expected third argument to be an array of string, ' +
                `found ${tuple[2].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getErrorText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const pseudo1 = !selector1.isXPath && selector1.pseudo !== null ?
        `, "${selector1.pseudo}"` : '';

    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const pseudo2 = !selector2.isXPath && selector2.pseudo !== null ?
        `, "${selector2.pseudo}"` : '';

    const varName = 'parseCompareElementsCss';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    let arr = '';
    let needColorCheck = false;
    for (let i = 0; i < array.length; ++i) {
        const key = array[i].getStringValue();
        if (key.length === 0) {
            return {
                'error': 'Empty CSS property keys ("" or \'\') are not allowed',
            };
        }
        if (arr.length > 0) {
            arr += ',';
        }
        if (key === 'color') {
            needColorCheck = true;
        }
        arr += `"${key}"`;
    }

    const code = `const properties = [${arr}];\n` +
    'for (const css_property of properties) {\n' +
        `${insertBefore}let style1_1 = e1.style[css_property];\n` +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && ' +
            'style1_2 != style2_1 && style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + ' +
            `style1_2 + ' != ' + style2_2; }${insertAfter}\n` +
    '}\n';

    const instructions = [];
    if (needColorCheck) {
        instructions.push('if (!arg.showText) {\n' +
            `throw "${COLOR_CHECK_ERROR}";\n` +
            '}',
        );
    }
    instructions.push(
        selectors +
        'await page.evaluate((e1, e2) => {' +
        `let computed_style1 = getComputedStyle(e1${pseudo1});\n` +
        `let computed_style2 = getComputedStyle(e2${pseudo2});\n` +
        code +
        `}, ${varName}1, ${varName}2);`,
    );
    return {
        'instructions': instructions,
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["CSS properties"])
function parseCompareElementsCss(parser) {
    return parseCompareElementsCssInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["CSS properties"])
function parseCompareElementsCssFalse(parser) {
    return parseCompareElementsCssInner(parser, true);
}

function parseCompareElementsPropertyInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'array') {
        return {
            'error': 'expected third argument to be an array of string, ' +
                `found ${tuple[2].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getErrorText()}\``};
    }

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }

    const varName = 'parseCompareElementsProp';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    const code = `const ${varName}s = ${tuple[2].displayInCode()};\n` +
    `for (const property of ${varName}s) {\n` +
        `${insertBefore}const value = await ${varName}1.evaluateHandle((e, p) => {\n` +
            'return String(e[p]);\n' +
        '}, property);\n' +
        `await ${varName}2.evaluate((e, v, p) => {\n` +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
        `}, value, property);${insertAfter}\n` +
    '}';
    return {
        'instructions': [
            selectors + code,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["CSS properties"])
function parseCompareElementsProperty(parser) {
    return parseCompareElementsPropertyInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["CSS properties"])
function parseCompareElementsPropertyFalse(parser) {
    return parseCompareElementsPropertyInner(parser, true);
}

function parseCompareElementsPositionInner(parser, assertFalse) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'tuple') {
        return {
            'error': `expected third argument to be a tuple, found ${tuple[2].getArticleKind()}`,
        };
    }
    const array = tuple[2].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getErrorText()}\``};
    }

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsPos';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    let errHandling;
    if (assertFalse) {
        errHandling = 'if (err === null) { throw "comparison didn\'t fail"; }';
    } else {
        errHandling = 'if (err !== null) { throw err; }';
    }
    const sub_tuple = tuple[2].getRaw();
    let x = false;
    let y = false;
    let code = '';

    function handlePseudoX(selector, end) {
        if (selector.isXPath || selector.pseudo === null) {
            return '';
        }
        return `\
let pseudoStyle${end} = window.getComputedStyle(e${end}, "${selector.pseudo}");
let style${end} = window.getComputedStyle(e${end});
x${end} += browserUiTestHelpers.extractFloatOrZero(pseudoStyle${end}.left) - \
browserUiTestHelpers.extractFloatOrZero(style${end}.marginLeft);
`;
    }
    function handlePseudoY(selector, end) {
        if (selector.isXPath || selector.pseudo === null) {
            return '';
        }
        return `\
let pseudoStyle${end} = window.getComputedStyle(e${end}, "${selector.pseudo}");
let style${end} = window.getComputedStyle(e${end});
y${end} += browserUiTestHelpers.extractFloatOrZero(pseudoStyle${end}.top) - \
browserUiTestHelpers.extractFloatOrZero(style${end}.marginTop);
`;
    }

    for (let i = 0; i < sub_tuple.length; ++i) {
        if (sub_tuple[i].kind !== 'string') {
            return { 'error': `\`${tuple[2].getErrorText()}\` should only contain strings` };
        }
        const value = sub_tuple[i].getRaw();
        if (value === 'x') {
            if (x) {
                return {
                    'error': `Duplicated "x" value in \`${tuple[2].getErrorText()}\``,
                };
            }
            code += `\
function checkX(e1, e2) {
    let err = null;
    let x1 = e1.getBoundingClientRect().left;
${indentString(handlePseudoX(selector1, '1'), 1)}
    let x2 = e2.getBoundingClientRect().left;
${indentString(handlePseudoX(selector2, '2'), 1)}
    if (x1 !== x2) { err = "different X values: " + x1 + " != " + x2; }
    ${errHandling}
}
checkX(elem1, elem2);
`;
            x = true;
        } else if (value === 'y') {
            if (y) {
                return {
                    'error': `Duplicated "y" value in \`${tuple[2].getErrorText()}\``,
                };
            }
            code += `\
function checkY(e1, e2) {
    let err = null;
    let y1 = e1.getBoundingClientRect().top;
${indentString(handlePseudoY(selector1, '1'), 1)}
    let y2 = e2.getBoundingClientRect().top;
${indentString(handlePseudoY(selector2, '2'), 1)}
    if (y1 !== y2) { err = "different Y values: " + y1 + " != " + y2; }
    ${errHandling}
}
checkY(elem1, elem2);
`;
            y = true;
        } else {
            return {
                'error': 'Only accepted values are "x" and "y", found `' +
                    `${sub_tuple[i].getErrorText()}\` (in \`${tuple[2].getErrorText()}\`)`,
            };
        }
    }
    let instructions = selectors;
    if (code.length !== 0) {
        instructions += `\
await page.evaluate((elem1, elem2) => {
${indentString(code, 1)}}, ${varName}1, ${varName}2);`;
    }
    return {
        'instructions': [instructions],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ("x"|"y"))
function parseCompareElementsPosition(parser) {
    return parseCompareElementsPositionInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ("x"|"y"))
function parseCompareElementsPositionFalse(parser) {
    return parseCompareElementsPositionInner(parser, true);
}

function parseCompareElementsPositionNearInner(parser, assertFalse) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        let err = `expected 3 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a CSS selector or an XPath, ' +
                `found ${tuple[0].getArticleKind()}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': 'expected second argument to be a CSS selector or an XPath, ' +
                `found ${tuple[1].getArticleKind()}`,
        };
    } else if (tuple[2].kind !== 'json') {
        return {
            'error': 'expected third argument to be a JSON dict, found ' +
                tuple[2].getArticleKind(),
        };
    }

    const json = tuple[2].getRaw();
    const entries = validateJson(json, {'number': []}, 'JSON dict key');

    if (entries.error !== undefined) {
        return entries;
    }

    const selector1 = tuple[0].getSelector();
    if (selector1.error !== undefined) {
        return selector1;
    }
    const selector2 = tuple[1].getSelector();
    if (selector2.error !== undefined) {
        return selector2;
    }
    const varName = 'parseCompareElementsPosNear';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    let errHandling;
    if (assertFalse) {
        errHandling = 'if (err === null) { throw "comparison didn\'t fail"; }';
    } else {
        errHandling = 'if (err !== null) { throw err; }';
    }

    const warnings = entries.warnings;
    let code = '';
    for (const [key, value] of Object.entries(entries.values)) {
        const v = parseInt(value.value, 10);
        if (key !== 'x' && key !== 'y') {
            return {
                'error': 'Only accepted keys are "x" and "y", found `' +
                    `"${key}"\` (in \`${tuple[2].getErrorText()}\`)`,
            };
        } else if (v < 0) {
            return {
                'error': `Delta cannot be negative (in \`"${key}": ${v}\`)`,
            };
        } else if (v === 0) {
            warnings.push(
                `Delta is 0 for "${key}", maybe try to use \`compare-elements-position\` instead?`);
        }
        if (key === 'x') {
            code += `\
function checkX(e1, e2) {
    let err = null;
    let x1 = e1.getBoundingClientRect().left;
    let x2 = e2.getBoundingClientRect().left;
    let delta = Math.abs(x1 - x2);
    if (delta > ${v}) {
        err = "delta X values too large: " + delta + " > ${v}";
    }
    ${errHandling}
}
checkX(elem1, elem2);
`;
        } else if (key === 'y') {
            code += `\
function checkY(e1, e2) {
    let err = null;
    let y1 = e1.getBoundingClientRect().top;
    let y2 = e2.getBoundingClientRect().top;
    let delta = Math.abs(y1 - y2);
    if (delta > ${v}) {
        err = "delta Y values too large: " + delta + " > ${v}";
    }
    ${errHandling}
}
checkY(elem1, elem2);
`;
        }
    }

    let instructions = selectors;
    if (code.length !== 0) {
        instructions += `\
await page.evaluate((elem1, elem2) => {
${code}}, ${varName}1, ${varName}2);`;
    }
    return {
        'instructions': [instructions],
        'wait': false,
        'checkResult': true,
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", {"x"|"y": number}))
function parseCompareElementsPositionNear(parser) {
    return parseCompareElementsPositionNearInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", {"x"|"y": number})
function parseCompareElementsPositionNearFalse(parser) {
    return parseCompareElementsPositionNearInner(parser, true);
}

module.exports = {
    'parseCompareElementsAttribute': parseCompareElementsAttribute,
    'parseCompareElementsAttributeFalse': parseCompareElementsAttributeFalse,
    'parseCompareElementsCss': parseCompareElementsCss,
    'parseCompareElementsCssFalse': parseCompareElementsCssFalse,
    'parseCompareElementsPosition': parseCompareElementsPosition,
    'parseCompareElementsPositionFalse': parseCompareElementsPositionFalse,
    'parseCompareElementsPositionNear': parseCompareElementsPositionNear,
    'parseCompareElementsPositionNearFalse': parseCompareElementsPositionNearFalse,
    'parseCompareElementsProperty': parseCompareElementsProperty,
    'parseCompareElementsPropertyFalse': parseCompareElementsPropertyFalse,
    'parseCompareElementsText': parseCompareElementsText,
    'parseCompareElementsTextFalse': parseCompareElementsTextFalse,
};
