// All `compare*` commands.

const { getAndSetElements, indentString, validateJson } = require('./utils.js');
const { RESERVED_VARIABLE_NAME } = require('../utils.js');

function checkSelectorAndJson(parser, allowedKeys, callback) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected 2 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected first argument to be a string, ' +
                `found ${tuple[0].getArticleKind()} (\`${tuple[0].getErrorText()}\`)`,
        };
    } else if (tuple[1].kind !== 'json') {
        return {
            'error': `expected second argument to be a JSON dict, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getErrorText()}\`)`,
        };
    }

    const json = tuple[1].getRaw();
    const entries = validateJson(json, {'ident': []}, 'JSON dict key', allowedKeys);
    if (entries.error !== undefined) {
        return entries;
    }
    for (const v of json) {
        if (v.value.isReservedVariableName()) {
            return {
                'error': `\`${v.value.value}\` is a reserved name, so an ident cannot be named \
like this`,
            };
        }
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }

    const variables = new Set();
    for (const [k, v] of Object.entries(entries.values)) {
        if (variables.has(v.value)) {
            return {
                'error': `duplicated variable \`${v.value}\` (in \
\`${tuple[1].getErrorText()}\`)`,
            };
        }
        variables.add(v.value);
        callback(k, v);
    }
    return {
        'warnings': entries.warnings,
        'selector': selector,
        'isPseudo': !selector.isXPath && selector.pseudo !== null,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"attribute": ident})
function parseStoreAttribute(parser) {
    const code = [];
    const getter = [];
    const data = checkSelectorAndJson(parser, null, (k, v) => {
        code.push(`arg.variables["${v.value}"] = data["${k}"];`);
        getter.push(`"${k}"`);
    });
    if (data.error !== undefined) {
        return data;
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': data.warnings,
        };
    }

    if (data.isPseudo) {
        data.warnings.push(`Pseudo-elements (\`${data.selector.pseudo}\`) don't have attributes so \
it will be performed on the element itself`);
    }

    const varName = 'elem';
    const instructions = `\
${getAndSetElements(data.selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    const attrs = [${getter}];
    const ret = Object.create(null);
    const errors = [];

    for (const attr of attrs) {
        if (!e.hasAttribute(attr)) {
            errors.push('"No attribute name \`' + attr + '\`"');
        } else {
            ret[attr] = e.getAttribute(attr);
        }
    }
    if (errors.length !== 0) {
        throw "The following errors happened: [" + errors.join(", ") + "]";
    }
    return ret;
});
const data= await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': data.warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"CSS property": ident})
function parseStoreCss(parser) {
    const code = [];
    const getter = [];
    const data = checkSelectorAndJson(parser, null, (k, v) => {
        code.push(`arg.variables["${v.value}"] = data["${k}"];`);
        getter.push(`"${k}": style["${k}"],`);
    });
    if (data.error !== undefined) {
        return data;
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': data.warnings,
        };
    }

    const pseudo = data.isPseudo ? `, "${data.selector.pseudo}"` : '';

    const varName = 'parseStoreCss';
    const instructions = `\
${getAndSetElements(data.selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    const style = getComputedStyle(e${pseudo});
    return {
${indentString(getter.join('\n'), 2)}
    };
});
data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': data.warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"property": ident})
function parseStoreProperty(parser) {
    const code = [];
    const getter = [];
    const data = checkSelectorAndJson(parser, null, (k, v) => {
        code.push(`arg.variables["${v.value}"] = data["${k}"];`);
        getter.push(`"${k}": e["${k}"],`);
    });
    if (data.error !== undefined) {
        return data;
    }

    if (data.isPseudo) {
        data.warnings.push(`Pseudo-elements (\`${data.selector.pseudo}\`) don't have attributes so \
the check will be performed on the element itself`);
    }

    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': data.warnings,
        };
    }

    const varName = 'elem';
    const instructions = `\
${getAndSetElements(data.selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    return {
${indentString(getter.join('\n'), 2)}
    };
});
data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': data.warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"width"|"height": ident})
function parseStoreSize(parser) {
    const code = [];
    const data = checkSelectorAndJson(parser, ['height', 'width'], (k, v) => {
        if (k === 'width') {
            code.push(`arg.variables["${v.value}"] = data["offsetWidth"];`);
        } else {
            code.push(`arg.variables["${v.value}"] = data["offsetHeight"];`);
        }
    });
    if (data.error !== undefined) {
        return data;
    }

    const varName = 'elem';
    let getter;
    // To get the size of a pseudo element, we need to get the computed style for it. There is
    // one thing to be careful about: if the `box-sizing` is "border-box", "height" and "width"
    // already include the border and the padding.
    if (data.isPseudo) {
        getter = `\
const style = getComputedStyle(e, "${data.selector.pseudo}");
let height = parseFloat(style["height"]);
let width = parseFloat(style["width"]);
if (style["box-sizing"] !== "border-box") {
    height += parseFloat(style["padding-top"]) + parseFloat(style["padding-bottom"]);
    height += parseFloat(style["border-top-width"]) + parseFloat(style["border-bottom-width"]);
    width += parseFloat(style["padding-left"]) + parseFloat(style["padding-right"]);
    width += parseFloat(style["border-left-width"]) + parseFloat(style["border-right-width"]);
}
return {"offsetHeight": Math.round(height), "offsetWidth": Math.round(width)};`;
    } else {
        getter = 'return {"offsetHeight": e.offsetHeight, "offsetWidth": e.offsetWidth};';
    }

    const instructions = `\
${getAndSetElements(data.selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
${indentString(getter, 1)}
});
const data = await jsHandle.jsonValue();
${code.join('\n')}`;

    return {
        'instructions': [instructions],
        'wait': false,
        'warnings': data.warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector" | "XPath", {"width"|"height": ident})
function parseStorePosition(parser) {
    const code = [];
    const data = checkSelectorAndJson(parser, ['x', 'X', 'y', 'Y'], (k, v) => {
        if (k === 'x' || k === 'X') {
            code.push(`arg.variables["${v.value}"] = data["x"];`);
        } else {
            code.push(`arg.variables["${v.value}"] = data["y"];`);
        }
    });
    if (data.error !== undefined) {
        return data;
    }

    const varName = 'elem';
    const pseudo = data.isPseudo ? data.selector.pseudo : '';
    const instructions = `\
${getAndSetElements(data.selector, varName, false)}
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
        'warnings': data.warnings,
    };
}

// Possible inputs:
//
// * (ident, "string" | number | json)
function parseStoreValue(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected 2 elements in the tuple, found ${tuple.length} element`;
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
    }

    if (tuple[0].isReservedVariableName()) {
        return {
            'error': `\`${RESERVED_VARIABLE_NAME}\` is a reserved name, so an ident cannot be \
named like this`,
        };
    }

    return {
        'instructions': [
            `arg.variables["${tuple[0].displayInCode()}"] = ${tuple[1].displayInCode()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * (ident, "string")
function parseStoreLocalStorage(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected 2 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'ident') {
        return {
            'error': 'expected first argument to be an ident, ' +
                `found ${tuple[0].getArticleKind()} (\`${tuple[0].getErrorText()}\`)`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a string, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getErrorText()}\`)`,
        };
    }

    if (tuple[0].isReservedVariableName()) {
        return {
            'error': `\`${RESERVED_VARIABLE_NAME}\` is a reserved name, so an ident cannot be \
named like this`,
        };
    }

    return {
        'instructions': [`\
const jsHandle = await page.evaluateHandle(() => {
    return window.localStorage.getItem(${tuple[1].displayInCode()});
});
arg.variables["${tuple[0].displayInCode()}"] = await jsHandle.jsonValue();`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * (ident, "CSS selector" | "XPath")
function parseStoreText(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected 2 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'ident') {
        return {
            'error': `expected first argument to be an ident, found ${tuple[0].getArticleKind()} \
(\`${tuple[0].getErrorText()}\`)`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a CSS selector or an XPath, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getErrorText()}\`)`,
        };
    }

    if (tuple[0].isReservedVariableName()) {
        return {
            'error': `\`${RESERVED_VARIABLE_NAME}\` is a reserved name, so an ident cannot be \
named like this`,
        };
    }

    const selector = tuple[1].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
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
arg.variables["${tuple[0].displayInCode()}"] = await jsHandle.jsonValue();`;

    return {
        'instructions': [code],
        'wait': false,
        'warnings': warnings.length !== 0 ? warnings : undefined,
    };
}

function parseStoreObjectInner(parser, objName) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a tuple, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': `expected a tuple, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        let err = `expected 2 elements in the tuple, found ${tuple.length} element`;
        if (tuple.length > 1) {
            err += 's';
        }
        return {'error': err};
    } else if (tuple[0].kind !== 'ident') {
        return {
            'error': `expected first argument to be an ident, found ${tuple[0].getArticleKind()} \
(\`${tuple[0].getErrorText()}\`)`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a property name (a string), found \
${tuple[1].getArticleKind()} (\`${tuple[1].getErrorText()}\`)`,
        };
    }

    if (tuple[0].isReservedVariableName()) {
        return {
            'error': `\`${RESERVED_VARIABLE_NAME}\` is a reserved name, so an ident cannot be \
named like this`,
        };
    }

    const propertyName = tuple[1].getStringValue();
    const code = `\
const jsHandle = await page.evaluateHandle(() => {
    if (${objName}["${propertyName}"] === undefined) {
        throw "${objName} doesn't have a property named \`${propertyName}\`";
    }
    return ${objName}["${propertyName}"];
});
arg.variables["${tuple[0].getStringValue()}"] = await jsHandle.jsonValue();`;

    return {
        'instructions': [code],
        'wait': false,
    };
}

// Possible inputs:
//
// * (ident, "property name")
function parseStoreDocumentProperty(parser) {
    return parseStoreObjectInner(parser, 'document');
}

// Possible inputs:
//
// * (ident, "property name")
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
