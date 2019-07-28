var os = require('os');
const utils = require('./utils.js');


function getString(content) {
    if (content.length < 1) {
        return {"error": "No string received"};
    }
    var stop = content[0];

    if (stop !== '"' && stop !== "'") {
        return {"error": `Expected \`'\` or \`"\` character, found \`${content[0]}\``};
    }
    for (var i = 1; i < content.length; ++i) {
        if (content[i] === stop && content[i - 1] !== '\\') {
            return {"content": content.substring(1, i)};
        }
    }
    return {"error": "Missing termination character"};
}

// Possible incomes:
//
// * (X, Y)
// * CSS selector (for example: #elementID)
function parseClick(line) {
    if (line.startsWith('(')) {
        if (!line.endsWith(')')) {
            return {"error": "Invalid syntax: expected position to end with ')'..."};
        }
        if (line.match(/\([0-9]+,[ ]*[0-9]+\)/g) === null) {
            return {"error": "Invalid syntax: expected \"([number], [number])\"..."};
        }
        var [x, y] = line.match(/\d+/g).map(function(f) { return parseInt(f) });
        return {"instructions": [
            `page.mouse.click(${x},${y})`,
        ]};
    }
    if (line.match(/([#|\.]?)([\w|:|\s|\.]+)/g) === null) {
        return {"error": "Invalid CSS selector"};
    }
    return {"instructions": [
        `page.click("${line}")`,
    ]};
}

// Possible incomes:
//
// * Number of milliseconds
// * CSS selector (for example: #elementID)
function parseWaitFor(line) {
    if (line.match(/[0-9]+/) !== null) {
        return {"instructions": [
            `await page.waitFor(${parseInt(line)})`,
        ]};
    } else if (line.match(/([#|\.]?)([\w|:|\s|\.]+)/g) !== null) {
        return {"instructions": [
            `await page.waitFor("${line}")`,
        ]};
    }
    return {"error": "Expected a number or a CSS selector"};
}

// Possible income:
//
// * CSS selector (for example: #elementID)
function parseFocus(line) {
    if (line.match(/([#|\.]?)([\w|:|\s|\.]+)/g) !== null) {
        return {"instructions": [
            `page.focus("${line}")`,
        ]};
    }
    return {"error": "Expected a CSS selector"};
}

// Possible income (you have to put the double quotes!):
//
// * [CSS selector (for example: #elementID)] "text"
// * "text" (in here, it'll write into the current focused element)
function parseWrite(line) {
    if (line.startsWith("\"") || line.startsWith("'")) { // current focused element
        var x = getString(line);
        if (x.error !== undefined) {
            return x;
        }
        return {"instructions": [
            `page.keyboard.type("${x.content}")`,
        ]};
    } else if (line.indexOf("\"") === -1 && line.indexOf("'") === -1) {
        return {"error": "Missing string. Requires '\"'"};
    }
    var elem = line.split(' ')[0];
    var text = getString(line.substr(elem.length + 1).trim());
    if (text.error !== undefined) {
        return x;
    }
    return {"instructions": [
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
            return {"error": "Invalid syntax: expected position to end with ')'..."};
        }
        if (line.match(/\([0-9]+,[ ]*[0-9]+\)/g) === null) {
            return {"error": "Invalid syntax: expected \"([number], [number])\"..."};
        }
        var [x, y] = line.match(/\d+/g).map(function(f) { return parseInt(f) });
        return {"instructions": [
            `page.mouse.move(${x},${y})`,
        ]};
    } else if (line.match(/([#|\.]?)([\w|:|\s|\.]+)/g) !== null) {
        return {"instructions": [
            `page.hover("${line}")`,
        ]};
    }
    return {"error": "Invalid CSS selector"};
}

function handlePathParameters(line, split, join) {
    let parts = line.split(split);
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
    if (line.startsWith("http") || line.startsWith("www.")) {
        return {"instructions": [
            `await page.goto("${line}")`,
        ]};
    } else if (line.startsWith("file://")) {
        line = handlePathParameters(line, "{doc-path}", docPath);
        line = handlePathParameters(line, "{current-dir}", utils.getCurrentDir());
        return {"instructions": [
            `await page.goto("${line}")`,
        ]};
    } else if (line.startsWith(".")) {
        return {"instructions": [
            `await page.goto(page.url().split("/").slice(0, -1).join("/") + "/" + "${line}")`,
        ]};
    } else if (line.startsWith("/")) {
        return {"instructions": [
            `await page.goto(page.url().split("/").slice(0, -1).join("/") + "${line}")`,
        ]};
    }
    return {"error": "A relative path or a full URL was expected"};
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
            return {"error": "Invalid syntax: expected size to end with ')'..."};
        }
        if (line.match(/\([0-9]+,[ ]*[0-9]+\)/g) === null) {
            return {"error": "Invalid syntax: expected \"([number], [number])\"..."};
        }
        var [width, height] = line.match(/\d+/g).map(function(f) { return parseInt(f) });
        return {"instructions": [
            `page.setViewport({width: ${width}, height: ${height}})`,
        ]};
    }
    return {"error": "Expected '(' character as start"};
}

// Possible income:
//
// * JSON object (for example: {"key": "value", "another key": "another value"})
function parseLocalStorage(line) {
    if (!line.startsWith('{')) {
        return {"error": `Expected json object (object wrapped inside "{}"), found "${line}"`};
    }
    try {
        var d = JSON.parse(line);
        var content = [];
        for (var key in d) {
            if (key.length > 0 && d.hasOwnProperty(key)) {
                content.push(`localStorage.setItem("${key.split('"').join('\\"')}", "${d[key].split('"').join('\\"')}");`);
            }
        }
        if (content.length === 0) {
            return {"instructions": []};
        }
        return {"instructions": [
            `page.evaluate(() => {
                ${content.join('\n')}
            })`
        ]};
    } catch(e) {
        return {"error": "Error when parsing JSON content: " + e};
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
    var lines = content.split(os.EOL);
    var commands = {"instructions": []};
    var res;

    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i].split('// ')[0].trim();
        if (line.length === 0) {
            continue;
        }
        var order = line.split(':')[0].toLowerCase();
        if (ORDERS.hasOwnProperty(order)) {
            res = ORDERS[order](lines[i].substr(order.length + 1).trim(), docPath);
            if (res.error !== undefined) {
                res.line = i + 1;
                return [res];
            }
            for (var y = 0; y < res["instructions"].length; ++y) {
                if (commands["instructions"].length === 0 &&
                    res["instructions"][y].startsWith('await page.goto(') !== true) {
                    return {"error": "First command must be `goto`!", "line": i};
                }
                commands["instructions"].push({'code': res["instructions"][y], 'original': line});
            }
        } else {
            return {"error": `Unknown command "${order}"`, "line": i};
        }
    }
    return commands;
}

module.exports = {
    parseContent: parseContent,
};
