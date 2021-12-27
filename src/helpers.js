// eslint-disable-next-line no-unused-vars
const browserUiTestHelpers = {
    compareElemsText: function(e, value) {
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
        if (elemValue !== value) {
            throw '"' + elemValue + '" !== "' + value + '"';
        }
    },
};
