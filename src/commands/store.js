// All `compare*` commands.

const { getAndSetElements } = require('./utils.js');
const { RESERVED_VARIABLE_NAME } = require('../utils.js');

// Possible inputs:
//
// * (ident, "CSS selector" | "XPath", "attribute")
function parseStoreAttribute(parser) {
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
    } else if (tuple[2].kind !== 'string') {
        return {
            'error': `expected third argument to be a string, found \
${tuple[2].getArticleKind()} (\`${tuple[2].getErrorText()}\`)`,
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

    const varName = 'parseStoreAttribute';
    const code = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    if (!e.hasAttribute(${tuple[2].displayInCode()})) {
        throw "No attribute name \`" + ${tuple[2].displayInCode()} + "\`";
    }
    return String(e.getAttribute(${tuple[2].displayInCode()}));
});
arg.variables["${tuple[0].displayInCode()}"] = await jsHandle.jsonValue();`;

    return {
        'instructions': [code],
        'wait': false,
        'warnings': warnings.length !== 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * (ident, "CSS selector" | "XPath", "CSS property")
function parseStoreCss(parser) {
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
    } else if (tuple[2].kind !== 'string') {
        return {
            'error': `expected third argument to be a string, found \
${tuple[2].getArticleKind()} (\`${tuple[2].getErrorText()}\`)`,
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
    const pseudo = !selector.isXPath && selector.pseudo !== null ? `, "${selector.pseudo}"` : '';

    const varName = 'parseStoreCss';
    const code = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    return String(getComputedStyle(e${pseudo})[${tuple[2].displayInCode()}]);
});
arg.variables["${tuple[0].displayInCode()}"] = await jsHandle.jsonValue();`;

    return {
        'instructions': [code],
        'wait': false,
        'warnings': warnings.length !== 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * (ident, "CSS selector" | "XPath", "property")
function parseStoreProperty(parser) {
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
    } else if (tuple[2].kind !== 'string') {
        return {
            'error': `expected third argument to be a string, found \
${tuple[2].getArticleKind()} (\`${tuple[2].getErrorText()}\`)`,
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

    const varName = 'parseStoreProperty';
    const code = `\
${getAndSetElements(selector, varName, false)}
const jsHandle = await ${varName}.evaluateHandle(e => {
    return String(e[${tuple[2].displayInCode()}]);
});
arg.variables["${tuple[0].displayInCode()}"] = await jsHandle.jsonValue();`;

    return {
        'instructions': [code],
        'wait': false,
        'warnings': warnings.length !== 0 ? warnings : undefined,
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
// * (ident, "CSS selector" | "XPath"
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
    'parseStoreProperty': parseStoreProperty,
    'parseStoreText': parseStoreText,
    'parseStoreValue': parseStoreValue,
    'parseStoreWindowProperty': parseStoreWindowProperty,
};
