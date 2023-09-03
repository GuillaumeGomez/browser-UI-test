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
    constructor(kind, value, functionName = null, innerArgs = null) {
        this.kind = kind;
        this.value = value;
        this.functionName = functionName;
        this.innerArgs = innerArgs;
    }
}

function convertElemToColor(parser, elem) {
    const ret = fromString(elem.value);
    if (ret !== null) {
        // Ok, it's a color, now we need to get the exact kind for the "back"
        // conversion.
        let kind = 'keyword';
        if (elem.value.startsWith('#')) {
            if (elem.value.length < 7) {
                kind = 'hex-short';
                elem.hasAlpha = elem.value.length > 4;
            } else {
                kind = 'hex';
                elem.hasAlpha = elem.value.length > 7;
            }
        } else if (elem.value.startsWith('rgb(')) {
            kind = 'rgb';
            elem.hasAlpha = false;
        } else if (elem.value.startsWith('rgba(')) {
            kind = 'rgba';
            elem.hasAlpha = true;
        } else if (elem.value.startsWith('hsl(')) {
            kind = 'hsl';
        } else if (elem.value.startsWith('hsla(')) {
            kind = 'hsla';
        }
        elem.kind = 'color';
        elem.colorKind = kind;
        elem.color = ret.toRgbaArray();
        parser.hasColor = true;
        return true;
    } else if (elem.innerArgs !== null) {
        let containsColor = false;
        for (const arg of elem.innerArgs) {
            containsColor = convertElemToColor(parser, arg) || containsColor;
        }
        elem.containsColor = containsColor;
        parser.hasColor = containsColor || parser.hasColor;
        return containsColor;
    }
    return false;
}

function toRGBAStringInner(elems, separator) {
    let output = '';

    for (const elem of elems) {
        if (output.length > 0) {
            output += separator;
        }
        if (elem.kind === 'function' && elem.containsColor === true) {
            output += `${elem.functionName}(${toRGBAStringInner(elem.innerArgs, ', ')})`;
        } else if (elem.kind !== 'color') {
            output += elem.value;
        } else {
            const [r, g, b, a] = elem.color;
            output += `rgba(${r}, ${g}, ${b}, ${a})`;
        }
    }
    return output;
}

class CssParser {
    constructor(input) {
        this.input = input;
        this.elems = [];
        this.pos = 0;
        this.hasColor = false;

        this.parse();
        for (const elem of this.elems) {
            if (elem.kind === 'ident' || elem.kind === 'function') {
                convertElemToColor(this, elem);
            }
        }
    }

    toRGBAString() {
        if (!this.hasColor) {
            return this.input;
        }
        return toRGBAStringInner(this.elems, ' ');
    }

    sameFormatAsInner(elems, otherElems, level, separator) {
        let output = '';

        for (const [i, elem] of elems.entries()) {
            const otherElem = i < otherElems.length ? otherElems[i] : { 'kind': null };
            if (output.length > 0) {
                output += separator;
            }
            if (elem.kind !== otherElem.kind) {
                if (level === 0) {
                    return this.input;
                }
                output += elem.value;
                continue;
            }
            if (elem.kind !== 'color') {
                if (elem.kind === 'function' && elem.containsColor === true) {
                    const inner = this.sameFormatAsInner(
                        elem.innerArgs,
                        otherElem.innerArgs,
                        level + 1,
                        ', ',
                    );
                    output += `${elem.functionName}(${inner})`;
                } else {
                    output += elem.value;
                }
                continue;
            }
            if (otherElem.colorKind.startsWith('hex')) {
                const alpha = otherElem.hasAlpha || elem.color[3] < 1 ?
                    Math.round(elem.color[3] * 255) : null;
                const values = elem.color.slice(0, 3).map(v => toHex(v));
                if (alpha !== null) {
                    values.push(toHex(alpha));
                }
                if (otherElem.colorKind === 'hex-short' && values.every(e => e[0] === e[1])) {
                    output += '#' + values.map(e => e[0]).join('');
                } else {
                    output += '#' + values.join('');
                }
            } else if (otherElem.colorKind.startsWith('hsl')) {
                output += fromRgba(elem.color).toHslString();
            } else if (otherElem.colorKind.startsWith('rgb')) {
                output += fromRgba(elem.color).toRgbString(otherElem.hasAlpha);
            } else {
                const ret = Object.entries(allColors).find(([_, v]) => {
                    return v[0] === elem.color[0] &&
                        v[1] === elem.color[1] &&
                        v[2] === elem.color[2] &&
                        v[3] === elem.color[3];
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

    sameFormatAs(other) {
        if (!other.hasColor || !this.hasColor) {
            return this.input;
        }
        if (other.elems.length !== this.elems.length) {
            return this.input;
        }
        return this.sameFormatAsInner(this.elems, other.elems, 0, ' ');
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

        // Skipping string character.
        this.pos += 1;
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
                const funcName = this.input.substring(start, this.pos);
                this.pos += 1; // To go to the next character directly.
                const args = [];
                this.parse(args, ')');
                this.pos += 1; // To include the ')' at the end.
                this.push(
                    new CssElem('function', this.input.substring(start, this.pos), funcName, args),
                    pushTo,
                );
                return;
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
