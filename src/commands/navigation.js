// Commands changing the current location or reloading the page.

const { cleanString } = require('../parser.js');
const { hasError } = require('../utils.js');
const { validator } = require('../validator.js');

// Possible inputs:
//
// * string
//
// The string can be either one of:
//
// * relative path (example: ../struct.Path.html)
// * full URL (for example: https://doc.rust-lang.org/std/struct.Path.html)
// * local path (example: file://some-file.html)
function parseGoTo(parser) {
    const ret = validator(parser, {
        kind: 'string',
        allowEmpty: false,
    });
    if (hasError(ret)) {
        return ret;
    }

    const path = ret.value.value.trim();

    let goto_arg;
    const permissions = 'await arg.browser.overridePermissions(page.url(), arg.permissions);';
    // We just check if it goes to an HTML file, not checking much though...
    if (path.startsWith('http://') === true
        || path.startsWith('https://') === true
        || path.startsWith('www.') === true
        || path.startsWith('file://') === true
    ) {
        goto_arg = `"${cleanString(path)}"`;
    } else if (path.startsWith('.')) {
        goto_arg = `page.url().split("/").slice(0, -1).join("/") + "/${cleanString(path)}"`;
    } else if (path.startsWith('/')) {
        goto_arg = `page.url().split("/").slice(0, -1).join("/") + "${cleanString(path)}"`;
    } else {
        return {'error': `a relative path or a full URL was expected, found \`${path}\``};
    }
    const command = `\
const url = ${goto_arg};
try {
    await page.goto(url);
} catch(exc) {
    if (exc instanceof arg.puppeteer.ProtocolError) {
        throw "Cannot navigate to invalid URL \`" + url + "\`";
    } else {
        throw exc;
    }
}`;
    return {
        'instructions': [
            command,
            permissions,
        ],
    };
}

function innerReloadAndHistory(parser, options, command, jsFunc, errorMessage) {
    const ret = validator(parser, {
        kind: 'number',
        allowFloat: false,
        allowNegative: false,
        optional: true,
    });
    if (hasError(ret)) {
        return ret;
    }

    let timeout = options.timeout;
    const warnings = [];

    if (ret.value !== undefined) {
        timeout = ret.value.value;
        if (parseInt(timeout, 10) === 0) {
            warnings.push(`\
You passed 0 as timeout, it means the timeout has been disabled on this ${command}`);
        }
    }

    let insertAfter = '';
    if (errorMessage !== null) {
        insertAfter = `\
if (ret === null) {
    throw "${errorMessage}";
}\n`;
    }
    return {
        'instructions': [`\
const ret = page.${jsFunc}({'waitUntil': 'domcontentloaded', 'timeout': ${timeout}});
${insertAfter}await ret;`,
        ],
        'warnings': warnings,
    };
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseReload(parser, options) {
    return innerReloadAndHistory(parser, options, 'reload', 'reload', null);
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseHistoryGoBack(parser, options) {
    return innerReloadAndHistory(
        parser, options, 'history-go-back', 'goBack', 'cannot go back in history');
}

// Possible inputs:
//
// * nothing
// * number (of milliseconds before timeout)
function parseHistoryGoForward(parser, options) {
    return innerReloadAndHistory(
        parser, options, 'history-go-forward', 'goForward', 'cannot go forward in history');
}

module.exports = {
    'parseGoTo': parseGoTo,
    'parseHistoryGoBack': parseHistoryGoBack,
    'parseHistoryGoForward': parseHistoryGoForward,
    'parseReload': parseReload,
};
