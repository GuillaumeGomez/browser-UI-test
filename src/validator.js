// TODO Put all that in a class and when no syntax matches, check the one wihch allowed us to get
// the most far and return its error. If they all failed at the same level, global message saying
// "it was expected X or Y or Z, found blabla".
//
// In case one thing matched, return the "inferred" elements (like if it's a selector, return the
// selector).

const { getArticleKind } = require('./parser.js');
const { plural, hasError } = require('./utils.js');

const VALIDATORS = new Map([
    ['tuple', validateTuple],
    ['json', validateJson],
    ['number', validateNumber],
    ['string', validateString],
    ['selector', validateSelector],
    ['array', validateArray],
    ['ident', validateIdent],
    ['block', validateBlock],
    ['boolean', validateBoolean],
    ['object-path', validateObjectPath],
]);

class Validator {
    constructor() {
        this.error = null;
        this.level = 0;
        this.indexes = [];
    }

    maybeMakeError(value) {
        if (hasError(value)) {
            return this.makeError(value.error);
        }
        return value;
    }

    makeError(errorText, { notExpectedKind = false, isEmpty = false, help = null } = {}) {
        const level = notExpectedKind ? this.level - 1 : this.level;
        const error = {
            level: level,
            error: errorText,
            // We need to clone the data to prevent its value to change when we
            // update "this.indexes".
            path: this.indexes.slice(),
            typeError: notExpectedKind,
            isEmpty: isEmpty,
            help: help,
        };
        if (this.error === null || error.level >= this.error.level) {
            this.error = error;
        }
        return error;
    }

    generateError() {
        if (this.error.help !== null) {
            this.error.error += `. ${this.error.help}`;
        }
        return this.error;
    }

    callValidator(parser, allowedSyntax) {
        if (!VALIDATORS.has(allowedSyntax.kind)) {
            throw new Error(`Unknown kind "${allowedSyntax.kind}" (in validator)`);
        } else if (parser === undefined) {
            if (allowedSyntax.optional) {
                return {};
            }
            return this.makeError(
                `expected ${getArticleKind(allowedSyntax.kind)}, found nothing`,
                { notExpectedKind: false, isEmpty: true },
            );
        }
        this.level += 1;
        const ret = VALIDATORS.get(allowedSyntax.kind)(parser, allowedSyntax, this);
        this.level -= 1;
        if (hasError(ret)) {
            return ret;
        }
        return {
            kind: allowedSyntax.kind,
            value: ret,
        };
    }

    validatorInner(parser, allowedSyntax, tuplePosition = null) {
        if (!isObject(allowedSyntax)) {
            throw new Error('Expected validator argument to be an object');
        }

        const ret = this.callValidator(parser, allowedSyntax);
        if (!hasError(ret)) {
            return ret;
        } else if (!ret.typeError && !ret.isEmpty) {
            return withExtraInfo(ret, tuplePosition);
        }
        let out = '';
        if (allowedSyntax.alternatives !== undefined && allowedSyntax.alternatives.length > 0) {
            if (!Array.isArray(allowedSyntax.alternatives)) {
                throw new Error('Expected `alternatives` field to be an array');
            }
            for (const syntax of allowedSyntax.alternatives) {
                const sub_ret = this.callValidator(parser, syntax);
                if (hasError(sub_ret)) {
                    if (sub_ret.typeError || sub_ret.isEmpty) {
                        continue;
                    }
                    return withExtraInfo(sub_ret, tuplePosition);
                }
                return sub_ret;
            }
            const possibilities = [getArticleKind(allowedSyntax.kind)];
            possibilities.push(...allowedSyntax.alternatives.map(a => getArticleKind(a.kind)));
            if (allowedSyntax.optional) {
                possibilities.push('nothing');
            }
            const len = possibilities.length - 1;
            for (let i = 0; i < len; ++i) {
                if (out.length !== 0) {
                    out += ', ';
                }
                out += possibilities[i];
            }
            out += ` or ${possibilities[len]}`;
        } else if (allowedSyntax.optional) {
            out = `${getArticleKind(allowedSyntax.kind)} or nothing`;
        } else {
            out = getArticleKind(allowedSyntax.kind);
            if (allowedSyntax.kind === 'string' && allowedSyntax.allowed !== undefined) {
                out += ` (one of ${listValues(allowedSyntax.allowed)})`;
            }
        }
        const input = parser === undefined ?
            'nothing' : `\`${parser.getErrorText()}\` (${parser.getArticleKind()})`;
        return withExtraInfo(this.makeError(`expected ${out}, found ${input}`), tuplePosition);
    }
}

function validateNumber(parser, allowedSyntax, validator) {
    if (parser.kind !== 'number') {
        return validator.makeError(
            `expected a number, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    if (allowedSyntax.allowFloat === undefined) {
        throw new Error('Missing `allowFloat` value in number validator');
    } else if (allowedSyntax.allowNegative === undefined) {
        throw new Error('Missing `allowNegative` value in number validator');
    }
    if (!allowedSyntax.allowFloat) {
        return validator.maybeMakeError(parser.getIntegerValueV2(allowedSyntax.allowNegative));
    } else if (!allowedSyntax.allowNegative && parser.isNegative) {
        if (allowedSyntax.allowZero === false) {
            return validator.makeError(
                `expected numbers above 0, found \`${parser.getErrorText()}\``,
            );
        } else {
            return validator.makeError(
                `expected only positive numbers, found \`${parser.getErrorText()}\``,
            );
        }
    } else if (allowedSyntax.allowZero === false) {
        if (!allowedSyntax.allowNegative) {
            if (Math.ceil(parseFloat(parser.value)) <= 0) {
                return validator.makeError(
                    `expected numbers above 0, found \`${parser.getErrorText()}\``,
                );
            }
        } else if (allowedSyntax.allowFloat) {
            for (let i = 0; i < parser.value.length; i++) {
                const c = parser.value.charAt(i);
                if (c !== '-' && c !== '0' && c !== '.') {
                    return validator.makeError(
                        `0 is not allowed (in \`${parser.getErrorText()}\`)`,
                    );
                }
            }
        } else if (parseInt(parser.value) === 0) {
            return validator.makeError(
                `0 is not allowed (in \`${parser.getErrorText()}\`)`,
            );
        }
    }
    return parser;
}

function validateString(parser, allowedSyntax, validator) {
    if (parser.kind !== 'string') {
        return validator.makeError(
            `expected a string, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    if (allowedSyntax.allowed !== undefined) {
        if (!Array.isArray(allowedSyntax.allowed)) {
            throw new Error('`allowed` value is supposed to be an array in string validator');
        } else if (!allowedSyntax.allowed.includes(parser.value)) {
            return validator.makeError(
                `unexpected value \`${parser.getErrorText()}\`, allowed values are: \
${listValues(allowedSyntax.allowed)}`);
        }
    }
    if (allowedSyntax.allowEmpty === false) {
        if (parser.getStringValue().length === 0) {
            return validator.makeError(
                `empty strings (\`${parser.getErrorText()}\`) are not allowed`,
            );
        }
    }
    return parser;
}

function validateBoolean(parser, allowedSyntax, validator) {
    if (parser.kind !== 'boolean') {
        return validator.makeError(
            `expected a boolean, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    return parser;
}

function validateObjectPath(parser, allowedSyntax, validator) {
    if (parser.kind !== 'object-path') {
        return validator.makeError(
            `expected an object-path, found \`${parser.getErrorText()}\` (\
${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    return parser;
}

function validateSelector(parser, allowedSyntax, validator) {
    if (parser.kind !== 'string') {
        return validator.makeError(
            `expected an XPATH or a CSS selector, found \`${parser.getErrorText()}\` \
(${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    // It'll generate an error if it's invalid in any case.
    return validator.maybeMakeError(parser.getSelector());
}

function validateIdent(parser, allowedSyntax, validator) {
    if (parser.kind !== 'ident') {
        return validator.makeError(
            `expected an ident, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    if (allowedSyntax.notAllowed !== undefined) {
        if (!Array.isArray(allowedSyntax.notAllowed)) {
            throw new Error('Expected an array for `notAllowed` (in ident validator)');
        } else if (allowedSyntax.notAllowed.includes(parser.value)) {
            return validator.makeError(
                `unexpected ${parser.kind} \`${parser.getErrorText()}\``,
                {
                    help: `Not allowed ${plural(parser.kind, allowedSyntax.notAllowed)} are \
${listValues(allowedSyntax.notAllowed)}`,
                },
            );
        }
    }
    if (allowedSyntax.allowed === undefined) {
        return parser;
    } else if (!Array.isArray(allowedSyntax.allowed)) {
        throw new Error('Expected an array for `allowed` (in ident validator)');
    } else if (!allowedSyntax.allowed.includes(parser.value)) {
        return validator.makeError(
            `unexpected ${parser.kind} \`${parser.getErrorText()}\``,
            {
                help: `Allowed ${parser.kind}s are: ${listValues(allowedSyntax.allowed)}`,
            },
        );
    }
    return parser;
}

function validateBlock(parser, allowedSyntax, validator) {
    if (parser.kind !== 'block') {
        return validator.makeError(
            `expected a block, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    }
    return parser;
}

function validateTuple(parser, allowedSyntax, validator) {
    function tupleSize() {
        const len = allowedSyntax.elements.length;
        let s;
        if (len > 0 && allowedSyntax.elements[len - 1].optional) {
            s = `${len - 1} or ${len} ${plural('element', len)}`;
        } else {
            s = `${len} ${plural('element', len)}`;
        }
        return `expected a tuple of ${s}, found ${tupleElems.length}`;
    }

    if (parser.kind !== 'tuple') {
        return validator.makeError(
            `expected a tuple, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    } else if (allowedSyntax.elements === undefined) {
        throw new Error('Missing "elements" (in tuple validator)');
    } else if (!Array.isArray(allowedSyntax.elements)) {
        throw new Error('Expected "elements" to be an array (in tuple validator)');
    }
    const tupleElems = parser.getRaw();
    if (tupleElems.length > allowedSyntax.elements.length) {
        return validator.makeError(tupleSize());
    }
    const values = [];
    parser.entries = values;
    const allowedSyntaxes = allowedSyntax.elements;
    for (let i = 0, len = allowedSyntaxes.length; i < len; ++i) {
        if (i >= tupleElems.length) {
            if (allowedSyntaxes[i].optional) {
                return parser;
            }
            return validator.makeError(tupleSize());
        }
        const ret = validator.validatorInner(tupleElems[i], allowedSyntaxes[i], i);
        if (hasError(ret)) {
            return ret;
        }
        values.push(ret);
    }
    return parser;
}

function validateArray(parser, allowedSyntax, validator) {
    if (parser.kind !== 'array') {
        return validator.makeError(
            `expected an array, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    } else if (allowedSyntax.valueTypes === undefined) {
        throw new Error('Missing "valueTypes" (in array validator)');
    } else if (!isObject(allowedSyntax.valueTypes)) {
        throw new Error('"valueTypes" should be an object (in array validator)');
    }
    const arrayElems = parser.getRaw();
    parser.entries = arrayElems;
    if (arrayElems.length === 0) {
        return parser;
    }
    // Allowed by default and optional to specify.
    const allowEmpty = allowedSyntax.allowEmpty !== false;

    const allowedForType = getObjectValue(allowedSyntax.valueTypes, arrayElems[0].kind);
    if (allowedForType === undefined) {
        const exp = Object.keys(allowedSyntax.valueTypes).join(' or ');
        return validator.makeError(
            `expected an array of ${exp} elements, found an array of \
${arrayElems[0].kind} (${arrayElems[0].getErrorText()})`);
    } else if (!isObject(allowedForType)) {
        throw new Error('"valueTypes" values should be objects (in array validator)');
    }
    allowedForType.kind = arrayElems[0].kind;
    for (const value of arrayElems) {
        const ret = validator.validatorInner(value, allowedForType);
        if (hasError(ret)) {
            return ret;
        }
        if (!allowEmpty && value.getStringValue().length === 0) {
            return validator.makeError(
                `empty values (\`${value.getErrorText()}\`) are not allowed`,
            );
        }
    }
    return parser;
}

function validateJson(parser, allowedSyntax, validator) {
    if (parser.kind !== 'json') {
        return validator.makeError(
            `expected a JSON dict, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            { notExpectedKind: true },
        );
    } else if (allowedSyntax.valueTypes === undefined) {
        throw new Error('Missing "valueTypes" (in JSON validator)');
    } else if (!isObject(allowedSyntax.valueTypes)) {
        throw new Error('"valueTypes" should be an object (in JSON validator)');
    } else if (allowedSyntax.keyTypes === undefined) {
        throw new Error('Missing "keyTypes" in JSON validator (in JSON validator)');
    } else if (!isObject(allowedSyntax.keyTypes)) {
        throw new Error('"keyTypes" should be an object (in JSON validator)');
    }
    // Allowed by default and optional to specify.
    const allowEmptyValues = allowedSyntax.allowEmptyValues !== false;
    // Denied by default and optional to specify.
    const allowAllValues = allowedSyntax.allowAllValues === true;
    // Denied by default and optional to specify.
    const allowRecursiveValues = allowedSyntax.allowRecursiveValues === true;
    // Allowed by default and optional to specify.
    const allowDuplicatedValue = allowedSyntax.allowDuplicatedValue !== false;

    const json = parser.getRaw();
    const entries = new Map();

    for (const entry of json) {
        const key = entry.key;
        const allowedForKey = getObjectValue(allowedSyntax.keyTypes, key.kind);

        if (allowedForKey === undefined) {
            return validator.makeError(
                `type "${key.kind}" (\`${key.getErrorText()}\`) as key is not allowed in this JSON \
dict, allowed types are: ${listValues(allowedSyntax.keyTypes)}`,
            );
        } else if (!Array.isArray(allowedForKey)) {
            throw new Error('"keyTypes" should be an object of array (in JSON validator)');
        } else if (allowedForKey.length !== 0 && !allowedForKey.includes(key.value)) {
            return validator.makeError(
                `unexpected key \`${key.getErrorText()}\`, allowed keys are: \
${listValues(allowedForKey)}`,
            );
        }

        const key_s = key.getStringValue();
        if (key_s.length < 1) {
            return validator.makeError('empty keys are not allowed in JSON dict');
        } else if (entries.has(key_s)) {
            return validator.makeError(`\`${key_s}\` key is duplicated in JSON dict`);
        }

        const value = entry.value;
        const allowedForValue = getObjectValue(allowedSyntax.valueTypes, value.kind);
        let parser_value = value;

        if (allowedForValue === undefined) {
            if (!allowAllValues) {
                return validator.makeError(
                    `type "${value.kind}" (\`${value.getErrorText()}\`) is not allowed as value in \
this JSON dict, allowed types are: ${listValues(Object.keys(allowedSyntax.valueTypes))}`,
                );
            } else if (!allowRecursiveValues && value.isRecursive()) {
                return validator.makeError(
                    `recursive types (\`${value.getErrorText()}\`) are not allowed as value in \
this JSON dict`,
                );
            }
        } else if (!isObject(allowedForValue)) {
            throw new Error('"valueTypes" values should be an object (in JSON validator)');
        } else {
            allowedForValue.kind = value.kind;
            parser_value = validator.validatorInner(value, allowedForValue);
            if (hasError(parser_value)) {
                return parser_value;
            }
            // We remove one level.
            parser_value = parser_value.value;
        }
        const value_s = value.getStringValue();
        if (!allowEmptyValues && value_s.length === 0) {
            return validator.makeError(
                `empty values are not allowed: \`${key_s}\` has an empty value`,
            );
        }
        entries.set(key_s, {
            value: value_s,
            kind: value.kind,
            parser: parser_value,
            key: key,
        });
    }
    if (!allowDuplicatedValue) {
        const values = new Set();

        for (const [key, value] of entries) {
            if (values.has(value.value)) {
                return validator.makeError(
                    `duplicated value \`${value.parser.getErrorText()}\` (for \`${key}\` key)`,
                    {
                        help: 'Duplicated values are not allowed in this JSON dict',
                    },
                );
            }
            values.add(value.value);
        }
    }
    parser.entries = entries;
    return parser;
}

function listValues(values) {
    values.sort();
    return `[${values.map(v => `\`${v}\``).join(', ')}]`;
}

function isObject(obj) {
    return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
}

function getObjectValue(obj, key) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        return undefined;
    }
    return obj[key];
}

function nth_elem(nth) {
    return ['first', 'second', 'third', 'fourth', 'fifth'][nth];
}

function withExtraInfo(ret, tuplePosition) {
    if (tuplePosition !== null) {
        ret.error += ` (${nth_elem(tuplePosition)} element of the tuple)`;
    }
    return ret;
}

/*
Format looks like this:

{
    kind: 'tuple',
    elements: [
        {
            kind: 'string',
            // optional
            allowed: ['values'],
            allowEmpty: false,
        },
        {
            kind: 'ident',
            // optional
            allowed: ['values'],
            notAllowed: ['something'],
        },
        {
            kind: 'number',
            allowFloat: false,
            allowNegative: false,
            optional: true,
            // optional
            allowZero: false,
        },
        {
            kind: 'boolean',
        },
        {
            kind: 'selector',
        },
        {
            kind: 'object-path',
        },
    ],
    alternatives: [
        {
            kind: 'array',
            valueTypes: {
                // Each value is the same validator as stand-alone elements
                string: {},
                number: {
                    allowFloat: true,
                    allowNegative: true,
                },
                ident: {
                    allowed: ['null'],
                },
            },
        },
        {
            kind: 'json',
            keyTypes: {
                // 'accepted kind': [accepted values] (if empty, all accepted)
                string: ['x', 'X'],
                number: [],
            },
            valueTypes: {
                // Each value is the same validator as stand-alone elements
                string: {},
                number: {
                    allowFloat: true,
                    allowNegative: true,
                },
                ident: {
                    allowed: ['null'],
                },
            },
            // optional
            allowEmpty: false,
            allowAllValues: false,
            allowRecursiveValues: false,
            allowDuplicatedValue: true,
        },
    ],
}

Why array of array? Because if the first entry of the array isn't validated, we check if it works
if the next one(s).
*/
function validator(parser, allowedSyntax) {
    if (parser.elems.length > 1) {
        const extra = allowedSyntax.optional ? '0 or ' : '';
        return {'error': `Expected ${extra}1 element, found ${parser.elems.length} elements`};
    }
    const validator = new Validator();
    const ret = validator.validatorInner(parser.elems[0], allowedSyntax);
    if (hasError(ret)) {
        return validator.generateError(parser);
    }
    return ret;
}

module.exports = {
    'validator': validator,
};
