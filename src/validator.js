// TODO Put all that in a class and when no syntax matches, check the one wihch allowed us to get
// the most far and return its error. If they all failed at the same level, global message saying
// "it was expected X or Y or Z, found blabla".
//
// In case one thing matched, return the "inferred" elements (like if it's a selector, return the
// selector).

const { getArticleKind } = require('./parser.js');
const { plural } = require('./utils.js');

const VALIDATORS = new Map([
    ['tuple', validateTuple],
    ['json', validateJson],
    ['number', validateNumber],
    ['string', validateString],
    ['selector', validateSelector],
    ['array', validateArray],
    ['ident', validateIdent],
    ['block', validateBlock],
]);

class Validator {
    constructor() {
        this.error = null;
        this.level = 0;
        this.indexes = [];
    }

    makeError(errorText, notExpectedKind = false) {
        const level = notExpectedKind ? this.level - 1 : this.level;
        const error = {
            'level': level,
            'error': errorText,
            // We need to clone the data to prevent its value to change when we
            // update "this.indexes".
            'path': this.indexes.slice(),
            'typeError': notExpectedKind,
        };
        if (this.error === null || error.level >= this.error.level) {
            this.error = error;
        }
        return error;
    }

    generateError() {
        return this.error;
    }

    callValidator(parser, allowedSyntax) {
        if (!VALIDATORS.has(allowedSyntax.kind)) {
            throw new Error(`Unknown kind "${allowedSyntax.kind}" (in validator)`);
        }
        this.level += 1;
        const ret = VALIDATORS.get(allowedSyntax.kind)(parser, allowedSyntax, this);
        this.level -= 1;
        if (ret.error !== undefined) {
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
        if (ret.error === undefined || ret.error === null) {
            return ret;
        }
        let out = '';
        if (allowedSyntax.alternatives !== undefined && allowedSyntax.alternatives.length > 0) {
            if (!Array.isArray(allowedSyntax.alternatives)) {
                throw new Error('Expected `alternatives` field to be an array');
            }
            for (const syntax of allowedSyntax.alternatives) {
                const sub_ret = this.callValidator(parser, syntax);
                if (sub_ret.error !== undefined && sub_ret.error !== null) {
                    if (sub_ret.typeError) {
                        continue;
                    }
                    return sub_ret;
                }
                return sub_ret;
            }
            const possibilities = [getArticleKind(allowedSyntax.kind)];
            possibilities.push(...allowedSyntax.alternatives.map(a => getArticleKind(a.kind)));
            const len = possibilities.length - 1;
            for (let i = 0; i < len; ++i) {
                if (out.length !== 0) {
                    out += ', ';
                }
                out += possibilities[i];
            }
            out += ` or ${possibilities[len]}`;
        } else {
            out = getArticleKind(allowedSyntax.kind);
        }
        const extra = tuplePosition !== null ?
            `${nth_elem(tuplePosition)} element of the tuple to be ` :
            '';
        return this.makeError(
            `expected ${extra}${out}, found \`${parser.getErrorText()}\` (\
${parser.getArticleKind()})`,
        );
    }
}

// FIXME: Allow to add more checks like "only positive" or only float, or stuff like that...
function validateNumber(parser, allowedSyntax, validator) {
    if (parser.kind !== 'number') {
        return validator.makeError(
            `expected a number, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    }
    return parser;
}

function validateString(parser, allowedSyntax, validator) {
    if (parser.kind !== 'string') {
        return validator.makeError(
            `expected a string, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    }
    return parser;
}

function validateSelector(parser, allowedSyntax, validator) {
    if (parser.kind !== 'string') {
        return validator.makeError(
            `expected an XPATH or a CSS selector, found \`${parser.getErrorText()}\` \
(${parser.getArticleKind()})`,
            true);
    }
    // It'll generate an error if it's invalid in any case.
    return parser.getSelector();
}

function validateIdent(parser, allowedSyntax, validator) {
    if (parser.kind !== 'ident') {
        return validator.makeError(
            `expected an ident, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    }
    if (allowedSyntax.allowed === undefined) {
        return {};
    } else if (!Array.isArray(allowedSyntax.allowed)) {
        throw new Error('Expected an array for `allowed` (in ident validator)');
    } else if (!allowedSyntax.allowed.includes(parser.value)) {
        return validator.makeError(
            `unexpected ${parser.kind} \`${parser.getErrorText()}\`. Allowed ${parser.kind}s are: \
${listValues(allowedSyntax.allowed)}`,
        );
    }
    return parser;
}

function validateBlock(parser, allowedSyntax, validator) {
    if (parser.kind !== 'block') {
        return validator.makeError(
            `expected a block, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    }
    return parser;
}

function validateTuple(parser, allowedSyntax, validator) {
    if (parser.kind !== 'tuple') {
        return validator.makeError(
            `expected a tuple, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    } else if (allowedSyntax.elements === undefined) {
        throw new Error('Missing "elements" (in tuple validator)');
    } else if (!Array.isArray(allowedSyntax.elements)) {
        throw new Error('Expected "elements" to be an array (in tuple validator)');
    }
    const tupleElems = parser.getRaw();
    if (tupleElems.length > allowedSyntax.elements) {
        const nb = allowedSyntax.elements;
        return this.makeError(
            `expected a tuple of ${nb} ${plural('element', nb)}, found ${tupleElems.length}`,
        );
    }
    const values = [];
    const allowedSyntaxes = allowedSyntax.elements;
    for (let i = 0, len = allowedSyntaxes.length; i < len; ++i) {
        if (i >= tupleElems.length) {
            if (allowedSyntaxes[i].optional) {
                return values;
            }
        }
        const ret = validator.validatorInner(tupleElems[i], allowedSyntaxes[i], i);
        if (ret.error !== undefined && ret.error !== null) {
            return ret;
        }
        values.push(ret);
    }
    return values;
}

function validateArray(parser, allowedSyntax, validator) {
    if (parser.kind !== 'array') {
        return validator.makeError(
            `expected an array, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    } else if (allowedSyntax.valueTypes === undefined) {
        throw new Error('Missing "valueTypes" (in array validator)');
    } else if (!isObject(allowedSyntax.valueTypes)) {
        throw new Error('"valueTypes" should be an object (in array validator)');
    }
    const arrayElems = parser.getRaw();
    if (arrayElems.length === 0) {
        return {};
    }
    const allowedForType = getObjectValue(allowedSyntax.valueTypes, arrayElems[0].kind);
    if (allowedForType === undefined) {
        const exp = Object.keys(allowedSyntax.valueTypes).join(' or ');
        return validator.makeError(
            `expected an array of ${exp} elements, found an array of \
${arrayElems[0].kind} (${arrayElems[0].getErrorText()})`);
    }
    if (!Array.isArray(allowedForType)) {
        throw new Error('"valueTypes" should be an object of array (in array validator)');
    }
    if (allowedForType.length !== 0) {
        // Nothing to validate, we can move on.
        for (const value of arrayElems) {
            if (!allowedForType.includes(value.getRaw())) {
                return validator.makeError(
                    `unexpected value \`${value.getErrorText()}\`, allowed values are: [\
${allowedForType.map(v => `\`${v}\``).join(', ')}]`,
                );
            }
        }
    }
    return arrayElems;
}

function validateJson(parser, allowedSyntax, validator) {
    if (parser.kind !== 'json') {
        return validator.makeError(
            `expected a JSON dict, found \`${parser.getErrorText()}\` (${parser.getArticleKind()})`,
            true);
    } else if (allowedSyntax.valueTypes === undefined) {
        throw new Error('Missing "valueTypes" (in JSON validator)');
    } else if (!isObject(allowedSyntax.valueTypes)) {
        throw new Error('"valueTypes" should be an object (in JSON validator)');
    } else if (allowedSyntax.keyTypes === undefined) {
        throw new Error('Missing "keyTypes" in JSON validator (in JSON validator)');
    } else if (!isObject(allowedSyntax.keyTypes)) {
        throw new Error('"keyTypes" should be an object (in JSON validator)');
    }
    const json = parser.getRaw();
    const entries = new Map();

    for (const entry of json) {
        const key = entry.key;
        const allowedForKey = getObjectValue(allowedSyntax.keyTypes, key.kind);

        if (allowedForKey === undefined) {
            return validator.makeError(
                `type "${key.kind}" (\`${key.getErrorText()}\`) as key is not allowed in this JSON \
dict, allowed types are: ${allowedSyntax.keyTypes.join(', ')}`,
            );
        } else if (!Array.isArray(allowedForKey)) {
            throw new Error('"keyTypes" should be an object of array (in JSON validator)');
        } else if (allowedForKey.length !== 0 && !allowedForKey.includes(key.value)) {
            return validator.makeError(
                `unexpected key \`${key.getErrorText()}\`, allowed keys are: \
${allowedForKey.join(', ')}`,
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

        if (allowedForValue === undefined) {
            return validator.makeError(
                `type "${value.kind}" (\`${value.getErrorText()}\`) as value is not allowed in \
this JSON dict, allowed types are: ${Object.keys(allowedSyntax.valueTypes).join(', ')}`,
            );
        } else if (!Array.isArray(allowedForValue)) {
            throw new Error('"valueTypes" should be an object of array (in JSON validator)');
        } else if (allowedForValue.length !== 0 && !allowedForValue.includes(value.value)) {
            return validator.makeError(
                `unexpected ${value.kind} \`${value.getErrorText()}\`. Allowed ${value.kind}s are: \
${listValues(allowedForValue)}`,
            );
        }
        entries.set(key_s, {
            'value': value.getStringValue(),
            'kind': value.kind,
        });
    }
    return entries;
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

/*
Format looks like this:

{
    kind: 'tuple',
    elements: [
        {
            kind: 'string',
        },
        {
            kind: 'integer',
            optional: true,
        },
    ],
    alternatives: [
        {
            kind: 'array',
            valueTypes: {
                // 'accepted kind': [accepted values] (if empty, all accepted)
                'string': [],
                'number': [],
                'ident': ['null'],
            },
        },
        {
            kind: 'json',
            keyTypes: {
                // 'accepted kind': [accepted values] (if empty, all accepted)
                'string': ['x', 'X'],
                'number': [],
            },
            valueTypes: {
                // 'accepted kind': [accepted values] (if empty, all accepted)
                'string': [],
                'number': [],
                'ident': ['null'],
            },
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
    if (ret.error !== undefined) {
        return validator.generateError(parser);
    }
    return ret;
}

module.exports = {
    'validator': validator,
};
