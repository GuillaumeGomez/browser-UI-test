// Commands changing the current location or reloading the page.

const { cleanString } = require('../parser.js');

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
    if (parser.elems.length === 0) {
        return {'error': 'Expected a URL, found nothing'};
    } else if (parser.elems.length !== 1) {
        return {'error': `Expected a URL, found \`${parser.getRawArgs()}\``};
    }

    let line = parser.elems[0];
    if (line.kind !== 'string') {
        return {'error': `Expected a URL (inside a string), found \`${line.getArticleKind()}\` (\`\
${line.getText()}\`)`};
    }

    line = line.value.trim();
    // There will always be one element...
    const permissions = 'await arg.browser.overridePermissions(page.url(), arg.permissions);';
    // We just check if it goes to an HTML file, not checking much though...
    if (line.startsWith('http://') === true
        || line.startsWith('https://') === true
        || line.startsWith('www.') === true
        || line.startsWith('file://') === true) {
        return {
            'instructions': [
                `await page.goto("${cleanString(line)}");`,
                permissions,
            ],
        };
    } else if (line.startsWith('.')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"/${cleanString(line)}");`,
                permissions,
            ],
        };
    } else if (line.startsWith('/')) {
        return {
            'instructions': [
                'await page.goto(page.url().split("/").slice(0, -1).join("/") + ' +
                `"${cleanString(line)}");`,
                permissions,
            ],
        };
    }
    return {'error': `a relative path or a full URL was expected, found \`${line}\``};
}

function innerReloadAndHistory(parser, options, command, jsFunc, errorMessage) {
    let timeout = options.timeout;
    const warnings = [];
    const elems = parser.elems;

    if (elems.length > 1) {
        return {
            'error': `expected either [integer] or no arguments, got ${elems.length} arguments`,
        };
    } else if (elems.length !== 0) {
        if (elems[0].kind !== 'number') {
            return {
                'error': 'expected either [integer] or no arguments, found ' +
                    elems[0].getArticleKind(),
            };
        }
        const ret = elems[0].getIntegerValue('timeout', true);
        if (ret.error !== undefined) {
            return ret;
        }
        timeout = ret.value;
        if (parseInt(timeout, 10) === 0) {
            warnings.push('You passed 0 as timeout, it means the timeout has been disabled on ' +
                `this ${command}`);
        }
    }
    let insertAfter = '';
    if (errorMessage !== null) {
        insertAfter = 'if (ret === null) {\n' +
            `throw "${errorMessage}";\n` +
            '}\n';
    }
    return {
        'instructions': [
            `const ret = page.${jsFunc}({'waitUntil': 'domcontentloaded', ` +
                `'timeout': ${timeout}});\n` +
                insertAfter +
                'await ret;',
        ],
        'warnings': warnings.length > 0 ? warnings.join('\n') : undefined,
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
