const process = require('process');
const { CommandNode } = require('../../src/ast.js');
const { ExpressionsValidator, Parser } = require('../../src/parser.js');
const CssParser = require('../../src/css_parser.js').CssParser;
const {Assert, plural, print} = require('./utils.js');

function inferredValues(text, variables = null) {
    const parser = new Parser(text);
    parser.parse();
    if (parser.errors.length !== 0) {
        return parser;
    }
    const command = new CommandNode(
        '',
        0,
        parser.elems,
        parser.hasVariable,
        0,
        text,
    );
    if (variables === null) {
        variables = {};
    }
    const ret = command.getInferredAst(variables, {});
    parser.errors.push(...ret.errors);
    if (parser.errors.length !== 0) {
        parser.elems = ret.ast;
        return parser;
    }
    const validator = new ExpressionsValidator(ret.ast, true, text);
    parser.elems = ret.ast;
    parser.errors.push(...validator.errors);
    return parser;
}

function checkCssParser(x) {
    let p = new CssParser('rgb()');
    x.assert(p.hasColor, false);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'function');
    x.assert(p.elems[0].containsColor, false);
    x.assert(p.elems[0].value, 'rgb()');

    p = new CssParser('rgb(1, 2, 3)');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'color');
    x.assert(p.elems[0].value, 'rgb(1, 2, 3)');
    x.assert(p.elems[0].colorKind, 'rgb');
    x.assert(p.elems[0].color, [1, 2, 3, 1]);

    p = new CssParser('1px whatever(rgb(1, 2, 3), a), 3');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 3);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].value, '1px');
    x.assert(p.elems[1].kind, 'function');
    x.assert(p.elems[1].value, 'whatever(rgb(1, 2, 3), a)');
    x.assert(p.elems[1].functionName, 'whatever');
    x.assert(p.elems[1].containsColor, true);
    x.assert(p.elems[1].innerArgs.length, 2);
    x.assert(p.elems[1].innerArgs[0].kind, 'color');
    x.assert(p.elems[1].innerArgs[1].kind, 'ident');
    x.assert(p.elems[2].kind, 'ident');
    x.assert(p.elems[2].value, '3');

    p = new CssParser('#fff 3px hsla(50 10% 40%) a');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 4);
    x.assert(p.elems[0].kind, 'color');
    x.assert(p.elems[0].value, '#fff');
    x.assert(p.elems[0].colorKind, 'hex-short');
    x.assert(p.elems[0].color, [255, 255, 255, 1]);
    x.assert(p.elems[1].kind, 'ident');
    x.assert(p.elems[1].value, '3px');
    x.assert(p.elems[2].kind, 'color');
    x.assert(p.elems[2].value, 'hsla(50 10% 40%)');
    x.assert(p.elems[2].colorKind, 'hsla');
    x.assert(p.elems[2].color, [112, 108, 91, 1]);
    x.assert(p.elems[3].kind, 'ident');
    x.assert(p.elems[3].value, 'a');

    p = new CssParser('"rgb(1, 2, 3)"');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].value, '"rgb(1, 2, 3)"');

    p = new CssParser('url("rgb(1, 2, 3)")');
    x.assert(p.hasColor, false);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'function');
    x.assert(p.elems[0].containsColor, false);
    x.assert(p.elems[0].value, 'url("rgb(1, 2, 3)")');

    p = new CssParser('transparent whitesmoke');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'color');
    x.assert(p.elems[1].kind, 'color');
    x.assert(p.toRGBAString(), 'rgba(0, 0, 0, 0) rgba(245, 245, 245, 1)');

    p = new CssParser('#fff #eaeaea hsl(50 10% 40%) rgb(1, 1, 1)');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 4);
    x.assert(p.elems[2].kind, 'color');
    x.assert(
        p.toRGBAString(),
        'rgba(255, 255, 255, 1) rgba(234, 234, 234, 1) rgba(112, 108, 91, 1) rgba(1, 1, 1, 1)',
    );

    let p2 = new CssParser('rgb(17,17,17) rgb(1,1,1) rgb(1,0,2) #fff');
    x.assert(p2.hasColor, true);
    x.assert(p2.elems.length, 4);
    x.assert(
        p2.sameFormatAs(p),
        '#111 #010101 hsl(270, 100.00000000000036%, 0.39215686274509803%) rgb(255, 255, 255)',
    );

    // Testing that the alpha value is correctly handled in hex format.
    p = new CssParser('#aaaa #112233aa #aaa');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 3);
    x.assert(p.elems[0].kind, 'color');
    x.assert(p.elems[1].kind, 'color');
    x.assert(p.elems[2].kind, 'color');
    x.assert(
        p.toRGBAString(),
        'rgba(170, 170, 170, 0.67) rgba(17, 34, 51, 0.67) rgba(170, 170, 170, 1)',
    );

    p2 = new CssParser('rgb(17,17,17) rgb(1,1,1) rgba(1,1,1,1)');
    x.assert(p2.hasColor, true);
    x.assert(p2.elems.length, 3);
    x.assert(
        p2.sameFormatAs(p),
        '#111f #010101ff #010101',
    );

    p = new CssParser('linear-gradient(rgb(15, 20, 25), rgba(15, 20, 25, 0))');
    x.assert(p.hasColor, true);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'function');
    x.assert(p.elems[0].containsColor, true);
    x.assert(p.elems[0].innerArgs.length, 2);
    x.assert(p.elems[0].innerArgs[0].kind, 'color');
    x.assert(p.elems[0].innerArgs[0].value, 'rgb(15, 20, 25)');
    x.assert(p.elems[0].innerArgs[1].kind, 'color');
    x.assert(p.elems[0].innerArgs[1].value, 'rgba(15, 20, 25, 0)');
    x.assert(p.toRGBAString(), 'linear-gradient(rgba(15, 20, 25, 1), rgba(15, 20, 25, 0))');

    p2 = new CssParser('linear-gradient(#aaa, #fff)');
    x.assert(p2.hasColor, true);
    x.assert(p2.elems.length, 1);
    x.assert(p2.toRGBAString(), 'linear-gradient(rgba(170, 170, 170, 1), rgba(255, 255, 255, 1))');
    x.assert(p2.sameFormatAs(p), 'linear-gradient(rgb(170, 170, 170), rgba(255, 255, 255, 1))');

    p = new CssParser('rgba(15, 20, 25, 1)');
    p2 = new CssParser('rgb(0,0,0)');
    x.assert(p2.sameFormatAs(p), 'rgba(0, 0, 0, 1)');

    p = new CssParser('#aaa3 #aaa');
    p2 = new CssParser('rgb(224, 224, 224) rgb(224, 224, 224)');
    x.assert(p2.sameFormatAs(p), '#e0e0e0ff #e0e0e0');

    p = new CssParser('rgba(255, 236, 164, 0.06)');
    p2 = new CssParser('#aaa');
    x.assert(p.sameFormatAs(p2), '#ffeca40f');

    p = new CssParser('rgba(255, 180, 76, 0.85)');
    p2 = new CssParser('#ffb44cd9');
    x.assert(p2.sameFormatAs(p), 'rgba(255, 180, 76, 0.85)');

    p = new CssParser('white');
    p2 = new CssParser('#f5f5f4');
    x.assert(p2.sameFormatAs(p), 'rgb(245, 245, 244)');

    p = new CssParser('white');
    p2 = new CssParser('#f00');
    x.assert(p2.sameFormatAs(p), 'red');
}

function checkTuple(x) {
    let p = new Parser('()');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('("hello",');
    p.parse();
    x.assert(p.errors[0].message, 'expected `)` after `"hello"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, 'expected `)` after `"hello"`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('("hello",)');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('("hello", 2');
    p.parse();
    x.assert(p.errors[0].message, 'expected `)` or `,` after `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` or `,` after `2`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'number');


    p = new Parser('("hello", 2, true, {"a": {"b": 3}, "c": "d"},)');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 4);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[3].error, null);


    p = new Parser('(true false)');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `)` after `true`, found `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(true false)');
    x.assert(p.elems[0].error, 'expected `,` or `)` after `true`, found `false`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `)` after `true`, found `false`');
    x.assert(p.elems[0].getRaw()[1].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'false');


    p = new Parser('(true,,true)');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(true,,true)');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), ',');


    p = new Parser('(true|false)');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `)` after `true`, found `|false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(true|false)');
    x.assert(p.elems[0].error, 'expected `,` or `)` after `true`, found `|false`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `)` after `true`, found `|false`');
    x.assert(p.elems[0].getRaw()[1].kind, 'variable');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'false');


    p = new Parser('(false)');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(false)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    process.env['variable'] = 'hello';
    p = inferredValues('(|variable|)');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(|variable|)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'hello');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '"hello"');

    p = inferredValues('(a, {"b": |variable|})');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(a, {"b": |variable|})');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'ident');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), 'a');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'json');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].key.getErrorText(), '"b"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].value.getErrorText(), '"hello"');
    process.env['variable'] = undefined;


    process.env['variable'] = '1';
    p = inferredValues('(|variable|)');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(|variable|)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw(), '1');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '1');
    process.env['variable'] = undefined;


    p = new Parser('(false//)');
    p.parse();
    x.assert(p.errors[0].message, 'expected `)` or `,` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` or `,` after `false`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    p = new Parser('(false,true)');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(false,true)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'true');


    p = new Parser('(//hel\nfalse\n,\n//hehe\ntrue\n)');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(//hel\nfalse\n,\n//hehe\ntrue\n)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'true');


    p = new Parser('(false,"s", (3, 12))');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(false,"s", (3, 12))');
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 's');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '"s"');
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'tuple');
    x.assert(p.elems[0].getRaw()[2].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[2].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[2].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[2].getRaw()[0].getRaw(), '3');
    x.assert(p.elems[0].getRaw()[2].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[2].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[2].getRaw()[1].getRaw(), '12');


    p = new Parser('(false,"s",   {"a": "b"}, 3)');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(false,"s",   {"a": "b"}, 3)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 4);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 's');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '"s"');
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'json');
    x.assert(p.elems[0].getRaw()[2].getErrorText(), '{"a": "b"}');
    x.assert(p.elems[0].getRaw()[3].error, null);
    x.assert(p.elems[0].getRaw()[3].kind, 'number');
    x.assert(p.elems[0].getRaw()[3].getRaw(), '3');


    p = new Parser('(false,[1, 2])');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(false,[1, 2])');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'array');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '[1, 2]');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getRaw(), '1');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getRaw(), '2');

    p = inferredValues(
        '(".result-" + |result_kind| + " ." + |result_kind|, {"color": |color|}, ALL)',
        {
            'result_kind': 'a',
            'color': 'b',
        },
    );
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(
        p.elems[0].getErrorText(),
        '(".result-" + |result_kind| + " ." + |result_kind|, {"color": |color|}, ALL)',
    );
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value, '.result-a .a');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'json');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].key.value, 'color');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].value.value, 'b');
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'ident');
    x.assert(p.elems[0].getRaw()[2].value, 'ALL');

    p = inferredValues('(1, ".result-" + |result_kind|, {"color": |color|}, ALL)',
        {
            'result_kind': 'a',
            'color': 'b',
        },
    );
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(
        p.elems[0].getErrorText(),
        '(1, ".result-" + |result_kind|, {"color": |color|}, ALL)',
    );
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 4);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value, '1');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].value, '.result-a');
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'json');
    x.assert(p.elems[0].getRaw()[2].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[2].getRaw()[0].key.value, 'color');
    x.assert(p.elems[0].getRaw()[2].getRaw()[0].value.value, 'b');
    x.assert(p.elems[0].getRaw()[3].error, null);
    x.assert(p.elems[0].getRaw()[3].kind, 'ident');
    x.assert(p.elems[0].getRaw()[3].value, 'ALL');

    p = new Parser('("a", "b" "c", ALL)');
    p.parse();
    x.assert(p.errors.length, 1);
    x.assert(p.errors[0].message, 'expected `,` or `)` after `"b"`, found `"c"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getRaw().length, 4);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value, 'a');
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].value, 'b');
    x.assert(p.elems[0].getRaw()[2].kind, 'string');
    x.assert(p.elems[0].getRaw()[2].value, 'c');
    x.assert(p.elems[0].getRaw()[3].kind, 'ident');
    x.assert(p.elems[0].getRaw()[3].value, 'ALL');
}

function checkArray(x) {
    let p = new Parser('[]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('["hello",');
    p.parse();
    x.assert(p.errors[0].message, 'expected `]` after `"hello"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, 'expected `]` after `"hello"`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('["hello", 2]');
    p.parse();
    x.assert(p.errors[0].message,
        'all array\'s elements must be of the same kind: expected array of `string` (because the ' +
        'first element is of this kind), found `number` at position 1');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error,
        'all array\'s elements must be of the same kind: expected array of `string` (because the ' +
        'first element is of this kind), found `number` at position 1');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'number');


    p = new Parser('[{"a": {"b": 3}, "c": "d"},]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'json');


    p = new Parser('[true false]');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `]` after `true`, found `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[true false]');
    x.assert(p.elems[0].error, 'expected `,` or `]` after `true`, found `false`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `]` after `true`, found `false`');
    x.assert(p.elems[0].getRaw()[1].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'false');


    p = new Parser('[true,,false]');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[true,,false]');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), ',');
    x.assert(p.elems[0].getRaw()[2].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[2].getRaw(), 'false');


    p = new Parser('[true|false]');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `]` after `true`, found `|false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[true|false]');
    x.assert(p.elems[0].error, 'expected `,` or `]` after `true`, found `|false`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `]` after `true`, found `|false`');
    x.assert(p.elems[0].getRaw()[1].kind, 'variable');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'false');


    p = new Parser('[false]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[false]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    process.env['variable'] = 'hello';
    p = inferredValues('[|variable|]');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[|variable|]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'hello');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '"hello"');
    process.env['variable'] = undefined;


    p = new Parser('[false//]');
    p.parse();
    x.assert(p.errors[0].message, 'expected `]` or `,` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, 'expected `]` or `,` after `false`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    p = new Parser('[false,true]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[false,true]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'true');


    p = new Parser('[//hello\nfalse\n,\n//data\ntrue\n]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[//hello\nfalse\n,\n//data\ntrue\n]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'true');


    p = new Parser('[(3, 12), ("a", "b", "c")]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[(3, 12), ("a", "b", "c")]');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'tuple');
    x.assert(p.elems[0].getRaw()[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '(3, 12)');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].getRaw(), '3');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].getRaw(), '12');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'tuple');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '("a", "b", "c")');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getRaw(), 'b');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getErrorText(), '"b"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getRaw(), 'c');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getErrorText(), '"c"');

    p = new Parser('[[3, 12], ["a", "b", "c"]]');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[[3, 12], ["a", "b", "c"]]');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'array');
    x.assert(p.elems[0].getRaw()[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '[3, 12]');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].getRaw(), '3');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].getRaw(), '12');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'array');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '["a", "b", "c"]');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getRaw(), 'b');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getErrorText(), '"b"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getRaw(), 'c');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getErrorText(), '"c"');
}

function checkIdent(x) {
    let p = new Parser('false');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false');

    p = new Parser('true');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true');

    p = new Parser('aloha');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');


    p = new Parser('     \t   false                 ');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false');

    p = new Parser('     \t   aloha                 ');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');


    p = new Parser('true,');
    p.parse();
    x.assert(p.errors[0].message, 'expected nothing after `true`, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true');
    x.assert(p.elems[1].kind, 'unknown');
    x.assert(p.elems[1].error, 'unexpected token `,` after `true`');
    x.assert(p.elems[1].getRaw(), ',');

    p = new Parser('aloha,');
    p.parse();
    x.assert(p.errors[0].message, 'expected nothing after `aloha`, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');
    x.assert(p.elems[1].kind, 'unknown');
    x.assert(p.elems[1].error, 'unexpected token `,` after `aloha`');
    x.assert(p.elems[1].getRaw(), ',');
}

function checkString(x) {
    let p = new Parser('"hello');
    p.parse();
    x.assert(p.errors[0].message, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '"hello');


    p = new Parser('"hello\\"');
    p.parse();
    x.assert(p.errors[0].message, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello\\"');
    x.assert(p.elems[0].getErrorText(), '"hello\\"');


    p = new Parser('"hello"');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '"hello"');


    p = new Parser('"hello\\""');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello\\"');
    x.assert(p.elems[0].getErrorText(), '"hello\\""');


    p = new Parser('\'hello');
    p.parse();
    x.assert(p.errors[0].message, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '\'hello');


    p = new Parser('\'hello\\\'');
    p.parse();
    x.assert(p.errors[0].message, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello\\\'');
    x.assert(p.elems[0].getErrorText(), '\'hello\\\'');


    p = new Parser('\'hello\'');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '\'hello\'');


    p = new Parser('\'hello\\\'\'');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello\\\'');
    x.assert(p.elems[0].getErrorText(), '\'hello\\\'\'');
}

function checkNumber(x) {
    let p = new Parser('1');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('     \t   23                 ');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '23');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('42,');
    p.parse();
    x.assert(p.errors[0].message, 'expected nothing after `42`, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '42');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);
    x.assert(p.elems[1].kind, 'unknown');
    x.assert(p.elems[1].error, 'unexpected token `,` after `42`');
    x.assert(p.elems[1].getRaw(), ',');


    p = new Parser('4.2');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '4.2');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('.2');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `.` as first token');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'unknown');
    x.assert(p.elems[0].getRaw(), '.');
    x.assert(p.elems[0].error, 'unexpected `.` as first token');
    x.assert(p.elems[1].kind, 'number');
    x.assert(p.elems[1].getRaw(), '2');
    x.assert(p.elems[1].error, 'expected nothing after `.`, found `2`');


    p = new Parser('0.1.2');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `.` after `0.1`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, 'unexpected `.` after `0.1`');
    x.assert(p.elems[0].getRaw(), '0.1');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, true);
    x.assert(p.elems[1].kind, 'number');
    x.assert(p.elems[1].getRaw(), '2');
    x.assert(p.elems[1].error, 'expected nothing after `0.1`, found `2`');


    p = new Parser('-0.1');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '-0.1');
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('-12');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '-12');
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('-12.1');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems[0].getRaw(), '-12.1');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('-12.');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems[0].getRaw(), '-12.');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('--12');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `-` after `-`');
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[0].kind, 'unknown');
    x.assert(p.elems[0].getRaw()[0].getRaw(), '-');
    x.assert(p.elems[0].getRaw()[0].error, 'unexpected `-` after `-`');
    x.assert(p.elems[0].getRaw()[1].kind, 'operator');
    x.assert(p.elems[0].getRaw()[1].getRaw(), '-');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'number');
    x.assert(p.elems[0].getRaw()[2].getRaw(), '12');
    x.assert(p.elems[0].getRaw()[2].error, null);

    p = inferredValues('1-2');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].getRaw(), '1 - 2');
    x.assert(p.elems[0].getErrorText(), '1-2');
    x.assert(p.elems[0].error, null);

    p = inferredValues('-0.2-');
    p.parse();
    x.assert(p.errors[0].message, 'missing element after operator `-`');
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, 'missing element after operator `-`');
}

function checkJson(x) {
    let p = new Parser('{1: 2}');
    p.parse();
    x.assert(
        p.errors[0].message, 'only strings can be used as keys in JSON dict, found a number (`1`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a number (`1`)',
    );
    x.assert(p.elems[0].getErrorText(), '{1: 2}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '1');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '2');


    p = new Parser('{-1: 2}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'only strings can be used as keys in JSON dict, found a number (`-1`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a number (`-1`)',
    );
    x.assert(p.elems[0].getErrorText(), '{-1: 2}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '-1');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '2');


    p = new Parser('{-1.2: 2}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'only strings can be used as keys in JSON dict, found a number (`-1.2`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a number (`-1.2`)',
    );
    x.assert(p.elems[0].getErrorText(), '{-1.2: 2}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '-1.2');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '2');


    p = new Parser('{color": "blue"}');
    p.parse();
    x.assert(p.errors.length, 1);
    x.assert(p.errors[0].message, 'expected `:` after `color`, found `": "`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].fullText, '{color": "blue"}');
    x.assert(p.elems[0].value.length, 0);
    x.assert(p.elems[0].error, 'expected `:` after `color`, found `": "`');


    p = new Parser('{"a"}');
    p.parse();
    x.assert(p.errors.length, 1);
    x.assert(p.errors[0].message, 'expected `:` after `"a"`, found `}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].fullText, '{"a"}');
    x.assert(p.elems[0].value.length, 0);
    x.assert(p.elems[0].error, 'expected `:` after `"a"`, found `}`');

    p = new Parser('{"a",}');
    p.parse();
    x.assert(p.errors.length, 1);
    x.assert(p.errors[0].message, 'expected `:` after `"a"`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].fullText, '{"a",}');
    x.assert(p.elems[0].value.length, 0);
    x.assert(p.elems[0].error, 'expected `:` after `"a"`, found `,`');


    process.env['variable'] = '1';
    process.env['variable_value'] = 'a';
    p = inferredValues('{|variable|: 2}');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{|variable|: 2}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"1"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');

    p = inferredValues('{"a": |variable|}');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"a": |variable|}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');

    p = inferredValues('{|variable value|: |variable|}');
    x.assert(p.errors[0].message, 'unexpected character ` ` after `|variable`');

    p = inferredValues('{|variable_value|: |variable|}');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{|variable_value|: |variable|}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');
    process.env['variable'] = undefined;
    process.env['variable_value'] = undefined;

    p = new Parser(`set-local-storage: {"rustdoc-theme": |theme|, "use-system-theme": "false"}
// removed comment
reload: 
reload://hello
assert-css: (".item-left sup", {"color": |color|})`);
    p.parseNextCommand();
    x.assert(p.command.value, 'set-local-storage');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    p.parseNextCommand();
    x.assert(p.command.value, 'reload');
    x.assert(p.elems, []);
    p.parseNextCommand();
    x.assert(p.command.value, 'reload');
    x.assert(p.elems, []);
    p.parseNextCommand();
    x.assert(p.command.value, 'assert-css');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].kind, 'json');


    p = new Parser('{true: 1}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'only strings can be used as keys in JSON dict, found a boolean (`true`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a boolean (`true`)',
    );
    x.assert(p.elems[0].getErrorText(), '{true: 1}');


    p = new Parser('{hello: 1}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'only strings can be used as keys in JSON dict, found an ident (`hello`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found an ident (`hello`)',
    );
    x.assert(p.elems[0].getErrorText(), '{hello: 1}');


    p = new Parser('{{"a": 2}: 1}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'only strings can be used as keys in JSON dict, found a json (`{"a": 2}`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a json (`{"a": 2}`)',
    );
    x.assert(p.elems[0].getErrorText(), '{{"a": 2}: 1}');
    x.assert(p.elems[0].getRaw().length, 1);


    p = new Parser('{.1: 1}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'unexpected `.` as first token of JSON dict key');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'expected `:` after `.`, found `1`',
    );
    x.assert(p.elems[0].getErrorText(), '{.1: 1}');
    x.assert(p.elems[0].getRaw().length, 1);


    p = new Parser('{"a": []}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"a": []}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'array');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '[]');
    x.assert(p.elems[0].getRaw()[0].value.getRaw().length, 0);


    p = new Parser('{"a": [1, 2]}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"a": [1, 2]}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'array');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '[1, 2]');
    x.assert(p.elems[0].getRaw()[0].value.getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].getRaw(), '1');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[1].getRaw(), '2');


    p = new Parser('{[1, 2]: 1}');
    p.parse();
    x.assert(
        p.errors[0].message,
        'only strings can be used as keys in JSON dict, found an array (`[1, 2]`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found an array (`[1, 2]`)',
    );
    x.assert(p.elems[0].getErrorText(), '{[1, 2]: 1}');
    x.assert(p.elems[0].getRaw().length, 1);


    p = new Parser('{"x": .}');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems[0].getErrorText(), '{"x": .}');
    x.assert(p.elems[0].getRaw().length, 1);


    p = new Parser('{"x": 1,}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x": 1,}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');


    p = new Parser('{\n\n\n\n\n"x"\n//tadam\n:\n1\n}\n');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{\n\n\n\n\n"x"\n//tadam\n:\n1\n}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');


    p = new Parser('{"x": .,}');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems[0].getErrorText(), '{"x": .,}');
    x.assert(p.elems[0].getRaw().length, 1);


    p = new Parser('{"x": }');
    p.parse();
    x.assert(p.errors[0].message, 'expected a value for key `"x"`, found nothing');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected a value for key `"x"`, found nothing');
    x.assert(p.elems[0].getErrorText(), '{"x": }');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": "a"}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x": "a"}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');


    p = new Parser('{"x": "a" "y": 2}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `}` after `"a"`, found `"y"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` or `}` after `"a"`, found `"y"`');
    x.assert(p.elems[0].getErrorText(), '{"x": "a" "y": 2}');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), 'y');
    x.assert(p.elems[0].getRaw()[1].value.getRaw(), '2');


    p = new Parser('{"x" 2}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems[0].getErrorText(), '{"x" 2}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x" "a"}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `:` after `"x"`, found `"a"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `"a"`');
    x.assert(p.elems[0].getErrorText(), '{"x" "a"}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x", "a"}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems[0].getErrorText(), '{"x", "a"}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": "a": "y": "b"}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `}` after `"a"`, found `:`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` or `}` after `"a"`, found `:`');
    x.assert(p.elems[0].getErrorText(), '{"x": "a": "y": "b"}');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), 'y');
    x.assert(p.elems[0].getRaw()[1].value.getRaw(), 'b');


    p = new Parser('{, "a"}');
    p.parse();
    x.assert(p.errors[0].message, 'expected a key after `{`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'expected a key after `{`, found `,`',
    );
    x.assert(p.elems[0].getErrorText(), '{, "a"}');


    p = new Parser('{"a": 1,,}');
    p.parse();
    x.assert(p.errors[0].message, 'expected a key after `1`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'expected a key after `1`, found `,`',
    );
    x.assert(p.elems[0].getErrorText(), '{"a": 1,,}');


    p = new Parser('{"x": 2|"y": "a"}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `}` after `2`, found `|`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` or `}` after `2`, found `|`');
    x.assert(p.elems[0].getErrorText(), '{"x": 2|"y": "a"}');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), '|');
    x.assert(p.elems[0].getRaw()[1].value.getRaw(), 'y');


    p = new Parser('{"x": 2,|y: "a"}');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected character `:` after `|y`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected character `:` after `|y`');
    x.assert(p.elems[0].getErrorText(), '{"x": 2,|y: "a"}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = inferredValues('{"x" + "y": 2}');
    x.assert(p.errors.length === 0);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x" + "y": 2}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x" + "y"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = inferredValues('{"x" + |y|: 2}', {'y': 'a'});
    x.assert(p.errors.length === 0);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x" + |y|: 2}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x" + |y|');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = inferredValues('{"x": 2 + |y|}', {'y': 'a'});
    x.assert(p.errors.length === 0);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x": 2 + |y|}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '2 + |y|');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2a');


    p = new Parser('{"x" {"y": 1}}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `:` after `"x"`, found `{"y": 1}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `{"y": 1}`');
    x.assert(p.elems[0].getErrorText(), '{"x" {"y": 1}}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x" true}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `:` after `"x"`, found `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `true`');
    x.assert(p.elems[0].getErrorText(), '{"x" true}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": "a", "y": true, "z": 56}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x": "a", "y": true, "z": 56}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.isRecursive(), false);
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[1].key.getErrorText(), '"y"');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), 'y');
    x.assert(p.elems[0].getRaw()[1].value.kind, 'boolean');
    x.assert(p.elems[0].getRaw()[1].value.getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].value.isRecursive(), false);
    x.assert(p.elems[0].getRaw()[2].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[2].key.getErrorText(), '"z"');
    x.assert(p.elems[0].getRaw()[2].key.getRaw(), 'z');
    x.assert(p.elems[0].getRaw()[2].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[2].value.isRecursive(), false);
    x.assert(p.elems[0].getRaw()[2].value.getRaw(), '56');


    p = new Parser('{"x": "a", "y":{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}, "z": 56}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(),
        '{"x": "a", "y":{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}, "z": 56}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[1].key.getErrorText(), '"y"');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), 'y');

    // Recursion hell check
    x.assert(p.elems[0].getRaw()[1].value.kind, 'json');
    x.assert(p.elems[0].getRaw()[1].value.getErrorText(),
        '{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}');
    x.assert(p.elems[0].getRaw()[1].value.getRaw().length, 1);

    // welcome to level 1, young padawan
    const sub = p.elems[0].getRaw()[1].value.getRaw();
    x.assert(sub[0].key.kind, 'string');
    x.assert(sub[0].key.getErrorText(), '"tadam"');
    x.assert(sub[0].key.getRaw(), 'tadam');
    x.assert(sub[0].value.kind, 'json');
    x.assert(sub[0].value.getErrorText(), '{"re":{"cur":{"sion":"yo"},"done": false}}');

    // welcome to level 2, knight
    const subsub = sub[0].value.getRaw();
    x.assert(subsub.length, 1);
    x.assert(subsub[0].key.kind, 'string');
    x.assert(subsub[0].key.getErrorText(), '"re"');
    x.assert(subsub[0].key.getRaw(), 're');
    x.assert(subsub[0].value.kind, 'json');
    x.assert(subsub[0].value.getErrorText(), '{"cur":{"sion":"yo"},"done": false}');

    // welcome to level 3, master
    const subsubsub = subsub[0].value.getRaw();
    x.assert(subsubsub.length, 2);
    x.assert(subsubsub[0].key.kind, 'string');
    x.assert(subsubsub[0].key.getErrorText(), '"cur"');
    x.assert(subsubsub[0].key.getRaw(), 'cur');
    x.assert(subsubsub[0].value.kind, 'json');
    x.assert(subsubsub[0].value.getErrorText(), '{"sion":"yo"}');
    x.assert(subsubsub[1].key.kind, 'string');
    x.assert(subsubsub[1].key.getErrorText(), '"done"');
    x.assert(subsubsub[1].key.getRaw(), 'done');
    x.assert(subsubsub[1].value.kind, 'boolean');
    x.assert(subsubsub[1].value.getRaw(), 'false');

    // welcome to level 4... json god?
    const subsubsubsub = subsubsub[0].value.getRaw();
    x.assert(subsubsubsub.length, 1);
    x.assert(subsubsubsub[0].key.kind, 'string');
    x.assert(subsubsubsub[0].key.getErrorText(), '"sion"');
    x.assert(subsubsubsub[0].key.getRaw(), 'sion');
    x.assert(subsubsubsub[0].value.kind, 'string');
    x.assert(subsubsubsub[0].value.getErrorText(), '"yo"');
    x.assert(subsubsubsub[0].value.getRaw(), 'yo');

    // back to top \o/
    x.assert(p.elems[0].getRaw()[2].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[2].key.getErrorText(), '"z"');
    x.assert(p.elems[0].getRaw()[2].key.getRaw(), 'z');
    x.assert(p.elems[0].getRaw()[2].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[2].value.getRaw(), '56');

    p = new Parser('({"x": 1},}');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected token `}` after `{"x": 1}`');

    p = new Parser('({"x": 1}}');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `)` after `{"x": 1}`, found `}`');

    p = new Parser('("hello",{"a": "1"))');
    p.parse();
    x.assert(p.errors[0].message, 'expected `,` or `}` after `"1"`, found `)`');

    p = inferredValues('{"x": |a|}');
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
}

function checkComment(x) {
    let p = new Parser('1 // just a test');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1');


    p = new Parser('(1) //oups, a comment!');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw(), '1');


    p = new Parser('(1//oups, an error!');
    p.parse();
    x.assert(p.errors[0].message, 'expected `)` or `,` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` or `,` after `1`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw(), '1');


    p = new Parser('{"a": 1//oups, an error!');
    p.parse();
    x.assert(p.errors[0].message, 'unclosed JSON object: expected `}` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unclosed JSON object: expected `}` after `1`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');


    p = new Parser('"just a string// with a comment in the middle!"');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'just a string// with a comment in the middle!');
    x.assert(p.elems[0].getErrorText(), '"just a string// with a comment in the middle!"');
}

function checkExpr(x) {
    let p = new Parser('1 + + 1');
    p.parse();
    x.assert(p.errors[0].message, 'expected element after operator `+`, found `+` (an operator)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, 'expected element after operator `+`, found `+` (an operator)');
    x.assert(p.elems[0].getRaw()[2].kind, 'operator');
    x.assert(
        p.elems[0].getRaw()[2].error,
        'expected element after operator `+`, found `+` (an operator)',
    );

    p = new Parser('+ 1 + 1');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `+` as first token');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'unknown');
    x.assert(p.elems[0].error, 'unexpected `+` as first token');
    x.assert(p.elems[1].kind, 'expression');
    x.assert(p.elems[1].error, null);

    p = inferredValues('1 + 2 && true');
    x.assert(
        p.errors[0].message,
        'expected expression `1 + 2` to be evaluated as boolean, instead it was ' +
        'evaluated as number (in `1 + 2 && true`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, 'expected expression `1 + 2` to be evaluated as boolean, instead ' +
        'it was evaluated as number (in `1 + 2 && true`)');

    p = inferredValues('1 + true');
    x.assert(p.errors[0].message, '`+` is not supported for boolean elements (in `1 + true`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, null);

    p = inferredValues('1 + (1 + 3');
    x.assert(p.errors[0].message, 'missing `)` at the end of the expression started line 1');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'operator');
    x.assert(p.elems[0].getRaw()[2].kind, 'tuple');
    x.assert(
        p.elems[0].getRaw()[2].error,
        'missing `)` at the end of the expression started line 1',
    );

    p = inferredValues('true == 1');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare boolean (`true`) and number (`1`) elements');

    p = inferredValues('1 == true');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare number (`1`) and boolean (`true`) elements');

    p = inferredValues('"a" == true');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare string (`"a"`) and boolean (`true`) elements');

    p = inferredValues('"a" > true');
    x.assert(
        p.errors[0].message,
        '`>` is only supported for number elements, `"a"` was evaluated as string ' +
            '(in `"a" > true`)',
    );

    p = inferredValues('1 > true');
    x.assert(
        p.errors[0].message,
        '`>` is only supported for number elements, `true` was evaluated as boolean ' +
            '(in `1 > true`)',
    );

    p = inferredValues('1 > (true)');
    x.assert(
        p.errors[0].message,
        '`>` is only supported for number elements, `(true)` was evaluated as boolean ' +
            '(in `1 > (true)`)',
    );

    p = inferredValues('1 > (true || false)');
    x.assert(
        p.errors[0].message,
        '`>` is only supported for number elements, `(true || false)` was evaluated as boolean' +
            ' (in `1 > (true || false)`)',
    );

    p = inferredValues('1 == (true || false)');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare number (`1`) and boolean (`(true || false)`) elements',
    );

    p = inferredValues('1 + "a" > 2');
    x.assert(
        p.errors[0].message,
        '`>` is only supported for number elements, `1 + "a"` was evaluated as string ' +
            '(in `1 + "a" > 2`)',
    );

    p = inferredValues('(1, 2) + 1');
    x.assert(p.errors[0].message, '`+` is not supported for tuple elements (in `(1, 2) + 1`)');

    p = inferredValues('(1,) + 1');
    x.assert(p.errors[0].message, '`+` is not supported for tuple elements (in `(1,) + 1`)');

    p = inferredValues('(1,) > 1');
    x.assert(
        p.errors[0].message,
        '`>` is only supported for number elements, `(1,)` was evaluated as tuple (in `(1,) > 1`)',
    );

    p = inferredValues('(1,) == 1');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare tuple (`(1,)`) and number (`1`) elements',
    );

    p = inferredValues('("1", 1) == [3, 2]');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare tuple (`("1", 1)`) and array (`[3, 2]`) elements');

    p = inferredValues('("1", 1) == {"3": 2}');
    x.assert(
        p.errors[0].message,
        '`==` cannot be used to compare tuple (`("1", 1)`) and json (`{"3": 2}`) elements',
    );

    p = inferredValues('1 + 1');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + 1');
    x.assert(p.elems[0].getErrorText(), '1 + 1');

    p = inferredValues('1 + 1 +    4');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + 1 + 4');
    x.assert(p.elems[0].getErrorText(), '1 + 1 +    4');

    p = inferredValues('"a" + "b" ');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'ab');
    x.assert(p.elems[0].getErrorText(), '"a" + "b" ');

    p = inferredValues('"a" +   "b"');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'ab');
    x.assert(p.elems[0].getErrorText(), '"a" +   "b"');

    p = inferredValues('"a" + 1 ');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a1');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 ');

    p = inferredValues('1 + "a" ');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1a');
    x.assert(p.elems[0].getErrorText(), '1 + "a" ');

    p = inferredValues('1 + "a" + 4 +    "bcd"');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1a4bcd');
    x.assert(p.elems[0].getErrorText(), '1 + "a" + 4 +    "bcd"');

    process.env['variable'] = 'hello';
    p = inferredValues('|variable| + 2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello2');
    x.assert(p.elems[0].getErrorText(), '|variable| + 2');

    process.env['variable'] = '1';
    p = inferredValues('|variable| + 2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + 2');
    x.assert(p.elems[0].getErrorText(), '|variable| + 2');
    process.env['variable'] = undefined;

    p = inferredValues('1 + "" + 2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '12');
    x.assert(p.elems[0].getErrorText(), '1 + "" + 2');

    p = inferredValues('1 + 2 + "a"');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '12a');
    x.assert(p.elems[0].getErrorText(), '1 + 2 + "a"');

    p = inferredValues('"a" + 1 + 2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a12');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 + 2');

    p = inferredValues('"a" + 1 + \n2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a12');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 + \n2');

    p = inferredValues('"a" + 1 + // comment?\n2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a12');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 + // comment?\n2');

    p = inferredValues('{"x" + 2: 1,}');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x" + 2: 1,}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x" + 2');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x2');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');

    p = inferredValues('1 > 2 && true');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 > 2 && true');
    x.assert(p.elems[0].getErrorText(), '1 > 2 && true');

    p = inferredValues('1 + (1 + 3)');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + (1 + 3)');
    x.assert(p.elems[0].getErrorText(), '1 + (1 + 3)');

    p = inferredValues('1 + (1 + |var| * (1 + (4 * (7 / |var|))))', {'var': 4});
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + (1 + 4 * (1 + (4 * (7 / 4))))');
    x.assert(p.elems[0].getErrorText(), '1 + (1 + |var| * (1 + (4 * (7 / |var|))))');

    p = inferredValues('true || |variable|', {'variable': true});
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true || true');
    x.assert(p.elems[0].getErrorText(), 'true || |variable|');

    p = inferredValues('true || |variable| == "a"', {'variable': 'b'});
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true || "b" == "a"');
    x.assert(p.elems[0].getErrorText(), 'true || |variable| == "a"');

    p = inferredValues('(1 + 3, "a")');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '(1 + 3, "a")');
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '1 + 3');
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '"a"');

    p = inferredValues('(1 + 2) * 4');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '(1 + 2) * 4');
    x.assert(p.elems[0].getErrorText(), '(1 + 2) * 4');

    p = inferredValues('(1 + 2) < (4 * 3)');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '(1 + 2) < (4 * 3)');
    x.assert(p.elems[0].getErrorText(), '(1 + 2) < (4 * 3)');

    p = inferredValues('(1 - -2) * 4');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '(1 - -2) * 4');
    x.assert(p.elems[0].getErrorText(), '(1 - -2) * 4');

    p = inferredValues('-1-2');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '-1 - 2');
    x.assert(p.elems[0].getErrorText(), '-1-2');

    p = inferredValues('|var| == (true || false)', {'var': false});
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false == (true || false)');
    x.assert(p.elems[0].getErrorText(), '|var| == (true || false)');

    p = inferredValues('[1, 2] == [3]');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'compareArrayLike([1, 2], [3])');
    x.assert(p.elems[0].getErrorText(), '[1, 2] == [3]');

    p = inferredValues('[1, 2] != [3]');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '!compareArrayLike([1, 2], [3])');
    x.assert(p.elems[0].getErrorText(), '[1, 2] != [3]');

    p = inferredValues('{"1": 1} == {"a": 2}');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'compareJson({"1": 1}, {"a": 2})');
    x.assert(p.elems[0].getErrorText(), '{"1": 1} == {"a": 2}');

    p = inferredValues('{"1": 1} != {"a": 2}');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '!compareJson({"1": 1}, {"a": 2})');
    x.assert(p.elems[0].getErrorText(), '{"1": 1} != {"a": 2}');

    p = inferredValues('("1", 1) == ("a", 3, 2)');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'compareArrayLike(["1", 1], ["a", 3, 2])');
    x.assert(p.elems[0].getErrorText(), '("1", 1) == ("a", 3, 2)');

    p = inferredValues('("1", 1) != ("a", 3, 2)');
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '!compareArrayLike(["1", 1], ["a", 3, 2])');
    x.assert(p.elems[0].getErrorText(), '("1", 1) != ("a", 3, 2)');
}

function checkBlock(x) {
    let p = new Parser('block { reload:\n');
    p.parse();
    x.assert(p.errors[0].message, 'Missing `}` to end the block');

    p = new Parser('block { hello: }');
    p.parse();
    x.assert(p.errors[0].message, 'Unknown command "hello" (in `block { ... }`)');

    p = new Parser('block { reload:\n }');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, ' reload:\n ');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'reload:');

    p = new Parser('block{reload:\n}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'reload:\n');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'reload:');

    p = new Parser('block{assert:\nreload:\n}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'assert:\nreload:\n');
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'assert:');
    x.assert(p.elems[0].value[1].getOriginalCommand(), 'reload:');

    // Without backline.
    p = new Parser('block{reload: { "a": 1 }');
    p.parse();
    x.assert(p.errors[0].message, 'Missing `}` to end the block');

    p = new Parser('block{reload: { "a": "x }');
    p.parse();
    x.assert(p.errors[0].message, 'expected `"` at the end of the string (in `block { ... }`)');

    p = new Parser('block{reload: ("a"), }');
    p.parse();
    x.assert(
        p.errors[0].message,
        'expected backline or `}` after `("a")`, found `,` (in `block { ... }`)');

    p = new Parser('block{assert:,reload: ("a") }');
    p.parse();
    x.assert(p.errors[0].message, 'unexpected `,` as first token (in `block { ... }`)');

    p = new Parser('block{reload:}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'reload:');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'reload:');

    p = new Parser('block{assert:\nreload:}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'assert:\nreload:');
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'assert:');
    x.assert(p.elems[0].value[1].getOriginalCommand(), 'reload:');

    p = new Parser('block{reload: {"a":1}}');
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'reload: {"a":1}');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'reload: {"a":1}');

    p = inferredValues('block{ reload: |var| + (|var| * |var2|) }', {'var': 1, 'var2': 5});
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, ' reload: |var| + (|var| * |var2|) ');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'reload: |var| + (|var| * |var2|) ');

    p = new Parser(`block{
reload: {"a":1}
// tadam
}`);
    p.parse();
    x.assert(p.errors, []);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, '\nreload: {"a":1}\n// tadam\n');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].getOriginalCommand(), 'reload: {"a":1}');
}

const TO_CHECK = [
    {'name': 'css', 'func': checkCssParser},
    {'name': 'tuple', 'func': checkTuple},
    {'name': 'array', 'func': checkArray},
    {'name': 'ident', 'func': checkIdent},
    {'name': 'string', 'func': checkString},
    {'name': 'number', 'func': checkNumber},
    {'name': 'json', 'func': checkJson},
    {'name': 'comment', 'func': checkComment},
    {'name': 'expression', 'func': checkExpr},
    {'name': 'block', 'func': checkBlock},
];

async function checkParsers(x = new Assert()) {
    x.startTestSuite('parser', false);
    print('=> Starting parser tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        x.startTestSuite(TO_CHECK[i].name);
        try {
            TO_CHECK[i].func(x);
            x.endTestSuite();
        } catch (err) {
            x.endTestSuite(false, true);
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
    checkParsers().then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkParsers,
    };
}
