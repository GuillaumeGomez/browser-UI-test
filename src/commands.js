const os = require('os');
const utils = require('./utils.js');
const Parser = require('./parser.js').Parser;
const consts = require('./consts.js');

const COMMENT_START = '//';

function cleanString(s) {
    if (s.replace !== undefined) {
        return s.replace(/"/g, '\\"').replace(/'/g, '\\\'');
    }
    return s;
}

function cleanCssSelector(s, text = '') {
    s = cleanString(s).replace(/\\/g, '\\\\').trim();
    if (s.length === 0) {
        return {
            'error': `CSS selector ${text !== '' ? text + ' ' : ''}cannot be empty`,
        };
    }
    return {
        'value': s,
    };
}

function checkInteger(nb, text, negativeCheck = false) {
    if (nb.isFloat === true) {
        return {'error': `expected integer for ${text}, found float: \`${nb.getValue()}\``};
    } else if (negativeCheck === true && nb.isNegative === true) {
        return {'error': `${text} cannot be negative: \`${nb.getValue()}\``};
    }
    return {};
}

function checkIntegerTuple(tuple, fullText, text1, text2, negativeCheck = false) {
    if (tuple.length !== 2 || tuple[0].kind !== 'number' || tuple[1].kind !== 'number') {
        return {'error': `invalid syntax: expected "([number], [number])", found \`${fullText}\``};
    }
    let ret = checkInteger(tuple[0], text1, negativeCheck);
    if (ret.error !== undefined) {
        return ret;
    }
    ret = checkInteger(tuple[1], text2, negativeCheck);
    return ret;
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
function parseClick(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': 'expected a position or a CSS selector'};
    } else if (p.elems[0].kind === 'string') {
        const selector = cleanCssSelector(p.elems[0].getValue());
        if (selector.error !== undefined) {
            return selector;
        }
        return {
            'instructions': [
                `await page.click("${selector.value}")`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': 'expected a position or a CSS selector'};
    }
    const tuple = p.elems[0].getValue();
    const ret = checkIntegerTuple(tuple, p.elems[0].getText(), 'X position', 'Y position');
    if (ret.error !== undefined) {
        return ret;
    }
    const x = tuple[0].getValue();
    const y = tuple[1].getValue();
    return {
        'instructions': [
            `await page.mouse.click(${x},${y})`,
        ],
    };
}

// Possible inputs:
//
// * Number of milliseconds
// * "CSS selector" (for example: "#elementID")
function parseWaitFor(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': 'expected an integer or a CSS selector'};
    } else if (p.elems[0].kind === 'number') {
        const ret = checkInteger(p.elems[0], 'number of milliseconds', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                `await page.waitFor(${p.elems[0].getValue()})`,
            ],
            'wait': false,
        };
    } else if (p.elems[0].kind !== 'string') {
        return {'error': 'expected an integer or a CSS selector'};
    }
    const selector = cleanCssSelector(p.elems[0].getValue());
    if (selector.error !== undefined) {
        return selector;
    }
    return {
        'instructions': [
            `await page.waitFor("${selector.value}")`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * "CSS selector" (for example: "#elementID")
function parseFocus(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'string') {
        return {'error': 'expected a CSS selector'};
    }
    const selector = cleanCssSelector(p.elems[0].getValue());
    if (selector.error !== undefined) {
        return selector;
    }
    return {
        'instructions': [
            `await page.focus("${selector.value}")`,
        ],
    };
}

// Possible inputs:
//
// * ("[CSS selector (for example: #elementID)]", "text")
// * ("[CSS selector (for example: #elementID)]", keycode)
// * "text" (in here, it'll write into the current focused element)
// * keycode (in here, it'll write the given keycode into the current focused element)
function parseWrite(line, options) {
    const err = 'expected [string] or [integer] or ([CSS selector], [string]) or ([CSS selector]' +
                ', [integer])';
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return { 'error': err };
    } else if (p.elems[0].kind === 'string') {
        return {
            'instructions': [
                `await page.keyboard.type("${cleanString(p.elems[0].getValue())}")`,
            ],
        };
    } else if (p.elems[0].kind === 'number') {
        const ret = checkInteger(p.elems[0], 'keycode', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                'await page.keyboard.press(String.fromCharCode' +
                `(${cleanString(p.elems[0].getValue())}))`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': err};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, ' + err,
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error':
            `expected a CSS selector as tuple first argument, found a ${tuple[0].kind}`,
        };
    } else if (tuple[1].kind !== 'string' && tuple[1].kind !== 'number') {
        return {
            'error':
            `expected a string or an integer as tuple second argument, found a ${tuple[1].kind}`,
        };
    }
    const selector = cleanCssSelector(tuple[0].getValue());
    if (selector.error !== undefined) {
        return selector;
    }
    if (tuple[1].kind === 'string') {
        return {
            'instructions': [
                `await page.type("${selector.value}", "${cleanString(tuple[1].getValue())}")`,
            ],
        };
    }
    const ret = checkInteger(tuple[1], 'keycode', true);
    if (ret.error !== undefined) {
        return ret;
    }
    return {
        'instructions': [
            `await page.focus("${selector.value}")`,
            `await page.keyboard.press(String.fromCharCode(${tuple[1].getValue()}))`,
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
function parsePressKey(line, options) {
    const err = 'expected [string] or [integer] or ([string], [integer]) or ([integer], [integer])';
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': err};
    } else if (p.elems[0].kind === 'string') {
        const s = cleanString(p.elems[0].getValue());
        if (s.length === 0) {
            return {'error': 'key cannot be empty'};
        }
        return {
            'instructions': [
                `await page.keyboard.press("${s}")`,
            ],
        };
    } else if (p.elems[0].kind === 'number') {
        const ret = checkInteger(p.elems[0], 'keycode', true);
        if (ret.error !== undefined) {
            return ret;
        }
        return {
            'instructions': [
                'await page.keyboard.press(String.fromCharCode' +
                `(${cleanString(p.elems[0].getValue())}))`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': err};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, ' + err,
        };
    } else if (tuple[0].kind !== 'string' && tuple[0].kind !== 'number') {
        return {
            'error':
            `expected a string or an integer as tuple first argument, found a ${tuple[0].kind}`,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error':
            `expected an integer as tuple second argument, found a ${tuple[1].kind}`,
        };
    }
    const ret = checkInteger(tuple[1], 'delay', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const delay = `, ${tuple[1].getValue()}`;
    if (tuple[0].kind === 'string') {
        const s = cleanString(tuple[0].getValue());
        if (s.length === 0) {
            return {'error': 'key cannot be empty'};
        }
        return {
            'instructions': [
                `await page.keyboard.press("${s}"${delay})`,
            ],
        };
    }
    const ret2 = checkInteger(tuple[0], 'keycode', true);
    if (ret2.error !== undefined) {
        return ret2;
    }
    return {
        'instructions': [
            `await page.keyboard.press(String.fromCharCode(${tuple[1].getValue()})${delay})`,
        ],
    };
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
function parseMoveCursorTo(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': 'expected a position or a CSS selector'};
    } else if (p.elems[0].kind === 'string') {
        const selector = cleanCssSelector(p.elems[0].getValue());
        if (selector.error !== undefined) {
            return selector;
        }
        return {
            'instructions': [
                `await page.hover("${selector.value}")`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': 'expected a position or a CSS selector'};
    }
    const tuple = p.elems[0].getValue();
    const ret = checkIntegerTuple(tuple, p.elems[0].getText(), 'X position', 'Y position', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const x = tuple[0].getValue();
    const y = tuple[1].getValue();
    return {
        'instructions': [
            `await page.mouse.move(${x},${y})`,
        ],
    };
}

// Possible inputs:
//
// * relative path (example: ../struct.Path.html)
// * full URL (for example: https://doc.rust-lang.org/std/struct.Path.html)
// * local path (example: file://some-file.html)
function parseGoTo(input, options) {
    // This function doesn't use the parser so we still need to remove the comment part.
    const parts = input.split(COMMENT_START);
    let line = '';
    if (parts.length > 1) {
        for (let i = 0; i < parts.length; ++i) {
            if (parts[i].endsWith(':')) {
                line += `${parts[i]}//`;
                if (i + 1 < parts.length) {
                    i += 1;
                    line += parts[i];
                }
            }
        }
    } else {
        line = input;
    }
    line = line.trim().split('|');
    for (let i = 1; i < line.length; i += 2) {
        const variable = utils.getVariableValue(options.variables, line[i]);
        if (variable === null) {
            return {'error': `variable \`${line[i]}\` not found in options nor environment`};
        }
        line[i] = variable;
    }
    line = line.join('');

    const permissions = 'await arg.browser.overridePermissions(page.url(), arg.permissions);';
    // We just check if it goes to an HTML file, not checking much though...
    if (line.startsWith('http://') === true
        || line.startsWith('https://') === true
        || line.startsWith('www.') === true
        || line.startsWith('file://') === true) {
        return {
            'instructions': [
                `await page.goto("${cleanString(line)}");`,
                permissions,
            ],
        };
    } else if (line.startsWith('.')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"/${cleanString(line)}");`,
                permissions,
            ],
        };
    } else if (line.startsWith('/')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"${cleanString(line)}");`,
                permissions,
            ],
        };
    }
    return {'error': `a relative path or a full URL was expected, found \`${line}\``};
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
function parseScrollTo(line, options) {
    return parseMoveCursorTo(line, options); // The page will scroll to the element
}

// Possible inputs:
//
// * (width, height)
function parseSize(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {'error': 'expected `([number], [number])`'};
    }
    const tuple = p.elems[0].getValue();
    const ret = checkIntegerTuple(tuple, p.elems[0].getText(), 'width', 'height', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const width = tuple[0].getValue();
    const height = tuple[1].getValue();
    return {
        'instructions': [
            `await page.setViewport({width: ${width}, height: ${height}})`,
        ],
    };
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseLocalStorage(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'json') {
        return {'error': 'expected json'};
    }
    const json = p.elems[0].getValue();
    const content = [];
    let warnings = [];

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getValue()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getValue()}\``);
            continue;
        }
        const key_s = cleanString(entry['key'].getValue());
        const value_s = cleanString(entry['value'].getValue());
        content.push(`localStorage.setItem("${key_s}", "${value_s}");`);
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (content.length === 0) {
        return {
            'instructions': [],
            'warnings': warnings,
        };
    }
    return {
        'instructions': [
            `await page.evaluate(() => { ${content.join('\n')} })`,
        ],
        'warnings': warnings,
    };
}

function assertHandleSelectorInput(value, insertBefore, insertAfter) {
    let selector = cleanCssSelector(value);
    if (selector.error !== undefined) {
        return selector;
    }
    selector = selector.value;
    //
    // EXISTENCE CHECK
    //
    return {
        'instructions': [
            `${insertBefore}if ((await page.$("${selector}")) === null) { ` +
            `throw '"${selector}" not found'; }${insertAfter}`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

function parseAssertInner(line, options, insertBefore, insertAfter) {
    const err = 'expected a tuple or a string, read the documentation to see the accepted inputs';
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': err};
    } else if (p.elems[0].kind === 'string') {
        return assertHandleSelectorInput(p.elems[0].getValue(), insertBefore, insertAfter);
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': err};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length < 1 || tuple.length > 3) {
        return {'error': 'invalid number of values in the tuple, read the documentation to see ' +
                         'the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {'error': `expected first argument to be a CSS selector, found a ${tuple[0].kind}`};
    }
    if (tuple.length === 1) {
        return assertHandleSelectorInput(tuple[0].getValue(), insertBefore, insertAfter);
    }
    let selector = cleanCssSelector(tuple[0].getValue());
    if (selector.error !== undefined) {
        return selector;
    }
    selector = selector.value;
    if (tuple[1].kind === 'number') {
        //
        // NUMBER OF OCCURENCES CHECK
        //
        if (tuple.length !== 2) {
            return {'error': 'unexpected argument after number of occurences'};
        }
        const occurences = tuple[1].getValue();
        const ret = checkInteger(tuple[1], 'number of occurences', true);
        if (ret.error !== undefined) {
            return ret;
        }
        const varName = 'parseAssertElemInt';
        return {
            'instructions': [
                `let ${varName} = await page.$$("${selector}");\n` +
                // TODO: maybe check differently depending on the tag kind?
                `${insertBefore}if (${varName}.length !== ${occurences}) { throw 'expected ` +
                `${occurences} elements, found ' + ${varName}.length; }${insertAfter}`,
            ],
            'wait': false,
            'checkResult': true,
        };
    } else if (tuple[1].kind === 'json') {
        //
        // CSS PROPERTIES CHECK
        //
        if (tuple.length !== 2) {
            return {'error': 'unexpected argument after CSS properties'};
        }
        let code = '';
        let warnings = [];
        const json = tuple[1].getValue();

        for (let i = 0; i < json.length; ++i) {
            const entry = json[i];

            if (entry['value'] === undefined) {
                warnings.push(`No value for key \`${entry['key'].getValue()}\``);
                continue;
            } else if (entry['key'].isRecursive() === true) {
                warnings.push(`Ignoring recursive entry with key \`${entry['key'].getValue()}\``);
                continue;
            }
            const key_s = cleanString(entry['key'].getValue());
            const value_s = cleanString(entry['value'].getValue());
            // TODO: check how to compare CSS property
            code += `if (e.style["${key_s}"] != "${value_s}" && ` +
                `assertComputedStyle["${key_s}"] != "${value_s}") { ` +
                `throw 'expected \`${value_s}\` for key \`${key_s}\` for \`${selector}\`, ` +
                `found \`' + assertComputedStyle["${key_s}"] + '\`'; }\n`;
        }
        warnings = warnings.length > 0 ? warnings : undefined;
        if (code.length === 0) {
            return {
                'instructions': [],
                'wait': false,
                'warnings': warnings,
                'checkResult': true,
            };
        }
        const varName = 'parseAssertElemJson';
        return {
            'instructions': [
                `let ${varName} = await page.$("${selector}");\n` +
                `if (${varName} === null) { throw '"${selector}" not found'; }\n` +
                `${insertBefore}await page.evaluate(e => {` +
                `let assertComputedStyle = getComputedStyle(e);\n${code}` +
                `}, ${varName});${insertAfter}`,
            ],
            'wait': false,
            'warnings': warnings,
            'checkResult': true,
        };
    } else if (tuple[1].kind === 'string' && tuple.length === 2) {
        //
        // TEXT CONTENT CHECK
        //
        const value = tuple[1].getValue();
        const varName = 'parseAssertElemStr';
        return {
            'instructions': [
                `let ${varName} = await page.$("${selector}");\n` +
                `if (${varName} === null) { throw '"${selector}" not found'; }\n` +
                `${insertBefore}await page.evaluate(e => {\n` +
                'if (e.tagName.toLowerCase() === "input") {\n' +
                    `if (e.value !== "${value}") { throw '"' + e.value + '" !== "${value}"'; }\n` +
                `} else if (e.textContent !== "${value}") {\n` +
                    `throw '"' + e.textContent + '" !== "${value}"'; }\n` +
                `}, ${varName});${insertAfter}`,
            ],
            'wait': false,
            'checkResult': true,
        };
    } else if (tuple[1].kind === 'string') {
        //
        // ATTRIBUTE CHECK
        //
        if (tuple[2].kind !== 'string') {
            const kind = tuple[2].kind;
            return {
                'error': 'expected a string as third argument for the attribute value, found ' +
                    `a ${kind}`,
            };
        }
        const attributeName = cleanString(tuple[1].getValue().trim());
        if (attributeName.length === 0) {
            return {'error': 'attribute name (second argument) cannot be empty'};
        }
        const value = cleanString(tuple[2].getValue());
        const varName = 'parseAssertElemAttr';
        return {
            'instructions': [
                `let ${varName} = await page.$("${selector}");\n` +
                `if (${varName} === null) { throw '"${selector}" not found'; }\n` +
                `${insertBefore}await page.evaluate(e => {\n` +
                `if (e.getAttribute("${attributeName}") !== "${value}") {\n` +
                `throw 'expected "${value}", found "' + e.getAttribute("${attributeName}") + '"` +
                ` for attribute "${attributeName}"';\n}\n}, ${varName});${insertAfter}`,
            ],
            'wait': false,
            'checkResult': true,
        };
    }
    const kind = tuple[1].kind;
    return {
        'error': `expected "string" or "json" or "number" as second argument, found a ${kind}`,
    };
}

// Possible inputs:
//
// * "CSS selector"
// * ("CSS selector")
// * ("CSS selector", number of occurences [integer])
// * ("CSS selector", CSS elements [JSON object])
// * ("CSS selector", text [STRING])
// * ("CSS selector", attribute name [STRING], attribute value [STRING])
function parseAssert(line, options) {
    return parseAssertInner(line, options, '', '');
}

// Possible inputs:
//
// * "CSS selector"
// * ("CSS selector")
// * ("CSS selector", number of occurences [integer])
// * ("CSS selector", CSS elements [JSON object])
// * ("CSS selector", text [STRING])
// * ("CSS selector", attribute name [STRING], attribute value [STRING])
function parseAssertFalse(line, options) {
    return parseAssertInner(
        line,
        options,
        'try {\n',
        '\n} catch(e) { return; } throw "assert didn\'t fail";');
}

function parseCompareElementsInner(line, options, insertBefore, insertAfter) {
    const err = 'expected a tuple, read the documentation to see the accepted inputs';
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {'error': err};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length < 2 || tuple.length > 3) {
        return {'error': 'invalid number of values in the tuple, read the documentation to see ' +
                         'the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {'error': `expected first argument to be a CSS selector, found a ${tuple[0].kind}`};
    } else if (tuple[1].kind !== 'string') {
        return {'error': `expected second argument to be a CSS selector, found a ${tuple[1].kind}`};
    }
    let selector1 = cleanCssSelector(tuple[0].getValue());
    if (selector1.error !== undefined) {
        return selector1;
    }
    selector1 = selector1.value;
    let selector2 = cleanCssSelector(tuple[1].getValue());
    if (selector2.error !== undefined) {
        return selector2;
    }
    selector2 = selector2.value;

    const varName = 'parseCompareElements';
    const selectors = `let ${varName}1 = await page.$("${selector1}");\n` +
        `if (${varName}1 === null) { throw '"${selector1}" not found'; }\n` +
        `let ${varName}2 = await page.$("${selector2}");\n` +
        `if (${varName}2 === null) { throw '"${selector2}" not found'; }\n`;

    if (tuple.length === 2) {
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
    } else if (tuple[2].kind === 'string') {
        const attr = cleanString(tuple[2].getValue());
        return {
            'instructions': [
                selectors +
                `${insertBefore}await page.evaluate((e1, e2) => {\n` +
                `if (e1.getAttribute("${attr}") !== e2.getAttribute("${attr}")) {\n` +
                    `throw "[${attr}]: " + e1.getAttribute("${attr}") + " !== " + ` +
                    `e2.getAttribute("${attr}");\n` +
                '}\n' +
                `}, ${varName}1, ${varName}2);${insertAfter}`,
            ],
            'wait': false,
            'checkResult': true,
        };
    } else if (tuple[2].kind === 'tuple') {
        const sub_tuple = tuple[2].getValue();
        let x = false;
        let y = false;
        let code = '';
        for (let i = 0; i < sub_tuple.length && (!x || !y); ++i) {
            if (sub_tuple[i].kind !== 'string') {
                return { 'error': `\`${tuple[2].getText()}\` should only contain strings` };
            }
            let value = sub_tuple[i].getValue();
            if (value === "x") {
                if (!x) {
                    code += 'let x1 = e1.getBoundingClientRect().left;\n' +
                        'let x2 = e2.getBoundingClientRect().left;\n' +
                        'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n'
                }
                x = true;
            } else if (value === "y") {
                if (!y) {
                    code += 'let y1 = e1.getBoundingClientRect().top;\n' +
                        'let y2 = e2.getBoundingClientRect().top;\n' +
                        'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n'
                }
                y = true;
            } else {
                return {
                    'error': 'Only accepted values are "x" and "y", found `' +
                        `${sub_tuple[i].getValue()}\` (in \`${tuple[2].getText()}\``,
                };
            }
        }
        return {
            'instructions': [
                selectors +
                `${insertBefore}await page.evaluate((e1, e2) => {\n` +
                `${code}\n}, ${varName}1, ${varName}2);${insertAfter}`,
            ],
            'wait': false,
            'checkResult': true,
        };
    } else if (tuple[2].kind !== 'array') {
        return {'error': 'expected an array, a string or a tuple as third argument, found ' +
        `"${tuple[2].kind}"`};
    }
    const array = tuple[2].getValue();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${tuple[2].getText()}\``};
    }
    let code = '';
    for (let i = 0; i < array.length; ++i) {
        let css_property = cleanString(array[i].getValue());
        code += `let style1_1 = e1.style["${css_property}"];\n` +
            `let style1_2 = computed_style1["${css_property}"];\n` +
            `let style2_1 = e2.style["${css_property}"];\n` +
            `let style2_2 = computed_style2["${css_property}"];\n` +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && ' +
            'style1_2 != style2_1 && style1_2 != style2_2) {\n' +
            `throw 'CSS property \`${css_property}\` did not match: ' + ` +
            `style1_2 + ' != ' + style2_2; }\n`;
    }
    return {
        'instructions': [
            selectors +
            `${insertBefore}await page.evaluate((e1, e2) => {` +
            `let computed_style1 = getComputedStyle(e1);\n` +
            `let computed_style2 = getComputedStyle(e2);\n${code}` +
            `}, ${varName}1, ${varName}2);${insertAfter}`,
        ],
        'wait': false,
        'checkResult': true,
    };
}

// Possible inputs:
//
// * ("CSS selector 1", "CSS selector 2")
// * ("CSS selector 1", "CSS selector 2", "attribute")
// * ("CSS selector 1", "CSS selector 2", ["CSS properties"])
// * ("CSS selector 1", "CSS selector 2", ("x"|"y"))
function parseCompareElements(line, options) {
    return parseCompareElementsInner(line, options, '', '');
}

// Possible inputs:
//
// * ("CSS selector 1", "CSS selector 2")
// * ("CSS selector 1", "CSS selector 2", "attribute")
// * ("CSS selector 1", "CSS selector 2", ["CSS properties"])
// * ("CSS selector 1", "CSS selector 2", ("x"|"y"))
function parseCompareElementsFalse(line, options) {
    return parseCompareElementsInner(
        line,
        options,
        'try {\n',
        '\n} catch(e) { return; } throw "assert didn\'t fail";');
}

// Possible inputs:
//
// * ("CSS selector", "text")
function parseText(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {'error': 'expected `("CSS selector", "text")`'};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2 || tuple[0].kind !== 'string' || tuple[1].kind !== 'string') {
        return {'error': 'expected `("CSS selector", "text")`'};
    }
    const selector = cleanCssSelector(tuple[0].getValue());
    if (selector.error !== undefined) {
        return selector;
    }
    const value = cleanString(tuple[1].getValue());
    const varName = 'parseTextElem';
    return {
        'instructions': [
            `let ${varName} = await page.$("${selector.value}");\n` +
            `if (${varName} === null) { throw '"${selector.value}" not found'; }\n` +
            `await page.evaluate(e => { e.innerText = "${value}";}, ${varName});`,
        ],
    };
}

function innerParseCssAttribute(line, argName, varName, callback, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {
            'error': `expected \`("CSS selector", "${argName} name", "${argName} value")\` or ` +
                '`("CSS selector", [JSON object])`',
        };
    }
    const tuple = p.elems[0].getValue();
    if (tuple[0].kind !== 'string') {
        return {
            'error': `expected \`("CSS selector", "${argName} name", "${argName} value")\` or ` +
                '`("CSS selector", [JSON object])`',
        };
    }
    let selector = cleanCssSelector(tuple[0].getValue(), '(first argument)');
    if (selector.error !== undefined) {
        return selector;
    }
    selector = selector.value;
    if (tuple.length === 3) {
        if (tuple[1].kind !== 'string' || tuple[2].kind !== 'string') {
            return {
                'error': `expected strings for ${argName} name and ${argName} value (second ` +
                    'and third arguments)',
            };
        }
        const attributeName = cleanString(tuple[1].getValue().trim());
        if (attributeName.length === 0) {
            return {'error': 'attribute name (second argument) cannot be empty'};
        }
        const value = cleanString(tuple[2].getValue());
        return {
            'instructions': [
                `let ${varName} = await page.$("${selector}");\n` +
                `if (${varName} === null) { throw '"${selector}" not found'; }\n` +
                `await page.evaluate(e => { ${callback(attributeName, value)} }, ` +
                `${varName});`,
            ],
        };
    } else if (tuple.length !== 2) {
        return {
            'error': `expected \`("CSS selector", "${argName} name", "${argName} value")\` or ` +
                '`("CSS selector", [JSON object])`',
        };
    }
    if (tuple[1].kind !== 'json') {
        return {
            'error': 'expected json as second argument (since there are only two arguments), ' +
                `found ${tuple[1].kind}`,
        };
    }
    let code = '';
    let warnings = [];
    const json = tuple[1].getValue();
    varName += 'Json';

    for (let i = 0; i < json.length; ++i) {
        const entry = json[i];

        if (entry['value'] === undefined) {
            warnings.push(`No value for key \`${entry['key'].getValue()}\``);
            continue;
        } else if (entry['key'].isRecursive() === true) {
            warnings.push(`Ignoring recursive entry with key \`${entry['key'].getValue()}\``);
            continue;
        }
        const key_s = cleanString(entry['key'].getValue());
        const value_s = cleanString(entry['value'].getValue());
        code += `await page.evaluate(e => { ${callback(key_s, value_s)} }, ${varName});\n`;
    }
    warnings = warnings.length > 0 ? warnings : undefined;
    if (code.length === 0) {
        return {
            'instructions': [],
            'wait': false,
            'warnings': warnings,
        };
    }
    return {
        'instructions': [
            `let ${varName} = await page.$("${selector}");\n` +
            `if (${varName} === null) { throw '"${selector}" not found'; }\n${code}`,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector", "attribute name", "attribute value")
// * ("CSS selector", [JSON object])
function parseAttribute(line, options) {
    return innerParseCssAttribute(line, 'attribute', 'parseAttributeElem',
        (key, value) => `e.setAttribute("${key}","${value}");`, options);
}

// Possible inputs:
//
// * ("CSS selector", "CSS property name", "CSS property value")
// * ("CSS selector", [JSON object])
function parseCss(line, options) {
    return innerParseCssAttribute(line, 'CSS property', 'parseCssElem',
        (key, value) => `e.style["${key}"] = "${value}";`, options);
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
// * CSS selector
function parseScreenshot(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': 'expected boolean or CSS selector, found nothing'};
    } else if (p.elems[0].kind !== 'bool' && p.elems[0].kind !== 'string') {
        return {'error': `expected boolean or CSS selector, found \`${line}\``};
    } else if (p.elems[0].kind === 'bool') {
        return {
            'instructions': [
                `arg.takeScreenshot = ${p.elems[0].getValue()};`,
            ],
            'wait': false,
        };
    }
    const warnings = [];
    const selector = cleanCssSelector(p.elems[0].getValue());
    if (selector.error !== undefined) {
        return selector;
    } else if (selector.value === 'true' || selector.value === 'false') {
        warnings.push(`\`${p.elems[0].getText()}\` is a string and will be used as CSS selector.` +
            ' If you want to set `true` or `false` value, remove quotes.');
    }
    return {
        'instructions': [
            `arg.takeScreenshot = "${selector.value}";`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings.join('\n') : undefined,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseFail(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${line}\``};
    }
    return {
        'instructions': [
            `arg.expectedToFail = ${p.elems[0].getValue()};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseReload(line, options) {
    let timeout = options.timeout;
    const warnings = [];

    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length > 1) {
        return {
            'error': `expected either [integer] or no arguments, got ${p.elems.length} arguments`,
        };
    } else if (p.elems.length !== 0) {
        if (p.elems[0].kind !== 'number') {
            return {
                'error': `expected either [integer] or no arguments, got ${p.elems[0].kind}`,
            };
        }
        timeout = p.elems[0].getValue();
        const ret = checkInteger(p.elems[0], 'timeout', true);
        if (ret.error !== undefined) {
            return ret;
        }
        if (parseInt(timeout) === 0) {
            warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
                'this reload');
        }
    }
    return {
        'instructions': [
            `await page.reload({'waitUntil': 'domcontentloaded', 'timeout': ${timeout}});`,
        ],
        'warnings': warnings.length > 0 ? warnings.join('\n') : undefined,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseShowText(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${line}\``};
    }
    // We need the value to be updated first.
    const instructions = [`arg.showText = ${p.elems[0].getValue()};`];
    // And then to make the expected changes to the DOM.
    if (p.elems[0].getValue() === true) {
        instructions.push('await page.evaluate(() => {' +
            `let tmp = document.getElementById('${consts.STYLE_HIDE_TEXT_ID}');` +
            'if (tmp) { tmp.remove(); }' +
            '});');
    } else {
        instructions.push('await page.evaluate(() => {' +
            `window.${consts.STYLE_ADDER_FUNCTION}('${consts.CSS_TEXT_HIDE}', ` +
            `'${consts.STYLE_HIDE_TEXT_ID}');` +
            '});');
    }
    return {
        'instructions': instructions,
    };
}

// Possible inputs:
//
// * ((x, y), (x, y))
// * ((x, y), "CSS selector")
// * ("CSS selector", (x, y))
// * ("CSS selector", "CSS selector")
function parseDragAndDrop(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                'CSS selector',
        };
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2) {
        return {
            'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                'CSS selector',
        };
    }
    const checkArg = arg => {
        if (arg.kind !== 'tuple' && arg.kind !== 'string') {
            return {
                'error': 'expected tuple with two elements being either a position `(x, y)` or a ' +
                    `CSS selector, found \`${arg.getText()}\``,
            };
        } else if (arg.kind === 'tuple') {
            const tuple = arg.getValue();
            const ret = checkIntegerTuple(tuple, arg.getText(), 'X position', 'Y position', true);
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
            const selector = cleanCssSelector(arg.getValue(), `(${pos} argument)`);
            if (selector.error !== undefined) {
                return selector;
            }
            const box = `${varName}_box`;
            code += `const ${varName} = await page.$("${selector.value}");\n` +
                `if (${varName} === null) { throw '"${selector.value}" not found'; }\n` +
                `const ${box} = await ${varName}.boundingBox();\n` +
                `const ${posName} = [${box}.x + ${box}.width / 2, ${box}.y + ${box}.height / 2];\n`;
        } else {
            const elems = arg.getValue();
            code += `const ${posName} = [${elems[0].getValue()}, ${elems[1].getValue()}];\n`;
        }
        return `${code}await page.mouse.move(${posName}[0], ${posName}[1]);`;
    };
    ret = setupThings(tuple[0], 'parseDragAndDropElem', 'start', 'first');
    if (ret.error !== undefined) {
        return ret;
    }
    instructions.push(ret + 'await page.mouse.down();');
    ret = setupThings(tuple[1], 'parseDragAndDropElem2', 'end', 'second');
    if (ret.error !== undefined) {
        return ret;
    }
    instructions.push(ret + 'await page.mouse.up();');
    return {
        'instructions': instructions,
    };
}

// Possible inputs:
//
// * string
function parseEmulate(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'string') {
        return {'error': `expected string for "device name", found \`${line}\``};
    }
    const device = cleanString(p.elems[0].getValue());
    return {
        'instructions': [
            `if (arg.puppeteer.devices["${device}"] === undefined) { throw 'Unknown device ` +
            `\`${device}\`. List of available devices can be found there: ` +
            'https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js or ' +
            'you can use `--show-devices` option\'; }' +
            ` else { await page.emulate(arg.puppeteer.devices["${device}"]); }`,
        ],
    };
}

// Possible inputs:
//
// * number
function parseTimeout(line, options) {
    const warnings = [];

    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'number') {
        return {'error': `expected integer for number of milliseconds, found \`${line}\``};
    }
    const ret = checkInteger(p.elems[0], 'number of milliseconds', true);
    if (ret.error !== undefined) {
        return ret;
    }
    if (parseInt(p.elems[0].getValue()) === 0) {
        warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
            'this reload');
    }
    return {
        'instructions': [
            `page.setDefaultTimeout(${p.elems[0].getValue()})`,
        ],
        'wait': false,
        'warnings': warnings.length > 0 ? warnings : undefined,
    };
}

// Possible inputs:
//
// * (number, number)
function parseGeolocation(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {'error': `expected (longitude [number], latitude [number]), found \`${line}\``};
    }
    const tuple = p.elems[0].getValue();
    if (tuple[0].kind !== 'number') {
        return {
            'error': 'expected number for longitude (first argument), ' +
                `found \`${tuple[0].getValue()}\``,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': 'expected number for latitude (second argument), ' +
                `found \`${tuple[1].getValue()}\``,
        };
    }
    return {
        'instructions': [
            `await page.setGeolocation(${tuple[0].getValue()}, ${tuple[1].getValue()});`,
        ],
    };
}

// Possible inputs:
//
// * array of strings
function parsePermissions(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'array') {
        return {'error': `expected an array of strings, found \`${line}\``};
    }
    const array = p.elems[0].getValue();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${p.elems[0].getText()}\``};
    }

    for (let i = 0; i < array.length; ++i) {
        if (consts.AVAILABLE_PERMISSIONS.indexOf(array[i].getValue()) === -1) {
            return {
                'error': `\`${array[i].getValue()}\` is an unknown permission, you can see the ` +
                    'list of available permissions with the `--show-permissions` option',
            };
        }
    }

    return {
        'instructions': [
            `arg.permissions = ${p.elems[0].getText()};`,
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseJavascript(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${line}\``};
    }
    return {
        'instructions': [
            `await page.setJavaScriptEnabled(${p.elems[0].getValue()});`,
        ],
    };
}

const ORDERS = {
    'assert': parseAssert,
    'assert-false': parseAssertFalse,
    'attribute': parseAttribute,
    'click': parseClick,
    'compare-elements': parseCompareElements,
    'compare-elements-false': parseCompareElementsFalse,
    'css': parseCss,
    'drag-and-drop': parseDragAndDrop,
    'emulate': parseEmulate,
    'fail': parseFail,
    'focus': parseFocus,
    'geolocation': parseGeolocation,
    'goto': parseGoTo,
    'javascript': parseJavascript,
    'local-storage': parseLocalStorage,
    'move-cursor-to': parseMoveCursorTo,
    'permissions': parsePermissions,
    'press-key': parsePressKey,
    'reload': parseReload,
    'screenshot': parseScreenshot,
    'scroll-to': parseScrollTo,
    'show-text': parseShowText,
    'size': parseSize,
    'text': parseText,
    'timeout': parseTimeout,
    'wait-for': parseWaitFor,
    'write': parseWrite,
};

const NO_INTERACTION_COMMANDS = [
    'emulate',
    'fail',
    'javascript',
    'screenshot',
    'timeout',
];

const BEFORE_GOTO = [
    'emulate',
];

function parseContent(content, options) {
    const lines = content.split(os.EOL);
    const commands = {'instructions': []};
    let res;
    let firstGotoParsed = false;

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].trim();
        if (line.length === 0) {
            continue;
        }
        let order = line.split(':')[0];
        const orderLen = order.length;
        order = order.trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            if (firstGotoParsed === false) {
                if (order !== 'goto' && NO_INTERACTION_COMMANDS.indexOf(order) === -1) {
                    const cmds = NO_INTERACTION_COMMANDS.map(x => `\`${x}\``).join(' or ');
                    return {
                        'error': `First command must be \`goto\` (${cmds} can be used before)!`,
                        'line': i + 1,
                    };
                }
                firstGotoParsed = order === 'goto';
            } else if (BEFORE_GOTO.indexOf(order) !== -1) {
                return {
                    'error': `Command ${order} must be used before first goto!`,
                    'line': i + 1,
                };
            }
            res = ORDERS[order](line.substr(orderLen + 1).trim(), options);
            if (res.error !== undefined) {
                res.line = i + 1;
                return res;
            }
            if (res['warnings'] !== undefined) {
                if (commands['warnings'] === undefined) {
                    commands['warnings'] = [];
                }
                commands['warnings'].push.apply(commands['warnings'], res['warnings']);
            }
            for (let y = 0; y < res['instructions'].length; ++y) {
                commands['instructions'].push({
                    'code': res['instructions'][y],
                    'wait': res['wait'],
                    'checkResult': res['checkResult'],
                    'original': line,
                });
            }
        } else {
            // First, let's check if it's just a comment:
            if (line.trim().startsWith(COMMENT_START) === true) {
                continue;
            }
            return {'error': `Unknown command "${order}"`, 'line': i};
        }
    }
    return commands;
}

module.exports = {
    'parseContent': parseContent,

    // Those functions shouldn't be used directly!
    'parseAssert': parseAssert,
    'parseAssertFalse': parseAssertFalse,
    'parseAttribute': parseAttribute,
    'parseClick': parseClick,
    'parseCompareElements': parseCompareElements,
    'parseCompareElementsFalse': parseCompareElementsFalse,
    'parseCss': parseCss,
    'parseDragAndDrop': parseDragAndDrop,
    'parseEmulate': parseEmulate,
    'parseFail': parseFail,
    'parseFocus': parseFocus,
    'parseGeolocation': parseGeolocation,
    'parseGoTo': parseGoTo,
    'parseJavascript': parseJavascript,
    'parseLocalStorage': parseLocalStorage,
    'parseMoveCursorTo': parseMoveCursorTo,
    'parsePressKey': parsePressKey,
    'parsePermissions': parsePermissions,
    'parseReload': parseReload,
    'parseScreenshot': parseScreenshot,
    'parseScrollTo': parseScrollTo,
    'parseShowText': parseShowText,
    'parseSize': parseSize,
    'parseText': parseText,
    'parseTimeout': parseTimeout,
    'parseWaitFor': parseWaitFor,
    'parseWrite': parseWrite,
};
