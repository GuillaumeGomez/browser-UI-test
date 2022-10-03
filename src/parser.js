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
    return ['string', 'number'].indexOf(elem.kind) !== -1;
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
    getText() {
        return this.value;
    }

    // Used for error messages.
    getArticleKind() {
        if (this.kind === 'unknown') {
            return 'an unknown item';
        }
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

        while (this.pos < this.text.length && this.error === null) {
            const c = this.text.charAt(this.pos);

            if (endChars.indexOf(c) !== -1) {
                endChar = c;
                if (foundPlus) {
                    if (c === '\n') {
                        // we ignore it and continue.
                    } else {
                        const elems = this.getElems(pushTo);
                        elems[elems.length - 1].error = 'Missing element after `+` token';
                        this.error = elems[elems.length - 1].error;
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
                    this.error = el.error;
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
                        const prevElem = elems[elems.length - 2].getText();
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
                this.error = elems[i].error;
                return;
            }
            if (!isAdditionable(elems[i + 1])) {
                elems[i + 1].error = `${elems[i + 1].getArticleKind()} (\`\
${elems[i + 1].getText()}\`) cannot be used after a \`+\` token`;
                this.error = elems[i + 1].error;
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
${elems[i - 1].getText()}\`) cannot be used before a \`+\` token`;
                    this.error = elems[i - 1].error;
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
                        full.push(elem.getText());
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
            elems.splice(last, last + subs.length * 2 + 1);
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

        this.increasePos();
        const prev = this.parse([endChar], elems, ',')[0];
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
        this.parseList(')', TupleElement, tmp);
        if (tmp[0].error !== null) {
            // nothing to do
        } else if (tmp[0].getRaw().length === 0) {
            tmp[0].error = 'unexpected `()`: tuples need at least one argument';
        }
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

    parseVariable(pushTo = null) {
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
                if (!this.forceVariableAsString && matchInteger(associatedValue) === true) {
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
                keyError(this, `expected \`:\` after \`${elems[0].getText()}\`, found \
\`${elems[1].getText()}\``);
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
                            `expected a key after \`${last.value.getText()}\`, found \`,\``,
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
                const extra = ` (\`${elems[0].getText()}\`)`;
                keyError(this, `only strings can be used as keys in JSON dict, found \
${article}${extra}`);
                return;
            } else if (ender === '}' || ender === ',') {
                const after = elems[0].getText();
                keyError(this, `expected \`:\` after \`${after}\`, found \`${ender}\``);
                return;
            } else if (this.error !== null) {
                keyError(this, this.error);
                return;
            }
            const key = elems[0];

            this.increasePos(); // Moving past `:`.
            elems = [];
            ender = this.parse([',', '}', ':'], elems, null, ` for key \`${key.getText()}\``)[1];
            if (elems.length > 1) {
                keyError(this, `expected \`,\` or \`}\` after \`${elems[0].getText()}\`, found \
\`${elems[1].getText()}\``);
                return;
            } else if (ender === ':') {
                let error = 'unexpected `:` ';
                if (elems.length !== 0) {
                    error += `after key \`${elems[0].getText()}\``;
                } else {
                    error += `after key \`${key.getText()}\``;
                }
                keyError(this, error);
                return;
            } else if (elems.length === 0) {
                keyError(
                    this,
                    `expected a value for key \`${key.getText()}\`, found nothing`,
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
                error = `unclosed JSON object: expected \`}\` after \`${last.getText()}\``;
            }
        }
        const extra = error === null ? 1 : 0;
        const fullText = this.text.substring(start, this.pos + extra);
        this.push(
            new JsonElement(json, start, this.pos, fullText, startLine, error),
            pushTo,
        );
        this.error = error;
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
