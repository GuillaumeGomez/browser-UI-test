const os = require('os');
const utils = require('./utils.js');


function getString(content) {
    if (content.length < 1) {
        return {'error': 'No string received'};
    }
    const stop = content[0];

    if (stop !== '"' && stop !== '\'') {
        return {'error': `Expected \`'\` or \`"\` character, found \`${content[0]}\``};
    }
    for (let i = 1; i < content.length; ++i) {
        if (content[i] === stop && content[i - 1] !== '\\') {
            return {'content': content.substring(1, i)};
        }
    }
    return {'error': 'Missing termination character'};
}

function cssSelector(s) {
    return s.match(/([#|\.]?)([\w|:|\s|\.]+)/g) === null;
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
        if (line.match(/\([0-9]+,[ ]*[0-9]+\)/g) === null) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [x, y] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {'instructions': [
            `page.mouse.click(${x},${y})`,
        ]};
    }
    if (cssSelector(line) !== true) { // eslint-disable-line
        return {'error': 'Invalid CSS selector'};
    }
    return {'instructions': [
        `page.click("${line}")`,
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
    } else if (cssSelector(line) !== true) { // eslint-disable-line
        return {'instructions': [
            `await page.waitFor("${line}")`,
        ]};
    }
    return {'error': 'Expected a number or a CSS selector'};
}

// Possible income:
//
// * CSS selector (for example: #elementID)
function parseFocus(line) {
    if (cssSelector(line) !== true) { // eslint-disable-line
        return {'instructions': [
            `page.focus("${line}")`,
        ]};
    }
    return {'error': 'Expected a CSS selector'};
}

// Possible income (you have to put the double quotes!):
//
// * [CSS selector (for example: #elementID)] "text"
// * "text" (in here, it'll write into the current focused element)
function parseWrite(line) {
    if (line.startsWith('"') || line.startsWith('\'')) { // current focused element
        const x = getString(line);
        if (x.error !== undefined) {
            return x;
        }
        return {'instructions': [
            `page.keyboard.type("${x.content}")`,
        ]};
    } else if (line.indexOf('"') === -1 && line.indexOf('\'') === -1) {
        return {'error': 'Missing string. Requires \'"\''};
    }
    const elem = line.split(' ')[0];
    const text = getString(line.substr(elem.length + 1).trim());
    if (text.error !== undefined) {
        return text;
    }
    return {'instructions': [
        `page.focus("${elem}")`,
        `page.keyboard.type("${text.content}")`,
    ]};
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
        if (line.match(/\([0-9]+,[ ]*[0-9]+\)/g) === null) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [x, y] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {'instructions': [
            `page.mouse.move(${x},${y})`,
        ]};
    } else if (cssSelector(line) !== true) { // eslint-disable-line
        return {'instructions': [
            `page.hover("${line}")`,
        ]};
    }
    return {'error': 'Invalid CSS selector'};
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
        if (line.match(/\([0-9]+,[ ]*[0-9]+\)/g) === null) {
            return {'error': 'Invalid syntax: expected "([number], [number])"...'};
        }
        const [width, height] = line.match(/\d+/g).map(function(f) {
            return parseInt(f);
        });
        return {'instructions': [
            `page.setViewport({width: ${width}, height: ${height}})`,
        ]};
    }
    return {'error': 'Expected \'(\' character as start'};
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
};

function parseContent(content, docPath) {
    const lines = content.split(os.EOL);
    const commands = {'instructions': []};
    let res;

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].split('// ')[0].trim();
        if (line.length === 0) {
            continue;
        }
        const order = line.split(':')[0].toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ORDERS, order)) {
            res = ORDERS[order](lines[i].substr(order.length + 1).trim(), docPath);
            if (res.error !== undefined) {
                res.line = i + 1;
                return [res];
            }
            for (let y = 0; y < res['instructions'].length; ++y) {
                if (commands['instructions'].length === 0 &&
                    res['instructions'][y].startsWith('await page.goto(') !== true) {
                    return {'error': 'First command must be `goto`!', 'line': i};
                }
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
