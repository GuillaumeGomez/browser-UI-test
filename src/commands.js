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

function cleanCssSelector(s) {
    return cleanString(s).replace(/\\/g, '\\\\').trim();
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
        if (selector.length === 0) {
            return {'error': 'CSS selector cannot be empty'};
        }
        return {
            'instructions': [
                `page.click("${selector}")`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': 'expected a position or a CSS selector'};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2 || tuple[0].kind !== 'number' || tuple[1].kind !== 'number') {
        return {'error': 'invalid syntax: expected "([number], [number])"...'};
    }
    const x = tuple[0].getValue();
    const y = tuple[1].getValue();
    return {
        'instructions': [
            `page.mouse.click(${x},${y})`,
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
    if (selector.length === 0) {
        return {'error': 'CSS selector cannot be empty'};
    }
    return {
        'instructions': [
            `await page.waitFor("${selector}")`,
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
    if (selector.length === 0) {
        return {'error': 'CSS selector cannot be empty'};
    }
    return {
        'instructions': [
            `page.focus("${selector}")`,
        ],
    };
}

// Possible inputs:
//
// * ("[CSS selector (for example: #elementID)]", "text")
// * "text" (in here, it'll write into the current focused element)
function parseWrite(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1) {
        return {'error': 'expected [string] or ([CSS selector], [string])'};
    } else if (p.elems[0].kind === 'string') {
        return {
            'instructions': [
                `page.keyboard.type("${cleanString(p.elems[0].getValue())}")`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': 'expected [string] or ([CSS selector], [string])'};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2) {
        return {
            'error': 'invalid number of arguments in tuple, expected ([CSS selector], [string])',
        };
    } else if (tuple[0].kind !== 'string') {
        return {
            'error':
            `expected a CSS selector as tuple first argument, found a ${tuple[0].kind}`,
        };
    } else if (tuple[1].kind !== 'string') {
        return {'error': `expected a string as tuple second argument, found a ${tuple[1].kind}`};
    }
    const selector = cleanCssSelector(tuple[0].getValue());
    if (selector.length === 0) {
        return {'error': 'CSS selector cannot be empty'};
    }
    return {
        'instructions': [
            `page.focus("${selector}")`,
            `page.keyboard.type("${tuple[1].getValue()}")`,
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
        if (selector.length === 0) {
            return {'error': 'CSS selector cannot be empty'};
        }
        return {
            'instructions': [
                `page.hover("${selector}")`,
            ],
        };
    } else if (p.elems[0].kind !== 'tuple') {
        return {'error': 'expected a position or a CSS selector'};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length !== 2 || tuple[0].kind !== 'number' || tuple[1].kind !== 'number') {
        return {'error': 'invalid syntax: expected "([number], [number])"...'};
    }
    const x = tuple[0].getValue();
    const y = tuple[1].getValue();
    return {
        'instructions': [
            `page.mouse.move(${x},${y})`,
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
        line[i] = utils.getVariableValue(options.variables, line[i]);
        if (line[i] === null) {
            return {'error': `variable \`${line[i]}\` not found in options nor environment`};
        }
    }
    line = line.join('');

    // We just check if it goes to an HTML file, not checking much though...
    if (line.startsWith('http://') === true
        || line.startsWith('https://') === true
        || line.startsWith('www.') === true
        || line.startsWith('file://') === true) {
        return {
            'instructions': [
                `await page.goto("${cleanString(line)}")`,
            ],
        };
    } else if (line.startsWith('.')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"/${cleanString(line)}")`,
            ],
        };
    } else if (line.startsWith('/')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"${cleanString(line)}")`,
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
    if (tuple.length !== 2 || tuple[0].kind !== 'number' || tuple[1].kind !== 'number') {
        return {'error': 'expected `([number], [number])`'};
    }
    const width = tuple[0].getValue();
    const height = tuple[1].getValue();
    return {
        'instructions': [
            `page.setViewport({width: ${width}, height: ${height}})`,
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
            `page.evaluate(() => { ${content.join('\n')} })`,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * ("CSS selector")
// * ("CSS selector", number of occurences [integer])
// * ("CSS selector", CSS elements [JSON object])
// * ("CSS selector", text [STRING])
// * ("CSS selector", attribute name [STRING], attribute value [STRING])
function parseAssert(line, options) {
    const p = new Parser(line, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    } else if (p.elems.length !== 1 || p.elems[0].kind !== 'tuple') {
        return {'error': 'expected a tuple, read the documentation to see the accepted inputs'};
    }
    const tuple = p.elems[0].getValue();
    if (tuple.length < 1 || tuple.length > 3) {
        return {'error': 'expected a tuple, read the documentation to see the accepted inputs'};
    } else if (tuple[0].kind !== 'string') {
        return {'error': `expected first argument to be a CSS selector, found a ${tuple[0].kind}`};
    }
    const selector = cleanCssSelector(tuple[0].getValue());
    if (selector.length === 0) {
        return {'error': 'CSS selector cannot be empty'};
    }
    if (tuple.length === 1) {
        //
        // EXISTENCE CHECK
        //
        return {
            'instructions': [
                `if (page.$("${selector}") === null) { throw '"${selector}" not found'; }`,
            ],
            'wait': false,
            'checkResult': true,
        };
    } else if (tuple[1].kind === 'number') {
        //
        // NUMBER OF OCCURENCES CHECK
        //
        if (tuple.length !== 2) {
            return {'error': 'unexpected argument after number of occurences'};
        }
        const occurences = tuple[1].getValue();
        const varName = 'parseAssertElemInt';
        return {
            'instructions': [
                `let ${varName} = await page.$$("${selector}");\n` +
                // TODO: maybe check differently depending on the tag kind?
                `if (${varName}.length !== ${occurences}) { throw 'expected ${occurences} ` +
                `elements, found ' + ${varName}.length; }`,
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
                'await page.evaluate(e => {' +
                `let assertComputedStyle = getComputedStyle(e);\n${code}` +
                `}, ${varName});`,
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
                // TODO: maybe check differently depending on the tag kind?
                `let t = await (await ${varName}.getProperty("textContent")).jsonValue();\n` +
                `if (t !== "${value}") { throw '"' + t + '" !== "${value}"'; }`,
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
                'await page.evaluate(e => {\n' +
                `if (e.getAttribute("${attributeName}") !== "${value}") {\n` +
                `throw 'expected "${value}", found "' + e.getAttribute("${attributeName}") + '"` +
                ` for attribute "${attributeName}"';\n}\n}, ${varName});`,
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
    if (selector.length === 0) {
        return {'error': 'CSS selector cannot be empty'};
    }
    const value = cleanString(tuple[1].getValue());
    const varName = 'parseTextElem';
    return {
        'instructions': [
            `let ${varName} = await page.$("${selector}");\n` +
            `if (${varName} === null) { throw '"${selector}" not found'; }\n` +
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
    const selector = cleanCssSelector(tuple[0].getValue());
    if (selector.length === 0) {
        return {'error': 'CSS selector (first argument) cannot be empty'};
    }
    if (tuple.length === 3) {
        if (tuple[1].kind !== 'string' || tuple[2].kind !== 'string') {
            return {
                'error': `expected strings for ${argName} name and ${argName} value (second ` +
                    'and third arguments)',
            };
        }
        const attributeName = cleanString(tuple[1].getValue().trim());
        if (selector.length === 0) {
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
            'error': 'expected json as second argument (since there are only arguments), found ' +
                `${tuple[1].kind}`,
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
    if (selector.length === 0) {
        return {'error': 'CSS selector cannot be empty'};
    } else if (selector === 'true' || selector === 'false') {
        warnings.push(`\`${p.elems[0].getText()}\` is a string and will be used as CSS selector.` +
            ' If you want to set `true` or `false` value, remove quotes.');
    }
    return {
        'instructions': [
            `arg.takeScreenshot = "${selector}";`,
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
    let timeout = 30000;
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
        if (timeout === '0') {
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
        instructions.push('page.evaluate(() => {' +
            `let tmp = document.getElementById('${consts.STYLE_HIDE_TEXT_ID}');` +
            'if (tmp) { tmp.remove(); }' +
            '});');
    } else {
        instructions.push('page.evaluate(() => {' +
            `window.${consts.STYLE_ADDER_FUNCTION}('${consts.CSS_TEXT_HIDE}', ` +
            `'${consts.STYLE_HIDE_TEXT_ID}');` +
            '});');
    }
    return {
        'instructions': instructions,
    };
}

const ORDERS = {
    'assert': parseAssert,
    'attribute': parseAttribute,
    'click': parseClick,
    'css': parseCss,
    'fail': parseFail,
    'focus': parseFocus,
    'goto': parseGoTo,
    'local-storage': parseLocalStorage,
    'move-cursor-to': parseMoveCursorTo,
    'reload': parseReload,
    'screenshot': parseScreenshot,
    'scroll-to': parseScrollTo,
    'show-text': parseShowText,
    'size': parseSize,
    'text': parseText,
    'wait-for': parseWaitFor,
    'write': parseWrite,
};

const NO_INTERACTION_COMMANDS = [
    'fail',
    'screenshot',
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
        const order = line.split(':')[0].toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            if (firstGotoParsed === false) {
                if (order !== 'goto' && NO_INTERACTION_COMMANDS.indexOf(order) === -1) {
                    const cmds = NO_INTERACTION_COMMANDS.map(x => `\`${x}\``).join(', ');
                    return {
                        'error': `First command must be \`goto\` (${cmds} can be used before)!`,
                        'line': i,
                    };
                }
                firstGotoParsed = order === 'goto';
            }
            res = ORDERS[order](line.substr(order.length + 1).trim(), options);
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
    'parseAttribute': parseAttribute,
    'parseClick': parseClick,
    'parseCss': parseCss,
    'parseFail': parseFail,
    'parseFocus': parseFocus,
    'parseGoTo': parseGoTo,
    'parseLocalStorage': parseLocalStorage,
    'parseMoveCursorTo': parseMoveCursorTo,
    'parseReload': parseReload,
    'parseScreenshot': parseScreenshot,
    'parseScrollTo': parseScrollTo,
    'parseShowText': parseShowText,
    'parseSize': parseSize,
    'parseText': parseText,
    'parseWaitFor': parseWaitFor,
    'parseWrite': parseWrite,
};
