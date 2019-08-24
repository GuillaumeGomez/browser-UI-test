const process = require('process');
const Parser = require('../../src/parser.js').Parser;
const {Assert, plural, print} = require('./utils.js');

function checkTuple(x) {
    let p = new Parser('()');
    p.parse();
    x.assert(p.error, 'unexpected `()`: tuples need at least one argument');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'unexpected `()`: tuples need at least one argument');


    p = new Parser('("hello",');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `"hello"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, 'unexpected `,` after `"hello"`');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'string');


    p = new Parser('("hello", 2');
    p.parse();
    x.assert(p.error, 'expected `)` after `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` after `2`');
    x.assert(p.elems[0].getValue().length, 2);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'string');
    x.assert(p.elems[0].getValue()[1].error, null);
    x.assert(p.elems[0].getValue()[1].kind, 'number');


    p = new Parser('("hello", 2, true, {"a": {"b": 3}, "c": "d"},)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems[0].getValue().length, 4);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[1].error, null);
    x.assert(p.elems[0].getValue()[2].error, null);
    x.assert(p.elems[0].getValue()[3].error, null);


    p = new Parser('(true false)');
    p.parse();
    x.assert(p.error, 'expected `,`, found `f`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].getValue().length, 2);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), true);
    x.assert(p.elems[0].getValue()[1].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].getValue()[1].kind, 'char');
    x.assert(p.elems[0].getValue()[1].getValue(), 'f');


    p = new Parser('(true,,true)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getValue().length, 2);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), true);
    x.assert(p.elems[0].getValue()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getValue()[1].kind, 'char');
    x.assert(p.elems[0].getValue()[1].getValue(), ',');


    p = new Parser('(true|false)');
    p.parse();
    x.assert(p.error, 'expected `,`, found `|`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].getValue().length, 2);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), true);
    x.assert(p.elems[0].getValue()[1].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].getValue()[1].kind, 'char');
    x.assert(p.elems[0].getValue()[1].getValue(), '|');


    p = new Parser('(false)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), false);


    process.env['variable'] = 'hello';
    p = new Parser('(|variable|)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'string');
    x.assert(p.elems[0].getValue()[0].getValue(), 'hello');
    x.assert(p.elems[0].getValue()[0].getText(), 'hello');
    process.env['variable'] = undefined;


    p = new Parser('(false//)');
    p.parse();
    x.assert(p.error, 'expected `)` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].error, 'expected `)` after `false`');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), false);


    p = new Parser('(false,true)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue().length, 2);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), false);
    x.assert(p.elems[0].getValue()[1].error, null);
    x.assert(p.elems[0].getValue()[1].kind, 'bool');
    x.assert(p.elems[0].getValue()[1].getValue(), true);


    p = new Parser('(false,"s", (3, 12))');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getValue().length, 3);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), false);
    x.assert(p.elems[0].getValue()[1].error, null);
    x.assert(p.elems[0].getValue()[1].kind, 'string');
    x.assert(p.elems[0].getValue()[1].getValue(), 's');
    x.assert(p.elems[0].getValue()[1].getText(), '"s"');
    x.assert(p.elems[0].getValue()[2].error, null);
    x.assert(p.elems[0].getValue()[2].kind, 'tuple');
    x.assert(p.elems[0].getValue()[2].getValue().length, 2);
    x.assert(p.elems[0].getValue()[2].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[2].getValue()[0].kind, 'number');
    x.assert(p.elems[0].getValue()[2].getValue()[0].getValue(), '3');
    x.assert(p.elems[0].getValue()[2].getValue()[1].error, null);
    x.assert(p.elems[0].getValue()[2].getValue()[1].kind, 'number');
    x.assert(p.elems[0].getValue()[2].getValue()[1].getValue(), '12');


    p = new Parser('(false,"s",   {"a": "b"}, 3)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue().length, 4);
    x.assert(p.elems[0].getValue()[0].error, null);
    x.assert(p.elems[0].getValue()[0].kind, 'bool');
    x.assert(p.elems[0].getValue()[0].getValue(), false);
    x.assert(p.elems[0].getValue()[1].error, null);
    x.assert(p.elems[0].getValue()[1].kind, 'string');
    x.assert(p.elems[0].getValue()[1].getValue(), 's');
    x.assert(p.elems[0].getValue()[1].getText(), '"s"');
    x.assert(p.elems[0].getValue()[2].error, null);
    x.assert(p.elems[0].getValue()[2].kind, 'json');
    x.assert(p.elems[0].getValue()[2].getText(), '{"a": "b"}');
    x.assert(p.elems[0].getValue()[3].error, null);
    x.assert(p.elems[0].getValue()[3].kind, 'number');
    x.assert(p.elems[0].getValue()[3].getValue(), '3');
}

function checkBool(x) {
    let p = new Parser('false');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), false);


    p = new Parser('true');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), true);


    p = new Parser('     \t   false                 ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), false);


    p = new Parser('true,');
    p.parse();
    x.assert(p.error, 'expected nothing, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), true);
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,`');
    x.assert(p.elems[1].getValue(), ',');


    p = new Parser('tre');
    p.parse();
    x.assert(p.error, 'unexpected `tre` as first token');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'unknown');
    x.assert(p.elems[0].error, 'unexpected `tre` as first token');
    x.assert(p.elems[0].getValue(), 'tre');
}

function checkString(x) {
    let p = new Parser('"hello');
    p.parse();
    x.assert(p.error, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getValue(), 'hello');
    x.assert(p.elems[0].getText(), '"hello');


    p = new Parser('"hello\\"');
    p.parse();
    x.assert(p.error, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getValue(), 'hello\\"');
    x.assert(p.elems[0].getText(), '"hello\\"');


    p = new Parser('"hello"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), 'hello');
    x.assert(p.elems[0].getText(), '"hello"');


    p = new Parser('"hello\\""');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), 'hello\\"');
    x.assert(p.elems[0].getText(), '"hello\\""');


    p = new Parser('\'hello');
    p.parse();
    x.assert(p.error, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getValue(), 'hello');
    x.assert(p.elems[0].getText(), '\'hello');


    p = new Parser('\'hello\\\'');
    p.parse();
    x.assert(p.error, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getValue(), 'hello\\\'');
    x.assert(p.elems[0].getText(), '\'hello\\\'');


    p = new Parser('\'hello\'');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), 'hello');
    x.assert(p.elems[0].getText(), '\'hello\'');


    p = new Parser('\'hello\\\'\'');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), 'hello\\\'');
    x.assert(p.elems[0].getText(), '\'hello\\\'\'');
}

function checkNumber(x) {
    let p = new Parser('1');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), '1');


    p = new Parser('     \t   23                 ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), '23');


    p = new Parser('42,');
    p.parse();
    x.assert(p.error, 'expected nothing, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), '42');
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,`');
    x.assert(p.elems[1].getValue(), ',');


    p = new Parser('4.2');
    p.parse();
    x.assert(p.error, 'expected nothing, found `.`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), '4');
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `.`');
    x.assert(p.elems[1].getValue(), '.');
}

function checkJson(x) {
    let p = new Parser('{1: 2}');
    p.parse();
    x.assert(p.error, 'numbers cannot be used as keys (for `1`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'numbers cannot be used as keys (for `1`)');
    x.assert(p.elems[0].getText(), '{1');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].key.kind, 'number');
    x.assert(p.elems[0].getValue()[0].key.getText(), '1');
    x.assert(p.elems[0].getValue()[0].value === undefined);


    process.env['variable'] = '1';
    process.env['variable value'] = 'a';
    p = new Parser('{|variable|: 2}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{|variable|: 2}');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '1');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '2');

    p = new Parser('{|variable value|: |variable|}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{|variable value|: |variable|}');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), 'a');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '1');
    process.env['variable'] = undefined;
    process.env['variable value'] = undefined;


    p = new Parser('{true: 1}');
    p.parse();
    x.assert(p.error, 'booleans cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'booleans cannot be used as keys');
    x.assert(p.elems[0].getText(), '{true');


    p = new Parser('{{"a": 2}: 1}');
    p.parse();
    x.assert(p.error, 'JSON objects cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'JSON objects cannot be used as keys');
    x.assert(p.elems[0].getText(), '{{"a": 2}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'json');
    x.assert(p.elems[0].getValue()[0].key.getText(), '{"a": 2}');
    x.assert(p.elems[0].getValue()[0].value === undefined);


    p = new Parser('{x: 1}');
    p.parse();
    x.assert(p.error, 'unexpected `x` after `{`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `x` after `{`');
    x.assert(p.elems[0].getText(), '{x:');
    x.assert(p.elems[0].getValue()[0].key.kind, 'unknown');
    x.assert(p.elems[0].getValue()[0].key.getText(), 'x');
    x.assert(p.elems[0].getValue()[0].value === undefined);


    p = new Parser('{"x": y}');
    p.parse();
    x.assert(p.error, 'invalid value `y` for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'invalid value `y` for key `"x"`');
    x.assert(p.elems[0].getText(), '{"x": y}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'unknown');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'y');


    p = new Parser('{"x": 1,}');
    p.parse();
    x.assert(p.error, 'unexpected `,` before `}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `,` before `}`');
    x.assert(p.elems[0].getText(), '{"x": 1,}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '1');


    p = new Parser('{"x": y,}');
    p.parse();
    x.assert(p.error, 'invalid value `y` for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'invalid value `y` for key `"x"`');
    x.assert(p.elems[0].getText(), '{"x": y,');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'unknown');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'y');


    p = new Parser('{"x": }');
    p.parse();
    x.assert(p.error, 'unexpected `}` after `"x":`: expected a value');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `}` after `"x":`: expected a value');
    x.assert(p.elems[0].getText(), '{"x": }');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value === undefined);


    p = new Parser('{"x": "a"}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{"x": "a"}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'a');


    p = new Parser('{"x": "a" "y": 2}');
    p.parse();
    x.assert(p.error, 'expected `,` after `"a"`, found `"y"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` after `"a"`, found `"y"`');
    x.assert(p.elems[0].getText(), '{"x": "a" "y"');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'a');


    p = new Parser('{"x" 2}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems[0].getText(), '{"x" 2');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '2');


    p = new Parser('{"x" "a"}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `"a"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `"a"`');
    x.assert(p.elems[0].getText(), '{"x" "a"');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'a');


    p = new Parser('{"x", "a"}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems[0].getText(), '{"x",');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');


    p = new Parser('{"x": "a": "y": "b"}');
    p.parse();
    x.assert(p.error, 'expected `,` after `"a"`, found `:`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` after `"a"`, found `:`');
    x.assert(p.elems[0].getText(), '{"x": "a":');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'a');


    p = new Parser('{, "a"}');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `{`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `,` after `{`');
    x.assert(p.elems[0].getText(), '{,');


    p = new Parser('{"x": 2|"y": "a"}');
    p.parse();
    x.assert(p.error, 'unexpected `|` after `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `|` after `2`');
    x.assert(p.elems[0].getText(), '{"x": 2|');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '2');


    p = new Parser('{"x": 2,|"y": "a"}');
    p.parse();
    x.assert(p.error, 'expected `|` after the variable name `"y": "a"}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `|` after the variable name `"y": "a"}`');
    x.assert(p.elems[0].getText(), '{"x": 2,|"y": "a"}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '2');


    p = new Parser('{"x" {"y": 1}}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `{"y": 1}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `{"y": 1}`');
    x.assert(p.elems[0].getText(), '{"x" {"y": 1}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'json');
    x.assert(p.elems[0].getValue()[0].value.getText(), '{"y": 1}');
    x.assert(p.elems[0].getValue()[0].value.getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getValue()[0].key.getValue(), 'y');
    x.assert(p.elems[0].getValue()[0].value.getValue()[0].key.getText(), '"y"');
    x.assert(p.elems[0].getValue()[0].value.getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue()[0].value.getValue(), '1');


    p = new Parser('{"x" true}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `true`');
    x.assert(p.elems[0].getText(), '{"x" true');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'bool');
    x.assert(p.elems[0].getValue()[0].value.getValue(), true);


    p = new Parser('{"x": "a", "y": true, "z": 56}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getValue().length, 3);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{"x": "a", "y": true, "z": 56}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.isRecursive(), false);
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'a');
    x.assert(p.elems[0].getValue()[1].key.kind, 'string');
    x.assert(p.elems[0].getValue()[1].key.getText(), '"y"');
    x.assert(p.elems[0].getValue()[1].key.getValue(), 'y');
    x.assert(p.elems[0].getValue()[1].value.kind, 'bool');
    x.assert(p.elems[0].getValue()[1].value.getValue(), true);
    x.assert(p.elems[0].getValue()[1].value.isRecursive(), false);
    x.assert(p.elems[0].getValue()[2].key.kind, 'string');
    x.assert(p.elems[0].getValue()[2].key.getText(), '"z"');
    x.assert(p.elems[0].getValue()[2].key.getValue(), 'z');
    x.assert(p.elems[0].getValue()[2].value.kind, 'number');
    x.assert(p.elems[0].getValue()[2].value.isRecursive(), false);
    x.assert(p.elems[0].getValue()[2].value.getValue(), '56');


    p = new Parser('{"x": "a", "y":{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}, "z": 56}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getValue().length, 3);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(),
        '{"x": "a", "y":{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}, "z": 56}');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'x');
    x.assert(p.elems[0].getValue()[0].value.kind, 'string');
    x.assert(p.elems[0].getValue()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.getValue(), 'a');
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[1].key.getText(), '"y"');
    x.assert(p.elems[0].getValue()[1].key.getValue(), 'y');

    // Recursion hell check
    x.assert(p.elems[0].getValue()[1].value.kind, 'json');
    x.assert(p.elems[0].getValue()[1].value.getText(),
        '{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}');
    x.assert(p.elems[0].getValue()[1].value.getValue().length, 1);

    // welcome to level 1, young padawan
    const sub = p.elems[0].getValue()[1].value.getValue();
    x.assert(sub[0].key.kind, 'string');
    x.assert(sub[0].key.getText(), '"tadam"');
    x.assert(sub[0].key.getValue(), 'tadam');
    x.assert(sub[0].value.kind, 'json');
    x.assert(sub[0].value.getText(), '{"re":{"cur":{"sion":"yo"},"done": false}}');

    // welcome to level 2, knight
    const subsub = sub[0].value.getValue();
    x.assert(subsub.length, 1);
    x.assert(subsub[0].key.kind, 'string');
    x.assert(subsub[0].key.getText(), '"re"');
    x.assert(subsub[0].key.getValue(), 're');
    x.assert(subsub[0].value.kind, 'json');
    x.assert(subsub[0].value.getText(), '{"cur":{"sion":"yo"},"done": false}');

    // welcome to level 3, master
    const subsubsub = subsub[0].value.getValue();
    x.assert(subsubsub.length, 2);
    x.assert(subsubsub[0].key.kind, 'string');
    x.assert(subsubsub[0].key.getText(), '"cur"');
    x.assert(subsubsub[0].key.getValue(), 'cur');
    x.assert(subsubsub[0].value.kind, 'json');
    x.assert(subsubsub[0].value.getText(), '{"sion":"yo"}');
    x.assert(subsubsub[1].key.kind, 'string');
    x.assert(subsubsub[1].key.getText(), '"done"');
    x.assert(subsubsub[1].key.getValue(), 'done');
    x.assert(subsubsub[1].value.kind, 'bool');
    x.assert(subsubsub[1].value.getValue(), false);

    // welcome to level 4... json god?
    const subsubsubsub = subsubsub[0].value.getValue();
    x.assert(subsubsubsub.length, 1);
    x.assert(subsubsubsub[0].key.kind, 'string');
    x.assert(subsubsubsub[0].key.getText(), '"sion"');
    x.assert(subsubsubsub[0].key.getValue(), 'sion');
    x.assert(subsubsubsub[0].value.kind, 'string');
    x.assert(subsubsubsub[0].value.getText(), '"yo"');
    x.assert(subsubsubsub[0].value.getValue(), 'yo');

    // back to top \o/
    x.assert(p.elems[0].getValue()[2].key.kind, 'string');
    x.assert(p.elems[0].getValue()[2].key.getText(), '"z"');
    x.assert(p.elems[0].getValue()[2].key.getValue(), 'z');
    x.assert(p.elems[0].getValue()[2].value.kind, 'number');
    x.assert(p.elems[0].getValue()[2].value.getValue(), '56');
}

function checkComment(x) {
    let p = new Parser('1 // just a test');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), '1');


    p = new Parser('(1) //oups, a comment!');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].kind, 'number');
    x.assert(p.elems[0].getValue()[0].getValue(), '1');


    p = new Parser('(1//oups, an error!');
    p.parse();
    x.assert(p.error, 'expected `)` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` after `1`');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].kind, 'number');
    x.assert(p.elems[0].getValue()[0].getValue(), '1');


    p = new Parser('{"a": 1//oups, an error!');
    p.parse();
    x.assert(p.error, 'unclosed JSON object: expected `}` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unclosed JSON object: expected `}` after `1`');
    x.assert(p.elems[0].getValue().length, 1);
    x.assert(p.elems[0].getValue()[0].key.kind, 'string');
    x.assert(p.elems[0].getValue()[0].key.getValue(), 'a');
    x.assert(p.elems[0].getValue()[0].key.getText(), '"a"');
    x.assert(p.elems[0].getValue()[0].value.kind, 'number');
    x.assert(p.elems[0].getValue()[0].value.getValue(), '1');


    p = new Parser('"just a string// with a comment in the middle!"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getValue(), 'just a string// with a comment in the middle!');
    x.assert(p.elems[0].getText(), '"just a string// with a comment in the middle!"');
}

const TO_CHECK = [
    {'name': 'tuple', 'func': checkTuple},
    {'name': 'bool', 'func': checkBool},
    {'name': 'string', 'func': checkString},
    {'name': 'number', 'func': checkNumber},
    {'name': 'json', 'func': checkJson},
    {'name': 'comment', 'func': checkComment},
];

function checkCommands() {
    const x = new Assert();

    print('=> Starting parser tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        x.startTestSuite(TO_CHECK[i].name);
        try {
            TO_CHECK[i].func(x);
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
