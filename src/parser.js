function isWhiteSpace(c) {
    return c === ' ' || c === '\t';
}

function isStringChar(c) {
    return c === '\'' || c === '"';
}

function isNumber(c) {
    return c >= '0' && c <= '9';
}

function isLetter(c) {
    return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z';
}

class Element {
    constructor(kind, value, startPos, endPos, error = null) {
        this.kind = kind;
        this.value = value;
        this.startPos = startPos;
        this.endPos = endPos;
        this.error = error;
    }

    getValue() {
        return this.value;
    }

    // This method is useful for string which returns the text with double quotes
    getText() {
        return this.value;
    }

    isRecursive() {
        // Only Tuple and JSON elements are "recursive" (meaning they can contain sub-levels).
        return false;
    }
}

class CharElement extends Element {
    constructor(value, startPos, error = null) {
        super('char', value, startPos, startPos, error);
    }
}

class TupleElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('tuple', value, startPos, endPos, error);
    }

    isRecursive() {
        return true;
    }
}

class StringElement extends Element {
    constructor(value, startPos, endPos, fullText, error = null) {
        super('string', value, startPos, endPos, error);
        this.fullText = fullText;
    }

    getText() {
        return this.fullText;
    }
}

class NumberElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('number', value, startPos, endPos, error);
    }
}

class JsonElement extends Element {
    constructor(value, startPos, endPos, fullText, error = null) {
        super('json', value, startPos, endPos, error);
        this.fullText = fullText;
    }

    getText() {
        return this.fullText;
    }

    isRecursive() {
        return true;
    }
}

class BoolElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('bool', value, startPos, endPos, error);
    }
}

class UnknownElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('unknown', value, startPos, endPos, error);
    }
}

class Parser {
    constructor(text) {
        this.text = text;
        this.pos = 0;
        this.elems = [];
        this.error = null;
    }

    parse(endChar = null, pushTo = null, separator = null) {
        let prev = '';

        const checker = (t, c, toCall) => {
            const elems = pushTo !== null ? pushTo : t.elems;
            if (elems.length > 0 && prev !== separator) {
                const msg = separator === null ? 'nothing' : `\`${separator}\``;
                const e = new CharElement(c, t.pos, `expected ${msg}, found \`${c}\``);
                t.push(e, pushTo);
                t.pos = t.text.length;
            } else {
                t[toCall](pushTo);
                prev = '';
            }
        };

        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (isStringChar(c)) {
                checker(this, c, 'parseString');
            } else if (c === '{') {
                checker(this, c, 'parseJson');
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (c === separator) {
                const elems = pushTo !== null ? pushTo : this.elems;
                if (elems.length === 0) {
                    this.push(new CharElement(separator, this.pos,
                        `unexpected \`${separator}\` as first element`), pushTo);
                    this.pos = this.text.length;
                } else if (prev === separator) {
                    this.push(new CharElement(separator, this.pos,
                        `unexpected \`${separator}\` after \`${separator}\``), pushTo);
                    this.pos = this.text.length;
                } else if (elems[elems.length - 1].kind === 'char') {
                    // TODO: not sure if this block is useful...
                    const prevElem = elems[elems.length - 1].text;
                    this.push(new CharElement(separator, this.pos,
                        `unexpected \`${separator}\` after \`${prevElem}\``), pushTo);
                    this.pos = this.text.length;
                } else {
                    prev = separator;
                }
            } else if (isNumber(c)) {
                checker(this, c, 'parseNumber');
            } else if (c === '(') {
                checker(this, c, 'parseTuple');
            } else if (c === '/') {
                this.parseComment(this, pushTo);
            } else if (c === endChar) {
                return prev;
            } else {
                checker(this, c, 'parseBoolean');
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
            this.pos += 1;
        }
        return prev;
    }

    parseComment(pushTo = null) {
        const start = this.pos;
        if (this.text.charAt(this.pos + 1) === '/') {
            this.pos = this.text.length;
        } else {
            this.push(new UnknownElement('/', start, this.pos), pushTo);
        }
    }

    parseBoolean(pushTo = null) {
        const start = this.pos;
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (!isNumber(c) && !isLetter(c)) {
                break;
            }
            this.pos += 1;
        }
        let token = this.text.substring(start, this.pos);
        if (token === 'true' || token === 'false') {
            this.push(new BoolElement(token === 'true', start, this.pos), pushTo);
            this.pos -= 1; // we need to go back to the last "good" character
        } else {
            if (token.length === 0) {
                token = this.text.charAt(start);
            }
            this.push(new UnknownElement(token, start, this.pos), pushTo);
        }
    }

    parseTuple(pushTo = null) {
        const start = this.pos;
        const elems = [];

        this.pos += 1;
        const prev = this.parse(')', elems, ',');
        if (elems.length > 0 && elems[elems.length - 1].error !== null) {
            this.push(new TupleElement(elems, start, this.pos, elems[elems.length - 1].error),
                pushTo);
        } else if (prev !== '') {
            if (prev === ',') {
                if (elems.length > 0) {
                    const el = elems[elems.length - 1].getText();
                    this.push(new TupleElement(elems, start, this.pos,
                        `unexpected \`,\` after \`${el}\``), pushTo);
                } else {
                    this.push(new TupleElement(elems, start, this.pos,
                        'unexpected `,` after `(`'), pushTo);
                }
                this.pos = this.text.length;
            } else if (elems.length > 1) { // we're at the end of the text
                const el = elems[elems.length - 1].getText();
                const prevText = elems[elems.length - 2].getText();
                const prevEl = typeof prev !== 'undefined' ? prev : prevText;
                this.push(new TupleElement(elems, start, this.pos,
                    `unexpected \`${el}\` after \`${prevEl}\``), pushTo);
            } else {
                const el = elems[elems.length - 1].getText();
                // this case should never happen but just in case...
                this.push(new TupleElement(elems, start, this.pos,
                    `unexpected \`${el}\` after \`(\``), pushTo);
            }
        } else if (this.pos >= this.text.length || this.text.charAt(this.pos) !== ')') {
            if (elems.length === 0) {
                this.push(new TupleElement(elems, start, this.pos, 'expected `)` at the end'),
                    pushTo);
            } else {
                this.push(new TupleElement(elems, start, this.pos,
                    `expected \`)\` after \`${elems[elems.length - 1].getText()}\``), pushTo);
            }
        } else if (elems.length === 0) {
            this.push(new TupleElement(elems, start, this.pos,
                'unexpected `()`: tuples need at least one argument'), pushTo);
        } else if (elems[elems.length - 1].error !== null) {
            this.push(new TupleElement(elems, start, this.pos, elems[elems.length - 1].error),
                pushTo);
        } else {
            this.push(new TupleElement(elems, start, this.pos), pushTo);
        }
    }

    parseString(pushTo = null) {
        const start = this.pos;
        const endChar = this.text.charAt(this.pos);

        this.pos += 1;
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            if (c === endChar) {
                const value = this.text.substring(start + 1, this.pos);
                const full = this.text.substring(start, this.pos + 1);
                const e = new StringElement(value, start, this.pos, full);
                this.push(e, pushTo);
                return;
            } else if (c === '\\') {
                this.pos += 1;
            }
            this.pos += 1;
        }
        const value = this.text.substring(start + 1, this.pos);
        const full = this.text.substring(start, this.pos);
        const e = new StringElement(value, start, this.pos, full,
            `expected \`${endChar}\` at the end of the string`);
        this.push(e, pushTo);
    }

    parseNumber(pushTo = null) {
        const start = this.pos;

        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (!isNumber(c)) {
                const nb = this.text.substring(start, this.pos);
                this.push(new NumberElement(nb, start, this.pos), pushTo);
                this.pos -= 1;
                return;
            }
            this.pos += 1;
        }
        this.push(new NumberElement(this.text.substring(start, this.pos), start, this.pos), pushTo);
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
            obj.push(new JsonElement(elems, start, obj.pos, fullText, err), pushTo);
            if (typeof err !== 'undefined') {
                obj.pos = obj.text.length;
                errorHappened = true;
            }
        };

        this.pos += 1;
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
                } else if (prevChar === ',') {
                    parseEnd(this, pushTo, 'unexpected `,` before `}`');
                } else {
                    parseEnd(this, pushTo);
                }
                return;
            } else if (c === '/') {
                this.parseComment(this, pushTo);
            } else if (isStringChar(c)) {
                const tmp = [];
                this.parseString(tmp);
                if (key === null) {
                    if (prevChar !== ',' && elems.length > 0) {
                        const last = elems[elems.length - 1].value.getText();
                        parseEnd(this, pushTo,
                            `expected \`,\` after \`${last}\`, found \`${tmp[0].getText()}\``);
                    }
                    if (tmp[0].error !== null) {
                        parseEnd(this, pushTo, tmp[0].error);
                    } else {
                        key = tmp[0];
                    }
                } else {
                    elems.push({'key': key, 'value': tmp[0]});
                    if (prevChar !== ':') {
                        const text = tmp[0].getText();
                        parseEnd(this, pushTo,
                            `expected \`:\` after \`${key.getText()}\`, found \`${text}\``);
                    } else {
                        prevChar = '';
                        if (tmp[0].error !== null) {
                            parseEnd(this, pushTo, tmp[0].error);
                        }
                        key = null;
                    }
                }
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
                            msg = `expected \`,\` after \`${last}\`, found \`:\``;
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
            } else if (isNumber(c)) {
                const tmp = [];
                this.parseNumber(tmp);
                if (key === null) {
                    elems.push({'key': tmp[0]});
                    const text = tmp[0].getText();
                    parseEnd(this, pushTo, `numbers cannot be used as keys (for \`${text}\`)`);
                } else if (prevChar !== ':') {
                    elems.push({'key': key, value: tmp[0]});
                    parseEnd(this, pushTo,
                        `expected \`:\` after \`${key.getText()}\`, found \`${tmp[0].getText()}\``);
                } else {
                    elems.push({'key': key, value: tmp[0]});
                    prevChar = '';
                    key = null;
                }
            } else if (c === '{') {
                const tmp = [];
                this.parseJson(tmp);

                if (key === null) {
                    elems.push({'key': tmp[0]});
                    parseEnd(this, pushTo, 'JSON objects cannot be used as keys');
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
                this.parseBoolean(tmp);
                const el = tmp[0];
                if (el.kind === 'unknown') {
                    const token = el.getText();
                    if (key === null) {
                        elems.push({'key': el});
                        if (elems.length > 1) {
                            const text = elems[elems.length - 2].value.getText();
                            const last = prevChar === ',' ? ',' : text;
                            parseEnd(this, pushTo, `unexpected \`${token}\` after \`${last}\``);
                        } else {
                            parseEnd(this, pushTo, `unexpected \`${token}\` after \`{\``);
                        }
                    } else if (prevChar !== ':') {
                        elems.push({'key': key, 'value': el});
                        parseEnd(this, pushTo,
                            `expected \`:\` after \`${key.getText()}\`, found \`${token}\` after`);
                    } else {
                        elems.push({'key': key, 'value': el});
                        parseEnd(this, pushTo,
                            `invalid value \`${token}\` for key \`${key.getText()}\``);
                    }
                } else if (key === null) {
                    elems.push({'key': el});
                    parseEnd(this, pushTo, 'booleans cannot be used as keys');
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
            this.pos += 1;
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
    Parser: Parser,
    Element: Element,
    CharElement: CharElement,
    TupleElement: TupleElement,
    StringElement: StringElement,
    NumberElement: NumberElement,
    UnknownElement: UnknownElement,
    JsonElement: JsonElement,
    BoolElement: BoolElement,
};
