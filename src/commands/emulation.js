// Commands aiming to emulate a given browser state.

const { checkIntegerTuple } = require('./utils.js');
const consts = require('../consts.js');

// Possible inputs:
//
// * (width, height)
function parseSize(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected `([number], [number])`, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {'error': `expected \`([number], [number])\`, found \`${parser.getRawArgs()}\``};
    }
    const ret = checkIntegerTuple(elems[0], 'width', 'height', true);
    if (ret.error !== undefined) {
        return ret;
    }
    const [width, height] = ret.value;
    return {
        'instructions': [
            `await page.setViewport({width: ${width}, height: ${height}})`,
        ],
    };
}

// Possible inputs:
//
// * string
function parseEmulate(parser) {
    const elems = parser.elems;
    if (elems.length === 0) {
        return {'error': 'expected string for "device name", found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'string') {
        return {'error': `expected string for "device name", found \`${parser.getRawArgs()}\``};
    }
    const device = elems[0].getStringValue();
    return {
        'instructions': [
            `if (arg.puppeteer.devices["${device}"] === undefined) { throw 'Unknown device ` +
            `\`${device}\`. List of available devices can be found there: ` +
            'https://github.com/GoogleChrome/puppeteer/blob/master/lib/DeviceDescriptors.js or ' +
            'you can use `--show-devices` option\'; }' +
            ` else { await page.emulate(arg.puppeteer.devices["${device}"]); }`,
        ],
    };
}

// Possible inputs:
//
// * (number, number)
function parseGeolocation(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected (longitude [number], latitude [number]), found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'tuple') {
        return {
            'error': 'expected (longitude [number], latitude [number]), ' +
                `found \`${parser.getRawArgs()}\``,
        };
    }
    const tuple = elems[0].getRaw();
    if (tuple[0].kind !== 'number') {
        return {
            'error': 'expected number for longitude (first argument), ' +
                `found \`${tuple[0].getText()}\``,
        };
    } else if (tuple[1].kind !== 'number') {
        return {
            'error': 'expected number for latitude (second argument), ' +
                `found \`${tuple[1].getText()}\``,
        };
    }
    return {
        'instructions': [
            `await page.setGeolocation(${tuple[0].getRaw()}, ${tuple[1].getRaw()});`,
        ],
    };
}

// Possible inputs:
//
// * array of strings
function parsePermissions(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected an array of strings, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'array') {
        return {'error': `expected an array of strings, found \`${parser.getRawArgs()}\``};
    }
    const array = elems[0].getRaw();
    if (array.length > 0 && array[0].kind !== 'string') {
        return {'error': `expected an array of strings, found \`${elems[0].getText()}\``};
    }

    for (let i = 0; i < array.length; ++i) {
        if (consts.AVAILABLE_PERMISSIONS.indexOf(array[i].getRaw()) === -1) {
            return {
                'error': `\`${array[i].getText()}\` is an unknown permission, you can see the ` +
                    'list of available permissions with the `--show-permissions` option',
            };
        }
    }

    return {
        'instructions': [
            `arg.permissions = ${elems[0].getText()};`,
            'await arg.browser.overridePermissions(page.url(), arg.permissions);',
        ],
    };
}

// Possible inputs:
//
// * boolean value (`true` or `false`)
function parseJavascript(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected `true` or `false` value, found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'bool') {
        return {'error': `expected \`true\` or \`false\` value, found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            `await page.setJavaScriptEnabled(${elems[0].getRaw()});`,
        ],
    };
}

// Possible inputs:
//
// * number
function parseFontSize(parser) {
    const elems = parser.elems;

    if (elems.length === 0) {
        return {'error': 'expected a font size (in pixels), found nothing'};
    } else if (elems.length !== 1 || elems[0].kind !== 'number') {
        return {'error': `expected a font size (in pixels), found \`${parser.getRawArgs()}\``};
    }
    return {
        'instructions': [
            'const client = await page.target().createCDPSession();\n' +
            'await client.send("Page.enable");\n' +
            'await client.send("Page.setFontSizes", {\n' +
                'fontSizes: {\n' +
                    `standard: ${elems[0].getRaw()},\n` +
                    `fixed: ${elems[0].getRaw()},\n` +
                '}\n' +
            '});',
        ],
    };
}

module.exports = {
    'parseEmulate': parseEmulate,
    'parseFontSize': parseFontSize,
    'parseGeolocation': parseGeolocation,
    'parseJavascript': parseJavascript,
    'parsePermissions': parsePermissions,
    'parseSize': parseSize,
};
