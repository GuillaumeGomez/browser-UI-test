function getElemText(e, value) {
    let elemValue;
    if (e.tagName.toLowerCase() === 'input') {
        elemValue = e.value;
    } else {
        elemValue = e.textContent;
    }
    // `\xa0` is `&nbsp`. In case the user didn't provide the character as is, we make the
    // conversion into whitespace automatically.
    if (value.indexOf('\xa0') === -1) {
        elemValue = elemValue.replace(/\xa0/g, ' ');
    }
    return elemValue;
}

function extractFloat(value, rounded) {
    const ret = parseFloat(value.replace('px', ''));
    if (rounded === true) {
        return Math.round(ret);
    }
    return ret;
}

// eslint-disable-next-line no-unused-vars
const browserUiTestHelpers = {
    getElemText: getElemText,
    compareElemText: function(e, value) {
        const elemValue = getElemText(e, value);
        if (elemValue !== value) {
            throw '"' + elemValue + '" !== "' + value + '"';
        }
    },
    elemTextStartsWith: function(e, value) {
        const elemValue = getElemText(e, value);
        if (!elemValue.startsWith(value)) {
            throw `"${elemValue}" doesn't start with "${value}"`;
        }
    },
    elemTextEndsWith: function(e, value) {
        const elemValue = getElemText(e, value);
        if (!elemValue.endsWith(value)) {
            throw `"${elemValue}" doesn't end with "${value}"`;
        }
    },
    elemTextContains: function(e, value) {
        const elemValue = getElemText(e, value);
        if (elemValue.indexOf(value) === -1) {
            throw `"${elemValue}" doesn't contain "${value}"`;
        }
    },
    extractFloat: extractFloat,
    extractFloatOrZero: function(value, rounded) {
        const ret = extractFloat(value, rounded);
        return isNaN(ret) ? 0 : ret;
    },
};
