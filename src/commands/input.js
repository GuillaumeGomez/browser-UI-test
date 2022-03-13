// List commands handling inputs.

const { getAndSetElements, checkIntegerTuple } = require('./utils.js');

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseClick(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a position or a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1) {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'string') {
        const selector = elems[0].getSelector();
        if (selector.error !== undefined) {
            return selector;
        }
        const varName = 'parseClickVar';
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `await ${varName}.click();`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``};
    }
    const ret = checkIntegerTuple(elems[0], 'X position', 'Y position');
    if (ret.error !== undefined) {
        return ret;
    }
    const [x, y] = ret.value;
    return {
        'instructions': [
            `await page.mouse.click(${x},${y});`,
        ],
    };
}


// Possible inputs:
//
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseFocus(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'string') {
        return {'error': `expected a CSS selector or an XPath, found \`${parser.getRawArgs()}\``};
    }
    const selector = elems[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    if (selector.isXPath) {
        const varName = 'parseFocusVar';
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `await ${varName}.focus();`,
            ],
        };
    }
    return {
        'instructions': [
            `await page.focus("${selector.value}");`,
        ],
    };
}

// Possible inputs:
//
// * ("CSS selector" or "XPath", "text")
// * ("CSS selector" or "XPath", keycode)
// * "text" (in here, it'll write into the current focused element)
// * keycode (in here, it'll write the given keycode into the current focused element)
function parseWrite(parser) {
    const err = 'expected "string" or integer or ("CSS selector" or "XPath", "string") or ' +
        '("CSS selector" or "XPath", integer)';
    const elems = parser.elems;

    if (elems.length !== 1) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        return {
            'instructions': [
                `await page.keyboard.type("${elems[0].getStringValue()}");`,
            ],
        };
    } else if (elems[0].kind === 'number') {
        const ret = elems[0].getIntegerValue('keycode', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                `await page.keyboard.press(String.fromCharCode(${ret.value}));`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, ' + err,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error': 'expected a CSS selector or an XPath as tuple first argument, found ' +
                tuple[0].getArticleKind(),
        };
    } else if (tuple[1].kind !== 'string' && tuple[1].kind !== 'number') {
        return {
            'error': 'expected a string or an integer as tuple second argument, found ' +
                tuple[1].getArticleKind(),
        };
    }
    const selector = tuple[0].getSelector();
    if (selector.error !== undefined) {
        return selector;
    }
    const varName = 'parseWriteVar';
    if (tuple[1].kind === 'string') {
        if (selector.isXPath) {
            return {
                'instructions': [
                    getAndSetElements(selector, varName, false) +
                    `await ${varName}.type("${tuple[1].getStringValue()}");`,
                ],
            };
        }
        return {
            'instructions': [
                `await page.type("${selector.value}", "${tuple[1].getStringValue()}");`,
            ],
        };
    }
    const ret = tuple[1].getIntegerValue('keycode', true);
    if (ret.error !== undefined) {
        return ret;
    }
    if (selector.isXPath) {
        return {
            'instructions': [
                getAndSetElements(selector, varName, false) +
                `${varName}.focus();`,
                `await page.keyboard.press(String.fromCharCode(${ret.value}));`,
            ],
        };
    }
    return {
        'instructions': [
            `await page.focus("${selector.value}");`,
            `await page.keyboard.press(String.fromCharCode(${ret.value}));`,
        ],
    };
}


// Possible inputs:
//
// * ("key", delay)
// * (keycode, delay)
// * "key"
// * keycode
//
// The key codes (both strings and integers) can be found here:
// https://github.com/puppeteer/puppeteer/blob/v1.14.0/lib/USKeyboardLayout.js
function parsePressKey(parser) {
    const elems = parser.elems;
    const err = 'expected [string] or [integer] or ([string], [integer]) or ([integer], [integer])';

    if (elems.length === 0) {
        return {'error': err + ', found nothing'};
    } else if (elems.length !== 1) {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    } else if (elems[0].kind === 'string') {
        const s = elems[0].getStringValue();
        if (s.length === 0) {
            return {'error': 'key cannot be empty'};
        }
        return {
            'instructions': [
                `await page.keyboard.press("${s}")`,
            ],
        };
    } else if (elems[0].kind === 'number') {
        const ret = elems[0].getIntegerValue('keycode', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                'await page.keyboard.press(String.fromCharCode' +
                `(${ret.value}))`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {'error': err + `, found \`${parser.getRawArgs()}\``};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, ' + err,
        };
    } else if (tuple[0].kind !== 'string' && tuple[0].kind !== 'number') {
        return {
            'error': 'expected a string or an integer as tuple first argument, found ' +
                tuple[0].getArticleKind(),
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error':
            `expected an integer as tuple second argument, found ${tuple[1].getArticleKind()}`,
        };
    }
    // First we get the delay value.
    const ret = tuple[1].getIntegerValue('delay', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const delay = `, ${ret.value}`;

    // Then we get the keycode.
    if (tuple[0].kind === 'string') {
        const s = tuple[0].getStringValue();
        if (s.length === 0) {
            return {'error': 'key cannot be empty'};
        }
        return {
            'instructions': [
                `await page.keyboard.press("${s}"${delay})`,
            ],
        };
    }
    const ret2 = tuple[0].getIntegerValue('keycode', true);
    if (ret2.error !== undefined) {
        return ret2;
    }
    return {
        'instructions': [
            `await page.keyboard.press(String.fromCharCode(${ret2.value})${delay})`,
        ],
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseMoveCursorTo(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a position or a CSS selector or an XPath, found nothing'};
    } else if (elems.length !== 1) {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    } else if (elems[0].kind === 'string') {
        const selector = elems[0].getSelector();
        if (selector.error !== undefined) {
            return selector;
        }
        if (selector.isXPath) {
            const varName = 'parseMoveCursorToVar';
            return {
                'instructions': [
                    getAndSetElements(selector, varName, false) +
                    `await ${varName}.hover();`,
                ],
            };
        }
        return {
            'instructions': [
                `await page.hover("${selector.value}");`,
            ],
        };
    } else if (elems[0].kind !== 'tuple') {
        return {
            'error': 'expected a position or a CSS selector or an XPath, ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const ret = checkIntegerTuple(elems[0], 'X position', 'Y position', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const [x, y] = ret.value;
    return {
        'instructions': [
            `await page.mouse.move(${x},${y});`,
        ],
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
// * "XPath" (for example: "//*[@id='elementID']")
function parseScrollTo(parser) {
    return parseMoveCursorTo(parser); // The page will scroll to the element
}


// Possible inputs:
//
// * ((x, y), (x, y))
// * ((x, y), "CSS selector")
// * ("CSS selector", (x, y))
// * ("XPath", (x, y))
// * ("CSS selector" or "XPath", "CSS selector" or "XPath")
function parseDragAndDrop(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                'CSS selector or an XPath, found nothing',
        };
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                `CSS selector or an XPath, found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                'CSS selector or an XPath',
        };
    }
    const checkArg = arg => {
        if (arg.kind !== 'tuple' && arg.kind !== 'string') {
            return {
                'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                    `CSS selector or an XPath, found \`${arg.getText()}\``,
            };
        } else if (arg.kind === 'tuple') {
            const ret = checkIntegerTuple(arg, 'X position', 'Y position', true);
            if (ret.error !== undefined) {
                return ret;
            }
        }
        return {};
    };
    let ret = checkArg(tuple[0]);
    if (ret.error !== undefined) {
        return ret;
    }
    ret = checkArg(tuple[1]);
    if (ret.error !== undefined) {
        return ret;
    }
    const instructions = [];
    const setupThings = (arg, varName, posName, pos) => {
        let code = '';
        if (arg.kind === 'string') {
            const selector = arg.getSelector(`(${pos} argument)`);
            if (selector.error !== undefined) {
                return selector;
            }
            const box = `${varName}_box`;
            code += getAndSetElements(selector, varName, false) +
                `const ${box} = await ${varName}.boundingBox();\n` +
                `const ${posName} = [${box}.x + ${box}.width / 2, ${box}.y + ${box}.height / 2];\n`;
        } else {
            const elems = arg.getRaw();
            code += `const ${posName} = [${elems[0].getRaw()}, ${elems[1].getRaw()}];\n`;
        }
        return `${code}await page.mouse.move(${posName}[0], ${posName}[1]);`;
    };
    ret = setupThings(tuple[0], 'parseDragAndDropElem', 'start', 'first');
    if (ret.error !== undefined) {
        return ret;
    }
    instructions.push(ret + '\nawait page.mouse.down();');
    ret = setupThings(tuple[1], 'parseDragAndDropElem2', 'end', 'second');
    if (ret.error !== undefined) {
        return ret;
    }
    instructions.push(ret + '\nawait page.mouse.up();');
    return {
        'instructions': instructions,
    };
}

module.exports = {
    'parseClick': parseClick,
    'parseDragAndDrop': parseDragAndDrop,
    'parseFocus': parseFocus,
    'parseMoveCursorTo': parseMoveCursorTo,
    'parsePressKey': parsePressKey,
    'parseScrollTo': parseScrollTo,
    'parseWrite': parseWrite,
};
