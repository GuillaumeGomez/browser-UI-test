// List commands handling network blocking.

const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

// Input: glob (for example: "*.js")
function parseBlockNetworkRequest(parser) {
    const ret = validator(parser, {
        kind: 'string',
        allowEmpty: false,
    });
    if (hasError(ret)) {
        return ret;
    }
    const glob = ret.value.value.trim();

    return {
        'instructions': [
            `\
await pages[0].setRequestInterception(true);
pages[0].on('request', interceptedRequest => {
    if (interceptedRequest.isInterceptResolutionHandled()) return;
    function matchesGlob(glob, text) {
        const wildcard = glob.indexOf("*");
        if (wildcard === -1) {
            return glob === text;
        }
        const prefixGlob = glob.substring(0, wildcard);
        const prefixText = text.substring(0, wildcard);
        if (prefixGlob !== prefixText) {
            return false;
        }
        const suffixGlob = glob.substring(wildcard + 1);
        let suffixText = text.substring(wildcard);
        if (suffixGlob.indexOf("*") === -1) {
            return suffixText.endsWith(suffixGlob);
        }
        let matched = matchesGlob(suffixGlob, suffixText);
        while (suffixText !== "" && !matched) {
            suffixText = suffixText.substring(1);
            matched = matchesGlob(suffixGlob, suffixText);
        }
        return matched;
    }
    if (matchesGlob("${glob}", interceptedRequest.url())) {
        interceptedRequest.abort();
    } else {
        interceptedRequest.continue({}, 0);
    }
});`,
        ],
    };
}

module.exports = {
    'parseBlockNetworkRequest': parseBlockNetworkRequest,
};
