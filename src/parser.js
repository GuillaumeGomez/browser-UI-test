function isWhiteSpace(c) {
    return c === ' ' || c === '\t';
}

function isStringChar(c) {
    return c === '\'' || c === '"';
}

function isNumber(c) {
    return c >= '0' && c <= '9';
}

class Element {
    constructor(kind, value, startPos, endPos, error = null) {
        this.kind = kind;
        this.value = value;
        this.startPos = startPos;
        this.endPos = endPos;
        this.error = error;
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
}

class StringElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('string', value, startPos, endPos, error);
    }
}

class NumberElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('number', value, startPos, endPos, error);
    }
}

class JsonElement extends Element {
    constructor(value, startPos, endPos, error = null) {
        super('json', value, startPos, endPos, error);
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
    }

    parse(endChar = null, pushTo = null, separator = null) {
        let prev = '';

        const checker = (t, c, toCall) => {
            if (t.elems.length > 0 && prev !== ',') {
                t.elems[t.elems.length - 1].error = `Expected \`,\`, found \`${c}\``;
                t.pos = t.text.length;
            } else {
                t[toCall](pushTo);
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
                    this.push(new CharElement(separator, this.pos, `Unexpected \`${separator}\` as first element`), pushTo);
                    this.pos = this.text.length;
                } else if (elems[elems.length - 1].kind === 'char') {
                    const prevElem = elems[elems.length - 1].text;
                    this.push(new CharElement(separator, this.pos, `Unexpected \`${separator}\` after \`${prevElem}\``), pushTo);
                    this.pos = this.text.length;
                } else {
                    prev = separator;
                }
            } else if (isNumber(c)) {
                checker(this, c, 'parseNumber');
            } else if (c === '(') {
                checker(this, c, 'parseTuple');
            } else if (c === endChar) {
                return prev;
            } else {
                checker(this, c, 'parseBoolean');
                const elems = pushTo !== null ? pushTo : this.elems;
                const el = elems[elems.length - 1];
                if (el.kind === 'unknown') {
                    const token = el.value;
                    if (elems.length === 1) {
                        this.push(new CharElement(c, start, `Unexpected \`${token}\` as first token`), pushTo);
                    } else {
                        const prevElem = elems[elems.length - 2].value;
                        this.push(new CharElement(c, start, `Unexpected \`${token}\` after \`${prevElem}\``), pushTo);
                    }
                    this.pos = this.text.length;
                }
            }
            this.pos += 1;
        }
    }

    parseBoolean(pushTo = null) {
        const start = this.pos;
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (isWhiteSpace(x) || isStringChar(x) || '({:,-+/*;.!?|[=%'.indexOf(x) !== -1) {
                break;
            }
            this.pos += 1;
        }
        const token = this.text.substring(start, this.pos);
        if (token === 'true' || token === 'false') {
            this.push(new BoolElement(token === 'true', start, this.pos), pushTo);
        } else {
            this.push(new UnknownElement(token, start, this.pos), pushTo);
        }
    }

    parseTuple(pushTo = null) {
        const start = this.pos;
        const elems = [];

        this.pos += 1;
        const prev = this.parse(')', elems, ',');
        if (prev !== '') {
            if (elems.length > 0) {
                const el = elems[elems.length - 1].value;
                this.push(new TupleElement(elems, start, this.pos, `unexpected \`${prev}\` after \`${el}\``), pushTo);
            } else {
                // this case should never happen but just in case...
                this.push(new TupleElement(elems, start, this.pos, `unexpected \`${prev}\` after \`(\``), pushTo);
            }
        } else if (this.pos >= this.text.length || this.charAt(this.pos) !== ')') {
            this.push(new TupleElement(elems, start, this.pos, 'expected `)` at the end'), pushTo);
        } else if (elems.length === 0) {
            this.push(new TupleElement(elems, start, this.pos, 'unexpected `()`'), pushTo);
        } else {
            this.push(new TupleElement(elems, start, this.pos), pushTo);
        }
    }

    parseString(pushTo = null) {
        const start = this.pos;
        const endChar = this.text.charAt(this.pos);
        let done = false;

        this.pos += 1;
        while (done === false && this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);
            if (c === endChar) {
                const e = new StringElement(this.text.substring(start + 1, this.pos), start, this.pos);
                this.push(e, pushTo);
                done = true;
                break;
            } else if (c === '\\') {
                this.pos += 1;
            }
            this.pos += 1;
        }
        if (done === false) {
            const e = new StringElement(this.text.substring(start + 1, this.pos), start, this.pos,
                `expected \`${endChar}\` at the end of the string`);
            this.push(e, pushTo);
        }
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
            this.elems.push(e);
        }
    }

    parseJson(pushTo = null) {
        const start = this.pos;
        const elems = [];
        let key = null;
        let prevChar = '';

        this.pos += 1;
        while (this.pos < this.text.length) {
            const c = this.text.charAt(this.pos);

            if (c === '}') {
                if (key !== null) {
                    this.push(new JsonElement(elems, start, this.pos, `unexpected \`}\` after ${key.value}`), pushTo);
                } else {
                    this.push(new JsonElement(elems, start, this.pos), pushTo);
                }
                return;
            } else if (isStringChar(c)) {
                const tmp = [];
                this.parseString(tmp);
                if (key === null) {
                    if (prevChar !== ',' && elems.length > 0) {
                        const last = elems[elems.length - 1].value;
                        this.push(new JsonElement(elems, start, this.pos, `expected \`,\` after \`${last}\`, found \`:\``), pushTo);
                    }
                    key = tmp[0];
                } else {
                    if (prevChar !== ':') {
                        this.push(new JsonElement(elems, start, this.pos, `expected \`:\` after \`${key.value}\``), pushTo);
                        this.pos = this.text.length;
                    }
                    prevChar = '';
                    elems.push({'key': key, 'value': tmp[0]});
                    key = null;
                }
            } else if (c === ',') {
                if (key !== null) {
                    this.push(new JsonElement(elems, start, this.pos, `expected \`:\` after \`${key.value}\`, found \`,\``), pushTo);
                    this.pos = this.text.length;
                }
                prevChar = ',';
            } else if (c === ':') {
                if (key === null) {
                    if (elems.length > 0) {
                        const last = elems[elems.length - 1].value;
                        this.push(new JsonElement(elems, start, this.pos, `expected \`,\` after \`${last}\`, found \`:\``), pushTo);
                    } else {
                        this.push(new JsonElement(elems, start, this.pos, 'unexpected `:` after `{`'), pushTo);
                    }
                    this.pos = this.text.length;
                }
                prevChar = ':';
            } else if (isWhiteSpace(c)) {
                // do nothing
            } else if (isNumber(c)) {
                const tmp = [];
                this.parseNumber(tmp);
                if (key === null) {
                    elems.push({key: tmp[0]});
                    this.push(new JsonElement(elems, start, this.pos, 'numbers cannot be used as keys'), pushTo);
                    this.pos = this.text.length;
                } else if (prevChar !== ':') {
                    elems.push({key: key});
                    this.push(new JsonElement(elems, start, this.pos, `expected \`:\` after \`${key.value}\`, found \`${tmp[0].value}\``), pushTo);
                    this.pos = this.text.length;
                } else {
                    prevChar = '';
                    elems.push({'key': key, 'value': tmp[0]});
                    key = null;
                }
            } else if (c === '{') {
                if (prevChar !== ':') {
                    this.push(new JsonElement(elems, start, this.pos, `expected \`:\` after \`${key.value}\`, found \`${tmp[0].value}\``), pushTo);
                    this.pos = this.text.length;
                    break;
                }
                const tmp = [];
                this.parseJson(tmp);

                if (key === null) {
                    elems.push({key: tmp[0]});
                    this.push(new JsonElement(elems, start, this.pos, 'JSON objects cannot be used as keys'), pushTo);
                    this.pos = this.text.length;
                } else if (prevChar !== ':') {
                    elems.push({key: tmp[0]});
                    this.push(new JsonElement(elems, start, this.pos, `expected \`:\` after \`${key.value}\`, found \`${tmp[0].value}\``), pushTo);
                    this.pos = this.text.length;
                } else {
                    prevChar = '';
                    elems.push({'key': key, 'value': tmp[0]});
                    key = null;
                }
            } else {
                const tmp = [];
                this.parseBoolean(tmp);
                const el = tmp[0];
                if (el.kind === 'unknown') {
                    if (elems.length > 1) {
                        const last = elems[elems.length - 2].value;
                        this.push(new JsonElement(elems, start, this.pos, `unexpected \`${token}\` after \`${last}\``), pushTo);
                    } else {
                        this.push(new JsonElement(elems, start, this.pos, `unexpected \`${token}\` after \`{\``), pushTo);
                    }
                    this.pos = this.text.length;
                } else if (key === null) {
                    elems.push({key: el});
                    this.push(new JsonElement(elems, start, this.pos, 'booleans cannot be used as keys'), pushTo);
                    this.pos = this.text.length;
                } else if (prevChar !== ':') {
                    elems.push({key: key});
                    this.push(new JsonElement(elems, start, this.pos, `expected \`:\` after \`${key.value}\`, found \`${el.value}\``), pushTo);
                    this.pos = this.text.length;
                } else {
                    prevChar = '';
                    elems.push({'key': key, 'value': el});
                    key = null;
                }
            }
            this.pos += 1;
        }
        if (key !== null) {
            this.push(new JsonElement(elems, start, this.pos, `missing value after \`${key.value}\``));
        } else if (elems.length === 0) {
            this.push(new JsonElement(elems, start, this.pos, 'unclosed empty JSON object'));
        } else {
            const el = elems[elems.length - 1].value;
            this.push(new JsonElement(elems, start, this.pos, `expected \`}\` after \`${el}\``));
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
};
