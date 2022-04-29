const getVariableValue = require('./utils.js').getVariableValue;

const COMMENT_START = '//';

function isWhiteSpace(c) {
    return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

function isStringChar(c) {
    return c === '\'' || c === '"';
}

function isNumber(c) {
    return c >= '0' && c <= '9' || c === '-';
}

function isLetter(c) {
    return c.toLowerCase() !== c.toUpperCase();
}

function matchInteger(s) {
    for (let i = s.length - 1; i >= 0; --i) {
        if (!isNumber(s.charAt(i))) {
            return false;
        }
    }
    return true;
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
    s = cleanString(s).replace(/\\/g, '\\\\').trim();
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
        return {'error': `expected integer for ${text}, found float: \`${nb.getText()}\``};
    } else if (negativeCheck === true && nb.isNegative === true) {
        return {'error': `${text} cannot be negative: \`${nb.getText()}\``};
    }
    return {'value': nb.getRaw()};
}

function showEnd(elem) {
    const text = elem.getText();

    if (text.length < 20) {
        return text;
    }
    return text.slice(text.length - 20);
}

function showChar(c) {
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

function getSelector(value, text = '') {
    if (value.startsWith('//')) {
        return {
            'value': value,
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
        return getSelector(this.getStringValue(true), text);
    }

    getStringValue(trim) {
        let v = this.value;
        if (trim === true) {
            v = v.trim();
        }
        return cleanString(v);
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
    getText() {
        return this.value;
    }

    // Used for error messages.
    getArticleKind() {
        return (['array', 'ident'].indexOf(this.kind) !== -1 ? 'an ' : 'a ') + this.kind;
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

    getText() {
        return this.fullText;
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

    getText() {
        return this.fullText;
    }
}

class StringElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('string', value, startPos, endPos, line, error);
        this.fullText = fullText;
    }

    getText() {
        return this.fullText;
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
        this.isFloat = value.indexOf('.') !== -1;
        this.isNegative = value.startsWith('-');
    }
}

class JsonElement extends Element {
    constructor(value, startPos, endPos, fullText, line, error = null) {
        super('json', value, startPos, endPos, line, error);
        this.fullText = fullText;
    }

    getText() {
        return this.fullText;
    }

    isRecursive() {
        return true;
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

class Parser {
    constructor(text, variables) {
        this.text = text;
        this.pos = 0;
        this.elems = [];
        this.error = null;
        if (typeof variables === 'undefined' || variables === null) {
            variables = {};
        }
        this.variables = variables;
        // For humans, the first line isn't 0 but 1.
        this.currentLine = 1;
        this.command = null;
        this.argsStart = 0;
        this.argsEnd = 0;
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

    parseNextCommand() {
        this.elems = [];
        this.error = null;
        // First, we skip all unneeded characters...
        this.skipWhiteSpaceCharacters();
        this.command = this.extractNextCommandName();
        if (this.command === null || this.error !== null) {
            return false;
        }
        // Now that we have the command, let's get its arguments!
        if (this.command.getRaw().toLowerCase() === 'goto') {
            // The 'goto' command is a special case. We need to parse it differently...
            this.parseGoTo();
        } else {
            this.parse();
        }
        return this.error === null;
    }

    skipWhiteSpaceCharacters() {
        while (this.pos < this.text.length && isWhiteSpace(this.text.charAt(this.pos))) {
            this.increasePos(false);
        }
    }

    extractNextCommandName() {
        let command = null;

        while (this.pos < this.text.length && command === null) {
            const c = this.text.charAt(this.pos);
            const tmp = [];

            if (c === '/') {
                this.parseComment(tmp);
                if (tmp.length !== 0) {
                    this.error = 'Unexpected `/` when parsing command';
                    return null;
                }
            } else if (isWhiteSpace(c)) {
                // Do nothing.
            } else if (isLetter(c)) {
                this.commandStart = this.pos;
                this.parseIdent(tmp, ['-']);
                command = tmp.pop();
            } else {
                this.error = `Unexpected ${showChar(c)} when parsing command`;
                return null;
            }
            this.increasePos();
        }

        if (command === null && this.pos >= this.text.length) {
            return null;
        }

        let stop = false;
        // Now we have the command ident, let's reach the `:` before moving on!
        while (this.pos < this.text.length && !stop) {
            const c = this.text.charAt(this.pos);

            if (c === '/') {
                // No need to check anything, if there is a comment, it means it'll be on two lines,
                // which isn't allowed.
                this.error = 'Unexpected `/` when parsing command ' +
                    `(after \`${command.getRaw()}\`)`;
                return null;
            } else if (c === '\n') {
                this.error = 'Backlines are not allowed between command identifier and `:`';
                return null;
            } else if (isWhiteSpace(c)) {
                // Do nothing...
            } else if (c === ':') {
                stop = true;
            } else {
                this.error = `Unexpected ${showChar(c)} when parsing command ` +
                    `(after \`${command.getRaw()}\`)`;
                return null;
            }
            this.increasePos();
        }
        if (!stop) {
            this.error = `Missing \`:\` after command identifier (after \`${command.getRaw()}\`)`;
            return null;
        }
        return command;
    }

    increasePos(increaseIfNothing = true) {
        const start = this.pos;
        while (this.pos < this.text.length && isWhiteSpace(this.text.charAt(this.pos))) {
            if (this.text.charAt(this.pos) === '\n') {
                this.currentLine += 1;
            }
            this.pos += 1;
        }
        if (increaseIfNothing === true && start === this.pos) {
            this.pos += 1;
        }
    }

    // This whole function exists because the `goto` command parsing is special.
    parseGoTo() {
        // Since it's not using the common parser system, we have to get rid of the useless
        // characters first...
        this.skipWhiteSpaceCharacters();
        // Now that we found the first non-whitespace character, time to get the rest!
        this.argsStart = this.pos;
        const startLine = this.currentLine;
        while (this.pos < this.text.length && this.text.charAt(this.pos) !== '\n') {
            // Exceptionally, we don't use `increasePos()` here!
            this.pos += 1;
        }
        this.argsEnd = this.pos;
        const input = this.text.slice(this.argsStart, this.pos);
        // This function doesn't use the parser so we still need to remove the comment part...
        const parts = input.split(COMMENT_START);
        let line = '';
        if (parts.length > 1) {
            for (let i = 0; i < parts.length; ++i) {
                if (parts[i].endsWith(':')) {
                    line += `${parts[i]}//`;
                    if (i + 1 < parts.length) {
                        i += 1;
                        line += parts[i];
                    }
                }
            }
        } else {
            line = input;
        }
        line = line.trim().split('|');
        for (let i = 1; i < line.length; i += 2) {
            const variable = getVariableValue(this.variables, line[i]);
            if (variable === null) {
                this.error = `variable \`${line[i]}\` not found in options nor environment`;
                return;
            }
            line[i] = variable;
        }
        line = line.join('');
        this.elems.push(new UnknownElement(line, this.argsStart, this.argsEnd, startLine));
    }

    parse(endChar = '\n', pushTo = null, separator = null) {
        if (pushTo === null) {
            this.argsStart = this.pos;
        }
        let prev = '';

        const checker = (t, c, toCall) => {
            const elems = pushTo !== null ? pushTo : t.elems;
            if (elems.length > 0 && prev !== separator) {
                let msg;

                if (separator === null) {
                    msg = endChar === '\n' ? 'nothing' : showChar(endChar);
                } else {
                    if (endChar === '\n') {
                        msg = showChar(separator);
                    } else {
                        msg = `${showChar(separator)} or ${showChar(endChar)}`;
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

        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (c === endChar) {
                break;
            } else if (isStringChar(c)) {
                checker(this, c, 'parseString');
            } else if (c === '{') {
                checker(this, c, 'parseJson');
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (c === separator) {
                const elems = pushTo !== null ? pushTo : this.elems;
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
            } else {
                checker(this, c, 'parseIdent');
                const elems = pushTo !== null ? pushTo : this.elems;
                const el = elems[elems.length - 1];
                if (el.kind === 'unknown') {
                    const token = el.value;
                    if (elems.length === 1) {
                        el.error = `unexpected \`${token}\` as first token`;
                    } else {
                        const prevElem = elems[elems.length - 2].value;
                        el.error = `unexpected token \`${token}\` after \`${prevElem}\``;
                    }
                    this.error = el.error;
                    this.pos = this.text.length;
                }
            }
            this.increasePos();
        }
        if (pushTo === null) {
            this.argsEnd = this.pos;
        }
        return prev;
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

    parseList(startChar, endChar, constructor, pushTo = null) {
        const start = this.pos;
        const elems = [];

        this.increasePos();
        const prev = this.parse(endChar, elems, ',');
        const full = this.text.substring(start, this.pos + 1);
        if (elems.length > 0 && elems[elems.length - 1].error !== null) {
            this.push(
                new constructor(
                    elems,
                    start,
                    this.pos,
                    full,
                    this.currentLine,
                    elems[elems.length - 1].error,
                ),
                pushTo,
            );
        } else if (this.pos >= this.text.length || this.text.charAt(this.pos) !== endChar) {
            if (elems.length === 0) {
                this.push(new constructor(elems, start, this.pos, full, this.currentLine,
                    `expected ${showChar(endChar)} at the end`),
                pushTo);
            } else {
                let err;

                if (prev === ',') {
                    const last = elems[elems.length - 1].getText();
                    err = `expected ${showChar(endChar)} after \`${last}\``;
                } else {
                    err = `expected ${showChar(endChar)} or \`,\` after ` +
                        `\`${elems[elems.length - 1].getText()}\``;
                }
                this.push(
                    new constructor(elems, start, this.pos, full, this.currentLine, err),
                    pushTo,
                );
            }
        } else if (elems.length > 0 && elems[elems.length - 1].error !== null) {
            this.push(
                new constructor(
                    elems,
                    start,
                    this.pos,
                    full,
                    this.currentLine,
                    elems[elems.length - 1].error,
                ),
                pushTo,
            );
        } else {
            this.push(new constructor(elems, start, this.pos, full, this.currentLine), pushTo);
        }
    }

    parseTuple(pushTo = null) {
        const tmp = [];
        this.parseList('(', ')', TupleElement, tmp);
        if (tmp[0].error !== null) {
            // nothing to do
        } else if (tmp[0].getRaw().length === 0) {
            tmp[0].error = 'unexpected `()`: tuples need at least one argument';
        }
        this.push(tmp[0], pushTo);
    }

    parseArray(pushTo = null) {
        const tmp = [];
        this.parseList('[', ']', ArrayElement, tmp);
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
                const e = new StringElement(value, start, this.pos, full, this.currentLine);
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
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            // Check if it is a latin letter.
            if (c !== '_' && !isLetter(c) && specialChars.indexOf(c) === -1) {
                break;
            }
            this.increasePos();
        }
        const ident = this.text.substring(start, this.pos);
        if (ident.length !== 0) {
            this.push(new IdentElement(ident, start, this.pos, this.currentLine), pushTo);
            this.pos -= 1; // Need to go back to last "good" letter.
        } else {
            this.push(
                new UnknownElement(this.text.charAt(start), start, this.pos, this.currentLine),
                pushTo,
            );
        }
    }

    parseVariable(pushTo = null, forceString = false) {
        const start = this.pos;

        this.increasePos();
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            if (c === '|') {
                const variableName = this.text.substring(start + 1, this.pos);
                const associatedValue = this.getVariableValue(variableName);
                if (associatedValue === null) {
                    this.pos = this.text.length + 1;
                    this.push(new VariableElement(variableName, start, this.pos,
                        `variable \`${variableName}\` not found in options nor environment`),
                    pushTo);
                    return;
                }
                if (forceString === false && matchInteger(associatedValue) === true) {
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
                            associatedValue,
                            this.currentLine,
                        ),
                        pushTo,
                    );
                }
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
        return getVariableValue(this.variables, variableName);
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
            if (e.error !== null) {
                this.error = e.error;
            }
            this.elems.push(e);
        }
    }

    parseJson(pushTo = null) {
        const start = this.pos;
        const elems = [];
        let key = null;
        let prevChar = '';
        let errorHappened = false;
        const parseEnd = (obj, pushTo, err) => {
            const fullText = obj.text.substring(start, obj.pos + 1);
            obj.push(
                new JsonElement(elems, start, obj.pos, fullText, this.currentLine, err), pushTo);
            if (typeof err !== 'undefined') {
                obj.pos = obj.text.length;
                errorHappened = true;
            }
        };
        const checkForNumber = number => {
            if (key === null) {
                elems.push({'key': number});
                const text = number.getText();
                parseEnd(this, pushTo, `\`${text}\`: numbers cannot be used as keys`);
            } else if (prevChar !== ':') {
                elems.push({'key': key, 'value': number});
                parseEnd(this, pushTo,
                    `expected \`:\` after \`${key.getText()}\`, found \`${number.getText()}\``);
            } else {
                elems.push({'key': key, 'value': number});
                prevChar = '';
                key = null;
            }
        };
        const checkForString = s => {
            if (key === null) {
                if (prevChar !== ',' && elems.length > 0) {
                    const last = elems[elems.length - 1].value.getText();
                    parseEnd(this, pushTo,
                        `expected \`,\` or \`}\` after \`${last}\`, found \`${s.getText()}\``);
                }
                if (s.error !== null) {
                    parseEnd(this, pushTo, s.error);
                } else {
                    key = s;
                }
            } else {
                elems.push({'key': key, 'value': s});
                if (prevChar !== ':') {
                    const text = s.getText();
                    parseEnd(this, pushTo,
                        `expected \`:\` after \`${key.getText()}\`, found \`${text}\``);
                } else {
                    prevChar = '';
                    if (s.error !== null) {
                        parseEnd(this, pushTo, s.error);
                    }
                    key = null;
                }
            }
        };

        this.increasePos();
        // TODO: instead of using a kind of state machine, maybe make it work as step?
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (c === '}') {
                if (key !== null) {
                    let k = key.getText();
                    if (prevChar === ':') {
                        k += ':';
                    }
                    elems.push({'key': key});
                    parseEnd(this, pushTo, `unexpected \`}\` after \`${k}\`: expected a value`);
                } else {
                    parseEnd(this, pushTo);
                }
                return;
            } else if (c === '/') {
                this.parseComment(this, pushTo);
            } else if (isStringChar(c)) {
                const tmp = [];
                this.parseString(tmp);
                checkForString(tmp[0]);
            } else if (c === ',') {
                if (key !== null) {
                    elems.push({'key': key});
                    let err = `expected \`:\` after \`${key.getText()}\`, found \`,\``;
                    if (prevChar === ':') {
                        err = 'unexpected `,` after `:`';
                    }
                    parseEnd(this, pushTo, err);
                } else if (elems.length === 0) {
                    parseEnd(this, pushTo, 'unexpected `,` after `{`');
                } else {
                    prevChar = ',';
                }
            } else if (c === ':') {
                if (key === null) {
                    if (elems.length > 0) {
                        let msg = 'unexpected `:` after `,`';
                        if (prevChar !== ',') {
                            const last = elems[elems.length - 1].value.getText();
                            msg = `expected \`,\` or \`}\` after \`${last}\`, found \`:\``;
                        }
                        parseEnd(this, pushTo, msg);
                    } else {
                        parseEnd(this, pushTo, 'unexpected `:` after `{`');
                    }
                } else {
                    prevChar = ':';
                }
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (c === '|') {
                if (key === null && prevChar === '' && elems.length > 0) {
                    const last = elems[elems.length - 1].value.getText();
                    parseEnd(this, pushTo, `unexpected \`|\` after \`${last}\``);
                } else if (key !== null && prevChar === '') {
                    parseEnd(this, pushTo, `expected \`:\` after \`${key}\`, found \`|\``);
                } else {
                    const tmp = [];
                    this.parseVariable(tmp, key === null);
                    if (tmp[0].kind === 'number') {
                        checkForNumber(tmp[0]);
                    } else {
                        checkForString(tmp[0]);
                    }
                }
            } else if (isNumber(c)) {
                const tmp = [];
                this.parseNumber(tmp);
                checkForNumber(tmp[0]);
            } else if (c === '{') {
                const tmp = [];
                this.parseJson(tmp);

                if (key === null) {
                    elems.push({'key': tmp[0]});
                    parseEnd(this, pushTo,
                        `\`${tmp[0].getText()}\`: JSON objects cannot be used as keys`);
                } else if (prevChar !== ':') {
                    elems.push({'key': key, 'value': tmp[0]});
                    parseEnd(this, pushTo,
                        `expected \`:\` after \`${key.getText()}\`, found \`${tmp[0].getText()}\``);
                } else {
                    prevChar = '';
                    elems.push({'key': key, 'value': tmp[0]});
                    if (tmp[0].error !== null) {
                        parseEnd(this, pushTo, tmp[0].error);
                    }
                    key = null;
                }
            } else if (c === '[') {
                // TODO exact same code as JSON objects, maybe combine them?
                const tmp = [];
                this.parseArray(tmp);

                if (key === null) {
                    elems.push({'key': tmp[0]});
                    parseEnd(this, pushTo,
                        `\`${tmp[0].getText()}\`: arrays cannot be used as keys`);
                } else if (prevChar !== ':') {
                    elems.push({'key': key, 'value': tmp[0]});
                    parseEnd(this, pushTo,
                        `expected \`:\` after \`${key.getText()}\`, found \`${tmp[0].getText()}\``);
                } else {
                    prevChar = '';
                    elems.push({'key': key, 'value': tmp[0]});
                    if (tmp[0].error !== null) {
                        parseEnd(this, pushTo, tmp[0].error);
                    }
                    key = null;
                }
            } else {
                const tmp = [];
                this.parseIdent(tmp);
                const el = tmp[0];
                if (el.kind === 'unknown') {
                    const token = el.getText();
                    if (key === null) {
                        elems.push({'key': el});
                        if (elems.length > 1) {
                            const last = elems[elems.length - 2].value.getText();
                            parseEnd(this, pushTo, `unexpected \`${token}\` after \`${last}\``);
                        } else {
                            parseEnd(this, pushTo, `unexpected \`${token}\` after \`{\``);
                        }
                    } else if (prevChar !== ':') {
                        elems.push({'key': key, 'value': el});
                        parseEnd(this, pushTo,
                            `expected \`:\` after \`${key.getText()}\`, found \`${token}\``);
                    } else {
                        elems.push({'key': key, 'value': el});
                        parseEnd(this, pushTo,
                            `invalid value \`${token}\` for key \`${key.getText()}\``);
                    }
                } else if (key === null) {
                    elems.push({'key': el});
                    parseEnd(this, pushTo,
                        `\`${el.getText()}\`: booleans and idents cannot be used as keys`);
                } else if (prevChar !== ':') {
                    elems.push({'key': key, 'value': el});
                    parseEnd(this, pushTo,
                        `expected \`:\` after \`${key.getText()}\`, found \`${el.getText()}\``);
                } else {
                    prevChar = '';
                    elems.push({'key': key, 'value': el});
                    key = null;
                }
            }
            this.increasePos();
        }
        if (errorHappened === true) {
            // do nothing
        } else if (key !== null) {
            parseEnd(this, pushTo, `missing value after \`${key.getText()}\``);
        } else if (elems.length === 0) {
            parseEnd(this, pushTo, 'unclosed empty JSON object');
        } else {
            const el = elems[elems.length - 1].value.getText();
            parseEnd(this, pushTo, `unclosed JSON object: expected \`}\` after \`${el}\``);
        }
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
