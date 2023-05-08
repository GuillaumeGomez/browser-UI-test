// eslint-disable-next-line no-unused-vars
const browserUiTestHelpers = (function() {
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
        let ret = parseFloat(value.replace('px', ''));
        if (rounded === true) {
            ret = Math.round(ret);
        }
        if (Number.isNaN(ret)) {
            return null;
        }
        return ret;
    }

    function extractFloatOrZero(value, rounded) {
        const ret = extractFloat(value, rounded);
        return ret === null ? 0. : ret;
    }

    return {
        getElemText: getElemText,
        extractFloat: extractFloat,
        extractFloatOrZero: extractFloatOrZero,
        getElementPosition: function(e, pseudo, field, styleField) {
            let v = e.getBoundingClientRect()[field];
            if (pseudo.length !== 0) {
                const pseudoStyle = window.getComputedStyle(e, pseudo);
                const style = window.getComputedStyle(e);
                v += extractFloatOrZero(pseudoStyle[field]) - extractFloatOrZero(style[styleField]);
            }
            return v;
        },
    };
})();
