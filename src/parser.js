const os = require('os');
const utils = require('./utils.js');


function cssSelector(s) {
    return s.startsWith('"') === false &&
           s.startsWith('\'') === false &&
           s.indexOf('`') === -1;
}

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

// Possible incomes:
//
// * (X, Y)
// * CSS selector (for example: #elementID)
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
        return {'instructions': [
            `page.mouse.click(${x},${y})`,
        ]};
    }
    if (cssSelector(line) !== true) {
        return {'error': 'Invalid CSS selector'};
    }
    const selector = cleanCssSelector(line).trim();
    if (selector.length === 0) {
        return {'error': 'selector cannot be empty'};
    }
    return {'instructions': [
        `page.click("${selector}")`,
    ]};
}

// Possible incomes:
//
// * Number of milliseconds
// * CSS selector (for example: #elementID)
function parseWaitFor(line) {
    if (line.match(/[0-9]+/) !== null) {
        return {'instructions': [
            `await page.waitFor(${parseInt(line)})`,
        ]};
    } else if (cssSelector(line) === true) {
        const selector = cleanCssSelector(line).trim();
        if (selector.length === 0) {
            return {'error': 'selector cannot be empty'};
        }
        return {
            'instructions': [
                `await page.waitFor("${selector}")`,
            ],
            'wait': false,
        };
    }
    return {'error': 'Expected a number or a CSS selector'};
}

// Possible income:
//
// * CSS selector (for example: #elementID)
function parseFocus(line) {
    if (cssSelector(line) === true) {
        const selector = cleanCssSelector(line).trim();
        if (selector.length === 0) {
            return {'error': 'selector cannot be empty'};
        }
        return {'instructions': [
            `page.focus("${selector}")`,
        ]};
    }
    return {'error': 'Expected a CSS selector'};
}

// Possible income (you have to put the double quotes!):
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
        let pos = ret.pos + 1;
        while (pos < line.length && isWhiteSpace(line.charAt(pos)) === true) {
            pos += 1;
        }
        if (line.charAt(pos) !== ',') {
            return {'error': `expected \`,\` after first parameter, found \`${line.charAt(pos)}\``};
        }
        const path = cleanCssSelector(ret.value).trim();
        if (path.length === 0) {
            return {'error': 'selector cannot be empty'};
        }
        // We take everything between the comma and the paren.
        const sub = line.substring(pos + 1, line.length - 1).trim();
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
        return {'instructions': [
            `page.focus("${path}")`,
            `page.keyboard.type("${ret.value}")`,
        ]};
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
        return {'instructions': [
            `page.keyboard.type("${x.value}")`,
        ]};
    }
    return {'error': 'expected [string] or ([path], [string])'};
}

// Possible incomes:
//
// * (X, Y)
// * CSS selector (for example: #elementID)
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
        return {'instructions': [
            `page.mouse.move(${x},${y})`,
        ]};
    } else if (cssSelector(line) === true) {
        const path = cleanCssSelector(line).trim();
        if (path.length === 0) {
            return {'error': 'selector cannot be empty'};
        }
        return {'instructions': [
            `page.hover("${path}")`,
        ]};
    }
    return {'error': 'Invalid CSS selector or invalid position'};
}

// Possible incomes:
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
    if (line.startsWith('http') || line.startsWith('www.')) {
        return {'instructions': [
            `await page.goto("${line}")`,
        ]};
    } else if (line.startsWith('file://')) {
        line = handlePathParameters(line, '{doc-path}', docPath);
        line = handlePathParameters(line, '{current-dir}', utils.getCurrentDir());
        return {'instructions': [
            `await page.goto("${line}")`,
        ]};
    } else if (line.startsWith('.')) {
        return {'instructions': [
            `await page.goto(page.url().split("/").slice(0, -1).join("/") + "/" + "${line}")`,
        ]};
    } else if (line.startsWith('/')) {
        return {'instructions': [
            `await page.goto(page.url().split("/").slice(0, -1).join("/") + "${line}")`,
        ]};
    }
    return {'error': 'A relative path or a full URL was expected'};
}

// Possible incomes:
//
// * (X, Y)
// * CSS selector (for example: #elementID)
function parseScrollTo(line) {
    return parseMoveCursorTo(line); // The page will scroll to the element
}

// Possible income:
//
// * (width, height)
function parseSize(line) {
    if (line.startsWith('(')) {
        if (!line.endsWith(')')) {
            return {'error': 'Invalid syntax: expected size to end with \')\'...'};
        }
        if (matchPosition(line) !== true) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [width, height] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {'instructions': [
            `page.setViewport({width: ${width}, height: ${height}})`,
        ]};
    }
    return {'error': `Expected \`(\` character, found \`${line.charAt(0)}\``};
}

// Possible income:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseLocalStorage(line) {
    if (!line.startsWith('{')) {
        return {'error': `Expected json object (object wrapped inside "{}"), found "${line}"`};
    }
    try {
        const d = JSON.parse(line);
        const content = [];
        for (const key in d) {
            if (key.length > 0 && Object.prototype.hasOwnProperty.call(d, key)) {
                const key_s = key.split('"').join('\\"');
                const value_s = d[key].split('"').join('\\"');
                content.push(`localStorage.setItem("${key_s}", "${value_s}");`);
            }
        }
        if (content.length === 0) {
            return {'instructions': []};
        }
        return {'instructions': [
            `page.evaluate(() => {
                ${content.join('\n')}
            })`,
        ]};
    } catch (e) {
        return {'error': 'Error when parsing JSON content: ' + e};
    }
}

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
        return {'instructions': [
            `if (page.$("${path}") === null) { throw '"${path}" not found'; }`,
        ]};
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
            return {'instructions': [
                `let parseAssertElemStr = await page.$("${path}");\n` +
                `if (parseAssertElemStr === null) { throw '"${path}" not found'; }\n` +
                // TODO: maybe check differently depending on the tag kind?
                'let t = await (await parseAssertElemStr.getProperty("textContent")).jsonValue();' +
                `if (t !== "${value}") { throw '"' + t + '" !== "${value}"'; }`,
            ]};
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
        return {'instructions': [
            `let parseAssertElemAttr = await page.$("${path}");\n` +
            `if (parseAssertElemAttr === null) { throw '"${path}" not found'; }\n` +
            `await page.evaluate(e => { if (e.getAttribute("${attributeName}") !== "${value}") {` +
            ` throw 'expected "${value}", found "' + e.getAttribute("${attributeName}") + '"` +
            ` for attribute "${attributeName}"'; } }, parseAssertElemAttr);`,
        ]};
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
                    `throw 'expected "${clean}", got for key "${cKey}" for "${path}"'; }`;
            }
        }
        if (code.length === 0) {
            return {'instructions': []};
        }
        return {'instructions': [
            `let parseAssertElemJson = await page.$("${path}");\n` +
            `if (parseAssertElemJson === null) { throw '"${path}" not found'; }\n` +
            'await page.evaluate(e => {' +
            'let assertComputedStyle = getComputedStyle(e);\n' +
            code +
            '}, parseAssertElemJson);',
        ]};
    } else if (matchInteger(sub) === true) {
        return {'instructions': [
            `let parseAssertElemInt = await page.$$("${path}");\n` +
            // TODO: maybe check differently depending on the tag kind?
            `if (parseAssertElemInt.length !== ${sub}) { throw 'expected ${sub} ` +
            'elements, found \' + parseAssertElemInt.length; }',
        ]};
    }
    return {'error': `expected [integer] or [string] or [JSON object], found \`${sub}\``};
}

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
        return {'error': `expected \`,\` or \`)\`, found \`${s.charAt(pos)}\``};
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
        return {'instructions': [
            `let parseTextElem = await page.$("${path}");\n` +
            `if (parseTextElem === null) { throw '"${path}" not found'; }\n` +
            `await page.evaluate(e => { e.innerText = "${value}";}, parseTextElem);`,
        ]};
    }
    return {'error': `expected [string], found \`${sub}\``};
}

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
    return {'instructions': [
        `let parseAttributeElem = await page.$("${path}");\n` +
        `if (parseAttributeElem === null) { throw '"${path}" not found'; }\n` +
        `await page.evaluate(e => { e.setAttribute("${attributeName}","${value}"); }, ` +
        'parseAttributeElem);',
    ]};
}

// Possible income:
//
// * boolean value (`true` or `false`)
function parseScreenshot(line) {
    if (line !== 'true' && line !== 'false') {
        return {'error': `Expected "true" or "false" value, found "${line}"`};
    }
    return {
        'instructions': [
            `arg.takeScreenshot = ${line === 'true' ? 'true' : 'false'};`,
        ],
        'wait': false,
    };
}

const ORDERS = {
    'click': parseClick,
    'focus': parseFocus,
    'goto': parseGoTo,
    'movecursorto': parseMoveCursorTo,
    'scrollto': parseScrollTo,
    'size': parseSize,
    'waitfor': parseWaitFor,
    'write': parseWrite,
    'localstorage': parseLocalStorage,
    'screenshot': parseScreenshot,
    'assert': parseAssert,
    'text': parseText,
    'attribute': parseAttribute,
};

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
                if (order !== 'screenshot' && order !== 'goto') {
                    return {
                        'error': 'First command must be `goto` (`screenshot` can be used before)!',
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
};
