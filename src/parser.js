const { getVariableValue, RESERVED_VARIABLE_NAME } = require('./utils.js');

function isWhiteSpace(c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

function isStringChar(c) {
    return c === '\'' || c === '"';
}

function isNumber(c) {
    return c !== null && (c >= '0' && c <= '9' || c === '-');
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
        specialChars.indexOf(c) !== -1 ||
        // eslint-disable-next-line no-extra-parens
        (isNumber(c) && pos !== start);
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

function isAdditionable(elem) {
    return ['string', 'number', 'variable'].indexOf(elem.kind) !== -1;
}

class Element {
    constructor(kind, value, startPos, endPos, line, error = null) {
        this.kind = kind;
        this.value = value;
        this.startPos = startPos;
        this.endPos = endPos;
        this.error = error;
        this.line = line;
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
        return this.value;
    }

    // Used for error messages.
    getArticleKind() {
        if (this.kind === 'unknown') {
            return 'an unknown item';
        }
        return (['array', 'ident'].indexOf(this.kind) !== -1 ? 'an ' : 'a ') + this.kind;
    }

    displayInCode() {
        return this.value;
    }

    isReservedVariableName() {
        return this.kind === 'ident' && this.value === RESERVED_VARIABLE_NAME;
    }
}

class CharElement extends Element {
    constructor(value, startPos, line, error = null) {
        super('char', value, startPos, startPos, line, error);
    }
}

class TupleElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('tuple', value, startPos, endPos, line, error);
        this.fullText = fullText;
    }

    isRecursive() {
        return true;
    }

    getErrorText() {
        return this.fullText;
    }

    displayInCode() {
        return '(' + this.value.map(e => e.displayInCode()).join(', ') + ')';
    }
}

class ArrayElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('array', value, startPos, endPos, line, error);
        this.fullText = fullText;
    }

    isRecursive() {
        return true;
    }

    getErrorText() {
        return this.fullText;
    }

    displayInCode() {
        return '[' + this.value.map(e => e.displayInCode()).join(', ') + ']';
    }
}

class StringElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('string', value, startPos, endPos, line, error);
        this.fullText = fullText;
    }

    getErrorText() {
        return this.fullText;
    }

    displayInCode() {
        return `"${cleanString(this.value)}"`;
    }
}

class IdentElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        const kind = value === 'true' || value === 'false' ? 'bool' : 'ident';
        super(kind, value, startPos, endPos, line, error);
    }
}

class NumberElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('number', value, startPos, endPos, line, error);
        value = String(value);
        this.isFloat = value.indexOf('.') !== -1;
        this.isNegative = value.startsWith('-');
    }
}

class JsonElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('json', value, startPos, endPos, line, error);
        this.fullText = fullText;
    }

    isRecursive() {
        return true;
    }

    getErrorText() {
        return this.fullText;
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
        super('unknown', value, startPos, endPos, line, error);
    }
}

class VariableElement extends Element {
    constructor(value, startPos, endPos, line, error = null) {
        super('variable', value, startPos, endPos, line, error);
    }
}

class BlockElement extends Element {
    constructor(startPos, endPos, line, parser, error = null) {
        if (error !== null) {
            super(
                'block',
                parser.text.slice(startPos, parser.pos),
                startPos,
                parser.pos,
                line,
                error,
            );
            return;
        }
        parser.skipWhiteSpaceCharacters();
        let c = parser.getCurrentChar();
        if (c !== '{') {
            const kind = c === null ? 'nothing' : `\`${c}\``;
            super(
                'block',
                parser.text.slice(startPos, parser.pos),
                startPos,
                parser.pos,
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

        super(
            'block', parser.text.slice(startPos, parser.pos + 1), startPos, parser.pos, line, error,
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

    extractNextCommandName() {
        let command = null;

        while (command === null) {
            const c = this.getCurrentChar();
            if (c === null) {
                break;
            }
            const tmp = [];

            if (c === '/') {
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

    getElems(pushTo = null) {
        return pushTo !== null ? pushTo : this.elems;
    }

    parse(endChars = ['\n'], pushTo = null, separator = null, extra = '') {
        if (pushTo === null) {
            this.argsStart = this.pos;
        }
        let prev = '';
        let endChar = null;
        let foundPlus = false;
        const skipBackline = endChars.indexOf('\n') === -1;

        const checker = (t, c, toCall) => {
            const elems = t.getElems(pushTo);
            if (elems.length > 0 && !foundPlus && prev !== separator) {
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
                foundPlus = false;
            }
        };

        while (this.error === null) {
            const c = this.getCurrentChar();
            if (c === null) {
                break;
            }

            if (endChars.indexOf(c) !== -1) {
                endChar = c;
                if (foundPlus) {
                    if (c === '\n') {
                        // we ignore it and continue.
                    } else {
                        const elems = this.getElems(pushTo);
                        elems[elems.length - 1].error = 'Missing element after `+` token';
                        this.setError(elems[elems.length - 1].error);
                        break;
                    }
                } else {
                    // No special case to handle!
                    break;
                }
            } else if (isStringChar(c)) {
                checker(this, c, 'parseString');
            } else if (c === '{') {
                checker(this, c, 'parseJson');
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (c === separator) {
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
            } else if (c === '(') {
                checker(this, c, 'parseTuple');
            } else if (c === '[') {
                checker(this, c, 'parseArray');
            } else if (c === '/') {
                this.parseComment(pushTo);
                // We want to keep the backline in case this is the end char.
                continue;
            } else if (c === '|') {
                checker(this, c, 'parseVariable');
            } else if (c === '+' && this.getElems(pushTo).length !== 0) {
                if (!foundPlus) {
                    this.push(new CharElement(c, this.pos, this.currentLine), pushTo);
                    foundPlus = true;
                } else {
                    const elems = this.getElems(pushTo);
                    const el = elems[elems.length - 1];
                    el.error = 'unexpected `+` after `+`';
                    this.setError(el.error);
                }
            } else {
                checker(this, c, 'parseIdent');
                const elems = this.getElems(pushTo);
                const el = elems[elems.length - 1];
                if (el.kind === 'unknown') {
                    const token = el.value;
                    if (elems.length === 1) {
                        el.error = `unexpected \`${token}\` as first token${extra}`;
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
            this.handleExpressions(this.getElems(pushTo));
        }
        return [prev, endChar];
    }

    handleExpressions(elems) {
        for (let i = elems.length - 1; i > 0; --i) {
            if (elems[i].kind !== 'char' || elems[i].value !== '+') {
                continue;
            }
            if (i + 1 >= elems.length) {
                elems[i].error = '`+` token should be followed by something';
                this.setError(elems[i].error);
                return;
            }
            if (!isAdditionable(elems[i + 1])) {
                elems[i + 1].error = `${elems[i + 1].getArticleKind()} (\`\
${elems[i + 1].getErrorText()}\`) cannot be used after a \`+\` token`;
                this.setError(elems[i + 1].error);
                return;
            }

            let subs = [elems[i + 1]];
            let last = i;
            for (; i > 0; i -= 2) {
                if (elems[i].kind !== 'char' || elems[i].value !== '+') {
                    break;
                }
                if (!isAdditionable(elems[i - 1])) {
                    elems[i - 1].error = `${elems[i - 1].getArticleKind()} (\`\
${elems[i - 1].getErrorText()}\`) cannot be used before a \`+\` token`;
                    this.setError(elems[i - 1].error);
                    return;
                }
                subs.push(elems[i - 1]);
                last = i;
            }

            subs = subs.reverse();
            if (subs.some(e => e.kind === 'string')) {
                // At least one element is a string so all of them are treated as a string.
                const full = [];
                let value = '';

                for (const elem of subs) {
                    if (elem.kind === 'string') {
                        full.push(elem.getErrorText());
                    } else {
                        full.push(`"${elem.value}"`);
                    }
                    value += elem.value;
                }
                elems[i + 1] = new StringElement(
                    value,
                    subs[0].startPos,
                    subs[subs.length - 1].endPos,
                    full.join(' + '),
                    subs[0].line,
                );
            } else {
                // All elements are numbers so treating as a number.
                elems[i + 1] = new NumberElement(
                    subs.map(e => e.value).join(' + '),
                    subs[0].startPos,
                    subs[subs.length - 1].endPos,
                    subs[0].line,
                );
            }
            // We remove the two elements that are not needed anymore.
            elems.splice(last, subs.length * 2 - 2);
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
        const [prev, ender] = this.parse([endChar], elems, ',');
        const full = this.text.substring(start, this.pos + 1);
        if (elems.length > 0 && elems[elems.length - 1].error !== null) {
            this.push(
                new constructor(
                    elems,
                    start,
                    this.pos + 1,
                    full,
                    this.currentLine,
                    elems[elems.length - 1].error,
                ),
                pushTo,
            );
        } else if (this.pos >= this.text.length || ender !== endChar) {
            if (elems.length === 0) {
                this.push(
                    new constructor(elems, start, this.pos, full, startLine,
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
                    new constructor(elems, start, this.pos, full, startLine, err),
                    pushTo,
                );
            }
        } else {
            this.push(new constructor(elems, start, this.pos + 1, full, startLine), pushTo);
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
            return;
        }
        if (ident === 'block') {
            this.push(new BlockElement(start, this.pos, this.currentLine, this), pushTo);
        } else {
            this.push(new IdentElement(ident, start, this.pos, this.currentLine), pushTo);
            this.pos -= 1; // Need to go back to last "good" letter.
        }
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
                } else if (['number', 'string'].indexOf(typeof associatedValue) !== -1) {
                    if (typeof associatedValue === 'number' ||
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

        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (c === '-') {
                if (this.pos > start) { // The minus sign can only be present as first character.
                    const nb = this.text.substring(start, this.pos);
                    this.push(new NumberElement(nb, start, this.pos, this.currentLine,
                        `unexpected \`-\` after \`${nb}\``), pushTo);
                    this.pos = this.text.length;
                    return;
                }
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
                const nb = this.text.substring(start, this.pos);
                this.push(new NumberElement(nb, start, this.pos, this.currentLine), pushTo);
                this.pos -= 1;
                return;
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
