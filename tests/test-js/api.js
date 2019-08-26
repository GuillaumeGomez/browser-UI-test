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

function checkClick(x, func) {
    // Check position
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {'error': 'invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.click(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.click("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.click("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.click("\\\\"a")']});
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
    x.assert(func('"a"'), {'instructions': ['page.focus("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.focus("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.focus("\\\\"a")']});
}

function checkGoTo(x, func) {
    x.assert(func('a'), {'error': 'a relative path or a full URL was expected, found `a`'});
    x.assert(func('"'), {'error': 'a relative path or a full URL was expected, found `"`'});
    x.assert(func('http:/a'),
        {'error': 'a relative path or a full URL was expected, found `http:/a`'});
    x.assert(func('https:/a'),
        {'error': 'a relative path or a full URL was expected, found `https:/a`'});
    x.assert(func('https://a'), {'instructions': ['await page.goto("https://a")']});
    x.assert(func('www.x'), {'instructions': ['await page.goto("www.x")']});
    x.assert(func('/a'), {
        'instructions': ['await page.goto(page.url().split("/").slice(0, -1).join("/") + "/a")'],
    });
    x.assert(func('./a'), {
        'instructions': ['await page.goto(page.url().split("/").slice(0, -1).join("/") + "/./a")'],
    });
    x.assert(func('file:///a'), {
        'instructions': ['await page.goto("file:///a")'],
    });
    // `docPath` parameter always ends with '/'
    x.assert(func('file://|doc-path|/a', {'variables': {'doc-path': 'foo'}}), {
        'instructions': ['await page.goto("file://foo/a")'],
    });
    x.assert(func('|url|', {'variables': {'url': 'http://foo'}}), {
        'instructions': ['await page.goto("http://foo")'],
    });
    x.assert(func('http://foo/|url|fa', {'variables': {'url': 'tadam/'}}), {
        'instructions': ['await page.goto("http://foo/tadam/fa")'],
    });
    x.assert(func('http://foo/|url|/fa', {'variables': {'url': 'tadam'}}), {
        'instructions': ['await page.goto("http://foo/tadam/fa")'],
    });
    x.assert(func('http://foo/|url|/fa'), {
        'error': 'variable `null` not found in options nor environment',
    });
}

function checkLocalStorage(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('{').error !== undefined); // JSON syntax error
    x.assert(func('{"a": 1}'), {
        'instructions': ['page.evaluate(() => { localStorage.setItem("a", "1"); })'],
    });
    x.assert(func('{"a": "1"}'),
        {'instructions': ['page.evaluate(() => { localStorage.setItem("a", "1"); })']});
    x.assert(func('{"a": "1", "b": "2px"}'),
        {'instructions': ['page.evaluate(() => { localStorage.setItem("a", "1");\n' +
            'localStorage.setItem("b", "2px"); })']});
}

function checkMoveCursorTo(x, func) {
    // Check position
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {'error': 'invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.move(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.hover("\\\\"a")']});
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
    x.assert(func('(1)'), {'error': 'invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.move(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.hover("\\\\"a")']});
}

function checkShowText(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'unexpected `tru` as first token'});
    x.assert(func('false'), {
        'instructions': [
            'arg.showText = false;',
            'page.evaluate(() => {window.browserUiCreateNewStyleElement(\'* { color: rgba(0,0,0,' +
            '0) !important; }\', \'browser-ui-test-style-text-hide\');});',
        ],
    });
    x.assert(func('true'), {
        'instructions': [
            'arg.showText = true;',
            'page.evaluate(() => {let tmp = document.getElementById(\'browser-ui-test-style-text' +
            '-hide\');if (tmp) { tmp.remove(); }});',
        ],
    });
}

function checkSize(x, func) {
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {'error': 'expected `([number], [number])`'});
    x.assert(func('(1,)'), {'error': 'unexpected `,` after `1`'});
    x.assert(func('(1,2,)'), {'error': 'unexpected `,` after `2`'});
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {'error': 'unexpected `a` as first token'});
    x.assert(func('(1,2)'), {'instructions': ['page.setViewport({width: 1, height: 2})']});
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

function checkWaitFor(x, func) {
    // Check integer
    x.assert(func('hello'), {'error': 'unexpected `hello` as first token'});
    x.assert(func('1 2'), {'error': 'expected nothing, found `2`'});
    x.assert(func('1'), {'instructions': ['await page.waitFor(1)'], 'wait': false});

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
        {'error': 'invalid number of arguments in tuple, expected ([CSS selector], [string])'});
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", "c")'),
        {'error': 'invalid number of arguments in tuple, expected ([CSS selector], [string])'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('(\'\', "b")'), {'error': 'CSS selector cannot be empty'});
    x.assert(func('("a", "b")'), {'instructions': ['page.focus("a")', 'page.keyboard.type("b")']});

    // check string argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'instructions': ['page.keyboard.type("")']});
    x.assert(func('"a"'), {'instructions': ['page.keyboard.type("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.keyboard.type("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.keyboard.type("\\"a")']});
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
}

function checkParseContent(x, func) {
    x.assert(func(''), {'instructions': []});
    x.assert(func('// just a comment'), {'instructions': []});
    x.assert(func('  // just a comment'), {'instructions': []});
    x.assert(func('a: '), {'error': 'Unknown command "a"', 'line': 0});
    x.assert(func(':'), {'error': 'Unknown command ""', 'line': 0});

    x.assert(func('goto: file:///home'),
        {
            'instructions': [{
                'code': 'await page.goto("file:///home")',
                'original': 'goto: file:///home',
            }],
        });
    x.assert(func('focus: "#foo"'),
        {
            'error': 'First command must be `goto` (`fail`, `screenshot` can be used before)!',
            'line': 0,
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
                    'code': 'await page.goto("file:///home")',
                    'original': 'goto: file:///home',
                },
            ],
        });
    x.assert(func('// just a comment\na: b'), {'error': 'Unknown command "a"', 'line': 1});
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
        'error': 'expected a position with two numbers, found `(1,2,3)`',
    });
    x.assert(func('((1,"a"),"a")'), {
        'error': 'expected a position with two numbers, found `(1,"a")`',
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
}

const TO_CHECK = [
    {'name': 'assert', 'func': checkAssert,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssert, e, o)},
    {'name': 'attribute', 'func': checkAttribute,
        'toCall': (e, o) => wrapper(parserFuncs.parseAttribute, e, o)},
    {'name': 'click', 'func': checkClick,
        'toCall': (e, o) => wrapper(parserFuncs.parseClick, e, o)},
    {'name': 'css', 'func': checkCss,
        'toCall': (e, o) => wrapper(parserFuncs.parseCss, e, o)},
    {'name': 'drag-and-drop', 'func': checkDragAndDrop,
        'toCall': (e, o) => wrapper(parserFuncs.parseDragAndDrop, e, o)},
    {'name': 'fail', 'func': checkFail,
        'toCall': (e, o) => wrapper(parserFuncs.parseFail, e, o)},
    {'name': 'focus', 'func': checkFocus,
        'toCall': (e, o) => wrapper(parserFuncs.parseFocus, e, o)},
    {'name': 'goto', 'func': checkGoTo,
        'toCall': (e, o) => wrapper(parserFuncs.parseGoTo, e, o)},
    {'name': 'local-storage', 'func': checkLocalStorage,
        'toCall': (e, o) => wrapper(parserFuncs.parseLocalStorage, e, o)},
    {'name': 'move-cursor-to', 'func': checkMoveCursorTo,
        'toCall': (e, o) => wrapper(parserFuncs.parseMoveCursorTo, e, o)},
    {'name': 'reload', 'func': checkReload,
        'toCall': (e, o) => wrapper(parserFuncs.parseReload, e, o)},
    {'name': 'screenshot', 'func': checkScreenshot,
        'toCall': (e, o) => wrapper(parserFuncs.parseScreenshot, e, o)},
    {'name': 'scroll-to', 'func': checkScrollTo,
        'toCall': (e, o) => wrapper(parserFuncs.parseScrollTo, e, o)},
    {'name': 'show-text', 'func': checkShowText,
        'toCall': (e, o) => wrapper(parserFuncs.parseShowText, e, o)},
    {'name': 'size', 'func': checkSize,
        'toCall': (e, o) => wrapper(parserFuncs.parseSize, e, o)},
    {'name': 'text', 'func': checkText,
        'toCall': (e, o) => wrapper(parserFuncs.parseText, e, o)},
    {'name': 'wait-for', 'func': checkWaitFor,
        'toCall': (e, o) => wrapper(parserFuncs.parseWaitFor, e, o)},
    {'name': 'write', 'func': checkWrite,
        'toCall': (e, o) => wrapper(parserFuncs.parseWrite, e, o)},
    // This one is a bit "on its own".
    {'name': 'parseContent', 'func': checkParseContent,
        'toCall': (e, o) => wrapper(parserFuncs.parseContent, e, o)},
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
