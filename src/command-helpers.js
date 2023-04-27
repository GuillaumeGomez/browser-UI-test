const { CssParser } = require('./css_parser.js');

function makeError(value, key, computed, extracted = null) {
    let out = 'expected \`' + value + '\` for key \`' + key + '\`, found \`' + computed + '\`';
    if (extracted !== null) {
        out += ' (or \`' + extracted + '\`)';
    }
    return out;
}

function checkCssProperty(key, value, simple, computed, localErr) {
    if (simple == value || computed == value) {
        return;
    }
    if (simple === null || computed === null) {
        localErr.push('no local CSS property named \`' + key + '\`');
        return;
    }
    if (typeof computed === "string" && computed.search(/^(\\d+\\.\\d+px)$/g) === 0) {
        const extracted = browserUiTestHelpers.extractFloatOrZero(computed, true) + "px";
        if (extracted !== value) {
            localErr.push(makeError(value, key, computed, extracted));
            return;
        }
    }
    if (computed !== null && value !== null) {
        const improvedComputed = new CssParser(computed);
        if (!improvedComputed.hasColor) {
            localErr.push(makeError(value, key, computed));
            return;
        }
        let improved = new CssParser(value);
        if (!improved.hasColor) {
            localErr.push(makeError(value, key, computed));
            return;
        } else if (improved.toRGBAString() === improvedComputed.toRGBAString()) {
            return;
        }
        localErr.push(makeError(value, key, improvedComputed.sameFormatAs(improved)));
    }
}

module.exports = {
    'checkCssProperty': checkCssProperty,
};
