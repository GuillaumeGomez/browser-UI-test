const os = require('os');
const utils = require('./utils.js');


function cleanString(s) {
    return s.replace(/"/g, '\\"').replace(/'/g, '\\\'');
}

function cleanCssSelector(s) {
    return cleanString(s).replace(/\\/g, '\\\\');
}

function matchPosition(s) {
    return s.match(/\([0-9]+,[ ]*[0-9]+\)/g) !== null;
}

function matchInteger(s) {
    return s.match(/[0-9]+/g) !== null;
}

function isWhiteSpace(c) {
    return c === ' ' || c === '\t';
}

function isStringChar(c) {
    return c === '\'' || c === '"';
}

function parseString(s) {
    let i = 0;

    while (i < s.length && isWhiteSpace(s.charAt(i)) === true) {
        i += 1;
    }
    if (i >= s.length) {
        return {'error': 'no string'};
    }
    const endChar = s.charAt(i);
    if (isStringChar(endChar) === false) {
        return {'error': 'expected `\'` or `"` character'};
    }
    i += 1;
    const start = i;
    let c;
    while (i < s.length) {
        c = s.charAt(i);
        if (c === endChar) {
            return {'value': s.substring(start, i), 'pos': i};
        } else if (c === '\\') {
            i += 1;
        }
        i += 1;
    }
    return {'error': `expected \`${endChar}\` character at the end of the string`};
}

function handlePathParameters(line, split, join) {
    const parts = line.split(split);
    if (parts.length > 1) {
        for (let i = 1; i < parts.length; ++i) {
            if (parts[i].charAt(0) === '/') { // to avoid having "//"
                parts[i] = parts[i].substr(1);
            }
        }
        line = parts.join(join);
    }
    return line;
}

function parseCssSelector(line) {
    const ret = parseString(line);
    if (ret.error !== undefined) {
        return ret;
    }
    const selector = cleanCssSelector(ret.value).trim();
    if (selector.length === 0) {
        return {'error': 'selector cannot be empty'};
    }
    let i = ret.pos + 1;
    while (i < line.length) {
        if (isWhiteSpace(line.charAt(i)) !== true) {
            return {'error': `unexpected token \`${line.charAt(i)}\` after CSS selector`};
        }
        i += 1;
    }
    return {'value': selector};
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
function parseClick(line) {
    if (line.startsWith('(')) {
        if (!line.endsWith(')')) {
            return {'error': 'Invalid syntax: expected position to end with \')\'...'};
        }
        if (matchPosition(line) !== true) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [x, y] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {
            'instructions': [
                `page.mouse.click(${x},${y})`,
            ],
        };
    } else if (line.charAt(0) !== '"' && line.charAt(0) !== '\'') {
        return {'error': 'Expected a position or a CSS selector'};
    }
    const ret = parseCssSelector(line);
    if (ret.error !== undefined) {
        return ret;
    }
    const selector = ret.value;
    return {
        'instructions': [
            `page.click("${selector}")`,
        ],
    };
}

// Possible inputs:
//
// * Number of milliseconds
// * "CSS selector" (for example: "#elementID")
function parseWaitFor(line) {
    if (line.match(/^[0-9]+$/g) !== null) {
        return {
            'instructions': [
                `await page.waitFor(${parseInt(line)})`,
            ],
            'wait': false,
        };
    } else if (line.charAt(0) !== '"' && line.charAt(0) !== '\'') {
        return {'error': 'Expected an integer or a CSS selector'};
    }
    const ret = parseCssSelector(line);
    if (ret.error !== undefined) {
        return ret;
    }
    const selector = ret.value;
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
function parseFocus(line) {
    if (line.charAt(0) !== '"' && line.charAt(0) !== '\'') {
        return {'error': 'Expected a CSS selector'};
    }
    const ret = parseCssSelector(line);
    if (ret.error !== undefined) {
        return ret;
    }
    const selector = ret.value;
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
function parseWrite(line) {
    if (line.startsWith('(') === true) {
        if (line.charAt(line.length - 1) !== ')') {
            return {'error': 'expected to end with `)` character'};
        }
        let ret = parseString(line.substring(1));
        if (ret.error !== undefined) {
            return ret;
        }
        let pos = ret.pos + 2;
        while (pos < line.length && isWhiteSpace(line.charAt(pos)) === true) {
            pos += 1;
        }
        const path = cleanCssSelector(ret.value).trim();
        if (path.length === 0) {
            return {'error': 'selector cannot be empty'};
        } else if (line.charAt(pos) !== ',') {
            return {'error': `expected \`,\` after first parameter, found \`${line.charAt(pos)}\``};
        }
        // We take everything between the comma and the paren.
        const sub = line.substring(pos + 1, line.length - 1).trim();
        if (sub.length === 0) {
            return {'error': 'expected a string as second parameter'};
        } else if (sub.charAt(0) !== '"' && sub.charAt(0) !== '\'') {
            return {'error': `expected a string as second parameter, found \`${sub}\``};
        }
        ret = parseString(sub); // no trim call in here!
        if (ret.error !== undefined) {
            return ret;
        }
        // check there is nothing after the second parameter
        let i = ret.pos + 1;
        while (i < sub.length) {
            if (isWhiteSpace(sub.charAt(i)) !== true) {
                return {'error': `unexpected token \`${sub.charAt(i)}\` after second parameter`};
            }
            i += 1;
        }
        return {
            'instructions': [
                `page.focus("${path}")`,
                `page.keyboard.type("${ret.value}")`,
            ],
        };
    } else if (line.startsWith('"') || line.startsWith('\'')) { // current focused element
        const x = parseString(line);
        if (x.error !== undefined) {
            return x;
        }
        // check there is nothing after the string
        let i = x.pos + 1;
        while (i < line.length) {
            if (isWhiteSpace(line.charAt(i)) !== true) {
                return {'error': `unexpected token \`${line.charAt(i)}\` after string`};
            }
            i += 1;
        }
        return {
            'instructions': [
                `page.keyboard.type("${cleanString(x.value)}")`,
            ],
        };
    }
    return {'error': 'expected [string] or ([CSS path], [string])'};
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
function parseMoveCursorTo(line) {
    if (line.startsWith('(')) {
        if (!line.endsWith(')')) {
            return {'error': 'Invalid syntax: expected position to end with \')\'...'};
        }
        if (matchPosition(line) !== true) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [x, y] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {
            'instructions': [
                `page.mouse.move(${x},${y})`,
            ],
        };
    } else if (line.charAt(0) !== '"' && line.charAt(0) !== '\'') {
        return {'error': 'Expected a position or a CSS selector'};
    }
    const ret = parseCssSelector(line);
    if (ret.error !== undefined) {
        return ret;
    }
    const selector = ret.value;
    return {
        'instructions': [
            `page.hover("${selector}")`,
        ],
    };
}

// Possible inputs:
//
// * relative path (example: ../struct.Path.html)
// * full URL (for example: https://doc.rust-lang.org/std/struct.Path.html)
// * local path (example: file://some-file.html)
//   /!\ Please note for this one that you can use "{doc-path}" inside it if you want to use
//       the "--doc-path" argument. For example: "file://{doc-path}/index.html"
//   /!\ Please also note that you need to provide a full path to the web browser. You can add
//       the full current path by using "{current-dir}". For example:
//       "file://{current-dir}{doc-path}/index.html"
function parseGoTo(line, docPath) {
    // We just check if it goes to an HTML file, not checking much though...
    if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('www.')) {
        return {
            'instructions': [
                `await page.goto("${line}")`,
            ],
        };
    } else if (line.startsWith('file://')) {
        line = handlePathParameters(line, '{doc-path}', docPath);
        line = handlePathParameters(line, '{current-dir}', utils.getCurrentDir());
        return {
            'instructions': [
                `await page.goto("${line}")`,
            ],
        };
    } else if (line.startsWith('.')) {
        return {
            'instructions': [
                `await page.goto(page.url().split("/").slice(0, -1).join("/") + "/${line}")`,
            ],
        };
    } else if (line.startsWith('/')) {
        return {
            'instructions': [
                `await page.goto(page.url().split("/").slice(0, -1).join("/") + "${line}")`,
            ],
        };
    }
    return {'error': 'A relative path or a full URL was expected'};
}

// Possible inputs:
//
// * (X, Y)
// * "CSS selector" (for example: "#elementID")
function parseScrollTo(line) {
    return parseMoveCursorTo(line); // The page will scroll to the element
}

// Possible inputs:
//
// * (width, height)
function parseSize(line) {
    if (line.startsWith('(')) {
        if (!line.endsWith(')')) {
            return {'error': 'Invalid syntax: expected size to end with `)`...'};
        }
        if (matchPosition(line) !== true) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [width, height] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {
            'instructions': [
                `page.setViewport({width: ${width}, height: ${height}})`,
            ],
        };
    }
    return {'error': `Expected \`(\` character, found \`${line.charAt(0)}\``};
}

// Possible inputs:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseLocalStorage(line) {
    if (!line.startsWith('{')) {
        return {'error': `Expected JSON object, found \`${line}\``};
    }
    try {
        const d = JSON.parse(line);
        const content = [];
        for (const key in d) {
            if (key.length > 0 && Object.prototype.hasOwnProperty.call(d, key)) {
                const key_s = cleanString(key);
                const value_s = cleanString(d[key]);
                content.push(`localStorage.setItem("${key_s}", "${value_s}");`);
            }
        }
        if (content.length === 0) {
            return {'instructions': []};
        }
        return {
            'instructions': [
                `page.evaluate(() => { ${content.join('\n')} })`,
            ],
        };
    } catch (e) {
        return {'error': 'Error when parsing JSON content: ' + e};
    }
}

// Possible inputs:
//
// * ("CSS selector")
// * ("CSS selector", text [STRING])
// * ("CSS selector", number of occurences [integer])
// * ("CSS selector", CSS elements [JSON object])
// * ("CSS selector", attribute name [STRING], attribute value [STRING])
function parseAssert(s) {
    if (s.charAt(0) !== '(') {
        return {'error': 'expected `(` character'};
    } else if (s.charAt(s.length - 1) !== ')') {
        return {'error': 'expected to end with `)` character'};
    }
    const ret = parseString(s.substring(1));
    if (ret.error !== undefined) {
        return ret;
    }
    let pos = ret.pos + 2;
    while (isWhiteSpace(s.charAt(pos)) === true) {
        pos += 1;
    }
    const path = cleanCssSelector(ret.value).trim();
    if (path.length === 0) {
        return {'error': 'selector cannot be empty'};
    }
    if (s.charAt(pos) === ')') {
        return {
            'instructions': [
                `if (page.$("${path}") === null) { throw '"${path}" not found'; }`,
            ],
            'wait': false,
        };
    } else if (s.charAt(pos) !== ',') {
        return {'error': `expected \`,\` or \`)\`, found \`${s.charAt(pos)}\``};
    }
    // We take everything between the comma and the paren.
    const sub = s.substring(pos + 1, s.length - 1).trim();
    if (sub.length === 0) {
        return {'error': 'expected something as second parameter or remove the comma'};
    } else if (sub.startsWith('"') || sub.startsWith('\'')) {
        const secondParam = parseString(sub);
        if (secondParam.error !== undefined) {
            return secondParam;
        }
        let i = secondParam.pos + 1;
        while (i < sub.length && isWhiteSpace(sub.charAt(i)) === true) {
            i += 1;
        }
        //
        // TEXT CONTENT CHECK
        //
        if (i >= sub.length) {
            const value = cleanString(secondParam.value);
            const varName = 'parseAssertElemStr';
            return {
                'instructions': [
                    `let ${varName} = await page.$("${path}");\n` +
                    `if (${varName} === null) { throw '"${path}" not found'; }\n` +
                    // TODO: maybe check differently depending on the tag kind?
                    `let t = await (await ${varName}.getProperty("textContent")).jsonValue();\n` +
                    `if (t !== "${value}") { throw '"' + t + '" !== "${value}"'; }`,
                ],
                'wait': false,
            };
        }
        //
        // ATTRIBUTE CHECK
        //
        if (sub.charAt(i) !== ',') {
            return {'error': `unexpected token after second parameter: \`${sub.charAt(i)}\``};
        }
        const attributeName = cleanString(secondParam.value);
        // Since we check for attribute, the attribute name cannot be empty
        if (attributeName.length === 0) {
            return {'error': 'attribute name cannot be empty'};
        }
        const third = sub.substring(i + 1).trim();
        const thirdParam = parseString(third);
        if (thirdParam.error !== undefined) {
            return thirdParam;
        }
        i = thirdParam.pos + 1;
        while (i < third.length) {
            if (isWhiteSpace(third.charAt(i)) !== true) {
                return {'error': `expected \`)\`, found \`${third.charAt(i)}\``};
            }
            i += 1;
        }
        const value = cleanString(thirdParam.value);
        const varName = 'parseAssertElemAttr';
        return {
            'instructions': [
                `let ${varName} = await page.$("${path}");\n` +
                `if (${varName} === null) { throw '"${path}" not found'; }\n` +
                'await page.evaluate(e => {\n' +
                `if (e.getAttribute("${attributeName}") !== "${value}") {\n` +
                `throw 'expected "${value}", found "' + e.getAttribute("${attributeName}") + '"` +
                ` for attribute "${attributeName}"';\n}\n}, ${varName});`,
            ],
            'wait': false,
        };
    } else if (sub.startsWith('{')) {
        let d;
        try {
            d = JSON.parse(sub);
        } catch (error) {
            return {'error': `Invalid JSON object: "${error}"`};
        }
        let code = '';
        for (const key in d) {
            if (key.length > 0 && Object.prototype.hasOwnProperty.call(d, key)) {
                const clean = cleanString(d[key]);
                const cKey = cleanString(key);
                // TODO: check how to compare CSS property
                code += `if (assertComputedStyle["${cKey}"] != "${clean}") { ` +
                    `throw 'expected "${clean}", got for key "${cKey}" for "${path}"'; }\n`;
            }
        }
        if (code.length === 0) {
            return {
                'instructions': [],
                'wait': false,
            };
        }
        const varName = 'parseAssertElemJson';
        return {
            'instructions': [
                `let ${varName} = await page.$("${path}");\n` +
                `if (${varName} === null) { throw '"${path}" not found'; }\n` +
                'await page.evaluate(e => {' +
                `let assertComputedStyle = getComputedStyle(e);\n${code}` +
                `}, ${varName});`,
            ],
            'wait': false,
        };
    } else if (matchInteger(sub) === true) {
        const varName = 'parseAssertElemInt';
        return {
            'instructions': [
                `let ${varName} = await page.$$("${path}");\n` +
                // TODO: maybe check differently depending on the tag kind?
                `if (${varName}.length !== ${sub}) { throw 'expected ${sub} ` +
                `elements, found ' + ${varName}.length; }`,
            ],
            'wait': false,
        };
    }
    return {'error': `expected [integer] or [string] or [JSON object], found \`${sub}\``};
}

// Possible inputs:
//
// * ("CSS selector", "text")
function parseText(s) {
    if (s.charAt(0) !== '(') {
        return {'error': 'expected `(` character'};
    } else if (s.charAt(s.length - 1) !== ')') {
        return {'error': 'expected to end with `)` character'};
    }
    const ret = parseString(s.substring(1));
    if (ret.error !== undefined) {
        return ret;
    }
    let pos = ret.pos + 2;
    while (isWhiteSpace(s.charAt(pos)) === true) {
        pos += 1;
    }
    const path = cleanCssSelector(ret.value).trim();
    if (path.length === 0) {
        return {'error': 'selector cannot be empty'};
    } else if (s.charAt(pos) !== ',') {
        return {'error': `expected \`,\` after first argument, found \`${s.charAt(pos)}\``};
    }
    // We take everything between the comma and the paren.
    const sub = s.substring(pos + 1, s.length - 1).trim();
    if (sub.length === 0) {
        return {'error': 'expected a string as second parameter'};
    } else if (sub.startsWith('"') || sub.startsWith('\'')) {
        const secondParam = parseString(sub);
        if (secondParam.error !== undefined) {
            return secondParam;
        }
        let i = secondParam.pos + 1;
        while (i < sub.length) {
            if (isWhiteSpace(sub.charAt(i)) !== true) {
                return {'error': `unexpected token: \`${sub.charAt(i)}\` after second parameter`};
            }
            i += 1;
        }
        const value = cleanString(secondParam.value);
        const varName = 'parseTextElem';
        return {
            'instructions': [
                `let ${varName} = await page.$("${path}");\n` +
                `if (${varName} === null) { throw '"${path}" not found'; }\n` +
                `await page.evaluate(e => { e.innerText = "${value}";}, ${varName});`,
            ],
        };
    }
    return {'error': `expected [string] as second parameter, found \`${sub}\``};
}

// Possible inputs:
//
// * ("CSS selector", "attribute name", "attribute value")
function parseAttribute(s) {
    if (s.charAt(0) !== '(') {
        return {'error': 'expected `(` character'};
    } else if (s.charAt(s.length - 1) !== ')') {
        return {'error': 'expected to end with `)` character'};
    }
    let ret = parseString(s.substring(1));
    if (ret.error !== undefined) {
        return ret;
    }
    let pos = ret.pos + 2;
    while (isWhiteSpace(s.charAt(pos)) === true) {
        pos += 1;
    }
    if (ret.value.length < 1) {
        return {'error': 'path (first parameter) cannot be empty'};
    }
    const path = cleanCssSelector(ret.value).trim();
    if (path.length === 0) {
        return {'error': 'selector cannot be empty'};
    } else if (s.charAt(pos) !== ',') {
        return {'error': `expected \`,\`, found \`${s.charAt(pos)}\``};
    }
    pos += 1;
    while (isWhiteSpace(s.charAt(pos)) === true) {
        pos += 1;
    }
    ret = parseString(s.substring(pos));
    if (ret.error !== undefined) {
        return ret;
    } else if (ret.value.length < 1) {
        return {'error': 'attribute name (second parameter) cannot be empty'};
    }
    const attributeName = cleanString(ret.value);
    pos += ret.pos + 1;
    while (isWhiteSpace(s.charAt(pos)) === true) {
        pos += 1;
    }
    if (s.charAt(pos) !== ',') {
        return {'error': `expected \`,\` or \`)\`, found \`${s.charAt(pos)}\``};
    }
    // We take everything between the comma and the paren.
    const sub = s.substring(pos + 1, s.length - 1).trim();
    if (sub.length === 0) {
        return {'error': 'expected a string as third parameter'};
    }
    ret = parseString(sub);
    if (ret.error !== undefined) {
        return ret;
    }
    let i = ret.pos + 1;
    while (i < sub.length) {
        if (isWhiteSpace(sub.charAt(i)) !== true) {
            return {'error': `unexpected token: \`${sub.charAt(i)}\` after third parameter`};
        }
        i += 1;
    }
    const value = cleanString(ret.value);
    const varName = 'parseAttributeElem';
    return {
        'instructions': [
            `let ${varName} = await page.$("${path}");\n` +
            `if (${varName} === null) { throw '"${path}" not found'; }\n` +
            `await page.evaluate(e => { e.setAttribute("${attributeName}","${value}"); }, ` +
            `${varName});`,
        ],
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseScreenshot(line) {
    if (line !== 'true' && line !== 'false') {
        return {'error': `Expected "true" or "false" value, found \`${line}\``};
    }
    return {
        'instructions': [
            `arg.takeScreenshot = ${line === 'true' ? 'true' : 'false'};`,
        ],
        'wait': false,
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseFail(line) {
    if (line !== 'true' && line !== 'false') {
        return {'error': `Expected "true" or "false" value, found \`${line}\``};
    }
    return {
        'instructions': [
            `arg.expectedToFail = ${line === 'true' ? 'true' : 'false'};`,
        ],
        'wait': false,
    };
}

const ORDERS = {
    'assert': parseAssert,
    'attribute': parseAttribute,
    'click': parseClick,
    'fail': parseFail,
    'focus': parseFocus,
    'goto': parseGoTo,
    'local-storage': parseLocalStorage,
    'move-cursor-to': parseMoveCursorTo,
    'screenshot': parseScreenshot,
    'scroll-to': parseScrollTo,
    'size': parseSize,
    'text': parseText,
    'wait-for': parseWaitFor,
    'write': parseWrite,
};

const NO_INTERACTION_COMMANDS = [
    'fail',
    'screenshot',
];

function parseContent(content, docPath) {
    const lines = content.split(os.EOL);
    const commands = {'instructions': []};
    let res;
    let firstGotoParsed = false;

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].split('// ')[0].trim(); // We remove the comment part if any.
        if (line.length === 0) {
            continue;
        }
        const order = line.split(':')[0].toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            res = ORDERS[order](line.substr(order.length + 1).trim(), docPath);
            if (res.error !== undefined) {
                res.line = i + 1;
                return res;
            }
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
            for (let y = 0; y < res['instructions'].length; ++y) {
                commands['instructions'].push({'code': res['instructions'][y], 'original': line});
            }
        } else {
            return {'error': `Unknown command "${order}"`, 'line': i};
        }
    }
    return commands;
}

module.exports = {
    parseContent: parseContent,

    // Those functions shouldn't be used directly!
    parseAssert: parseAssert,
    parseAttribute: parseAttribute,
    parseClick: parseClick,
    parseFail: parseFail,
    parseFocus: parseFocus,
    parseGoTo: parseGoTo,
    parseLocalStorage: parseLocalStorage,
    parseMoveCursorTo: parseMoveCursorTo,
    parseScreenshot: parseScreenshot,
    parseScrollTo: parseScrollTo,
    parseSize: parseSize,
    parseText: parseText,
    parseWaitFor: parseWaitFor,
    parseWrite: parseWrite,
};
