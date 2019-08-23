const process = require('process');
const parserFuncs = require('../../src/commands.js');
const {Assert, plural, print} = require('./utils.js');

function checkAssert(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('(a, "b")'), {'error': 'unexpected `a` as first token'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` after `"b"`'});
    x.assert(func('("a")'),
        {
            'instructions': ['if (page.$("a") === null) { throw \'"a" not found\'; }'],
            'wait': false,
            'checkResult': true,
        });
    x.assert(func('("a", )'), {'error': 'unexpected `,` after `"a"`'});
    x.assert(func('("a", "b", )'), {'error': 'unexpected `,` after `"b"`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,`, found `"`'});
    x.assert(func('("a", "b")'),
        {
            'instructions': [
                'let parseAssertElemStr = await page.$("a");\nif (parseAssertElemStr === null) { ' +
                'throw \'"a" not found\'; }\nlet t = await (await ' +
                'parseAssertElemStr.getProperty("textContent")).jsonValue();\nif (t !== "b") { ' +
                'throw \'"\' + t + \'" !== "b"\'; }'],
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
        'error': 'expected json as second argument (since there are only arguments), found string',
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
        'error': 'expected json as second argument (since there are only arguments), found string',
    });
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
    x.assert(func('file://{doc-path}/a', {'docPath': 'foo/'}), {
        'instructions': ['await page.goto("file://foo/a")'],
    });
    x.assert(func('{url}', {'url': 'http://foo'}), {
        'instructions': ['await page.goto("http://foo")'],
    });
    x.assert(func('http://foo/{url}fa', {'url': 'tadam/'}), {
        'instructions': ['await page.goto("http://foo/tadam/fa")'],
    });
    x.assert(func('http://foo/{url}/fa', {'url': 'tadam/'}), {
        'instructions': ['await page.goto("http://foo/tadam/fa")'],
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

const TO_CHECK = [
    {'name': 'assert', 'func': checkAssert, 'toCall': parserFuncs.parseAssert},
    {'name': 'attribute', 'func': checkAttribute, 'toCall': parserFuncs.parseAttribute},
    {'name': 'click', 'func': checkClick, 'toCall': parserFuncs.parseClick},
    {'name': 'css', 'func': checkCss, 'toCall': parserFuncs.parseCss},
    {'name': 'fail', 'func': checkFail, 'toCall': parserFuncs.parseFail},
    {'name': 'focus', 'func': checkFocus, 'toCall': parserFuncs.parseFocus},
    {'name': 'goto', 'func': checkGoTo, 'toCall': parserFuncs.parseGoTo},
    {'name': 'local-storage', 'func': checkLocalStorage, 'toCall': parserFuncs.parseLocalStorage},
    {'name': 'move-cursor-to', 'func': checkMoveCursorTo, 'toCall': parserFuncs.parseMoveCursorTo},
    {'name': 'reload', 'func': checkReload, 'toCall': parserFuncs.parseReload},
    {'name': 'screenshot', 'func': checkScreenshot, 'toCall': parserFuncs.parseScreenshot},
    {'name': 'scroll-to', 'func': checkScrollTo, 'toCall': parserFuncs.parseScrollTo},
    {'name': 'show-text', 'func': checkShowText, 'toCall': parserFuncs.parseShowText},
    {'name': 'size', 'func': checkSize, 'toCall': parserFuncs.parseSize},
    {'name': 'text', 'func': checkText, 'toCall': parserFuncs.parseText},
    {'name': 'wait-for', 'func': checkWaitFor, 'toCall': parserFuncs.parseWaitFor},
    {'name': 'write', 'func': checkWrite, 'toCall': parserFuncs.parseWrite},
    // This one is a bit "on its own".
    {'name': 'parseContent', 'func': checkParseContent, 'toCall': parserFuncs.parseContent},
];

function checkCommands() {
    const x = new Assert();

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
    print(`<= Ending ${x.totalRanTests} ${plural('test', x.totalRanTests)} with ` +
        `${x.totalErrors} ${plural('error', x.totalErrors)}`);

    return x.totalErrors;
}

if (require.main === module) {
    const nbErrors = checkCommands();
    process.exit(nbErrors);
} else {
    print('Cannot be used as module!', console.error);
    process.exit(1);
}
