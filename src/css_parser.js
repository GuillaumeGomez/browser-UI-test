const { isStringChar, isWhiteSpace } = require('./parser.js');
const { fromString, fromRgba } = require('./css-color-converter.js');
const allColors = require('./color-name.js');

function toHex(n) {
    const hex = n.toString(16);
    if (hex.length < 2) {
        return '0' + hex;
    }
    return hex;
}

class CssElem {
    constructor(kind, value) {
        this.kind = kind;
        this.value = value;
    }
}

class CssParser {
    constructor(input) {
        this.input = input;
        this.elems = [];
        this.pos = 0;
        this.hasColor = false;

        this.parse();
        for (const elem of this.elems) {
            if (elem.kind === 'ident') {
                const ret = fromString(elem.value);
                if (ret !== null) {
                    // Ok, it's a color, now we need to get the exact kind for the "back"
                    // conversion.
                    let kind = 'keyword';
                    if (elem.value.startsWith('#')) {
                        if (elem.value.length < 7) {
                            kind = 'hex-short';
                        } else {
                            kind = 'hex';
                        }
                    } else if (elem.value.startsWith('rgb(')) {
                        kind = 'rgb';
                    } else if (elem.value.startsWith('rgba(')) {
                        kind = 'rgba';
                    } else if (elem.value.startsWith('hsl(')) {
                        kind = 'hsl';
                    } else if (elem.value.startsWith('hsla(')) {
                        kind = 'hsla';
                    }
                    elem.kind = 'color';
                    elem.colorKind = kind;
                    elem.color = ret.toRgbaArray();
                    this.hasColor = true;
                }
            }
        }
    }

    toRGBAString() {
        if (!this.hasColor) {
            return this.input;
        }
        let output = '';

        for (const elem of this.elems) {
            if (output.length > 0) {
                output += ' ';
            }
            if (elem.kind !== 'color') {
                output += elem.value;
            } else {
                const [r, g, b, a] = elem.color;
                output += `rgba(${r}, ${g}, ${b}, ${a})`;
            }
        }
        return output;
    }

    sameFormatAs(other) {
        if (!other.hasColor || !this.hasColor) {
            return this.input;
        }
        if (other.elems.length !== this.elems.length) {
            return this.input;
        }
        let output = '';

        for (const [i, elem] of this.elems.entries()) {
            const otherElem = other.elems[i];
            if (elem.kind !== otherElem.kind) {
                return this.input;
            }
            if (output.length > 0) {
                output += ' ';
            }
            if (elem.kind !== 'color') {
                output += elem.value;
                continue;
            }
            if (otherElem.colorKind.startsWith('hex') && elem.color[3] >= 1) {
                const values = elem.color.slice(0, 3).map(v => toHex(v));
                if (otherElem.colorKind === 'hex-short' && values.every(e => e[0] === e[1])) {
                    output += '#' + values.map(e => e[0]).join('');
                } else {
                    output += '#' + values.join('');
                }
            } else if (otherElem.colorKind.startsWith('hsl')) {
                output += fromRgba(elem.color).toHslString();
            } else if (otherElem.colorKind.startsWith('rgb')) {
                output += fromRgba(elem.color).toRgbString();
            } else {
                const ret = Object.entries(allColors).find(([key, _]) => {
                    return key === otherElem.value;
                });
                if (ret !== undefined) {
                    output += ret[0];
                } else {
                    output += fromRgba(elem.color).toRgbString();
                }
            }
        }
        return output;
    }

    parse(pushTo = null, endChar = null) {
        while (this.pos < this.input.length) {
            const c = this.input.charAt(this.pos);

            if (c === endChar) {
                return;
            } else if (isStringChar(c)) {
                this.parseString(c, pushTo);
            } else if (isWhiteSpace(c) || c === ',') {
                // Do nothing.
            } else {
                this.parseIdent(pushTo);
                continue;
            }
            this.pos += 1;
        }
    }

    parseString(endChar, pushTo) {
        const start = this.pos;

        for (; this.pos < this.input.length; this.pos += 1) {
            const c = this.input.charAt(this.pos);

            if (c === endChar) {
                break;
            } else if (c === '\\') {
                this.pos += 1;
            }
        }
        this.push(new CssElem('string', this.input.substring(start, this.pos + 1)), pushTo);
    }

    parseIdent(pushTo) {
        const start = this.pos;
        for (; this.pos < this.input.length; this.pos += 1) {
            const c = this.input.charAt(this.pos);

            if (isStringChar(c) || isWhiteSpace(c) || c === ',' || c === ')') {
                break;
            } else if (c === '(') {
                this.pos += 1; // To go to the next character directly.
                this.parse([], ')');
                this.pos += 1; // To include the ')' at the end.
                break;
            }
        }
        this.push(new CssElem('ident', this.input.substring(start, this.pos)), pushTo);
    }

    push(elem, pushTo) {
        if (pushTo !== null) {
            pushTo.push(elem);
        } else {
            this.elems.push(elem);
        }
    }
}

module.exports = {
    'CssParser': CssParser,
};
