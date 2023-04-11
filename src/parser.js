const { getVariableValue, RESERVED_VARIABLE_NAME } = require('./utils.js');

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
    if (s.replace !== undefined) {
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
    return s;
}

function cleanCssSelector(s, text = '') {
    s = cleanString(s.replace(/\\/g, '\\\\')).trim();
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
    const index = css.value.search(/[A-Za-z\])]::[A-Za-z][A-Za-z0-9_]*$/);
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

// This function is used when generating an expression generating a boolean.
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
    return [null, 'expression', 'number', 'variable', 'string'].includes(kind);
}

function canDoMathOperation(kind) {
    return [null, 'expression', 'number', 'variable'].includes(kind);
}

function isTypeCompatibleWith(kind, expected) {
    if ([null, 'expression'].includes(kind)) {
        // It means variables haven't been inferred so we can skip it.
        return true;
    }
    if (expected === 'boolean') {
        return 'boolean' === kind;
    } else if (expected === 'number') {
        return 'number' === kind;
    } else if (expected === 'string') {
        return ['number', 'string'].includes(kind);
    }
    return false;
}

function canBeCompared(kind1, kind2) {
    if (kind1 === kind2) {
        return true;
    }
    const ok = [null, 'expression'];
    if (ok.includes(kind1) || ok.includes(kind2)) {
        return true;
    }
    // It's the only case where different types can be compared.
    const ok2 = ['number', 'string'];
    return ok2.includes(kind1) && ok2.includes(kind2);
}

function convertAsString(elem) {
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

class Element {
    constructor(kind, value, startPos, endPos, fullText, line, error = null) {
        this.kind = kind;
        this.value = value;
        this.startPos = startPos;
        this.endPos = endPos;
        this.error = error;
        this.line = line;
        this.fullText = fullText;
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
        if (this.kind === 'unknown') {
            return 'an unknown item';
        }
        const contains = ['array', 'expression', 'ident', 'operator'].includes(this.kind);
        return (contains ? 'an ' : 'a ') + this.kind;
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

}

class CharElement extends Element {
    constructor(value, startPos, line, error = null) {
        super('char', value, startPos, startPos, value, line, error);
    }
}

class OperatorElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('operator', value, startPos, endPos, value, line, error);
    }
}

class ExpressionElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('expression', value, startPos, endPos, fullText, line, error);
    }
}

class TupleElement extends Element {
    constructor(value, startPos, endPos, fullText, line, foundSeparator, error = null) {
        super('tuple', value, startPos, endPos, fullText, line, error);
        this.foundSeparator = foundSeparator;
        this.canBeExpression = this.value.length === 1 && this.foundSeparator === 0;
    }

    isRecursive() {
        return true;
    }

    displayInCode() {
        return '[' + this.value.map(e => e.displayInCode()).join(', ') + ']';
    }
}

class ArrayElement extends Element {
    constructor(value, startPos, endPos, fullText, line, foundSeparator, error = null) {
        super('array', value, startPos, endPos, fullText, line, error);
        this.foundSeparator = foundSeparator;
    }

    isRecursive() {
        return true;
    }

    displayInCode() {
        return '[' + this.value.map(e => e.displayInCode()).join(', ') + ']';
    }
}

class StringElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('string', value, startPos, endPos, fullText, line, error);
    }

    displayInCode() {
        return `"${cleanString(this.value)}"`;
    }
}

class IdentElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        const kind = value === 'true' || value === 'false' ? 'boolean' : 'ident';
        super(kind, value, startPos, endPos, value, line, error);
    }
}

class NumberElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('number', value, startPos, endPos, value, line, error);
        value = String(value);
        this.isFloat = value.includes('.');
        this.isNegative = value.startsWith('-');
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
}

class UnknownElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('unknown', value, startPos, endPos, value, line, error);
    }
}

class VariableElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('variable', value, startPos, endPos, value, line, error);
    }
}

class BlockElement extends Element {
    constructor(startPos, endPos, line, parser, error = null) {
        if (error !== null) {
            const fullText = parser.text.slice(startPos, parser.pos);
            super(
                'block',
                fullText,
                startPos,
                parser.pos,
                fullText,
                line,
                error,
            );
            return;
        }
        parser.skipWhiteSpaceCharacters();
        let c = parser.getCurrentChar();
        if (c !== '{') {
            const kind = c === null ? 'nothing' : `\`${c}\``;
            const fullText = parser.text.slice(startPos, parser.pos);
            super(
                'block',
                fullText,
                startPos,
                parser.pos,
                fullText,
                line,
                `Expected \`{\` after \`block\` keyword, found ${kind}`,
            );
            return;
        }
        const blockLine = parser.currentLine;
        // We go after the `{`.
        parser.increasePos();
        // We save the current command and elems to prevent them to be overwrote when parsing
        // the `block` content.
        const elems = parser.elems;
        const command = parser.command;
        // We disable the variables inferrence so we can keep the code "as is".
        parser.inferVariablesValue = false;
        const blockStart = parser.pos;
        while (c !== '}') {
            if (parser.parseNextCommand(['\n', '}']) !== true) {
                parser.error += ' (in `block { ... }`)';
                error = parser.error;
                break;
            }
            parser.skipWhiteSpaceCharacters();
            c = parser.getCurrentChar();
            if (c === null) {
                parser.error = 'Missing `}` to end the block';
                error = parser.error;
                break;
            }
        }
        // We re-enable the variables inference now that we're done with this parsing.
        parser.inferVariablesValue = true;
        // We set back the values before the `block` parsing.
        parser.elems = elems;
        parser.command = command;

        const fullText = parser.text.slice(startPos, parser.pos + 1);
        super(
            'block', fullText, startPos, parser.pos, fullText, line, error,
        );
        this.blockCode = parser.text.slice(blockStart, parser.pos);
        this.blockLine = blockLine;
    }

    getErrorText() {
        // Because it'd be too long to display the full block.
        return 'block { ... }';
    }

    getBlockCode() {
        return this.blockCode;
    }
}

class Parser {
    constructor(text, variables, functionArgs = null, definedFunctions = null) {
        // We have to put this import here and not at the top of the file to avoid circular import.
        const { ORDERS } = require('./commands.js');

        this.text = text;
        this.pos = 0;
        this.elems = [];
        this.error = null;
        this.orders = ORDERS;
        if (typeof variables === 'undefined' || variables === null) {
            variables = {};
        }
        this.variables = Object.create(null);
        // We don't copy the map, only its content.
        for (const key in variables) {
            this.variables[key] = variables[key];
        }
        // For humans, the first line isn't 0 but 1.
        this.currentLine = 1;
        this.command = null;
        this.argsStart = 0;
        this.argsEnd = 0;
        this.forceVariableAsString = false;
        this.definedFunctions = definedFunctions === null ? Object.create(null) : definedFunctions;
        this.functionArgs = functionArgs;
        this.inferVariablesValue = true;
    }

    setError(error) {
        if (this.error === null) {
            this.error = error;
        }
    }

    getRawArgs() {
        if (this.argsEnd - this.argsStart > 100) {
            return this.text.slice(this.argsStart, this.argsStart + 100) + '…';
        }
        return this.text.slice(this.argsStart, this.argsEnd);
    }

    getOriginalCommand() {
        return this.text.slice(this.commandStart, this.argsEnd);
    }

    getOriginalWithIndexes(start, end) {
        return this.text.slice(start, end);
    }

    getCurrentChar() {
        if (this.pos < this.text.length) {
            return this.text.charAt(this.pos);
        }
        return null;
    }

    parseNextCommand(endChars = ['\n']) {
        this.elems = [];
        this.error = null;
        // First, we skip all unneeded characters...
        this.skipWhiteSpaceCharacters();
        this.command = this.extractNextCommandName();
        if (this.command === null || this.error !== null) {
            return false;
        }
        const order = this.command.getRaw().toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(this.orders, order)) {
            this.error = `Unknown command "${order}"`;
            return false;
        }
        // Now that we have the command, let's get its arguments!
        this.parse(endChars);
        return this.error === null;
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

    extractNextCommandName() {
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
                    this.setError('Unexpected `/` when parsing command');
                    return null;
                }
            } else if (isWhiteSpace(c)) {
                // Do nothing.
            } else if (isLetter(c)) {
                this.commandStart = this.pos;
                this.parseIdent(tmp, ['-']);
                command = tmp.pop();
            } else {
                this.setError(`Unexpected ${showChar(c)} when parsing command`);
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
                    `(after \`${command.getRaw()}\`)`);
                return null;
            } else if (c === '\n') {
                this.setError('Backlines are not allowed between command identifier and `:`');
                return null;
            } else if (isWhiteSpace(c)) {
                // Do nothing...
            } else if (c === ':') {
                stop = true;
            } else {
                this.setError(`Unexpected ${showChar(c)} when parsing command ` +
                    `(after \`${command.getRaw()}\`)`);
                return null;
            }
            this.increasePos();
        }
        if (!stop) {
            this.setError(`Missing \`:\` after command identifier (after \`${command.getRaw()}\`)`);
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

    parse(endChars = ['\n'], pushTo = null, separator = null, extra = '') {
        if (pushTo === null) {
            this.argsStart = this.pos;
        }
        let prev = '';
        let endChar = null;
        let foundSeparator = 0;
        const skipBackline = !endChars.includes('\n');

        const checker = (t, c, toCall) => {
            const elems = t.getElems(pushTo);
            if (elems.length > 0 && prev !== separator) {
                let msg;

                if (separator === null) {
                    if (endChars.length === 1) {
                        msg = endChars[0] === '\n' ? 'nothing' : showChar(endChars[0]);
                    } else {
                        msg = endChars.map(e => showChar(e)).join(' or ');
                    }
                } else {
                    if (c === '\n') {
                        msg = showChar(separator);
                    } else {
                        const chars = endChars.map(e => showChar(e)).join(' or ');
                        msg = `${showChar(separator)} or ${chars}`;
                    }
                }
                const e = new CharElement(
                    c, t.pos, this.currentLine,
                    `expected ${msg}, found ${showChar(c)} after ` +
                        `\`${showEnd(elems[elems.length - 1])}\``);
                t.push(e, pushTo);
                t.pos = t.text.length;
            } else {
                t[toCall](pushTo);
                prev = '';
            }
        };

        while (this.error === null) {
            const c = this.getCurrentChar();
            if (c === null) {
                break;
            }

            if (endChars.includes(c)) {
                endChar = c;
                break;
            } else if (isStringChar(c)) {
                checker(this, c, 'parseString');
            } else if (c === '{') {
                checker(this, c, 'parseJson');
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (c === separator) {
                foundSeparator += 1;
                const elems = this.getElems(pushTo);
                if (elems.length === 0) {
                    this.push(new CharElement(separator, this.pos, this.currentLine,
                        `unexpected \`${separator}\` as first element`), pushTo);
                    this.pos = this.text.length;
                } else if (prev === separator) {
                    this.push(new CharElement(separator, this.pos, this.currentLine,
                        `unexpected \`${separator}\` after \`${separator}\``), pushTo);
                    this.pos = this.text.length;
                } else if (elems[elems.length - 1].kind === 'char') {
                    // TODO: not sure if this block is useful...
                    const prevElem = elems[elems.length - 1].text;
                    this.push(new CharElement(separator, this.pos, this.currentLine,
                        `unexpected \`${separator}\` after \`${prevElem}\``), pushTo);
                    this.pos = this.text.length;
                } else {
                    prev = separator;
                }
            } else if (isNumber(c)) {
                checker(this, c, 'parseNumber');
            // If it's a negative number, check is a bit trickier since it can also be an
            // expression like in `1-2`.
            } else if (c === '-' && this.isNumberStart() &&
                (this.getElems(pushTo).length === 0 || prev !== '')
            ) {
                checker(this, c, 'parseNumber');
            } else if (c === '(') {
                checker(this, c, 'parseTuple');
            } else if (c === '[') {
                checker(this, c, 'parseArray');
            } else if (this.isCommentStart()) {
                this.parseComment(pushTo);
                // We want to keep the backline in case this is the end char.
                continue;
            } else if (this.isVariableStart(c)) {
                checker(this, c, 'parseVariable');
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
                checker(this, c, 'parseIdent');
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
                    this.setError(el.error);
                    this.pos = this.text.length;
                }
            }
            this.increasePos(true, skipBackline);
        }
        if (pushTo === null) {
            this.argsEnd = this.pos;
        }
        if (this.error === null) {
            this.handleExpressions(this.getElems(pushTo), false);
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
        };

        while (this.error === null) {
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
                    this.push(
                        new ExpressionElement(
                            elems,
                            start,
                            this.pos,
                            this.text.substring(start, this.pos + 1),
                            startLine,
                            `missing \`)\` at the end of the expression started line ${startLine}`,
                        ),
                        pushTo,
                    );
                    return;
                }
                if (stop) {
                    break;
                }
            } else if (isStringChar(c)) {
                this.parseString(elems);
            } else if (isWhiteSpace(c)) {
                // Do nothing.
            } else if (this.isCommentStart()) {
                this.parseComment(elems);
                // We want to keep the backline in case this is the end char.
                continue;
            } else if (this.isVariableStart(c)) {
                this.parseVariable(elems);
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
            } else if (c === '(') {
                // Sub-expression.
                this.increasePos();
                this.parseExpression([], [')'], elems);
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
        if (this.error !== null) {
            return;
        }

        // Checking all potential errors now.
        if (elems.length === 0) {
            expr.error = 'empty expressions (`()`) are not allowed';
            this.setError(expr.error);
            return;
        }

        if (elems[0].kind === 'operator') {
            elems[0].error = `unexpected operator \`${elems[0].getErrorText()}\``;
            expr.error = elems[0].error;
            this.setError(elems[0].error);
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
                this.setError(el.error);
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
            this.setError(last.error);
            return;
        }
    }

    parseOperator(pushTo = null) {
        const start = this.pos;
        const startLine = this.currentLine;

        while (this.error === null) {
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
                    this.push(
                        new OperatorElement(
                            op, start, this.pos, startLine, `unknown operator \`${op}\``,
                        ),
                        pushTo,
                    );
                }
                return false;
            }
            this.increasePos();
        }
    }

    handleExpressions(elems, handleTuples) {
        for (let i = 0, len = elems.length; i < len && this.error === null; ++i) {
            const elem = elems[i];
            if (elem.kind !== 'expression' && (!handleTuples || !isExpressionCompatible(elem))) {
                continue;
            }
            const ret = this.handleExpression(elem);
            if (ret !== null) {
                elems[i] = ret;
            }
        }
    }

    handleExpression(expr) {
        const elems = expr.value;
        // First, we check all sub-expressions.
        this.handleExpressions(elems, true);
        if (this.error !== null) {
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
                    this.setError(elem.error);
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
                this.setError(elem.error);
                return null;
            } else if (currentType === null) {
                currentType = elem.kind;
            } else if (elem.kind !== currentType && currentType !== 'string') {
                if (elem.kind === 'string' || elem.kind === 'number') {
                    currentType = elem.kind;
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
                    this.setError(elem.error);
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
                        this.setError(elem.error);
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
                    this.setError(expr.error);
                    return null;
                }
                const evaluatedType = this.checkExprOperations(right);
                if (this.error !== null) {
                    return null;
                }
                if (!isTypeCompatibleWith(evaluatedType, 'boolean')) {
                    expr.error = `expected expression \`${this.segmentText(segment)}\` to be \
evaluated as boolean, instead it was evaluated as ${evaluatedType} (in \
\`${this.elemsText(expr.value)}\`)`;
                    this.setError(expr.error);
                    return null;
                }
            } else {
                const evaluatedType1 = this.checkExprOperations(right);
                if (this.error !== null) {
                    return null;
                }
                const evaluatedType2 = this.checkExprOperations(left);
                if (this.error !== null) {
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
                        this.setError(expr.error);
                        return null;
                    }
                } else {
                    // Otherwise rules are a bit different, not everything can be compared to
                    // everything.
                    if (!canBeCompared(evaluatedType1, evaluatedType2)) {
                        expr.error = `\`${comparisonOperator.value}\` cannot be used to compare \
${evaluatedType1} (\`${this.elemsText(right)}\`) and ${evaluatedType2} (\
\`${this.elemsText(left)}\`) elements`;
                        this.setError(expr.error);
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
        const [prev, ender, foundSeparator] = this.parse([endChar], elems, ',');
        const full = this.text.substring(start, this.pos + 1);
        if (elems.length > 0 && elems[elems.length - 1].error !== null) {
            this.push(
                new constructor(
                    elems,
                    start,
                    this.pos + 1,
                    full,
                    this.currentLine,
                    foundSeparator,
                    elems[elems.length - 1].error,
                ),
                pushTo,
            );
        } else if (this.pos >= this.text.length || ender !== endChar) {
            if (elems.length === 0) {
                this.push(
                    new constructor(elems, start, this.pos, full, startLine, foundSeparator,
                        `expected ${showChar(endChar)} at the end`),
                    pushTo);
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
        if (tmp[0].error !== null) {
            // nothing to do
        } else if (tmp[0].getRaw().length > 1) {
            const values = tmp[0].getRaw();

            for (let i = 1; i < values.length; ++i) {
                if (values[i].kind !== values[0].kind) {
                    tmp[0].error = 'all array\'s elements must be of the same kind: expected ' +
                        `array of \`${values[0].kind}\` (because the first element is of this ` +
                        `kind), found \`${values[i].kind}\` at position ${i}`;
                    break;
                }
            }
        }
        this.push(tmp[0], pushTo);
    }

    parseString(pushTo = null) {
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
                return;
            } else if (c === '\\') {
                this.pos += 1;
            }
            this.increasePos();
        }
        const value = this.text.substring(start + 1, this.pos);
        const full = this.text.substring(start, this.pos);
        const e = new StringElement(value, start, this.pos, full, this.currentLine,
            `expected \`${endChar}\` at the end of the string`);
        this.push(e, pushTo);
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
            this.push(new BlockElement(start, this.pos, this.currentLine, this), pushTo);
        } else {
            this.push(new IdentElement(ident, start, this.pos, this.currentLine), pushTo);
            this.decreasePos(); // Need to go back to last "good" letter.
        }
        return true;
    }

    parseVariable(pushTo = null) {
        const start = this.pos;

        this.increasePos();
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            if (c === '|') {
                const variableName = this.text.substring(start + 1, this.pos);
                if (!this.inferVariablesValue) {
                    this.push(
                        new VariableElement(variableName, start, this.pos + 1, this.currentLine),
                        pushTo,
                    );
                    return;
                }
                const associatedValue = this.getVariableValue(variableName);
                if (associatedValue === null) {
                    this.pos = this.text.length + 1;
                    this.push(
                        new VariableElement(variableName, start, this.pos + 1, this.currentLine,
                            `variable \`${variableName}\` not found in options nor environment`),
                        pushTo,
                    );
                    return;
                }
                if (associatedValue instanceof Element) {
                    // Nothing to be done in here.
                    this.push(associatedValue, pushTo);
                } else if (['number', 'string', 'boolean'].includes(typeof associatedValue)) {
                    if (typeof associatedValue === 'boolean') {
                        this.push(
                            new IdentElement(
                                associatedValue.toString(), start, this.pos, this.currentLine,
                            ),
                            pushTo,
                        );
                    } else if (typeof associatedValue === 'number' ||
                        // eslint-disable-next-line no-extra-parens
                        (!this.forceVariableAsString && matchInteger(associatedValue) === true)) {
                        this.push(
                            new NumberElement(associatedValue, start, this.pos, this.currentLine),
                            pushTo,
                        );
                    } else {
                        this.push(
                            new StringElement(
                                associatedValue,
                                start,
                                this.pos,
                                `"${cleanString(associatedValue)}"`,
                                this.currentLine,
                            ),
                            pushTo,
                        );
                    }
                } else {
                    // this is a JSON dict and it should be parsed.
                    const p = new Parser(JSON.stringify(associatedValue), this.variables);
                    p.parseJson();
                    this.push(p.elems[0], pushTo);
                }
                return;
            } else if (!isIdentChar(c, start, this.pos)) {
                const variableName = this.text.substring(start + 1, this.pos);
                const e = new VariableElement(variableName, start, this.pos, this.currentLine,
                    `unexpected character \`${c}\` after \`${variableName}\``);
                this.push(e, pushTo);
                return;
            }
            this.increasePos();
        }
        const variableName = this.text.substring(start + 1, this.pos);
        const e = new VariableElement(variableName, start, this.pos, this.currentLine,
            `expected \`|\` after the variable name \`${variableName}\``);
        this.push(e, pushTo);
    }

    getVariableValue(variableName) {
        return getVariableValue(this.variables, variableName, this.functionArgs);
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
                    this.push(new NumberElement(nb, start, this.pos, this.currentLine,
                        `unexpected \`.\` after \`${nb}\``), pushTo);
                    this.pos = this.text.length;
                    return;
                }
                hasDot = true;
            } else if (isNumber(c) === false) {
                if (nbDigit < 1) {
                    const nb = this.text.substring(start, this.pos);
                    this.push(new NumberElement(nb, start, this.pos, this.currentLine,
                        `unexpected \`${c}\` after \`${nb}\``), pushTo);
                    this.pos = this.text.length;
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

    push(e, pushTo = null) {
        if (pushTo !== null) {
            pushTo.push(e);
        } else {
            this.elems.push(e);
        }
        if (e.error !== null) {
            this.setError(e.error);
        }
    }

    parseJson(pushTo = null) {
        const start = this.pos;
        const startLine = this.currentLine;
        const json = [];

        const keyError = (obj, error, addExtra = false) => {
            const extra = addExtra ? 1 : 0;
            const fullText = obj.text.substring(start, this.pos + extra);
            obj.push(
                new JsonElement(json, start, obj.pos, fullText, startLine, error),
                pushTo,
            );
            obj.error = error;
        };

        // Moving past the `{` character.
        this.increasePos();

        let ender = '';
        let elems = [];

        while (ender !== '}' && this.pos < this.text.length && this.error === null) {
            elems = [];

            // We force variables' value to be strings when looking for keys.
            this.forceVariableAsString = true;

            ender = this.parse([':', '}', ','], elems)[1];

            // Then we disable this setting.
            this.forceVariableAsString = false;

            if (elems.length > 1) {
                keyError(this, `expected \`:\` after \`${elems[0].getErrorText()}\`, found \
\`${elems[1].getErrorText()}\``);
                return;
            } else if (elems.length === 0) {
                if (ender === ':') {
                    keyError(this, 'expected key before `:`');
                    return;
                } else if (ender === ',') {
                    if (json.length === 0) {
                        keyError(this, 'expected a key after `{`, found `,`');
                    } else {
                        const last = json[json.length - 1];
                        keyError(
                            this,
                            `expected a key after \`${last.value.getErrorText()}\`, found \`,\``,
                        );
                    }
                    return;
                }
                break;
            } else if (elems[0].error !== null && elems[0].kind !== 'unknown') {
                keyError(this, elems[0].error);
                return;
            } else if (elems[0].kind !== 'string') {
                const article = elems[0].getArticleKind();
                const extra = ` (\`${elems[0].getErrorText()}\`)`;
                keyError(this, `only strings can be used as keys in JSON dict, found \
${article}${extra}`);
                return;
            } else if (ender === '}' || ender === ',') {
                const after = elems[0].getErrorText();
                keyError(this, `expected \`:\` after \`${after}\`, found \`${ender}\``);
                return;
            } else if (this.error !== null) {
                keyError(this, this.error);
                return;
            }
            const key = elems[0];

            this.increasePos(); // Moving past `:`.
            elems = [];
            ender = this.parse(
                [',', '}', ':'],
                elems,
                null,
                ` for key \`${key.getErrorText()}\``,
            )[1];
            if (elems.length > 1) {
                keyError(this, `expected \`,\` or \`}\` after \`${elems[0].getErrorText()}\`, \
found \`${elems[1].getErrorText()}\``);
                return;
            } else if (ender === ':') {
                let error = 'unexpected `:` ';
                if (elems.length !== 0) {
                    error += `after key \`${elems[0].getErrorText()}\``;
                } else {
                    error += `after key \`${key.getErrorText()}\``;
                }
                keyError(this, error);
                return;
            } else if (elems.length === 0) {
                keyError(
                    this,
                    `expected a value for key \`${key.getErrorText()}\`, found nothing`,
                    ender === '}',
                );
                return;
            } else if (this.error !== null) {
                keyError(this, this.error);
                return;
            }

            if (ender === ',') {
                this.increasePos(); // Moving past `,`.
            }

            json.push({'key': key, 'value': elems[0]});
        }
        let error = null;
        if (ender !== '}') {
            if (json.length === 0) {
                error = 'unclosed empty JSON object';
            } else {
                const last = json[json.length - 1].value;
                error = `unclosed JSON object: expected \`}\` after \`${last.getErrorText()}\``;
            }
        }
        const extra = error === null ? 1 : 0;
        const fullText = this.text.substring(start, this.pos + extra);
        this.push(
            new JsonElement(json, start, this.pos + extra, fullText, startLine, error),
            pushTo,
        );
    }
}

module.exports = {
    'Parser': Parser,
    'Element': Element,
    'CharElement': CharElement,
    'TupleElement': TupleElement,
    'ArrayElement': TupleElement,
    'IdentElement': IdentElement,
    'StringElement': StringElement,
    'NumberElement': NumberElement,
    'UnknownElement': UnknownElement,
    'JsonElement': JsonElement,
    'cleanString': cleanString,
    'getSelector': getSelector,
};
