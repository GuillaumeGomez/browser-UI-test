const process = require('process');
const parserFuncs = require('../../src/commands.js');
const {Assert, plural, print} = require('./utils.js');

function checkAssert() {
    const func = parserFuncs.parseAssert;
    const x = new Assert();

    x.assert(func('"'), {'error': 'expected `(` character'});
    x.assert(func('(a, "b")'), {'error': 'expected `\'` or `"` character (first argument)'});
    x.assert(func('("a", "b"'), {'error': 'expected to end with `)` character'});
    x.assert(func('("a")'),
        {
            'instructions': ['if (page.$("a") === null) { throw \'"a" not found\'; }'],
            'wait': false,
        });
    x.assert(func('("a", )'),
        {
            'error': 'expected something (aka [string], [integer] or [JSON]) as second parameter ' +
                'or remove the comma',
        });
    x.assert(func('("a", "b", )'), {'error': 'no string (third argument)'});
    x.assert(func('("a", "b" "c")'), {'error': 'unexpected token after second parameter: `"`'});
    x.assert(func('("a", "b")'),
        {
            'instructions': [
                'let parseAssertElemStr = await page.$("a");\nif (parseAssertElemStr === null) { ' +
                'throw \'"a" not found\'; }\nlet t = await (await ' +
                'parseAssertElemStr.getProperty("textContent")).jsonValue();\nif (t !== "b") { ' +
                'throw \'"\' + t + \'" !== "b"\'; }'],
            'wait': false,
        });
    x.assert(func('("a", "b", "c")'),
        {
            'instructions': [
                'let parseAssertElemAttr = await page.$("a");\nif (parseAssertElemAttr === null) ' +
                '{ throw \'"a" not found\'; }\nawait page.evaluate(e => {\nif ' +
                '(e.getAttribute("b") !== "c") {\nthrow \'expected "c", found "\' + ' +
                'e.getAttribute("b") + \'" for attribute "b"\';\n}\n}, parseAssertElemAttr);'],
            'wait': false,
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
        });
    x.assert(func('("a", 1, "c")'), {'error': 'expected `)`, found `,`'});
    x.assert(func('("a", 1 2)'), {'error': 'Nothing was expected after second argument [integer]'});
    x.assert(func('("a", 1 a)'), {'error': 'expected `)`, found `a`'});
    x.assert(func('("a", 1)'),
        {
            'instructions': [
                'let parseAssertElemInt = await page.$$("a");\nif (parseAssertElemInt.length !== ' +
                '1) { throw \'expected 1 elements, found \' + parseAssertElemInt.length; }'],
            'wait': false,
        });
    x.assert(func('("a", {)').error !== undefined); // JSON syntax error
    x.assert(func('("a", {\'a\': 1})').error !== undefined); // JSON syntax error
    x.assert(func('("a", {"a": 1)').error !== undefined); // JSON syntax error
    x.assert(func('("a", {"a": 1})'), {
        'instructions': [
            'let parseAssertElemJson = await page.$("a");\nif (parseAssertElemJson === null) { ' +
            'throw \'"a" not found\'; }\nawait page.evaluate(e => {let assertComputedStyle = ' +
            'getComputedStyle(e);\nif (assertComputedStyle["a"] != "1") { throw \'expected "1", ' +
            'got for key "a" for "a"\'; }\n}, parseAssertElemJson);',
        ],
        'wait': false,
    });

    return x;
}

function checkAttribute() {
    const func = parserFuncs.parseAttribute;
    const x = new Assert();

    x.assert(func('"'), {'error': 'expected `(` character'});
    x.assert(func('("a", "b"'), {'error': 'expected to end with `)` character'});
    x.assert(func('("a")'), {'error': 'expected `,` after first argument, found `)`'});
    x.assert(func('("a", )'), {'error': 'expected `\'` or `"` character (second parameter)'});
    x.assert(func('("a", "b", )'), {'error': 'expected a string as third parameter'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` after second argument, found `"`'});
    x.assert(func('("a", )'), {'error': 'expected `\'` or `"` character (second parameter)'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` after second argument, found `"`'});
    x.assert(func('("a", "b")'), {'error': 'expected `,` after second argument, found `)`'});
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

    return x;
}

function checkClick() {
    const func = parserFuncs.parseClick;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected a position or a CSS selector'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected position to end with \')\'...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.click(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.click("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.click("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.click("\\\\"a")']});

    return x;
}

function checkFail() {
    const func = parserFuncs.parseFail;
    const x = new Assert();

    x.assert(func('hello'), {'error': 'Expected "true" or "false" value, found `hello`'});
    x.assert(func('"true"'), {'error': 'Expected "true" or "false" value, found `"true"`'});
    x.assert(func('tru'), {'error': 'Expected "true" or "false" value, found `tru`'});
    x.assert(func('false'), {'instructions': ['arg.expectedToFail = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.expectedToFail = true;'], 'wait': false});

    return x;
}

function checkFocus() {
    const func = parserFuncs.parseFocus;
    const x = new Assert();

    x.assert(func('a'), {'error': 'Expected a CSS selector'});
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.focus("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.focus("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.focus("\\\\"a")']});

    return x;
}

function checkGoTo() {
    const func = parserFuncs.parseGoTo;
    const x = new Assert();

    x.assert(func('a'), {'error': 'A relative path or a full URL was expected'});
    x.assert(func('"'), {'error': 'A relative path or a full URL was expected'});
    x.assert(func('http:/a'), {'error': 'A relative path or a full URL was expected'});
    x.assert(func('https:/a'), {'error': 'A relative path or a full URL was expected'});
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
    x.assert(func('file://{doc-path}/a', 'foo/'), { // `docPath` parameter always ends with '/'
        'instructions': ['await page.goto("file://foo/a")'],
    });

    return x;
}

function checkLocalStorage() {
    const func = parserFuncs.parseLocalStorage;
    const x = new Assert();

    x.assert(func('hello'), {'error': 'Expected JSON object, found `hello`'});
    x.assert(func('{').error !== undefined); // JSON syntax error
    x.assert(func('{\'a\': 1}').error !== undefined); // JSON syntax error
    x.assert(func('{"a": 1}'), {
        'instructions': ['page.evaluate(() => { localStorage.setItem("a", "1"); })'],
    });
    x.assert(func('{"a": "1"}'),
        {'instructions': ['page.evaluate(() => { localStorage.setItem("a", "1"); })']});
    x.assert(func('{"a": "1", "b": "2px"}'),
        {'instructions': ['page.evaluate(() => { localStorage.setItem("a", "1");\n' +
            'localStorage.setItem("b", "2px"); })']});

    return x;
}

function checkMoveCursorTo() {
    const func = parserFuncs.parseMoveCursorTo;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected a position or a CSS selector'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected position to end with \')\'...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.move(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.hover("\\\\"a")']});

    return x;
}

function checkScreenshot() {
    const func = parserFuncs.parseScreenshot;
    const x = new Assert();

    x.assert(func('hello'), {'error': 'Expected "true" or "false" value, found `hello`'});
    x.assert(func('"true"'), {'error': 'Expected "true" or "false" value, found `"true"`'});
    x.assert(func('tru'), {'error': 'Expected "true" or "false" value, found `tru`'});
    x.assert(func('false'), {'instructions': ['arg.takeScreenshot = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.takeScreenshot = true;'], 'wait': false});

    return x;
}

function checkScrollTo() {
    const func = parserFuncs.parseScrollTo;
    const x = new Assert();

    // Check position
    x.assert(func('hello'), {'error': 'Expected a position or a CSS selector'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected position to end with \')\'...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.mouse.move(1,2)']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['page.hover("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.hover("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.hover("\\\\"a")']});

    return x;
}

function checkSize() {
    const func = parserFuncs.parseSize;
    const x = new Assert();

    x.assert(func('hello'), {'error': 'Expected `(` character, found `h`'});
    x.assert(func('()'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('('), {'error': 'Invalid syntax: expected size to end with `)`...'});
    x.assert(func('(1)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2,)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(a,2)'), {'error': 'Invalid syntax: expected "([number], [number])"...'});
    x.assert(func('(1,2)'), {'instructions': ['page.setViewport({width: 1, height: 2})']});

    return x;
}

function checkText() {
    const func = parserFuncs.parseText;
    const x = new Assert();

    x.assert(func('"'), {'error': 'expected `(` character'});
    x.assert(func('("a", "b"'), {'error': 'expected to end with `)` character'});
    x.assert(func('("a")'), {'error': 'expected `,` after first argument, found `)`'});
    x.assert(func('("a", )'), {'error': 'expected a string as second parameter'});
    x.assert(func('("a", "b", "c")'), {'error': 'unexpected token: `,` after second parameter'});
    x.assert(func('("a", "b" "c")'), {'error': 'unexpected token: `"` after second parameter'});
    x.assert(func('(\'\', "b")'), {'error': 'selector cannot be empty'});
    x.assert(func('("a", "b")'),
        {
            'instructions': [
                'let parseTextElem = await page.$("a");\nif (parseTextElem === null) ' +
                '{ throw \'"a" not found\'; }\nawait page.evaluate(e => { e.innerText = "b";}, ' +
                'parseTextElem);',
            ],
        });

    return x;
}

function checkWaitFor() {
    const func = parserFuncs.parseWaitFor;
    const x = new Assert();

    // Check integer
    x.assert(func('hello'), {'error': 'Expected an integer or a CSS selector'});
    x.assert(func('1 2'), {'error': 'Expected an integer or a CSS selector'});
    x.assert(func('1'), {'instructions': ['await page.waitFor(1)'], 'wait': false});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'error': 'selector cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.waitFor("a")'], 'wait': false});
    x.assert(func('\'a\''), {'instructions': ['await page.waitFor("a")'], 'wait': false});
    x.assert(func('\'"a\''), {'instructions': ['await page.waitFor("\\\\"a")'], 'wait': false});

    return x;
}

function checkWrite() {
    const func = parserFuncs.parseWrite;
    const x = new Assert();

    // check tuple argument
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected to end with `)` character'});
    x.assert(func('("a")'), {'error': 'expected `,` after first parameter, found `)`'});
    x.assert(func('("a", )'), {'error': 'expected a string as second parameter'});
    x.assert(func('("a", "b", "c")'), {'error': 'unexpected token `,` after second parameter'});
    x.assert(func('("a", "b" "c")'), {'error': 'unexpected token `"` after second parameter'});
    x.assert(func('(\'\', "b")'), {'error': 'selector cannot be empty'});
    x.assert(func('("a", "b")'), {'instructions': ['page.focus("a")', 'page.keyboard.type("b")']});

    // check string argument
    x.assert(func('"'), {'error': 'expected `"` character at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` character at the end of the string'});
    x.assert(func('\'\''), {'instructions': ['page.keyboard.type("")']});
    x.assert(func('"a"'), {'instructions': ['page.keyboard.type("a")']});
    x.assert(func('\'a\''), {'instructions': ['page.keyboard.type("a")']});
    x.assert(func('\'"a\''), {'instructions': ['page.keyboard.type("\\"a")']});

    return x;
}

const TO_CHECK = [
    {'name': 'assert', 'func': checkAssert},
    {'name': 'attribute', 'func': checkAttribute},
    {'name': 'click', 'func': checkClick},
    {'name': 'fail', 'func': checkFail},
    {'name': 'focus', 'func': checkFocus},
    {'name': 'goto', 'func': checkGoTo},
    {'name': 'local-storage', 'func': checkLocalStorage},
    {'name': 'move-cursor-to', 'func': checkMoveCursorTo},
    {'name': 'screenshot', 'func': checkScreenshot},
    {'name': 'scroll-to', 'func': checkScrollTo},
    {'name': 'size', 'func': checkSize},
    {'name': 'text', 'func': checkText},
    {'name': 'wait-for', 'func': checkWaitFor},
    {'name': 'write', 'func': checkWrite},
];

function checkCommands() {
    let nbErrors = 0;

    print('=> Starting API tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        print(`==> Checking "${TO_CHECK[i].name}"...`);
        try {
            const errors = TO_CHECK[i].func();
            nbErrors += errors.errors;
            print(`<== "${TO_CHECK[i].name}": ${errors.errors} ${plural('error', errors.errors)}` +
                ` (in ${errors.ranTests} ${plural('test', errors.ranTests)})`);
        } catch (err) {
            nbErrors += 1;
            print(`<== "${TO_CHECK[i].name}" failed: ${err}\n${err.stack}`);
        }
    }

    print('');
    print(`<= Ending tests with ${nbErrors} ${plural('error', nbErrors)}`);

    return nbErrors;
}

if (require.main === module) {
    const nbErrors = checkCommands();
    process.exit(nbErrors);
} else {
    print('Cannot be used as module!', console.error);
    process.exit(1);
}
