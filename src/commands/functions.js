// Commands related to setting script functions.

// Possible inputs:
//
// * ("function name", [ident arguments], [("command name", command_args)])
function parseDefineFunction(parser) {
    // We have to put this import here to avoid circular import.
    const { ORDERS } = require('../commands.js');

    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected a tuple of 3 elements, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple of 3 elements, found \
${elems[0].getArticleKind()} (\`${parser.getRawArgs()}\`)`};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 3) {
        return {'error': `expected a tuple of 3 elements, found ${tuple.length}`};
    } else if (tuple[0].kind !== 'string') {
        return {'error': `expected a non-empty string as first element of the tuple, found \
${tuple[0].getArticleKind()} \`${tuple[0].getErrorText()}\``};
    } else if (tuple[0].value.length === 0) {
        return {'error': 'expected a non-empty string as first element of the tuple'};
    } else if (tuple[1].kind !== 'tuple') {
        return {'error': `expected a tuple as second element of the tuple, found \
${tuple[1].getArticleKind()} \`${tuple[1].getErrorText()}\``};
    } else if (tuple[2].kind !== 'array') {
        return {'error': `expected a string as third element of the tuple, found \
${tuple[2].getArticleKind()} \`${tuple[2].getErrorText()}\``};
    }

    // Checking the arrays now.
    const args = tuple[1].getRaw();
    if (args.length > 0) {
        for (const arg of args) {
            if (arg.kind !== 'ident') {
                return {
                    'error': `expected a tuple of idents as second argument, found \
${args[0].getArticleKind()} (\`${arg.getErrorText()}\`)`,
                };
            }
        }
    }
    const functions = tuple[2].getRaw();
    const calls = [];
    if (functions.length > 0) {
        if (functions[0].kind !== 'tuple') {
            return {
                'error': `expected an array of tuples as third argument, found an array \
of ${functions[0].kind}`,
            };
        }
        for (const func of functions) {
            const func_tuple = func.getRaw();
            if (func_tuple.length < 1) {
                return {
                    'error': `expected at least one element in function tuple: \`\
${func_tuple.getErrorText()}\` (from \`${tuple[2].getErrorText()}\`)`};
            } else if (func_tuple[0].kind !== 'string') {
                return {
                    'error': `expected first argument of tuple to be a string, found \
${func_tuple[0].getArticleKind()} (\`${func_tuple[0].getErrorText()}\` from \
\`${tuple[2].getErrorText()}\`)`,
                };
            } else if (!Object.prototype.hasOwnProperty.call(ORDERS, func_tuple[0].value)) {
                return {
                    'error': `unknown function \`${func_tuple[0].value}\` (in \
\`${tuple[2].getErrorText()}\`)`,
                };
            }
            let code = '';
            if (func_tuple.length > 1) {
                const start = func_tuple[1].startPos;
                const end = func_tuple[func_tuple.length - 1].endPos;
                code = parser.getOriginalWithIndexes(start, end);
            }
            calls.push(`${func_tuple[0].value}: ${code}`);
        }
    }

    let warnings = undefined;
    const func_name = tuple[0].value;
    if (Object.prototype.hasOwnProperty.call(parser.definedFunctions, func_name)) {
        warnings = [`overwriting existing \`${func_name}\` function`];
    }
    parser.definedFunctions[func_name] = {
        'arguments': args.map(e => e.value),
        'content': calls.join('\n'),
    };
    return {
        'instructions': [],
        'wait': false,
        'warnings': warnings,
    };
}

// This function is only to get parsing errors, function name and arguments.
//
// Possible inputs:
//
// * ("function name", [ident arguments], [("command name", command_args)])
function parseCallFunction(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected a tuple of 1 or 2 elements, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple of 1 or 2 elements, found \
${elems[0].getArticleKind()} (\`${parser.getRawArgs()}\`)`};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 1 && tuple.length !== 2) {
        return {'error': `expected a tuple of 1 or 2 elements, found ${tuple.length}`};
    } else if (tuple[0].kind !== 'string') {
        return {'error': `expected a string as first element of the tuple, found \
${tuple[0].getArticleKind()} \`${tuple[0].getErrorText()}\``};
    } else if (tuple.length === 2 && tuple[1].kind !== 'tuple') {
        return {'error': `expected a tuple as second element of the tuple or nothing, found \
${tuple[1].getArticleKind()} \`${tuple[1].getErrorText()}\``};
    }

    const func_name = tuple[0].value;
    if (!Object.prototype.hasOwnProperty.call(parser.definedFunctions, func_name)) {
        return {
            'error': `no function called \`${func_name}\`. To define a function, use \
the \`define-function\` command`,
        };
    }
    const args = tuple.length === 2 ? tuple[1].getRaw() : [];
    const expected_args = parser.definedFunctions[func_name]['arguments'].length;
    if (args.length !== expected_args) {
        const extra = expected_args > 1 ? 's' : '';
        return {
            'error': `function \`${func_name}\` expected ${expected_args} argument${extra}, \
found ${args.length}`,
        };
    }
    return {
        'function': func_name,
        'args': args,
    };
}

module.exports = {
    'parseDefineFunction': parseDefineFunction,
    'parseCallFunction': parseCallFunction,
};
