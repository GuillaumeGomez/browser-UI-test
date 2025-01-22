// Commands aiming to emulate a given browser state.

const consts = require('../consts.js');
const { validator } = require('../validator.js');
// Not the same `utils.js`!
const { hasError } = require('../utils.js');

// Possible inputs:
//
// * (width, height)
function parseSetWindowSize(parser) {
    const integer = {
        kind: 'number',
        allowFloat: false,
        allowNegative: false,
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                integer,
                integer,
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    const width = tuple[0].value.value;
    const height = tuple[1].value.value;

    return {
        'instructions': [
            `\
const viewport = pages[0].viewport();
const newViewport = {
    ...viewport,
    width: ${width},
    height: ${height},
};
await pages[0].setViewport(newViewport);`,
        ],
    };
}

// Possible inputs:
//
// * number
function parseSetDevicePixelRatio(parser) {
    const ret = validator(parser,
        {
            kind: 'number',
            allowFloat: true,
            allowNegative: false,
            allowZero: false,
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    return {
        'instructions': [
            `\
const viewport = pages[0].viewport();
const newViewport = {
    ...viewport,
    deviceScaleFactor: ${ret.value.getRaw()},
};
await pages[0].setViewport(newViewport);`,
        ],
    };
}

// Possible inputs:
//
// * string
function parseEmulate(parser) {
    const ret = validator(parser,
        {
            kind: 'string',
            allowEmpty: false,
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const device = ret.value.getStringValue();
    return {
        'instructions': [
            `\
if (arg.puppeteer.KnownDevices["${device}"] === undefined) {
    throw 'Unknown device \`${device}\`. List of available devices can be found there: \
https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js or \
you can use \`--show-devices\` option';
} else {
    await pages[0].emulate(arg.puppeteer.KnownDevices["${device}"]);
}`,
        ],
    };
}

// Possible inputs:
//
// * (number, number)
function parseGeolocation(parser) {
    const number = {
        kind: 'number',
        allowFloat: true,
        allowNegative: true,
    };
    const ret = validator(parser,
        {
            kind: 'tuple',
            elements: [
                number,
                number,
            ],
        },
    );
    if (hasError(ret)) {
        return ret;
    }

    const tuple = ret.value.entries;
    return {
        'instructions': [
            `await pages[0].setGeolocation(${tuple[0].value.getRaw()},${tuple[1].value.getRaw()});`,
        ],
    };
}

// Possible inputs:
//
// * array of strings
function parsePermissions(parser) {
    const ret = validator(parser,
        {
            kind: 'array',
            valueTypes: {
                'string': {},
            },
        },
    );
    if (hasError(ret)) {
        return ret;
    }
    const array = ret.value;

    for (const value of array.entries) {
        if (consts.AVAILABLE_PERMISSIONS.indexOf(value.getRaw()) === -1) {
            return {
                'error': `\`${value.getErrorText()}\` is an unknown permission, you can see ` +
                    'the list of available permissions with the `--show-permissions` option',
            };
        }
    }

    return {
        'instructions': [
            `arg.permissions = ${array.displayInCode()};`,
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseJavascript(parser) {
    const ret = validator(parser, { kind: 'boolean' });
    if (hasError(ret)) {
        return ret;
    }

    return {
        'instructions': [
            `await pages[0].setJavaScriptEnabled(${ret.value.getRaw()});`,
        ],
    };
}

// Possible inputs:
//
// * number
function parseSetFontSize(parser) {
    const ret = validator(parser, {
        kind: 'number',
        allowFloat: false,
        allowNegative: false,
        allowZero: false,
    });
    if (hasError(ret)) {
        return ret;
    }
    const fontSize = ret.value.getRaw();

    return {
        'instructions': [`\
const client = await pages[0].target().createCDPSession();
await client.send("Page.enable");
await client.send("Page.setFontSizes", {
    fontSizes: {
        standard: ${fontSize},
        fixed: ${fontSize},
    }
});`,
        ],
    };
}

module.exports = {
    'parseSetDevicePixelRatio': parseSetDevicePixelRatio,
    'parseEmulate': parseEmulate,
    'parseSetFontSize': parseSetFontSize,
    'parseGeolocation': parseGeolocation,
    'parseJavascript': parseJavascript,
    'parsePermissions': parsePermissions,
    'parseSetWindowSize': parseSetWindowSize,
};
