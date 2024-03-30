// All `compare*` commands.

const {
    getAndSetElements, getInsertStrings, indentString, getSizes, generateCheckObjectPaths,
} = require('./utils.js');
const { COLOR_CHECK_ERROR } = require('../consts.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

function parseCompareElementsTextInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;
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
    const operators = ['<', '<=', '>', '>=', '='];
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'array',
                    valueTypes: {
                        'string': {},
                    },
                },
                {
                    kind: 'string',
                    allowed: operators,
                    optional: true,
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;
    const attrs = tuple[2].value.entries.map(e => `"${e.getStringValue()}"`).join(',');

    const operator = tuple.length === 4 ? tuple[3].value.getRaw() : '=';

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);

    const varName = 'parseCompareElementsAttr';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

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

    const code = `const attributes = [${attrs}];
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
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["attr"], "operator")
function parseCompareElementsAttribute(parser) {
    return parseCompareElementsAttributeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ["attr"])
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2, ["attr"], "operator")
function parseCompareElementsAttributeFalse(parser) {
    return parseCompareElementsAttributeInner(parser, true);
}

function parseCompareElementsCssInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'array',
                    allowEmptyValues: false,
                    valueTypes: {
                        'string': {},
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;
    const needColorCheck = tuple[2].value.entries.some(e => e.getStringValue() === 'color');

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);
    const pseudo1 = !selector1.isXPath && selector1.pseudo !== null ?
        `, "${selector1.pseudo}"` : '';
    const pseudo2 = !selector2.isXPath && selector2.pseudo !== null ?
        `, "${selector2.pseudo}"` : '';

    const varName = 'parseCompareElementsCss';
    const selectors = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';

    const code = `\
const properties = ${tuple[2].value.displayInCode()};
for (const css_prop of properties) {
    ${insertBefore}let style1_1 = e1.style[css_prop];
    let style1_2 = computed_style1[css_prop];
    let style2_1 = e2.style[css_prop];
    let style2_2 = computed_style2[css_prop];
    if (style1_1 != style2_1 && style1_1 != style2_2 &&
        style1_2 != style2_1 && style1_2 != style2_2)
    {
        throw 'CSS property \`' + css_prop + '\` did not match: ' + style1_2 + ' != ' + style2_2;
    }${insertAfter}
}
`;

    const instructions = [];
    if (needColorCheck) {
        instructions.push(
            `\
if (!arg.showText) {
    throw "${COLOR_CHECK_ERROR}";
}`,
        );
    }
    instructions.push(
        `\
${selectors}
await page.evaluate((e1, e2) => {
    let computed_style1 = getComputedStyle(e1${pseudo1});
    let computed_style2 = getComputedStyle(e2${pseudo2});
${indentString(code, 1)}
}, ${varName}1, ${varName}2);`,
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

// * ("selector 1, "selector 2", ["object paths"])
function parseCompareElementsPropertyInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'array',
                    allowEmptyValues: false,
                    valueTypes: {
                        'string': {},
                        'object-path': {},
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;

    const [insertBefore, insertAfter] = getInsertStrings(assertFalse, true);
    const elems = tuple[2].value.value.map(e => {
        const ret = e.getStringValue();
        return e.kind === 'object-path' ? ret : `["${ret}"]`;
    });

    const varName = 'parseCompareElementsProp';
    const code = `\
${getAndSetElements(selector1, varName + '1', false)}
${getAndSetElements(selector2, varName + '2', false)}
const ${varName}s = [${elems}];
for (const property of ${varName}s) {
    ${insertBefore}const value = await ${varName}1.evaluateHandle((e, p) => {
${indentString(generateCheckObjectPaths(), 2)}
        let ret = 'undefined';
        checkObjectPaths(e, p, found => ret = String(found), notFound => {});
        return ret;
    }, property);
    await ${varName}2.evaluate((e, v, p) => {
${indentString(generateCheckObjectPaths(), 2)}
        let ret = 'undefined';
        checkObjectPaths(e, p, found => ret = String(found), notFound => {});
        if (v !== ret) {
            throw p + ": \`" + v + "\` !== \`" + ret + "\`";
        }
    }, value, property);${insertAfter}
}`;
    return {
        'instructions': [code],
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

function handlePseudo(selector, end) {
    if (selector.isXPath || selector.pseudo === null) {
        return '';
    }
    return `\
const pseudoStyle${end} = window.getComputedStyle(e${end}, "${selector.pseudo}");
const style${end} = window.getComputedStyle(e${end});
val${end} += browserUiTestHelpers.extractFloatOrZero(pseudoStyle${end}[property]) - \
browserUiTestHelpers.extractFloatOrZero(style${end}["margin-" + property]);
`;
}

function parseCompareElementsPositionInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'array',
                    valueTypes: {
                        'string': {
                            allowed: ['x', 'y'],
                        },
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;

    let errHandling;
    if (assertFalse) {
        errHandling = 'if (err === null) { throw "comparison didn\'t fail"; }';
    } else {
        errHandling = 'if (err !== null) { throw err; }';
    }

    let x = false;
    let y = false;
    let code = `\
function browserComparePosition(e1, e2, kind, property) {
    let err = null;
    let val1 = e1.getBoundingClientRect()[property];
${indentString(handlePseudo(selector1, '1'), 1)}\
    let val2 = e2.getBoundingClientRect()[property];
${indentString(handlePseudo(selector2, '2'), 1)}\
    if (val1 !== val2) { err = "different " + kind + " values: " + val1 + " != " + val2; }
    ${errHandling}
}
`;

    for (const value of tuple[2].value.entries) {
        if (value.value === 'x') {
            if (x) {
                return {
                    'error': `Duplicated "x" value in \`${tuple[2].value.getErrorText()}\``,
                };
            }
            code += 'browserComparePosition(elem1, elem2, "X", "left");\n';
            x = true;
        } else if (value.value === 'y') {
            if (y) {
                return {
                    'error': `Duplicated "y" value in \`${tuple[2].value.getErrorText()}\``,
                };
            }
            code += 'browserComparePosition(elem1, elem2, "Y", "top");\n';
            y = true;
        }
    }

    const varName = 'parseCompareElementsPos';
    let instructions = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';
    if (x || y) {
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
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'json',
                    keyTypes: {
                        'string': ['x', 'y'],
                    },
                    valueTypes: {
                        'number': {
                            allowNegative: false,
                            allowFloat: false,
                        },
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;
    const json = tuple[2].value;

    let errHandling;
    if (assertFalse) {
        errHandling = 'if (err === null) { throw "comparison didn\'t fail"; }';
    } else {
        errHandling = 'if (err !== null) { throw err; }';
    }

    let code = `\
function browserComparePositionNear(e1, e2, kind, property, maxDelta) {
    let err = null;
    let val1 = e1.getBoundingClientRect()[property];
${indentString(handlePseudo(selector1, '1'), 1)}\
    let val2 = e2.getBoundingClientRect()[property];
${indentString(handlePseudo(selector2, '2'), 1)}\
    let delta = Math.abs(val1 - val2);
    if (delta > maxDelta) {
        err = "delta " + kind + " values too large: " + delta + " > " + maxDelta;
    }
    ${errHandling}
}
`;
    const warnings = [];
    let added = 0;
    for (const [key, value] of json.entries) {
        const v = parseInt(value.value, 10);
        if (v === 0) {
            warnings.push(
                `Delta is 0 for "${key}", maybe try to use \`compare-elements-position\` instead?`);
        }
        if (key === 'x') {
            code += `browserComparePositionNear(elem1, elem2, "X", "left", ${v});\n`;
        } else if (key === 'y') {
            code += `browserComparePositionNear(elem1, elem2, "Y", "top", ${v});\n`;
        }
        added += 1;
    }

    const varName = 'parseCompareElementsPosNear';
    let instructions = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';
    if (added !== 0) {
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

function parseCompareElementsSizeInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'array',
                    valueTypes: {
                        'string': {
                            allowed: ['width', 'height'],
                        },
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;

    let errHandling;
    if (assertFalse) {
        errHandling = 'if (err === null) { throw "comparison didn\'t fail"; }';
    } else {
        errHandling = 'if (err !== null) { throw err; }';
    }

    let width = false;
    let height = false;
    let code = `\
function browserGetElementSizes1(e) {
${indentString(getSizes(selector1), 1)}
    return [Math.round(width), Math.round(height)];
}
function browserGetElementSizes2(e) {
${indentString(getSizes(selector2), 1)}
    return [Math.round(width), Math.round(height)];
}
const [width1, height1] = browserGetElementSizes1(elem1);
const [width2, height2] = browserGetElementSizes2(elem2);
let err = null;
`;

    for (const value of tuple[2].value.entries) {
        if (value.value === 'width') {
            if (width) {
                return {
                    'error': `Duplicated "width" value in \`${tuple[2].value.getErrorText()}\``,
                };
            }
            code += `\
if (width1 !== width2) {
    err = "widths don't match: " + width1 + " != " + width2;
}
${errHandling}
`;
            width = true;
        } else if (value.value === 'height') {
            if (height) {
                return {
                    'error': `Duplicated "height" value in \`${tuple[2].value.getErrorText()}\``,
                };
            }
            code += `\
if (height1 !== height2) {
    err = "heights don't match: " + height1 + " != " + height2;
}
${errHandling}
`;
            height = true;
        }
    }

    const varName = 'parseCompareElementsSize';
    let instructions = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';
    if (width || height) {
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
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ("width"|"height"))
function parseCompareElementsSize(parser) {
    return parseCompareElementsSizeInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", ("width"|"height"))
function parseCompareElementsSizeFalse(parser) {
    return parseCompareElementsSizeInner(parser, true);
}

function parseCompareElementsSizeNearInner(parser, assertFalse) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                { kind: 'selector' },
                { kind: 'selector' },
                {
                    kind: 'json',
                    keyTypes: {
                        'string': ['width', 'height'],
                    },
                    valueTypes: {
                        'number': {
                            allowNegative: false,
                            allowFloat: false,
                        },
                    },
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector1 = tuple[0].value;
    const selector2 = tuple[1].value;
    const json = tuple[2].value;

    let errHandling;
    if (assertFalse) {
        errHandling = 'if (err === null) { throw "comparison didn\'t fail"; }';
    } else {
        errHandling = 'if (err !== null) { throw err; }';
    }

    let code = `\
function browserGetElementSizes1(e) {
${indentString(getSizes(selector1), 1)}
    return [Math.round(width), Math.round(height)];
}
function browserGetElementSizes2(e) {
${indentString(getSizes(selector2), 1)}
    return [Math.round(width), Math.round(height)];
}
function browserCompareValuesNear(v1, v2, kind, maxDelta) {
    const delta = Math.abs(v1 - v2);
    if (delta > maxDelta) {
        err = "delta for " + kind + " values too large: " + delta + " > " + maxDelta;
    }
    ${errHandling}
}
const [width1, height1] = browserGetElementSizes1(elem1);
const [width2, height2] = browserGetElementSizes2(elem2);
let err = null;
`;
    const warnings = [];
    let added = 0;
    for (const [key, value] of json.entries) {
        const v = parseInt(value.value, 10);
        if (v === 0) {
            warnings.push(
                `Delta is 0 for "${key}", maybe try to use \`compare-elements-size\` instead?`);
        }
        if (key === 'width') {
            code += `browserCompareValuesNear(width1, width2, "width", ${v});\n`;
        } else if (key === 'height') {
            code += `browserCompareValuesNear(height1, height2, "height", ${v});\n`;
        }
        added += 1;
    }

    const varName = 'parseCompareElementsSizeNear';
    let instructions = getAndSetElements(selector1, varName + '1', false) + '\n' +
        getAndSetElements(selector2, varName + '2', false) + '\n';
    if (added !== 0) {
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
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", {"width"|"height": number}))
function parseCompareElementsSizeNear(parser) {
    return parseCompareElementsSizeNearInner(parser, false);
}

// Possible inputs:
//
// * ("CSS selector 1" | "XPath 1", "CSS selector 2" | "XPath 2", {"width"|"height": number})
function parseCompareElementsSizeNearFalse(parser) {
    return parseCompareElementsSizeNearInner(parser, true);
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
    'parseCompareElementsSize': parseCompareElementsSize,
    'parseCompareElementsSizeFalse': parseCompareElementsSizeFalse,
    'parseCompareElementsSizeNear': parseCompareElementsSizeNear,
    'parseCompareElementsSizeNearFalse': parseCompareElementsSizeNearFalse,
    'parseCompareElementsText': parseCompareElementsText,
    'parseCompareElementsTextFalse': parseCompareElementsTextFalse,
};
