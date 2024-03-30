const { escapeBackslahes, RESERVED_VARIABLE_NAME } = require('./utils.js');

const SUPPORTED_OPERATORS = ['>', '>=', '<', '<=', '==', '!=', '+', '-', '/', '*', '%', '||', '&&'];

function isWhiteSpace(c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

function isStringChar(c) {
    return c === '\'' || c === '"';
}

function isNumber(c) {
    return c !== null && c >= '0' && c <= '9';
}

function isLetter(c) {
    return c !== null && c.toLowerCase() !== c.toUpperCase();
}

function matchInteger(s) {
    if (typeof s === 'number' || s instanceof Number) {
        return true;
    } else if (typeof s === 'string' || s instanceof String) {
        for (let i = s.length - 1; i >= 0; --i) {
            if (!isNumber(s.charAt(i))) {
                return false;
            }
        }
        return true;
    } else {
        // Very likely a JSON dict.
        return false;
    }
}

function cleanString(s) {
    if (s.replace === undefined) {
        return s;
    }
    let parts = s.split('"');
    for (let i = parts.length - 2; i >= 0; --i) {
        if (!parts[i].endsWith('\\')) {
            parts[i] += '\\';
        }
    }
    parts = parts.join('"').split('\'');
    for (let i = parts.length - 2; i >= 0; --i) {
        if (!parts[i].endsWith('\\')) {
            parts[i] += '\\';
        }
    }
    return parts.join('\'').replace(/\n/g, '\\n');
}

function cleanCssSelector(s, text = '') {
    s = cleanString(escapeBackslahes(s)).trim();
    if (s.length === 0) {
        return {
            'error': `CSS selector ${text !== '' ? text + ' ' : ''}cannot be empty`,
        };
    }
    return {
        'value': s,
    };
}

function checkInteger(nb, text, negativeCheck = false) {
    if (nb.isFloat === true) {
        return {'error': `expected integer for ${text}, found float: \`${nb.getErrorText()}\``};
    } else if (negativeCheck === true && nb.isNegative === true) {
        return {'error': `${text} cannot be negative: \`${nb.getErrorText()}\``};
    }
    return {'value': nb.getRaw()};
}

function checkIntegerV2(nb, allowNegative) {
    if (nb.isFloat === true) {
        return {'error': `expected integer, found float: \`${nb.getErrorText()}\``};
    } else if (allowNegative !== true && nb.isNegative === true) {
        return {'error': `expected only positive numbers, found \`${nb.getErrorText()}\``};
    }
    return nb;
}

function showEnd(elem) {
    const text = elem.getErrorText();

    if (text.length < 20) {
        return text;
    }
    return text.slice(text.length - 20);
}

function showChar(c) {
    if (c === '\n') {
        return 'backline';
    }
    const separator = c === '`' ? '\'' : '`';
    return `${separator}${c}${separator}`;
}

function getCssValue(value, text = '') {
    const css = cleanCssSelector(value, text);
    if (css.error !== undefined) {
        return css;
    }
    const index = css.value.search(/[A-Za-z0-9\])-]::[A-Za-z][A-Za-z0-9_]*$/);
    if (index !== -1) {
        return {
            'value': css.value.slice(0, index + 1),
            'pseudo': css.value.slice(index + 1),
        };
    }
    css['pseudo'] = null;
    return css;
}

function isIdentChar(c, start, pos, specialChars = []) {
    return c === '_' ||
        isLetter(c) ||
        specialChars.includes(c) ||
        // eslint-disable-next-line no-extra-parens
        (isNumber(c) && pos !== start);
}

function isExprChar(c) {
    return '+-/*%=<>&|!'.includes(c);
}

function getSelector(value, text = '') {
    if (value.startsWith('//')) {
        return {
            'value': cleanString(value),
            'isXPath': true,
        };
    } else if (value.startsWith('/')) {
        return {
            'error': 'XPath must start with `//`',
        };
    }
    const css = getCssValue(value, text);
    css.isXPath = false;
    return css;
}

function isExpressionCompatible(elem) {
    if (elem.kind === 'expression') {
        return true;
    }
    return elem.kind === 'tuple' && elem.canBeExpression === true;
}

function isArrayElementCompatible(expected, elem) {
    if (['string', 'object-path'].includes(expected.kind)) {
        return ['string', 'object-path'].includes(elem.kind);
    }
    return expected.kind === elem.kind;
}

// Used to concatenate all elements into a string, like `1 + "a" + 12` -> "1a12".
function concatExprAsString(elems) {
    let out = '';
    for (const elem of elems) {
        if (elem.kind === 'operator') {
            continue;
        } else if (['number', 'string', 'boolean'].includes(elem.kind)) {
            out += elem.value;
        } else {
            out += concatExprAsString(elem.value);
        }
    }
    return out;
}

function concatExprAsObjectPath(elems) {
    let s = '';
    const parts = [];

    for (const elem of elems) {
        if (elem.kind === 'operator') {
            continue;
        } else if (elem.kind !== 'object-path') {
            s += concatExprAsString([elem]);
        } else {
            elem.value[0].value = s + elem.value[0].value;
            parts.push(...elem.value);
            s = '';
        }
    }
    return parts;
}

// This function is used when generating an expression interpreted as a boolean.
function concatExprAsExpr(elems) {
    const out = [];
    for (let i = 0, len = elems.length; i < len; ++i) {
        const elem = elems[i];
        if (['operator', 'number', 'boolean'].includes(elem.kind)) {
            if (elem.originallyExpression && elem.originalKind !== 'tuple') {
                out.push(`(${elem.value})`);
            } else {
                out.push(elem.value);
            }
        } else if (elem.kind === 'string') {
            out.push(elem.fullText);
        } else if (['tuple', 'array', 'json'].includes(elem.kind)) {
            // The next non-operator elem will also be of the same type, so we can get it too.
            const funcName = elem.kind === 'json' ? 'compareJson' : 'compareArrayLike';
            i += 1;
            const operator = elems[i].value === '==' ? '' : '!';
            i += 1;
            const elem2 = elems[i];
            out.push(`${operator}${funcName}(${elem.displayInCode()}, ${elem2.displayInCode()})`);
        } else {
            // Should never happen normally since all sub-expressions should already have been
            // replaced.
            const sub = concatExprAsExpr(elem.value);
            out.push(`(${sub})`);
        }
    }
    return out.join(' ');
}

function canDoPlus(kind) {
    return [null, 'expression', 'number', 'variable', 'string', 'object-path'].includes(kind);
}

function canDoMathOperation(kind) {
    return [null, 'expression', 'number', 'variable'].includes(kind);
}

function isTypeCompatibleWith(kind, expected) {
    if ([null, 'expression', 'variable'].includes(kind)) {
        // It means variables haven't been inferred so we can skip it.
        return true;
    }
    if (expected === 'boolean') {
        return 'boolean' === kind;
    } else if (expected === 'number') {
        return 'number' === kind;
    } else if (expected === 'object-path') {
        return 'object-path' === kind;
    } else if (expected === 'string') {
        return ['number', 'string'].includes(kind);
    }
    return false;
}

function canBeCompared(kind1, kind2) {
    if (kind1 === kind2) {
        return true;
    }
    const ok = [null, 'expression', 'variable'];
    if (ok.includes(kind1) || ok.includes(kind2)) {
        return true;
    }
    // It's the only case where different types can be compared.
    const ok2 = ['number', 'string'];
    return ok2.includes(kind1) && ok2.includes(kind2);
}

function convertAsString(elem) {
    if (elem.value.some(v => v.kind === 'object-path')) {
        return new ObjectPathElement(
            concatExprAsObjectPath(elem.value),
            elem.startPos,
            elem.endPos,
            elem.fullText,
            elem.line,
            elem.error,
        );
    }
    return new StringElement(
        concatExprAsString(elem.value),
        elem.startPos,
        elem.endPos,
        elem.fullText,
        elem.line,
        elem.error,
    );
}

function convertExprAs(elem, convertAs) {
    let constructor = null;
    if (convertAs === 'boolean') {
        constructor = IdentElement;
    } else if (convertAs === 'number') {
        constructor = NumberElement;
    } else {
        // Error!
        return new UnknownElement(
            elem.value,
            elem.startPos,
            elem.endPos,
            elem.fullText,
            elem.line,
            `unknown \`${convertAs}\` kind`,
        );
    }
    const value = concatExprAsExpr(elem.value);
    const ret = new constructor(value, elem.startPos, elem.endPos, elem.line);
    ret.kind = convertAs;
    ret.fullText = elem.fullText;
    ret.originallyExpression = true;
    ret.originalKind = elem.kind;
    return ret;
}

function getArticleKind(kind) {
    if (kind === 'unknown') {
        return 'an unknown item';
    } else if (kind === 'json') {
        return 'a JSON dict';
    } else if (kind === 'object-path') {
        return 'an "object path"';
    }
    const contains = ['array', 'expression', 'ident', 'operator'].includes(kind);
    return (contains ? 'an ' : 'a ') + kind;
}

class Element {
    constructor(kind, value, startPos, endPos, fullText, line, error = null) {
        this.kind = kind;
        this.value = value;
        this.startPos = startPos;
        this.endPos = endPos;
        this.fullText = fullText;
        this.line = line;
        this.error = error;
        if (typeof line !== 'number') {
            throw new Error(
                `Element constructed with a line which is not a number but \`${typeof line}\``);
        }
    }

    getSelector(text = '') {
        return getSelector(this.getStringValue(true, false), text);
    }

    getStringValue(trim, clean = true) {
        let v = this.value;
        if (trim === true) {
            v = v.trim();
        }
        return clean === true ? cleanString(v) : v;
    }

    getIntegerValue(text, negativeCheck = false) {
        return checkInteger(this, text, negativeCheck);
    }

    getIntegerValueV2(allowNegative) {
        return checkIntegerV2(this, allowNegative);
    }

    getRaw() {
        return this.value;
    }

    getCssValue(text = '') {
        return getCssValue(this.value, text);
    }

    isRecursive() {
        // Only Tuple and JSON elements are "recursive" (meaning they can contain sub-levels).
        return false;
    }

    // Mostly there for debug, limit its usage as much as possible!
    getErrorText() {
        return this.fullText;
    }

    // Used for error messages.
    getArticleKind() {
        return getArticleKind(this.kind);
    }

    displayInCode() {
        return this.value;
    }

    isReservedVariableName() {
        return this.kind === 'ident' && this.value === RESERVED_VARIABLE_NAME;
    }

    isComparison() {
        return this.kind === 'operator' && ['<', '<=', '>', '>=', '==', '!='].includes(this.value);
    }

    isEqualityComparison() {
        return this.kind === 'operator' && ['==', '!='].includes(this.value);
    }

    isConditionalOperator() {
        return this.kind === 'operator' && ['&&', '||'].includes(this.value);
    }

    isMathOperation() {
        return this.kind === 'operator' && ['+', '-', '/', '*', '%'].includes(this.value);
    }

    clone() {
        return new this.constructor(
            this.kind, this.value, this.startPos, this.endPos, this.fullText, this.line, this.error,
        );
    }
}

class CharElement extends Element {
    constructor(value, startPos, line, error = null) {
        super('char', value, startPos, startPos, value, line, error);
    }

    clone() {
        return new this.constructor(this.value, this.startPos, this.line, this.error);
    }
}

class OperatorElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('operator', value, startPos, endPos, value, line, error);
    }

    clone() {
        return new this.constructor(this.value, this.startPos, this.endPos, this.line, this.error);
    }
}

class ExpressionElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('expression', value, startPos, endPos, fullText, line, error);
    }

    clone() {
        const elems = this.value.map(elem => elem.clone());
        return new this.constructor(
            elems, this.startPos, this.endPos, this.fullText, this.line, this.error,
        );
    }
}

class TupleElement extends Element {
    constructor(value, startPos, endPos, fullText, line, foundSeparator, error = null) {
        super('tuple', value, startPos, endPos, fullText, line, error);
        this.foundSeparator = foundSeparator;
        this.canBeExpression = this.foundSeparator === 0;
    }

    isRecursive() {
        return true;
    }

    displayInCode() {
        return '[' + this.value.map(e => e.displayInCode()).join(', ') + ']';
    }

    clone() {
        const elems = this.value.map(elem => elem.clone());
        return new this.constructor(
            elems, this.startPos, this.endPos, this.fullText, this.line, this.foundSeparator,
            this.error,
        );
    }
}

class ArrayElement extends Element {
    constructor(value, startPos, endPos, fullText, line, foundSeparator, error = null) {
        super('array', value, startPos, endPos, fullText, line, error);
        this.foundSeparator = foundSeparator;
        this.needCheck = false;
    }

    isRecursive() {
        return true;
    }

    displayInCode() {
        return '[' + this.value.map(e => e.displayInCode()).join(', ') + ']';
    }

    validate(checkVariables) {
        const values = this.value;
        if (checkVariables &&
            (values[0].kind === 'variable' || isExpressionCompatible(values[0]))
        ) {
            this.needCheck = true;
            return null;
        }

        for (let i = 1; i < values.length; ++i) {
            if (checkVariables &&
                (values[i].kind === 'variable' || isExpressionCompatible(values[i]))
            ) {
                this.needCheck = true;
                return null;
            } else if (!isArrayElementCompatible(values[0], values[i])) {
                this.error = 'all array\'s elements must be of the same kind: expected ' +
                    `array of \`${values[0].kind}\` (because the first element is of this ` +
                    `kind), found \`${values[i].kind}\` at position ${i}`;
                return this.error;
            }
        }
        return null;
    }

    clone() {
        const elems = this.value.map(elem => elem.clone());
        const ret = new this.constructor(
            elems, this.startPos, this.endPos, this.fullText, this.line, this.foundSeparator,
            this.error,
        );
        ret.needCheck = this.needCheck;
        return ret;
    }
}

class StringElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('string', value, startPos, endPos, fullText, line, error);
    }

    displayInCode() {
        return `"${cleanString(this.value)}"`;
    }

    clone() {
        return new this.constructor(
            this.value, this.startPos, this.endPos, this.fullText, this.line, this.error,
        );
    }
}

class ObjectPathElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('object-path', value, startPos, endPos, fullText, line, error);
    }

    getStringValue(trim, clean = true) {
        const content = this.value.map(v => `"${v.getStringValue(clean)}"`).join(',');
        return `[${content}]`;
    }

    validate(checkVariables) {
        for (const value of this.value) {
            if (checkVariables &&
                (value.kind === 'variable' || isExpressionCompatible(value))
            ) {
                continue;
            } else if (value.kind !== 'string') {
                this.error = `all object path's elements must be strings: found \`${value.kind}\` \
(${getArticleKind(value.kind)})`;
                return this.error;
            }
        }
        return null;
    }

    clone() {
        const elems = this.value.map(elem => elem.clone());
        return new this.constructor(
            elems, this.startPos, this.endPos, this.fullText, this.line, this.error,
        );
    }
}

class IdentElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        const kind = value === 'true' || value === 'false' ? 'boolean' : 'ident';
        super(kind, value, startPos, endPos, value, line, error);
    }
    clone() {
        return new this.constructor(this.value, this.startPos, this.endPos, this.line, this.error);
    }
}

class NumberElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('number', value, startPos, endPos, value, line, error);
        value = String(value);
        this.isFloat = value.includes('.');
        this.isNegative = value.startsWith('-');
    }

    clone() {
        return new this.constructor(this.value, this.startPos, this.endPos, this.line, this.error);
    }
}

class JsonElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('json', value, startPos, endPos, fullText, line, error);
    }

    isRecursive() {
        return true;
    }

    displayInCode() {
        const p = this.value.map(e => {
            return e.key.displayInCode() + ': ' + e.value.displayInCode();
        });
        return '{' + p.join(', ') + '}';
    }

    clone() {
        const elems = this.value.map(elem => {
            return {'key': elem.key.clone(), 'value': elem.value.clone()};
        });
        return new this.constructor(
            elems, this.startPos, this.endPos, this.fullText, this.line, this.error,
        );
    }
}

class UnknownElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('unknown', value, startPos, endPos, value, line, error);
    }

    clone() {
        return new this.constructor(
            this.value, this.startPos, this.endPos, this.line, this.error,
        );
    }
}

class VariableElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('variable', value, startPos, endPos, fullText, line, error);
    }

    clone() {
        return new this.constructor(
            this.value, this.startPos, this.endPos, this.fullText, this.line, this.error,
        );
    }
}

class BlockElement extends Element {
    constructor(
        fullText,
        blockCode,
        blockLine,
        elems,
        startPos,
        endPos,
        line,
        hasVariable,
        error = null,
    ) {
        super(
            'block',
            elems,
            startPos,
            endPos,
            fullText,
            line,
            error,
        );
        this.blockCode = blockCode;
        this.blockLine = blockLine;
        this.hasVariable = hasVariable;
    }

    getErrorText() {
        // Because it'd be too long to display the full block.
        return 'block { ... }';
    }

    getBlockCode() {
        return this.blockCode;
    }

    clone() {
        return new this.constructor(
            this.fullText,
            this.blockCode,
            this.blockLine,
            this.value.map(e => e.clone()),
            this.startPos,
            this.endPos,
            this.line,
            this.hasVariable,
            this.error,
        );
    }
}

function addErrorTo(message, line, isFatal, errors) {
    if (message === null) {
        throw new Error('Error with `null` message');
    }
    let addError = true;
    if (errors.length > 0) {
        const last = errors[errors.length - 1];
        addError = last.message !== message || last.line !== line;
    }
    if (addError) {
        errors.push({
            'message': message,
            'isFatal': isFatal,
            'line': line,
        });
    }
}

class Parser {
    constructor(text) {
        // We have to put this import here and not at the top of the file to avoid circular import.
        const { ORDERS } = require('./commands.js');

        this.text = text;
        this.pos = 0;
        this.elems = [];
        this.errors = [];
        this.orders = ORDERS;
        // For humans, the first line isn't 0 but 1.
        this.currentLine = 1;
        this.commandLine = 1;
        this.command = null;
        this.hasFatalError = false;
        this.hasVariable = false;
        this.commandStart = 0;
        this.checkObjectPath = true;
    }

    setError(error, isFatal) {
        addErrorTo(error, this.currentLine, isFatal, this.errors);
        if (isFatal) {
            this.hasFatalError = true;
        }
    }

    getCurrentChar() {
        if (this.pos < this.text.length) {
            return this.text.charAt(this.pos);
        }
        return null;
    }

    parseNextCommand(endChars = null, pushTo = null) {
        if (pushTo === null) {
            this.elems = [];
            pushTo = this.elems;
            this.errors = [];
        }
        const nbErrors = this.errors.length;
        this.hasFatalError = false;
        this.hasVariable = false;
        // First, we skip all unneeded characters...
        this.skipWhiteSpaceCharacters();
        this.commandLine = this.currentLine;
        this.command = this.extractNextCommandName(endChars);
        if (this.errors.length > nbErrors) {
            return {
                'errors': true,
                'finished': false,
            };
        } else if (this.command === null) {
            return {
                'errors': false,
                'finished': true,
            };
        }
        this.commandLine = this.currentLine;
        const order = this.command.getRaw().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(this.orders, order)) {
            this.setError(`Unknown command "${order}"`, false);
        }
        if (endChars === null) {
            endChars = ['\n'];
        }
        // Now that we have the command, let's get its arguments!
        this.parse(endChars, pushTo);
        if (this.errors.length === nbErrors) {
            const validator = new ExpressionsValidator(this.getElems(pushTo), false, this.text);
            this.errors.push(...validator.errors);
            this.hasFatalError = validator.hasFatalError;
        }
        return {
            'errors': this.errors.length !== nbErrors || this.hasFatalError,
            'finished': false,
        };
    }

    skipWhiteSpaceCharacters() {
        while (isWhiteSpace(this.getCurrentChar())) {
            this.increasePos(false);
        }
    }

    isCommentStart() {
        if (this.pos + 1 < this.text.length) {
            const c1 = this.text.charAt(this.pos);
            const c2 = this.text.charAt(this.pos + 1);
            return c1 === c2 && c1 === '/';
        }
        return false;
    }

    isNumberStart() {
        const c = this.text.charAt(this.pos);
        if (isNumber(c)) {
            return true;
        } else if (c !== '-') {
            return false;
        }
        return this.pos + 1 < this.text.length && isNumber(this.text.charAt(this.pos + 1));
    }

    isVariableStart(c) {
        if (this.pos + 1 < this.text.length) {
            const c2 = this.text.charAt(this.pos + 1);
            return c === '|' && isIdentChar(c2);
        }
        return false;
    }

    extractNextCommandName(endChars) {
        let command = null;

        while (command === null) {
            const c = this.getCurrentChar();
            if (c === null) {
                break;
            }
            const tmp = [];

            if (this.isCommentStart()) {
                this.parseComment(tmp);
                if (tmp.length !== 0) {
                    this.setError('Unexpected `/` when parsing command', true);
                    return null;
                }
            } else if (isWhiteSpace(c)) {
                // Do nothing.
            } else if (isLetter(c)) {
                this.commandStart = this.pos;
                this.parseIdent(tmp, ['-']);
                command = tmp.pop();
            } else if (endChars !== null && endChars.includes(c)) {
                return null;
            } else {
                this.setError(`Unexpected ${showChar(c)} when parsing command`, true);
                return null;
            }
            this.increasePos();
        }

        if (command === null && this.pos >= this.text.length) {
            return null;
        }

        let stop = false;
        // Now we have the command ident, let's reach the `:` before moving on!
        while (!stop) {
            const c = this.getCurrentChar();
            if (c === null) {
                break;
            }

            if (c === '/') {
                // No need to check anything, if there is a comment, it means it'll be on two lines,
                // which isn't allowed.
                this.setError('Unexpected `/` when parsing command ' +
                    `(after \`${command.getRaw()}\`)`, true);
                return null;
            } else if (c === '\n') {
                this.setError('Backlines are not allowed between command identifier and `:`', true);
                return null;
            } else if (isWhiteSpace(c)) {
                // Do nothing...
            } else if (c === ':') {
                stop = true;
            } else {
                this.setError(`Unexpected ${showChar(c)} when parsing command ` +
                    `(after \`${command.getRaw()}\`)`, true);
                return null;
            }
            this.increasePos();
        }
        if (!stop) {
            this.setError(
                `Missing \`:\` after command identifier (after \`${command.getRaw()}\`)`, true);
            return null;
        }
        return command;
    }

    increasePos(increaseIfNothing = true, skipBackline = true) {
        const start = this.pos;
        while (isWhiteSpace(this.getCurrentChar())) {
            if (this.text.charAt(this.pos) === '\n') {
                this.currentLine += 1;
                if (!skipBackline) {
                    break;
                }
            }
            this.pos += 1;
        }
        if (increaseIfNothing === true && start === this.pos) {
            this.pos += 1;
        }
    }

    decreasePos() {
        if (this.pos < 1) {
            return;
        }
        this.pos -= 1;
        if (this.getCurrentChar() === '\n') {
            this.currentLine -= 1;
        }
    }

    getElems(pushTo = null) {
        return pushTo !== null ? pushTo : this.elems;
    }

    getLastElem(pushTo = null) {
        const elems = this.getElems(pushTo);
        if (elems.length === 0) {
            return null;
        }
        return elems[elems.length - 1];
    }

    parse(
        endChars = ['\n'],
        pushTo = null,
        separator = null,
        extra = '',
        exclude = null,
        stopAtFirstError = false,
    ) {
        let prev = '';
        let endChar = null;
        let foundSeparator = 0;
        const skipBackline = !endChars.includes('\n');
        if (exclude === null) {
            exclude = [];
        }
        let stopLoop = false;

        const checker = (c, toCall) => {
            const elems = this.getElems(pushTo);
            const nbElems = elems.length;
            const isError = elems.length > 0 && prev !== separator;
            const checkerNbErrors = this.errors.length;
            toCall.call(this, pushTo);
            if (!isError) {
                prev = '';
                return;
            }

            const removedErrors = [];
            while (this.errors.length > checkerNbErrors) {
                removedErrors.push(this.errors.pop());
            }
            let msg;

            if (separator === null) {
                if (endChars.length === 1) {
                    msg = endChars[0] === '\n' ? 'nothing' : showChar(endChars[0]);
                } else {
                    msg = endChars.filter(e => exclude.indexOf(e) === -1)
                        .map(e => showChar(e))
                        .join(' or ');
                }
            } else {
                if (c === '\n') {
                    msg = showChar(separator);
                } else {
                    const chars = endChars.filter(e => exclude.indexOf(e) === -1)
                        .map(e => showChar(e))
                        .join(' or ');
                    msg = `${showChar(separator)} or ${chars}`;
                }
            }
            let err;
            const prevElem = elems[elems.length - 1];
            if (nbElems === elems.length) {
                err = `expected ${msg} before \`${showEnd(prevElem)}\`, found ${showChar(c)}`;
            } else {
                err = `expected ${msg} after \`${showEnd(elems[elems.length - 2])}\`, \
found \`${showEnd(prevElem)}\``;
            }
            if (nbElems === elems.length) {
                // In case no new element was added.
                this.push(new CharElement(c, this.pos, this.currentLine, err), pushTo);
            } else {
                prevElem.error = err;
            }
            this.setError(err, nbElems === elems.length);
            // We put back the errors we removed in the right order.
            removedErrors.reverse();
            this.errors.push(...removedErrors);
            if (stopAtFirstError) {
                stopLoop = true;
            }
        };

        while (!this.hasFatalError && !stopLoop) {
            const c = this.getCurrentChar();
            if (c === null) {
                break;
            }

            if (endChars.includes(c)) {
                endChar = c;
                break;
            } else if (isStringChar(c)) {
                checker(c, arg => this.parseString(
                    separator !== null ? [...endChars, separator] : endChars,
                    arg,
                ));
            } else if (c === '{') {
                checker(c, this.parseJson);
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (c === separator) {
                foundSeparator += 1;
                const elems = this.getElems(pushTo);
                if (elems.length === 0) {
                    const e = `unexpected \`${separator}\` as first element`;
                    this.push(new CharElement(separator, this.pos, this.currentLine, e), pushTo);
                    this.setError(e, false);
                } else if (prev === separator) {
                    const e = `unexpected \`${separator}\` after \`${separator}\``;
                    this.push(new CharElement(separator, this.pos, this.currentLine, e), pushTo);
                    this.setError(e, false);
                } else if (elems[elems.length - 1].kind === 'char') {
                    // TODO: not sure if this block is useful...
                    const prevElem = elems[elems.length - 1].text;
                    const e = `unexpected \`${separator}\` after \`${prevElem}\``;
                    this.push(new CharElement(separator, this.pos, this.currentLine, e), pushTo);
                    this.setError(e, false);
                } else {
                    prev = separator;
                }
            } else if (isNumber(c)) {
                checker(c, this.parseNumber);
            // If it's a negative number, check is a bit trickier since it can also be an
            // expression like in `1-2`.
            } else if (c === '-' && this.isNumberStart() &&
                (this.getElems(pushTo).length === 0 || prev !== '')
            ) {
                checker(c, this.parseNumber);
            } else if (c === '(') {
                checker(c, this.parseTuple);
            } else if (c === '[') {
                checker(c, this.parseArray);
            } else if (this.isCommentStart()) {
                this.parseComment(pushTo);
                // We want to keep the backline in case this is the end char.
                continue;
            } else if (this.isVariableStart(c)) {
                checker(c, arg => this.parseVariable(endChars, arg));
            } else if (isExprChar(c) &&
                this.getElems(pushTo).length !== 0 &&
                this.parseOperator(pushTo)
            ) {
                // Moving paste the operator.
                this.increasePos();
                let enders = endChars;
                if (separator !== null && !endChars.includes(separator)) {
                    enders = endChars.concat([separator]);
                }
                const elems = this.getElems(pushTo);
                // We remove the two last elements from the current array to pass them
                // to `parseExpression`.
                const expr = this.getElems(pushTo).splice(elems.length - 2, 2);
                this.parseExpression(expr, enders, pushTo);
                prev = '';
                // Don't increment position.
                continue;
            } else {
                checker(c, this.parseIdent);
                const elems = this.getElems(pushTo);
                const el = elems[elems.length - 1];
                if (el.kind === 'unknown') {
                    const token = el.value;
                    if (elems.length === 1) {
                        // We special-case the `-` sign.
                        if (token === '-' && this.pos + 1 < this.text.length) {
                            el.error = `unexpected \`${this.text.charAt(this.pos + 1)}\` after \
\`${token}\``;
                        } else {
                            el.error = `unexpected \`${token}\` as first token${extra}`;
                        }
                    } else {
                        const prevElem = elems[elems.length - 2].getErrorText();
                        el.error = `unexpected token \`${token}\` after \`${prevElem}\``;
                    }
                    this.setError(el.error, false);
                }
            }
            this.increasePos(true, skipBackline);
        }
        return [prev, endChar, foundSeparator];
    }

    parseExpression(elems, endChars, pushTo = null) {
        const startLine = elems.length !== 0 ? elems[0].line : this.currentLine;
        const start = elems.length !== 0 ? elems[0].startPos : this.pos;

        const errorFunc = elem => {
            let error;
            if (elems.length > 0) {
                error = `unexpected ${elem} after \`${elems[elems.length - 1].getErrorText()}\``;
            } else if (this.getLastElem(pushTo) !== null || this.getLastElem() !== null) {
                const last = this.getLastElem(pushTo) || this.getLastElem();
                error = `unexpected ${elem} after \`${last.getErrorText()}\``;
            } else {
                error = `unexpected ${elem} as first token`;
            }
            this.push(
                new ExpressionElement(
                    elems,
                    start,
                    this.pos,
                    this.text.substring(start, this.pos + 1),
                    startLine,
                    error,
                ),
                pushTo,
            );
            this.setError(error, false);
        };

        while (!this.hasFatalError) {
            const last = this.getLastElem(elems);
            const prevIsOperator = last !== null && last.kind === 'operator';
            const c = this.getCurrentChar();

            if (c === null || endChars.includes(c)) {
                let stop = true;
                if (c === '\n') {
                    const last = this.getLastElem(elems);
                    if (last !== null && last.kind === 'operator') {
                        // In this case, we don't stop!
                        stop = false;
                    }
                } else if (c === null && endChars.includes(')')) {
                    const err = `\
missing \`)\` at the end of the expression started line ${startLine}`;
                    this.push(
                        new ExpressionElement(
                            elems,
                            start,
                            this.pos,
                            this.text.substring(start, this.pos + 1),
                            startLine,
                            err,
                        ),
                        pushTo,
                    );
                    this.setError(err, false);
                    return;
                }
                if (stop) {
                    break;
                }
            } else if (isStringChar(c)) {
                this.parseString(endChars, elems);
            } else if (isWhiteSpace(c)) {
                // Do nothing.
            } else if (this.isCommentStart()) {
                this.parseComment(elems);
                // We want to keep the backline in case this is the end char.
                continue;
            } else if (this.isVariableStart(c)) {
                this.parseVariable(endChars, elems);
            } else if (c === '-') {
                // We need to disambiguate if it's an operator or a number.
                if (!this.isNumberStart() || !prevIsOperator) {
                    this.parseOperator(elems);
                } else {
                    this.parseNumber(elems);
                }
            } else if (isExprChar(c)) {
                this.parseOperator(elems);
            } else if (this.isNumberStart()) {
                this.parseNumber(elems);
            } else if (c === '[') {
                this.parseArray(elems);
            } else if (c === '{') {
                this.parseJson(elems);
            } else if (c === '(') {
                this.parseTuple(elems);
            } else if (isLetter(c)) {
                this.parseIdent(elems);
                const last = elems[elems.length - 1];
                if (last.kind !== 'boolean') {
                    errorFunc(`\`${last.getErrorText()}\` (${last.getArticleKind()}`);
                    return;
                }
            } else {
                errorFunc(showChar(c));
                return;
            }
            this.increasePos();
        }
        const expr = new ExpressionElement(
            elems,
            start,
            this.pos,
            this.text.substring(start, this.pos),
            startLine,
        );
        this.push(expr, pushTo);
        if (this.hasFatalError) {
            return;
        }

        // Checking all potential errors now.
        if (elems.length === 0) {
            expr.error = 'empty expressions (`()`) are not allowed';
            this.setError(expr.error, false);
            return;
        }

        if (elems[0].kind === 'operator') {
            elems[0].error = `unexpected operator \`${elems[0].getErrorText()}\``;
            expr.error = elems[0].error;
            this.setError(elems[0].error, false);
            return;
        }

        let prev = null;
        let prevElem = null;
        // First we check that all elements are separated by one operator.
        for (const el of elems) {
            if (el.kind === prev) {
                if (prev === 'operator') {
                    el.error = `expected element after operator \`${prevElem.getErrorText()}\`, \
found \`${el.getErrorText()}\` (${el.getArticleKind()})`;
                } else {
                    el.error = `expected operator after ${prevElem.kind} \
\`${prevElem.getErrorText()}\`, found \`${el.getErrorText()}\` (${el.getArticleKind()})`;
                }
                expr.error = el.error;
                this.setError(el.error, false);
                return;
            }
            prev = el.kind === 'operator' ? 'operator' : 'element';
            prevElem = el;
        }
        // Then we check that the last element is not an operator.
        const last = elems[elems.length - 1];
        if (last.kind === 'operator') {
            last.error = `missing element after operator \`${last.getErrorText()}\``;
            expr.error = last.error;
            this.setError(last.error, false);
            return;
        }
    }

    parseOperator(pushTo = null) {
        const start = this.pos;
        const startLine = this.currentLine;

        while (!this.hasFatalError) {
            const c = this.getCurrentChar();
            if (c === null || !isExprChar(c)) {
                const op = this.text.substring(start, this.pos);
                if (SUPPORTED_OPERATORS.includes(op)) {
                    this.push(new OperatorElement(op, start, this.pos, startLine), pushTo);
                    this.decreasePos(); // Going back to last operator character.
                    return true;
                }
                if (op.length < 2) {
                    // Very likely a `|` or `&`... In this case, we reset and don't create an
                    // error (at least not here).
                    while (this.pos > start) {
                        this.decreasePos();
                    }
                } else {
                    const e = `unknown operator \`${op}\``;
                    this.push(new OperatorElement(op, start, this.pos, startLine, e), pushTo);
                    this.setError(e, false);
                }
                return false;
            }
            this.increasePos();
        }
    }

    parseComment(pushTo = null) {
        const start = this.pos;
        if (this.text.charAt(this.pos + 1) === '/') {
            while (this.pos < this.text.length && this.text.charAt(this.pos) !== '\n') {
                this.pos += 1;
            }
        } else {
            this.push(new UnknownElement('/', start, this.pos, this.currentLine), pushTo);
        }
    }

    parseList(endChar, constructor, pushTo = null) {
        const start = this.pos;
        const elems = [];
        const startLine = this.currentLine;

        this.increasePos();
        const nbErrors = this.errors.length;
        const [prev, ender, foundSeparator] = this.parse([endChar], elems, ',');
        const full = this.text.substring(start, this.pos + 1);
        if (elems.length > 0 && nbErrors !== this.errors.length) {
            this.push(
                new constructor(
                    elems,
                    start,
                    this.pos + 1,
                    full,
                    this.currentLine,
                    foundSeparator,
                    elems.find(el => el.error !== null).error,
                ),
                pushTo,
            );
        } else if (this.pos >= this.text.length || ender !== endChar) {
            if (elems.length === 0) {
                const e = `expected ${showChar(endChar)} at the end`;
                this.push(
                    new constructor(elems, start, this.pos, full, startLine, foundSeparator, e),
                    pushTo,
                );
                this.setError(e, true);
            } else {
                let err;

                if (prev === ',') {
                    const last = elems[elems.length - 1].getErrorText();
                    err = `expected ${showChar(endChar)} after \`${last}\``;
                } else {
                    err = `expected ${showChar(endChar)} or \`,\` after ` +
                        `\`${elems[elems.length - 1].getErrorText()}\``;
                }
                this.push(
                    new constructor(elems, start, this.pos, full, startLine, foundSeparator, err),
                    pushTo,
                );
                this.setError(err, false);
            }
        } else {
            this.push(
                new constructor(elems, start, this.pos + 1, full, startLine, foundSeparator),
                pushTo,
            );
        }
    }

    parseTuple(pushTo = null) {
        const tmp = [];
        this.parseList(')', TupleElement, tmp);
        this.push(tmp[0], pushTo);
    }

    parseArray(pushTo = null) {
        const tmp = [];
        this.parseList(']', ArrayElement, tmp);
        if (tmp[0].error === null && tmp[0].getRaw().length > 1) {
            const error = tmp[0].validate(true);
            if (error !== null) {
                this.setError(error, false);
            }
        }
        this.push(tmp[0], pushTo);
    }

    lookAheadNextChar() {
        for (let pos = this.pos + 1; pos < this.text.length; ++pos) {
            const c = this.text.charAt(pos);
            if (isWhiteSpace(c)) {
                continue;
            }
            return c;
        }
        return null;
    }

    parseObjectPath(endChars, pushTo) {
        if (!this.checkObjectPath) {
            return;
        }
        const nextChar = this.lookAheadNextChar();
        if (nextChar !== '.') {
            return;
        }

        const path = [this.getPushTo(pushTo).pop()];
        this.increasePos();
        let error = null;
        const nbErrors = this.errors.length;

        this.checkObjectPath = false;
        const [prev, _, _1] = this.parse(endChars, path, '.');
        if (prev !== '') {
            error = 'expected a string after `.`';
            if (nbErrors === this.errors.length) {
                this.setError(error, false);
            }
        }
        this.checkObjectPath = true;
        const start = path[0].startPos;
        const full = this.text.substring(start, this.pos);
        const elem = new ObjectPathElement(path, start, this.pos, full, this.currentLine, error);
        if (error === null) {
            error = elem.validate(true);
            if (error !== null) {
                this.setError(error, false);
            }
        }
        this.push(elem, pushTo);
        if (error === null && nbErrors === this.errors.length) {
            this.decreasePos(); // Need to go back to last "good" letter.
        }
    }

    parseString(endChars, pushTo = null) {
        const start = this.pos;
        const endChar = this.text.charAt(this.pos);

        this.increasePos();
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            if (c === endChar) {
                const value = this.text.substring(start + 1, this.pos);
                const full = this.text.substring(start, this.pos + 1);
                const e = new StringElement(value, start, this.pos + 1, full, this.currentLine);
                this.push(e, pushTo);
                this.parseObjectPath(endChars, pushTo);
                return;
            } else if (c === '\\') {
                this.pos += 1;
            }
            this.increasePos();
        }
        const value = this.text.substring(start + 1, this.pos);
        const full = this.text.substring(start, this.pos);
        const e = `expected \`${endChar}\` at the end of the string`;
        this.push(
            new StringElement(value, start, this.pos, full, this.currentLine, e),
            pushTo,
        );
        this.setError(e, false);
    }

    parseIdent(pushTo = null, specialChars = null) {
        if (specialChars === null) {
            specialChars = [];
        } else if (!Array.isArray(specialChars)) {
            throw new Error('`specialChars` variable should be an array!');
        }
        const start = this.pos;
        // Loop as long as it is a latin letter or a number.
        while (isIdentChar(this.getCurrentChar(), start, this.pos, specialChars)) {
            this.increasePos();
        }
        const ident = this.text.substring(start, this.pos);
        if (ident.length === 0) {
            this.push(
                new UnknownElement(this.text.charAt(start), start, this.pos, this.currentLine),
                pushTo,
            );
            return false;
        }
        if (ident === 'block') {
            this.parseBlock(start, pushTo);
        } else {
            this.push(new IdentElement(ident, start, this.pos, this.currentLine), pushTo);
            this.decreasePos(); // Need to go back to last "good" letter.
        }
        return true;
    }

    parseBlock(startPos, pushTo = null) {
        // To prevent cyclic import.
        const { CommandNode } = require('./ast.js');

        const line = this.currentLine;
        let error = null;

        this.skipWhiteSpaceCharacters();
        let c = this.getCurrentChar();
        if (c !== '{') {
            const kind = c === null ? 'nothing' : `\`${c}\``;
            const fullText = this.text.slice(startPos, this.pos);
            const e = `Expected \`{\` after \`block\` keyword, found ${kind}`;
            this.push(
                new BlockElement(
                    fullText,
                    '',
                    line,
                    [],
                    startPos,
                    this.pos,
                    this.currentLine,
                    false,
                    e,
                ),
                pushTo,
            );
            this.setError(e, false);
            return;
        }
        const blockLine = this.currentLine;
        // We go after the `{`.
        this.increasePos();
        // We save the current command and elems to prevent them to be overwrote when parsing
        // the `block` content.
        const commandNodes = [];
        const command = this.command;
        const hasVariable = this.hasVariable;
        const blockStart = this.pos;
        const nbErrors = this.errors.length;
        const hasFatalError = this.hasFatalError;
        this.hasFatalError = false;
        while (c !== '}') {
            const elems = [];
            const ret = this.parseNextCommand(['\n', '}'], elems);
            if (ret.errors !== false) {
                error = this.errors[this.errors.length - 1].message;
                if (this.hasFatalError) {
                    break;
                }
            } else if (ret.finished === true) {
                this.skipWhiteSpaceCharacters();
                c = this.getCurrentChar();
                if (c !== '}') {
                    error = `Expected \`}\` to end the block, found \`${showChar(c)}\``;
                    this.setError(error, true);
                }
                break;
            } else {
                commandNodes.push(new CommandNode(
                    this.command.getRaw(),
                    this.commandLine,
                    elems,
                    this.hasVariable,
                    this.commandStart,
                    this.text,
                ));
            }
            this.skipWhiteSpaceCharacters();
            c = this.getCurrentChar();
            if (c === null) {
                error = 'Missing `}` to end the block';
                this.setError(error, true);
                break;
            }
        }

        for (let i = nbErrors; i < this.errors.length; ++i) {
            if (this.errors[i].message.indexOf(' to end the block') === -1) {
                this.errors[i].message += ' (in `block { ... }`)';
            }
        }

        const fullText = this.text.slice(startPos, this.pos + 1);
        const blockCode = this.text.slice(blockStart, this.pos);
        this.push(
            new BlockElement(
                fullText,
                blockCode,
                blockLine,
                commandNodes,
                startPos,
                this.pos,
                line,
                this.hasVariable,
                error,
            ),
            pushTo,
        );

        // We set back the values before the `block` parsing.
        this.command = command;
        this.hasVariable = hasVariable;
        this.hasFatalError = hasFatalError || this.hasFatalError;
    }

    parseVariable(endChars, pushTo = null) {
        const start = this.pos;

        this.increasePos();
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            if (c === '|') {
                const variableName = this.text.substring(start + 1, this.pos).trim();
                this.push(
                    new VariableElement(
                        variableName,
                        start,
                        this.pos + 1,
                        this.text.substring(start, this.pos + 1),
                        this.currentLine,
                    ),
                    pushTo,
                );
                this.parseObjectPath(endChars, pushTo);
                return;
            } else if (!isIdentChar(c, start, this.pos)) {
                const variableName = this.text.substring(start + 1, this.pos).trim();
                const fullText = this.text.substring(start, this.pos);
                const e = `unexpected character \`${c}\` after \`${fullText}\``;
                this.push(
                    new VariableElement(
                        variableName,
                        start,
                        this.pos,
                        fullText,
                        this.currentLine,
                        e,
                    ),
                    pushTo,
                );
                this.setError(e, false);
                this.decreasePos();
                return;
            }
            this.increasePos();
        }
        const variableName = this.text.substring(start + 1, this.pos).trim();
        const fullText = this.text.substring(start, this.pos);
        const e = `expected \`|\` after the variable name \`${fullText}\``;
        this.push(
            new VariableElement(
                variableName,
                start,
                this.pos,
                fullText,
                this.currentLine,
                e,
            ),
            pushTo,
        );
        this.setError(e, false);
    }

    parseNumber(pushTo = null) {
        const start = this.pos;
        let hasDot = false;
        let nbDigit = 0;

        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (c === '-' && nbDigit === 0 && hasDot === false) {
                // Nothing to do.
            } else if (c === '.') {
                if (hasDot === true) {
                    const nb = this.text.substring(start, this.pos);
                    const e = `unexpected \`.\` after \`${nb}\``;
                    this.push(
                        new NumberElement(nb, start, this.pos, this.currentLine, e), pushTo);
                    this.setError(e, false);
                    return;
                }
                hasDot = true;
            } else if (isNumber(c) === false) {
                if (nbDigit < 1) {
                    const nb = this.text.substring(start, this.pos);
                    const e = `unexpected \`${c}\` after \`${nb}\``;
                    this.push(
                        new NumberElement(nb, start, this.pos, this.currentLine, e), pushTo);
                    this.setError(e, false);
                    return;
                }
                const nb = this.text.substring(start, this.pos);
                this.push(new NumberElement(nb, start, this.pos, this.currentLine), pushTo);
                this.decreasePos();
                return;
            } else {
                nbDigit += 1;
            }
            this.increasePos();
        }
        const nb = this.text.substring(start, this.pos);
        this.push(new NumberElement(nb, start, this.pos, this.currentLine), pushTo);
    }

    getPushTo(pushTo) {
        return pushTo !== null ? pushTo : this.elems;
    }

    push(e, pushTo) {
        if (e instanceof VariableElement) {
            this.hasVariable = true;
        }
        this.getPushTo(pushTo).push(e);
    }

    parseJson(pushTo = null) {
        const start = this.pos;
        const startLine = this.currentLine;
        const json = [];
        let error = null;

        const keyError = errorMsg => {
            this.setError(errorMsg, false);
            if (error === null) {
                error = errorMsg;
            }
        };

        // Moving past the `{` character.
        this.increasePos();

        let ender = '';
        let elems = [];
        let key = null;

        while (ender !== '}' && this.pos < this.text.length && !this.hasFatalError) {
            const nbErrors = this.errors.length;
            elems = [];

            if (key === null) {
                ender = this.parse(
                    [':', '}', ','], elems, null, ' of JSON dict key', ['}', ','], true)[1];
                if (elems.length === 0) {
                    if (ender === ':') {
                        keyError('expected key before `:`');
                    } else if (ender === ',') {
                        if (json.length === 0) {
                            if (error === null) {
                                keyError('expected a key after `{`, found `,`');
                            }
                        } else {
                            const err = json[json.length - 1].value.getErrorText();
                            keyError(`expected a key after \`${err}\`, found \`,\``);
                        }
                    } else if (ender === '}') {
                        break;
                    }
                    this.increasePos(); // Moving past whatever we encountered.
                    continue;
                } else if (elems.length > 1) {
                    if (this.hasFatalError) {
                        return;
                    }
                    if (elems[elems.length - 1].error !== null) {
                        error = elems[elems.length - 1].error;
                    }
                    // We go to the next key (or whatever looks like to be the next key).
                    while (this.pos < this.text.length && ![',', '}', ':'].includes(
                        this.getCurrentChar())) {
                        this.increasePos();
                    }
                    if (this.pos < this.text.length) {
                        if (this.getCurrentChar() !== ':') {
                            ender = this.getCurrentChar();
                            continue;
                        }
                    } else {
                        continue;
                    }
                } else if (elems[0].error !== null && elems[0].kind !== 'unknown') {
                    keyError(elems[0].error);
                    if (this.hasFatalError) {
                        return;
                    }
                } else if (!['string', 'variable', 'expression', 'object-path'].includes(
                    elems[0].kind)
                ) {
                    const article = elems[0].getArticleKind();
                    const extra = ` (\`${elems[0].getErrorText()}\`)`;
                    keyError(`only strings and object paths can be used as keys in JSON dict, \
found ${article}${extra}`);
                } else if (ender === '}' || ender === ',') {
                    const after = elems[0].getErrorText();
                    keyError(`expected \`:\` after \`${after}\`, found \`${ender}\``);
                    continue;
                } else if (this.errors.length > nbErrors) {
                    keyError(this.errors[this.errors.length - 1].message);
                    if (this.hasFatalError) {
                        return;
                    }
                }
                key = elems[0];
            }

            if (this.getCurrentChar() === ':') {
                this.increasePos(); // Moving past `:`.
            }

            elems = [];
            ender = this.parse(
                [',', ':', '}'], elems, null, ` for key \`${key.getErrorText()}\``, [':'], true)[1];
            if (elems.length > 1) {
                const newErr = `expected \`,\` or \`}\` after \`${elems[0].getErrorText()}\`, \
found \`${elems[1].getErrorText()}\``;
                keyError(newErr);

                json.push({'key': key, 'value': elems[0]});

                key = elems[1];
            } else if (elems.length === 0) {
                const newErr = `expected a value for key \`${key.getErrorText()}\`, found nothing`;
                keyError(newErr, ender === '}');
                const fullText = this.text.substring(start, this.pos + 1);
                this.push(
                    new JsonElement(json, start, this.pos, fullText, startLine, newErr),
                    pushTo,
                );
                return;
            } else if (ender === ':') {
                keyError(`expected \`,\` or \`}\` after \`${elems[0].getErrorText()}\`, \
found \`:\``);
            } else if (this.errors.length > nbErrors) {
                const newErr = this.errors[this.errors.length - 1].message;
                keyError(newErr);
                if (this.hasFatalError) {
                    const fullText = this.text.substring(start, this.pos + 1);
                    this.push(
                        new JsonElement(json, start, this.pos, fullText, startLine, newErr),
                        pushTo,
                    );
                    return;
                }
            }

            if (ender === ',') {
                this.increasePos(); // Moving past `,`.
            }

            if (elems.length === 1) {
                json.push({'key': key, 'value': elems[0]});
                key = null;
            }
        }
        if (ender !== '}') {
            if (json.length === 0) {
                error = 'unclosed empty JSON object';
                this.setError(error, true);
            } else {
                const last = json[json.length - 1].value;
                error = `unclosed JSON object: expected \`}\` after \`${last.getErrorText()}\``;
                this.setError(error, true);
            }
        }

        const extra = ender === '}' ? 1 : 0;
        const fullText = this.text.substring(start, this.pos + extra);
        this.push(
            new JsonElement(json, start, this.pos + extra, fullText, startLine, error),
            pushTo,
        );
    }
}

class ExpressionsValidator {
    constructor(elems, inferVariablesValue, text) {
        this.inferVariablesValue = inferVariablesValue;
        this.text = text;
        this.hasFatalError = false;
        this.errors = [];
        this.handleExpressions(elems, false);
        if (this.errors.length === 0) {
            this.checkElements(elems);
        }
    }

    setError(error, line, isFatal) {
        addErrorTo(error, line, isFatal, this.errors);
        if (isFatal) {
            this.hasFatalError = true;
        }
    }

    hasErrors() {
        return this.errors.length !== 0;
    }

    checkElements(elems) {
        for (const elem of elems) {
            if (elem.kind === 'array') {
                const error = elem.validate(false);
                if (error !== null) {
                    this.setError(error, false);
                }
                this.checkElements(elem.value);
            } else if (elem.kind === 'tuple') {
                this.checkElements(elem.value);
            } else if (elem.kind === 'json') {
                for (const entry of elem.value) {
                    if (!['string', 'object-path'].includes(entry.key.kind)) {
                        const article = entry.key.getArticleKind();
                        const extra = ` (\`${entry.key.getErrorText()}\`)`;
                        this.setError(`only strings can be used as keys in JSON dict, found \
${article}${extra}`);
                    } else {
                        this.checkElements([entry]);
                    }
                }
            } else if (elem.kind === 'object-path') {
                const error = elem.validate();
                if (error !== null) {
                    this.setError(error, false);
                }
                this.checkElements(elem.value);
            }
        }
    }

    handleExpressions(elems, handleTuples) {
        for (let i = 0, len = elems.length; i < len && !this.hasFatalError; ++i) {
            const elem = elems[i];
            // eslint-disable-next-line no-extra-parens
            if (elem.kind === 'expression' || (handleTuples && isExpressionCompatible(elem))) {
                const ret = this.handleExpression(elem);
                if (ret !== null) {
                    elems[i] = ret;
                }
            } else if (elem.kind === 'json') {
                for (const entry of elem.value) {
                    if (isExpressionCompatible(entry.key)) {
                        const ret = this.handleExpression(entry.key);
                        if (ret !== null) {
                            entry.key = ret;
                        }
                    }
                    if (isExpressionCompatible(entry.value)) {
                        const ret = this.handleExpression(entry.value);
                        if (ret !== null) {
                            entry.value = ret;
                        }
                    }
                }
            } else if (['tuple', 'array', 'object-path'].includes(elem.kind)) {
                this.handleExpressions(elem.value, false);
            }
        }
    }

    handleExpression(expr) {
        const elems = expr.value;
        // First, we check all sub-expressions.
        this.handleExpressions(elems, true);
        if (this.hasErrors()) {
            return null;
        }

        const isExpectingBool = elems.some(e => e.isComparison() || e.isConditionalOperator());

        if (isExpectingBool) {
            const convertAs = this.checkExprConditions(expr);
            if (convertAs === null || !this.inferVariablesValue) {
                return null;
            }
            return convertExprAs(expr, convertAs);
        }

        // No condition or comparison so straight-forward check.
        const evaluatedType = this.checkExprOperations(expr.value);
        if (evaluatedType === null) {
            return null;
        }

        if (!this.inferVariablesValue) {
            return null;
        }

        if (['number', 'boolean'].includes(evaluatedType)) {
            return convertExprAs(expr, evaluatedType);
        }
        // Creating the string.
        return convertAsString(expr);
    }

    // In this case, there is no conditional nor comparison operators so the check is only for
    // mathematic operators.
    checkExprOperations(elems) {
        let currentType = null;
        let prevOperator = null;
        for (const elem of elems) {
            let elemKind = null;
            if (!['variable', 'expression'].includes(elem.kind) && !isExpressionCompatible(elem)) {
                elemKind = elem.kind;
            }

            if (elem.kind === 'operator') {
                // eslint-disable-next-line no-extra-parens
                if ((elem.value !== '+' && !canDoMathOperation(currentType)) ||
                // eslint-disable-next-line no-extra-parens
                    (elem.value === '+' && !canDoPlus(currentType))
                ) {
                    elem.error = `\`${elem.value}\` is not supported for ${currentType} \
elements (in \`${this.elemsText(elems)}\`)`;
                    this.setError(elem.error, elem.line, false);
                    return null;
                }
                prevOperator = elem;
            } else if (prevOperator !== null &&
                // eslint-disable-next-line no-extra-parens
                ((prevOperator.value !== '+' && !canDoMathOperation(elemKind)) ||
                // eslint-disable-next-line no-extra-parens
                 (prevOperator.value === '+' && !canDoPlus(elemKind)))
            ) {
                elem.error = `\`${prevOperator.value}\` is not supported for ${elem.kind} \
elements (in \`${this.elemsText(elems)}\`)`;
                this.setError(elem.error, elem.line, false);
                return null;
            } else if (currentType === null) {
                currentType = elemKind;
            } else if (
                elem.kind !== currentType
                && currentType !== 'string'
                && currentType !== 'object-path'
            ) {
                if (
                    elem.kind === 'string'
                    || elem.kind === 'number'
                    || elem.kind === 'object-path'
                ) {
                    currentType = elemKind;
                }
            }
        }
        return currentType;
    }

    checkExprConditions(expr) {
        // Each "segment" of the expression, separated by "condition operators" (such as "&&" and
        // "||") needs to return a boolean. Also, there should be only one comparison operator
        // per segment.
        //
        // So first, we split by operators.
        const segments = [];
        let current = null;
        for (const elem of expr.value) {
            if (!elem.isConditionalOperator()) {
                if (current === null) {
                    segments.push({elems: [], endOperator: null});
                    current = segments[segments.length - 1];
                }
                current.elems.push(elem);
            } else {
                if (current === null) {
                    // Should never happen but just in case...
                    elem.error = `unexpected operator \`${elem.value}\``;
                    this.setError(elem.error, elem.line, false);
                    return null;
                }
                current.endOperator = elem.value;
                current = null;
            }
        }
        // Now we go through all segments.
        for (const segment of segments) {
            // We split the segment by comparison operators so we can easily check that right and
            // left parts have the expected types.
            const right = [];
            const left = [];
            let comparisonOperator = null;
            current = right;
            for (const elem of segment.elems) {
                if (elem.isComparison()) {
                    if (comparisonOperator !== null) {
                        elem.error = `unexpected \`${elem.value}\` operator when there is already \
\`${comparisonOperator.value}\` (in \`${this.segmentText(segment)}\`)`;
                        this.setError(elem.error, elem.line, false);
                        return null;
                    }
                    comparisonOperator = elem;
                    current = left;
                } else {
                    current.push(elem);
                }
            }
            if (comparisonOperator === null) {
                if (right.length === 0) {
                    // should never happen but just in case...
                    expr.error = `expected something before \`${segment.endOperator}\``;
                    this.setError(expr.error, expr.line, false);
                    return null;
                }
                const evaluatedType = this.checkExprOperations(right);
                if (this.hasErrors()) {
                    return null;
                }
                if (!isTypeCompatibleWith(evaluatedType, 'boolean')) {
                    expr.error = `expected expression \`${this.segmentText(segment)}\` to be \
evaluated as boolean, instead it was evaluated as ${evaluatedType} (in \
\`${this.elemsText(expr.value)}\`)`;
                    this.setError(expr.error, expr.line, false);
                    return null;
                }
            } else {
                const evaluatedType1 = this.checkExprOperations(right);
                if (this.hasErrors()) {
                    return null;
                }
                const evaluatedType2 = this.checkExprOperations(left);
                if (this.hasErrors()) {
                    return null;
                }
                // Now checking both parts of the comparison operator.
                // If it's not `==` or `!=`, it needs to be a number.
                if (!comparisonOperator.isEqualityComparison()) {
                    let errPart = null;
                    let evalError = null;
                    if (!isTypeCompatibleWith(evaluatedType1, 'number')) {
                        errPart = right;
                        evalError = evaluatedType1;
                    } else if (!isTypeCompatibleWith(evaluatedType2, 'number')) {
                        errPart = left;
                        evalError = evaluatedType2;
                    }
                    if (errPart !== null) {
                        expr.error = `\`${comparisonOperator.value}\` is only supported for number \
elements, \`${this.elemsText(errPart)}\` was evaluated as ${evalError} (in \
\`${this.segmentText(segment)}\`)`;
                        this.setError(expr.error, expr.line, false);
                        return null;
                    }
                } else {
                    // Otherwise rules are a bit different, not everything can be compared to
                    // everything.
                    if (!canBeCompared(evaluatedType1, evaluatedType2)) {
                        expr.error = `\`${comparisonOperator.value}\` cannot be used to compare \
${evaluatedType1} (\`${this.elemsText(right)}\`) and ${evaluatedType2} (\
\`${this.elemsText(left)}\`) elements`;
                        this.setError(expr.error, expr.line, false);
                        return null;
                    }
                }
            }
        }
        if (!this.inferVariablesValue) {
            return null;
        }
        return 'boolean';
    }

    segmentText(segment) {
        return this.elemsText(segment.elems);
    }

    elemsText(elems) {
        const last = elems[elems.length - 1];
        return this.text.substring(elems[0].startPos, last.endPos);
    }
}

module.exports = {
    'ArrayElement': TupleElement,
    'CharElement': CharElement,
    'cleanString': cleanString,
    'Element': Element,
    'ExpressionsValidator': ExpressionsValidator,
    'getArticleKind': getArticleKind,
    'getSelector': getSelector,
    'IdentElement': IdentElement,
    'isStringChar': isStringChar,
    'isWhiteSpace': isWhiteSpace,
    'JsonElement': JsonElement,
    'matchInteger': matchInteger,
    'NumberElement': NumberElement,
    'TupleElement': TupleElement,
    'Parser': Parser,
    'StringElement': StringElement,
    'UnknownElement': UnknownElement,
    'VariableElement': VariableElement,
};
