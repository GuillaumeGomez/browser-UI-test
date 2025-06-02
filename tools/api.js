const process = require('process');
process.env.debug_tests = '1'; // We enable this to get all items from `commands.js`.

const parserFuncs = require('../src/commands.js');
const Options = require('../src/options.js').Options;
const { RESERVED_VARIABLE_NAME } = require('../src/utils.js');
const {Assert, plural, print, API_OUTPUT} = require('./utils.js');
const path = require('path');
const fs = require('fs');
const toml = require('@iarna/toml');

const uniqueFileOutput = Object.create(null);

// We don't use `toml.stringify` because we want to keep multi-line strings.
function writeToml(value, indent = '') {
    let out = '';
    if (value === null || typeof value === 'undefined') {
        // toml doesn't handle that.
    } else if (typeof value === 'string') {
        out += `"""${value.split('\\').join('\\\\').split('"').join('\\"')}"""`;
    } else if (typeof value === 'boolean') {
        out += `${value}`;
    } else if (typeof value === 'number') {
        out += `${value}`;
    } else if (Array.isArray(value)) {
        out += '[\n';
        for (const entry of value) {
            out += `${indent}${writeToml(entry, indent + '  ')},\n`;
        }
        out += ']';
    } else {
        for (const key of Object.keys(value)) {
            const entry = value[key];
            const sub = writeToml(entry, indent + '  ');
            if (sub.length !== 0) {
                out += `${indent}${key} = ${sub}\n`;
            }
        }
    }
    return out;
}

function wrapper(callback, x, arg, name, options) {
    if (typeof name === 'undefined') {
        x.addError(`Missing \`name\` argument in \`${callback.name}\``);
        return;
    }
    if (typeof options === 'undefined') {
        options = new Options();
    }
    let expected;
    const parent = path.join(API_OUTPUT, callback.name);
    const filePath = path.join(parent, `${name}.toml`);
    if (!Object.prototype.hasOwnProperty.call(uniqueFileOutput, callback.name)) {
        uniqueFileOutput[callback.name] = Object.create(null);
    }
    if (Object.prototype.hasOwnProperty.call(uniqueFileOutput[callback.name], name)) {
        x.addError(`There is already a test named \`${name}\` in \`${callback.name}\``);
        return;
    }
    uniqueFileOutput[callback.name][name] = true;

    if (fs.existsSync(filePath)) {
        try {
            expected = toml.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (err) {
            expected = err;
        }
    } else {
        expected = `no file \`${filePath}\``;
    }
    const context = new parserFuncs.ParserWithContext('<test>', options, 'go-to:' + arg);
    let res;
    if (context.get_parser_errors().length !== 0) {
        res = {'error': context.get_parser_errors().map(e => e.message).join('\n')};
    } else {
        const inferred = context.get_current_command().getInferredAst(context.variables, {});
        if (inferred.errors.length !== 0) {
            res = {'error': inferred.errors.map(e => e.message).join('\n')};
        } else {
            context.elems = inferred.ast;
            res = callback(context, options);
        }
    }
    if (res.error !== undefined) {
        // We remove fields we don't care about.
        res = {'error': res.error};
    }
    if (!x.assertOrBless(res, expected, (value1, _) => {
        if (!fs.existsSync(parent)) {
            fs.mkdirSync(parent, { recursive: true });
        }
        if (value1.error !== undefined) {
            // To prevent putting too much internal information into the blessed file.
            value1 = { 'error': value1.error };
        }
        fs.writeFileSync(filePath, writeToml(value1));
        print(`Blessed \`${filePath}\``);
    }) && !x.blessEnabled) {
        print(`failed for check \`${name}\` (in \`${filePath}\``);
    }
}

function wrapperParseContent(arg, options) {
    if (typeof options === 'undefined') {
        options = new Options();
    }
    const parser = new parserFuncs.ParserWithContext('<test>', options, arg);
    if (parser.get_parser_errors().length !== 0) {
        return parser.get_parser_errors();
    }
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

function wrapperDefineFunction(callback, arg, options) {
    if (typeof options === 'undefined') {
        options = new Options();
    }

    const context = new parserFuncs.ParserWithContext('<test>', options, 'go-to:' + arg);
    if (context.get_parser_errors().length !== 0) {
        return [{'error': context.get_parser_errors().map(e => e.message).join('\n')}, context];
    }
    const inferred = context.get_current_command().getInferredAst(context.variables, {});
    context.elems = inferred.ast;
    return [callback(context, options), context];
}

function checkAssert(x, func) {
    func('"', 'err-quote');
    func('1', 'err-int');
    func('1.1', 'err-float');
    func('(a, "b")', 'err-tuple');
    func('("a", 2)', 'err-tuple-2');
    func('()', 'err-tuple-3');

    func('"a"', 'css-1');
    func('("a")', 'css-2');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');

    // Multiline
    func('(\n"//a")', 'multiline');

    // Multiline string.
    func('"//a\nhello"', 'multiline-2');

    // bool
    func('1 > 2 + 3', 'bool-1');
    func('1 >= 2 / (3 + 6)', 'bool-2');
    func('{"a": 1} == {"a": 2}', 'bool-3');
    func('{"a": 1} != {"a": 2}', 'bool-4');
    func('["a", "b"] == ["a", "c"]', 'bool-5');
    func('["a", "b"] != ["a", "c"]', 'bool-6');
    func('("a", 1) == ("a", 2)', 'bool-7');
    func('("a", 1) != ("a", 2)', 'bool-8');
    func('(2 + 1) >= (1 / 2)', 'bool-9');
    func('["\\a", "b"] != ["a", "c"]', 'bool-10');
}

function checkAssertAttribute(x, func) {
    func('("a", "b", )', 'err-1');
    func('("a", "b")', 'err-2');
    func('("a", "b" "c")', 'err-3');
    func('("a", "b" "c", ALL)', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a::after", {"a": 1}, all)', 'err-6');
    func('("a::after", {"a": 1}, ALLO)', 'err-7');
    func('("a", {"b": "c", "b": "d"})', 'err-8');

    func('("a", {})', 'css-empty');
    func('("a", {"a": 1})', 'basic-1');
    func('("a", {"a": 1}, ALL)', 'basic-2');

    // Check the handling of pseudo elements
    func('("a::after", {"a": 1})', 'pseudo-1');
    func('("a::after", {"a": 1}, ALL)', 'pseudo-2');
    func('("b:after", {"a": 1})', 'pseudo-3');
    func('("b:after", {"a": 1}, ALL)', 'pseudo-4');
    func('("a ::after", {"a": 1})', 'pseudo-5');
    func('("a ::after", {"a": 1}, ALL)', 'pseudo-6');

    func('("a", {"b": "c", "d": "e"})', 'css-1');
    func('("a", {"b": "c", "d": "e"}, ALL)', 'css-all');
    func('("a", {"\\"b": "c"})', 'css-quote-1');
    func('("a", {"\\"b": "c"}, ALL)', 'css-quote-2');
    func('("a", {"\\"b": "c"}, CONTAINS)', 'css-quote-3');
    func('("a", {"\\"b": "c"}, [CONTAINS, CONTAINS])', 'css-quote-4');
    func('("a", {"\\"b": "c"}, [CONTAINS, STARTS_WITH])', 'css-quote-5');
    func('("a", {"\\"b": "c"}, [CONTAINS, STARTS_WITH, ALL])', 'css-quote-6');
    func('("a", {"\\"b": "c"}, [CONTAINS, NEAR])', 'css-quote-7');

    // null checks
    func('("a", {"\\"b": null, "a": "c"})', 'null-1');
    func('("a", {"\\"b": null, "a": "c"}, [ALL])', 'null-2');
    func('("a", {"\\"b": null, "a": "c"}, CONTAINS)', 'null-3');
    func('("a", {"\\"b": null, "a": "c"}, [CONTAINS, STARTS_WITH, ALL])', 'null-4');

    // XPath
    func('("//a", {})', 'xpath-1');
    func('("//a", {"b": "c"})', 'xpath-2');
    func('("//a", {"b": "c"}, ALL)', 'xpath-3');

    // Multiline
    func('("a::after", \n {"a": 1}, \n ALLO)', 'multiline-1');
    func('("//a",\n    \n{"b": "c"}, \n ALL)', 'multiline-2');
}

function checkAssertClipboard(x, func) {
    func('1', 'err-1');
    func('("a", {})', 'err-2');
    func('("a", [A])', 'err-3');
    func('("a", [ALL])', 'err-4');

    func('"a"', 'basic-1');
    func('("a",)', 'basic-2');
    func('("a", CONTAINS)', 'basic-3');
    func('("a", [CONTAINS])', 'basic-4');
}

function checkAssertCount(x, func) {
    func('("a", 1, "c")', 'err-1');
    func('("a", 1 2)', 'err-2');
    func('("a", 1 a)', 'err-3');
    func('("a", -1)', 'err-4');
    func('("a", -1.0)', 'err-5');
    func('("a", 1.0)', 'err-6');

    func('("a", 1)', 'css-1');

    // Check the handling of pseudo elements
    func('("a::after", 1)', 'pseudo-1');
    func('("a:focus", 1)', 'pseudo-2');
    func('("a :focus", 1)', 'pseudo-3');
    func('("a ::after", 1)', 'pseudo-4');

    // Multiline
    func('("a", \n-1)', 'multiline-1');
    func('("a ::after"\n,\n 1)', 'multiline-2');
}

function checkAssertObjProperty(x, func) {
    func('["a"]', 'err-1');
    func('("a", "b", )', 'err-2');
    func('("a", "b")', 'err-3');
    func('("a", "b" "c")', 'err-4');
    func('("a", "b" "c", ALL)', 'err-5');
    func('({"a": "b"}, all)', 'err-6');
    func('("a::after", {"a": 1}, ALLO)', 'err-7');
    func('({"b": "c", "b": "d"})', 'err-8');
    func('({"": "b"})', 'err-9');
    func('  ["a"]', 'err-10');

    func('{"a": "b"}', 'basic-1');
    func('({"a": "b"})', 'basic-2');

    func('({"a": "b"}, CONTAINS)', 'extra-1');
    func('({"a": "b"}, STARTS_WITH)', 'extra-2');
    func('({"a": "b"}, ENDS_WITH)', 'extra-3');
    func('({"a": "b"}, [STARTS_WITH, ENDS_WITH])', 'extra-4');
    func('({"a": "b"}, [STARTS_WITH, NEAR])', 'extra-5');

    func('({"a": undefined})', 'null-1');
    func('({"a": null})', 'null-2');
    func('({"a": null}, ENDS_WITH)', 'null-3');
    func('({"a": null}, [STARTS_WITH, NEAR])', 'null-4');
    func('({"a": null, "b": "12"}, [STARTS_WITH, NEAR])', 'null-5');

    // object-path
    func('{"a"."b": "b"}', 'object-path-1');
    func('({"a"."b": "b"}, CONTAINS)', 'object-path-2');
    func('({"a"."b": null})', 'object-path-3');
    func('({"a"."b": null}, CONTAINS)', 'object-path-4');
}

function checkBlockNetworkRequest(x, func) {
    func('"', 'err-quote');
    func('"x', 'err-quote-2');
    func('1', 'err-int');
    func('1.1', 'err-float');
    func('(a, "b")', 'err-tuple');
    func('("a", 2)', 'err-tuple-2');
    func('()', 'err-tuple-3');
    func('("x")', 'err-tuple-4');
    func('"x"', 'ok');
}

function checkAssertVariable(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, b)', 'err-6');

    func('(a, {"b": "a"})', 'basic-1');
    func('(VAR, "a")', 'basic-2');

    func('(VAR, "\'a")', 'basic-3');
    func('(VAR, 1)', 'basic-4');
    func('(VAR, 1.28)', 'basic-5');

    func('(VAR, "a", [CONTAINS])', 'extra-1');
    func('(VAR, "a", [STARTS_WITH])', 'extra-2');
    func('(VAR, "a", [ENDS_WITH])', 'extra-3');
    func('(VAR, "a", [STARTS_WITH, CONTAINS, ENDS_WITH])', 'extra-4');
    func('(VAR, "a", [STARTS_WITH, NEAR])', 'extra-5');
}

function checkAssertCss(x, func) {
    func('("a", "b", )', 'err-1');
    func('("a", "b")', 'err-2');
    func('("a", "b" "c")', 'err-3');
    func('("a", "b" "c", ALL)', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a::after", {"a": 1}, all)', 'err-6');
    func('("a::after", {"a": 1}, ALLO)', 'err-7');
    func('("a", {"b": "c", "b": "d"})', 'err-8');
    func('("a", {"b": ""})', 'err-9');
    func('("a", {"": "b"})', 'err-10');

    func('("a", {})', 'css-1');
    func('("a", {"a": 1})', 'css-2');
    func('("a", {"a": 1}, ALL)', 'css-3');

    // Check the handling of pseudo elements
    func('("a::after", {"a": 1})', 'pseudo-1');
    func('("a::after", {"a": 1}, ALL)', 'pseudo-2');
    func('("a:focus", {"a": 1})', 'pseudo-3');
    func('("a:focus", {"a": 1}, ALL)', 'pseudo-4');
    func('("a ::after", {"a": 1})', 'pseudo-5');
    func('("a ::after", {"a": 1}, ALL)', 'pseudo-6');

    // XPath
    func('("//a", {})', 'xpath-1');
    func('("//a", {"a": 1})', 'xpath-2');
    func('("//a", {"a": 1}, ALL)', 'xpath-3');
    func('("//a", {"a": 1, "b": 2})', 'xpath-4');
    func('("//a", {"a": 1, "b": 2}, ALL)', 'xpath-5');

    // Multiline
    func('("a", {"b": \n"c"\n, "b": "d"})', 'multiline-1');
    func('("//a"\n, \n{"a": \n1, \n"b": \n2}\n, \nALL)', 'multiline-2');

    // Check the specially added check if "color" is used.
    func('("a", {"color": 1})', 'color-1');
}

function checkAssertLocalStorage(x, func) {
    func('hello', 'err-1');
    // func('{').error !== undefined; // JSON syntax error
    func('{"a": x}', 'err-3');
    func('{"a": {"a": "x"}}', 'err-4');

    func('{"a": 1}', 'basic-1');
    func('{"a": "1"}', 'basic-2');
    func('{"a": "1", "b": "2px"}', 'basic-3');

    // Multiline
    func('{"a"\n: \n"1"}', 'multiline-1');
}

function checkAssertProperty(x, func) {
    func('("a", "b", )', 'err-1');
    func('("a", "b")', 'err-2');
    func('("a", "b" "c")', 'err-3');
    func('("a", "b" "c", ALL)', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a::after", {"a": 1}, all)', 'err-6');
    func('("a::after", {"a": 1}, ALLO)', 'err-7');
    func('("a", {"b": "c", "b": "d"})', 'err-8');
    func('("a", {"b": []})', 'err-9');
    func('("a", {"b": gateau})', 'err-10');

    func('("a", {})', 'basic-1');
    func('("a", {"a": 1})', 'basic-2');
    func('("a", {"a": 1}, ALL)', 'basic-3');

    func('("a", {"a"."b": 1})', 'object-path-1');
    func('("a", {"a"."b": 1}, ALL)', 'object-path-2');

    // Check the handling of pseudo elements
    func('("a::after", {"a": 1})', 'pseudo-1');
    func('("a::after", {"a": 1}, ALL)', 'pseudo-2');
    func('("a:focus", {"a": 1})', 'pseudo-3');
    func('("a:focus", {"a": 1}, ALL)', 'pseudo-4');
    func('("a ::after", {"a": 1})', 'pseudo-5');
    func('("a ::after", {"a": 1}, ALL)', 'pseudo-6');

    // XPath
    func('("//a", {})', 'xpath-1');
    func('("//a", {"a": 1})', 'xpath-2');
    func('("//a", {"a": 1}, ALL)', 'xpath-3');

    // Multiline
    func('("a", \n{"b"\n:\n []})', 'multiline-1');
    func('("//a"\n, \n{"a": \n1},\n ALL)', 'multiline-2');

    // Extended checks.
    func('("a", {"a": 1}, STARTS_WITH)', 'extra-1');
    func('("a", {"a": 1}, [STARTS_WITH, STARTS_WITH])', 'extra-2');
    func('("a", {"a": 1}, [STARTS_WITH, ENDS_WITH])', 'extra-3');

    // 'null' ident
    func('("a", {"b": null})', 'undef-1');
    func('("a", {"a": null}, [STARTS_WITH, STARTS_WITH])', 'undef-2');
    func('("a", {"b"."c": null})', 'undef-3');
    func('("a", {"a"."b": null}, [STARTS_WITH, STARTS_WITH])', 'undef-4');
}

function checkAssertWaitPosition(x, func) {
    func('("a", "b", )', 'err-1');
    func('("a", "b")', 'err-2');
    func('("a", "b" "c")', 'err-3');
    func('("a", "b" "c", ALL)', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a::after", {"x": 1}, all)', 'err-6');
    func('("a::after", {"x": 1}, ALLO)', 'err-7');
    func('("a", {"b": "c", "b": "d"})', 'err-8');
    func('("a", {"b": ""})', 'err-9');
    func('("a", {"z": 12})', 'err-10');

    func('("a", {})', 'basic-1');
    func('("a", {"x": 1})', 'basic-2');
    func('("a", {"x": 1}, ALL)', 'basic-3');
    func('("a", {"y": 1})', 'basic-4');

    // Check the handling of pseudo elements
    func('("a::after", {"x": 1})', 'pseudo-1');
    func('("a::after", {"y": 1})', 'pseudo-2');
    func('("a:focus", {"x": 1})', 'pseudo-3');
    func('("a:focus", {"x": 1}, ALL)', 'pseudo-4');
    func('("a ::after", {"x": 1})', 'pseudo-5');
    func('("a ::after", {"x": 1}, ALL)', 'pseudo-6');
    // With decimal.
    func('("a ::after", {"x": 1.14}, ALL)', 'pseudo-7');

    // XPath
    func('("//a", {})', 'xpath-1');
    func('("//a", {"x": 1})', 'xpath-2');
    func('("//a", {"x": 1}, ALL)', 'xpath-3');
    func('("//a", {"x": 1, "y": 2})', 'xpath-4');
    func('("//a", {"x": 1, "y": 2}, ALL)', 'xpath-5');

    // Multiline
    func('("a", {"x": \n1\n, "x": 2})', 'multiline-1');
    func('("//a"\n, \n{"x": \n1, \n"y": \n2}\n, \nALL)', 'multiline-2');
}

function checkAssertText(x, func) {
    func('("a", )', 'err-1');
    func('("a", "b" "c")', 'err-2');
    func('("a", 2)', 'err-3');
    func('("a")', 'err-4');
    func('("a", "b", ALLO)', 'err-5');
    func('("a", "b", [ALLO])', 'err-6');
    func('("a", "b", "c")', 'err-7');
    func('("a", "b", ["c"])', 'err-8');

    // Checking pseudo element.
    func('("a::after", "\'b")', 'pseudo-1');

    // Checking that having a pending comma is valid.
    func('("a", "\'b",)', 'basic-1');
    func('("a", "\'b")', 'basic-2');
    func('("a", "\'b", ALL)', 'basic-3');
    // Ensure that wrapping `ALL` into an array is also accepted.
    func('("a", "\'b", [ALL])', 'basic-4');
    func('("a", "b")', 'basic-5');
    func('("a", "b", ALL)', 'basic-6');
    func('("a", "b", CONTAINS)', 'basic-7');
    func('("a", "b", STARTS_WITH)', 'basic-8');
    func('("a", "b", ENDS_WITH)', 'basic-9');
    func('("a", "b", [CONTAINS, ENDS_WITH])', 'basic-10');
    // If an identifier is present more than once, we check that there is a warning about it.
    func('("a", "b", [CONTAINS, ENDS_WITH, CONTAINS])', 'basic-11');
    // Checking that the warning is not duplicated.
    func('("a", "b", [CONTAINS, ENDS_WITH, CONTAINS, CONTAINS])', 'basic-12');
    func('("a", "b", [ALL, CONTAINS])', 'basic-13');
    func('("a", "b", [ALL, CONTAINS, STARTS_WITH])', 'basic-14');

    // XPath
    func('("//a", "b")', 'xpath-1');
    func('("//a", "b", ALL)', 'xpath-2');
    func('("//a", "b", [ALL])', 'xpath-3');

    // Check correct escape of `'`.
    func('("//a[text()=\'l\']", "b", [ALL])', 'xpath-4');

    // Multiline
    func('("a", \n2\n)', 'multiline-1');
    func('("//a"\n, \n"b",\n ALL)', 'multiline-2');
}

function checkAssertSize(x, func) {
    func('("a", "b", )', 'err-1');
    func('("a", "b")', 'err-2');
    func('("a", "b" "c")', 'err-3');
    func('("a", "b" "c", ALL)', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a::after", {"width": 1}, all)', 'err-6');
    func('("a::after", {"height": 1}, ALLO)', 'err-7');
    func('("a", {"b": "c", "b": "d"})', 'err-8');
    func('("a", {"width": ""})', 'err-9');
    func('("a", {"z": 12})', 'err-10');

    func('("a", {})', 'basic-1');
    func('("a", {"width": 1})', 'basic-2');
    func('("a", {"width": 1}, ALL)', 'basic-3');
    func('("a", {"height": 1})', 'basic-4');
    func('("a", {"height": 1}, ALL)', 'basic-5');

    // Check the handling of pseudo elements
    func('("a::after", {"width": 1})', 'pseudo-1');
    func('("a::after", {"height": 1})', 'pseudo-2');
    func('("a:focus", {"width": 1})', 'pseudo-3');
    func('("a:focus", {"height": 1}, ALL)', 'pseudo-4');
    func('("a ::after", {"width": 1})', 'pseudo-5');
    func('("a ::after", {"height": 1}, ALL)', 'pseudo-6');
    // With decimal.
    func('("a ::after", {"width": 1.14}, ALL)', 'pseudo-7');

    // XPath
    func('("//a", {})', 'xpath-1');
    func('("//a", {"width": 1})', 'xpath-2');
    func('("//a", {"width": 1}, ALL)', 'xpath-3');
    func('("//a", {"width": 1, "height": 2})', 'xpath-4');
    func('("//a", {"width": 1, "height": 2}, ALL)', 'xpath-5');

    // Multiline
    func('("a", {"width": \n1\n, "width": 2})', 'multiline-1');
    func('("//a"\n, \n{"width": \n1, \n"height": \n2}\n, \nALL)', 'multiline-2');
}

function checkAttributeProperty(x, func) {
    func('"', 'err-1');
    func('("a", "b"', 'err-2');
    func('("a")', 'err-3');
    func('("a", )', 'err-4');
    func('("a", "b", )', 'err-5');
    func('("a", )', 'err-6');
    func('("a", "b" "c")', 'err-7');
    func('("a", "b")', 'err-8');
    func('("a", "b", "c", ALL)', 'err-9');
    func('("x", {"a": {"a": "x"}})', 'err-10');
    func('("x", {"a": ["a"]})', 'err-11');
    func('("x", {"a": a})', 'err-12');
    func('("x", "a", a)', 'err-13');
    func('("a", "b", "c")', 'err-14');
    func('("a", {"b": null}', 'err-15');
    func('("a", {"b": id})', 'err-16');

    func('("a", {"\\"b": "c"})', 'basic-1');
    func('("a", {"b": "\\"c"})', 'basic-2');
    func('("a", {"b": "c"})', 'basic-3');
    func('("a", {"b": "c", "d": "e"})', 'basic-4');
    func('("a", {"b": null})', 'basic-5');
    func('("a", {"b": null, "a": "b"})', 'basic-6');
    // This one will fail for `set-css`.
    func('("a", {"b": true})', 'basic-7');
    func('("a", {"b": 12})', 'basic-8');

    // XPath
    func('("/a", "b", "c")', 'xpath-1');
    func('("//a", "b", "c")', 'xpath-2');
    func('("//a", {"b": "c"})', 'xpath-3');

    // Multiline
    func('("a", \n{""\n: "c"})', 'multiline-1');
    func('("//a"\n,\n {"b":\n "c"})', 'multiline-2');

    // Multiline string.
    func('("//a", {"b": "c\n"})', 'multiline-3');

    // object-path
    func('("a", {"b"."a": "c"})', 'object-path-1');
    func('("a", {"b"."a": "c", "d": "x"})', 'object-path-2');
}

function checkClick(x, func) {
    // Check position
    func('hello', 'err-1');
    func('()', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1,)', 'err-5');
    func('(1,,2)', 'err-6');
    func('(,2)', 'err-7');
    func('(a,2)', 'err-8');
    func('(-1.0,2)', 'err-9');
    func('(1.0,2)', 'err-10');
    func('(2,-1.0)', 'err-11');
    func('(2,1.0)', 'err-12');
    func('(-1,2)', 'err-13');
    func('(-2,1)', 'err-14');

    func('(1,2,)', 'pos-1');
    func('(1,2)', 'pos-2');

    // Check css selector
    func('"', 'basic-1');
    func('\'', 'basic-2');
    func('\'\'', 'basic-3');
    func('"a"', 'basic-4');
    func('"a::before"', 'basic-5');
    func('\'a\'', 'basic-6');
    func('\'"a\'', 'basic-7');
    // On pseudo element.
    func('"a::after"', 'basic-8');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');

    // Multiline
    func('(a\n,\n2)', 'multiline-1');
    func('(\n-2\n,\n1)', 'multiline-2');
    func('(1,2,)', 'multiline-3');
}

function checkClickWithOffset(x, func) {
    // Check position
    func('hello', 'err-1');
    func('()', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1,)', 'err-5');
    func('("a",)', 'err-6');
    func('(1,2)', 'err-7');
    func('("a",{"a":"b"})', 'err-8');
    func('("a",{"a":{"a": "b"}})', 'err-9');
    func('("a",{"a":b})', 'err-10');
    func('("a",{"a":2})', 'err-11');
    func('("a", {"x": 1, "x": 2})', 'err-12');

    // CSS selector
    func('("a", {"x": 1})', 'basic-1');
    func('("a", {"y": 2})', 'basic-2');
    func('("a", {})', 'basic-3');
    func('("a", {"x": 1, "y": 2})', 'basic-4');

    func('("a::before", {"x": 1})', 'pseudo-1');

    // XPath
    func('("/a", {"x": 1})', 'xpath-1');
    func('("//a", {"x": 1})', 'xpath-2');

    // Multiline
    func('(a\n,\n2)', 'multiline-1');
    func('(\n"a"\n,\n{\n"x":\n1})', 'multiline-2');
}

function checkCompareElementsAttribute(x, func) {
    func('("a", "b", ())', 'err-1');
    func('("a", "b", (1))', 'err-2');
    func('("a", "b", ("x", "yo"))', 'err-3');
    func('"a"', 'err-4');
    func('1', 'err-5');
    func('()', 'err-6');
    func('[]', 'err-7');
    func('("a")', 'err-8');
    func('("a", 1)', 'err-9');
    func('("a", "a", "b", "c")', 'err-10');
    func('("a", "b", 1)', 'err-11');
    func('("a", "b", ["a"], 1)', 'err-12');
    func('("a", "b", ["a"], "a")', 'err-13');

    func('("a", "b", [])', 'basic-1');
    func('("a", "b", [\'"data-whatever\'])', 'basic-2');
    // Checking operators.
    func('("a", "b", [\'"data-whatever\'], "=")', 'operator-1');
    func('("a", "b", [\'"data-whatever\'], ">")', 'operator-2');
    func('("a", "b", [\'"data-whatever\'], ">=")', 'operator-3');
    func('("a", "b", [\'"data-whatever\'], "<")', 'operator-4');
    func('("a", "b", [\'"data-whatever\'], "<=")', 'operator-5');

    // XPath
    func('("/a", "b", [\'"data-whatever\'])', 'xpath-1');
    func('("//a", "b", [])', 'xpath-2');
    func('("//a", "b", [\'"data-whatever\'])', 'xpath-3');
    func('("a", "//b", [\'"data-whatever\'])', 'xpath-4');
    func('("//a", "//b", [\'"data-whatever\'])', 'xpath-5');

    // Multiline
    func('("a"\n,\n "b", 1)', 'multiline-1');
    func('("//a"\n,\n "//b", [\'"data-whatever\'])', 'multiline-2');
}

function checkCompareElementsCss(x, func) {
    func('("a", "b", ())', 'err-1');
    func('("a", "b", (1))', 'err-2');
    func('"a"', 'err-3');
    func('1', 'err-4');
    func('()', 'err-5');
    func('[]', 'err-6');
    func('("a")', 'err-7');
    func('("a", 1, [])', 'err-8');
    func('(1, "a", [])', 'err-9');
    func('((), "a", [])', 'err-10');
    func('("a", "a", "b", "c")', 'err-11');
    func('("a", "b", 1)', 'err-12');
    func('("a", "b", [""])', 'err-13');

    func('("a", "b", ["margin"])', 'basic-1');

    // Xpath
    func('("//a", "b", ["margin"])', 'xpath-1');
    func('("a", "//b", ["margin"])', 'xpath-2');
    func('("//a", "//b", ["margin"])', 'xpath-3');

    // Multiline
    func('("a"\n, \n"b", 1)', 'multiline-1');
    func('("//a"\n,\n "//b",\n [\n"margin"])', 'multiline-2');

    // Check the specially added check if "color" is used.
    func('("a", "b", ["color"])', 'color-1');
}

function checkCompareElementsPosition(x, func) {
    func('"a"', 'err-1');
    func('1', 'err-2');
    func('()', 'err-3');
    func('[]', 'err-4');
    func('("a")', 'err-5');
    func('("a", 1)', 'err-6');
    func('(1, "a", ["a"])', 'err-7');
    func('((), "a", ["a"])', 'err-8');
    func('("a", "a", "b", "c")', 'err-9');
    func('("a", "b", 1)', 'err-10');
    func('("a", "b", [1])', 'err-11');
    func('("a", "b", ["x", "yo"])', 'err-12');
    func('("a", "b", ["x", "y", "x"])', 'err-13');
    func('("a", "b", ["x", "y", "y"])', 'err-14');

    func('("a", "b", [])', 'basic-1');
    func('("a", "b", ["x"])', 'basic-2');
    func('("a", "b", ["y"])', 'basic-3');
    func('("a", "b", ["x", "y"])', 'basic-4');
    func('("a", "b", ["y", "x"])', 'basic-5');

    // Pseudo element
    func('("a::after", "b", ["y", "x"])', 'pseudo-1');
    func('("a", "b::after", ["y", "x"])', 'pseudo-2');
    func('("a::after", "b::after", ["y", "x"])', 'pseudo-3');

    // XPath
    func('("//a", "b", ["y", "x"])', 'xpath-1');
    func('("a", "//b", ["y", "x"])', 'xpath-2');
    func('("//a", "//b", ["y", "x"])', 'xpath-3');

    // Multiline
    func('("a", \n"b", \n["x",\n "y", "y"])', 'multiline-1');
    func('("a",\n "b", [\n"x"])', 'multiline-2');
}

function checkCompareElementsPositionNear(x, func) {
    func('"a"', 'err-1');
    func('1', 'err-2');
    func('()', 'err-3');
    func('[]', 'err-4');
    func('("a")', 'err-5');
    func('("a", 1)', 'err-6');
    func('(1, "a", ("a"))', 'err-7');
    func('((), "a", ("a"))', 'err-8');
    func('("a", "a", "b", "c")', 'err-9');
    func('("a", "b", 1)', 'err-10');
    func('("a", "b", {"x": -1})', 'err-11');
    func('("a", "b", {"x": 1, "x": 2})', 'err-12');

    func('("a", "b", ())', 'basic-1');
    func('("a", "b", (1))', 'basic-2');
    func('("a", "b", {"x": 1, "yo": 2})', 'basic-3');
    func('("a", "b", {"x": "a", "y": 2})', 'basic-4');
    func('("a", "b", {"x": -1})', 'basic-5');
    func('("a", "b", {"y": -1})', 'basic-6');
    func('("a", "b", {})', 'basic-7');
    func('("a", "b", {"x": 1})', 'basic-8');
    func('("a", "b", {"y": 1})', 'basic-9');
    func('("a", "b", {"x": 1, "y": 2})', 'basic-10');
    func('("a", "b", {"y": 2, "x": 1})', 'basic-11');

    // warnings
    func('("a", "b", {"x": 0})', 'warn-1');
    func('("a", "b", {"y": 0})', 'warn-2');

    // XPath
    func('("//a", "b", {"y": 2, "x": 1})', 'xpath-1');
    func('("a", "//b", {"y": 2, "x": 1})', 'xpath-2');
    func('("//a", "//b", {"y": 2, "x": 1})', 'xpath-3');

    // Multiline
    func('("a", \n"b", {\n"y":\n -1})', 'multiline-1');
    func('("a", \n"b",\n {\n})', 'multiline-2');
    func('("a", \n"b",\n {\n"y":\n1})', 'multiline-3');
}

function checkCompareElementsProperty(x, func) {
    func('("a", "b", ())', 'err-1');
    func('("a", "b", (1))', 'err-2');
    func('"a"', 'err-3');
    func('1', 'err-4');
    func('()', 'err-5');
    func('[]', 'err-6');
    func('("a")', 'err-7');
    func('("a", 1, [])', 'err-8');
    func('(1, "a", [])', 'err-9');
    func('((), "a", [])', 'err-10');
    func('("a", "a", "b", "c")', 'err-11');
    func('("a", "b", 1)', 'err-12');

    func('("a", "b", ["margin"])', 'basic-1');

    // Xpath
    func('("//a", "b", ["margin"])', 'xpath-1');
    func('("a", "//b", ["margin"])', 'xpath-2');
    func('("//a", "//b", ["margin"])', 'xpath-3');

    // Multiline
    func('("a"\n, "b", \n1)', 'multiline-1');
    func('("a",\n "b",\n [\n"margin"])', 'multiline-2');

    // Multiline
    func('("a", "b", ["a"."b"])', 'object-path-1');
    func('("a", "b", ["margin", "a"."b"])', 'object-path-2');
}

function checkCompareElementsSize(x, func) {
    func('"a"', 'err-1');
    func('1', 'err-2');
    func('()', 'err-3');
    func('[]', 'err-4');
    func('("a")', 'err-5');
    func('("a", 1)', 'err-6');
    func('(1, "a", ["a"])', 'err-7');
    func('((), "a", ["a"])', 'err-8');
    func('("a", "a", "b", "c")', 'err-9');
    func('("a", "b", 1)', 'err-10');
    func('("a", "b", [1])', 'err-11');
    func('("a", "b", ["width", "heighto"])', 'err-12');
    func('("a", "b", ["width", "height", "width"])', 'err-13');
    func('("a", "b", ["width", "height", "height"])', 'err-14');

    func('("a", "b", [])', 'basic-1');
    func('("a", "b", ["width"])', 'basic-2');
    func('("a", "b", ["height"])', 'basic-3');
    func('("a", "b", ["width", "height"])', 'basic-4');
    func('("a", "b", ["height", "width"])', 'basic-5');

    // Pseudo element
    func('("a::after", "b", ["height", "width"])', 'pseudo-1');
    func('("a", "b::after", ["height", "width"])', 'pseudo-2');
    func('("a::after", "b::after", ["height", "width"])', 'pseudo-3');

    // XPath
    func('("//a", "b", ["height", "width"])', 'xpath-1');
    func('("a", "//b", ["height", "width"])', 'xpath-2');
    func('("//a", "//b", ["height", "width"])', 'xpath-3');

    // Multiline
    func('("a", \n"b", \n["width",\n "height", "height"])', 'multiline-1');
    func('("a",\n "b", [\n"width"])', 'multiline-2');
}

function checkCompareElementsSizeNear(x, func) {
    func('"a"', 'err-1');
    func('1', 'err-2');
    func('()', 'err-3');
    func('[]', 'err-4');
    func('("a")', 'err-5');
    func('("a", 1)', 'err-6');
    func('(1, "a", ("a"))', 'err-7');
    func('((), "a", ("a"))', 'err-8');
    func('("a", "a", "b", "c")', 'err-9');
    func('("a", "b", 1)', 'err-10');
    func('("a", "b", {"width": -1})', 'err-11');
    func('("a", "b", {"width": 1, "width": 2})', 'err-12');

    func('("a", "b", ())', 'basic-1');
    func('("a", "b", (1))', 'basic-2');
    func('("a", "b", {"width": 1, "heighto": 2})', 'basic-3');
    func('("a", "b", {"width": "a", "height": 2})', 'basic-4');
    func('("a", "b", {"width": -1})', 'basic-5');
    func('("a", "b", {"height": -1})', 'basic-6');
    func('("a", "b", {})', 'basic-7');
    func('("a", "b", {"width": 1})', 'basic-8');
    func('("a", "b", {"height": 1})', 'basic-9');
    func('("a", "b", {"width": 1, "height": 2})', 'basic-10');
    func('("a", "b", {"height": 2, "width": 1})', 'basic-11');

    // warnings
    func('("a", "b", {"width": 0})', 'warn-1');
    func('("a", "b", {"height": 0})', 'warn-2');

    // XPath
    func('("//a", "b", {"height": 2, "width": 1})', 'xpath-1');
    func('("a", "//b", {"height": 2, "width": 1})', 'xpath-2');
    func('("//a", "//b", {"height": 2, "width": 1})', 'xpath-3');

    // Multiline
    func('("a", \n"b", {\n"height":\n -1})', 'multiline-1');
    func('("a", \n"b",\n {\n})', 'multiline-2');
    func('("a", \n"b",\n {\n"height":\n1})', 'multiline-3');
}

function checkCompareElementsText(x, func) {
    func('"a"', 'err-1');
    func('1', 'err-2');
    func('()', 'err-3');
    func('[]', 'err-4');
    func('("a")', 'err-5');
    func('("a", 1)', 'err-6');
    func('(1, "a")', 'err-7');
    func('((), "a")', 'err-8');
    func('("a", "a", "b", "c")', 'err-9');
    func('("a", "b", 1)', 'err-10');

    func('("a", "b")', 'basic-1');

    // XPath
    func('("//a", "b")', 'xpath-1');
    func('("a", "//b")', 'xpath-2');
    func('("//a", "//b")', 'xpath-3');

    // Multiline
    func('("a"\n,\n "b", 1)', 'multiline-1');
    func('("a"\n, \n"b")', 'multiline-2');
}

function checkDebug(x, func) {
    func('hello', 'err-1');
    func('"true"', 'err-2');
    func('tru', 'err-3');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkCallFunction(x, func) {
    x.assertError(func('')[0], 'expected a tuple, found nothing');
    x.assertError(func('hello')[0], 'expected a tuple, found `hello` (an ident)');
    x.assertError(func('(a)')[0],
        'expected a string, found `a` (an ident) (first element of the tuple)',
    );
    x.assertError(func('(1,1)')[0],
        'expected a string, found `1` (a number) (first element of the tuple)',
    );
    x.assertError(func('("1",1)')[0],
        'expected a JSON dict, found `1` (a number) (second element of the tuple)',
    );
    x.assertError(func('("1",{"a": 1})')[0],
        'no function called `1`. To define a function, use the `define-function` command',
    );

    const pcontext = new parserFuncs.ParserWithContext(
        '<test>',
        new Options(),
        `\
define-function: ("hello", [a], block {})
call-function: ("hello",{})`,
    );
    x.assert(pcontext.get_parser_errors().length, 0);
    // Running `define-function`.
    x.assert(pcontext.get_next_command().error === undefined);
    // Running `call-function`.
    x.assertError(
        pcontext.get_next_command(),
        'function `hello` expected 1 argument, found 0 (from command `call-function: \
("hello",{})`)',
    );

    function callFunc(x, data, toCheck) {
        const pcontext = new parserFuncs.ParserWithContext(
            '<test>',
            new Options(),
            data,
        );
        x.assert(pcontext.get_parser_errors().length, 0);
        // Running `define-function`.
        x.assert(pcontext.get_next_command().error === undefined);
        // Running `call-function`.
        const context = pcontext.get_current_context();
        const command = pcontext.get_current_command();
        const inferred = command.getInferredAst(pcontext.variables, context.functionArgs);
        x.assert(inferred.errors.length === 0);
        pcontext.elems = inferred.ast;
        x.assert(parserFuncs.parseCallFunction(pcontext), toCheck);
    }

    callFunc(
        x,
        `\
define-function: ("hello", [a], block {})
call-function: ("hello",{"a": "1"})`,
        {
            'skipInstructions': true,
        },
    );
    callFunc(
        x,
        `\
define-function: ("hello", [a], block {})
call-function: ("hello",{"a": "1"})`,
        {
            'skipInstructions': true,
        },
    );
}

function checkDefineFunction(x, func) {
    const transform = data => {
        const ret = Object.create(null);
        for (const [key, value] of Object.entries(data)) {
            ret[key] = {
                'arguments': value.arguments,
                'commands': value.commands.map(c => {
                    return {
                        'name': c.commandName,
                        'line': c.line,
                        'text': c.getOriginalCommand(),
                    };
                }),
                'start_line': value.start_line,
            };
        }
        return ret;
    };
    x.assertError(func('')[0], 'expected a tuple, found nothing');
    x.assertError(func('hello')[0],
        'expected a tuple, found `hello` (an ident)',
    );
    x.assertError(func('(a)')[0],
        'expected a string, found `a` (an ident) (first element of the tuple)');
    x.assertError(func('(1,1,1)')[0],
        'expected a string, found `1` (a number) (first element of the tuple)',
    );
    x.assertError(func('("",1,1)')[0],
        'empty strings (`""`) are not allowed (first element of the tuple)',
    );
    x.assertError(func('("a",1,1)')[0],
        'expected an array, found `1` (a number) (second element of the tuple)',
    );
    x.assertError(func('("a",[a],1)')[0],
        'expected a block, found `1` (a number) (third element of the tuple)',
    );
    x.assertError(func('("a",[a],block {b:\n})')[0],
        'Unknown command "b" (in `block { ... }`)',
    );
    x.assertError(func('("a",[CURRENT_DIR], block { assert-css:\n})')[0],
        'unexpected ident `CURRENT_DIR` (second element of the tuple). Not allowed idents are \
[`CURRENT_DIR`, `null`]',
    );

    const [res, parser] = func('("a",[a], block { assert-css:\n})');
    x.assert(res, {'instructions': [], 'wait': false});
    x.assert(transform(parser.definedFunctions), {
        'a': {
            'arguments': ['a'],
            'commands': [
                {
                    'name': 'assert-css',
                    'line': 1,
                    'text': 'assert-css:',
                },
            ],
            'start_line': 1,
        },
    });

    const [res2, parser2] = func('("a",[a], block { assert-css: ("a", c)\n})');
    x.assert(res2, {'instructions': [], 'wait': false});
    x.assert(transform(parser2.definedFunctions), {
        'a': {
            'arguments': ['a'],
            'commands': [
                {
                    'name': 'assert-css',
                    'line': 1,
                    'text': 'assert-css: ("a", c)',
                },
            ],
            'start_line': 1,
        },
    });

    const [res3, parser3] = func(`(
    "check-result",
    [result_kind, color, hover_color],
    block {
        assert-css: (".result-" + |result_kind| + " ." + |result_kind|, {"color": |color|}, ALL)
        // hello
        assert-attribute: (
            ".result-" + |result_kind|,
            {"color": |entry_color|, "background-color": |background_color|},
        )
    },
)`);
    x.assert(res3, {'instructions': [], 'wait': false});
    x.assert(transform(parser3.definedFunctions), {
        'check-result': {
            'arguments': ['result_kind', 'color', 'hover_color'],
            'commands': [
                {
                    'name': 'assert-css',
                    'line': 5,
                    'text': '\
assert-css: (".result-" + |result_kind| + " ." + |result_kind|, {"color": |color|}, ALL)',
                },
                {
                    'name': 'assert-attribute',
                    'line': 7,
                    'text': `\
assert-attribute: (
            ".result-" + |result_kind|,
            {"color": |entry_color|, "background-color": |background_color|},
        )`,
                },
            ],
            'start_line': 4,
        },
    });

    const [res4, parser4] = func(`(
    "check-result",
    [result_kind],
    block {
        move-cursor-to: ".result-" + |result_kind|
        move-cursor-to: ".result-"
    },
)`);
    x.assert(res4, {'instructions': [], 'wait': false});
    x.assert(transform(parser4.definedFunctions), {
        'check-result': {
            'arguments': ['result_kind'],
            'commands': [
                {
                    'name': 'move-cursor-to',
                    'line': 5,
                    'text': 'move-cursor-to: ".result-" + |result_kind|',
                },
                {
                    'name': 'move-cursor-to',
                    'line': 6,
                    'text': 'move-cursor-to: ".result-"',
                },
            ],
            'start_line': 4,
        },
    });

    // It checks two things: that the json is kept entirely and that the first comment is discarded
    // because there is no way to know if it's just empty lines or lines with comments.
    const [res5, parser5] = func(`(
    "check-result",
    [theme, color],
    block {
        // hello
        set-local-storage: {"rustdoc-theme": |theme|, "rustdoc-use-system-theme": "false"}
        // We reload the page so the local storage settings are being used.
        reload:
        assert-css: (".item-left sup", {"color": |color|})
    },
)`);
    x.assert(res5, {'instructions': [], 'wait': false});
    x.assert(transform(parser5.definedFunctions), {
        'check-result': {
            'arguments': ['theme', 'color'],
            'commands': [
                {
                    'name': 'set-local-storage',
                    'line': 6,
                    'text': '\
set-local-storage: {"rustdoc-theme": |theme|, "rustdoc-use-system-theme": "false"}',
                },
                {
                    'name': 'reload',
                    'line': 8,
                    'text': 'reload:',
                },
                {
                    'name': 'assert-css',
                    'line': 9,
                    'text': 'assert-css: (".item-left sup", {"color": |color|})',
                },
            ],
            'start_line': 4,
        },
    });

    const [res6, parser6] = func(`(
    "check-result",
    [],
    block {
        set-local-storage: ["a"]
        set-local-storage: 12
        set-local-storage: ALL
        set-local-storage: "ab"
    },
)`);
    x.assert(res6, {'instructions': [], 'wait': false});
    x.assert(transform(parser6.definedFunctions), {
        'check-result': {
            'arguments': [],
            'commands': [
                {
                    'name': 'set-local-storage',
                    'line': 5,
                    'text': 'set-local-storage: ["a"]',
                },
                {
                    'name': 'set-local-storage',
                    'line': 6,
                    'text': 'set-local-storage: 12',
                },
                {
                    'name': 'set-local-storage',
                    'line': 7,
                    'text': 'set-local-storage: ALL',
                },
                {
                    'name': 'set-local-storage',
                    'line': 8,
                    'text': 'set-local-storage: "ab"',
                },
            ],
            'start_line': 4,
        },
    });
}

function checkDevicePixelRatio(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('0.', 'err-3');
    func('-1.2', 'err-4');

    func('1.2', 'basic-1');
    func('0.2', 'basic-2');
}

function checkDragAndDrop(x, func) {
    // check tuple argument
    func('true', 'err-1');
    func('(true)', 'err-2');
    func('(1,2)', 'err-3');
    func('(1,2,3)', 'err-4');
    func('("a",2)', 'err-5');
    func('(1,"a")', 'err-6');
    func('((1,2,3),"a")', 'err-7');
    func('((1,"a"),"a")', 'err-8');
    func('((1,2),"")', 'err-9');
    func('("", (1,2))', 'err-10');
    func('((-1,2),"")', 'err-11');
    func('((1,-2),"")', 'err-12');
    func('((1.0,2),"")', 'err-13');
    func('((-1.0,2),"")', 'err-14');
    func('((1,2.0),"")', 'err-15');
    func('((1,-2.0),"")', 'err-16');
    func('("a",(-1,2))', 'err-17');
    func('("a",(1,-2))', 'err-18');
    func('("a",(1.0,2))', 'err-19');
    func('("a",(-1.0,2))', 'err-20');
    func('("a",(1,2.0))', 'err-21');
    func('("a",(1,-2.0))', 'err-22');

    func('((1,2),"a")', 'basic-1');
    func('("a", (1,2))', 'basic-2');
    func('("a", "b")', 'basic-3');

    // XPath
    func('("/a",(1,2))', 'xpath-1');
    func('((1,2),"//a")', 'xpath-2');
    func('("//a", (1,2))', 'xpath-3');
    func('("//a", "//b")', 'xpath-4');

    // Multiline
    func('("a",\n(1,\n-2.0))', 'multiline-1');
    func('((1\n,2),\n"a")', 'multiline-2');
}

function checkEmulate(x, func) {
    func('', 'err-1');
    func('12', 'err-2');

    func('"a"', 'basic-1');
}

function checkExpectFailure(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('"true"', 'err-3');
    func('tru', 'err-4');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkFailOnJsError(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('"true"', 'err-3');
    func('tru', 'err-4');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkFailOnRequestError(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('"true"', 'err-3');
    func('tru', 'err-4');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkFocus(x, func) {
    func('a', 'err-1');
    func('"', 'err-2');
    func('\'', 'err-3');
    func('\'\'', 'err-4');

    func('"a"', 'basic-1');
    func('\'a\'', 'basic-2');
    func('\'"a\'', 'basic-3');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');
}

function checkFontSize(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('"12"', 'err-3');
    func('tru', 'err-4');

    func('12', 'basic-1');
}

function checkGeolocation(x, func) {
    func('', 'err-1');
    func('"a"', 'err-2');
    func('("a", "b")', 'err-3');
    func('("12", 13)', 'err-4');
    func('(12, "13")', 'err-5');

    func('(12, 13)', 'basic-1');

    // Multiline
    func('(12\n,\n "13")', 'multiline-1');
    func('(12\n,\n 13)', 'multiline-2');
}

function checkGoTo(x, func) {
    func('"a"', 'err-1');
    func('"', 'err-2');
    func('"http:/a"', 'err-3');
    func('"https:/a"', 'err-4');
    func('"http://foo/" + |url| + "/fa"', 'err-5');

    func('"https://a"', 'basic-1');
    func('"www.x"', 'basic-2');
    func('"/a"', 'basic-3');
    func('"./a"', 'basic-4');
    func('"file:///a"', 'basic-5');

    // `docPath` parameter always ends with '/'
    func('"file://" + |doc_path| + "/a"', 'var-1', {'variables': {'doc_path': 'foo'}});
    func('|url|', 'var-2', {'variables': {'url': 'http://foo'}});
    func('"http://foo/" + |url| + "fa"', 'var-3', {'variables': {'url': 'tadam/'}});
    func('"http://foo/" + |url| + "/fa"', 'var-4', {'variables': {'url': 'tadam'}});

    // Checking `\` are correctly escaped
    func('"file://C:\\b\\c\\d"', 'backslash-1');
}

function checkHistory(x, func) {
    func('"a"', 'err-1');
    func('-12', 'err-2');
    func('-12.0', 'err-3');
    func('12.0', 'err-4');

    // check tuple argument
    func('', 'basic-1');
    func('12', 'basic-2');
    func('12 24', 'basic-3');
    func('0', 'basic-4');
}

function checkInclude(x, func) {
    func('-12', 'err-1');
    func('(-12, "a")', 'err-2');
}

function checkJavascript(x, func) {
    func('', 'err-1');
    func('"a"', 'err-2');

    func('true', 'basic-1');
}

function checkLocalStorage(x, func) {
    func('hello', 'err-1');
    // func('{').error !== undefined); // JSON syntax error
    func('{"a": x}', 'err-3');
    func('{"a": {"a": "x"}}', 'err-4');

    func('{"a": 1}', 'basic-1');
    func('{"a": "1"}', 'basic-2');
    func('{"a": "1", "b": "2px"}', 'basic-3');
    func('{"a": "1"}', 'basic-4');
    func('{"a": null}', 'basic-5');

    // Multiline
    func('{"a"\n: \n"1"}', 'multiline-1');
}

function checkMoveCursorTo(x, func) {
    // Check position
    func('hello', 'err-1');
    func('()', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1,)', 'err-5');
    func('(1,,2)', 'err-6');
    func('(,2)', 'err-7');
    func('(a,2)', 'err-8');
    func('(-1,2)', 'err-9');
    func('(1,-2)', 'err-10');
    func('(1.0,2)', 'err-11');
    func('(-1.0,2)', 'err-12');
    func('(2,1.0)', 'err-13');
    func('(2,-1.0)', 'err-14');
    func('\'\'', 'err-15');

    func('(1,2,)', 'pos-1');
    func('(1,2)', 'pos-2');

    // Check css selector
    func('"', 'basic-1');
    func('\'', 'basic-2');
    func('"a"', 'basic-3');
    func('\'a\'', 'basic-4');
    func('\'"a\'', 'basic-5');

    // XPath
    func('"//a"', 'xpath-1');
    func('"/a"', 'xpath-2');

    // Multiline
    func('(\n-1\n,2)', 'multiline-1');
    func('(1\n,\n2)', 'multiline-2');
}

function checkParseContent(x, func) {
    x.assert(func(''), []);
    x.assert(func('// just a comment'), []);
    x.assert(func('  // just a comment'), []);
    x.assert(func('a: '), [{
        'message': 'Unknown command "a"',
        'isFatal': false,
        'line': {'line': 1}
    }]);
    x.assert(
        func(':'),
        [{'message': 'Unexpected `:` when parsing command', 'isFatal': true, 'line': {'line': 1}}],
    );

    x.assert(func('go-to: "file:///home"'), [
        {
            'fatal_error': true,
            'original': 'go-to: "file:///home"',
            'line': {'line': 1},
            'instructions': [
                `\
const url = "file:///home";
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`,
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
    ]);
    x.assert(func('focus: "#foo"'), [{
        'error': 'First command must be `go-to` (`assert-variable`, `assert-variable-false`, ' +
            '`call-function`, `debug`, `define-function`, `emulate`, `expect-failure`, ' +
            '`fail-on-js-error`, `fail-on-request-error`, `include`, `javascript`, ' +
            '`screenshot-comparison`, `screenshot-on-failure`, `store-value` or `set-timeout` ' +
            'can be used before)!',
        'line': {'line': 1},
    }]);
    x.assert(func('expect-failure: true\ngo-to: "file:///home"'), [
        {
            'fatal_error': false,
            'wait': false,
            'original': 'expect-failure: true',
            'line': {'line': 1},
            'instructions': ['arg.expectedToFail = true;'],
        },
        {
            'fatal_error': true,
            'original': 'go-to: "file:///home"',
            'line': {'line': 2},
            'instructions': [
                `\
const url = "file:///home";
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`,
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
    ]);
    x.assert(func('go-to: "file:///home"\nreload:\ngo-to: "file:///home"'), [
        {
            'fatal_error': true,
            'original': 'go-to: "file:///home"',
            'line': {'line': 1},
            'instructions': [
                `\
const url = "file:///home";
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`,
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
        {
            'fatal_error': false,
            'original': 'reload:',
            'line': {'line': 2},
            'instructions': [`\
const ret = pages[0].reload({'waitUntil': 'domcontentloaded', 'timeout': 30000});
await ret;`,
            ],
            'warnings': [],
        },
        {
            'fatal_error': true,
            'original': 'go-to: "file:///home"',
            'line': {'line': 3},
            'instructions': [
                `\
const url = "file:///home";
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`,
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
    ]);
    x.assert(
        func('// just a comment\na: b'),
        [{'message': 'Unknown command "a"', 'isFatal': false, 'line': {'line': 2}}],
    );
    x.assert(func('go-to: "file:///home"\nemulate: "test"'), [
        {
            'fatal_error': true,
            'original': 'go-to: "file:///home"',
            'line': {'line': 1},
            'instructions': [
                `\
const url = "file:///home";
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`,
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
        {
            'error': 'Command `emulate` must be used before first `go-to`!',
            'line': {'line': 2},
        },
    ]);
    x.assert(func('go-to: "file:///home"\nassert-text: ("a", "b")'), [
        {
            'fatal_error': true,
            'original': 'go-to: "file:///home"',
            'line': {'line': 1},
            'instructions': [
                `\
const url = "file:///home";
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`,
                'await arg.browser.overridePermissions(page.url(), arg.permissions);',
            ],
        },
        {
            'fatal_error': false,
            'wait': false,
            'checkResult': true,
            'original': 'assert-text: ("a", "b")',
            'line': {'line': 2},
            'instructions': [`\
async function checkTextForElem(elem) {
    await elem.evaluate(e => {
        const errors = [];
        const value = "b";
        const elemText = browserUiTestHelpers.getElemText(e, value);
        if (elemText !== value) {
            errors.push("\`" + elemText + "\` isn't equal to \`" + value + "\`");
        }
        if (errors.length !== 0) {
            const errs = errors.join("; ");
            throw "The following errors happened: [" + errs + "]";
        }
    });
}

const parseAssertElemStr = await page.$("a");
if (parseAssertElemStr === null) { throw "\`a\` not found"; }
await checkTextForElem(parseAssertElemStr);`,
            ],
            'warnings': [],
        },
    ]);
}

function checkPauseOnError(x, func) {
    func('hello', 'err-1');
    func('"true"', 'err-2');
    func('tru', 'err-3');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkPermissions(x, func) {
    func('', 'err-1');
    func('"a"', 'err-2');
    func('("a", "b")', 'err-3');
    func('["12", 13]', 'err-4');
    func('[12, "13"]', 'err-5');
    func('["12"]', 'err-6');

    func('["camera", "push"]', 'basic-1');

    // Multiline
    func('[\n"12"\n]', 'multiline-1');
    func('[\n"camera"\n, "push"]', 'multiline-2');
}

function checkPressKey(x, func) {
    // check tuple argument
    func('"', 'err-1');
    func('("a", "b"', 'err-2');
    func('("a")', 'err-3');
    func('("a", )', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a", "b" "c")', 'err-6');
    func('(\'\', "b")', 'err-7');
    func('("a", "b")', 'err-8');
    func('("", 13)', 'err-9');
    func('("a", 13.2)', 'err-10');
    func('("a", -13.2)', 'err-11');
    func('("a", -13)', 'err-12');
    func('(13, "a")', 'err-13');
    func('(-13, 13)', 'err-14');
    func('(-13.2, 13)', 'err-15');
    func('(13.2, 13)', 'err-16');

    func('("a", 13)', 'basic-1');
    func('(13, 13)', 'basic-2');

    // check string argument
    func('"', 'str-1');
    func('\'', 'str-2');
    func('\'\'', 'str-3');
    func('"a"', 'str-4');
    func('\'a\'', 'str-5');
    func('\'"a\'', 'str-6');

    // check integer argument
    func('13.2', 'int-1');
    func('-13.2', 'int-2');
    func('-13', 'int-3');
    func('13', 'int-4');

    // Multiline
    func('(\n"a", \n-13)', 'multiline-1');
    func('(\n13\n, 13)', 'multiline-2');
}

function checkReload(x, func) {
    func('"a"', 'err-1');
    func('12 24', 'err-2');
    func('-12', 'err-3');
    func('-12.0', 'err-4');
    func('12.0', 'err-5');

    // check tuple argument
    func('', 'basic-1');
    func('12', 'basic-2');
    func('0', 'basic-3');
}

function checkScreenshot(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('"a"', 'err-3');

    func('("a")', 'basic-1');
    func('("a", "b")', 'basic-2');

    // XPath
    func('("a", "//b")', 'xpath-1');
}

function checkScreenshotComparison(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('tru', 'err-3');

    func('"true"', 'basic-1');
    func('false', 'basic-2');
    func('true', 'basic-3');
    func('\'\'', 'basic-4');
    func('"test"', 'basic-5');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');
}

function checkScreenshotOnFailure(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('"true"', 'err-3');
    func('tru', 'err-4');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkScrollTo(x, func) {
    // Check position
    func('hello', 'err-1');
    func('()', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1,)', 'err-5');
    func('(1,,2)', 'err-6');
    func('(,2)', 'err-7');
    func('(a,2)', 'err-8');
    func('(-1,2)', 'err-9');
    func('(1,-2)', 'err-10');
    func('(-1.0,2)', 'err-11');
    func('(1.0,2)', 'err-12');
    func('(2,-1.0)', 'err-13');
    func('(2,1.0)', 'err-14');

    func('(1,2)', 'pos-1');
    func('(1,2,)', 'pos-2');

    // Check css selector
    func('"', 'basic-1');
    func('\'', 'basic-2');
    func('\'\'', 'basic-3');
    func('"a"', 'basic-4');
    func('\'a\'', 'basic-5');
    func('\'"a\'', 'basic-6');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');

    // Multiline
    func('(a,\n2\n)', 'multiline-1');
    func('(1\n,\n2)', 'multiline-2');
}

function checkShowText(x, func) {
    func('hello', 'err-1');
    func('"true"', 'err-2');
    func('tru', 'err-3');

    func('false', 'basic-1');
    func('true', 'basic-2');
}

function checkSize(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('()', 'err-3');
    func('(', 'err-4');
    func('(1)', 'err-5');
    func('(1,)', 'err-6');
    func('(1,,2)', 'err-7');
    func('(,2)', 'err-8');
    func('(a,2)', 'err-9');
    func('(-1,2)', 'err-10');
    func('(1,-2)', 'err-11');
    func('(1.0,2)', 'err-12');
    func('(-1.0,2)', 'err-13');
    func('(1,2.0)', 'err-14');
    func('(1,-2.0)', 'err-15');

    func('(1,2)', 'basic-1');
    func('(1,2,)', 'basic-2');
    // Multiline
    func('(1,\n-2.0)', 'multiline-1');
    func('(1\n,2)', 'multiline-2');
}

function checkStoreAttribute(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`("a", {"xa": ${RESERVED_VARIABLE_NAME}})`, 'err-7');
    func('("a", {"xo": 2})', 'err-8');
    func('("a", {"xi": a, "yi": a})', 'err-9');

    func('("a", {"ye": a})', 'basic-1');
    func('("a", {\'"ye\': a})', 'basic-2');
    func('("a", {"yaya": a, "yiyi": b})', 'basic-3');

    func('("a::after", {"x": a})', 'pseudo-1');

    func('("//a", {"blop": a})', 'xpath-1');
}

function checkStoreClipboard(x, func) {
    func('', 'err-1');
    func('null', 'err-2');
    func('"a"', 'err-3');

    func('tmp', 'basic-1');
}

function checkStoreCss(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`("a", {"xa": ${RESERVED_VARIABLE_NAME}})`, 'err-7');
    func('("a", {"xo": 2})', 'err-8');
    func('("a", {"xi": a, "yi": a})', 'err-9');

    func('("a", {"ye": a})', 'basic-1');
    func('("a", {\'"ye\': a})', 'basic-2');
    func('("a", {"yaya": a, "yiyi": b})', 'basic-3');

    func('("a::after", {"x": a})', 'pseudo-1');
    func('("a::after", {"bla": a})', 'pseudo-2');
    func('("a::after", {"bip": a, "bla": b})', 'pseudo-3');

    func('("//a", {"blop": a})', 'xpath-1');
}

function checkStoreObjectProperty(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`{"xa": ${RESERVED_VARIABLE_NAME}}`, 'err-7');
    func('{"xo": 2}', 'err-8');
    func('{"xi": a, "yi": a}', 'err-9');

    func('{"ye": a}', 'basic-1');
    func('{\'"ye\': a}', 'basic-2');
    func('{"yaya": a, "yiyi": b}', 'basic-3');

    // object-path
    func('{"yaya"."b": a}', 'object-path-1');
    func('{"yaya"."b": a, "x": b}', 'object-path-2');
}

function checkStoreLocalStorage(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`{"xa": ${RESERVED_VARIABLE_NAME}}`, 'err-7');
    func('{"xo": 2}', 'err-8');
    func('{"xi": a, "yi": a}', 'err-9');

    func('{"ye": a}', 'basic-1');
    func('{\'"ye\': a}', 'basic-2');
    func('{"yaya": a, "yiyi": b}', 'basic-3');
}

function checkStorePosition(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`("a", {"x": ${RESERVED_VARIABLE_NAME}})`, 'err-7');
    func('("a", {"hoho": var})', 'err-8');
    func('("a", {"x": 2})', 'err-9');
    func('("a", {"x": a, "y": a})', 'err-10');

    func('("a", {"x": a})', 'basic-1');
    func('("a", {"X": a})', 'basic-2');
    func('("a", {"y": b})', 'basic-3');
    func('("a", {"Y": b})', 'basic-4');
    func('("a", {"x": a, "y": b})', 'basic-5');

    func('("a::after", {"x": a})', 'pseudo-1');
    func('("a::after", {"y": a})', 'pseudo-2');
    func('("a::after", {"x": a, "y": b})', 'pseudo-3');

    func('("//a", {"x": a})', 'xpath-1');
}

function checkStoreProperty(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`("a", {"xa": ${RESERVED_VARIABLE_NAME}})`, 'err-7');
    func('("a", {"xo": 2})', 'err-8');
    func('("a", {"xi": a, "yi": a})', 'err-9');

    func('("a", {"ye": a})', 'basic-1');
    func('("a", {\'"ye\': a})', 'basic-2');
    func('("a", {"yaya": a, "yiyi": b})', 'basic-3');

    func('("a::after", {"x": a})', 'pseudo-1');
    func('("a::after", {"bla": a})', 'pseudo-2');
    func('("a::after", {"bip": a, "bla": b})', 'pseudo-3');

    func('("//a", {"blop": a})', 'xpath-1');

    // object-path
    func('("a", {"ye"."ya": a})', 'object-path-1');
    func('("a", {"ye"."ya": a, "yo": b})', 'object-path-2');
}

function checkStoreSize(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func(`("a", {"width": ${RESERVED_VARIABLE_NAME}})`, 'err-7');
    func('("a", {"hoho": var})', 'err-8');
    func('("a", {"height": 2})', 'err-9');
    func('("a", {"height": a, "width": a})', 'err-10');

    func('("a", {"width": a})', 'basic-1');
    func('("a", {"height": b})', 'basic-2');
    func('("a", {"width": a, "height": b})', 'basic-3');

    func('("a::after", {"width": a})', 'pseudo-1');
    func('("a::after", {"height": a})', 'pseudo-2');
    func('("a::after", {"width": a, "height": b})', 'pseudo-3');

    func('("//a", {"width": a})', 'xpath-1');
}

function checkStoreText(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, 1)', 'err-6');
    func('(VAR, \'\')', 'err-7');
    func(`(${RESERVED_VARIABLE_NAME}, "a")`, 'err-8');

    func('(VAR, "a")', 'basic-1');
    func('(VAR, "//a")', 'basic-2');

    func('(VAR, "a::after")', 'pseudo-1');
}

function checkStoreValue(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(', 'err-3');
    func('(1)', 'err-4');
    func('(1, 1)', 'err-5');
    func('(a, b)', 'err-6');
    func(`(${RESERVED_VARIABLE_NAME}, "a")`, 'err-7');

    func('(VAR, "a")', 'basic-1');
    func('(VAR, 1)', 'basic-2');
    func('(VAR, 1.28)', 'basic-3');
    func('(a, {"a": "b"})', 'basic-4');
}

function checkText(x, func) {
    func('"', 'err-1');
    func('("a", "b"', 'err-2');
    func('("a")', 'err-3');
    func('("a", )', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a", "b" "c")', 'err-6');
    func('(\'\', "b")', 'err-7');

    func('("a", "b")', 'basic-1');
    func('("//a", "b")', 'basic-2');

    // Multiline
    func('("a"\n)', 'multiline-1');
    func('("a"\n,\n "b")', 'multiline-2');
}

function checkTimeout(x, func) {
    func('', 'err-1');
    func('"a"', 'err-2');
    func('12', 'err-3');

    // In case I add a check over no timeout some day...
    func('0', 'basic-1');
    func('0.1', 'basic-2');
    func('-0.1', 'basic-3');
    func('-1', 'basic-4');
}

function checkWaitFor(x, func) {
    // Check errors
    func('', 'err-1');
    func('hello', 'err-2');
    func('1 2', 'err-3');

    // Check integers
    func('-1', 'int-1');
    func('-1.0', 'int-2');
    func('1.0', 'int-3');
    func('1', 'int-4');

    // Check css selector
    func('"', 'basic-1');
    func('\'', 'basic-2');
    func('\'\'', 'basic-3');
    func('"a"', 'basic-4');
    func('\'a\'', 'basic-5');
    func('\'"a\'', 'basic-6');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');
}

function checkWaitForFalse(x, func) {
    // Check errors
    func('', 'err-1');
    func('hello', 'err-2');
    func('1 2', 'err-3');
    func('-1', 'err-4');
    func('-1.0', 'err-5');
    func('1.0', 'err-6');
    func('1', 'err-7');

    // Check css selector
    func('"', 'basic-1');
    func('\'', 'basic-2');
    func('\'\'', 'basic-3');
    func('"a"', 'basic-4');
    func('\'a\'', 'basic-5');
    func('\'"a\'', 'basic-6');

    // XPath
    func('"/a"', 'xpath-1');
    func('"//a"', 'xpath-2');
}

function checkWaitForAttribute(x, func) {
    // Check integer
    func('', 'err-1');
    func('hello', 'err-2');
    func('(1)', 'err-3');
    func('(1, 2)', 'err-4');
    func('("a", 2)', 'err-5');
    func('("a", {"b": {"a": 2}})', 'err-6');
    func('("a", {"b": "a"}, a)', 'err-7');

    // Check css selector
    func('("a", {})', 'basic-1');
    func('("a", {"x": 1})', 'basic-2');
    func('("a", {"x": 1, "y": "2"})', 'basic-3');
    // Check `null`.
    func('("a", {"x": null})', 'null-1');
    // Check pseudo element.
    func('("a::after", {"x": 1, "y": "2"})', 'pseudo-1');
    // Ensures that there is no "show-text" check (because of "color").
    func('("a", {"color": "blue"})', 'color-1');

    // XPath
    func('("/a", {"x": "1"})', 'xpath-1');
    func('("//a", {})', 'xpath-2');
    func('("//a", {"x": "1"})', 'xpath-3');

    // extra
    func('("a", {"x": 1}, ALL)', 'extra-1');
    func('("a", {"x": 1}, CONTAINS)', 'extra-2');
    func('("a", {"x": 1}, [CONTAINS, ALL])', 'extra-3');
}

function checkWaitForClipboard(x, func) {
    func('1', 'err-1');
    func('("a", {})', 'err-2');
    func('("a", [A])', 'err-3');
    func('("a", [ALL])', 'err-4');

    func('"a"', 'basic-1');
    func('("a",)', 'basic-2');
    func('("a", CONTAINS)', 'basic-3');
    func('("a", [CONTAINS])', 'basic-4');
}

function checkWaitForProperty(x, func) {
    // Check integer
    func('', 'err-1');
    func('hello', 'err-2');
    func('(1)', 'err-3');
    func('(1, 2)', 'err-4');
    func('("a", 2)', 'err-5');
    func('("a", {"b": {"a": 2}})', 'err-6');
    func('("a", {"b": "a"}, a)', 'err-7');

    // Check css selector
    func('("a", {})', 'basic-1');
    func('("a", {"x": 1})', 'basic-2');
    func('("a", {"x": 1, "y": "2"})', 'basic-3');
    // Check pseudo element.
    func('("a::after", {"x": 1, "y": "2"})', 'pseudo-1');
    // Ensures that there is no "show-text" check (because of "color").
    func('("a", {"color": "blue"})', 'color-1');

    // XPath
    func('("/a", {"x": "1"})', 'xpath-1');
    func('("//a", {})', 'xpath-2');
    func('("//a", {"x": "1"})', 'xpath-3');

    // extra
    func('("a", {"x": 1}, ALL)', 'extra-1');
    func('("a", {"x": 1}, CONTAINS)', 'extra-2');
    func('("a", {"x": 1}, [CONTAINS, ALL])', 'extra-3');

    // object-path
    func('("a", {"x"."y": "1"})', 'object-path-1');
    func('("a", {"x"."y": "1", "z": 3})', 'object-path-2');
}

function checkWaitForCount(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(1)', 'err-3');
    func('(1, 2)', 'err-4');
    func('("a", "a")', 'err-5');

    func('("a", 3)', 'basic-1');

    func('("//*[@class=\'a\']", 3)', 'xpath-1');
}

function checkWaitForCss(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(1)', 'err-3');
    func('(1, 2)', 'err-4');
    func('("a", 2)', 'err-5');
    func('("a", {"b": {"a": 2}})', 'err-6');
    func('("a", {"b": "a"}, A)', 'err-7');

    // Check css selector
    func('("a", {})', 'basic-1');
    func('("a", {"x": 1})', 'basic-2');
    func('("a", {"x": 1, "y": "2"})', 'basic-3');
    // Check pseudo element.
    func('("a::after", {"x": 1, "y": "2"})', 'pseudo-1');
    // Checks colors.
    func('("a", {"color": "blue"})', 'color-1');

    // XPath
    func('("/a", {"x": "1"})', 'xpath-1');
    func('("//a", {})', 'xpath-2');
    func('("//a", {"x": "1"})', 'xpath-3');

    // With 'ALL' ident.
    func('("a", {"x": 1, "y": "2"}, ALL)', 'ident-1');
    func('("//a", {"x": 1, "y": "2"}, ALL)', 'ident-2');
}

function checkWaitForObjectProperty(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('{"a": b}', 'err-3');

    func('{}', 'basic-1');
    func('({})', 'basic-2');
    func('{"a": "b"}', 'basic-3');
    func('({"a": "b"})', 'basic-4');
    func('{"a": {"b": "c"}}', 'basic-5');
    func('{\'"a\':\n"\'b"\n}', 'basic-6');
    func('{"a": null}', 'basic-7');

    func('({"a": "b"}, STARTS_WITH)', 'extra-1');
    func('({"a": "b"}, [STARTS_WITH])', 'extra-2');
    func('({"a": null}, [STARTS_WITH])', 'extra-3');
    func('({"a": "b"}, [STARTS_WITH, ENDS_WITH])', 'extra-4');
    func('({"a": "b", "c": null}, [STARTS_WITH, ENDS_WITH])', 'extra-5');

    // object-path
    func('{"x"."y": "1"}', 'object-path-1');
    func('{"x"."y": "1", "z": 3}', 'object-path-2');
}

function checkWaitForLocalStorage(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('{"a": b}', 'err-3');

    func('{}', 'basic-1');
    func('{"a": {"b": "c"}}', 'basic-2');
    func('{"a": "b"}', 'basic-3');
}

function checkWaitForText(x, func) {
    func('', 'err-1');
    func('hello', 'err-2');
    func('(1)', 'err-3');
    func('(1, 2)', 'err-4');
    func('("a", 2)', 'err-5');
    func('("a", "a", A)', 'err-6');

    // Check CSS selector.
    func('("a", "b")', 'basic-1');
    func('("a::after", "b")', 'basic-2');

    // Check XPath.
    func('("//a", "b")', 'xpath-1');

    // Check extended checks.
    func('("a", "b", ALL)', 'extra-1');
    func('("a", "b", CONTAINS)', 'extra-2');
    func('("a", "b", [ALL, CONTAINS])', 'extra-3');
}

function checkObjProperty(x, func) {
    func('"', 'err-1');
    func('', 'err-2');
    func('"a"', 'err-3');
    func('{"a": 2} 2', 'err-4');
    func('{"a": "2", "a": {"b": 1}}', 'err-5');

    func('{"a": 2}', 'basic-1');
    func('{"a": true}', 'basic-2');
    func('{"a": "b"}', 'basic-3');
    func('{"a": "2", "\\"b": "\'b"}', 'escape-1');

    // object-path
    func('{"a"."b": 2}', 'object-path-1');
    func('{"a": "2", "b"."c": "b"}', 'object-path-2');
}

function checkWithinIframe(x, func) {
    func('"', 'err-1');
    func('', 'err-2');
    func('"a"', 'err-3');
    func('("a")', 'err-4');
    func('("a", {"b": 1})', 'err-5');
    func('("a::before", {"b": 1})', 'err-6');

    func('("a", block {})', 'basic-1');
    func('("a", block { assert: "b" })', 'basic-2');
    func('("//a", block {})', 'basic-3');
}

function checkWrite(x, func) {
    // check string argument
    func('"', 'str-1');
    func('\'', 'str-2');
    func('\'\'', 'str-3');
    func('"a"', 'str-4');
    func('\'a\'', 'str-5');
    func('\'"a\'', 'str-6');

    // check integer argument
    func('13.2', 'int-1');
    func('-13.2', 'int-2');
    func('-13', 'int-3');
    func('13', 'int-4');
}

function checkWriteInto(x, func) {
    func('"', 'err-1');
    func('("a", "b"', 'err-2');
    func('("a")', 'err-3');
    func('("a", )', 'err-4');
    func('("a", "b", "c")', 'err-5');
    func('("a", "b" "c")', 'err-6');
    func('(\'\', "b")', 'err-7');
    func('("a", 13.2)', 'err-8');
    func('("a", -13.2)', 'err-9');
    func('("a", -13)', 'err-10');

    func('("a", "b")', 'basic-1');
    func('("a", 13)', 'basic-2');

    // XPath
    func('("/a", 13)', 'xpath-1');
    func('("//a", "b")', 'xpath-2');
    func('("//a", 13)', 'xpath-3');

    // Multiline
    func('("a", \n13.2)', 'multiline-1');
    func('(\n"//a", \n13)', 'multiline-2');
}

const TO_CHECK = [
    {
        'name': 'assert',
        'func': checkAssert,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssert, x, e, name, o),
    },
    {
        'name': 'assert-false',
        'func': checkAssert,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertFalse, x, e, name, o),
    },
    {
        'name': 'assert-attribute',
        'func': checkAssertAttribute,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertAttribute, x, e, name, o),
    },
    {
        'name': 'assert-attribute-false',
        'func': checkAssertAttribute,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertAttributeFalse, x, e, name, o),
    },
    {
        'name': 'assert-clipboard',
        'func': checkAssertClipboard,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertClipboard, x, e, name, o),
    },
    {
        'name': 'assert-clipboard-false',
        'func': checkAssertClipboard,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertClipboardFalse, x, e, name, o),
    },
    {
        'name': 'assert-css',
        'func': checkAssertCss,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertCss, x, e, name, o),
    },
    {
        'name': 'assert-css-false',
        'func': checkAssertCss,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertCssFalse, x, e, name, o),
    },
    {
        'name': 'assert-document-property',
        'func': checkAssertObjProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseAssertDocumentProperty, x, e, name, o);
        },
    },
    {
        'name': 'assert-document-property-false',
        'func': checkAssertObjProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseAssertDocumentPropertyFalse, x, e, name, o);
        },
    },
    {
        'name': 'assert-count',
        'func': checkAssertCount,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertCount, x, e, name, o),
    },
    {
        'name': 'assert-count-false',
        'func': checkAssertCount,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertCountFalse, x, e, name, o),
    },
    {
        'name': 'assert-local-storage',
        'func': checkAssertLocalStorage,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertLocalStorage, x, e, name, o),
    },
    {
        'name': 'assert-local-storage-false',
        'func': checkAssertLocalStorage,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseAssertLocalStorageFalse, x, e, name, o);
        },
    },
    {
        'name': 'assert-property',
        'func': checkAssertProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertProperty, x, e, name, o),
    },
    {
        'name': 'assert-property-false',
        'func': checkAssertProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertPropertyFalse, x, e, name, o),
    },
    {
        'name': 'assert-position',
        'func': checkAssertWaitPosition,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertPosition, x, e, name, o),
    },
    {
        'name': 'assert-position-false',
        'func': checkAssertWaitPosition,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertPositionFalse, x, e, name, o),
    },
    {
        'name': 'assert-size',
        'func': checkAssertSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertSize, x, e, name, o),
    },
    {
        'name': 'assert-size-false',
        'func': checkAssertSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertSizeFalse, x, e, name, o),
    },
    {
        'name': 'assert-text',
        'func': checkAssertText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertText, x, e, name, o),
    },
    {
        'name': 'assert-text-false',
        'func': checkAssertText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertTextFalse, x, e, name, o),
    },
    {
        'name': 'assert-variable',
        'func': checkAssertVariable,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertVariable, x, e, name, o),
    },
    {
        'name': 'assert-variable-false',
        'func': checkAssertVariable,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertVariableFalse, x, e, name, o),
    },
    {
        'name': 'assert-window-property',
        'func': checkAssertObjProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseAssertWindowProperty, x, e, name, o),
    },
    {
        'name': 'assert-window-property-false',
        'func': checkAssertObjProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseAssertWindowPropertyFalse, x, e, name, o);
        },
    },
    {
        'name': 'block-network-request',
        'func': checkBlockNetworkRequest,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseBlockNetworkRequest, x, e, name, o),
    },
    {
        'name': 'set-attribute',
        'func': checkAttributeProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetAttribute, x, e, name, o),
    },
    {
        'name': 'call-function',
        'func': checkCallFunction,
        'toCall': (_, e, o) => wrapperDefineFunction(parserFuncs.parseCallFunction, e, o),
    },
    {
        'name': 'click',
        'func': checkClick,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseClick, x, e, name, o),
    },
    {
        'name': 'click-with-offset',
        'func': checkClickWithOffset,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseClickWithOffset, x, e, name, o),
    },
    {
        'name': 'compare-elements-attribute',
        'func': checkCompareElementsAttribute,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsAttribute, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-attribute-false',
        'func': checkCompareElementsAttribute,
        'toCall': (x, e, name, o) => {
            wrapper(parserFuncs.parseCompareElementsAttributeFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-css',
        'func': checkCompareElementsCss,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseCompareElementsCss, x, e, name, o),
    },
    {
        'name': 'compare-elements-css-false',
        'func': checkCompareElementsCss,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsCssFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-position',
        'func': checkCompareElementsPosition,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsPosition, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-position-false',
        'func': checkCompareElementsPosition,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsPositionFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-position-near',
        'func': checkCompareElementsPositionNear,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsPositionNear, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-position-near-false',
        'func': checkCompareElementsPositionNear,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsPositionNearFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-property',
        'func': checkCompareElementsProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsProperty, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-property-false',
        'func': checkCompareElementsProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsPropertyFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-size',
        'func': checkCompareElementsSize,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsSize, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-size-false',
        'func': checkCompareElementsSize,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsSizeFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-size-near',
        'func': checkCompareElementsSizeNear,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsSizeNear, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-size-near-false',
        'func': checkCompareElementsSizeNear,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsSizeNearFalse, x, e, name, o);
        },
    },
    {
        'name': 'compare-elements-text',
        'func': checkCompareElementsText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseCompareElementsText, x, e, name, o),
    },
    {
        'name': 'compare-elements-text-false',
        'func': checkCompareElementsText,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseCompareElementsTextFalse, x, e, name, o);
        },
    },
    {
        'name': 'set-css',
        'func': checkAttributeProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetCss, x, e, name, o),
    },
    {
        'name': 'debug',
        'func': checkDebug,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseDebug, x, e, name, o),
    },
    {
        'name': 'define-function',
        'func': checkDefineFunction,
        'toCall': (_, e, o) => wrapperDefineFunction(parserFuncs.parseDefineFunction, e, o),
    },
    {
        'name': 'set-device-pixel-ratio',
        'func': checkDevicePixelRatio,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetDevicePixelRatio, x, e, name, o),
    },
    {
        'name': 'set-document-property',
        'func': checkObjProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetDocumentProperty, x, e, name, o),
    },
    {
        'name': 'drag-and-drop',
        'func': checkDragAndDrop,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseDragAndDrop, x, e, name, o),
    },
    {
        'name': 'emulate',
        'func': checkEmulate,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseEmulate, x, e, name, o),
    },
    {
        'name': 'expect-failure',
        'func': checkExpectFailure,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseExpectFailure, x, e, name, o),
    },
    {
        'name': 'fail-on-js-error',
        'func': checkFailOnJsError,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseFailOnJsError, x, e, name, o),
    },
    {
        'name': 'fail-on-request-error',
        'func': checkFailOnRequestError,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseFailOnRequestError, x, e, name, o),
    },
    {
        'name': 'focus',
        'func': checkFocus,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseFocus, x, e, name, o),
    },
    {
        'name': 'set-font-size',
        'func': checkFontSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetFontSize, x, e, name, o),
    },
    {
        'name': 'geolocation',
        'func': checkGeolocation,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseGeolocation, x, e, name, o),
    },
    {
        'name': 'go-to',
        'func': checkGoTo,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseGoTo, x, e, name, o),
    },
    {
        'name': 'history-go-back',
        'func': checkHistory,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseHistoryGoBack, x, e, name, o),
    },
    {
        'name': 'history-go-forward',
        'func': checkHistory,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseHistoryGoForward, x, e, name, o),
    },
    {
        'name': 'include',
        'func': checkInclude,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseInclude, x, e, name, o),
    },
    {
        'name': 'javascript',
        'func': checkJavascript,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseJavascript, x, e, name, o),
    },
    {
        'name': 'set-local-storage',
        'func': checkLocalStorage,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetLocalStorage, x, e, name, o),
    },
    {
        'name': 'move-cursor-to',
        'func': checkMoveCursorTo,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseMoveCursorTo, x, e, name, o),
    },
    {
        'name': 'pause-on-error',
        'func': checkPauseOnError,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parsePauseOnError, x, e, name, o),
    },
    {
        'name': 'permissions',
        'func': checkPermissions,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parsePermissions, x, e, name, o),
    },
    {
        'name': 'press-key',
        'func': checkPressKey,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parsePressKey, x, e, name, o),
    },
    {
        'name': 'set-property',
        'func': checkAttributeProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetProperty, x, e, name, o),
    },
    {
        'name': 'reload',
        'func': checkReload,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseReload, x, e, name, o),
    },
    {
        'name': 'screenshot',
        'func': checkScreenshot,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseScreenshot, x, e, name, o),
    },
    {
        'name': 'screenshot-comparison',
        'func': checkScreenshotComparison,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseScreenshotComparison, x, e, name, o),
    },
    {
        'name': 'screenshot-on-failure',
        'func': checkScreenshotOnFailure,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseScreenshotOnFailure, x, e, name, o),
    },
    {
        'name': 'scroll-to',
        'func': checkScrollTo,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseScrollTo, x, e, name, o),
    },
    {
        'name': 'show-text',
        'func': checkShowText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseShowText, x, e, name, o),
    },
    {
        'name': 'set-window-size',
        'func': checkSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetWindowSize, x, e, name, o),
    },
    {
        'name': 'store-attribute',
        'func': checkStoreAttribute,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreAttribute, x, e, name, o),
    },
    {
        'name': 'store-clipboard',
        'func': checkStoreClipboard,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreClipboard, x, e, name, o),
    },
    {
        'name': 'store-css',
        'func': checkStoreCss,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreCss, x, e, name, o),
    },
    {
        'name': 'store-document-property',
        'func': checkStoreObjectProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreDocumentProperty, x, e, name, o),
    },
    {
        'name': 'store-local-storage',
        'func': checkStoreLocalStorage,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreLocalStorage, x, e, name, o),
    },
    {
        'name': 'store-position',
        'func': checkStorePosition,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStorePosition, x, e, name, o),
    },
    {
        'name': 'store-property',
        'func': checkStoreProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreProperty, x, e, name, o),
    },
    {
        'name': 'store-size',
        'func': checkStoreSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreSize, x, e, name, o),
    },
    {
        'name': 'store-text',
        'func': checkStoreText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreText, x, e, name, o),
    },
    {
        'name': 'store-value',
        'func': checkStoreValue,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreValue, x, e, name, o),
    },
    {
        'name': 'store-window-property',
        'func': checkStoreObjectProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseStoreWindowProperty, x, e, name, o),
    },
    {
        'name': 'set-text',
        'func': checkText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetText, x, e, name, o),
    },
    {
        'name': 'set-timeout',
        'func': checkTimeout,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetTimeout, x, e, name, o),
    },
    {
        'name': 'wait-for',
        'func': checkWaitFor,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitFor, x, e, name, o),
    },
    {
        'name': 'wait-for-false',
        'func': checkWaitForFalse,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-attribute',
        'func': checkWaitForAttribute,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForAttribute, x, e, name, o),
    },
    {
        'name': 'wait-for-attribute-false',
        'func': checkWaitForAttribute,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForAttributeFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-clipboard',
        'func': checkWaitForClipboard,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForClipboard, x, e, name, o),
    },
    {
        'name': 'wait-for-clipboard-false',
        'func': checkWaitForClipboard,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForClipboardFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-count',
        'func': checkWaitForCount,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForCount, x, e, name, o),
    },
    {
        'name': 'wait-for-count-false',
        'func': checkWaitForCount,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForCountFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-css',
        'func': checkWaitForCss,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForCss, x, e, name, o),
    },
    {
        'name': 'wait-for-css-false',
        'func': checkWaitForCss,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForCssFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-document-property',
        'func': checkWaitForObjectProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseWaitForDocumentProperty, x, e, name, o);
        },
    },
    {
        'name': 'wait-for-document-property-false',
        'func': checkWaitForObjectProperty,
        'toCall': (x, e, name, o) => {
            return wrapper(parserFuncs.parseWaitForDocumentPropertyFalse, x, e, name, o);
        },
    },
    {
        'name': 'wait-for-local-storage',
        'func': checkWaitForLocalStorage,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForLocalStorage, x, e, name, o),
    },
    {
        'name': 'wait-for-local-storage-false',
        'func': checkWaitForLocalStorage,
        'toCall': (x, e, name, o) => wrapper(
            parserFuncs.parseWaitForLocalStorageFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-position',
        'func': checkAssertWaitPosition,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForPosition, x, e, name, o),
    },
    {
        'name': 'wait-for-position-false',
        'func': checkAssertWaitPosition,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForPositionFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-property',
        'func': checkWaitForProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForProperty, x, e, name, o),
    },
    {
        'name': 'wait-for-property-false',
        'func': checkWaitForProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForPropertyFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-size',
        'func': checkAssertSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForSize, x, e, name, o),
    },
    {
        'name': 'wait-for-size-false',
        'func': checkAssertSize,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForSizeFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-text',
        'func': checkWaitForText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForText, x, e, name, o),
    },
    {
        'name': 'wait-for-text-false',
        'func': checkWaitForText,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForTextFalse, x, e, name, o),
    },
    {
        'name': 'wait-for-window-property',
        'func': checkWaitForObjectProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWaitForWindowProperty, x, e, name, o),
    },
    {
        'name': 'wait-for-window-property-false',
        'func': checkWaitForObjectProperty,
        'toCall': (x, e, name, o) => wrapper(
            parserFuncs.parseWaitForWindowPropertyFalse, x, e, name, o),
    },
    {
        'name': 'set-window-property',
        'func': checkObjProperty,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseSetWindowProperty, x, e, name, o),
    },
    {
        'name': 'within-iframe',
        'func': checkWithinIframe,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWithinIFrame, x, e, name, o),
    },
    {
        'name': 'write',
        'func': checkWrite,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWrite, x, e, name, o),
    },
    {
        'name': 'write-into',
        'func': checkWriteInto,
        'toCall': (x, e, name, o) => wrapper(parserFuncs.parseWriteInto, x, e, name, o),
    },
    // This one is a bit "on its own".
    {
        'name': 'parseContent',
        'func': checkParseContent,
        'toCall': (x, e, o) => wrapperParseContent(e, o),
    },
];

function checkCommandsSets(x, commands) {
    for (const command of commands) {
        x.assert(parserFuncs.ORDERS[command] !== undefined, true);
    }
}

async function checkCommands(x) {
    x.startTestSuite('API', false);
    print('=> Starting API tests...');
    print('');

    for (let i = 0; i < TO_CHECK.length; ++i) {
        x.startTestSuite(TO_CHECK[i].name);
        try {
            TO_CHECK[i].func(x, (e, name, o) => TO_CHECK[i].toCall(x, e, name, o));
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
    print('=> Starting checking if all commands are tested...');

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
    const x = new Assert();
    x.blessEnabled = process.argv.findIndex(arg => arg === '--bless') !== -1;
    if (!x.blessEnabled) {
        x.blessEnabled = process.env.npm_config_bless === 'true';
    }
    checkCommands(x).then(nbErrors => {
        process.exit(nbErrors !== 0 ? 1 : 0);
    });
} else {
    module.exports = {
        'check': checkCommands,
    };
}
