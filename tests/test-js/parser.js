const process = require('process');
const Parser = require('../../src/parser.js').Parser;
const {Assert, plural, print} = require('./utils.js');

function checkTuple(x) {
    let p = new Parser('()');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('("hello",');
    p.parse();
    x.assert(p.error, 'expected `)` after `"hello"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, 'expected `)` after `"hello"`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('("hello",)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');


    p = new Parser('("hello", 2');
    p.parse();
    x.assert(p.error, 'expected `)` or `,` after `2`');
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
    x.assert(p.error, null);
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
    x.assert(p.error, 'expected `,` or `)`, found `f` after `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(true false)');
    x.assert(p.elems[0].error, 'expected `,` or `)`, found `f` after `true`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `)`, found `f` after `true`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'f');


    p = new Parser('(true,,true)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(true,,true)');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), ',');


    p = new Parser('(true|false)');
    p.parse();
    x.assert(p.error, 'expected `,` or `)`, found `|` after `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(true|false)');
    x.assert(p.elems[0].error, 'expected `,` or `)`, found `|` after `true`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `)`, found `|` after `true`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), '|');


    p = new Parser('(false)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(false)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    process.env['variable'] = 'hello';
    p = new Parser('(|variable|)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].getErrorText(), '(|variable|)');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'string');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'hello');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '"hello"');

    p = new Parser('(a, {"b": |variable|})');
    p.parse();
    x.assert(p.error, null);
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
    p = new Parser('(|variable|)');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, 'expected `)` or `,` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` or `,` after `false`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    p = new Parser('(false,true)');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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

    p = new Parser('(".result-" + |result_kind| + " ." + |result_kind|, {"color": |color|}, ALL)',
        {
            'result_kind': 'a',
            'color': 'b',
        },
    );
    p.parse();
    x.assert(p.error, null);
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

    p = new Parser('(1, ".result-" + |result_kind|, {"color": |color|}, ALL)',
        {
            'result_kind': 'a',
            'color': 'b',
        },
    );
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, 'expected `]` after `"hello"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].isRecursive(), true);
    x.assert(p.elems[0].error, 'expected `]` after `"hello"`');
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
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'json');


    p = new Parser('[true false]');
    p.parse();
    x.assert(p.error, 'expected `,` or `]`, found `f` after `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[true false]');
    x.assert(p.elems[0].error, 'expected `,` or `]`, found `f` after `true`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `]`, found `f` after `true`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), 'f');


    p = new Parser('[true,,true]');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[true,,true]');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), ',');


    p = new Parser('[true|false]');
    p.parse();
    x.assert(p.error, 'expected `,` or `]`, found `|` after `true`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[true|false]');
    x.assert(p.elems[0].error, 'expected `,` or `]`, found `|` after `true`');
    x.assert(p.elems[0].getRaw().length, 2);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'true');
    x.assert(p.elems[0].getRaw()[1].error, 'expected `,` or `]`, found `|` after `true`');
    x.assert(p.elems[0].getRaw()[1].kind, 'char');
    x.assert(p.elems[0].getRaw()[1].getRaw(), '|');


    p = new Parser('[false]');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].getErrorText(), '[false]');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    process.env['variable'] = 'hello';
    p = new Parser('[|variable|]');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, 'expected `]` or `,` after `false`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'array');
    x.assert(p.elems[0].error, 'expected `]` or `,` after `false`');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'boolean');
    x.assert(p.elems[0].getRaw()[0].getRaw(), 'false');


    p = new Parser('[false,true]');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false');

    p = new Parser('true');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
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
    x.assert(p.elems[0].kind, 'boolean');
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
    x.assert(p.error, 'expected nothing, found `,` after `true`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true');
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,` after `true`');
    x.assert(p.elems[1].getRaw(), ',');

    p = new Parser('aloha,');
    p.parse();
    x.assert(p.error, 'expected nothing, found `,` after `aloha`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'ident');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'aloha');
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,` after `aloha`');
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
    x.assert(p.elems[0].getErrorText(), '"hello');


    p = new Parser('"hello\\"');
    p.parse();
    x.assert(p.error, 'expected `"` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `"` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello\\"');
    x.assert(p.elems[0].getErrorText(), '"hello\\"');


    p = new Parser('"hello"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '"hello"');


    p = new Parser('"hello\\""');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello\\"');
    x.assert(p.elems[0].getErrorText(), '"hello\\""');


    p = new Parser('\'hello');
    p.parse();
    x.assert(p.error, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '\'hello');


    p = new Parser('\'hello\\\'');
    p.parse();
    x.assert(p.error, 'expected `\'` at the end of the string');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, 'expected `\'` at the end of the string');
    x.assert(p.elems[0].getRaw(), 'hello\\\'');
    x.assert(p.elems[0].getErrorText(), '\'hello\\\'');


    p = new Parser('\'hello\'');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello');
    x.assert(p.elems[0].getErrorText(), '\'hello\'');


    p = new Parser('\'hello\\\'\'');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello\\\'');
    x.assert(p.elems[0].getErrorText(), '\'hello\\\'\'');
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
    x.assert(p.error, 'expected nothing, found `,` after `42`');
    x.assert(p.elems.length, 2);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '42');
    x.assert(p.elems[0].isNegative, false);
    x.assert(p.elems[0].isFloat, false);
    x.assert(p.elems[1].kind, 'char');
    x.assert(p.elems[1].error, 'expected nothing, found `,` after `42`');
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
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found a number (`1`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a number (`1`)',
    );
    x.assert(p.elems[0].getErrorText(), '{1');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{-1: 2}');
    p.parse();
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found a number (`-1`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a number (`-1`)',
    );
    x.assert(p.elems[0].getErrorText(), '{-1');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{-1.2: 2}');
    p.parse();
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found a number (`-1.2`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a number (`-1.2`)',
    );
    x.assert(p.elems[0].getErrorText(), '{-1.2');
    x.assert(p.elems[0].getRaw().length, 0);


    process.env['variable'] = '1';
    process.env['variable_value'] = 'a';
    p = new Parser('{|variable|: 2}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{|variable|: 2}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"1"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');

    p = new Parser('{"a": |variable|}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"a": |variable|}');
    x.assert(p.elems[0].getRaw().length, 1);
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');

    p = new Parser('{|variable value|: |variable|}');
    p.parse();
    x.assert(p.error, 'unexpected character ` ` after `variable`');

    p = new Parser('{|variable_value|: |variable|}');
    p.parse();
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

    p = new Parser(`set-local-storage: {"rustdoc-theme": |theme|, \
"rustdoc-use-system-theme": "false"}
// removed comment
reload: 
reload://hello
assert-css: (".item-left sup", {"color": |color|})`);
    p.variables = {'theme': 'a'};
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
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found a boolean (`true`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a boolean (`true`)',
    );
    x.assert(p.elems[0].getErrorText(), '{true');


    p = new Parser('{hello: 1}');
    p.parse();
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found an ident (`hello`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found an ident (`hello`)',
    );
    x.assert(p.elems[0].getErrorText(), '{hello');


    p = new Parser('{{"a": 2}: 1}');
    p.parse();
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found a json (`{"a": 2}`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found a json (`{"a": 2}`)',
    );
    x.assert(p.elems[0].getErrorText(), '{{"a": 2}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{.1: 1}');
    p.parse();
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found an unknown item (`.`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found an unknown item (`.`)',
    );
    x.assert(p.elems[0].getErrorText(), '{.1: 1}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"a": []}');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, 'only strings can be used as keys in JSON dict, found an array (`[1, 2]`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'only strings can be used as keys in JSON dict, found an array (`[1, 2]`)',
    );
    x.assert(p.elems[0].getErrorText(), '{[1, 2]');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": .}');
    p.parse();
    x.assert(p.error, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems[0].getErrorText(), '{"x": .}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": 1,}');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `.` as first token for key `"x"`');
    x.assert(p.elems[0].getErrorText(), '{"x": .,}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": }');
    p.parse();
    x.assert(p.error, 'expected a value for key `"x"`, found nothing');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected a value for key `"x"`, found nothing');
    x.assert(p.elems[0].getErrorText(), '{"x": }');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": "a"}');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, 'expected `,` or `}` after `"a"`, found `"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` or `}` after `"a"`, found `"`');
    x.assert(p.elems[0].getErrorText(), '{"x": "a" "y": 2}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x" 2}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `2`');
    x.assert(p.elems[0].getErrorText(), '{"x" 2}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x" "a"}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `"`');
    x.assert(p.elems[0].getErrorText(), '{"x" "a"}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x", "a"}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `,`');
    x.assert(p.elems[0].getErrorText(), '{"x"');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": "a": "y": "b"}');
    p.parse();
    x.assert(p.error, 'unexpected `:` after key `"a"`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected `:` after key `"a"`');
    x.assert(p.elems[0].getErrorText(), '{"x": "a"');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{, "a"}');
    p.parse();
    x.assert(p.error, 'expected a key after `{`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'expected a key after `{`, found `,`',
    );
    x.assert(p.elems[0].getErrorText(), '{');


    p = new Parser('{"a": 1,,}');
    p.parse();
    x.assert(p.error, 'expected a key after `1`, found `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(
        p.elems[0].error,
        'expected a key after `1`, found `,`',
    );
    x.assert(p.elems[0].getErrorText(), '{"a": 1,');


    p = new Parser('{"x": 2|"y": "a"}');
    p.parse();
    x.assert(p.error, 'expected `,` or `}` after `2`, found `|`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `,` or `}` after `2`, found `|`');
    x.assert(p.elems[0].getErrorText(), '{"x": 2|"y": "a"}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": 2,|y: "a"}');
    p.parse();
    x.assert(p.error, 'unexpected character `:` after `y`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'unexpected character `:` after `y`');
    x.assert(p.elems[0].getErrorText(), '{"x": 2,|y:');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x"');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '2');


    p = new Parser('{"x" {"y": 1}}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `{`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `{`');
    x.assert(p.elems[0].getErrorText(), '{"x" {"y": 1}}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x" true}');
    p.parse();
    x.assert(p.error, 'expected `:` after `"x"`, found `t`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, 'expected `:` after `"x"`, found `t`');
    x.assert(p.elems[0].getErrorText(), '{"x" true}');
    x.assert(p.elems[0].getRaw().length, 0);


    p = new Parser('{"x": "a", "y": true, "z": 56}');
    p.parse();
    x.assert(p.error, null);
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
    x.assert(p.error, null);
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
    x.assert(p.error, 'unexpected token `}` after `{"x": 1}`');

    p = new Parser('({"x": 1}}');
    p.parse();
    x.assert(p.error, 'expected `,` or `)`, found `}` after `{"x": 1}`');

    p = new Parser('("hello",{"a": "1"))');
    p.parse();
    x.assert(p.error, 'expected `,` or `}` after `"1"`, found `)`');
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
    x.assert(p.error, 'expected `)` or `,` after `1`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` or `,` after `1`');
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
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"a"');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');


    p = new Parser('"just a string// with a comment in the middle!"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'just a string// with a comment in the middle!');
    x.assert(p.elems[0].getErrorText(), '"just a string// with a comment in the middle!"');
}

function checkExpr(x) {
    let p = new Parser('1 + + 1');
    p.parse();
    x.assert(p.error, 'expected element after operator `+`, found `+` (an operator)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw()[2].kind, 'operator');
    x.assert(
        p.elems[0].getRaw()[2].error,
        'expected element after operator `+`, found `+` (an operator)',
    );

    p = new Parser('+ 1 + 1');
    p.parse();
    x.assert(p.error, 'unexpected `+` as first token');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'unknown');
    x.assert(p.elems[0].error, 'unexpected `+` as first token');

    p = new Parser('1 + 2 && true');
    p.parse();
    x.assert(p.error, 'expected expression `1 + 2` to be evaluated as boolean, instead it was ' +
        'evaluated as number (in `1 + 2 && true`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, 'expected expression `1 + 2` to be evaluated as boolean, instead ' +
        'it was evaluated as number (in `1 + 2 && true`)');

    p = new Parser('1 + true');
    p.parse();
    x.assert(p.error, '`+` is not supported for boolean elements (in `1 + true`)');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, null);

    p = new Parser('1 + (1 + 3');
    p.parse();
    x.assert(p.error, 'missing `)` at the end of the expression started line 1');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'expression');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].error, null);
    x.assert(p.elems[0].getRaw()[1].kind, 'operator');
    x.assert(p.elems[0].getRaw()[2].kind, 'expression');
    x.assert(
        p.elems[0].getRaw()[2].error,
        'missing `)` at the end of the expression started line 1',
    );

    p = new Parser('[1, 2] == [3]');
    p.parse();
    x.assert(p.error, 'unexpected `[` after `==`');

    p = new Parser('{"1": 1} == {"a": 2}');
    p.parse();
    x.assert(p.error, 'unexpected `{` after `==`');

    p = new Parser('true == 1');
    p.parse();
    x.assert(p.error, '`==` cannot be used to compare boolean (`true`) and number (`1`) elements');
    p = new Parser('1 == true');
    p.parse();
    x.assert(p.error, '`==` cannot be used to compare number (`1`) and boolean (`true`) elements');

    p = new Parser('"a" == true');
    p.parse();
    x.assert(
        p.error, '`==` cannot be used to compare string (`"a"`) and boolean (`true`) elements');

    p = new Parser('"a" > true');
    p.parse();
    x.assert(
        p.error,
        '`>` is only supported for number elements, `"a"` (in `"a" > true`) was evaluated as ' +
            'string',
    );
    p = new Parser('1 > true');
    p.parse();
    x.assert(
        p.error,
        '`>` is only supported for number elements, `true` (in `1 > true`) was evaluated as ' +
            'boolean',
    );
    p = new Parser('1 > (true)');
    p.parse();
    x.assert(
        p.error,
        '`>` is only supported for number elements, `true` (in `1 > (true`) was evaluated as ' +
            'boolean',
    );

    p = new Parser('1 > (true || false)');
    p.parse();
    x.assert(
        p.error,
        '`>` is only supported for number elements, `true || false` (in `1 > (true || false`) ' +
            'was evaluated as boolean',
    );

    p = new Parser('1 == (true || false)');
    p.parse();
    x.assert(
        p.error,
        '`==` cannot be used to compare number (`1`) and boolean (`true || false`) elements',
    );

    p = new Parser('1 + "a" > 2');
    p.parse();
    x.assert(
        p.error,
        '`>` is only supported for number elements, `1 + "a"` (in `1 + "a" > 2`) was evaluated ' +
            'as string',
    );

    p = new Parser('1 + 1');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + 1');
    x.assert(p.elems[0].getErrorText(), '1 + 1');

    p = new Parser('1 + 1 +    4');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + 1 + 4');
    x.assert(p.elems[0].getErrorText(), '1 + 1 +    4');

    p = new Parser('"a" + "b" ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'ab');
    x.assert(p.elems[0].getErrorText(), '"a" + "b" ');

    p = new Parser('"a" +   "b"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'ab');
    x.assert(p.elems[0].getErrorText(), '"a" +   "b"');

    p = new Parser('"a" + 1 ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a1');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 ');

    p = new Parser('1 + "a" ');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1a');
    x.assert(p.elems[0].getErrorText(), '1 + "a" ');

    p = new Parser('1 + "a" + 4 +    "bcd"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1a4bcd');
    x.assert(p.elems[0].getErrorText(), '1 + "a" + 4 +    "bcd"');

    process.env['variable'] = 'hello';
    p = new Parser('|variable| + 2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'hello2');
    x.assert(p.elems[0].getErrorText(), '|variable| + 2');

    process.env['variable'] = '1';
    p = new Parser('|variable| + 2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + 2');
    x.assert(p.elems[0].getErrorText(), '|variable| + 2');
    process.env['variable'] = undefined;

    p = new Parser('1 + "" + 2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '12');
    x.assert(p.elems[0].getErrorText(), '1 + "" + 2');

    p = new Parser('1 + 2 + "a"');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '12a');
    x.assert(p.elems[0].getErrorText(), '1 + 2 + "a"');

    p = new Parser('"a" + 1 + 2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a12');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 + 2');

    p = new Parser('"a" + 1 + \n2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a12');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 + \n2');

    p = new Parser('"a" + 1 + // comment?\n2');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'string');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'a12');
    x.assert(p.elems[0].getErrorText(), '"a" + 1 + // comment?\n2');

    p = new Parser('{"x" + 2: 1,}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'json');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '{"x" + 2: 1,}');
    x.assert(p.elems[0].getRaw()[0].key.kind, 'string');
    x.assert(p.elems[0].getRaw()[0].key.getErrorText(), '"x" + 2');
    x.assert(p.elems[0].getRaw()[0].key.getRaw(), 'x2');
    x.assert(p.elems[0].getRaw()[0].value.kind, 'number');
    x.assert(p.elems[0].getRaw()[0].value.getRaw(), '1');

    p = new Parser('1 > 2 && true');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 > 2 && true');
    x.assert(p.elems[0].getErrorText(), '1 > 2 && true');

    p = new Parser('1 + (1 + 3)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + (1 + 3)');
    x.assert(p.elems[0].getErrorText(), '1 + (1 + 3)');

    p = new Parser('1 + (1 + |var| * (1 + (4 * (7 / |var|))))', {'var': 4});
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '1 + (1 + 4 * (1 + (4 * (7 / 4))))');
    x.assert(p.elems[0].getErrorText(), '1 + (1 + |var| * (1 + (4 * (7 / |var|))))');

    p = new Parser('true || |variable|', {'variable': true});
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true || true');
    x.assert(p.elems[0].getErrorText(), 'true || |variable|');

    p = new Parser('true || |variable| == "a"', {'variable': 'b'});
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'true || "b" == "a"');
    x.assert(p.elems[0].getErrorText(), 'true || |variable| == "a"');

    p = new Parser('(1 + 3, "a")');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getErrorText(), '(1 + 3, "a")');
    x.assert(p.elems[0].getRaw()[0].kind, 'number');
    x.assert(p.elems[0].getRaw()[0].getErrorText(), '1 + 3');
    x.assert(p.elems[0].getRaw()[1].kind, 'string');
    x.assert(p.elems[0].getRaw()[1].getErrorText(), '"a"');

    p = new Parser('(1 + 2) * 4');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'number');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), '((1 + 2)) * 4');
    x.assert(p.elems[0].getErrorText(), '(1 + 2) * 4');

    p = new Parser('|var| == (true || false)', {'var': false});
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'boolean');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].getRaw(), 'false == (true || false)');
    x.assert(p.elems[0].getErrorText(), '|var| == (true || false)');
}

function checkBlock(x) {
    let p = new Parser('block { reload:\n');
    p.parse();
    x.assert(p.error, 'Missing `}` to end the block');

    p = new Parser('block { hello: }');
    p.parse();
    x.assert(p.error, 'Unknown command "hello" (in `block { ... }`)');

    p = new Parser('block { reload:\n }');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, ' reload:\n ');
    x.assert(p.elems[0].value, 'block { reload:\n }');

    p = new Parser('block{reload:\n}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'reload:\n');
    x.assert(p.elems[0].value, 'block{reload:\n}');

    p = new Parser('block{assert:\nreload:\n}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'assert:\nreload:\n');
    x.assert(p.elems[0].value, 'block{assert:\nreload:\n}');

    // Without backline.
    p = new Parser('block{reload: { "a": 1 }');
    p.parse();
    x.assert(p.error, 'Missing `}` to end the block');

    p = new Parser('block{reload: { "a": "x }');
    p.parse();
    x.assert(p.error, 'expected `"` at the end of the string (in `block { ... }`)');

    p = new Parser('block{reload: ("a"), }');
    p.parse();
    x.assert(p.error, 'expected backline or `}`, found `,` after `("a")` (in `block { ... }`)');

    p = new Parser('block{assert:,reload: ("a") }');
    p.parse();
    x.assert(p.error, 'unexpected `,` as first token (in `block { ... }`)');

    p = new Parser('block{reload:}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'reload:');
    x.assert(p.elems[0].value, 'block{reload:}');

    p = new Parser('block{assert:\nreload:}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'assert:\nreload:');
    x.assert(p.elems[0].value, 'block{assert:\nreload:}');

    p = new Parser('block{reload: {"a":1}}');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'block');
    x.assert(p.elems[0].line, 1);
    x.assert(p.elems[0].blockCode, 'reload: {"a":1}');
    x.assert(p.elems[0].value, 'block{reload: {"a":1}}');
}

const TO_CHECK = [
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
