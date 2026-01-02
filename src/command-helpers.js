const { CssParser } = require('./css_parser.js');
const { browserUiTestHelpers } = require('./helpers.js');

function makeError(value, key, computed, extracted = null) {
    let out = `expected \`${value}\` for key \`${key}\`, found \`${computed}\``;
    if (extracted !== null) {
        out += ` (or \`${extracted}\`)`;
    }
    return out;
}

function checkCssProperty(key, value, simple, computed, localErr) {
    // eslint-disable-next-line eqeqeq
    if (simple == value || computed == value) {
        return;
    }
    if (simple === null || computed === null) {
        localErr.push(`no local CSS property named \`${key}\``);
        return;
    }
    if (typeof computed === 'string' && computed.search(/^(\\d+\\.\\d+px)$/g) === 0) {
        const extracted = browserUiTestHelpers.extractFloatOrZero(computed, true) + 'px';
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
        const improved = new CssParser(value);
        if (!improved.hasColor) {
            localErr.push(makeError(value, key, computed));
            return;
        } else if (improved.toRGBAString() === improvedComputed.toRGBAString()) {
            return;
        }
        localErr.push(makeError(value, key, improvedComputed.sameFormatAs(improved)));
    }
}

function compareArrayLike(t1, t2) {
    if (t1.length !== t2.length) {
        return false;
    }
    for (const [index, value] of t1.entries()) {
        if (value !== t2[index]) {
            return false;
        }
    }
    return true;
}

function compareJson(j1, j2) {
    for (const key of Object.keys(j1)) {
        if (j2[key] !== j1[key]) {
            return false;
        }
    }
    for (const key of Object.keys(j2)) {
        if (j2[key] !== j1[key]) {
            return false;
        }
    }
    return true;
}

module.exports = {
    'checkCssProperty': checkCssProperty,
    'compareJson': compareJson,
    'compareArrayLike': compareArrayLike,
};
