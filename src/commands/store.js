// All `compare*` commands.

const {
    getAndSetElements,
    indentString,
    getSizes,
    generateCheckObjectPaths,
} = require('./utils.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { RESERVED_VARIABLE_NAME, hasError } = require('../utils.js');

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"attribute": ident})
function parseStoreAttribute(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: [],
                },
                valueTypes: {
                    ident: {
                        notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
                    },
                },
                allowDuplicatedValue: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const code = [];
    const getter = [];
    for (const [key, value] of json) {
        code.push(`arg.setVariable("${value.value}", data["${key}"]);`);
        getter.push(`"${key}"`);
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    const warnings = [];
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
it will be performed on the element itself`);
    }

    const varName = 'elem';
    const instructions = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    const attrs = [${getter}];
    const ret = Object.create(null);
    const errors = [];

    for (const attr of attrs) {
        if (!e.hasAttribute(attr)) {
            errors.push('"No attribute named \`' + attr + '\`"');
        } else {
            ret[attr] = e.getAttribute(attr);
        }
    }
    if (errors.length !== 0) {
        throw "The following errors happened: [" + errors.join(", ") + "]";
    }
    return ret;
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"CSS property": ident})
function parseStoreCss(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: [],
                },
                valueTypes: {
                    ident: {
                        notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
                    },
                },
                allowDuplicatedValue: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;
    const code = [];
    const getter = [];
    for (const [key, value] of json) {
        code.push(`arg.setVariable("${value.value}", data["${key}"]);`);
        getter.push(`"${key}"`);
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    const pseudo = isPseudo ? `, "${selector.pseudo}"` : '';

    const varName = 'parseStoreCss';
    const instructions = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    const style = getComputedStyle(e${pseudo});
    const props = [${getter.join(',')}];
    const ret = Object.create(null);
    const errors = [];

    for (const prop of props) {
        if (style[prop] === undefined) {
            errors.push('"No CSS property named \`' + prop + '\`"');
        } else {
            ret[prop] = style[prop];
        }
    }
    if (errors.length !== 0) {
        throw "The following errors happened: [" + errors.join(", ") + "]";
    }
    return ret;
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
    };
}

// Possible inputs:
//
// * ("selector", {"property": ident})
function parseStoreProperty(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: [],
                    'object-path': [],
                },
                valueTypes: {
                    ident: {
                        notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
                    },
                },
                allowDuplicatedValue: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const getter = [];
    for (const [key, value] of json) {
        const k_s = value.key.kind === 'object-path' ? key : `["${key}"]`;
        getter.push(`[${k_s}, "${value.value}"]`);
    }

    const warnings = [];
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have properties so \
it will be performed on the element itself`);
    }

    const varName = 'elem';
    const instructions = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
${indentString(generateCheckObjectPaths(), 1)}
    const props = [${getter.join(',')}];
    const ret = [];
    const errors = [];

    for (const [prop, varName] of props) {
        checkObjectPaths(e, prop, found => {
            if (found === undefined) {
                const p = prop.map(p => \`"\${p}"\`).join('.');
                errors.push('"No property named \`' + p + '\`"');
                return;
            }
            ret.push([found, varName]);
        }, _ => {
            const p = prop.map(p => \`"\${p}"\`).join('.');
            errors.push('"No property named \`' + p + '\`"');
        });
    }
    if (errors.length !== 0) {
        throw "The following errors happened: [" + errors.join(", ") + "]";
    }
    return ret;
});
const data = await jsHandle.jsonValue();
for (const [found, varName] of data) {
    arg.setVariable(varName, found);
}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"width"|"height": ident})
function parseStoreSize(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: ['height', 'width'],
                },
                valueTypes: {
                    ident: {
                        notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
                    },
                },
                allowDuplicatedValue: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const code = [];
    if (json.has('width')) {
        code.push(`arg.setVariable("${json.get('width').value}", data["offsetWidth"]);`);
    }
    if (json.has('height')) {
        code.push(`arg.setVariable("${json.get('height').value}", data["offsetHeight"]);`);
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    const varName = 'elem';
    const instructions = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
${indentString(getSizes(selector), 1)}
    return {"offsetHeight": Math.round(height), "offsetWidth": Math.round(width)};
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"width"|"height": ident})
function parseStorePosition(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'selector',
            },
            {
                kind: 'json',
                keyTypes: {
                    string: ['x', 'X', 'y', 'Y'],
                },
                valueTypes: {
                    ident: {
                        notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
                    },
                },
                allowDuplicatedValue: false,
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[0].value;
    const json = tuple[1].value.entries;

    const code = [];
    for (const [key, value] of json) {
        if (key === 'x' || key === 'X') {
            code.push(`arg.setVariable("${value.value}", data["x"]);`);
        } else {
            code.push(`arg.setVariable("${value.value}", data["y"]);`);
        }
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    const varName = 'elem';
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    const pseudo = isPseudo ? selector.pseudo : '';
    const instructions = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    const x = browserUiTestHelpers.getElementPosition(e, "${pseudo}", "left", "marginLeft");
    const y = browserUiTestHelpers.getElementPosition(e, "${pseudo}", "top", "marginTop");
    return {"x": Math.round(x), "y": Math.round(y)};
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
    };
}

// Possible inputs:
//
// * (ident, "string" | number | json)
function parseStoreValue(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'ident',
                notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
            },
            {
                kind: 'number',
                allowNegative: true,
                allowFloat: true,
                alternatives: [
                    {
                        kind: 'string',
                    },
                    {
                        kind: 'json',
                        keyTypes: {
                            string: [],
                        },
                        allowAllValues: true,
                        valueTypes: {},
                    },
                ],
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    return {
        'instructions': [`\
arg.variables["${tuple[0].value.displayInCode()}"] = ${tuple[1].value.displayInCode()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * {"string": ident}
function parseStoreLocalStorage(parser) {
    const ret = validator(parser, {
        kind: 'json',
        keyTypes: {
            string: [],
        },
        valueTypes: {
            ident: {
                notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
            },
        },
        allowDuplicatedValue: false,
    });
    if (hasError(ret)) {
        return ret;
    }

    const json = ret.value.entries;

    const code = [];
    const getter = [];
    for (const [key, value] of json) {
        code.push(`arg.setVariable("${value.value}", data["${key}"]);`);
        getter.push(`"${key}": window.localStorage.getItem("${key}"),`);
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    return {
        'instructions': [`\
const jsHandle = await page.evaluateHandle(() => {
    return {
${indentString(getter.join('\n'), 2)}
    };
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * (ident, "CSS selector" | "XPath")
function parseStoreText(parser) {
    const ret = validator(parser, {
        kind: 'tuple',
        elements: [
            {
                kind: 'ident',
                notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
            },
            {
                kind: 'selector',
            },
        ],
    });
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const selector = tuple[1].value;
    const warnings = [];
    const isPseudo = !selector.isXPath && selector.pseudo !== null;
    if (isPseudo) {
        warnings.push(`Pseudo-elements (\`${selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }

    const varName = 'parseStoreText';
    const code = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    return browserUiTestHelpers.getElemText(e, "");
});
arg.setVariable("${tuple[0].value.displayInCode()}", await jsHandle.jsonValue());`;

    return {
        'instructions': [code],
        'wait': false,
        'warnings': warnings,
    };
}

function parseStoreObjectInner(parser, objName) {
    const ret = validator(parser, {
        kind: 'json',
        keyTypes: {
            string: [],
        },
        valueTypes: {
            ident: {
                notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
            },
        },
        allowDuplicatedValue: false,
    });
    if (hasError(ret)) {
        return ret;
    }

    const json = ret.value.entries;
    const code = [];
    const getter = [];
    for (const [key, value] of json) {
        code.push(`arg.setVariable("${value.value}", data["${key}"]);`);
        getter.push(`"${key}"`);
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
        };
    }

    const instructions = `\
const jsHandle = await page.evaluateHandle(() => {
    const properties = [${getter}];
    const errors = [];
    const ret = Object.create(null);

    for (const property of properties) {
        if (${objName}[property] === undefined) {
            errors.push('"${objName} doesn\\'t have a property named \`' + property + '\`"');
        } else {
            ret[property] = ${objName}[property];
        }
    }
    if (errors.length !== 0) {
        throw "The following errors happened: [" + errors.join(", ") + "]";
    }
    return ret;
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
    };
}

// Possible inputs:
//
// * {"property name": ident}
function parseStoreDocumentProperty(parser) {
    return parseStoreObjectInner(parser, 'document');
}

// Possible inputs:
//
// * {"property name": ident}
function parseStoreWindowProperty(parser) {
    return parseStoreObjectInner(parser, 'window');
}

module.exports = {
    'parseStoreAttribute': parseStoreAttribute,
    'parseStoreCss': parseStoreCss,
    'parseStoreDocumentProperty': parseStoreDocumentProperty,
    'parseStoreLocalStorage': parseStoreLocalStorage,
    'parseStorePosition': parseStorePosition,
    'parseStoreProperty': parseStoreProperty,
    'parseStoreSize': parseStoreSize,
    'parseStoreText': parseStoreText,
    'parseStoreValue': parseStoreValue,
    'parseStoreWindowProperty': parseStoreWindowProperty,
};
