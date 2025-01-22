// Commands related to setting script functions.

const { RESERVED_VARIABLE_NAME, hasError, plural } = require('../utils.js');
const { validator } = require('../validator.js');

// Possible inputs:
//
// * ("function name", [ident arguments], block {})
function parseDefineFunction(parser) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                {
                    kind: 'string',
                    allowEmpty: false,
                },
                {
                    kind: 'array',
                    valueTypes: {
                        'ident': {
                            notAllowed: [RESERVED_VARIABLE_NAME, 'null'],
                        },
                    },
                },
                {
                    kind: 'block',
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const func_name = tuple[0].value.value;

    let warnings = undefined;
    if (Object.prototype.hasOwnProperty.call(parser.definedFunctions, func_name)) {
        warnings = [`overwriting existing \`${func_name}\` function`];
    }
    parser.definedFunctions[func_name] = {
        'arguments': tuple[1].value.entries.map(e => e.value),
        'commands': tuple[2].value.value,
        'start_line': tuple[2].value.blockLine,
        'filePath': parser.getCurrentFile(),
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
// * ("function name", [arguments value] | {"argument": value})
function parseCallFunction(parser) {
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                {
                    kind: 'string',
                    allowEmpty: false,
                },
                {
                    kind: 'json',
                    keyTypes: {
                        'string': [],
                    },
                    allowAllValues: true,
                    allowRecursiveValues: true,
                    valueTypes: {},
                },
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const func_name = tuple[0].value.value;
    if (!Object.prototype.hasOwnProperty.call(parser.definedFunctions, func_name)) {
        return {
            'error': `no function called \`${func_name}\`. To define a function, use \
the \`define-function\` command`,
        };
    }
    const args = tuple[1].value.getRaw();
    const expected_args = parser.definedFunctions[func_name]['arguments'].length;
    if (args.length !== expected_args) {
        return {
            'error': `function \`${func_name}\` expected ${expected_args} \
${plural('argument', expected_args)}, found ${args.length}`,
        };
    }

    const funcArgs = Object.create(null);
    const func = parser.definedFunctions[func_name];
    for (const arg_name of func['arguments']) {
        const index = args.findIndex(arg => arg.key.value === arg_name);
        if (index === -1) {
            return {
                'error': `Missing argument "${arg_name}"`,
                'line': parser.get_current_command_line(),
                'fatal_error': true,
            };
        }
        funcArgs[arg_name] = args[index].value;
    }
    const context = parser.get_current_context();
    parser.pushNewContext({
        'ast': context.ast,
        'commands': func.commands,
        'currentCommand': 0,
        'functionArgs': Object.assign({}, context.functionArgs, funcArgs),
        'filePath': func.filePath,
    });
    return {
        'skipInstructions': true,
    };
}

module.exports = {
    'parseDefineFunction': parseDefineFunction,
    'parseCallFunction': parseCallFunction,
};
