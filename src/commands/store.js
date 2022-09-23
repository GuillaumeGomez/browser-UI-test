// All `compare*` commands.

const { getAndSetElements } = require('./utils.js');

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
(\`${tuple[0].getText()}\`)`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a CSS selector or an XPath, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getText()}\`)`,
        };
    } else if (tuple[2].kind !== 'string') {
        return {
            'error': `expected third argument to be a string, found \
${tuple[2].getArticleKind()} (\`${tuple[2].getText()}\`)`,
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
    if (!e.hasAttribute(${tuple[2].getText()})) {
        throw "No attribute name \`" + ${tuple[2].getText()} + "\`";
    }
    return String(e.getAttribute(${tuple[2].getText()}));
});
arg.variables["${tuple[0].getText()}"] = await jsHandle.jsonValue();`;

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
(\`${tuple[0].getText()}\`)`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a CSS selector or an XPath, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getText()}\`)`,
        };
    } else if (tuple[2].kind !== 'string') {
        return {
            'error': `expected third argument to be a string, found \
${tuple[2].getArticleKind()} (\`${tuple[2].getText()}\`)`,
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
    return String(getComputedStyle(e${pseudo})[${tuple[2].getText()}]);
});
arg.variables["${tuple[0].getText()}"] = await jsHandle.jsonValue();`;

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
(\`${tuple[0].getText()}\`)`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a CSS selector or an XPath, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getText()}\`)`,
        };
    } else if (tuple[2].kind !== 'string') {
        return {
            'error': `expected third argument to be a string, found \
${tuple[2].getArticleKind()} (\`${tuple[2].getText()}\`)`,
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
    return String(e[${tuple[2].getText()}]);
});
arg.variables["${tuple[0].getText()}"] = await jsHandle.jsonValue();`;

    return {
        'instructions': [code],
        'wait': false,
        'warnings': warnings.length !== 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * (ident, "string" | number)
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
                `found ${tuple[0].getArticleKind()} (\`${tuple[0].getText()}\`)`,
        };
    } else if (tuple[1].kind !== 'number' && tuple[1].kind !== 'string') {
        return {
            'error': `expected second argument to be a number or a string, found \
${tuple[1].getArticleKind()} (\`${tuple[1].getText()}\`)`,
        };
    }
    return {
        'instructions': [`arg.variables["${tuple[0].getText()}"] = ${tuple[1].getText()};`],
        'wait': false,
    };
}

module.exports = {
    'parseStoreAttribute': parseStoreAttribute,
    'parseStoreCss': parseStoreCss,
    'parseStoreProperty': parseStoreProperty,
    'parseStoreValue': parseStoreValue,
};
