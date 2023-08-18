// Commands related to setting script functions.

const { RESERVED_VARIABLE_NAME } = require('../utils.js');

// Possible inputs:
//
// * ("function name", [ident arguments], [("command name", command_args)])
function parseDefineFunction(parser) {
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
    } else if (tuple[2].kind !== 'block') {
        return {'error': `expected a block as third element of the tuple, found \
${tuple[2].getArticleKind()} \`${tuple[2].getErrorText()}\``};
    }

    // Checking the arguments now.
    const args = tuple[1].getRaw();
    if (args.length > 0) {
        for (const arg of args) {
            if (arg.kind !== 'ident') {
                return {
                    'error': `expected a tuple of idents as second argument, found \
${args[0].getArticleKind()} (\`${arg.getErrorText()}\`)`,
                };
            } else if (arg.value === RESERVED_VARIABLE_NAME) {
                return {
                    'error': `\`${RESERVED_VARIABLE_NAME}\` is a reserved name, so a function \
argument cannot be named like this`,
                };
            }
        }
    }

    let warnings = undefined;
    const func_name = tuple[0].value;
    if (Object.prototype.hasOwnProperty.call(parser.definedFunctions, func_name)) {
        warnings = [`overwriting existing \`${func_name}\` function`];
    }
    parser.definedFunctions[func_name] = {
        'arguments': args.map(e => e.value),
        'commands': tuple[2].value,
        'start_line': tuple[2].blockLine,
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
// * ("function name", [ident arguments], block { commands })
function parseCallFunction(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected a tuple of 2 elements, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected a tuple of 2 elements, found \
${elems[0].getArticleKind()} (\`${parser.getRawArgs()}\`)`};
    }
    const tuple = elems[0].getRaw();
    if (tuple.length !== 2) {
        return {'error': `expected a tuple of 2 elements, found ${tuple.length}`};
    } else if (tuple[0].kind !== 'string') {
        return {'error': `expected a string as first element of the tuple, found \
${tuple[0].getArticleKind()} \`${tuple[0].getErrorText()}\``};
    } else if (tuple[1].kind !== 'tuple' && tuple[1].kind !== 'json') {
        return {'error': `expected a tuple or a JSON dictionary as second element of the tuple or \
nothing, found ${tuple[1].getArticleKind()} \`${tuple[1].getErrorText()}\``};
    }

    const func_name = tuple[0].value;
    if (!Object.prototype.hasOwnProperty.call(parser.definedFunctions, func_name)) {
        return {
            'error': `no function called \`${func_name}\`. To define a function, use \
the \`define-function\` command`,
        };
    }
    const args = tuple[1].getRaw();
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
        'args_kind': tuple[1].kind,
    };
}

module.exports = {
    'parseDefineFunction': parseDefineFunction,
    'parseCallFunction': parseCallFunction,
};
