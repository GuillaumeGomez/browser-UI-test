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
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('("hello", 2');
    p.parse();
    x.assert(p.error, 'expected `)` after `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` after `2`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'number');


    p = new Parser('("hello", 2, true, {"a": {"b": 3}, "c": "d"},)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems[0].getRaw().length, 4);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[3].error, null);


    p = new Parser('(true false)');
    p.parse();
    x.assert(p.error, 'expected `,`, found `f`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(true false)');
    x.assert(p.elems[0].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'f');


    p = new Parser('(true,,true)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(true,,true)');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), ',');


    p = new Parser('(true|false)');
    p.parse();
    x.assert(p.error, 'expected `,`, found `|`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(true|false)');
    x.assert(p.elems[0].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), '|');


    p = new Parser('(false)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(false)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    process.env['variable'] = 'hello';
    p = new Parser('(|variable|)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(|variable|)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'hello');
    x.assert(p.elems[0].getRaw()[0].getText(), 'hello');
    process.env['variable'] = undefined;


    p = new Parser('(false//)');
    p.parse();
    x.assert(p.error, 'expected `)` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` after `false`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    p = new Parser('(false,true)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(false,true)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'bool');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'true');


    p = new Parser('(false,"s", (3, 12))');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(false,"s", (3, 12))');
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 's');
    x.assert(p.elems[0].getRaw()[1].getText(), '"s"');
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
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(false,"s",   {"a": "b"}, 3)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 4);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 's');
    x.assert(p.elems[0].getRaw()[1].getText(), '"s"');
    x.assert(p.elems[0].getRaw()[2].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'json');
    x.assert(p.elems[0].getRaw()[2].getText(), '{"a": "b"}');
    x.assert(p.elems[0].getRaw()[3].error, null);
    x.assert(p.elems[0].getRaw()[3].kind, 'number');
    x.assert(p.elems[0].getRaw()[3].getRaw(), '3');


    p = new Parser('(false,[1, 2])');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getText(), '(false,[1, 2])');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'array');
    x.assert(p.elems[0].getRaw()[1].getText(), '[1, 2]');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getRaw(), '1');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getRaw(), '2');
}

function checkArray(x) {
    let p = new Parser('[]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('["hello",');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `"hello"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, 'unexpected `,` after `"hello"`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('["hello", 2]');
    p.parse();
    x.assert(p.error,
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
    x.assert(p.error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'json');


    p = new Parser('[true false]');
    p.parse();
    x.assert(p.error, 'expected `,`, found `f`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[true false]');
    x.assert(p.elems[0].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'f');


    p = new Parser('[true,,true]');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[true,,true]');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), ',');


    p = new Parser('[true|false]');
    p.parse();
    x.assert(p.error, 'expected `,`, found `|`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[true|false]');
    x.assert(p.elems[0].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), '|');


    p = new Parser('[false]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[false]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    process.env['variable'] = 'hello';
    p = new Parser('[|variable|]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[|variable|]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'hello');
    x.assert(p.elems[0].getRaw()[0].getText(), 'hello');
    process.env['variable'] = undefined;


    p = new Parser('[false//]');
    p.parse();
    x.assert(p.error, 'expected `]` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, 'expected `]` after `false`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    p = new Parser('[false,true]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[false,true]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'bool');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'true');


    p = new Parser('[(3, 12), ("a", "b", "c")]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[(3, 12), ("a", "b", "c")]');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'tuple');
    x.assert(p.elems[0].getRaw()[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].getText(), '(3, 12)');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].getRaw(), '3');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].getRaw(), '12');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'tuple');
    x.assert(p.elems[0].getRaw()[1].getText(), '("a", "b", "c")');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getText(), '"a"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getRaw(), 'b');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getText(), '"b"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getRaw(), 'c');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getText(), '"c"');

    p = new Parser('[[3, 12], ["a", "b", "c"]]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getText(), '[[3, 12], ["a", "b", "c"]]');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'array');
    x.assert(p.elems[0].getRaw()[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].getText(), '[3, 12]');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[0].getRaw(), '3');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw()[1].getRaw(), '12');
    x.assert(p.elems[0].getRaw()[1].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'array');
    x.assert(p.elems[0].getRaw()[1].getText(), '["a", "b", "c"]');
    x.assert(p.elems[0].getRaw()[1].getRaw().length, 3);
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].getRaw()[0].getText(), '"a"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getRaw(), 'b');
    x.assert(p.elems[0].getRaw()[1].getRaw()[1].getText(), '"b"');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getRaw(), 'c');
    x.assert(p.elems[0].getRaw()[1].getRaw()[2].getText(), '"c"');
}

function checkIdent(x) {
    let p = new Parser('false');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false');

    p = new Parser('true');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true');

    p = new Parser('aloha');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');


    p = new Parser('     \t   false                 ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false');

    p = new Parser('     \t   aloha                 ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');


    p = new Parser('true,');
    p.parse();
    x.assert(p.error, 'expected nothing, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'bool');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true');
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,`');
    x.assert(p.elems[1].getRaw(), ',');

    p = new Parser('aloha,');
    p.parse();
    x.assert(p.error, 'expected nothing, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,`');
    x.assert(p.elems[1].getRaw(), ',');
}

function checkString(x) {
    let p = new Parser('"hello');
    p.parse();
    x.assert(p.error, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getText(), '"hello');


    p = new Parser('"hello\\"');
    p.parse();
    x.assert(p.error, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello\\"');
    x.assert(p.elems[0].getText(), '"hello\\"');


    p = new Parser('"hello"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getText(), '"hello"');


    p = new Parser('"hello\\""');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello\\"');
    x.assert(p.elems[0].getText(), '"hello\\""');


    p = new Parser('\'hello');
    p.parse();
    x.assert(p.error, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getText(), '\'hello');


    p = new Parser('\'hello\\\'');
    p.parse();
    x.assert(p.error, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello\\\'');
    x.assert(p.elems[0].getText(), '\'hello\\\'');


    p = new Parser('\'hello\'');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getText(), '\'hello\'');


    p = new Parser('\'hello\\\'\'');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello\\\'');
    x.assert(p.elems[0].getText(), '\'hello\\\'\'');
}

function checkNumber(x) {
    let p = new Parser('1');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('     \t   23                 ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '23');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('42,');
    p.parse();
    x.assert(p.error, 'expected nothing, found `,`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '42');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,`');
    x.assert(p.elems[1].getRaw(), ',');


    p = new Parser('4.2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '4.2');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('.2');
    p.parse();
    x.assert(p.error, 'unexpected `.` as first token');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'unknown');
    x.assert(p.elems[0].getRaw(), '.');
    x.assert(p.elems[0].error, 'unexpected `.` as first token');


    p = new Parser('0.1.2');
    p.parse();
    x.assert(p.error, 'unexpected `.` after `0.1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, 'unexpected `.` after `0.1`');
    x.assert(p.elems[0].getRaw(), '0.1');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('-0.1');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '-0.1');
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('-12');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '-12');
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('-12.1');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems[0].getRaw(), '-12.1');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('-12.');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems[0].getRaw(), '-12.');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);


    p = new Parser('--12');
    p.parse();
    x.assert(p.error, 'unexpected `-` after `-`');
    x.assert(p.elems[0].getRaw(), '-');
    x.assert(p.elems[0].error, 'unexpected `-` after `-`');
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('1-2');
    p.parse();
    x.assert(p.error, 'unexpected `-` after `1`');
    x.assert(p.elems[0].getRaw(), '1');
    x.assert(p.elems[0].error, 'unexpected `-` after `1`');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);


    p = new Parser('-0.2-');
    p.parse();
    x.assert(p.error, 'unexpected `-` after `-0.2`');
    x.assert(p.elems[0].getRaw(), '-0.2');
    x.assert(p.elems[0].error, 'unexpected `-` after `-0.2`');
    x.assert(p.elems[0].isNegative, true);
    x.assert(p.elems[0].isFloat, true);
}

function checkJson(x) {
    let p = new Parser('{1: 2}');
    p.parse();
    x.assert(p.error, '`1`: numbers cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, '`1`: numbers cannot be used as keys');
    x.assert(p.elems[0].getText(), '{1');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), '1');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    p = new Parser('{-1: 2}');
    p.parse();
    x.assert(p.error, '`-1`: numbers cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, '`-1`: numbers cannot be used as keys');
    x.assert(p.elems[0].getText(), '{-1');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '-1');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    p = new Parser('{-1.2: 2}');
    p.parse();
    x.assert(p.error, '`-1.2`: numbers cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, '`-1.2`: numbers cannot be used as keys');
    x.assert(p.elems[0].getText(), '{-1.2');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), '-1.2');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    process.env['variable'] = '1';
    process.env['variable value'] = 'a';
    p = new Parser('{|variable|: 2}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{|variable|: 2}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '1');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');

    p = new Parser('{|variable value|: |variable|}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{|variable value|: |variable|}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), 'a');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');
    process.env['variable'] = undefined;
    process.env['variable value'] = undefined;


    p = new Parser('{true: 1}');
    p.parse();
    x.assert(p.error, '`true`: booleans and idents cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, '`true`: booleans and idents cannot be used as keys');
    x.assert(p.elems[0].getText(), '{true');


    p = new Parser('{{"a": 2}: 1}');
    p.parse();
    x.assert(p.error, '`{"a": 2}`: JSON objects cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, '`{"a": 2}`: JSON objects cannot be used as keys');
    x.assert(p.elems[0].getText(), '{{"a": 2}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'json');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '{"a": 2}');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    p = new Parser('{.1: 1}');
    p.parse();
    x.assert(p.error, 'unexpected `.` after `{`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `.` after `{`');
    x.assert(p.elems[0].getText(), '{.');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'unknown');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '.');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    p = new Parser('{"a": []}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{"a": []}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'array');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '[]');
    x.assert(p.elems[0].getRaw()[0].value.getRaw().length, 0);


    p = new Parser('{"a": [1, 2]}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{"a": [1, 2]}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'array');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '[1, 2]');
    x.assert(p.elems[0].getRaw()[0].value.getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].getRaw(), '1');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[1].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[1].getRaw(), '2');


    p = new Parser('{[1, 2]: 1}');
    p.parse();
    x.assert(p.error, '`[1, 2]`: arrays cannot be used as keys');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, '`[1, 2]`: arrays cannot be used as keys');
    x.assert(p.elems[0].getText(), '{[1, 2]');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'array');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '[1, 2]');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    p = new Parser('{"x": .}');
    p.parse();
    x.assert(p.error, 'invalid value `.` for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'invalid value `.` for key `"x"`');
    x.assert(p.elems[0].getText(), '{"x": .');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'unknown');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '.');


    p = new Parser('{"x": 1,}');
    p.parse();
    x.assert(p.error, 'unexpected `,` before `}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `,` before `}`');
    x.assert(p.elems[0].getText(), '{"x": 1,}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');


    p = new Parser('{"x": .,}');
    p.parse();
    x.assert(p.error, 'invalid value `.` for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'invalid value `.` for key `"x"`');
    x.assert(p.elems[0].getText(), '{"x": .');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'unknown');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '.');


    p = new Parser('{"x": }');
    p.parse();
    x.assert(p.error, 'unexpected `}` after `"x":`: expected a value');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `}` after `"x":`: expected a value');
    x.assert(p.elems[0].getText(), '{"x": }');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value === undefined);


    p = new Parser('{"x": "a"}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{"x": "a"}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');


    p = new Parser('{"x": "a" "y": 2}');
    p.parse();
    x.assert(p.error, 'expected `,` after `"a"`, found `"y"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` after `"a"`, found `"y"`');
    x.assert(p.elems[0].getText(), '{"x": "a" "y"');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');


    p = new Parser('{"x" 2}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems[0].getText(), '{"x" 2');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = new Parser('{"x" "a"}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `"a"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `"a"`');
    x.assert(p.elems[0].getText(), '{"x" "a"');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');


    p = new Parser('{"x", "a"}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems[0].getText(), '{"x",');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');


    p = new Parser('{"x": "a": "y": "b"}');
    p.parse();
    x.assert(p.error, 'expected `,` after `"a"`, found `:`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` after `"a"`, found `:`');
    x.assert(p.elems[0].getText(), '{"x": "a":');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');


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
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = new Parser('{"x": 2,|"y": "a"}');
    p.parse();
    x.assert(p.error, 'expected `|` after the variable name `"y": "a"}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `|` after the variable name `"y": "a"}`');
    x.assert(p.elems[0].getText(), '{"x": 2,|"y": "a"}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = new Parser('{"x" {"y": 1}}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `{"y": 1}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `{"y": 1}`');
    x.assert(p.elems[0].getText(), '{"x" {"y": 1}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'json');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '{"y": 1}');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].key.getRaw(), 'y');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].key.getText(), '"y"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw()[0].value.getRaw(), '1');


    p = new Parser('{"x" true}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `true`');
    x.assert(p.elems[0].getText(), '{"x" true');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'bool');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'true');


    p = new Parser('{"x": "a", "y": true, "z": 56}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(), '{"x": "a", "y": true, "z": 56}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.isRecursive(), false);
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[1].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[1].key.getText(), '"y"');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), 'y');
    x.assert(p.elems[0].getRaw()[1].value.kind, 'bool');
    x.assert(p.elems[0].getRaw()[1].value.getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].value.isRecursive(), false);
    x.assert(p.elems[0].getRaw()[2].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[2].key.getText(), '"z"');
    x.assert(p.elems[0].getRaw()[2].key.getRaw(), 'z');
    x.assert(p.elems[0].getRaw()[2].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[2].value.isRecursive(), false);
    x.assert(p.elems[0].getRaw()[2].value.getRaw(), '56');


    p = new Parser('{"x": "a", "y":{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}, "z": 56}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].getRaw().length, 3);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getText(),
        '{"x": "a", "y":{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}, "z": 56}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].value.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[1].key.getText(), '"y"');
    x.assert(p.elems[0].getRaw()[1].key.getRaw(), 'y');

    // Recursion hell check
    x.assert(p.elems[0].getRaw()[1].value.kind, 'json');
    x.assert(p.elems[0].getRaw()[1].value.getText(),
        '{"tadam":{"re":{"cur":{"sion":"yo"},"done": false}}}');
    x.assert(p.elems[0].getRaw()[1].value.getRaw().length, 1);

    // welcome to level 1, young padawan
    const sub = p.elems[0].getRaw()[1].value.getRaw();
    x.assert(sub[0].key.kind, 'string');
    x.assert(sub[0].key.getText(), '"tadam"');
    x.assert(sub[0].key.getRaw(), 'tadam');
    x.assert(sub[0].value.kind, 'json');
    x.assert(sub[0].value.getText(), '{"re":{"cur":{"sion":"yo"},"done": false}}');

    // welcome to level 2, knight
    const subsub = sub[0].value.getRaw();
    x.assert(subsub.length, 1);
    x.assert(subsub[0].key.kind, 'string');
    x.assert(subsub[0].key.getText(), '"re"');
    x.assert(subsub[0].key.getRaw(), 're');
    x.assert(subsub[0].value.kind, 'json');
    x.assert(subsub[0].value.getText(), '{"cur":{"sion":"yo"},"done": false}');

    // welcome to level 3, master
    const subsubsub = subsub[0].value.getRaw();
    x.assert(subsubsub.length, 2);
    x.assert(subsubsub[0].key.kind, 'string');
    x.assert(subsubsub[0].key.getText(), '"cur"');
    x.assert(subsubsub[0].key.getRaw(), 'cur');
    x.assert(subsubsub[0].value.kind, 'json');
    x.assert(subsubsub[0].value.getText(), '{"sion":"yo"}');
    x.assert(subsubsub[1].key.kind, 'string');
    x.assert(subsubsub[1].key.getText(), '"done"');
    x.assert(subsubsub[1].key.getRaw(), 'done');
    x.assert(subsubsub[1].value.kind, 'bool');
    x.assert(subsubsub[1].value.getRaw(), 'false');

    // welcome to level 4... json god?
    const subsubsubsub = subsubsub[0].value.getRaw();
    x.assert(subsubsubsub.length, 1);
    x.assert(subsubsubsub[0].key.kind, 'string');
    x.assert(subsubsubsub[0].key.getText(), '"sion"');
    x.assert(subsubsubsub[0].key.getRaw(), 'sion');
    x.assert(subsubsubsub[0].value.kind, 'string');
    x.assert(subsubsubsub[0].value.getText(), '"yo"');
    x.assert(subsubsubsub[0].value.getRaw(), 'yo');

    // back to top \o/
    x.assert(p.elems[0].getRaw()[2].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[2].key.getText(), '"z"');
    x.assert(p.elems[0].getRaw()[2].key.getRaw(), 'z');
    x.assert(p.elems[0].getRaw()[2].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[2].value.getRaw(), '56');
}

function checkComment(x) {
    let p = new Parser('1 // just a test');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1');


    p = new Parser('(1) //oups, a comment!');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw(), '1');


    p = new Parser('(1//oups, an error!');
    p.parse();
    x.assert(p.error, 'expected `)` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` after `1`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getRaw(), '1');


    p = new Parser('{"a": 1//oups, an error!');
    p.parse();
    x.assert(p.error, 'unclosed JSON object: expected `}` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unclosed JSON object: expected `}` after `1`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'a');
    x.assert(p.elems[0].getRaw()[0].key.getText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');


    p = new Parser('"just a string// with a comment in the middle!"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'just a string// with a comment in the middle!');
    x.assert(p.elems[0].getText(), '"just a string// with a comment in the middle!"');
}

const TO_CHECK = [
    {'name': 'tuple', 'func': checkTuple},
    {'name': 'array', 'func': checkArray},
    {'name': 'ident', 'func': checkIdent},
    {'name': 'string', 'func': checkString},
    {'name': 'number', 'func': checkNumber},
    {'name': 'json', 'func': checkJson},
    {'name': 'comment', 'func': checkComment},
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
