const process = require('process');
process.env.debug_tests = '1'; // We enable this to get all items from `commands.js`.
const parserFuncs = require('../../src/commands.js');
const {indentString} = require('../../src/commands/utils.js');
const {Parser} = require('../../src/parser.js');
const Options = require('../../src/options.js').Options;
const {Assert, plural, print} = require('./utils.js');

function wrapper(callback, arg, options) {
    if (typeof options === 'undefined') {
        options = new Options();
    }

    const p = new Parser(arg, options.variables);
    p.parse();
    if (p.error !== null) {
        return {'error': p.error};
    }
    return callback(p, options);
}

function wrapperGoTo(callback, arg, options) {
    if (typeof options === 'undefined') {
        options = new Options();
    }

    const p = new Parser(arg, options.variables);
    p.parseGoTo();
    if (p.error !== null) {
        return {'error': p.error};
    }
    return callback(p, options);
}

function wrapperParseContent(arg, options) {
    if (typeof options === 'undefined') {
        options = new Options();
    }
    const parser = new parserFuncs.ParserWithContext(arg, options);
    const res = [];
    while (true) { // eslint-disable-line no-constant-condition
        const tmp = parser.get_next_command();
        if (tmp === null) {
            break;
        }
        res.push(tmp);
        if (tmp.error !== undefined) {
            break;
        }
    }
    return res;
}

function checkAssertInner(x, func, before, after) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('1'), {'error': 'expected a tuple, a CSS selector or an XPath, found `1`'});
    x.assert(func('1.1'), {'error': 'expected a tuple, a CSS selector or an XPath, found `1.1`'});
    x.assert(func('(a, "b")'), {
        'error': 'expected only a CSS selector or an XPath in the tuple, found 2 elements',
    });
    x.assert(func('("a", 2)'), {
        'error': 'expected only a CSS selector or an XPath in the tuple, found 2 elements',
    });
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});

    x.assert(func('"a"'),
        {
            'instructions': [
                before +
                'if ((await page.$("a")) === null) { throw \'"a" not found\'; }' +
                after,
            ],
            'wait': false,
            'checkResult': true,
        });
    x.assert(func('("a")'),
        {
            'instructions': [
                before +
                'if ((await page.$("a")) === null) { throw \'"a" not found\'; }' +
                after,
            ],
            'wait': false,
            'checkResult': true,
        });

    // XPath
    x.assert(func('"/a"'), {'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'),
        {
            'instructions': [
                before +
                'if ((await page.$x("//a")).length === 0) { throw \'XPath "//a" not found\'; }' +
                after,
            ],
            'wait': false,
            'checkResult': true,
        });

    // Multiline
    x.assert(func('(\n"//a")'), {
        'instructions': [
            before +
            'if ((await page.$x("//a")).length === 0) { throw \'XPath "//a" not found\'; }' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline string.
    x.assert(func('"//a\nhello"'), {
        'instructions': [
            before +
            'if ((await page.$x("//a\\nhello")).length === 0) { ' +
            'throw \'XPath "//a\\nhello" not found\'; }' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssert(x, func) {
    checkAssertInner(x, func, '', '');
}

function checkAssertFalse(x, func) {
    checkAssertInner(x, func, 'try {\n', '\n} catch(e) { return; } throw "assert didn\'t fail";');
}

function checkAssertAttributeInner(x, func, notFound, equal, contains, startsWith) {
    x.assert(func('("a", "b", )'), {
        'error': 'expected a JSON dictionary as second argument, found `"b"` (a string)',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected a JSON dictionary as second argument, found `"b"` (a string)',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b" "c", ALL)'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b", "c")'), {
        'error': 'expected a JSON dictionary as second argument, found `"b"` (a string)',
    });
    x.assert(func('("a::after", {"a": 1}, all)'), {
        'error': 'unknown identifier `all`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("a::after", {"a": 1}, ALLO)'), {
        'error': 'unknown identifier `ALLO`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("a", {"b": "c", "b": "d"})'), {'error': 'attribute `b` is duplicated'});

    x.assert(func('("a", {})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"a":"1"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("a");
if (parseAssertElemAttr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"a":"1"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check the handling of pseudo elements
    x.assert(func('("a::after", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"a":"1"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'warnings': ['Pseudo-elements (`::after`) don\'t have attributes so the check will be ' +
            'performed on the element itself'],
        'checkResult': true,
    });
    x.assert(func('("a::after", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("a");
if (parseAssertElemAttr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"a":"1"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'warnings': ['Pseudo-elements (`::after`) don\'t have attributes so the check will be ' +
            'performed on the element itself'],
        'checkResult': true,
    });
    x.assert(func('("b:after", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("b:after");
if (parseAssertElemAttr === null) { throw '"b:after" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"a":"1"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`b:after\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("b:after", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("b:after");
if (parseAssertElemAttr.length === 0) { throw '"b:after" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"a":"1"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`b:after\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a ::after");
if (parseAssertElemAttr === null) { throw '"a ::after" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"a":"1"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a ::after\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("a ::after");
if (parseAssertElemAttr.length === 0) { throw '"a ::after" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"a":"1"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`a ::after\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    x.assert(func('("a", {"b": "c", "d": "e"})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"b":"c","d":"e"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"b": "c", "d": "e"}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("a");
if (parseAssertElemAttr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"b":"c","d":"e"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"\\"b": "c"})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"\\"b":"c"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"\\"b": "c"}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("a");
if (parseAssertElemAttr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"\\"b":"c"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"\\"b": "c"}, CONTAINS)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"\\"b":"c"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${contains(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"\\"b": "c"}, [CONTAINS, CONTAINS])'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"\\"b":"c"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${contains(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"\\"b": "c"}, [CONTAINS, STARTS_WITH])'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$("a");
if (parseAssertElemAttr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"\\"b":"c"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${contains(2)}
${startsWith(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"\\"b": "c"}, [CONTAINS, STARTS_WITH, ALL])'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$$("a");
if (parseAssertElemAttr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"\\"b":"c"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${contains(3)}
${startsWith(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", {})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$x("//a");
if (parseAssertElemAttr.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemAttr = parseAssertElemAttr[0];
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"b": "c"})'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$x("//a");
if (parseAssertElemAttr.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemAttr = parseAssertElemAttr[0];
await page.evaluate(e => {
    const nonMatchingAttrs = [];
    const parseAssertElemAttrDict = {"b":"c"};
    for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
        if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(3)}
            continue;
        }
        const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(2)}
    }
    if (nonMatchingAttrs.length !== 0) {
        const props = nonMatchingAttrs.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemAttr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"b": "c"}, ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$x("//a");
if (parseAssertElemAttr.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"b":"c"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a::after", \n {"a": 1}, \n ALLO)'), {
        'error': 'unknown identifier `ALLO`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("//a",\n    \n{"b": "c"}, \n ALL)'), {
        'instructions': [`\
let parseAssertElemAttr = await page.$x("//a");
if (parseAssertElemAttr.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemAttr.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingAttrs = [];
        const parseAssertElemAttrDict = {"b":"c"};
        for (const [parseAssertElemAttrAttribute, parseAssertElemAttrValue] of Object.entries(\
parseAssertElemAttrDict)) {
            if (!e.hasAttribute(parseAssertElemAttrAttribute)) {${notFound(4)}
                continue;
            }
            const attr = e.getAttribute(parseAssertElemAttrAttribute);
${equal(3)}
        }
        if (nonMatchingAttrs.length !== 0) {
            const props = nonMatchingAttrs.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemAttr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertAttribute(x, func) {
    checkAssertAttributeInner(
        x,
        func,
        indent => '\n' +
            indentString('nonMatchingAttrs.push("No attribute named `" + ' +
                'parseAssertElemAttrAttribute + "`");', indent),
        indent => indentString(`\
if (attr !== parseAssertElemAttrValue) {
    nonMatchingAttrs.push("attribute \`" + parseAssertElemAttrAttribute + "\` isn't equal to \`" + \
parseAssertElemAttrValue + "\` (\`" + attr + "\`)");
}`, indent),
        indent => indentString(`\
if (attr.indexOf(parseAssertElemAttrValue) === -1) {
    nonMatchingAttrs.push("attribute \`" + parseAssertElemAttrAttribute + "\` (\`" + attr + "\`) \
doesn't contain \`" + parseAssertElemAttrValue + "\` (for CONTAINS check)");
}`, indent),
        indent => indentString(`\
if (!attr.startsWith(parseAssertElemAttrValue)) {
    nonMatchingAttrs.push("attribute \`" + parseAssertElemAttrAttribute + "\` (\`" + attr + "\`) \
doesn't start with \`" + parseAssertElemAttrValue + "\` (for STARTS_WITH check)");
}`, indent),
    );
}

function checkAssertAttributeFalse(x, func) {
    checkAssertAttributeInner(
        x,
        func,
        () => '',
        indent => indentString(`\
if (attr === parseAssertElemAttrValue) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + parseAssertElemAttrAttribute + \
"\` (\`" + attr + "\`)");
}`, indent),
        indent => indentString(`\
if (attr.indexOf(parseAssertElemAttrValue) !== -1) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + parseAssertElemAttrAttribute + \
"\` (\`" + attr + "\`) (for CONTAINS check)");
}`, indent),
        indent => indentString(`\
if (attr.startsWith(parseAssertElemAttrValue)) {
    nonMatchingAttrs.push("assert didn't fail for attribute \`" + parseAssertElemAttrAttribute + \
"\` (\`" + attr + "\`) (for STARTS_WITH check)");
}`, indent),
    );
}

function checkAssertCountInner(x, func, before, after) {
    x.assert(func('("a", 1, "c")'), {'error': 'unexpected argument after number of occurences'});
    x.assert(func('("a", 1 2)'), {'error': 'expected `,` or `)`, found `2` after `1`'});
    x.assert(func('("a", 1 a)'), {'error': 'expected `,` or `)`, found `a` after `1`'});
    x.assert(func('("a", -1)'), {'error': 'number of occurences cannot be negative: `-1`'});
    x.assert(func('("a", -1.0)'), {
        'error': 'expected integer for number of occurences, found float: `-1.0`',
    });
    x.assert(func('("a", 1.0)'), {
        'error': 'expected integer for number of occurences, found float: `1.0`',
    });

    x.assert(func('("a", 1)'), {
        'instructions': [
            'let parseAssertElemInt = await page.$$("a");\n' +
            before +
            'if (parseAssertElemInt.length !== 1) {\n' +
            'throw \'expected 1 elements, found \' + parseAssertElemInt.length;\n' +
            '}' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check the handling of pseudo elements
    x.assert(func('("a::after", 1)'), {
        'instructions': [
            'let parseAssertElemInt = await page.$$("a");\n' +
            before +
            'if (parseAssertElemInt.length !== 1) {\n' +
            'throw \'expected 1 elements, found \' + parseAssertElemInt.length;\n' +
            '}' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a:focus", 1)'), {
        'instructions': [
            'let parseAssertElemInt = await page.$$("a:focus");\n' +
            before +
            'if (parseAssertElemInt.length !== 1) {\n' +
            'throw \'expected 1 elements, found \' + parseAssertElemInt.length;\n' +
            '}' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a :focus", 1)'), {
        'instructions': [
            'let parseAssertElemInt = await page.$$("a :focus");\n' +
            before +
            'if (parseAssertElemInt.length !== 1) {\n' +
            'throw \'expected 1 elements, found \' + parseAssertElemInt.length;\n' +
            '}' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", 1)'), {
        'instructions': [
            'let parseAssertElemInt = await page.$$("a ::after");\n' +
            before +
            'if (parseAssertElemInt.length !== 1) {\n' +
            'throw \'expected 1 elements, found \' + parseAssertElemInt.length;\n' +
            '}' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a", \n-1)'), {'error': 'number of occurences cannot be negative: `-1`'});
    x.assert(func('("a ::after"\n,\n 1)'), {
        'instructions': [
            'let parseAssertElemInt = await page.$$("a ::after");\n' +
            before +
            'if (parseAssertElemInt.length !== 1) {\n' +
            'throw \'expected 1 elements, found \' + parseAssertElemInt.length;\n' +
            '}' +
            after,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertCount(x, func) {
    checkAssertCountInner(x, func, '', '');
}

function checkAssertCountFalse(x, func) {
    checkAssertCountInner(
        x,
        func,
        'try {\n',
        '\n} catch(e) { return; } throw "assert didn\'t fail";',
    );
}

function checkAssertObjPropertyInner(
    x,
    func,
    objName,
    noProp,
    defaultCheck,
    containsCheck,
    startsWithCheck,
    endsWithCheck,
) {
    x.assert(func('["a"]'), {
        'error': 'expected a tuple or a JSON dict, found `["a"]`',
    });
    x.assert(func('("a", "b", )'), {
        'error': 'expected first element of the tuple to be a JSON dict, found `"a"` (a string)',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected first element of the tuple to be a JSON dict, found `"a"` (a string)',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b" "c", ALL)'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('({"a": "b"}, all)'), {
        'error': 'unknown identifier `all`. Available identifiers are: [`CONTAINS`, `ENDS_WITH`, ' +
            '`STARTS_WITH`]',
    });
    x.assert(func('("a::after", {"a": 1}, ALLO)'), {
        'error': 'expected a tuple of one or two elements, found 3 elements',
    });
    x.assert(func('({"b": "c", "b": "d"})'), {'error': 'property `b` is duplicated'});
    x.assert(func('({"": "b"})'), {
        'error': 'empty name of properties ("" or \'\') are not allowed',
    });

    x.assert(func('{"a": "b"}'), {
        'instructions': [`await page.evaluate(() => {
    const nonMatchingProps = [];
    const parseAssertDictPropDict = {"a":"b"};
    for (const [parseAssertDictPropKey, parseAssertDictPropValue] of Object.entries(\
parseAssertDictPropDict)) {
        if (${objName}[parseAssertDictPropKey] === undefined) {${noProp()}
            continue;
        }
        ${defaultCheck()}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened: [" + props + "]";
    }
});`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('({"a": "b"})'), {
        'instructions': [`await page.evaluate(() => {
    const nonMatchingProps = [];
    const parseAssertDictPropDict = {"a":"b"};
    for (const [parseAssertDictPropKey, parseAssertDictPropValue] of Object.entries(\
parseAssertDictPropDict)) {
        if (${objName}[parseAssertDictPropKey] === undefined) {${noProp()}
            continue;
        }
        ${defaultCheck()}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened: [" + props + "]";
    }
});`,
        ],
        'wait': false,
        'checkResult': true,
    });

    x.assert(func('({"a": "b"}, CONTAINS)'), {
        'instructions': [`await page.evaluate(() => {
    const nonMatchingProps = [];
    const parseAssertDictPropDict = {"a":"b"};
    for (const [parseAssertDictPropKey, parseAssertDictPropValue] of Object.entries(\
parseAssertDictPropDict)) {
        if (${objName}[parseAssertDictPropKey] === undefined) {${noProp()}
            continue;
        }
        ${containsCheck()}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened: [" + props + "]";
    }
});`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('({"a": "b"}, STARTS_WITH)'), {
        'instructions': [`await page.evaluate(() => {
    const nonMatchingProps = [];
    const parseAssertDictPropDict = {"a":"b"};
    for (const [parseAssertDictPropKey, parseAssertDictPropValue] of Object.entries(\
parseAssertDictPropDict)) {
        if (${objName}[parseAssertDictPropKey] === undefined) {${noProp()}
            continue;
        }
        ${startsWithCheck()}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened: [" + props + "]";
    }
});`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('({"a": "b"}, ENDS_WITH)'), {
        'instructions': [`await page.evaluate(() => {
    const nonMatchingProps = [];
    const parseAssertDictPropDict = {"a":"b"};
    for (const [parseAssertDictPropKey, parseAssertDictPropValue] of Object.entries(\
parseAssertDictPropDict)) {
        if (${objName}[parseAssertDictPropKey] === undefined) {${noProp()}
            continue;
        }
        ${endsWithCheck()}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened: [" + props + "]";
    }
});`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('({"a": "b"}, [STARTS_WITH, ENDS_WITH])'), {
        'instructions': [`await page.evaluate(() => {
    const nonMatchingProps = [];
    const parseAssertDictPropDict = {"a":"b"};
    for (const [parseAssertDictPropKey, parseAssertDictPropValue] of Object.entries(\
parseAssertDictPropDict)) {
        if (${objName}[parseAssertDictPropKey] === undefined) {${noProp()}
            continue;
        }
        ${startsWithCheck()}
        ${endsWithCheck()}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened: [" + props + "]";
    }
});`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertDocumentProperty(x, func) {
    checkAssertObjPropertyInner(
        x,
        func,
        'document',
        () => '\n            nonMatchingProps.push(\'Unknown document property `\' + ' +
            'parseAssertDictPropKey + \'`\');',
        () => `if (String(document[parseAssertDictPropKey]) != parseAssertDictPropValue) {
            nonMatchingProps.push('Expected \`' + parseAssertDictPropValue + '\` for property \`' \
+ parseAssertDictPropKey + '\`, found \`' + document[parseAssertDictPropKey] + '\`');
        }`,
        () => `\
if (String(document[parseAssertDictPropKey]).indexOf(parseAssertDictPropValue) === -1) {
            nonMatchingProps.push('Property \`' + parseAssertDictPropKey + '\` (\`' + \
document[parseAssertDictPropKey] + '\`) does not contain \`' + parseAssertDictPropValue + '\`');
        }`,
        () => `if (!String(document[parseAssertDictPropKey]).startsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push('Property \`' + parseAssertDictPropKey + '\` (\`' + \
document[parseAssertDictPropKey] + '\`) does not start with \`' + parseAssertDictPropValue + '\`');
        }`,
        () => `if (!String(document[parseAssertDictPropKey]).endsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push('Property \`' + parseAssertDictPropKey + '\` (\`' + \
document[parseAssertDictPropKey] + '\`) does not end with \`' + parseAssertDictPropValue + '\`');
        }`,
    );
}

function checkAssertDocumentPropertyFalse(x, func) {
    checkAssertObjPropertyInner(
        x,
        func,
        'document',
        () => '',
        () => `if (String(document[parseAssertDictPropKey]) == parseAssertDictPropValue) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey \
+ '\`');
        }`,
        () => `\
if (String(document[parseAssertDictPropKey]).indexOf(parseAssertDictPropValue) !== -1) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey + \
'\` (for CONTAINS check)');
        }`,
        () => `if (String(document[parseAssertDictPropKey]).startsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey + \
'\` (for STARTS_WITH check)');
        }`,
        () => `if (String(document[parseAssertDictPropKey]).endsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey + \
'\` (for ENDS_WITH check)');
        }`,
    );
}

function checkAssertWindowProperty(x, func) {
    checkAssertObjPropertyInner(
        x,
        func,
        'window',
        () => '\n            nonMatchingProps.push(\'Unknown window property `\' + ' +
            'parseAssertDictPropKey + \'`\');',
        () => `if (String(window[parseAssertDictPropKey]) != parseAssertDictPropValue) {
            nonMatchingProps.push('Expected \`' + parseAssertDictPropValue + '\` for property \`' \
+ parseAssertDictPropKey + '\`, found \`' + window[parseAssertDictPropKey] + '\`');
        }`,
        () => `\
if (String(window[parseAssertDictPropKey]).indexOf(parseAssertDictPropValue) === -1) {
            nonMatchingProps.push('Property \`' + parseAssertDictPropKey + '\` (\`' + \
window[parseAssertDictPropKey] + '\`) does not contain \`' + parseAssertDictPropValue + '\`');
        }`,
        () => `if (!String(window[parseAssertDictPropKey]).startsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push('Property \`' + parseAssertDictPropKey + '\` (\`' + \
window[parseAssertDictPropKey] + '\`) does not start with \`' + parseAssertDictPropValue + '\`');
        }`,
        () => `if (!String(window[parseAssertDictPropKey]).endsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push('Property \`' + parseAssertDictPropKey + '\` (\`' + \
window[parseAssertDictPropKey] + '\`) does not end with \`' + parseAssertDictPropValue + '\`');
        }`,
    );
}

function checkAssertWindowPropertyFalse(x, func) {
    checkAssertObjPropertyInner(
        x,
        func,
        'window',
        () => '',
        () => `if (String(window[parseAssertDictPropKey]) == parseAssertDictPropValue) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey \
+ '\`');
        }`,
        () => `\
if (String(window[parseAssertDictPropKey]).indexOf(parseAssertDictPropValue) !== -1) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey + \
'\` (for CONTAINS check)');
        }`,
        () => `if (String(window[parseAssertDictPropKey]).startsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey + \
'\` (for STARTS_WITH check)');
        }`,
        () => `if (String(window[parseAssertDictPropKey]).endsWith(parseAssertDictPropValue)) {
            nonMatchingProps.push("assert didn't fail for property \`" + parseAssertDictPropKey + \
'\` (for ENDS_WITH check)');
        }`,
    );
}

function checkAssertCssInner(x, func, assertCall) {
    x.assert(func('("a", "b", )'), {
        'error': 'expected JSON dictionary as second argument, found `"b"`',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected JSON dictionary as second argument, found `"b"`',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b" "c", ALL)'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b", "c")'), {
        'error': 'expected JSON dictionary as second argument, found `"b"`',
    });
    x.assert(func('("a::after", {"a": 1}, all)'), {
        'error': 'expected identifier `ALL` as third argument or nothing, found `all`',
    });
    x.assert(func('("a::after", {"a": 1}, ALLO)'), {
        'error': 'expected identifier `ALL` as third argument or nothing, found `ALLO`',
    });
    x.assert(func('("a", {"b": "c", "b": "d"})'), {'error': 'CSS property `b` is duplicated'});
    x.assert(func('("a", {"b": ""})'), {
        'error': 'Empty values are not allowed: `b` has an empty value',
    });
    x.assert(func('("a", {"": "b"})'), {
        'error': 'empty name of properties ("" or \'\') are not allowed',
    });

    x.assert(func('("a", {})'), {
        'instructions': [`let parseAssertElemCss = await page.$("a");
if (parseAssertElemCss === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1})'), {
        'instructions': [`let parseAssertElemCss = await page.$("a");
if (parseAssertElemCss === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {"a":"1"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1}, ALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$$("a");
if (parseAssertElemCss.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e);
        const parseAssertElemCssDict = {"a":"1"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check the handling of pseudo elements
    x.assert(func('("a::after", {"a": 1})'), {
        'instructions': [`let parseAssertElemCss = await page.$("a");
if (parseAssertElemCss === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e, "::after");
    const parseAssertElemCssDict = {"a":"1"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a::after", {"a": 1}, ALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$$("a");
if (parseAssertElemCss.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e, "::after");
        const parseAssertElemCssDict = {"a":"1"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a:focus", {"a": 1})'), {
        'instructions': [`let parseAssertElemCss = await page.$("a:focus");
if (parseAssertElemCss === null) { throw '"a:focus" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {"a":"1"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a:focus\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a:focus", {"a": 1}, ALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$$("a:focus");
if (parseAssertElemCss.length === 0) { throw '"a:focus" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e);
        const parseAssertElemCssDict = {"a":"1"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' +\
 browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a:focus\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"a": 1})'), {
        'instructions': [`let parseAssertElemCss = await page.$("a ::after");
if (parseAssertElemCss === null) { throw '"a ::after" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {"a":"1"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a ::after\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"a": 1}, ALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$$("a ::after");
if (parseAssertElemCss.length === 0) { throw '"a ::after" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e);
        const parseAssertElemCssDict = {"a":"1"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a ::after\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", {})'), {
        'instructions': [`let parseAssertElemCss = await page.$x("//a");
if (parseAssertElemCss.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemCss = parseAssertElemCss[0];
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"a": 1})'), {
        'instructions': [`let parseAssertElemCss = await page.$x("//a");
if (parseAssertElemCss.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemCss = parseAssertElemCss[0];
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {"a":"1"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"a": 1}, ALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$x("//a");
if (parseAssertElemCss.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e);
        const parseAssertElemCssDict = {"a":"1"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"a": 1, "b": 2})'), {
        'instructions': [`let parseAssertElemCss = await page.$x("//a");
if (parseAssertElemCss.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemCss = parseAssertElemCss[0];
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {"a":"1","b":"2"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"a": 1, "b": 2}, ALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$x("//a");
if (parseAssertElemCss.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e);
        const parseAssertElemCssDict = {"a":"1","b":"2"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a", {"b": \n"c"\n, "b": "d"})'), {'error': 'CSS property `b` is duplicated'});
    x.assert(func('("//a"\n, \n{"a": \n1, \n"b": \n2}\n, \nALL)'), {
        'instructions': [`let parseAssertElemCss = await page.$x("//a");
if (parseAssertElemCss.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemCss.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        let assertComputedStyle = getComputedStyle(e);
        const parseAssertElemCssDict = {"a":"1","b":"2"};
        for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
            const localErr = [];
            let succeeded = false;
            if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
                if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    if (browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[\
parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                        localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                    }
                    succeeded = true;
                }
                if (!succeeded) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
                }
            }
${assertCall(1)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemCss[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check the specially added check if "color" is used.
    x.assert(func('("a", {"color": 1})'), {
        'instructions': [`if (!arg.showText) {
    throw "\`show-text: true\` needs to be used before checking for \`color\` (otherwise the \
browser doesn't compute it)";
}`,
        `let parseAssertElemCss = await page.$("a");
if (parseAssertElemCss === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    let assertComputedStyle = getComputedStyle(e);
    const parseAssertElemCssDict = {"color":"1"};
    for (const [parseAssertElemCssKey, parseAssertElemCssValue] of \
Object.entries(parseAssertElemCssDict)) {
        const localErr = [];
        let succeeded = false;
        if (e.style[parseAssertElemCssKey] != parseAssertElemCssValue && \
assertComputedStyle[parseAssertElemCssKey] != parseAssertElemCssValue) {
            if (typeof assertComputedStyle[parseAssertElemCssKey] === "string" && \
assertComputedStyle[parseAssertElemCssKey].search(/^(\\d+\\.\\d+px)$/g) === 0) {
                if (browserUiTestHelpers.extractFloatOrZero(\
assertComputedStyle[parseAssertElemCssKey], true) + "px" !== parseAssertElemCssValue) {
                    localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\` (or \`' \
+ browserUiTestHelpers.extractFloatOrZero(assertComputedStyle[parseAssertElemCssKey], true) + \
'px\`)');
                }
                succeeded = true;
            }
            if (!succeeded) {
                localErr.push('expected \`' + parseAssertElemCssValue + '\` for key \`' + \
parseAssertElemCssKey + '\`, found \`' + assertComputedStyle[parseAssertElemCssKey] + '\`');
            }
        }
${assertCall(0)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemCss);`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertCss(x, func) {
    checkAssertCssInner(
        x,
        func,
        indent => indentString('nonMatchingProps.push(...localErr);', 2 + indent),
    );
}

function checkAssertCssFalse(x, func) {
    checkAssertCssInner(
        x,
        func,
        indent => indentString(`if (localErr.length === 0) {
    nonMatchingProps.push("assert didn't fail for key \`" + parseAssertElemCssKey + '\`');
}`, 2 + indent),
    );
}

function checkAssertLocalStorageInner(x, func, comp) {
    x.assert(func('hello'), {'error': 'expected JSON, found `hello`'});
    x.assert(func('{').error !== undefined); // JSON syntax error
    x.assert(func('{"a": x}'), {'error': 'Only `null` ident is allowed, found `x`'});

    x.assert(func('{"a": 1}'), {
        'instructions': [`\
await page.evaluate(() => {
    const errors = [];
    const localStorageElemDict = {"a":"1"};
    for (const [localStorageElemKey, localStorageElemValue] of \
Object.entries(localStorageElemDict)) {
        let localStorageElem = window.localStorage.getItem(localStorageElemKey);
        if (localStorageElem ${comp} localStorageElemValue) {
            errors.push("localStorage item \\"" + localStorageElemKey + "\\" (of value \\"" + \
localStorageElemValue + "\\") ${comp} \\"" + localStorageElem + "\\"");
        }
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
});`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('{"a": "1"}'), {
        'instructions': [`\
await page.evaluate(() => {
    const errors = [];
    const localStorageElemDict = {"a":"1"};
    for (const [localStorageElemKey, localStorageElemValue] of \
Object.entries(localStorageElemDict)) {
        let localStorageElem = window.localStorage.getItem(localStorageElemKey);
        if (localStorageElem ${comp} localStorageElemValue) {
            errors.push("localStorage item \\"" + localStorageElemKey + "\\" (of value \\"" + \
localStorageElemValue + "\\") ${comp} \\"" + localStorageElem + "\\"");
        }
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
});`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('{"a": "1", "b": "2px"}'), {
        'instructions': [`\
await page.evaluate(() => {
    const errors = [];
    const localStorageElemDict = {"a":"1","b":"2px"};
    for (const [localStorageElemKey, localStorageElemValue] of \
Object.entries(localStorageElemDict)) {
        let localStorageElem = window.localStorage.getItem(localStorageElemKey);
        if (localStorageElem ${comp} localStorageElemValue) {
            errors.push("localStorage item \\"" + localStorageElemKey + "\\" (of value \\"" + \
localStorageElemValue + "\\") ${comp} \\"" + localStorageElem + "\\"");
        }
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
});`],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('{"a"\n: \n"1"}'), {
        'instructions': [`\
await page.evaluate(() => {
    const errors = [];
    const localStorageElemDict = {"a":"1"};
    for (const [localStorageElemKey, localStorageElemValue] of \
Object.entries(localStorageElemDict)) {
        let localStorageElem = window.localStorage.getItem(localStorageElemKey);
        if (localStorageElem ${comp} localStorageElemValue) {
            errors.push("localStorage item \\"" + localStorageElemKey + "\\" (of value \\"" + \
localStorageElemValue + "\\") ${comp} \\"" + localStorageElem + "\\"");
        }
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
});`],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertLocalStorage(x, func) {
    checkAssertLocalStorageInner(x, func, '!=');
}

function checkAssertLocalStorageFalse(x, func) {
    checkAssertLocalStorageInner(x, func, '==');
}

function checkAssertPropertyInner(x, func, exists, equal, startsWith, endsWith) {
    x.assert(func('("a", "b", )'), {
        'error': 'expected a JSON dictionary as second argument, found `"b"` (a string)',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected a JSON dictionary as second argument, found `"b"` (a string)',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b" "c", ALL)'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b", "c")'), {
        'error': 'expected a JSON dictionary as second argument, found `"b"` (a string)',
    });
    x.assert(func('("a::after", {"a": 1}, all)'), {
        'error': 'unknown identifier `all`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("a::after", {"a": 1}, ALLO)'), {
        'error': 'unknown identifier `ALLO`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("a", {"b": "c", "b": "d"})'), {'error': 'property `b` is duplicated'});
    x.assert(func('("a", {"b": []})'), {
        'error': 'only string and number types are allowed as value, found `[]` (an array)',
    });
    x.assert(func('("a", {"b": gateau})'), {
        'error': 'only string and number types are allowed as value, found `gateau` (an ident)',
    });

    x.assert(func('("a", {})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a");
if (parseAssertElemProp === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a");
if (parseAssertElemProp === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$$("a");
if (parseAssertElemProp.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemProp.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        const parseAssertElemPropDict = {"a":"1"};
        for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(3)}
${equal(3)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemProp[i]);
}`],
        'wait': false,
        'checkResult': true,
    });

    // Check the handling of pseudo elements
    x.assert(func('("a::after", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a");
if (parseAssertElemProp === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'warnings': ['Pseudo-elements (`::after`) don\'t have attributes so the check will be \
performed on the element itself'],
        'checkResult': true,
    });
    x.assert(func('("a::after", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$$("a");
if (parseAssertElemProp.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemProp.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        const parseAssertElemPropDict = {"a":"1"};
        for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(3)}
${equal(3)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a\`): [" + props + "]";
        }
    }, parseAssertElemProp[i]);
}`],
        'wait': false,
        'warnings': ['Pseudo-elements (`::after`) don\'t have attributes so the check will be \
performed on the element itself'],
        'checkResult': true,
    });
    x.assert(func('("a:focus", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a:focus");
if (parseAssertElemProp === null) { throw '"a:focus" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a:focus\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a:focus", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$$("a:focus");
if (parseAssertElemProp.length === 0) { throw '"a:focus" not found'; }
for (let i = 0, len = parseAssertElemProp.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        const parseAssertElemPropDict = {"a":"1"};
        for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(3)}
${equal(3)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a:focus\`): [" + props + "]";
        }
    }, parseAssertElemProp[i]);
}`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a ::after");
if (parseAssertElemProp === null) { throw '"a ::after" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a ::after\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$$("a ::after");
if (parseAssertElemProp.length === 0) { throw '"a ::after" not found'; }
for (let i = 0, len = parseAssertElemProp.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        const parseAssertElemPropDict = {"a":"1"};
        for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(3)}
${equal(3)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for selector \`a ::after\`): [" + props + "]";
        }
    }, parseAssertElemProp[i]);
}`],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", {})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$x("//a");
if (parseAssertElemProp.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemProp = parseAssertElemProp[0];
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"a": 1})'), {
        'instructions': [`\
let parseAssertElemProp = await page.$x("//a");
if (parseAssertElemProp.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemProp = parseAssertElemProp[0];
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${equal(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"a": 1}, ALL)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$x("//a");
if (parseAssertElemProp.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemProp.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        const parseAssertElemPropDict = {"a":"1"};
        for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(3)}
${equal(3)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemProp[i]);
}`],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a", \n{"b"\n:\n []})'), {
        'error': 'only string and number types are allowed as value, found `[]` (an array)',
    });
    x.assert(func('("//a"\n, \n{"a": \n1},\n ALL)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$x("//a");
if (parseAssertElemProp.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemProp.length; i < len; ++i) {
    await page.evaluate(e => {
        const nonMatchingProps = [];
        const parseAssertElemPropDict = {"a":"1"};
        for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(3)}
${equal(3)}
        }
        if (nonMatchingProps.length !== 0) {
            const props = nonMatchingProps.join(", ");
            throw "The following errors happened (for XPath \`//a\`): [" + props + "]";
        }
    }, parseAssertElemProp[i]);
}`],
        'wait': false,
        'checkResult': true,
    });

    // Extended checks.
    x.assert(func('("a", {"a": 1}, STARTS_WITH)'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a");
if (parseAssertElemProp === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${startsWith(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1}, [STARTS_WITH, STARTS_WITH])'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a");
if (parseAssertElemProp === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${startsWith(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"a": 1}, [STARTS_WITH, ENDS_WITH])'), {
        'instructions': [`\
let parseAssertElemProp = await page.$("a");
if (parseAssertElemProp === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const nonMatchingProps = [];
    const parseAssertElemPropDict = {"a":"1"};
    for (const [parseAssertElemPropKey, parseAssertElemPropValue] of Object.entries(\
parseAssertElemPropDict)) {
${exists(2)}
${startsWith(2)}
${endsWith(2)}
    }
    if (nonMatchingProps.length !== 0) {
        const props = nonMatchingProps.join(", ");
        throw "The following errors happened (for selector \`a\`): [" + props + "]";
    }
}, parseAssertElemProp);`],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertProperty(x, func) {
    checkAssertPropertyInner(
        x,
        func,
        indent => indentString(`\
if (e[parseAssertElemPropKey] === undefined) {
    nonMatchingProps.push('Unknown property \`' + parseAssertElemPropKey + '\`');
    continue;
}`, indent),
        indent => indentString(`\
if (String(e[parseAssertElemPropKey]) != parseAssertElemPropValue) {
    nonMatchingProps.push('Expected \`' + parseAssertElemPropValue + '\` for property \`' \
+ parseAssertElemPropKey + '\`, found \`' + e[parseAssertElemPropKey] + '\`');
}`, indent),
        indent => indentString(`\
if (!String(e[parseAssertElemPropKey]).startsWith(parseAssertElemPropValue)) {
    nonMatchingProps.push('Property \`' + parseAssertElemPropKey + '\` (\`' + \
e[parseAssertElemPropKey] + '\`) does not start with \`' + parseAssertElemPropValue + '\`');
}`, indent),
        indent => indentString(`\
if (!String(e[parseAssertElemPropKey]).endsWith(parseAssertElemPropValue)) {
    nonMatchingProps.push('Property \`' + parseAssertElemPropKey + '\` (\`' + \
e[parseAssertElemPropKey] + '\`) does not end with \`' + parseAssertElemPropValue + '\`');
}`, indent),
    );
}

function checkAssertPropertyFalse(x, func) {
    checkAssertPropertyInner(
        x,
        func,
        indent => indentString(`\
if (e[parseAssertElemPropKey] === undefined) {
    continue;
}`, indent),
        indent => indentString(`\
if (String(e[parseAssertElemPropKey]) == parseAssertElemPropValue) {
    nonMatchingProps.push("assert didn't fail for property \`" + parseAssertElemPropKey + '\`');
}`, indent),
        indent => indentString(`\
if (String(e[parseAssertElemPropKey]).startsWith(parseAssertElemPropValue)) {
    nonMatchingProps.push("assert didn't fail for property \`" + parseAssertElemPropKey + '\` (for \
STARTS_WITH check)');
}`, indent),
        indent => indentString(`\
if (String(e[parseAssertElemPropKey]).endsWith(parseAssertElemPropValue)) {
    nonMatchingProps.push("assert didn't fail for property \`" + parseAssertElemPropKey + '\` (for \
ENDS_WITH check)');
}`, indent),
    );
}

function checkAssertPositionInner(x, func, cond) {
    x.assert(func('("a", "b", )'), {
        'error': 'expected JSON dictionary as second argument, found `"b"`',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected JSON dictionary as second argument, found `"b"`',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b" "c", ALL)'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b", "c")'), {
        'error': 'expected JSON dictionary as second argument, found `"b"`',
    });
    x.assert(func('("a::after", {"a": 1}, all)'), {
        'error': 'expected identifier `ALL` as third argument or nothing, found `all`',
    });
    x.assert(func('("a::after", {"a": 1}, ALLO)'), {
        'error': 'expected identifier `ALL` as third argument or nothing, found `ALLO`',
    });
    x.assert(func('("a", {"b": "c", "b": "d"})'), {
        'error': 'only number type is allowed as value, found `"c"` (a string)',
    });
    x.assert(func('("a", {"b": ""})'), {
        'error': 'only number type is allowed as value, found `""` (a string)',
    });
    x.assert(func('("a", {"z": 12})'), {
        'error': 'Only accepted keys are "x" and "y", found `"z"` (in `{"z": 12}`)',
    });

    x.assert(func('("a", {})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a");
if (parseAssertPosition === null) { throw '"a" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"x": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a");
if (parseAssertPosition === null) { throw '"a" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"x": 1}, ALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$$("a");
if (parseAssertPosition.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"y": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a");
if (parseAssertPosition === null) { throw '"a" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'top', 'marginTop', 'Y', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check the handling of pseudo elements
    x.assert(func('("a::after", {"x": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a");
if (parseAssertPosition === null) { throw '"a" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let pseudoStyle = window.getComputedStyle(e, "::after");
        let style = window.getComputedStyle(e);
        v += browserUiTestHelpers.extractFloatOrZero(pseudoStyle[field]) - \
browserUiTestHelpers.extractFloatOrZero(style[styleField]);
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a::after", {"y": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a");
if (parseAssertPosition === null) { throw '"a" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let pseudoStyle = window.getComputedStyle(e, "::after");
        let style = window.getComputedStyle(e);
        v += browserUiTestHelpers.extractFloatOrZero(pseudoStyle[field]) - \
browserUiTestHelpers.extractFloatOrZero(style[styleField]);
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'top', 'marginTop', 'Y', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a:focus", {"x": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a:focus");
if (parseAssertPosition === null) { throw '"a:focus" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a:focus", {"x": 1}, ALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$$("a:focus");
if (parseAssertPosition.length === 0) { throw '"a:focus" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"x": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$("a ::after");
if (parseAssertPosition === null) { throw '"a ::after" not found'; }
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a ::after", {"x": 1}, ALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$$("a ::after");
if (parseAssertPosition.length === 0) { throw '"a ::after" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // With decimal.
    x.assert(func('("a ::after", {"x": 1.14}, ALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$$("a ::after");
if (parseAssertPosition.length === 0) { throw '"a ::after" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1.14, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", {})'), {
        'instructions': [`\
let parseAssertPosition = await page.$x("//a");
if (parseAssertPosition.length === 0) { throw 'XPath "//a" not found'; }
parseAssertPosition = parseAssertPosition[0];
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"x": 1})'), {
        'instructions': [`\
let parseAssertPosition = await page.$x("//a");
if (parseAssertPosition.length === 0) { throw 'XPath "//a" not found'; }
parseAssertPosition = parseAssertPosition[0];
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"x": 1}, ALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$x("//a");
if (parseAssertPosition.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"x": 1, "y": 2})'), {
        'instructions': [`\
let parseAssertPosition = await page.$x("//a");
if (parseAssertPosition.length === 0) { throw 'XPath "//a" not found'; }
parseAssertPosition = parseAssertPosition[0];
await page.evaluate(elem => {
    const errors = [];
    function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
        let v = e.getBoundingClientRect()[field];
        let roundedV = Math.round(v);
${indentString(cond, 2)}
    }
    checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
    checkAssertPosBrowser(elem, 'top', 'marginTop', 'Y', 2, errors);
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertPosition);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"x": 1, "y": 2}, ALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$x("//a");
if (parseAssertPosition.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
        checkAssertPosBrowser(elem, 'top', 'marginTop', 'Y', 2, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a", {"x": \n1\n, "x": 2})'), {'error': 'JSON dict key `x` is duplicated'});
    x.assert(func('("//a"\n, \n{"x": \n1, \n"y": \n2}\n, \nALL)'), {
        'instructions': [`\
let parseAssertPosition = await page.$x("//a");
if (parseAssertPosition.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertPosition.length; i < len; ++i) {
    await page.evaluate(elem => {
        const errors = [];
        function checkAssertPosBrowser(e, field, styleField, kind, value, errors) {
            let v = e.getBoundingClientRect()[field];
            let roundedV = Math.round(v);
${indentString(cond, 3)}
        }
        checkAssertPosBrowser(elem, 'left', 'marginLeft', 'X', 1, errors);
        checkAssertPosBrowser(elem, 'top', 'marginTop', 'Y', 2, errors);
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertPosition[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertPosition(x, func) {
    checkAssertPositionInner(
        x,
        func,
        `\
if (v !== value && roundedV !== Math.round(value)) {
    errors.push("different " + kind + " values: " + v + " (or " + roundedV + ") != " + value);
}`);
}

function checkAssertPositionFalse(x, func) {
    checkAssertPositionInner(
        x,
        func,
        `\
if (v === value || roundedV === Math.round(value)) {
    errors.push("same " + kind + " values (whereas it shouldn't): " + v + " (or " + roundedV + ") \
!= " + value);
}`);
}

function checkAssertTextInner(x, func, compare, contains, startsWith, endsWith) {
    x.assert(func('("a", )'), {
        'error': 'invalid number of values in the tuple, read the documentation to see the ' +
            'accepted inputs',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", 2)'), {'error': 'expected second argument to be a string, found `2`'});
    x.assert(func('("a")'), {
        'error': 'invalid number of values in the tuple, read the documentation to see the ' +
            'accepted inputs',
    });
    x.assert(func('("a", "b", ALLO)'), {
        'error': 'unknown identifier `ALLO`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("a", "b", [ALLO])'), {
        'error': 'unknown identifier `ALLO`. Available identifiers are: [`ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`]',
    });
    x.assert(func('("a", "b", "c")'), {
        'error': 'expected an identifier or an array of identifiers (among `ALL`, `CONTAINS`, ' +
            '`STARTS_WITH`, `ENDS_WITH`) as third argument or nothing, found `c` (a string)',
    });
    x.assert(func('("a", "b", ["c"])'), {
        'error': 'expected an identifier or an array of identifiers as third argument (among `ALL' +
            '`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`), found an array of `string` (in `["c"]`)',
    });

    // Checking that having a pending comma is valid.
    x.assert(func('("a", "\'b",)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "\\'b";
${compare(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "\'b")'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "\\'b";
${compare(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "\'b", ALL)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$$("a");
if (parseAssertElemStr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "\\'b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // Ensure that wrapping `ALL` into an array is also accepted.
    x.assert(func('("a", "\'b", [ALL])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$$("a");
if (parseAssertElemStr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "\\'b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b")'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${compare(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", ALL)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$$("a");
if (parseAssertElemStr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", CONTAINS)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${contains(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", STARTS_WITH)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${startsWith(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", ENDS_WITH)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${endsWith(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [CONTAINS, ENDS_WITH])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${contains(1)}
${endsWith(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // If an identifier is present more than once, we check that there is a warning about it.
    x.assert(func('("a", "b", [CONTAINS, ENDS_WITH, CONTAINS])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${contains(1)}
${endsWith(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
        'warnings': ['`CONTAINS` is present more than once in the third argument array'],
    });
    // Checking that the warning is not duplicated.
    x.assert(func('("a", "b", [CONTAINS, ENDS_WITH, CONTAINS, CONTAINS])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${contains(1)}
${endsWith(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
        'warnings': ['`CONTAINS` is present more than once in the third argument array'],
    });
    x.assert(func('("a", "b", [ALL, CONTAINS])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$$("a");
if (parseAssertElemStr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${contains(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [ALL, CONTAINS, STARTS_WITH])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$$("a");
if (parseAssertElemStr.length === 0) { throw '"a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${contains(2)}
${startsWith(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", "b")'), {
        'instructions': [`\
let parseAssertElemStr = await page.$x("//a");
if (parseAssertElemStr.length === 0) { throw 'XPath "//a" not found'; }
parseAssertElemStr = parseAssertElemStr[0];
await page.evaluate(e => {
    const errors = [];
    const value = "b";
${compare(1)}
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "b", ALL)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$x("//a");
if (parseAssertElemStr.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "b", [ALL])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$x("//a");
if (parseAssertElemStr.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check correct escape of `'`.
    x.assert(func('("//a[text()=\'l\']", "b", [ALL])'), {
        'instructions': [`\
let parseAssertElemStr = await page.$x("//a[text()=\\'l\\']");
if (parseAssertElemStr.length === 0) { throw 'XPath "//a[text()=\\'l\\']" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a", \n2\n)'), {'error': 'expected second argument to be a string, found `2`'});
    x.assert(func('("//a"\n, \n"b",\n ALL)'), {
        'instructions': [`\
let parseAssertElemStr = await page.$x("//a");
if (parseAssertElemStr.length === 0) { throw 'XPath "//a" not found'; }
for (let i = 0, len = parseAssertElemStr.length; i < len; ++i) {
    await page.evaluate(e => {
        const errors = [];
        const value = "b";
${compare(2)}
        if (errors.length !== 0) {
            const errs = errors.join(", ");
            throw "The following errors happened: [" + errs + "]";
        }
    }, parseAssertElemStr[i]);
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkAssertText(x, func) {
    checkAssertTextInner(
        x,
        func,
        indent => indentString(`\
if (!browserUiTestHelpers.compareElemText(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` isn't equal to \`" + value + "\`");
}`, indent),
        indent => indentString(`\
if (!browserUiTestHelpers.elemTextContains(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` doesn't contain \`" + value + "\` \
(for CONTAINS check)");
}`, indent),
        indent => indentString(`\
if (!browserUiTestHelpers.elemTextStartsWith(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` doesn't start with \`" + value + "\` \
(for STARTS_WITH check)");
}`, indent),
        indent => indentString(`\
if (!browserUiTestHelpers.elemTextEndsWith(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` doesn't end with \`" + value + "\` \
(for ENDS_WITH check)");
}`, indent),
    );
}

function checkAssertTextFalse(x, func) {
    checkAssertTextInner(
        x,
        func,
        indent => indentString(`\
if (browserUiTestHelpers.compareElemText(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` is equal to \`" + value + "\`");
}`, indent),
        indent => indentString(`\
if (browserUiTestHelpers.elemTextContains(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` contains \`" + value + "\` \
(for CONTAINS check)");
}`, indent),
        indent => indentString(`\
if (browserUiTestHelpers.elemTextStartsWith(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` starts with \`" + value + "\` \
(for STARTS_WITH check)");
}`, indent),
        indent => indentString(`\
if (browserUiTestHelpers.elemTextEndsWith(e, value)) {
    errors.push("\`" + getElemText(e, value) + "\` ends with \`" + value + "\` \
(for ENDS_WITH check)");
}`, indent),
    );
}

function checkAttribute(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` or `,` after `"b"`'});
    x.assert(func('("a")'),
        {'error': 'expected `("CSS selector" or "XPath", "attribute name", "attribute value")` or' +
        ' `("CSS selector" or "XPath", [JSON object])`'});
    x.assert(func('("a", )'), {
        'error': 'expected `("CSS selector" or "XPath", "attribute name", "attribute value")` or ' +
            '`("CSS selector" or "XPath", [JSON object])`',
    });
    x.assert(func('("a", "b", )'), {
        'error': 'expected json as second argument (since there are only two arguments), found a ' +
            'string',
    });
    x.assert(func('("a", )'), {
        'error': 'expected `("CSS selector" or "XPath", "attribute name", "attribute value")` or ' +
            '`("CSS selector" or "XPath", [JSON object])`',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b")'), {
        'error': 'expected json as second argument (since there are only two arguments), found ' +
            'a string',
    });
    x.assert(func('("a", "b", "c", ALL)'), {
        'error': 'expected `("CSS selector" or "XPath", "attribute name", "attribute value")` or ' +
            '`("CSS selector" or "XPath", [JSON object])`',
    });

    x.assert(func('("a", "b", "c")'), {
        'instructions': [
            'let parseAttributeElem = await page.$("a");\n' +
            'if (parseAttributeElem === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c");\n' +
            '}, parseAttributeElem);',
        ],
    });
    x.assert(func('("a", "\\"b", "c")'), {
        'instructions': [
            'let parseAttributeElem = await page.$("a");\n' +
            'if (parseAttributeElem === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("\\"b","c");\n' +
            '}, parseAttributeElem);',
        ],
    });
    x.assert(func('("a", {"b": "c"})'), {
        'instructions': [
            'let parseAttributeElemJson = await page.$("a");\n' +
            'if (parseAttributeElemJson === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c");\n' +
            '}, parseAttributeElemJson);',
        ],
    });
    x.assert(func('("a", {"b": "c", "d": "e"})'), {
        'instructions': [
            'let parseAttributeElemJson = await page.$("a");\n' +
            'if (parseAttributeElemJson === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c");\n' +
            '}, parseAttributeElemJson);\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("d","e");\n' +
            '}, parseAttributeElemJson);',
        ],
    });

    // XPath
    x.assert(func('("/a", "b", "c")'), { 'error': 'XPath must start with `//`' });
    x.assert(func('("//a", "b", "c")'), {
        'instructions': [
            'let parseAttributeElem = await page.$x("//a");\n' +
            'if (parseAttributeElem.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseAttributeElem = parseAttributeElem[0];\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c");\n' +
            '}, parseAttributeElem);',
        ],
    });
    x.assert(func('("//a", {"b": "c"})'), {
        'instructions': [
            'let parseAttributeElemJson = await page.$x("//a");\n' +
            'if (parseAttributeElemJson.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseAttributeElemJson = parseAttributeElemJson[0];\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c");\n' +
            '}, parseAttributeElemJson);',
        ],
    });

    // Multiline
    x.assert(func('("a"\n,\n "b\n"\n)'), {
        'error': 'expected json as second argument (since there are only two arguments), found ' +
            'a string',
    });
    x.assert(func('("//a"\n,\n {"b":\n "c"})'), {
        'instructions': [
            'let parseAttributeElemJson = await page.$x("//a");\n' +
            'if (parseAttributeElemJson.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseAttributeElemJson = parseAttributeElemJson[0];\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c");\n' +
            '}, parseAttributeElemJson);',
        ],
    });

    // Multiline string.
    x.assert(func('("//a", {"b": "c\n"})'), {
        'instructions': [
            'let parseAttributeElemJson = await page.$x("//a");\n' +
            'if (parseAttributeElemJson.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseAttributeElemJson = parseAttributeElemJson[0];\n' +
            'await page.evaluate(e => {\n' +
            'e.setAttribute("b","c\\n");\n' +
            '}, parseAttributeElemJson);',
        ],
    });
}

function checkClick(x, func) {
    // Check position
    x.assert(func('hello'), {
        'error': 'expected a position or a CSS selector or an XPath, found `hello`',
    });
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,)`',
    });
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(a,2)`',
    });
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for X position, found float: `-1.0`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for X position, found float: `1.0`'});
    x.assert(func('(2,-1.0)'), {'error': 'expected integer for Y position, found float: `-1.0`'});
    x.assert(func('(2,1.0)'), {'error': 'expected integer for Y position, found float: `1.0`'});
    x.assert(func('(1,2)'), {'instructions': ['await page.mouse.click(1, 2);']});
    x.assert(func('(-1,2)'), {'instructions': ['await page.mouse.click(-1, 2);']});
    x.assert(func('(-2,1)'), {'instructions': ['await page.mouse.click(-2, 1);']});


    x.assert(func('(1,2,)'), {'instructions': ['await page.mouse.click(1, 2);']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'CSS selector cannot be empty', 'isXPath': false});
    x.assert(func('"a"'), {
        'instructions': [
            'let parseClickVar = await page.$("a");\n' +
            'if (parseClickVar === null) { throw \'"a" not found\'; }\n' +
            'await parseClickVar.click();',
        ],
    });
    x.assert(func('"a::before"'), {
        'instructions': [
            'let parseClickVar = await page.$("a");\n' +
            'if (parseClickVar === null) { throw \'"a" not found\'; }\n' +
            'await parseClickVar.click();',
        ],
        'warnings': [
            'Pseudo-elements (`::before`) can\'t be retrieved so `click` will be ' +
                'performed on the element directly',
        ],
    });
    x.assert(func('\'a\''), {
        'instructions': [
            'let parseClickVar = await page.$("a");\n' +
            'if (parseClickVar === null) { throw \'"a" not found\'; }\n' +
            'await parseClickVar.click();',
        ],
    });
    x.assert(func('\'"a\''), {
        'instructions': [
            'let parseClickVar = await page.$("\\"a");\n' +
            'if (parseClickVar === null) { throw \'"\\"a" not found\'; }\n' +
            'await parseClickVar.click();',
        ],
    });
    // On pseudo element.
    x.assert(func('"a::after"'), {
        'instructions': [
            'let parseClickVar = await page.$("a");\n' +
            'if (parseClickVar === null) { throw \'"a" not found\'; }\n' +
            'await parseClickVar.click();',
        ],
        'warnings': [
            'Pseudo-elements (`::after`) can\'t be retrieved so `click` will be performed' +
                ' on the element directly',
        ],
    });

    // XPath
    x.assert(func('"/a"'), {'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'), {
        'instructions': [
            'let parseClickVar = await page.$x("//a");\n' +
            'if (parseClickVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseClickVar = parseClickVar[0];\n' +
            'await parseClickVar.click();',
        ],
    });

    // Multiline
    x.assert(func('(a\n,\n2)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(a\n,\n2)`',
    });
    x.assert(func('(\n-2\n,\n1)'), {'instructions': ['await page.mouse.click(-2, 1);']});
}

function checkClickWithOffset(x, func) {
    // Check position
    x.assert(func('hello'), {
        'error': 'expected a tuple, found `hello`',
    });
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'expected `(["CSS Selector"|"XPath"], [JSON])`, found `(1)`',
    });
    x.assert(func('(1,)'), {
        'error': 'expected `(["CSS Selector"|"XPath"], [JSON])`, found `(1,)`',
    });
    x.assert(func('("a",)'), {
        'error': 'expected `(["CSS Selector"|"XPath"], [JSON])`, found `("a",)`',
    });
    x.assert(func('(1,2)'), {
        'error': 'expected first argument of tuple to be a "CSS selector" or an "XPath", found `1`',
    });
    x.assert(func('("a",{"a":"b"})'), {
        'error': 'only number type is allowed as value, found `"b"` (a string)',
    });
    x.assert(func('("a",{"a":{"a": "b"}})'), {
        'error': 'only number type is allowed as value, found `{"a": "b"}` (a json)',
    });
    x.assert(func('("a",{"a":b})'), {
        'error': 'only number type is allowed as value, found `b` (an ident)',
    });
    x.assert(func('("a",{"a":2})'), {
        'error': 'Unexpected key `a`, allowed keys: [x, y]',
    });
    x.assert(func('("a", {"x": 1, "x": 2})'), {
        'error': 'JSON dict key `x` is duplicated',
    });

    // CSS selector
    x.assert(func('("a", {"x": 1})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$("a");
if (parseClickWithOffsetVar === null) { throw '"a" not found'; }
await parseClickWithOffsetVar.click({
    "offset": {"x":1},
});`,
        ],
    });
    x.assert(func('("a", {"y": 2})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$("a");
if (parseClickWithOffsetVar === null) { throw '"a" not found'; }
await parseClickWithOffsetVar.click({
    "offset": {"y":2},
});`,
        ],
    });
    x.assert(func('("a", {})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$("a");
if (parseClickWithOffsetVar === null) { throw '"a" not found'; }
await parseClickWithOffsetVar.click({
    "offset": {},
});`,
        ],
    });
    x.assert(func('("a", {"x": 1, "y": 2})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$("a");
if (parseClickWithOffsetVar === null) { throw '"a" not found'; }
await parseClickWithOffsetVar.click({
    "offset": {"x":1,"y":2},
});`,
        ],
    });

    x.assert(func('("a::before", {"x": 1})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$("a");
if (parseClickWithOffsetVar === null) { throw '"a" not found'; }
await parseClickWithOffsetVar.click({
    "offset": {"x":1},
});`,
        ],
        'warnings': [
            'Pseudo-elements (`::before`) can\'t be retrieved so `click` will be performed on the' +
                ' element directly',
        ],
    });

    // XPath
    x.assert(func('("/a", {"x": 1})'), {'error': 'XPath must start with `//`'});
    x.assert(func('("//a", {"x": 1})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$x("//a");
if (parseClickWithOffsetVar.length === 0) { throw 'XPath "//a" not found'; }
parseClickWithOffsetVar = parseClickWithOffsetVar[0];
await parseClickWithOffsetVar.click({
    "offset": {"x":1},
});`,
        ],
    });

    // Multiline
    x.assert(func('(a\n,\n2)'), {
        'error': 'expected first argument of tuple to be a "CSS selector" or an "XPath", found `a`',
    });
    x.assert(func('(\n"a"\n,\n{\n"x":\n1})'), {
        'instructions': [`\
let parseClickWithOffsetVar = await page.$("a");
if (parseClickWithOffsetVar === null) { throw '"a" not found'; }
await parseClickWithOffsetVar.click({
    "offset": {"x":1},
});`,
        ],
    });
}

function checkCompareElementsAttributeInner(x, func, before, after) {
    x.assert(
        func('("a", "b", ())'),
        {'error': 'unexpected `()`: tuples need at least one argument'},
    );
    x.assert(
        func('("a", "b", (1))'),
        {'error': 'expected third argument to be an array of string, found a string'},
    );
    x.assert(
        func('("a", "b", ("x", "yo"))'),
        {'error': 'expected third argument to be an array of string, found a string'},
    );
    x.assert(func('"a"'), {'error': 'expected a tuple, found `"a"`'});
    x.assert(func('1'), {'error': 'expected a tuple, found `1`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('[]'), {'error': 'expected a tuple, found `[]`'});
    x.assert(func('("a")'), {'error': 'expected 3 or 4 elements in the tuple, found 1 element'});
    x.assert(func('("a", 1)'),
        {'error': 'expected 3 or 4 elements in the tuple, found 2 elements'},
    );
    x.assert(func('("a", "a", "b", "c")'), {
        'error': 'expected third argument to be an array of string, found a string',
    });
    x.assert(func('("a", "b", 1)'), {
        'error': 'expected third argument to be an array of string, found a string',
    });
    x.assert(func('("a", "b", ["a"], 1)'), {
        'error': 'expected fourth argument to be a string of an operator (one of `<`, `<=`, `>`, ' +
            '`>=`, `=`), found a number',
    });
    x.assert(func('("a", "b", ["a"], "a")'), {
        'error': 'Unknown operator `a` in fourth argument. Expected one of [`<`, `<=`, `>`, ' +
            '`>=`, `=`]',
    });

    x.assert(func('("a", "b", [])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = [];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [\'"data-whatever\'])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // Checking operators.
    x.assert(func('("a", "b", [\'"data-whatever\'], "=")'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [\'"data-whatever\'], ">")'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    let value1 = browserUiTestHelpers.extractFloat(e1.getAttribute(attr));
    if (value1 === null) {
        throw attr + " (" + e1.getAttribute(attr) + ") from \`a\` isn't a number so \
comparison cannot be performed";
    }
    let value2 = browserUiTestHelpers.extractFloat(e2.getAttribute(attr));
    if (value2 === null) {
        throw attr + " (" + e2.getAttribute(attr) + ") from \`b\` isn't a number so \
comparison cannot be performed";
    }
    ${before}if (value1 <= value2) {
        throw attr + ": " + e1.getAttribute(attr) + " <= " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [\'"data-whatever\'], ">=")'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    let value1 = browserUiTestHelpers.extractFloat(e1.getAttribute(attr));
    if (value1 === null) {
        throw attr + " (" + e1.getAttribute(attr) + ") from \`a\` isn't a number so \
comparison cannot be performed";
    }
    let value2 = browserUiTestHelpers.extractFloat(e2.getAttribute(attr));
    if (value2 === null) {
        throw attr + " (" + e2.getAttribute(attr) + ") from \`b\` isn't a number so \
comparison cannot be performed";
    }
    ${before}if (value1 < value2) {
        throw attr + ": " + e1.getAttribute(attr) + " < " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [\'"data-whatever\'], "<")'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    let value1 = browserUiTestHelpers.extractFloat(e1.getAttribute(attr));
    if (value1 === null) {
        throw attr + " (" + e1.getAttribute(attr) + ") from \`a\` isn't a number so \
comparison cannot be performed";
    }
    let value2 = browserUiTestHelpers.extractFloat(e2.getAttribute(attr));
    if (value2 === null) {
        throw attr + " (" + e2.getAttribute(attr) + ") from \`b\` isn't a number so \
comparison cannot be performed";
    }
    ${before}if (value1 >= value2) {
        throw attr + ": " + e1.getAttribute(attr) + " >= " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", [\'"data-whatever\'], "<=")'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    let value1 = browserUiTestHelpers.extractFloat(e1.getAttribute(attr));
    if (value1 === null) {
        throw attr + " (" + e1.getAttribute(attr) + ") from \`a\` isn't a number so \
comparison cannot be performed";
    }
    let value2 = browserUiTestHelpers.extractFloat(e2.getAttribute(attr));
    if (value2 === null) {
        throw attr + " (" + e2.getAttribute(attr) + ") from \`b\` isn't a number so \
comparison cannot be performed";
    }
    ${before}if (value1 > value2) {
        throw attr + ": " + e1.getAttribute(attr) + " > " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("/a", "b", [\'"data-whatever\'])'), {'error': 'XPath must start with `//`'});
    x.assert(func('("//a", "b", [])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$x("//a");
if (parseCompareElementsAttr1.length === 0) { throw 'XPath "//a" not found'; }
parseCompareElementsAttr1 = parseCompareElementsAttr1[0];
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = [];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "b", [\'"data-whatever\'])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$x("//a");
if (parseCompareElementsAttr1.length === 0) { throw 'XPath "//a" not found'; }
parseCompareElementsAttr1 = parseCompareElementsAttr1[0];
let parseCompareElementsAttr2 = await page.$("b");
if (parseCompareElementsAttr2 === null) { throw '"b" not found'; }
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "//b", [\'"data-whatever\'])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$("a");
if (parseCompareElementsAttr1 === null) { throw '"a" not found'; }
let parseCompareElementsAttr2 = await page.$x("//b");
if (parseCompareElementsAttr2.length === 0) { throw 'XPath "//b" not found'; }
parseCompareElementsAttr2 = parseCompareElementsAttr2[0];
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "//b", [\'"data-whatever\'])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$x("//a");
if (parseCompareElementsAttr1.length === 0) { throw 'XPath "//a" not found'; }
parseCompareElementsAttr1 = parseCompareElementsAttr1[0];
let parseCompareElementsAttr2 = await page.$x("//b");
if (parseCompareElementsAttr2.length === 0) { throw 'XPath "//b" not found'; }
parseCompareElementsAttr2 = parseCompareElementsAttr2[0];
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a"\n,\n "b", 1)'), {
        'error': 'expected third argument to be an array of string, found a string',
    });
    x.assert(func('("//a"\n,\n "//b", [\'"data-whatever\'])'), {
        'instructions': [`\
let parseCompareElementsAttr1 = await page.$x("//a");
if (parseCompareElementsAttr1.length === 0) { throw 'XPath "//a" not found'; }
parseCompareElementsAttr1 = parseCompareElementsAttr1[0];
let parseCompareElementsAttr2 = await page.$x("//b");
if (parseCompareElementsAttr2.length === 0) { throw 'XPath "//b" not found'; }
parseCompareElementsAttr2 = parseCompareElementsAttr2[0];
await page.evaluate((e1, e2) => {
const attributes = ["\\"data-whatever"];
for (const attr of attributes) {
    ${before}if (e1.getAttribute(attr) !== e2.getAttribute(attr)) {
        throw attr + ": " + e1.getAttribute(attr) + " !== " + e2.getAttribute(attr);
    }${after}
}
}, parseCompareElementsAttr1, parseCompareElementsAttr2);`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkCompareElementsAttribute(x, func) {
    checkCompareElementsAttributeInner(x, func, '', '');
}

function checkCompareElementsAttributeFalse(x, func) {
    checkCompareElementsAttributeInner(
        x,
        func,
        'try {\n    ',
        '\n    } catch(e) { continue; } throw "assert didn\'t fail";',
    );
}

function checkCompareElementsCssInner(x, func, before, after) {
    x.assert(
        func('("a", "b", ())'),
        {'error': 'unexpected `()`: tuples need at least one argument'},
    );
    x.assert(
        func('("a", "b", (1))'),
        {'error': 'expected third argument to be an array of string, found a tuple'},
    );
    x.assert(func('"a"'), {'error': 'expected a tuple, found `"a"`'});
    x.assert(func('1'), {'error': 'expected a tuple, found `1`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('[]'), {'error': 'expected a tuple, found `[]`'});
    x.assert(func('("a")'), {'error': 'expected 3 elements in the tuple, found 1 element'});
    x.assert(func('("a", 1, [])'),
        {'error': 'expected second argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('(1, "a", [])'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('((), "a", [])'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a tuple'},
    );
    x.assert(func('("a", "a", "b", "c")'), {
        'error': 'expected 3 elements in the tuple, found 4 elements',
    });
    x.assert(func('("a", "b", 1)'), {
        'error': 'expected third argument to be an array of string, found a number',
    });
    x.assert(func('("a", "b", [""])'), {
        'error': 'Empty CSS property keys ("" or \'\') are not allowed',
    });

    x.assert(func('("a", "b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsCss1 = await page.$("a");\n' +
            'if (parseCompareElementsCss1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsCss2 = await page.$("b");\n' +
            'if (parseCompareElementsCss2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((e1, e2) => {let computed_style1 = getComputedStyle(e1);\n' +
            'let computed_style2 = getComputedStyle(e2);\n' +
            'const properties = ["margin"];\n' +
            'for (const css_property of properties) {\n' +
            before +
            'let style1_1 = e1.style[css_property];\n' +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && style1_2 != style2_1 ' +
            '&& style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + style1_2 + \' ' +
            '!= \' + style2_2; }' + after + '\n' +
            '}\n' +
            '}, parseCompareElementsCss1, parseCompareElementsCss2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Xpath
    x.assert(func('("//a", "b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsCss1 = await page.$x("//a");\n' +
            'if (parseCompareElementsCss1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsCss1 = parseCompareElementsCss1[0];\n' +
            'let parseCompareElementsCss2 = await page.$("b");\n' +
            'if (parseCompareElementsCss2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((e1, e2) => {let computed_style1 = getComputedStyle(e1);\n' +
            'let computed_style2 = getComputedStyle(e2);\n' +
            'const properties = ["margin"];\n' +
            'for (const css_property of properties) {\n' +
            before +
            'let style1_1 = e1.style[css_property];\n' +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && style1_2 != style2_1 ' +
            '&& style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + style1_2 + \' ' +
            '!= \' + style2_2; }' + after + '\n' +
            '}\n' +
            '}, parseCompareElementsCss1, parseCompareElementsCss2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "//b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsCss1 = await page.$("a");\n' +
            'if (parseCompareElementsCss1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsCss2 = await page.$x("//b");\n' +
            'if (parseCompareElementsCss2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsCss2 = parseCompareElementsCss2[0];\n' +
            'await page.evaluate((e1, e2) => {let computed_style1 = getComputedStyle(e1);\n' +
            'let computed_style2 = getComputedStyle(e2);\n' +
            'const properties = ["margin"];\n' +
            'for (const css_property of properties) {\n' +
            before +
            'let style1_1 = e1.style[css_property];\n' +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && style1_2 != style2_1 ' +
            '&& style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + style1_2 + \' ' +
            '!= \' + style2_2; }' + after + '\n' +
            '}\n' +
            '}, parseCompareElementsCss1, parseCompareElementsCss2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "//b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsCss1 = await page.$x("//a");\n' +
            'if (parseCompareElementsCss1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsCss1 = parseCompareElementsCss1[0];\n' +
            'let parseCompareElementsCss2 = await page.$x("//b");\n' +
            'if (parseCompareElementsCss2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsCss2 = parseCompareElementsCss2[0];\n' +
            'await page.evaluate((e1, e2) => {let computed_style1 = getComputedStyle(e1);\n' +
            'let computed_style2 = getComputedStyle(e2);\n' +
            'const properties = ["margin"];\n' +
            'for (const css_property of properties) {\n' +
            before +
            'let style1_1 = e1.style[css_property];\n' +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && style1_2 != style2_1 ' +
            '&& style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + style1_2 + \' ' +
            '!= \' + style2_2; }' + after + '\n' +
            '}\n' +
            '}, parseCompareElementsCss1, parseCompareElementsCss2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a"\n, \n"b", 1)'), {
        'error': 'expected third argument to be an array of string, found a number',
    });
    x.assert(func('("//a"\n,\n "//b",\n [\n"margin"])'), {
        'instructions': [
            'let parseCompareElementsCss1 = await page.$x("//a");\n' +
            'if (parseCompareElementsCss1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsCss1 = parseCompareElementsCss1[0];\n' +
            'let parseCompareElementsCss2 = await page.$x("//b");\n' +
            'if (parseCompareElementsCss2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsCss2 = parseCompareElementsCss2[0];\n' +
            'await page.evaluate((e1, e2) => {let computed_style1 = getComputedStyle(e1);\n' +
            'let computed_style2 = getComputedStyle(e2);\n' +
            'const properties = ["margin"];\n' +
            'for (const css_property of properties) {\n' +
            before +
            'let style1_1 = e1.style[css_property];\n' +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && style1_2 != style2_1 ' +
            '&& style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + style1_2 + \' ' +
            '!= \' + style2_2; }' + after + '\n' +
            '}\n' +
            '}, parseCompareElementsCss1, parseCompareElementsCss2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Check the specially added check if "color" is used.
    x.assert(func('("a", "b", ["color"])'), {
        'instructions': [
            'if (!arg.showText) {\n' +
            'throw "`show-text: true` needs to be used before checking for `color` (otherwise ' +
            'the browser doesn\'t compute it)";\n' +
            '}',
            'let parseCompareElementsCss1 = await page.$("a");\n' +
            'if (parseCompareElementsCss1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsCss2 = await page.$("b");\n' +
            'if (parseCompareElementsCss2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((e1, e2) => {let computed_style1 = getComputedStyle(e1);\n' +
            'let computed_style2 = getComputedStyle(e2);\n' +
            'const properties = ["color"];\n' +
            'for (const css_property of properties) {\n' +
            before +
            'let style1_1 = e1.style[css_property];\n' +
            'let style1_2 = computed_style1[css_property];\n' +
            'let style2_1 = e2.style[css_property];\n' +
            'let style2_2 = computed_style2[css_property];\n' +
            'if (style1_1 != style2_1 && style1_1 != style2_2 && style1_2 != style2_1 ' +
            '&& style1_2 != style2_2) {\n' +
            'throw \'CSS property `\' + css_property + \'` did not match: \' + style1_2 + \' ' +
            '!= \' + style2_2; }' + after + '\n' +
            '}\n' +
            '}, parseCompareElementsCss1, parseCompareElementsCss2);',
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkCompareElementsCss(x, func) {
    checkCompareElementsCssInner(x, func, '', '');
}

function checkCompareElementsCssFalse(x, func) {
    checkCompareElementsCssInner(
        x,
        func,
        'try {\n',
        '\n} catch(e) { continue; } throw "assert didn\'t fail";',
    );
}

function checkCompareElementsPositionInner(x, func, before, after) {
    x.assert(func('"a"'), {'error': 'expected a tuple, found `"a"`'});
    x.assert(func('1'), {'error': 'expected a tuple, found `1`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('[]'), {'error': 'expected a tuple, found `[]`'});
    x.assert(func('("a")'), {'error': 'expected 3 elements in the tuple, found 1 element'});
    x.assert(func('("a", 1)'),
        {'error': 'expected 3 elements in the tuple, found 2 elements'},
    );
    x.assert(func('(1, "a", ("a"))'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('((), "a", ("a"))'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a tuple'},
    );
    x.assert(func('("a", "a", "b", "c")'), {
        'error': 'expected 3 elements in the tuple, found 4 elements',
    });
    x.assert(func('("a", "b", 1)'), {
        'error': 'expected third argument to be a tuple, found a number',
    });
    x.assert(
        func('("a", "b", ())'),
        {'error': 'unexpected `()`: tuples need at least one argument'},
    );
    x.assert(
        func('("a", "b", (1))'),
        {'error': 'expected an array of strings, found `(1)`'},
    );
    x.assert(
        func('("a", "b", ("x", "yo"))'),
        {'error': 'Only accepted values are "x" and "y", found `"yo"` (in `("x", "yo")`)'},
    );
    x.assert(
        func('("a", "b", ("x", "y", "x"))'),
        {'error': 'Duplicated "x" value in `("x", "y", "x")`'},
    );
    x.assert(
        func('("a", "b", ("x", "y", "y"))'),
        {'error': 'Duplicated "y" value in `("x", "y", "y")`'},
    );

    x.assert(func('("a", "b", ("x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", ("y"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", ("x", "y"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Pseudo element
    x.assert(func('("a::after", "b", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let pseudoStyle1 = window.getComputedStyle(e1, "::after");\n' +
            'let style1 = window.getComputedStyle(e1);\n' +
            'y1 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle1.top) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style1.marginTop);\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let pseudoStyle1 = window.getComputedStyle(e1, "::after");\n' +
            'let style1 = window.getComputedStyle(e1);\n' +
            'x1 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle1.left) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style1.marginLeft);\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b::after", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let pseudoStyle2 = window.getComputedStyle(e2, "::after");\n' +
            'let style2 = window.getComputedStyle(e2);\n' +
            'y2 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle2.top) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style2.marginTop);\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let pseudoStyle2 = window.getComputedStyle(e2, "::after");\n' +
            'let style2 = window.getComputedStyle(e2);\n' +
            'x2 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle2.left) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style2.marginLeft);\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a::after", "b::after", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let pseudoStyle1 = window.getComputedStyle(e1, "::after");\n' +
            'let style1 = window.getComputedStyle(e1);\n' +
            'y1 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle1.top) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style1.marginTop);\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let pseudoStyle2 = window.getComputedStyle(e2, "::after");\n' +
            'let style2 = window.getComputedStyle(e2);\n' +
            'y2 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle2.top) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style2.marginTop);\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let pseudoStyle1 = window.getComputedStyle(e1, "::after");\n' +
            'let style1 = window.getComputedStyle(e1);\n' +
            'x1 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle1.left) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style1.marginLeft);\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let pseudoStyle2 = window.getComputedStyle(e2, "::after");\n' +
            'let style2 = window.getComputedStyle(e2);\n' +
            'x2 += browserUiTestHelpers.extractFloatOrZero(pseudoStyle2.left) - ' +
                'browserUiTestHelpers.extractFloatOrZero(style2.marginLeft);\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", "b", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$x("//a");\n' +
            'if (parseCompareElementsPos1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsPos1 = parseCompareElementsPos1[0];\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "//b", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$x("//b");\n' +
            'if (parseCompareElementsPos2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsPos2 = parseCompareElementsPos2[0];\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "//b", ("y", "x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$x("//a");\n' +
            'if (parseCompareElementsPos1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsPos1 = parseCompareElementsPos1[0];\n' +
            'let parseCompareElementsPos2 = await page.$x("//b");\n' +
            'if (parseCompareElementsPos2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsPos2 = parseCompareElementsPos2[0];\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'if (y1 !== y2) { throw "different Y values: " + y1 + " != " + y2; }\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(
        func('("a", \n"b", \n("x",\n "y", "y"))'),
        {'error': 'Duplicated "y" value in `("x",\n "y", "y")`'},
    );

    x.assert(func('("a",\n "b", (\n"x"))'), {
        'instructions': [
            'let parseCompareElementsPos1 = await page.$("a");\n' +
            'if (parseCompareElementsPos1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPos2 = await page.$("b");\n' +
            'if (parseCompareElementsPos2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'if (x1 !== x2) { throw "different X values: " + x1 + " != " + x2; }\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPos1, parseCompareElementsPos2);',
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkCompareElementsPosition(x, func) {
    checkCompareElementsPositionInner(x, func, '', '');
}

function checkCompareElementsPositionFalse(x, func) {
    checkCompareElementsPositionInner(
        x,
        func,
        'try {\n',
        '\n} catch(e) { return; } throw "assert didn\'t fail";',
    );
}

function checkCompareElementsPositionNearInner(x, func, before, after) {
    x.assert(func('"a"'), {'error': 'expected a tuple, found `"a"`'});
    x.assert(func('1'), {'error': 'expected a tuple, found `1`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('[]'), {'error': 'expected a tuple, found `[]`'});
    x.assert(func('("a")'), {'error': 'expected 3 elements in the tuple, found 1 element'});
    x.assert(func('("a", 1)'),
        {'error': 'expected 3 elements in the tuple, found 2 elements'},
    );
    x.assert(func('(1, "a", ("a"))'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('((), "a", ("a"))'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a tuple'},
    );
    x.assert(func('("a", "a", "b", "c")'), {
        'error': 'expected 3 elements in the tuple, found 4 elements',
    });
    x.assert(func('("a", "b", 1)'), {
        'error': 'expected third argument to be a JSON dict, found a number',
    });
    x.assert(
        func('("a", "b", ())'),
        {'error': 'unexpected `()`: tuples need at least one argument'},
    );
    x.assert(
        func('("a", "b", (1))'),
        {'error': 'expected third argument to be a JSON dict, found a tuple'},
    );
    x.assert(
        func('("a", "b", {"x": 1, "yo": 2})'),
        {'error': 'Only accepted keys are "x" and "y", found `"yo"` (in `{"x": 1, "yo": 2}`)'},
    );
    x.assert(
        func('("a", "b", {"x": 1, "x": 2})'),
        {'error': 'JSON dict key `x` is duplicated'},
    );
    x.assert(
        func('("a", "b", {"x": "a", "y": 2})'),
        {'error': 'only number type is allowed as value, found `"a"` (a string)'},
    );
    x.assert(
        func('("a", "b", {"x": -1})'),
        {'error': 'Delta cannot be negative (in `"x": -1`)'},
    );
    x.assert(
        func('("a", "b", {"y": -1})'),
        {'error': 'Delta cannot be negative (in `"y": -1`)'},
    );

    x.assert(func('("a", "b", {})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", {"x": 1})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta X values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", {"y": 1})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta Y values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", {"x": 1, "y": 2})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta X values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 2) {\n' +
            'throw "delta Y values too large: " + delta + " > 2";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "b", {"y": 2, "x": 1})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 2) {\n' +
            'throw "delta Y values too large: " + delta + " > 2";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta X values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // warnings
    x.assert(func('("a", "b", {"x": 0})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 0) {\n' +
            'throw "delta X values too large: " + delta + " > 0";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
        'warnings': ['Delta is 0 for "X", maybe try to use `compare-elements-position` instead?'],
    });
    x.assert(func('("a", "b", {"y": 0})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 0) {\n' +
            'throw "delta Y values too large: " + delta + " > 0";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
        'warnings': ['Delta is 0 for "Y", maybe try to use `compare-elements-position` instead?'],
    });

    // XPath
    x.assert(func('("//a", "b", {"y": 2, "x": 1})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$x("//a");\n' +
            'if (parseCompareElementsPosNear1.length === 0) { throw \'XPath "//a" not found\'; }\n'
            + 'parseCompareElementsPosNear1 = parseCompareElementsPosNear1[0];\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 2) {\n' +
            'throw "delta Y values too large: " + delta + " > 2";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta X values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "//b", {"y": 2, "x": 1})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$x("//b");\n' +
            'if (parseCompareElementsPosNear2.length === 0) { throw \'XPath "//b" not found\'; }\n'
            + 'parseCompareElementsPosNear2 = parseCompareElementsPosNear2[0];\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 2) {\n' +
            'throw "delta Y values too large: " + delta + " > 2";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta X values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "//b", {"y": 2, "x": 1})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$x("//a");\n' +
            'if (parseCompareElementsPosNear1.length === 0) { throw \'XPath "//a" not found\'; }\n'
            + 'parseCompareElementsPosNear1 = parseCompareElementsPosNear1[0];\n' +
            'let parseCompareElementsPosNear2 = await page.$x("//b");\n' +
            'if (parseCompareElementsPosNear2.length === 0) { throw \'XPath "//b" not found\'; }\n'
            + 'parseCompareElementsPosNear2 = parseCompareElementsPosNear2[0];\n' +
            'await page.evaluate((elem1, elem2) => {\n' +
            'function checkY(e1, e2) {\n' +
            before +
            'let y1 = e1.getBoundingClientRect().top;\n' +
            'let y2 = e2.getBoundingClientRect().top;\n' +
            'let delta = Math.abs(y1 - y2);\n' +
            'if (delta > 2) {\n' +
            'throw "delta Y values too large: " + delta + " > 2";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkY(elem1, elem2);\n' +
            'function checkX(e1, e2) {\n' +
            before +
            'let x1 = e1.getBoundingClientRect().left;\n' +
            'let x2 = e2.getBoundingClientRect().left;\n' +
            'let delta = Math.abs(x1 - x2);\n' +
            'if (delta > 1) {\n' +
            'throw "delta X values too large: " + delta + " > 1";\n' +
            '}\n' +
            after +
            '}\n' +
            'checkX(elem1, elem2);\n' +
            '}, parseCompareElementsPosNear1, parseCompareElementsPosNear2);',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(
        func('("a", \n"b", {\n"y":\n -1})'),
        {'error': 'Delta cannot be negative (in `"y": -1`)'},
    );
    x.assert(func('("a", \n"b",\n {\n})'), {
        'instructions': [
            'let parseCompareElementsPosNear1 = await page.$("a");\n' +
            'if (parseCompareElementsPosNear1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsPosNear2 = await page.$("b");\n' +
            'if (parseCompareElementsPosNear2 === null) { throw \'"b" not found\'; }\n',
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkCompareElementsPositionNear(x, func) {
    checkCompareElementsPositionNearInner(x, func, '', '');
}

function checkCompareElementsPositionNearFalse(x, func) {
    checkCompareElementsPositionNearInner(
        x,
        func,
        'try {\n',
        '\n} catch(e) { return; } throw "assert didn\'t fail";',
    );
}

function checkCompareElementsPropertyInner(x, func, before, after) {
    x.assert(
        func('("a", "b", ())'),
        {'error': 'unexpected `()`: tuples need at least one argument'},
    );
    x.assert(
        func('("a", "b", (1))'),
        {'error': 'expected third argument to be an array of string, found a tuple'},
    );
    x.assert(func('"a"'), {'error': 'expected a tuple, found `"a"`'});
    x.assert(func('1'), {'error': 'expected a tuple, found `1`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('[]'), {'error': 'expected a tuple, found `[]`'});
    x.assert(func('("a")'), {'error': 'expected 3 elements in the tuple, found 1 element'});
    x.assert(func('("a", 1, [])'),
        {'error': 'expected second argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('(1, "a", [])'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('((), "a", [])'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a tuple'},
    );
    x.assert(func('("a", "a", "b", "c")'), {
        'error': 'expected 3 elements in the tuple, found 4 elements',
    });
    x.assert(func('("a", "b", 1)'), {
        'error': 'expected third argument to be an array of string, found a number',
    });

    x.assert(func('("a", "b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsProp1 = await page.$("a");\n' +
            'if (parseCompareElementsProp1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsProp2 = await page.$("b");\n' +
            'if (parseCompareElementsProp2 === null) { throw \'"b" not found\'; }\n' +
            'const parseCompareElementsProps = ["margin"];\n' +
            'for (const property of parseCompareElementsProps) {\n' +
            before +
            'const value = await parseCompareElementsProp1.evaluateHandle((e, p) => {\n' +
            'return String(e[p]);\n' +
            '}, property);\n' +
            'await parseCompareElementsProp2.evaluate((e, v, p) => {\n' +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
            '}, value, property);\n' +
            after +
            '}',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Xpath
    x.assert(func('("//a", "b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsProp1 = await page.$x("//a");\n' +
            'if (parseCompareElementsProp1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsProp1 = parseCompareElementsProp1[0];\n' +
            'let parseCompareElementsProp2 = await page.$("b");\n' +
            'if (parseCompareElementsProp2 === null) { throw \'"b" not found\'; }\n' +
            'const parseCompareElementsProps = ["margin"];\n' +
            'for (const property of parseCompareElementsProps) {\n' +
            before +
            'const value = await parseCompareElementsProp1.evaluateHandle((e, p) => {\n' +
            'return String(e[p]);\n' +
            '}, property);\n' +
            'await parseCompareElementsProp2.evaluate((e, v, p) => {\n' +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
            '}, value, property);\n' +
            after +
            '}',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "//b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsProp1 = await page.$("a");\n' +
            'if (parseCompareElementsProp1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsProp2 = await page.$x("//b");\n' +
            'if (parseCompareElementsProp2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsProp2 = parseCompareElementsProp2[0];\n' +
            'const parseCompareElementsProps = ["margin"];\n' +
            'for (const property of parseCompareElementsProps) {\n' +
            before +
            'const value = await parseCompareElementsProp1.evaluateHandle((e, p) => {\n' +
            'return String(e[p]);\n' +
            '}, property);\n' +
            'await parseCompareElementsProp2.evaluate((e, v, p) => {\n' +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
            '}, value, property);\n' +
            after +
            '}',
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "//b", ["margin"])'), {
        'instructions': [
            'let parseCompareElementsProp1 = await page.$x("//a");\n' +
            'if (parseCompareElementsProp1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsProp1 = parseCompareElementsProp1[0];\n' +
            'let parseCompareElementsProp2 = await page.$x("//b");\n' +
            'if (parseCompareElementsProp2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsProp2 = parseCompareElementsProp2[0];\n' +
            'const parseCompareElementsProps = ["margin"];\n' +
            'for (const property of parseCompareElementsProps) {\n' +
            before +
            'const value = await parseCompareElementsProp1.evaluateHandle((e, p) => {\n' +
            'return String(e[p]);\n' +
            '}, property);\n' +
            'await parseCompareElementsProp2.evaluate((e, v, p) => {\n' +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
            '}, value, property);\n' +
            after +
            '}',
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a"\n, "b", \n1)'), {
        'error': 'expected third argument to be an array of string, found a number',
    });
    x.assert(func('("a",\n "b",\n [\n"margin"])'), {
        'instructions': [
            'let parseCompareElementsProp1 = await page.$("a");\n' +
            'if (parseCompareElementsProp1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsProp2 = await page.$("b");\n' +
            'if (parseCompareElementsProp2 === null) { throw \'"b" not found\'; }\n' +
            'const parseCompareElementsProps = [\n"margin"];\n' +
            'for (const property of parseCompareElementsProps) {\n' +
            before +
            'const value = await parseCompareElementsProp1.evaluateHandle((e, p) => {\n' +
            'return String(e[p]);\n' +
            '}, property);\n' +
            'await parseCompareElementsProp2.evaluate((e, v, p) => {\n' +
            'if (v !== String(e[p])) {\n' +
            'throw p + ": `" + v + "` !== `" + String(e[p]) + "`";\n' +
            '}\n' +
            '}, value, property);\n' +
            after +
            '}',
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkCompareElementsProperty(x, func) {
    checkCompareElementsPropertyInner(x, func, '', '');
}

function checkCompareElementsPropertyFalse(x, func) {
    checkCompareElementsPropertyInner(
        x,
        func,
        'try {\n',
        '} catch(e) { continue; } throw "assert didn\'t fail";\n',
    );
}

function checkCompareElementsTextInner(x, func, before, after) {
    x.assert(func('"a"'), {'error': 'expected a tuple of CSS selector/XPath, found `"a"`'});
    x.assert(func('1'), {'error': 'expected a tuple of CSS selector/XPath, found `1`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('[]'), {'error': 'expected a tuple of CSS selector/XPath, found `[]`'});
    x.assert(func('("a")'), {'error': 'expected 2 CSS selectors/XPathes, found 1 element'});
    x.assert(func('("a", 1)'),
        {'error': 'expected second argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('(1, "a")'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a number'},
    );
    x.assert(func('((), "a")'),
        {'error': 'expected first argument to be a CSS selector or an XPath, found a tuple'},
    );
    x.assert(func('("a", "a", "b", "c")'), {
        'error': 'expected 2 CSS selectors/XPathes, found 4 elements',
    });
    x.assert(func('("a", "b", 1)'), {
        'error': 'expected 2 CSS selectors/XPathes, found 3 elements',
    });

    x.assert(func('("a", "b")'), {
        'instructions': [
            'let parseCompareElementsText1 = await page.$("a");\n' +
            'if (parseCompareElementsText1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsText2 = await page.$("b");\n' +
            'if (parseCompareElementsText2 === null) { throw \'"b" not found\'; }\n' +
            before +
            'await page.evaluate((e1, e2) => {\n' +
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
            '}\n}, parseCompareElementsText1, parseCompareElementsText2);' + after,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("//a", "b")'), {
        'instructions': [
            'let parseCompareElementsText1 = await page.$x("//a");\n' +
            'if (parseCompareElementsText1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsText1 = parseCompareElementsText1[0];\n' +
            'let parseCompareElementsText2 = await page.$("b");\n' +
            'if (parseCompareElementsText2 === null) { throw \'"b" not found\'; }\n' +
            before +
            'await page.evaluate((e1, e2) => {\n' +
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
            '}\n}, parseCompareElementsText1, parseCompareElementsText2);' + after,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", "//b")'), {
        'instructions': [
            'let parseCompareElementsText1 = await page.$("a");\n' +
            'if (parseCompareElementsText1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsText2 = await page.$x("//b");\n' +
            'if (parseCompareElementsText2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsText2 = parseCompareElementsText2[0];\n' +
            before +
            'await page.evaluate((e1, e2) => {\n' +
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
            '}\n}, parseCompareElementsText1, parseCompareElementsText2);' + after,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", "//b")'), {
        'instructions': [
            'let parseCompareElementsText1 = await page.$x("//a");\n' +
            'if (parseCompareElementsText1.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCompareElementsText1 = parseCompareElementsText1[0];\n' +
            'let parseCompareElementsText2 = await page.$x("//b");\n' +
            'if (parseCompareElementsText2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseCompareElementsText2 = parseCompareElementsText2[0];\n' +
            before +
            'await page.evaluate((e1, e2) => {\n' +
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
            '}\n}, parseCompareElementsText1, parseCompareElementsText2);' + after,
        ],
        'wait': false,
        'checkResult': true,
    });

    // Multiline
    x.assert(func('("a"\n,\n "b", 1)'), {
        'error': 'expected 2 CSS selectors/XPathes, found 3 elements',
    });
    x.assert(func('("a"\n, \n"b")'), {
        'instructions': [
            'let parseCompareElementsText1 = await page.$("a");\n' +
            'if (parseCompareElementsText1 === null) { throw \'"a" not found\'; }\n' +
            'let parseCompareElementsText2 = await page.$("b");\n' +
            'if (parseCompareElementsText2 === null) { throw \'"b" not found\'; }\n' +
            before +
            'await page.evaluate((e1, e2) => {\n' +
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
            '}\n}, parseCompareElementsText1, parseCompareElementsText2);' + after,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkCompareElementsText(x, func) {
    checkCompareElementsTextInner(x, func, '', '');
}

function checkCompareElementsTextFalse(x, func) {
    checkCompareElementsTextInner(
        x,
        func,
        'try {\n',
        '\n} catch(e) { return; } throw "assert didn\'t fail";',
    );
}

function checkCss(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` or `,` after `"b"`'});
    x.assert(func('("a")'), {
        'error': 'expected `("CSS selector" or "XPath", "CSS property name", "CSS property value"' +
            ')` or `("CSS selector" or "XPath", [JSON object])`',
    });
    x.assert(func('("a", )'), {
        'error': 'expected `("CSS selector" or "XPath", "CSS property name", "CSS property value"' +
            ')` or `("CSS selector" or "XPath", [JSON object])`',
    });
    x.assert(func('("a", "b", )'), {
        'error': 'expected json as second argument (since there are only two arguments), found a ' +
            'string',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", )'), {
        'error': 'expected `("CSS selector" or "XPath", "CSS property name", "CSS property value"' +
            ')` or `("CSS selector" or "XPath", [JSON object])`',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('("a", "b")'), {
        'error': 'expected json as second argument (since there are only two arguments), found ' +
            'a string',
    });
    x.assert(func('("a", "", "c")'), {'error': 'attribute name (second argument) cannot be empty'});

    x.assert(func('("a", "b", "c")'), {
        'instructions': [
            'let parseCssElem = await page.$("a");\n' +
            'if (parseCssElem === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.style["b"] = "c";\n' +
            '}, parseCssElem);',
        ],
    });
    x.assert(func('("a", "\\"b", "c")'), {
        'instructions': [
            'let parseCssElem = await page.$("a");\n' +
            'if (parseCssElem === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.style["\\"b"] = "c";\n' +
            '}, parseCssElem);',
        ],
    });
    x.assert(func('("a", {"b": "c"})'), {
        'instructions': [
            'let parseCssElemJson = await page.$("a");\n' +
            'if (parseCssElemJson === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.style["b"] = "c";\n' +
            '}, parseCssElemJson);',
        ],
    });
    x.assert(func('("a", {"b": "c", "d": "e"})'), {
        'instructions': [
            'let parseCssElemJson = await page.$("a");\n' +
            'if (parseCssElemJson === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.style["b"] = "c";\n' +
            '}, parseCssElemJson);\n' +
            'await page.evaluate(e => {\n' +
            'e.style["d"] = "e";\n' +
            '}, parseCssElemJson);',
        ],
    });

    // XPath
    x.assert(func('("/a", "b", "c")'), { 'error': 'XPath must start with `//`'});
    x.assert(func('("//a", "b", "c")'), {
        'instructions': [
            'let parseCssElem = await page.$x("//a");\n' +
            'if (parseCssElem.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCssElem = parseCssElem[0];\n' +
            'await page.evaluate(e => {\n' +
            'e.style["b"] = "c";\n' +
            '}, parseCssElem);',
        ],
    });
    x.assert(func('("//a", {"b": "c"})'), {
        'instructions': [
            'let parseCssElemJson = await page.$x("//a");\n' +
            'if (parseCssElemJson.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseCssElemJson = parseCssElemJson[0];\n' +
            'await page.evaluate(e => {\n' +
            'e.style["b"] = "c";\n' +
            '}, parseCssElemJson);',
        ],
    });

    // Multiline
    x.assert(func('("a", \n""\n, "c")'), {
        'error': 'attribute name (second argument) cannot be empty',
    });
    x.assert(func('("a", \n"b", \n"c")'), {
        'instructions': [
            'let parseCssElem = await page.$("a");\n' +
            'if (parseCssElem === null) { throw \'"a" not found\'; }\n' +
            'await page.evaluate(e => {\n' +
            'e.style["b"] = "c";\n' +
            '}, parseCssElem);',
        ],
    });
}

function checkDebug(x, func) {
    x.assert(func('hello'), {'error': 'expected `true` or `false` value, found `hello`'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'expected `true` or `false` value, found `tru`'});
    x.assert(func('false'), {
        'instructions': [
            'if (arg && arg.debug_log && arg.debug_log.setDebugEnabled) {\n' +
            'arg.debug_log.setDebugEnabled(false);\n' +
            '} else {\n' +
            'throw "`debug` command needs an object with a `debug_log` field of `Debug` type!";\n}',
        ],
        'wait': false,
    });
    x.assert(func('true'), {
        'instructions': [
            'if (arg && arg.debug_log && arg.debug_log.setDebugEnabled) {\n' +
            'arg.debug_log.setDebugEnabled(true);\n' +
            '} else {\n' +
            'throw "`debug` command needs an object with a `debug_log` field of `Debug` type!";\n}',
        ],
        'wait': false,
    });
}

function checkDragAndDrop(x, func) {
    // check tuple argument
    x.assert(func('true'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector or an XPath, found `true`',
    });
    x.assert(func('(true)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector or an XPath',
    });
    x.assert(func('(1,2)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector or an XPath, found `1`',
    });
    x.assert(func('(1,2,3)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector or an XPath',
    });
    x.assert(func('("a",2)'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector or an XPath, found `2`',
    });
    x.assert(func('(1,"a")'), {
        'error': 'expected tuple with two elements being either a position `(x, y)` or a CSS ' +
            'selector or an XPath, found `1`',
    });
    x.assert(func('((1,2,3),"a")'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,2,3)`',
    });
    x.assert(func('((1,"a"),"a")'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,"a")`',
    });
    x.assert(func('((1,2),"")'), {
        'error': 'CSS selector (second argument) cannot be empty',
        'isXPath': false,
    });
    x.assert(func('("", (1,2))'), {
        'error': 'CSS selector (first argument) cannot be empty',
        'isXPath': false,
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

    x.assert(func('((1,2),"a")'), {
        'instructions': [
            'const start = [1, 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'let parseDragAndDropElem2 = await page.$("a");\n' +
            'if (parseDragAndDropElem2 === null) { throw \'"a" not found\'; }\n' +
            'const parseDragAndDropElem2_box = await parseDragAndDropElem2.boundingBox();\n' +
            'const end = [parseDragAndDropElem2_box.x + ' +
            'parseDragAndDropElem2_box.width / 2, parseDragAndDropElem2_box.y + ' +
            'parseDragAndDropElem2_box.height / 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });
    x.assert(func('("a", (1,2))'), {
        'instructions': [
            'let parseDragAndDropElem = await page.$("a");\n' +
            'if (parseDragAndDropElem === null) { throw \'"a" not found\'; }\n' +
            'const parseDragAndDropElem_box = await parseDragAndDropElem.boundingBox();\n' +
            'const start = [parseDragAndDropElem_box.x + ' +
            'parseDragAndDropElem_box.width / 2, parseDragAndDropElem_box.y + ' +
            'parseDragAndDropElem_box.height / 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'const end = [1, 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });
    x.assert(func('("a", "b")'), {
        'instructions': [
            'let parseDragAndDropElem = await page.$("a");\n' +
            'if (parseDragAndDropElem === null) { throw \'"a" not found\'; }\n' +
            'const parseDragAndDropElem_box = await parseDragAndDropElem.boundingBox();\n' +
            'const start = [parseDragAndDropElem_box.x + parseDragAndDropElem_box.width / 2, ' +
            'parseDragAndDropElem_box.y + parseDragAndDropElem_box.height / 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'let parseDragAndDropElem2 = await page.$("b");\n' +
            'if (parseDragAndDropElem2 === null) { throw \'"b" not found\'; }\n' +
            'const parseDragAndDropElem2_box = await parseDragAndDropElem2.boundingBox();\n' +
            'const end = [parseDragAndDropElem2_box.x + parseDragAndDropElem2_box.width / 2, ' +
            'parseDragAndDropElem2_box.y + parseDragAndDropElem2_box.height / 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });

    // XPath
    x.assert(func('("/a",(1,2))'), { 'error': 'XPath must start with `//`'});
    x.assert(func('((1,2),"//a")'), {
        'instructions': [
            'const start = [1, 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'let parseDragAndDropElem2 = await page.$x("//a");\n' +
            'if (parseDragAndDropElem2.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseDragAndDropElem2 = parseDragAndDropElem2[0];\n' +
            'const parseDragAndDropElem2_box = await parseDragAndDropElem2.boundingBox();\n' +
            'const end = [parseDragAndDropElem2_box.x + ' +
            'parseDragAndDropElem2_box.width / 2, parseDragAndDropElem2_box.y + ' +
            'parseDragAndDropElem2_box.height / 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });
    x.assert(func('("//a", (1,2))'), {
        'instructions': [
            'let parseDragAndDropElem = await page.$x("//a");\n' +
            'if (parseDragAndDropElem.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseDragAndDropElem = parseDragAndDropElem[0];\n' +
            'const parseDragAndDropElem_box = await parseDragAndDropElem.boundingBox();\n' +
            'const start = [parseDragAndDropElem_box.x + parseDragAndDropElem_box.width / 2, ' +
            'parseDragAndDropElem_box.y + parseDragAndDropElem_box.height / 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'const end = [1, 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });
    x.assert(func('("//a", "//b")'), {
        'instructions': [
            'let parseDragAndDropElem = await page.$x("//a");\n' +
            'if (parseDragAndDropElem.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseDragAndDropElem = parseDragAndDropElem[0];\n' +
            'const parseDragAndDropElem_box = await parseDragAndDropElem.boundingBox();\n' +
            'const start = [parseDragAndDropElem_box.x + parseDragAndDropElem_box.width / 2, ' +
            'parseDragAndDropElem_box.y + parseDragAndDropElem_box.height / 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'let parseDragAndDropElem2 = await page.$x("//b");\n' +
            'if (parseDragAndDropElem2.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'parseDragAndDropElem2 = parseDragAndDropElem2[0];\n' +
            'const parseDragAndDropElem2_box = await parseDragAndDropElem2.boundingBox();\n' +
            'const end = [parseDragAndDropElem2_box.x + parseDragAndDropElem2_box.width / 2, ' +
            'parseDragAndDropElem2_box.y + parseDragAndDropElem2_box.height / 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });

    // Multiline
    x.assert(func('("a",\n(1,\n-2.0))'), {
        'error': 'expected integer for Y position, found float: `-2.0`',
    });
    x.assert(func('((1\n,2),\n"a")'), {
        'instructions': [
            'const start = [1, 2];\n' +
            'await page.mouse.move(start[0], start[1]);\n' +
            'await page.mouse.down();',
            'let parseDragAndDropElem2 = await page.$("a");\n' +
            'if (parseDragAndDropElem2 === null) { throw \'"a" not found\'; }\n' +
            'const parseDragAndDropElem2_box = await parseDragAndDropElem2.boundingBox();\n' +
            'const end = [parseDragAndDropElem2_box.x + ' +
            'parseDragAndDropElem2_box.width / 2, parseDragAndDropElem2_box.y + ' +
            'parseDragAndDropElem2_box.height / 2];\n' +
            'await page.mouse.move(end[0], end[1]);\n' +
            'await page.mouse.up();',
        ],
    });
}

function checkEmulate(x, func) {
    x.assert(func(''), {'error': 'expected string for "device name", found nothing'});
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
    x.assert(func(''), {'error': 'expected `true` or `false` value, found nothing'});
    x.assert(func('hello'), {'error': 'expected `true` or `false` value, found `hello`'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'expected `true` or `false` value, found `tru`'});
    x.assert(func('false'), {'instructions': ['arg.expectedToFail = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.expectedToFail = true;'], 'wait': false});
}

function checkFailOnJsError(x, func) {
    x.assert(func(''), {'error': 'expected `true` or `false` value, found nothing'});
    x.assert(func('hello'), {'error': 'expected `true` or `false` value, found `hello`'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'expected `true` or `false` value, found `tru`'});
    x.assert(func('false'), {
        'instructions': [
            'const oldValue = arg.failOnJsError;\n' +
            'arg.failOnJsError = false;\n' +
            'if (oldValue !== true) {\n' +
            '    arg.jsErrors.splice(0, arg.jsErrors.length);\n' +
            '}',
        ],
        'wait': false,
    });
    x.assert(func('true'), {
        'instructions': [
            'const oldValue = arg.failOnJsError;\n' +
            'arg.failOnJsError = true;\n' +
            'if (oldValue !== true) {\n' +
            '    arg.jsErrors.splice(0, arg.jsErrors.length);\n' +
            '}',
        ],
        'wait': false,
    });
}

function checkFocus(x, func) {
    x.assert(func('a'), {'error': 'expected a CSS selector or an XPath, found `a`'});
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });
    x.assert(func('"a"'), {'instructions': ['await page.focus("a");']});
    x.assert(func('\'a\''), {'instructions': ['await page.focus("a");']});
    x.assert(func('\'"a\''), {'instructions': ['await page.focus("\\"a");']});

    // XPath
    x.assert(func('"/a"'), { 'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'), {
        'instructions': [
            'let parseFocusVar = await page.$x("//a");\n' +
            'if (parseFocusVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseFocusVar = parseFocusVar[0];\n' +
            'await parseFocusVar.focus();',
        ],
    });
}

function checkFontSize(x, func) {
    x.assert(func(''), {'error': 'expected a font size (in pixels), found nothing'});
    x.assert(func('hello'), {'error': 'expected a font size (in pixels), found `hello`'});
    x.assert(func('"12"'), {'error': 'expected a font size (in pixels), found `"12"`'});
    x.assert(func('tru'), {'error': 'expected a font size (in pixels), found `tru`'});
    x.assert(func('12'), {
        'instructions': [
            'const client = await page.target().createCDPSession();\n' +
            'await client.send("Page.enable");\n' +
            'await client.send("Page.setFontSizes", {\n' +
                'fontSizes: {\n' +
                    'standard: 12,\n' +
                    'fixed: 12,\n' +
                '}\n' +
            '});',
        ],
    });
}

function checkGeolocation(x, func) {
    x.assert(func(''), {
        'error': 'expected (longitude [number], latitude [number]), found nothing',
    });
    x.assert(func('"a"'), {
        'error': 'expected (longitude [number], latitude [number]), found `"a"`',
    });
    x.assert(func('("a", "b")'), {
        'error': 'expected number for longitude (first argument), found `"a"`',
    });
    x.assert(func('("12", 13)'), {
        'error': 'expected number for longitude (first argument), found `"12"`',
    });
    x.assert(func('(12, "13")'), {
        'error': 'expected number for latitude (second argument), found `"13"`',
    });

    x.assert(func('(12, 13)'), {'instructions': ['await page.setGeolocation(12, 13);']});

    // Multiline
    x.assert(func('(12\n,\n "13")'), {
        'error': 'expected number for latitude (second argument), found `"13"`',
    });
    x.assert(func('(12\n,\n 13)'), {'instructions': ['await page.setGeolocation(12, 13);']});
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

function checkHistoryInner(x, func, name) {
    // check tuple argument
    x.assert(func(''), {
        'instructions': [
            `const ret = page.go${name}({'waitUntil': 'domcontentloaded', ` +
                '\'timeout\': 30000});\n' +
            'if (ret === null) {\n' +
            `throw "cannot go ${name.toLowerCase()} in history";\n` +
            '}\n' +
            'await ret;',
        ],
    });
    x.assert(func('"a"'), {'error': 'expected either [integer] or no arguments, found a string'});
    x.assert(func('12'), {
        'instructions': [
            `const ret = page.go${name}({'waitUntil': 'domcontentloaded', ` +
                '\'timeout\': 12});\n' +
            'if (ret === null) {\n' +
            `throw "cannot go ${name.toLowerCase()} in history";\n` +
            '}\n' +
            'await ret;',
        ],
    });
    x.assert(func('12 24'), {'error': 'expected nothing, found `2` after `12`'});
    x.assert(func('0'), {
        'instructions': [
            `const ret = page.go${name}({'waitUntil': 'domcontentloaded', ` +
                '\'timeout\': 0});\n' +
            'if (ret === null) {\n' +
            `throw "cannot go ${name.toLowerCase()} in history";\n` +
            '}\n' +
            'await ret;',
        ],
        'warnings': 'You passed 0 as timeout, it means the timeout has been disabled on ' +
            `this history-go-${name.toLowerCase()}`,
    });
    x.assert(func('-12'), {'error': 'timeout cannot be negative: `-12`'});
    x.assert(func('-12.0'), {'error': 'expected integer for timeout, found float: `-12.0`'});
    x.assert(func('12.0'), {'error': 'expected integer for timeout, found float: `12.0`'});
}

function checkHistoryGoBack(x, func) {
    checkHistoryInner(x, func, 'Back');
}

function checkHistoryGoForward(x, func) {
    checkHistoryInner(x, func, 'Forward');
}

function checkJavascript(x, func) {
    x.assert(func(''), {'error': 'expected `true` or `false` value, found nothing'});
    x.assert(func('"a"'), {'error': 'expected `true` or `false` value, found `"a"`'});
    x.assert(func('true'), {
        'instructions': [
            'await page.setJavaScriptEnabled(true);',
        ],
    });
}

function checkLocalStorage(x, func) {
    x.assert(func('hello'), {'error': 'expected JSON, found `hello`'});
    x.assert(func('{').error !== undefined); // JSON syntax error
    x.assert(func('{"a": x}'), {'error': 'Only `null` ident is allowed, found `x`'});

    x.assert(func('{"a": 1}'), {
        'instructions': [
            'await page.evaluate(() => {\n' +
            'localStorage.setItem("a", "1");\n' +
            '})',
        ],
    });
    x.assert(func('{"a": "1"}'), {
        'instructions': [
            'await page.evaluate(() => {\n' +
            'localStorage.setItem("a", "1");\n' +
            '})',
        ],
    });
    x.assert(func('{"a": "1", "b": "2px"}'), {
        'instructions': [
            'await page.evaluate(() => {\n' +
            'localStorage.setItem("a", "1");\n' +
            'localStorage.setItem("b", "2px");\n' +
            '})',
        ],
    });
    x.assert(func('{"a": "1"}'), {
        'instructions': [
            'await page.evaluate(() => {\n' +
            'localStorage.setItem("a", "1");\n' +
            '})',
        ],
    });
    x.assert(func('{"a": null}'), {
        'instructions': [
            'await page.evaluate(() => {\n' +
            'localStorage.removeItem("a");\n' +
            '})',
        ],
    });

    // Multiline
    x.assert(func('{"a"\n: \n"1"}'), {
        'instructions': [
            'await page.evaluate(() => {\n' +
            'localStorage.setItem("a", "1");\n' +
            '})',
        ],
    });
}

function checkMoveCursorTo(x, func) {
    // Check position
    x.assert(func('hello'), {
        'error': 'expected a position or a CSS selector or an XPath, found `hello`',
    });
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,)`',
    });
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(a,2)`',
    });
    x.assert(func('(-1,2)'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('(1,-2)'), {'error': 'Y position cannot be negative: `-2`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for X position, found float: `1.0`'});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for X position, found float: `-1.0`'});
    x.assert(func('(2,1.0)'), {'error': 'expected integer for Y position, found float: `1.0`'});
    x.assert(func('(2,-1.0)'), {'error': 'expected integer for Y position, found float: `-1.0`'});

    x.assert(func('(1,2,)'), {'instructions': ['await page.mouse.move(1, 2);']});
    x.assert(func('(1,2)'), {'instructions': ['await page.mouse.move(1, 2);']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });
    x.assert(func('"a"'), {'instructions': ['await page.hover("a");']});
    x.assert(func('\'a\''), {'instructions': ['await page.hover("a");']});
    x.assert(func('\'"a\''), {'instructions': ['await page.hover("\\"a");']});

    // XPath
    x.assert(func('"/a"'), { 'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'), {
        'instructions': [
            'let parseMoveCursorToVar = await page.$x("//a");\n' +
            'if (parseMoveCursorToVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseMoveCursorToVar = parseMoveCursorToVar[0];\n' +
            'await parseMoveCursorToVar.hover();',
        ],
    });

    // Multiline
    x.assert(func('(\n-1\n,2)'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('(1\n,\n2)'), {'instructions': ['await page.mouse.move(1, 2);']});
}

function checkParseContent(x, func) {
    x.assert(func(''), []);
    x.assert(func('// just a comment'), []);
    x.assert(func('  // just a comment'), []);
    x.assert(func('a: '), [{'error': 'Unknown command "a"', 'line': 1}]);
    x.assert(func(':'), [{'error': 'Unexpected `:` when parsing command', 'line': 1}]);

    x.assert(func('goto: file:///home'), [
        {
            'fatal_error': true,
            'original': 'goto: file:///home',
            'line_number': 1,
            'instructions': [
                'await page.goto("file:///home");',
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
    ]);
    x.assert(func('focus: "#foo"'), [{
        'error': 'First command must be `goto` (`debug`, `emulate`, `fail`, `fail-on-js-error`, ' +
            '`javascript`, `screenshot-comparison`, `store-value` or `timeout` can be used ' +
            'before)!',
        'line': 1,
    }]);
    x.assert(func('fail: true\ngoto: file:///home'), [
        {
            'fatal_error': false,
            'wait': false,
            'original': 'fail: true',
            'line_number': 1,
            'instructions': ['arg.expectedToFail = true;'],
        },
        {
            'fatal_error': true,
            'original': 'goto: file:///home',
            'line_number': 2,
            'instructions': [
                'await page.goto("file:///home");',
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
    ]);
    x.assert(func('goto: file:///home\nreload:\ngoto: file:///home'), [
        {
            'fatal_error': true,
            'original': 'goto: file:///home',
            'line_number': 1,
            'instructions': [
                'await page.goto("file:///home");',
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
        {
            'fatal_error': false,
            'original': 'reload:',
            'line_number': 2,
            'instructions': [`\
const ret = page.reload({'waitUntil': 'domcontentloaded', 'timeout': 30000});
await ret;`,
            ],
        },
        {
            'fatal_error': true,
            'original': 'goto: file:///home',
            'line_number': 3,
            'instructions': [
                'await page.goto("file:///home");',
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
    ]);
    x.assert(func('// just a comment\na: b'), [{'error': 'Unknown command "a"', 'line': 2}]);
    x.assert(func('goto: file:///home\nemulate: "test"'), [
        {
            'fatal_error': true,
            'original': 'goto: file:///home',
            'line_number': 1,
            'instructions': [
                'await page.goto("file:///home");',
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
        {
            'error': 'Command emulate must be used before first goto!',
            'line': 2,
        },
    ]);
    x.assert(func('goto: file:///home\nassert-text: ("a", "b")'), [
        {
            'fatal_error': true,
            'original': 'goto: file:///home',
            'line_number': 1,
            'instructions': [
                'await page.goto("file:///home");',
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
        {
            'fatal_error': false,
            'wait': false,
            'checkResult': true,
            'original': 'assert-text: ("a", "b")',
            'line_number': 2,
            'instructions': [`\
let parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw '"a" not found'; }
await page.evaluate(e => {
    const errors = [];
    const value = "b";
    if (!browserUiTestHelpers.compareElemText(e, value)) {
        errors.push("\`" + getElemText(e, value) + "\` isn't equal to \`" + value + "\`");
    }
    if (errors.length !== 0) {
        const errs = errors.join(", ");
        throw "The following errors happened: [" + errs + "]";
    }
}, parseAssertElemStr);`,
            ],
        },
    ]);
}

function checkPauseOnError(x, func) {
    x.assert(func('hello'), {'error': 'expected `true` or `false` value, found `hello`'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'expected `true` or `false` value, found `tru`'});
    x.assert(func('false'), {
        'instructions': [
            'arg.pauseOnError = false;',
        ],
        'wait': false,
    });
    x.assert(func('true'), {
        'instructions': [
            'arg.pauseOnError = true;',
        ],
        'wait': false,
    });
}

function checkPermissions(x, func) {
    x.assert(func(''), {'error': 'expected an array of strings, found nothing'});
    x.assert(func('"a"'), {'error': 'expected an array of strings, found `"a"`'});
    x.assert(func('("a", "b")'), {'error': 'expected an array of strings, found `("a", "b")`'});
    x.assert(func('["12", 13]'), {
        'error': 'all array\'s elements must be of the same kind: expected array of `string` ' +
            '(because the first element is of this kind), found `number` at position 1',
    });
    x.assert(func('[12, "13"]'), {
        'error': 'all array\'s elements must be of the same kind: expected array of `number` ' +
            '(because the first element is of this kind), found `string` at position 1',
    });
    x.assert(func('["12"]'), {
        'error': '`"12"` is an unknown permission, you can see the list of available permissions ' +
            'with the `--show-permissions` option',
    });

    x.assert(func('["camera", "push"]'), {
        'instructions': [
            'arg.permissions = ["camera", "push"];',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });

    // Multiline
    x.assert(func('[\n"12"\n]'), {
        'error': '`"12"` is an unknown permission, you can see the list of available permissions ' +
            'with the `--show-permissions` option',
    });
    x.assert(func('[\n"camera"\n, "push"]'), {
        'instructions': [
            'arg.permissions = [\n"camera"\n, "push"];',
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    });
}

function checkPressKey(x, func) {
    // check tuple argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` or `,` after `"b"`'});
    x.assert(func('("a")'),
        {'error': 'invalid number of arguments in tuple, expected [string] or [integer] or ' +
                  '([string], [integer]) or ([integer], [integer])'});
    x.assert(func('("a", )'), {
        'error': 'invalid number of arguments in tuple, expected [string] or [integer] or ' +
            '([string], [integer]) or ([integer], [integer])',
    });
    x.assert(func('("a", "b", "c")'),
        {'error': 'invalid number of arguments in tuple, expected [string] or [integer] or ' +
                  '([string], [integer]) or ([integer], [integer])'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('(\'\', "b")'),
        {'error': 'expected an integer as tuple second argument, found a string'});
    x.assert(func('("a", "b")'),
        {'error': 'expected an integer as tuple second argument, found a string'});
    x.assert(func('("", 13)'), {'error': 'key cannot be empty'});
    x.assert(func('("a", 13.2)'), {'error': 'expected integer for delay, found float: `13.2`'});
    x.assert(func('("a", -13.2)'), {'error': 'expected integer for delay, found float: `-13.2`'});
    x.assert(func('("a", -13)'), {'error': 'delay cannot be negative: `-13`'});
    x.assert(func('("a", 13)'), {
        'instructions': [
            'await page.keyboard.press("a", 13)',
        ],
    });
    x.assert(func('(13, "a")'),
        {'error': 'expected an integer as tuple second argument, found a string'});
    x.assert(func('(-13, 13)'), {'error': 'keycode cannot be negative: `-13`'});
    x.assert(func('(-13.2, 13)'), {'error': 'expected integer for keycode, found float: `-13.2`'});
    x.assert(func('(13.2, 13)'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('(13, 13)'), {
        'instructions': [
            'await page.keyboard.press(String.fromCharCode(13), 13)',
        ],
    });

    // check string argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'error': 'key cannot be empty'});
    x.assert(func('"a"'), {'instructions': ['await page.keyboard.press("a")']});
    x.assert(func('\'a\''), {'instructions': ['await page.keyboard.press("a")']});
    x.assert(func('\'"a\''), {'instructions': ['await page.keyboard.press("\\"a")']});

    // check integer argument
    x.assert(func('13.2'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('-13.2'), {'error': 'expected integer for keycode, found float: `-13.2`'});
    x.assert(func('-13'), {'error': 'keycode cannot be negative: `-13`'});
    x.assert(func('13'), {'instructions': ['await page.keyboard.press(String.fromCharCode(13))']});

    // Multiline
    x.assert(func('(\n"a", \n-13)'), {'error': 'delay cannot be negative: `-13`'});
    x.assert(func('(\n13\n, 13)'), {
        'instructions': [
            'await page.keyboard.press(String.fromCharCode(13), 13)',
        ],
    });
}

function checkReload(x, func) {
    // check tuple argument
    x.assert(func(''), {
        'instructions': [
            'const ret = page.reload({\'waitUntil\': \'domcontentloaded\', ' +
                '\'timeout\': 30000});\n' +
            'await ret;',
        ],
    });
    x.assert(func('"a"'), {'error': 'expected either [integer] or no arguments, found a string'});
    x.assert(func('12'), {
        'instructions': [
            'const ret = page.reload({\'waitUntil\': \'domcontentloaded\', ' +
                '\'timeout\': 12});\n' +
            'await ret;',
        ],
    });
    x.assert(func('12 24'), {'error': 'expected nothing, found `2` after `12`'});
    x.assert(func('0'), {
        'instructions': [
            'const ret = page.reload({\'waitUntil\': \'domcontentloaded\', ' +
                '\'timeout\': 0});\n' +
            'await ret;',
        ],
        'warnings': 'You passed 0 as timeout, it means the timeout has been disabled on ' +
            'this reload',
    });
    x.assert(func('-12'), {'error': 'timeout cannot be negative: `-12`'});
    x.assert(func('-12.0'), {'error': 'expected integer for timeout, found float: `-12.0`'});
    x.assert(func('12.0'), {'error': 'expected integer for timeout, found float: `12.0`'});
}

function checkScreenshot(x, func) {
    x.assert(func(''), {'error': 'expected a string or a tuple, found nothing'});
    x.assert(func('hello'), {'error': 'expected a string or a tuple, found `hello`'});
    x.assert(func('"a"'), {
        'instructions': [
            'const screenshotElem = page;\n' +
            'await screenshotElem.screenshot({"path":"a.png","fullPage":true});',
        ],
        'wait': false,
        'infos': ['Generating screenshot into `a.png`'],
    });
    x.assert(func('("a")'), {
        'instructions': [
            'const screenshotElem = page;\n' +
            'await screenshotElem.screenshot({"path":"a.png","fullPage":true});',
        ],
        'wait': false,
        'infos': ['Generating screenshot into `a.png`'],
    });
    x.assert(func('("a", "b")'), {
        'instructions': [
            'let screenshotElem = await page.$("b");\n' +
            'if (screenshotElem === null) { throw \'"b" not found\'; }\n' +
            'await screenshotElem.screenshot({"path":"a.png","fullPage":false});',
        ],
        'wait': false,
        'infos': ['Generating screenshot for CSS selector `b` into `a.png`'],
    });

    // XPath
    x.assert(func('("a", "//b")'), {
        'instructions': [
            'let screenshotElem = await page.$x("//b");\n' +
            'if (screenshotElem.length === 0) { throw \'XPath "//b" not found\'; }\n' +
            'screenshotElem = screenshotElem[0];\n' +
            'await screenshotElem.screenshot({"path":"a.png","fullPage":false});',
        ],
        'wait': false,
        'infos': ['Generating screenshot for XPath `//b` into `a.png`'],
    });
}

function checkScreenshotComparison(x, func) {
    x.assert(func(''), {'error': 'expected boolean or CSS selector or XPath, found nothing'});
    x.assert(func('hello'), {'error': 'expected boolean or CSS selector or XPath, found `hello`'});
    x.assert(func('"true"'), {
        'instructions': ['arg.screenshotComparison = "true";'],
        'wait': false,
        'warnings': '`"true"` is a string and will be used as CSS selector. If you want to ' +
            'set `true` or `false` value, remove quotes.',
    });
    x.assert(func('tru'), {'error': 'expected boolean or CSS selector or XPath, found `tru`'});
    x.assert(func('false'), {'instructions': ['arg.screenshotComparison = false;'], 'wait': false});
    x.assert(func('true'), {'instructions': ['arg.screenshotComparison = true;'], 'wait': false});
    x.assert(func('\'\''), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });
    x.assert(func('"test"'), {
        'instructions': ['arg.screenshotComparison = "test";'],
        'wait': false,
    });

    // XPath
    x.assert(func('"/a"'), { 'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'), {'instructions': ['arg.screenshotComparison = "//a";'], 'wait': false});
}

function checkScrollTo(x, func) {
    // Check position
    x.assert(func('hello'), {
        'error': 'expected a position or a CSS selector or an XPath, found `hello`',
    });
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,)`',
    });
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(a,2)`',
    });
    x.assert(func('(-1,2)'), {'error': 'X position cannot be negative: `-1`'});
    x.assert(func('(1,-2)'), {'error': 'Y position cannot be negative: `-2`'});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for X position, found float: `-1.0`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for X position, found float: `1.0`'});
    x.assert(func('(2,-1.0)'), {'error': 'expected integer for Y position, found float: `-1.0`'});
    x.assert(func('(2,1.0)'), {'error': 'expected integer for Y position, found float: `1.0`'});
    x.assert(func('(1,2)'), {'instructions': ['await page.mouse.move(1, 2);']});


    x.assert(func('(1,2,)'), {'instructions': ['await page.mouse.move(1, 2);']});

    // Check css selector
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });
    x.assert(func('"a"'), {'instructions': ['await page.hover("a");']});
    x.assert(func('\'a\''), {'instructions': ['await page.hover("a");']});
    x.assert(func('\'"a\''), {'instructions': ['await page.hover("\\"a");']});

    // XPath
    x.assert(func('"/a"'), { 'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'), {
        'instructions': [
            'let parseMoveCursorToVar = await page.$x("//a");\n' +
            'if (parseMoveCursorToVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseMoveCursorToVar = parseMoveCursorToVar[0];\n' +
            'await parseMoveCursorToVar.hover();',
        ],
    });

    // Multiline
    x.assert(func('(a,\n2\n)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(a,\n2\n)`',
    });
    x.assert(func('(1\n,\n2)'), {'instructions': ['await page.mouse.move(1, 2);']});
}

function checkShowText(x, func) {
    x.assert(func('hello'), {'error': 'expected `true` or `false` value, found `hello`'});
    x.assert(func('"true"'), {'error': 'expected `true` or `false` value, found `"true"`'});
    x.assert(func('tru'), {'error': 'expected `true` or `false` value, found `tru`'});
    x.assert(func('false'), {
        'instructions': [
            'arg.showText = false;',
            'await page.evaluate(() => {\n' +
            'window.browserUiCreateNewStyleElement(\'* { color: ' +
            'rgba(0,0,0,0) !important; }\', \'browser-ui-test-style-text-hide\');\n' +
            '});',
        ],
    });
    x.assert(func('true'), {
        'instructions': [
            'arg.showText = true;',
            'await page.evaluate(() => {\n' +
            'let tmp = document.getElementById(\'browser-ui-test-style-text-hide\');\n' +
            'if (tmp) { tmp.remove(); }\n' +
            '});',
        ],
    });
}

function checkSize(x, func) {
    x.assert(func(''), {'error': 'expected `([number], [number])`, found nothing'});
    x.assert(func('hello'), {'error': 'expected `([number], [number])`, found `hello`'});
    x.assert(func('()'), {'error': 'unexpected `()`: tuples need at least one argument'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1)`',
    });
    x.assert(func('(1,)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(1,)`',
    });
    x.assert(func('(1,,2)'), {'error': 'unexpected `,` after `,`'});
    x.assert(func('(,2)'), {'error': 'unexpected `,` as first element'});
    x.assert(func('(a,2)'), {
        'error': 'invalid syntax: expected "([number], [number])", found `(a,2)`',
    });
    x.assert(func('(-1,2)'), {'error': 'width cannot be negative: `-1`'});
    x.assert(func('(1,-2)'), {'error': 'height cannot be negative: `-2`'});
    x.assert(func('(1.0,2)'), {'error': 'expected integer for width, found float: `1.0`'});
    x.assert(func('(-1.0,2)'), {'error': 'expected integer for width, found float: `-1.0`'});
    x.assert(func('(1,2.0)'), {'error': 'expected integer for height, found float: `2.0`'});
    x.assert(func('(1,-2.0)'), {'error': 'expected integer for height, found float: `-2.0`'});
    x.assert(func('(1,2)'), {'instructions': ['await page.setViewport({width: 1, height: 2})']});

    x.assert(func('(1,2,)'), {'instructions': ['await page.setViewport({width: 1, height: 2})']});
    // Multiline
    x.assert(func('(1,\n-2.0)'), {'error': 'expected integer for height, found float: `-2.0`'});
    x.assert(func('(1\n,2)'), {'instructions': ['await page.setViewport({width: 1, height: 2})']});
}

function checkStoreProperty(x, func) {
    x.assert(func(''), {'error': 'expected a tuple, found nothing'});
    x.assert(func('hello'), {'error': 'expected a tuple, found `hello`'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {'error': 'expected 3 elements in the tuple, found 1 element'});
    x.assert(func('(1, 1, 1)'), {
        'error': 'expected first argument to be an ident, found a number (`1`)',
    });
    x.assert(func('(a, 1, 1)'), {
        'error': 'expected second argument to be a string, found a number (`1`)',
    });
    x.assert(func('(a, "1", 1)'), {
        'error': 'expected third argument to be a CSS selector or an XPath, found a number (`1`)',
    });
    x.assert(func('(VAR, \'\', "b")'), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });

    x.assert(func('(VAR, "a", "b")'), {
        'instructions': [`\
let parseStoreProperty = await page.$("a");
if (parseStoreProperty === null) { throw '"a" not found'; }
const jsHandle = await parseStoreProperty.evaluateHandle((e, p) => {
    return String(e[p]);
}, "b");
arg.variables["VAR"] = await jsHandle.jsonValue();`,
        ],
        'wait': false,
    });
    x.assert(func('(VAR, "//a", "b")'), {
        'instructions': [`\
let parseStoreProperty = await page.$x("//a");
if (parseStoreProperty.length === 0) { throw 'XPath "//a" not found'; }
parseStoreProperty = parseStoreProperty[0];
const jsHandle = await parseStoreProperty.evaluateHandle((e, p) => {
    return String(e[p]);
}, "b");
arg.variables["VAR"] = await jsHandle.jsonValue();`,
        ],
        'wait': false,
    });

    x.assert(func('(VAR, "a::after", "b")'), {
        'instructions': [`\
let parseStoreProperty = await page.$("a");
if (parseStoreProperty === null) { throw '"a" not found'; }
const jsHandle = await parseStoreProperty.evaluateHandle((e, p) => {
    return String(e[p]);
}, "b");
arg.variables["VAR"] = await jsHandle.jsonValue();`,
        ],
        'wait': false,
        'warnings': [
            'Pseudo-elements (`::after`) don\'t have attributes so the check will be performed ' +
            'on the element itself'],
    });
}

function checkStoreValue(x, func) {
    x.assert(func(''), {'error': 'expected a tuple, found nothing'});
    x.assert(func('hello'), {'error': 'expected a tuple, found `hello`'});
    x.assert(func('('), {'error': 'expected `)` at the end'});
    x.assert(func('(1)'), {'error': 'expected 2 elements in the tuple, found 1 element'});
    x.assert(func('(1, 1)'), {
        'error': 'expected first argument to be an ident, found a number (`1`)',
    });
    x.assert(func('(a, {"a": "b"})'), {
        'error': 'expected second argument to be a number or a string, found a json (`{"a": "b"}`)',
    });

    x.assert(func('(VAR, "a")'), {
        'instructions': ['arg.variables["VAR"] = "a";'],
        'wait': false,
    });
    x.assert(func('(VAR, 1)'), {
        'instructions': ['arg.variables["VAR"] = 1;'],
        'wait': false,
    });
    x.assert(func('(VAR, 1.28)'), {
        'instructions': ['arg.variables["VAR"] = 1.28;'],
        'wait': false,
    });
}

function checkText(x, func) {
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` or `,` after `"b"`'});
    x.assert(func('("a")'), {'error': 'expected `("CSS selector" or "XPath", "text")`'});
    x.assert(func('("a", )'), {'error': 'expected `("CSS selector" or "XPath", "text")`'});
    x.assert(func('("a", "b", "c")'), {'error': 'expected `("CSS selector" or "XPath", "text")`'});
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('(\'\', "b")'), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });

    x.assert(func('("a", "b")'),
        {
            'instructions': [
                'let parseTextElem = await page.$("a");\n' +
                'if (parseTextElem === null) { throw \'"a" not found\'; }\n' +
                'await page.evaluate(e => {\n' +
                'if (["input", "textarea"].indexOf(e.tagName.toLowerCase()) !== -1) {\n' +
                'e.value = "b";\n' +
                '} else {\n' +
                'e.innerText = "b";\n' +
                '}\n' +
                '}, parseTextElem);',
            ],
        });
    x.assert(func('("//a", "b")'),
        {
            'instructions': [
                'let parseTextElem = await page.$x("//a");\n' +
                'if (parseTextElem.length === 0) { throw \'XPath "//a" not found\'; }\n' +
                'parseTextElem = parseTextElem[0];\n' +
                'await page.evaluate(e => {\n' +
                'if (["input", "textarea"].indexOf(e.tagName.toLowerCase()) !== -1) {\n' +
                'e.value = "b";\n' +
                '} else {\n' +
                'e.innerText = "b";\n' +
                '}\n' +
                '}, parseTextElem);',
            ],
        });

    // Multiline
    x.assert(func('("a"\n)'), {'error': 'expected `("CSS selector" or "XPath", "text")`'});
    x.assert(func('("a"\n,\n "b")'),
        {
            'instructions': [
                'let parseTextElem = await page.$("a");\n' +
                'if (parseTextElem === null) { throw \'"a" not found\'; }\n' +
                'await page.evaluate(e => {\n' +
                'if (["input", "textarea"].indexOf(e.tagName.toLowerCase()) !== -1) {\n' +
                'e.value = "b";\n' +
                '} else {\n' +
                'e.innerText = "b";\n' +
                '}\n' +
                '}, parseTextElem);',
            ],
        });
}

function checkTimeout(x, func) {
    x.assert(func(''), {'error': 'expected integer for number of milliseconds, found nothing'});
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
    x.assert(func(''), {
        'error': 'expected an integer or a CSS selector or an XPath, found nothing',
    });
    x.assert(func('hello'), {
        'error': 'expected an integer or a CSS selector or an XPath, found `hello`',
    });
    x.assert(func('1 2'), {'error': 'expected nothing, found `2` after `1`'});
    x.assert(func('1'), {
        'instructions': ['await new Promise(r => setTimeout(r, 1));'],
        'wait': false,
    });
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
    x.assert(func('\'\''), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });
    x.assert(func('"a"'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitFor = null;
while (true) {
    parseWaitFor = await page.$("a");
    if (parseWaitFor !== null) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The following CSS selector \\"a\\" was not found");
    }
}`,
        ],
        'wait': false,
    });
    x.assert(func('\'a\''), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitFor = null;
while (true) {
    parseWaitFor = await page.$("a");
    if (parseWaitFor !== null) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The following CSS selector \\"a\\" was not found");
    }
}`,
        ],
        'wait': false,
    });
    x.assert(func('\'"a\''), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitFor = null;
while (true) {
    parseWaitFor = await page.$("\\"a");
    if (parseWaitFor !== null) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The following CSS selector \\"\\"a\\" was not found");
    }
}`,
        ],
        'wait': false,
    });

    // XPath
    x.assert(func('"/a"'), { 'error': 'XPath must start with `//`'});
    x.assert(func('"//a"'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitFor = null;
while (true) {
    parseWaitFor = await page.$x("//a");
    if (parseWaitFor.length !== 0) {
        parseWaitFor = parseWaitFor[0];
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The following XPath \\"//a\\" was not found");
    }
}`,
        ],
        'wait': false,
    });
}

function checkWaitForAttribute(x, func) {
    // Check integer
    x.assert(func(''), {
        'error': 'expected a tuple with a string and a JSON dict, found nothing',
    });
    x.assert(func('hello'), {
        'error': 'expected a tuple with a string and a JSON dict, found `hello`',
    });
    x.assert(func('(1)'), {
        'error': 'expected a tuple with a string and a JSON dict, found `(1)`',
    });
    x.assert(func('(1, 2)'), {
        'error': 'expected a CSS selector or an XPath as first tuple element, found `a number`',
    });
    x.assert(func('("a", 2)'), {
        'error': 'expected a JSON dict as second tuple element, found `a number`',
    });
    x.assert(func('("a", {"b": {"a": 2}})'), {
        'error': 'only string and number types are allowed as value, found `{"a": 2}` (a json)',
    });

    // Check css selector
    x.assert(func('("a", {})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$("a");
        if (parseWaitForAttr !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"x": 1})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$("a");
        if (parseWaitForAttr !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {"x":"1"};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"x": 1, "y": "2"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$("a");
        if (parseWaitForAttr !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {"x":"1","y":"2"};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // Check pseudo element.
    x.assert(func('("a::after", {"x": 1, "y": "2"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$("a");
        if (parseWaitForAttr !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {"x":"1","y":"2"};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'warnings': ['Pseudo-elements (`::after`) don\'t have attributes so the check will be \
performed on the element itself'],
        'checkResult': true,
    });
    // Ensures that there is no "show-text" check (because of "color").
    x.assert(func('("a", {"color": "blue"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$("a");
        if (parseWaitForAttr !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {"color":"blue"};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("/a", {"x": "1"})'), { 'error': 'XPath must start with `//`'});
    x.assert(func('("//a", {})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$x("//a");
        if (parseWaitForAttr.length !== 0) {
            parseWaitForAttr = parseWaitForAttr[0];
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following XPath \\"//a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"x": "1"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForAttr = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForAttr = await page.$x("//a");
        if (parseWaitForAttr.length !== 0) {
            parseWaitForAttr = parseWaitForAttr[0];
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following XPath \\"//a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        const parseWaitForAttrDict = {"x":"1"};
        for (const [parseWaitForAttrKey, parseWaitForAttrValue] of \
Object.entries(parseWaitForAttrDict)) {
            computedEntry = e.getAttribute(parseWaitForAttrKey);
            if (computedEntry !== parseWaitForAttrValue) {
                nonMatchingProps.push(parseWaitForAttrKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForAttrValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForAttr);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following attributes still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkWaitForCss(x, func) {
    x.assert(func(''), {
        'error': 'expected a tuple with a string and a JSON dict, found nothing',
    });
    x.assert(func('hello'), {
        'error': 'expected a tuple with a string and a JSON dict, found `hello`',
    });
    x.assert(func('(1)'), {
        'error': 'expected a tuple with a string and a JSON dict, found `(1)`',
    });
    x.assert(func('(1, 2)'), {
        'error': 'expected a CSS selector or an XPath as first tuple element, found `a number`',
    });
    x.assert(func('("a", 2)'), {
        'error': 'expected a JSON dict as second tuple element, found `a number`',
    });
    x.assert(func('("a", {"b": {"a": 2}})'), {
        'error': 'only string and number types are allowed as value, found `{"a": 2}` (a json)',
    });

    // Check css selector
    x.assert(func('("a", {})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$("a");
        if (parseWaitForCss !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {};
        const computedStyle = getComputedStyle(e);
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"x": 1})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$("a");
        if (parseWaitForCss !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {"x":"1"};
        const computedStyle = getComputedStyle(e);
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a", {"x": 1, "y": "2"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$("a");
        if (parseWaitForCss !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {"x":"1","y":"2"};
        const computedStyle = getComputedStyle(e);
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // Check pseudo element.
    x.assert(func('("a::after", {"x": 1, "y": "2"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$("a");
        if (parseWaitForCss !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {"x":"1","y":"2"};
        const computedStyle = getComputedStyle(e, "::after");
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    // Checks colors.
    x.assert(func('("a", {"color": "blue"})'), {
        'instructions': [
            `\
if (!arg.showText) {
    throw "\`show-text: true\` needs to be used before checking for \`color\` (otherwise the \
browser doesn't compute it)";
}`,
            `\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$("a");
        if (parseWaitForCss !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {"color":"blue"};
        const computedStyle = getComputedStyle(e);
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });

    // XPath
    x.assert(func('("/a", {"x": "1"})'), { 'error': 'XPath must start with `//`'});
    x.assert(func('("//a", {})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$x("//a");
        if (parseWaitForCss.length !== 0) {
            parseWaitForCss = parseWaitForCss[0];
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following XPath \\"//a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {};
        const computedStyle = getComputedStyle(e);
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("//a", {"x": "1"})'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForCss = null;
let nonMatchingProps;
while (true) {
    while (true) {
        parseWaitForCss = await page.$x("//a");
        if (parseWaitForCss.length !== 0) {
            parseWaitForCss = parseWaitForCss[0];
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following XPath \\"//a\\" was not found");
        }
    }
    nonMatchingProps = await page.evaluate(e => {
        const nonMatchingProps = [];
        let computedEntry;
        let extractedFloat;
        const parseWaitForCssDict = {"x":"1"};
        const computedStyle = getComputedStyle(e);
        for (const [parseWaitForCssKey, parseWaitForCssValue] of \
Object.entries(parseWaitForCssDict)) {
            computedEntry = computedStyle[parseWaitForCssKey];
            if (e.style[parseWaitForCssKey] != parseWaitForCssValue && computedEntry != \
parseWaitForCssValue) {
                if (typeof computedEntry === "string" && \
computedEntry.search(/^(\\d+\\.\\d+px)$/g) === 0) {
                    extractedFloat = browserUiTestHelpers.extractFloatOrZero(computedEntry, true) \
+ "px";
                    if (extractedFloat !== parseWaitForCssValue) {
                        nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` \
&& \`" + extractedFloat + "\`) != \`" + parseWaitForCssValue + "\`)");
                    } else {
                        continue;
                    }
                }
                nonMatchingProps.push(parseWaitForCssKey + ": (\`" + computedEntry + "\` != \`" + \
parseWaitForCssValue + "\`)");
            }
        }
        return nonMatchingProps;
    }, parseWaitForCss);
    if (nonMatchingProps.length === 0) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        const props = nonMatchingProps.join(", ");
        throw new Error("The following CSS properties still don't match: [" + props + "]");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkWaitForText(x, func) {
    x.assert(func(''), {
        'error': 'expected a tuple with two strings, found nothing',
    });
    x.assert(func('hello'), {
        'error': 'expected a tuple with two strings, found `hello`',
    });
    x.assert(func('(1)'), {
        'error': 'expected a tuple with two strings, found `(1)`',
    });
    x.assert(func('(1, 2)'), {
        'error': 'expected a CSS selector or an XPath as first tuple element, found `a number`',
    });
    x.assert(func('("a", 2)'), {
        'error': 'expected a string as second tuple element, found `a number`',
    });

    // Check CSS selector.
    x.assert(func('("a", "b")'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForText = null;
const value = "b";
let computedEntry;
while (true) {
    while (true) {
        parseWaitForText = await page.$("a");
        if (parseWaitForText !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    computedEntry = await page.evaluate(e => {
        return browserUiTestHelpers.getElemText(e, "b");
    }, parseWaitForText);
    if (computedEntry === value) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The text still doesn't match: \`" + computedEntry + "\` != \`" + \
value + "\`");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
    x.assert(func('("a::after", "b")'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForText = null;
const value = "b";
let computedEntry;
while (true) {
    while (true) {
        parseWaitForText = await page.$("a");
        if (parseWaitForText !== null) {
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following CSS selector \\"a\\" was not found");
        }
    }
    computedEntry = await page.evaluate(e => {
        return browserUiTestHelpers.getElemText(e, "b");
    }, parseWaitForText);
    if (computedEntry === value) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The text still doesn't match: \`" + computedEntry + "\` != \`" + \
value + "\`");
    }
}`,
        ],
        'wait': false,
        'warnings': ['Pseudo-elements (`::after`) don\'t have attributes so the check will be \
performed on the element itself'],
        'checkResult': true,
    });

    x.assert(func('("//a", "b")'), {
        'instructions': [`\
const timeLimit = page.getDefaultTimeout();
const timeAdd = 50;
let allTime = 0;
let parseWaitForText = null;
const value = "b";
let computedEntry;
while (true) {
    while (true) {
        parseWaitForText = await page.$x("//a");
        if (parseWaitForText.length !== 0) {
            parseWaitForText = parseWaitForText[0];
            break;
        }
        await new Promise(r => setTimeout(r, timeAdd));
        if (timeLimit === 0) {
            continue;
        }
        allTime += timeAdd;
        if (allTime >= timeLimit) {
            throw new Error("The following XPath \\"//a\\" was not found");
        }
    }
    computedEntry = await page.evaluate(e => {
        return browserUiTestHelpers.getElemText(e, "b");
    }, parseWaitForText);
    if (computedEntry === value) {
        break;
    }
    await new Promise(r => setTimeout(r, timeAdd));
    if (timeLimit === 0) {
        continue;
    }
    allTime += timeAdd;
    if (allTime >= timeLimit) {
        throw new Error("The text still doesn't match: \`" + computedEntry + "\` != \`" + \
value + "\`");
    }
}`,
        ],
        'wait': false,
        'checkResult': true,
    });
}

function checkWrite(x, func) {
    // check tuple argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('("a", "b"'), {'error': 'expected `)` or `,` after `"b"`'});
    x.assert(func('("a")'), {
        'error': 'invalid number of arguments in tuple, expected "string" or integer or ' +
            '("CSS selector" or "XPath", "string") or ("CSS selector" or "XPath", integer)',
    });
    x.assert(func('("a", )'), {
        'error': 'invalid number of arguments in tuple, expected "string" or integer or ' +
            '("CSS selector" or "XPath", "string") or ("CSS selector" or "XPath", integer)',
    });
    x.assert(func('("a", "b", "c")'), {
        'error': 'invalid number of arguments in tuple, expected "string" or integer or ' +
            '("CSS selector" or "XPath", "string") or ("CSS selector" or "XPath", integer)',
    });
    x.assert(func('("a", "b" "c")'), {'error': 'expected `,` or `)`, found `"` after `"b"`'});
    x.assert(func('(\'\', "b")'), {
        'error': 'CSS selector cannot be empty',
        'isXPath': false,
    });
    x.assert(func('("a", 13.2)'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('("a", -13.2)'), {'error': 'expected integer for keycode, found float: `-13.2`'});
    x.assert(func('("a", -13)'), {'error': 'keycode cannot be negative: `-13`'});
    x.assert(func('("a", "b")'), {'instructions': ['await page.type("a", "b");']});
    x.assert(func('("a", 13)'), {
        'instructions': [
            'await page.focus("a");',
            'await page.keyboard.press(String.fromCharCode(13));',
        ],
    });

    // check string argument
    x.assert(func('"'), {'error': 'expected `"` at the end of the string'});
    x.assert(func('\''), {'error': 'expected `\'` at the end of the string'});
    x.assert(func('\'\''), {'instructions': ['await page.keyboard.type("");']});
    x.assert(func('"a"'), {'instructions': ['await page.keyboard.type("a");']});
    x.assert(func('\'a\''), {'instructions': ['await page.keyboard.type("a");']});
    x.assert(func('\'"a\''), {'instructions': ['await page.keyboard.type("\\"a");']});

    // check integer argument
    x.assert(func('13.2'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('-13.2'), {'error': 'expected integer for keycode, found float: `-13.2`'});
    x.assert(func('-13'), {'error': 'keycode cannot be negative: `-13`'});
    x.assert(func('13'), {'instructions': ['await page.keyboard.press(String.fromCharCode(13));']});

    // XPath
    x.assert(func('("/a", 13)'), { 'error': 'XPath must start with `//`'});
    x.assert(func('("//a", "b")'), {
        'instructions': [
            'let parseWriteVar = await page.$x("//a");\n' +
            'if (parseWriteVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseWriteVar = parseWriteVar[0];\n' +
            'await parseWriteVar.type("b");',
        ],
    });
    x.assert(func('("//a", 13)'), {
        'instructions': [
            'let parseWriteVar = await page.$x("//a");\n' +
            'if (parseWriteVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseWriteVar = parseWriteVar[0];\n' +
            'parseWriteVar.focus();',
            'await page.keyboard.press(String.fromCharCode(13));',
        ],
    });

    // Multiline
    x.assert(func('("a", \n13.2)'), {'error': 'expected integer for keycode, found float: `13.2`'});
    x.assert(func('(\n"//a", \n13)'), {
        'instructions': [
            'let parseWriteVar = await page.$x("//a");\n' +
            'if (parseWriteVar.length === 0) { throw \'XPath "//a" not found\'; }\n' +
            'parseWriteVar = parseWriteVar[0];\n' +
            'parseWriteVar.focus();',
            'await page.keyboard.press(String.fromCharCode(13));',
        ],
    });
}

const TO_CHECK = [
    {
        'name': 'assert',
        'func': checkAssert,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssert, e, o),
    },
    {
        'name': 'assert-false',
        'func': checkAssertFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertFalse, e, o),
    },
    {
        'name': 'assert-attribute',
        'func': checkAssertAttribute,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertAttribute, e, o),
    },
    {
        'name': 'assert-attribute-false',
        'func': checkAssertAttributeFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertAttributeFalse, e, o),
    },
    {
        'name': 'assert-css',
        'func': checkAssertCss,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertCss, e, o),
    },
    {
        'name': 'assert-css-false',
        'func': checkAssertCssFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertCssFalse, e, o),
    },
    {
        'name': 'assert-document-property',
        'func': checkAssertDocumentProperty,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertDocumentProperty, e, o),
    },
    {
        'name': 'assert-document-property-false',
        'func': checkAssertDocumentPropertyFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertDocumentPropertyFalse, e, o),
    },
    {
        'name': 'assert-count',
        'func': checkAssertCount,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertCount, e, o),
    },
    {
        'name': 'assert-count-false',
        'func': checkAssertCountFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertCountFalse, e, o),
    },
    {
        'name': 'assert-local-storage',
        'func': checkAssertLocalStorage,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertLocalStorage, e, o),
    },
    {
        'name': 'assert-local-storage-false',
        'func': checkAssertLocalStorageFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertLocalStorageFalse, e, o),
    },
    {
        'name': 'assert-property',
        'func': checkAssertProperty,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertProperty, e, o),
    },
    {
        'name': 'assert-property-false',
        'func': checkAssertPropertyFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertPropertyFalse, e, o),
    },
    {
        'name': 'assert-position',
        'func': checkAssertPosition,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertPosition, e, o),
    },
    {
        'name': 'assert-position-false',
        'func': checkAssertPositionFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertPositionFalse, e, o),
    },
    {
        'name': 'assert-text',
        'func': checkAssertText,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertText, e, o),
    },
    {
        'name': 'assert-text-false',
        'func': checkAssertTextFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertTextFalse, e, o),
    },
    {
        'name': 'assert-window-property',
        'func': checkAssertWindowProperty,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertWindowProperty, e, o),
    },
    {
        'name': 'assert-window-property-false',
        'func': checkAssertWindowPropertyFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseAssertWindowPropertyFalse, e, o),
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
        'name': 'click-with-offset',
        'func': checkClickWithOffset,
        'toCall': (e, o) => wrapper(parserFuncs.parseClickWithOffset, e, o),
    },
    {
        'name': 'compare-elements-attribute',
        'func': checkCompareElementsAttribute,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsAttribute, e, o),
    },
    {
        'name': 'compare-elements-attribute-false',
        'func': checkCompareElementsAttributeFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsAttributeFalse, e, o),
    },
    {
        'name': 'compare-elements-css',
        'func': checkCompareElementsCss,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsCss, e, o),
    },
    {
        'name': 'compare-elements-css-false',
        'func': checkCompareElementsCssFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsCssFalse, e, o),
    },
    {
        'name': 'compare-elements-position',
        'func': checkCompareElementsPosition,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsPosition, e, o),
    },
    {
        'name': 'compare-elements-position-false',
        'func': checkCompareElementsPositionFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsPositionFalse, e, o),
    },
    {
        'name': 'compare-elements-position-near',
        'func': checkCompareElementsPositionNear,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsPositionNear, e, o),
    },
    {
        'name': 'compare-elements-position-near-false',
        'func': checkCompareElementsPositionNearFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsPositionNearFalse, e, o),
    },
    {
        'name': 'compare-elements-property',
        'func': checkCompareElementsProperty,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsProperty, e, o),
    },
    {
        'name': 'compare-elements-property-false',
        'func': checkCompareElementsPropertyFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsPropertyFalse, e, o),
    },
    {
        'name': 'compare-elements-text',
        'func': checkCompareElementsText,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsText, e, o),
    },
    {
        'name': 'compare-elements-text-false',
        'func': checkCompareElementsTextFalse,
        'toCall': (e, o) => wrapper(parserFuncs.parseCompareElementsTextFalse, e, o),
    },
    {
        'name': 'css',
        'func': checkCss,
        'toCall': (e, o) => wrapper(parserFuncs.parseCss, e, o),
    },
    {
        'name': 'debug',
        'func': checkDebug,
        'toCall': (e, o) => wrapper(parserFuncs.parseDebug, e, o),
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
        'name': 'fail-on-js-error',
        'func': checkFailOnJsError,
        'toCall': (e, o) => wrapper(parserFuncs.parseFailOnJsError, e, o),
    },
    {
        'name': 'focus',
        'func': checkFocus,
        'toCall': (e, o) => wrapper(parserFuncs.parseFocus, e, o),
    },
    {
        'name': 'font-size',
        'func': checkFontSize,
        'toCall': (e, o) => wrapper(parserFuncs.parseFontSize, e, o),
    },
    {
        'name': 'geolocation',
        'func': checkGeolocation,
        'toCall': (e, o) => wrapper(parserFuncs.parseGeolocation, e, o),
    },
    {
        'name': 'goto',
        'func': checkGoTo,
        'toCall': (e, o) => wrapperGoTo(parserFuncs.parseGoTo, e, o),
    },
    {
        'name': 'history-go-back',
        'func': checkHistoryGoBack,
        'toCall': (e, o) => wrapper(parserFuncs.parseHistoryGoBack, e, o),
    },
    {
        'name': 'history-go-forward',
        'func': checkHistoryGoForward,
        'toCall': (e, o) => wrapper(parserFuncs.parseHistoryGoForward, e, o),
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
        'name': 'pause-on-error',
        'func': checkPauseOnError,
        'toCall': (e, o) => wrapper(parserFuncs.parsePauseOnError, e, o),
    },
    {
        'name': 'permissions',
        'func': checkPermissions,
        'toCall': (e, o) => wrapper(parserFuncs.parsePermissions, e, o),
    },
    {
        'name': 'press-key',
        'func': checkPressKey,
        'toCall': (e, o) => wrapper(parserFuncs.parsePressKey, e, o),
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
        'name': 'screenshot-comparison',
        'func': checkScreenshotComparison,
        'toCall': (e, o) => wrapper(parserFuncs.parseScreenshotComparison, e, o),
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
        'name': 'store-property',
        'func': checkStoreProperty,
        'toCall': (e, o) => wrapper(parserFuncs.parseStoreProperty, e, o),
    },
    {
        'name': 'store-value',
        'func': checkStoreValue,
        'toCall': (e, o) => wrapper(parserFuncs.parseStoreValue, e, o),
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
        'name': 'wait-for-attribute',
        'func': checkWaitForAttribute,
        'toCall': (e, o) => wrapper(parserFuncs.parseWaitForAttribute, e, o),
    },
    {
        'name': 'wait-for-css',
        'func': checkWaitForCss,
        'toCall': (e, o) => wrapper(parserFuncs.parseWaitForCss, e, o),
    },
    {
        'name': 'wait-for-text',
        'func': checkWaitForText,
        'toCall': (e, o) => wrapper(parserFuncs.parseWaitForText, e, o),
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
        'toCall': (e, o) => wrapperParseContent(e, o),
    },
];

function checkCommandsSets(x, commands) {
    for (const command of commands) {
        x.assert(parserFuncs.ORDERS[command] !== undefined, true);
    }
}

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
            x.endTestSuite(false, true);
            print(`<== "${TO_CHECK[i].name}" failed: ${err}\n${err.stack}`);
        }
    }

    print('');
    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    const api_errors = x.getTotalErrors();
    x.endTestSuite(false);

    print('');
    // The goal here is to check that each command listed in the various sets actually exists.
    x.startTestSuite('Commands sets', false);
    print('=> Starting commands sets tests...');

    checkCommandsSets(x, parserFuncs.FATAL_ERROR_COMMANDS);
    checkCommandsSets(x, parserFuncs.NO_INTERACTION_COMMANDS);
    checkCommandsSets(x, parserFuncs.BEFORE_GOTO);

    const exports_errors = x.getTotalErrors();

    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);

    x.endTestSuite(false);

    print('');
    // The goal in this one is to check that all commands are tested.
    x.startTestSuite('Commands tested', false);

    for (const order of Object.keys(parserFuncs.ORDERS)) {
        if (TO_CHECK.findIndex(c => c.name === order) === -1) {
            x.addError(`command "${order}" needs to be tested!`);
        }
    }
    const untested_errors = x.getTotalErrors();

    print(`<= Ending ${x.getTotalRanTests()} ${plural('test', x.getTotalRanTests())} with ` +
        `${x.getTotalErrors()} ${plural('error', x.getTotalErrors())}`);
    x.endTestSuite(false);

    return api_errors + exports_errors + untested_errors;
}

if (require.main === module) {
    checkCommands().then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkCommands,
    };
}
