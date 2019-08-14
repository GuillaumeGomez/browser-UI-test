const process = require('process');
const {
    Parser,
    Element,
    CharElement,
    TupleElement,
    StringElement,
    NumberElement,
    UnknownElement,
    JsonElement,
    BoolElement,
} = require('../../src/parser.js');
const {Assert, plural, print} = require('./utils.js');

function checkTuple() {
    const x = new Assert();

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
    x.assert(p.elems[0].error, 'unexpected `,` after `"hello"`');
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'string');


    p = new Parser('("hello", 2');
    p.parse();
    x.assert(p.error, 'expected `)` after `2`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `)` after `2`');
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'string');
    x.assert(p.elems[0].value[1].error, null);
    x.assert(p.elems[0].value[1].kind, 'number');


    p = new Parser('("hello", 2, true, {"a": {"b": 3}, "c": "d"},)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'unexpected `,` after `{"a": {"b": 3}, "c": "d"}`');
    x.assert(p.elems[0].value.length, 4);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[1].error, null);
    x.assert(p.elems[0].value[2].error, null);
    x.assert(p.elems[0].value[3].error, null);


    p = new Parser('(true false)');
    p.parse();
    x.assert(p.error, 'expected `,`, found `f`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'bool');
    x.assert(p.elems[0].value[0].getValue(), true);
    x.assert(p.elems[0].value[1].error, 'expected `,`, found `f`');
    x.assert(p.elems[0].value[1].kind, 'char');
    x.assert(p.elems[0].value[1].getValue(), 'f');


    p = new Parser('(true,,true)');
    p.parse();
    x.assert(p.error, 'unexpected `,` after `,`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'bool');
    x.assert(p.elems[0].value[0].getValue(), true);
    x.assert(p.elems[0].value[1].error, 'unexpected `,` after `,`');
    x.assert(p.elems[0].value[1].kind, 'char');
    x.assert(p.elems[0].value[1].getValue(), ',');


    p = new Parser('(true|false)');
    p.parse();
    x.assert(p.error, 'expected `,`, found `|`');
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'bool');
    x.assert(p.elems[0].value[0].getValue(), true);
    x.assert(p.elems[0].value[1].error, 'expected `,`, found `|`');
    x.assert(p.elems[0].value[1].kind, 'char');
    x.assert(p.elems[0].value[1].getValue(), '|');


    p = new Parser('(false)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].value.length, 1);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'bool');
    x.assert(p.elems[0].value[0].getValue(), false);


    p = new Parser('(false,true)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].value.length, 2);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'bool');
    x.assert(p.elems[0].value[0].getValue(), false);
    x.assert(p.elems[0].value[1].error, null);
    x.assert(p.elems[0].value[1].kind, 'bool');
    x.assert(p.elems[0].value[1].getValue(), true);


    p = new Parser('(false,"s",   {"a": "b"}, 3)');
    p.parse();
    x.assert(p.error, null);
    x.assert(p.elems.length, 1);
    x.assert(p.elems[0].kind, 'tuple');
    x.assert(p.elems[0].error, null);
    x.assert(p.elems[0].value.length, 4);
    x.assert(p.elems[0].value[0].error, null);
    x.assert(p.elems[0].value[0].kind, 'bool');
    x.assert(p.elems[0].value[0].getValue(), false);
    x.assert(p.elems[0].value[1].error, null);
    x.assert(p.elems[0].value[1].kind, 'string');
    x.assert(p.elems[0].value[1].getValue(), 's');
    x.assert(p.elems[0].value[2].error, null);
    x.assert(p.elems[0].value[2].kind, 'json');
    x.assert(p.elems[0].value[2].getValue(), {"a": "b"});
    x.assert(p.elems[0].value[2].getText(), '{"a": "b"}');
    x.assert(p.elems[0].value[3].error, null);
    x.assert(p.elems[0].value[3].kind, 'number');
    x.assert(p.elems[0].value[3].getValue(), '3');

    return x;
}

function checkBool() {
    const x = new Assert();

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

    return x;
}

function checkString() {
    const x = new Assert();

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

    return x;
}

function checkNumber() {
    const x = new Assert();

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

    return x;
}

const TO_CHECK = [
    {'name': 'tuple', 'func': checkTuple},
    {'name': 'bool', 'func': checkBool},
    {'name': 'string', 'func': checkString},
    {'name': 'number', 'func': checkNumber},
];

function checkCommands() {
    let nbErrors = 0;

    print('=> Starting parser tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        print(`==> Checking "${TO_CHECK[i].name}"...`);
        try {
            const errors = TO_CHECK[i].func();
            nbErrors += errors.errors;
            print(`<== "${TO_CHECK[i].name}": ${errors.errors} ${plural('error', errors.errors)} (in ` +
                  `${errors.ranTests} ${plural('test', errors.ranTests)})`);
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