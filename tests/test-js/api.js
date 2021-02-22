const process = require('process');
const parserFuncs = require('../../src/commands.js');
const Options = require('../../src/options.js').Options;
const {Assert, plural, print} = require('./utils.js');

function wrapper(callback, arg, options = new Options()) {
    return callback(arg, options);
}

function checkAssert(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('(a, "b")'), {'error': 'unexpected `a` as first token'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` after `"b"`'});
    x.assert(func('("a")'),
        {
            'instructions': ['if ((await page.$("a")) === null) { throw \'"a" not found\'; }'],
            'wait': false,
            'checkResult': true,
        });
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", )'), {'error': 'unexpected `,` after `"b"`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('("a", "b")'),
        {
            'instructions': [
                'let parseAssertElemStr = await page.$("a");\nif (parseAssertElemStr === null)' +
                ' { throw \'"a" not found\'; }\nawait page.evaluate(e => {\nif (e.textContent !==' +
                ' "b") {\nthrow \'"\' + e.textContent + \'" !== "b"\'; }\n}, parseAssertElemStr);'],
            'wait': false,
            'checkResult': true,
        });
    x.assert(func('("a", "b", "c")'),
        {
            'instructions': [
                'let parseAssertElemAttr = await page.$("a");\nif (parseAssertElemAttr === null) ' +
                '{ throw \'"a" not found\'; }\nawait page.evaluate(e => {\nif ' +
                '(e.getAttribute("b") !== "c") {\nthrow \'expected "c", found "\' + ' +
                'e.getAttribute("b") + \'" for attribute "b"\';\n}\n}, parseAssertElemAttr);'],
            'wait': false,
            'checkResult': true,
        });
    x.assert(func('("a", "\\"b", "c")'),
        {
            'instructions': [
                'let parseAssertElemAttr = await page.$("a");\nif (parseAssertElemAttr === null) ' +
                '{ throw \'"a" not found\'; }\nawait page.evaluate(e => {\nif ' +
                '(e.getAttribute("\\\\"b") !== "c") {\nthrow \'expected "c", found "\' + ' +
                'e.getAttribute("\\\\"b") + \'" for attribute "\\\\"b"\';\n}\n}, ' +
                'parseAssertElemAttr);'],
            'wait': false,
            'checkResult': true,
        });

    x.assert(func('("a", 1, "c")'), {'error': 'unexpected argument after number of occurences'});
    x.assert(func('("a", 1 2)'), {'error': 'expected `,`, found `2`'});
    x.assert(func('("a", 1 a)'), {'error': 'expected `,`, found `a`'});
    x.assert(func('("a", 1)'),
        {
            'instructions': [
                'let parseAssertElemInt = await page.$$("a");\nif (parseAssertElemInt.length !== ' +
                '1) { throw \'expected 1 elements, found \' + parseAssertElemInt.length; }'],
            'wait': false,
            'checkResult': true,
        });
    x.assert(func('("a", -1)'), {'error': 'number of occurences cannot be negative: `-1`'});
    x.assert(func('("a", -1.0)'), {
        'error': 'expected integer for number of occurences, found float: `-1.0`',
    });
    x.assert(func('("a", 1.0)'), {
        'error': 'expected integer for number of occurences, found float: `1.0`',
    });

    x.assert(func('("a", {)').error !== undefined); // JSON syntax error
    // x.assert(func('("a", {\'a\': 1})').error !== undefined); // JSON syntax error
    x.assert(func('("a", {"a": 1)').error !== undefined); // JSON syntax error
    x.assert(func('("a", {"a": 1})'), {
        'instructions': [
            'let parseAssertElemJson = await page.$("a");\nif (parseAssertElemJson === null) { ' +
            'throw \'"a" not found\'; }\nawait page.evaluate(e => {let assertComputedStyle = ' +
            'getComputedStyle(e);\nif (e.style["a"] != "1" && assertComputedStyle["a"] != "1") {' +
            ' throw \'expected `1` for key `a` for `a`, found `\' + assertComputedStyle["a"] + ' +
            '\'`\'; }\n}, parseAssertElemJson);',
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAttribute(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` after `"b"`'});
    x.assert(func('("a")'),
        {'error': 'expected `("CSS selector", "attribute name", "attribute value")` or `("CSS ' +
            'selector", [JSON object])`'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", )'), {'error': 'unexpected `,` after `"b"`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('("a", "b")'), {
        'error': 'expected json as second argument (since there are only two arguments), found ' +
            'string',
    });
    x.assert(func('("a", "b", "c")'),
        {
            'instructions': [
                'let parseAttributeElem = await page.$("a");\nif (parseAttributeElem === null) { ' +
                'throw \'"a" not found\'; }\nawait page.evaluate(e => { e.setAttribute("b","c"); ' +
                '}, parseAttributeElem);',
            ],
        });
    x.assert(func('("a", "\\"b", "c")'),
        {
            'instructions': [
                'let parseAttributeElem = await page.$("a");\nif (parseAttributeElem === null) { ' +
                'throw \'"a" not found\'; }\nawait page.evaluate(e => { e.setAttribute("\\\\"b",' +
                '"c"); }, parseAttributeElem);',
            ],
        });
    x.assert(func('("a", {"b": "c"})'),
        {
            'instructions': [
                'let parseAttributeElemJson = await page.$("a");\nif (parseAttributeElemJson ' +
                '=== null) { throw \'"a" not found\'; }\nawait page.evaluate(e => { ' +
                'e.setAttribute("b","c"); }, parseAttributeElemJson);\n',
            ],
        });
    // TODO: add checks for more complex json objects
}

function checkClick(x, func) {
    // Check position
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['await page.mouse.click(1,2)']});
    x.assert(func('(-1,2)'), {'instructions': ['await page.mouse.click(-1,2)']});
    x.assert(func('(-2,1)'), {'instructions': ['await page.mouse.click(-2,1)']});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for X position, found float: `-1.0`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for X position, found float: `1.0`'});
    x.assert(func('(2,-1.0)'), {'error': 'expected integer for Y position, found float: `-1.0`'});
    x.assert(func('(2,1.0)'), {'error': 'expected integer for Y position, found float: `1.0`'});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.click("a")']});
    x.assert(func('\'a\''), {'instructions': ['await page.click("a")']});
    x.assert(func('\'"a\''), {'instructions': ['await page.click("\\\\"a")']});
}

function checkCss(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` after `"b"`'});
    x.assert(func('("a")'),
        {'error': 'expected `("CSS selector", "CSS property name", "CSS property value")` or ' +
            '`("CSS selector", [JSON object])`'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", )'), {'error': 'unexpected `,` after `"b"`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('("a", "b")'), {
        'error': 'expected json as second argument (since there are only two arguments), found ' +
            'string',
    });
    x.assert(func('("a", "", "c")'), {'error': 'attribute name (second argument) cannot be empty'});
    x.assert(func('("a", "b", "c")'),
        {
            'instructions': [
                'let parseCssElem = await page.$("a");\nif (parseCssElem === null) { ' +
                'throw \'"a" not found\'; }\nawait page.evaluate(e => { ' +
                'e.style["b"] = "c"; }, parseCssElem);',
            ],
        });
    x.assert(func('("a", "\\"b", "c")'),
        {
            'instructions': [
                'let parseCssElem = await page.$("a");\nif (parseCssElem === null) { ' +
                'throw \'"a" not found\'; }\nawait page.evaluate(e => { ' +
                'e.style["\\\\"b"] = "c"; }, parseCssElem);',
            ],
        });
    x.assert(func('("a", {"b": "c"})'),
        {
            'instructions': [
                'let parseCssElemJson = await page.$("a");\nif (parseCssElemJson ' +
                '=== null) { throw \'"a" not found\'; }\nawait page.evaluate(e => { ' +
                'e.style["b"] = "c"; }, parseCssElemJson);\n',
            ],
        });
    // TODO: add checks for more complex json objects
}

function checkDragAndDrop(x, func) {
    // check tuple argument
    x.assert(func('true'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector',
    });
    x.assert(func('(true)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector',
    });
    x.assert(func('(1,2)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector, found `1`',
    });
    x.assert(func('(1,2,3)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector',
    });
    x.assert(func('("a",2)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector, found `2`',
    });
    x.assert(func('(1,"a")'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector, found `1`',
    });
    x.assert(func('((1,2,3),"a")'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,2,3)`',
    });
    x.assert(func('((1,"a"),"a")'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,"a")`',
    });
    x.assert(func('((1,2),"")'), {'error': 'CSS selector (second argument) cannot be empty'});
    x.assert(func('("", (1,2))'), {'error': 'CSS selector (first argument) cannot be empty'});
    x.assert(func('((1,2),"a")'), {
        'instructions': [
            'const start = [1, 2];\nawait page.mouse.move(start[0], start[1]);await ' +
            'page.mouse.down();',
            'const parseDragAndDropElem2 = await page.$("a");\nif (parseDragAndDropElem2 === ' +
            'null) { throw \'"a" not found\'; }\nconst parseDragAndDropElem2_box = await ' +
            'parseDragAndDropElem2.boundingBox();\nconst end = [parseDragAndDropElem2_box.x + ' +
            'parseDragAndDropElem2_box.width / 2, parseDragAndDropElem2_box.y + ' +
            'parseDragAndDropElem2_box.height / 2];\nawait page.mouse.move(end[0], end[1]);' +
            'await page.mouse.up();',
        ],
    });
    x.assert(func('("a", (1,2))'), {
        'instructions': [
            'const parseDragAndDropElem = await page.$("a");\nif (parseDragAndDropElem === ' +
            'null) { throw \'"a" not found\'; }\nconst parseDragAndDropElem_box = await ' +
            'parseDragAndDropElem.boundingBox();\nconst start = [parseDragAndDropElem_box.x + ' +
            'parseDragAndDropElem_box.width / 2, parseDragAndDropElem_box.y + ' +
            'parseDragAndDropElem_box.height / 2];\nawait page.mouse.move(start[0], start[1]);' +
            'await page.mouse.down();',
            'const end = [1, 2];\nawait page.mouse.move(end[0], end[1]);await page.mouse.up();',
        ],
    });
    x.assert(func('((-1,2),"")'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('((1,-2),"")'), {'error': 'Y position cannot be negative: `-2`'});
    x.assert(func('((1.0,2),"")'), {
        'error': 'expected integer for X position, found float: `1.0`',
    });
    x.assert(func('((-1.0,2),"")'), {
        'error': 'expected integer for X position, found float: `-1.0`',
    });
    x.assert(func('((1,2.0),"")'), {
        'error': 'expected integer for Y position, found float: `2.0`',
    });
    x.assert(func('((1,-2.0),"")'), {
        'error': 'expected integer for Y position, found float: `-2.0`',
    });
    x.assert(func('("a",(-1,2))'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('("a",(1,-2))'), {'error': 'Y position cannot be negative: `-2`'});
    x.assert(func('("a",(1.0,2))'), {
        'error': 'expected integer for X position, found float: `1.0`',
    });
    x.assert(func('("a",(-1.0,2))'), {
        'error': 'expected integer for X position, found float: `-1.0`',
    });
    x.assert(func('("a",(1,2.0))'), {
        'error': 'expected integer for Y position, found float: `2.0`',
    });
    x.assert(func('("a",(1,-2.0))'), {
        'error': 'expected integer for Y position, found float: `-2.0`',
    });
}

function checkEmulate(x, func) {
    x.assert(func(''), {'error': 'expected string for "device name", found ``'});
    x.assert(func('12'), {'error': 'expected string for "device name", found `12`'});
    x.assert(func('"a"'), {
        'instructions': [
            'if (arg.puppeteer.devices["a"] === undefined) { throw \'Unknown device `a`. List of ' +
            'available devices can be found there: ' +
            'https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js or ' +
            'you can use `--show-devices` option\'; } ' +
            'else { await page.emulate(arg.puppeteer.devices["a"]); }',
        ]});
}

function checkFail(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'unexpected `tru` as first token'});
    x.assert(func('false'), {'instructions': ['arg.expectedToFail = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.expectedToFail = true;'], 'wait': false});
}

function checkFocus(x, func) {
    x.assert(func('a'), {'error': 'unexpected `a` as first token'});
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.focus("a")']});
    x.assert(func('\'a\''), {'instructions': ['await page.focus("a")']});
    x.assert(func('\'"a\''), {'instructions': ['await page.focus("\\\\"a")']});
}

function checkGeolocation(x, func) {
    x.assert(func(''), {'error': 'expected (longitude [number], latitude [number]), found ``'});
    x.assert(func('"a"'), {
        'error': 'expected (longitude [number], latitude [number]), found `"a"`',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected number for longitude (first argument), found `a`',
    });
    x.assert(func('("12", 13)'), {
        'error': 'expected number for longitude (first argument), found `12`',
    });
    x.assert(func('(12, "13")'), {
        'error': 'expected number for latitude (second argument), found `13`',
    });
    x.assert(func('(12, 13)'), {'instructions': ['await page.setGeolocation(12, 13);']});
}

function checkGoTo(x, func) {
    x.assert(func('a'), {'error': 'a relative path or a full URL was expected, found `a`'});
    x.assert(func('"'), {'error': 'a relative path or a full URL was expected, found `"`'});
    x.assert(func('http:/a'),
        {'error': 'a relative path or a full URL was expected, found `http:/a`'});
    x.assert(func('https:/a'),
        {'error': 'a relative path or a full URL was expected, found `https:/a`'});
    x.assert(func('https://a'), {
        'instructions': [
            'await page.goto("https://a");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('www.x'), {
        'instructions': [
            'await page.goto("www.x");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('/a'), {
        'instructions': [
            'await page.goto(page.url().split("/").slice(0, -1).join("/") + "/a");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('./a'), {
        'instructions': [
            'await page.goto(page.url().split("/").slice(0, -1).join("/") + "/./a");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('file:///a'), {
        'instructions': [
            'await page.goto("file:///a");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    // `docPath` parameter always ends with '/'
    x.assert(func('file://|doc-path|/a', {'variables': {'doc-path': 'foo'}}), {
        'instructions': [
            'await page.goto("file://foo/a");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('|url|', {'variables': {'url': 'http://foo'}}), {
        'instructions': [
            'await page.goto("http://foo");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('http://foo/|url|fa', {'variables': {'url': 'tadam/'}}), {
        'instructions': [
            'await page.goto("http://foo/tadam/fa");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('http://foo/|url|/fa', {'variables': {'url': 'tadam'}}), {
        'instructions': [
            'await page.goto("http://foo/tadam/fa");',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
    x.assert(func('http://foo/|url|/fa'), {
        'error': 'variable `url` not found in options nor environment',
    });
}

function checkJavascript(x, func) {
    x.assert(func(''), {'error': 'expected `true` or `false` value, found ``'});
    x.assert(func('"a"'), {'error': 'expected `true` or `false` value, found `"a"`'});
    x.assert(func('true'), {
        'instructions': [
            'await page.setJavaScriptEnabled(true);',
        ],
    });
}

function checkLocalStorage(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('{').error !== undefined); // JSON syntax error
    x.assert(func('{"a": 1}'), {
        'instructions': ['await page.evaluate(() => { localStorage.setItem("a", "1"); })'],
    });
    x.assert(func('{"a": "1"}'),
        {'instructions': ['await page.evaluate(() => { localStorage.setItem("a", "1"); })']});
    x.assert(func('{"a": "1", "b": "2px"}'),
        {'instructions': ['await page.evaluate(() => { localStorage.setItem("a", "1");\n' +
            'localStorage.setItem("b", "2px"); })']});
}

function checkMoveCursorTo(x, func) {
    // Check position
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['await page.mouse.move(1,2)']});
    x.assert(func('(-1,2)'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('(1,-2)'), {'error': 'Y position cannot be negative: `-2`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for X position, found float: `1.0`'});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for X position, found float: `-1.0`'});
    x.assert(func('(2,1.0)'), {'error': 'expected integer for Y position, found float: `1.0`'});
    x.assert(func('(2,-1.0)'), {'error': 'expected integer for Y position, found float: `-1.0`'});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['await page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['await page.hover("\\\\"a")']});
}

function checkParseContent(x, func) {
    x.assert(func(''), {'instructions': []});
    x.assert(func('// just a comment'), {'instructions': []});
    x.assert(func('  // just a comment'), {'instructions': []});
    x.assert(func('a: '), {'error': 'Unknown command "a"', 'line': 0});
    x.assert(func(':'), {'error': 'Unknown command ""', 'line': 0});

    x.assert(func('goto: file:///home'), {
        'instructions': [
            {
                'code': 'await page.goto("file:///home");',
                'original': 'goto: file:///home',
            },
            {
                'code': 'await arg.browser.overridePermissions(page.url(), arg.permissions);',
                'original': 'goto: file:///home',
            },
        ],
    });
    x.assert(func('focus: "#foo"'),
        {
            'error': 'First command must be `goto` (`emulate` or `fail` or `javascript` or ' +
                '`screenshot` or `timeout` can be used before)!',
            'line': 1,
        });
    x.assert(func('fail: true\ngoto: file:///home'),
        {
            'instructions': [
                {
                    'code': 'arg.expectedToFail = true;',
                    'wait': false,
                    'original': 'fail: true',
                },
                {
                    'code': 'await page.goto("file:///home");',
                    'original': 'goto: file:///home',
                },
                {
                    'code': 'await arg.browser.overridePermissions(page.url(), arg.permissions);',
                    'original': 'goto: file:///home',
                },
            ],
        });
    x.assert(func('// just a comment\na: b'), {'error': 'Unknown command "a"', 'line': 1});
    x.assert(func('goto: file:///home\nemulate: "test"'),
        {
            'error': 'Command emulate must be used before first goto!',
            'line': 2,
        });
}

function checkPermissions(x, func) {
    x.assert(func(''), {'error': 'expected an array of strings, found ``'});
    x.assert(func('"a"'), {'error': 'expected an array of strings, found `"a"`'});
    x.assert(func('("a", "b")'), {'error': 'expected an array of strings, found `("a", "b")`'});
    x.assert(func('["12", 13]'), {
        'error': 'all array\'s elements must be of the same kind: expected array of `string`, ' +
            'found `number` at position 1',
    });
    x.assert(func('[12, "13"]'), {
        'error': 'all array\'s elements must be of the same kind: expected array of `number`, ' +
            'found `string` at position 1',
    });
    x.assert(func('["12"]'), {
        'error': '`12` is an unknown permission, you can see the list of available permissions ' +
            'with the `--show-permissions` option',
    });
    x.assert(func('["camera", "push"]'), {
        'instructions': [
            'arg.permissions = ["camera", "push"];',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
}

function checkReload(x, func) {
    // check tuple argument
    x.assert(func(''),
        {
            'instructions': [
                'await page.reload({\'waitUntil\': \'domcontentloaded\', \'timeout\': 30000});',
            ],
        });
    x.assert(func('"a"'), {'error': 'expected either [integer] or no arguments, got string'});
    x.assert(func('12'),
        {
            'instructions': [
                'await page.reload({\'waitUntil\': \'domcontentloaded\', \'timeout\': 12});',
            ],
        });
    x.assert(func('12 24'), {'error': 'expected nothing, found `2`'});
    x.assert(func('0'),
        {
            'instructions': [
                'await page.reload({\'waitUntil\': \'domcontentloaded\', \'timeout\': 0});',
            ],
            'warnings': 'You passed 0 as timeout, it means the timeout has been disabled on ' +
                'this reload',
        });
    x.assert(func('-12'), {'error': 'timeout cannot be negative: `-12`'});
    x.assert(func('-12.0'), {'error': 'expected integer for timeout, found float: `-12.0`'});
    x.assert(func('12.0'), {'error': 'expected integer for timeout, found float: `12.0`'});
}

function checkScreenshot(x, func) {
    x.assert(func(''), {'error': 'expected boolean or CSS selector, found nothing'});
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('"true"'),
        {
            'instructions': ['arg.takeScreenshot = "true";'],
            'wait': false,
            'warnings': '`"true"` is a string and will be used as CSS selector. If you want to ' +
                'set `true` or `false` value, remove quotes.',
        });
    x.assert(func('tru'), {'error': 'unexpected `tru` as first token'});
    x.assert(func('false'), {'instructions': ['arg.takeScreenshot = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.takeScreenshot = true;'], 'wait': false});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"test"'), {'instructions': ['arg.takeScreenshot = "test";'], 'wait': false});
}

function checkScrollTo(x, func) {
    // Check position
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['await page.mouse.move(1,2)']});
    x.assert(func('(-1,2)'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('(1,-2)'), {'error': 'Y position cannot be negative: `-2`'});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for X position, found float: `-1.0`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for X position, found float: `1.0`'});
    x.assert(func('(2,-1.0)'), {'error': 'expected integer for Y position, found float: `-1.0`'});
    x.assert(func('(2,1.0)'), {'error': 'expected integer for Y position, found float: `1.0`'});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['await page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['await page.hover("\\\\"a")']});
}

function checkShowText(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'unexpected `tru` as first token'});
    x.assert(func('false'), {
        'instructions': [
            'arg.showText = false;',
            'await page.evaluate(() => {window.browserUiCreateNewStyleElement(\'* { color: ' +
            'rgba(0,0,0,0) !important; }\', \'browser-ui-test-style-text-hide\');});',
        ],
    });
    x.assert(func('true'), {
        'instructions': [
            'arg.showText = true;',
            'await page.evaluate(() => {let tmp = document.getElementById(\'browser-ui-test-style' +
            '-text-hide\');if (tmp) { tmp.remove(); }});',
        ],
    });
}

function checkSize(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['await page.setViewport({width: 1, height: 2})']});
    x.assert(func('(-1,2)'), {'error': 'width cannot be negative: `-1`'});
    x.assert(func('(1,-2)'), {'error': 'height cannot be negative: `-2`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for width, found float: `1.0`'});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for width, found float: `-1.0`'});
    x.assert(func('(1,2.0)'), {'error': 'expected integer for height, found float: `2.0`'});
    x.assert(func('(1,-2.0)'), {'error': 'expected integer for height, found float: `-2.0`'});
}

function checkText(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` after `"b"`'});
    x.assert(func('("a")'), {'error': 'expected `("CSS selector", "text")`'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", "c")'), {'error': 'expected `("CSS selector", "text")`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('(\'\', "b")'), {'error': 'CSS selector cannot be empty'});
    x.assert(func('("a", "b")'),
        {
            'instructions': [
                'let parseTextElem = await page.$("a");\nif (parseTextElem === null) ' +
                '{ throw \'"a" not found\'; }\nawait page.evaluate(e => { e.innerText = "b";}, ' +
                'parseTextElem);',
            ],
        });
}

function checkTimeout(x, func) {
    x.assert(func(''), {'error': 'expected integer for number of milliseconds, found ``'});
    x.assert(func('"a"'), {'error': 'expected integer for number of milliseconds, found `"a"`'});
    x.assert(func('12'), {'instructions': ['page.setDefaultTimeout(12)'], 'wait': false});
    // In case I add a check over no timeout some day...
    x.assert(func('0'), {
        'instructions': ['page.setDefaultTimeout(0)'],
        'wait': false,
        'warnings': [
            'You passed 0 as timeout, it means the timeout has been disabled on this reload',
        ],
    });
    x.assert(func('0.1'), {
        'error': 'expected integer for number of milliseconds, found float: `0.1`',
    });
    x.assert(func('-0.1'), {
        'error': 'expected integer for number of milliseconds, found float: `-0.1`',
    });
    x.assert(func('-1'), {
        'error': 'number of milliseconds cannot be negative: `-1`',
    });
}

function checkWaitFor(x, func) {
    // Check integer
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('1 2'), {'error': 'expected nothing, found `2`'});
    x.assert(func('1'), {'instructions': ['await page.waitFor(1)'], 'wait': false});
    x.assert(func('-1'), {'error': 'number of milliseconds cannot be negative: `-1`'});
    x.assert(func('-1.0'), {
        'error': 'expected integer for number of milliseconds, found float: `-1.0`',
    });
    x.assert(func('1.0'), {
        'error': 'expected integer for number of milliseconds, found float: `1.0`',
    });

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.waitFor("a")'], 'wait': false});
    x.assert(func('\'a\''), {'instructions': ['await page.waitFor("a")'], 'wait': false});
    x.assert(func('\'"a\''), {'instructions': ['await page.waitFor("\\\\"a")'], 'wait': false});
}

function checkWrite(x, func) {
    // check tuple argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` after `"b"`'});
    x.assert(func('("a")'),
        {'error': 'invalid number of arguments in tuple, expected [string] or [integer] or ([CSS ' +
                  'selector], [string]) or ([CSS selector], [integer])'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", "c")'),
        {'error': 'invalid number of arguments in tuple, expected [string] or [integer] or ([CSS ' +
                  'selector], [string]) or ([CSS selector], [integer])'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('(\'\', "b")'), {'error': 'CSS selector cannot be empty'});
    x.assert(func('("a", "b")'), {'instructions': ['await page.type(\"a\", \"b\")']});
    x.assert(func('("a", 13.2)'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('("a", -13.2)'), {'error': 'expected integer for keycode, found float: `-13.2`'});
    x.assert(func('("a", -13)'), {'error': 'keycode cannot be negative: `-13`'});
    x.assert(func('("a", 13)'), {
        'instructions': [
            'await page.focus("a")',
            'await page.keyboard.press(String.fromCharCode(13))',
        ],
    });

    // check string argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'instructions': ['await page.keyboard.type("")']});
    x.assert(func('"a"'), {'instructions': ['await page.keyboard.type("a")']});
    x.assert(func('\'a\''), {'instructions': ['await page.keyboard.type("a")']});
    x.assert(func('\'"a\''), {'instructions': ['await page.keyboard.type("\\"a")']});

    // check integer argument
    x.assert(func('13.2'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('-13.2'), {'error': 'expected integer for keycode, found float: `-13.2`'});
    x.assert(func('-13'), {'error': 'keycode cannot be negative: `-13`'});
    x.assert(func('13'), {'instructions': ['await page.keyboard.press(String.fromCharCode(13))']});
}

const TO_CHECK = [
    {
        'name': 'assert',
        'func': checkAssert,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssert, e, o),
    },
    {
        'name': 'attribute',
        'func': checkAttribute,
        'toCall': (e, o) => wrapper(parserFuncs.parseAttribute, e, o),
    },
    {
        'name': 'click',
        'func': checkClick,
        'toCall': (e, o) => wrapper(parserFuncs.parseClick, e, o),
    },
    {
        'name': 'css',
        'func': checkCss,
        'toCall': (e, o) => wrapper(parserFuncs.parseCss, e, o),
    },
    {
        'name': 'drag-and-drop',
        'func': checkDragAndDrop,
        'toCall': (e, o) => wrapper(parserFuncs.parseDragAndDrop, e, o),
    },
    {
        'name': 'emulate',
        'func': checkEmulate,
        'toCall': (e, o) => wrapper(parserFuncs.parseEmulate, e, o),
    },
    {
        'name': 'fail',
        'func': checkFail,
        'toCall': (e, o) => wrapper(parserFuncs.parseFail, e, o),
    },
    {
        'name': 'focus',
        'func': checkFocus,
        'toCall': (e, o) => wrapper(parserFuncs.parseFocus, e, o),
    },
    {
        'name': 'geolocation',
        'func': checkGeolocation,
        'toCall': (e, o) => wrapper(parserFuncs.parseGeolocation, e, o),
    },
    {
        'name': 'goto',
        'func': checkGoTo,
        'toCall': (e, o) => wrapper(parserFuncs.parseGoTo, e, o),
    },
    {
        'name': 'javascript',
        'func': checkJavascript,
        'toCall': (e, o) => wrapper(parserFuncs.parseJavascript, e, o),
    },
    {
        'name': 'local-storage',
        'func': checkLocalStorage,
        'toCall': (e, o) => wrapper(parserFuncs.parseLocalStorage, e, o),
    },
    {
        'name': 'move-cursor-to',
        'func': checkMoveCursorTo,
        'toCall': (e, o) => wrapper(parserFuncs.parseMoveCursorTo, e, o),
    },
    {
        'name': 'permissions',
        'func': checkPermissions,
        'toCall': (e, o) => wrapper(parserFuncs.parsePermissions, e, o),
    },
    {
        'name': 'reload',
        'func': checkReload,
        'toCall': (e, o) => wrapper(parserFuncs.parseReload, e, o),
    },
    {
        'name': 'screenshot',
        'func': checkScreenshot,
        'toCall': (e, o) => wrapper(parserFuncs.parseScreenshot, e, o),
    },
    {
        'name': 'scroll-to',
        'func': checkScrollTo,
        'toCall': (e, o) => wrapper(parserFuncs.parseScrollTo, e, o),
    },
    {
        'name': 'show-text',
        'func': checkShowText,
        'toCall': (e, o) => wrapper(parserFuncs.parseShowText, e, o),
    },
    {
        'name': 'size',
        'func': checkSize,
        'toCall': (e, o) => wrapper(parserFuncs.parseSize, e, o),
    },
    {
        'name': 'text',
        'func': checkText,
        'toCall': (e, o) => wrapper(parserFuncs.parseText, e, o),
    },
    {
        'name': 'timeout',
        'func': checkTimeout,
        'toCall': (e, o) => wrapper(parserFuncs.parseTimeout, e, o),
    },
    {
        'name': 'wait-for',
        'func': checkWaitFor,
        'toCall': (e, o) => wrapper(parserFuncs.parseWaitFor, e, o),
    },
    {
        'name': 'write',
        'func': checkWrite,
        'toCall': (e, o) => wrapper(parserFuncs.parseWrite, e, o),
    },
    // This one is a bit "on its own".
    {
        'name': 'parseContent',
        'func': checkParseContent,
        'toCall': (e, o) => wrapper(parserFuncs.parseContent, e, o),
    },
];

async function checkCommands(x = new Assert()) {
    x.startTestSuite('API', false);
    print('=> Starting API tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        x.startTestSuite(TO_CHECK[i].name);
        try {
            TO_CHECK[i].func(x, TO_CHECK[i].toCall);
            x.endTestSuite();
        } catch (err) {
            x.endTestSuite(false);
            print(`<== "${TO_CHECK[i].name}" failed: ${err}\n${err.stack}`);
        }
    }

    print('');
    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    const errors = x.getTotalErrors();
    x.endTestSuite(false);
    return errors;
}

if (require.main === module) {
    checkCommands().then(nbErrors => {
        process.exit(nbErrors);
    });
} else {
    module.exports = {
        'check': checkCommands,
    };
}
